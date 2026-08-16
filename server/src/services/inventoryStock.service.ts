import mongoose from "mongoose";
import { AppError } from "../middleware/errorHandler";
import { withTransaction } from "../utils/transaction";
import { InventoryVariant } from "../models/inventoryVariant";
import { InventoryLot } from "../models/inventoryLot";
import { InventoryMovement } from "../models/inventoryMovement";
import { InventoryWithdrawalV2 } from "../models/inventoryWithdrawalV2";
import { Rack } from "../models/rack";
import { escapeRegex, normalizeSku } from "../utils/string";
import { paginateQuery, PaginationOptions } from "../utils/pagination";
import { ensureBrand, findOrCreateProduct } from "./inventoryProduct.service";

const FEFO_CATEGORIES = ["Contact Lens", "Solution"];

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

function sessionOpts<T extends Record<string, unknown>>(
  session: mongoose.ClientSession | null,
  extra: T = {} as T
) {
  return session ? { ...extra, session } : extra;
}

async function getRackLabel(rackId?: string): Promise<string> {
  if (!rackId) return "";
  const rack = await Rack.findById(rackId).select("code").lean();
  return rack?.code || "";
}

async function nextLotNumber(
  variantId: string,
  session: mongoose.ClientSession | null
): Promise<string> {
  const count = await InventoryLot.countDocuments({ variantId }, session ? { session } : {});
  return `LOT-${String(count + 1).padStart(3, "0")}`;
}

interface MovementInput {
  variantId: string;
  sku: string;
  type: string;
  quantity: number;
  beforeQuantity: number;
  afterQuantity: number;
  lotId?: string;
  lotBreakdown?: Array<{ lotId: string; quantity: number }>;
  referenceType?: string;
  referenceId?: string;
  note?: string;
  by?: string;
  rackId?: string;
  rackLabel?: string;
  oldRackId?: string;
  newRackId?: string;
}

async function createMovement(input: MovementInput, session: mongoose.ClientSession | null) {
  await InventoryMovement.create(
    [
      {
        variantId: input.variantId,
        sku: input.sku,
        type: input.type,
        quantity: input.quantity,
        beforeQuantity: input.beforeQuantity,
        afterQuantity: input.afterQuantity,
        lotId: input.lotId,
        lotBreakdown: input.lotBreakdown || [],
        referenceType: input.referenceType || "MANUAL",
        referenceId: input.referenceId,
        note: input.note || "",
        by: input.by || "",
        rackId: input.rackId,
        rackLabel: input.rackLabel,
        oldRackId: input.oldRackId,
        newRackId: input.newRackId,
      },
    ],
    session ? { session } : {}
  );
}

// Deducts a quantity from the available lots of a variant (FIFO by default,
// FEFO for expiry-sensitive categories). Uses conditional updates so a lot can
// never go below zero even when two requests race.
async function deductLots(
  variantId: string,
  category: string,
  quantity: number,
  session: mongoose.ClientSession | null,
  lotId?: string
): Promise<Array<{ lotId: string; quantity: number }>> {
  if (quantity <= 0) return [];

  if (lotId) {
    const res = await InventoryLot.findOneAndUpdate(
      { _id: lotId, variantId, quantity: { $gte: quantity } },
      { $inc: { quantity: -quantity } },
      sessionOpts(session, { new: true })
    ).lean();
    if (!res) throw new AppError(400, "Selected lot does not have enough stock.");
    return [{ lotId, quantity }];
  }

  let lots = await InventoryLot.find(
    { variantId, quantity: { $gt: 0 } },
    null,
    session ? { session } : {}
  ).lean();
  if (FEFO_CATEGORIES.includes(category)) {
    lots = lots
      .filter((l) => !!l.expiryDate)
      .sort((a, b) => (a.expiryDate as Date).getTime() - (b.expiryDate as Date).getTime())
      .concat(
        lots
          .filter((l) => !l.expiryDate)
          .sort((a, b) => (a.createdAt as Date).getTime() - (b.createdAt as Date).getTime())
      );
  } else {
    lots = lots.sort((a, b) => (a.createdAt as Date).getTime() - (b.createdAt as Date).getTime());
  }

  const available = lots.reduce((s, l) => s + (l.quantity || 0), 0);
  if (available < quantity) {
    throw new AppError(400, `Insufficient stock. Available: ${available}, requested: ${quantity}`);
  }

  const breakdown: Array<{ lotId: string; quantity: number }> = [];
  let remaining = quantity;
  for (const lot of lots) {
    if (remaining <= 0) break;
    const take = Math.min(remaining, lot.quantity || 0);
    const res = await InventoryLot.findOneAndUpdate(
      { _id: lot._id, quantity: { $gte: take } },
      { $inc: { quantity: -take } },
      sessionOpts(session, { new: true })
    ).lean();
    if (!res) throw new AppError(409, "Stock changed. Please refresh and retry.");
    breakdown.push({ lotId: lot._id.toString(), quantity: take });
    remaining -= take;
  }
  if (remaining > 0) {
    throw new AppError(400, `Insufficient stock. Available: ${available}, requested: ${quantity}`);
  }
  return breakdown;
}

interface DeductResult {
  before: number;
  after: number;
  breakdown: Array<{ lotId: string; quantity: number }>;
  price: number;
}

async function deductStock(
  variantId: string,
  quantity: number,
  session: mongoose.ClientSession | null,
  lotId?: string
): Promise<DeductResult> {
  const variant = await InventoryVariant.findById(
    variantId,
    null,
    session ? { session } : {}
  ).lean();
  if (!variant) throw new AppError(404, "Variant not found");
  const before = variant.stockQuantity || 0;
  if (before < quantity) {
    throw new AppError(400, `Insufficient stock. Available: ${before}, requested: ${quantity}`);
  }

  const aggRes = await InventoryVariant.findOneAndUpdate(
    { _id: variantId, stockQuantity: { $gte: quantity } },
    { $inc: { stockQuantity: -quantity } },
    sessionOpts(session, { new: true })
  ).lean();
  if (!aggRes) throw new AppError(409, "Stock changed. Please refresh and retry.");
  const after = aggRes.stockQuantity || 0;

  try {
    const breakdown = await deductLots(variantId, variant.category, quantity, session, lotId);
    const price = await weightedLotPrice(variantId, breakdown, variant.defaultSellingPrice);
    return { before, after, breakdown, price };
  } catch (err) {
    await InventoryVariant.updateOne(
      { _id: variantId },
      { $inc: { stockQuantity: quantity } },
      session ? { session } : {}
    );
    throw err;
  }
}

async function weightedLotPrice(
  variantId: string,
  breakdown: Array<{ lotId: string; quantity: number }>,
  fallback: number
): Promise<number> {
  let total = 0;
  let qty = 0;
  for (const b of breakdown) {
    const lot = await InventoryLot.findById(b.lotId).select("sellingPrice").lean();
    total += (lot?.sellingPrice || fallback) * b.quantity;
    qty += b.quantity;
  }
  return qty > 0 ? round2(total / qty) : 0;
}

async function restoreStock(
  variantId: string,
  quantity: number,
  session: mongoose.ClientSession | null,
  lotBreakdown?: Array<{ lotId: string; quantity: number }>
): Promise<void> {
  const variant = await InventoryVariant.findById(
    variantId,
    null,
    session ? { session } : {}
  ).lean();
  if (!variant) throw new AppError(404, "Variant not found");

  if (Array.isArray(lotBreakdown) && lotBreakdown.length > 0) {
    for (const b of lotBreakdown) {
      const res = await InventoryLot.findOneAndUpdate(
        { _id: b.lotId, variantId },
        { $inc: { quantity: b.quantity } },
        sessionOpts(session, { new: true })
      ).lean();
      if (!res) {
        await InventoryLot.create(
          [
            {
              variantId,
              lotNumber: await nextLotNumber(variantId, session),
              initialQuantity: b.quantity,
              quantity: b.quantity,
              source: "RETURN",
              purchasePrice: 0,
            },
          ],
          session ? { session } : {}
        );
      }
    }
  } else {
    await InventoryLot.create(
      [
        {
          variantId,
          lotNumber: await nextLotNumber(variantId, session),
          initialQuantity: quantity,
          quantity,
          source: "RETURN",
          purchasePrice: 0,
        },
      ],
      session ? { session } : {}
    );
  }

  await InventoryVariant.updateOne(
    { _id: variantId },
    { $inc: { stockQuantity: quantity } },
    session ? { session } : {}
  );
}

export interface AddStockInput {
  variantId: string;
  quantity: number;
  purchasePrice: number;
  sellingPrice?: number;
  supplierId?: string;
  supplierName?: string;
  rackId?: string;
  purchaseDate?: string | Date;
  batchNumber?: string;
  expiryDate?: string | Date;
  note?: string;
}

export async function addStock(input: AddStockInput, by: string = "") {
  const qty = Math.floor(Number(input.quantity));
  if (!Number.isFinite(qty) || qty < 1) throw new AppError(400, "Quantity must be at least 1");
  const purchasePrice = Math.max(Number(input.purchasePrice) || 0, 0);
  const sellingPrice =
    input.sellingPrice !== undefined ? Math.max(Number(input.sellingPrice) || 0, 0) : undefined;

  return withTransaction(async (session) => {
    const variant = await InventoryVariant.findById(
      input.variantId,
      null,
      session ? { session } : {}
    );
    if (!variant) throw new AppError(404, "Variant not found");
    const before = variant.stockQuantity || 0;

    const rackLabel = await getRackLabel(input.rackId);
    const lot = (
      await InventoryLot.create(
        [
          {
            variantId: input.variantId,
            lotNumber: await nextLotNumber(input.variantId, session),
            initialQuantity: qty,
            quantity: qty,
            purchasePrice,
            sellingPrice: sellingPrice ?? variant.defaultSellingPrice ?? 0,
            supplierId: input.supplierId,
            supplierName: input.supplierName || "",
            rackId: input.rackId,
            rackLabel: rackLabel || variant.rackLabel,
            purchaseDate: input.purchaseDate ? new Date(input.purchaseDate) : undefined,
            batchNumber: input.batchNumber || "",
            expiryDate: input.expiryDate ? new Date(input.expiryDate) : undefined,
            source: "PURCHASE",
            note: input.note || "",
          },
        ],
        session ? { session } : {}
      )
    )[0];

    const update: Record<string, unknown> = { $inc: { stockQuantity: qty } };
    const set: Record<string, unknown> = {};
    if (sellingPrice !== undefined) set.defaultSellingPrice = sellingPrice;
    if (input.rackId) {
      set.rackId = input.rackId;
      set.rackLabel = rackLabel;
    }
    if (input.supplierName) set.supplierName = input.supplierName;
    if (Object.keys(set).length > 0) update.$set = set;

    const updated = await InventoryVariant.findByIdAndUpdate(
      input.variantId,
      update,
      sessionOpts(session, { new: true })
    );
    const after = updated ? updated.stockQuantity || 0 : before + qty;

    await createMovement(
      {
        variantId: input.variantId,
        sku: variant.sku,
        type: "PURCHASE",
        quantity: qty,
        beforeQuantity: before,
        afterQuantity: after,
        lotId: lot._id.toString(),
        lotBreakdown: [{ lotId: lot._id.toString(), quantity: qty }],
        referenceType: "MANUAL",
        note: input.note || "",
        by,
        rackId: input.rackId,
        rackLabel: rackLabel || variant.rackLabel,
      },
      session
    );

    return { variant: updated, lot };
  });
}

export interface VariantWithStockInput {
  brand?: string;
  brandId?: string;
  category?: string;
  inventoryType?: string;
  model: string;
  gender?: string;
  color?: string;
  size?: string;
  sku?: string;
  quantity: number;
  purchasePrice: number;
  sellingPrice?: number;
  rackId?: string;
  supplierId?: string;
  supplierName?: string;
  material?: string;
  frameShape?: string;
  frameType?: string;
  templeSize?: string;
  bridgeSize?: string;
  lensWidth?: string;
  purchaseDate?: string | Date;
  batchNumber?: string;
  expiryDate?: string | Date;
  note?: string;
  attributes?: Record<string, unknown>;
}

export async function createVariantWithStock(input: VariantWithStockInput, by: string = "") {
  const qty = Math.floor(Number(input.quantity));
  if (!Number.isFinite(qty) || qty < 1) throw new AppError(400, "Quantity must be at least 1");
  const sku = normalizeSku(input.sku || "");
  if (!sku) throw new AppError(400, "SKU is required");
  const purchasePrice = Math.max(Number(input.purchasePrice) || 0, 0);
  const sellingPrice =
    input.sellingPrice !== undefined ? Math.max(Number(input.sellingPrice) || 0, 0) : 0;

  return withTransaction(async (session) => {
    const existing = await InventoryVariant.findOne(
      { sku },
      null,
      session ? { session } : {}
    ).lean();
    if (existing) {
      throw new AppError(
        409,
        `SKU ${sku} already exists. Add this stock to the existing variant instead?`
      );
    }

    const brand = await ensureBrand(input.brandId || input.brand || "", session);
    const product = await findOrCreateProduct(
      {
        brandId: brand?._id?.toString() || "",
        brandName: brand?.name || input.brand || "",
        category: input.category || "Specs",
        inventoryType: input.inventoryType,
        model: input.model,
        gender: input.gender,
      },
      session
    );

    const rackLabel = await getRackLabel(input.rackId);
    const variantData: Record<string, unknown> = {
      productId: product._id.toString(),
      brandId: brand?._id || undefined,
      brandName: brand?.name || input.brand || "",
      category: product.category,
      model: product.model,
      gender: input.gender || product.gender || "",
      sku,
      variantCode: input.color || "",
      color: input.color || "",
      size: input.size || "",
      material: input.material || "",
      frameShape: input.frameShape || "",
      frameType: input.frameType || "",
      templeSize: input.templeSize || "",
      bridgeSize: input.bridgeSize || "",
      lensWidth: input.lensWidth || "",
      stockQuantity: qty,
      defaultSellingPrice: sellingPrice,
      rackId: input.rackId,
      rackLabel: rackLabel || "",
      supplierId: input.supplierId,
      supplierName: input.supplierName || "",
      attributes: input.attributes || {},
    };

    const variant = await InventoryVariant.create([variantData], session ? { session } : {});
    const v = variant[0];

    const lot = (
      await InventoryLot.create(
        [
          {
            variantId: v._id.toString(),
            lotNumber: "LOT-001",
            initialQuantity: qty,
            quantity: qty,
            purchasePrice,
            sellingPrice,
            supplierId: input.supplierId,
            supplierName: input.supplierName || "",
            rackId: input.rackId,
            rackLabel: rackLabel || "",
            purchaseDate: input.purchaseDate ? new Date(input.purchaseDate) : undefined,
            batchNumber: input.batchNumber || "",
            expiryDate: input.expiryDate ? new Date(input.expiryDate) : undefined,
            source: "PURCHASE",
            note: input.note || "",
          },
        ],
        session ? { session } : {}
      )
    )[0];

    await createMovement(
      {
        variantId: v._id.toString(),
        sku,
        type: "PURCHASE",
        quantity: qty,
        beforeQuantity: 0,
        afterQuantity: qty,
        lotId: lot._id.toString(),
        lotBreakdown: [{ lotId: lot._id.toString(), quantity: qty }],
        referenceType: "MANUAL",
        note: input.note || "",
        by,
        rackId: input.rackId,
        rackLabel: rackLabel || "",
      },
      session
    );

    return { variant: v, lot, product, brand };
  });
}

export interface WithdrawStockInput {
  items: Array<{ variantId: string; quantity: number; lotId?: string }>;
  reason?: string;
  note?: string;
}

export async function withdrawStock(input: WithdrawStockInput, by: string = "") {
  const items = new Map<string, { variantId: string; quantity: number; lotId?: string }>();
  for (const raw of input.items || []) {
    if (!raw || !raw.variantId) throw new AppError(400, "Each withdrawal item needs a variantId");
    const qty = Math.floor(Number(raw.quantity));
    if (!Number.isFinite(qty) || qty < 1)
      throw new AppError(400, "Withdrawal quantity must be at least 1");
    const key = raw.variantId.toString();
    const merged = items.get(key);
    if (merged) {
      merged.quantity += qty;
    } else {
      items.set(key, { variantId: raw.variantId.toString(), quantity: qty, lotId: raw.lotId });
    }
  }
  if (items.size === 0) throw new AppError(400, "No items to withdraw");

  const reason = input.reason || "Other";
  const note = input.note || "";

  return withTransaction(async (session) => {
    const withdrawal = new InventoryWithdrawalV2({
      items: [],
      reason,
      note,
      by,
      totalQty: 0,
      totalPrice: 0,
    });
    await withdrawal.save(session ? { session } : {});

    const withdrawalItems: Array<Record<string, unknown>> = [];
    const movements: Array<Record<string, unknown>> = [];
    let totalQty = 0;
    let totalPrice = 0;

    for (const item of items.values()) {
      const variant = await InventoryVariant.findById(
        item.variantId,
        null,
        session ? { session } : {}
      ).lean();
      if (!variant) throw new AppError(404, `Variant not found: ${item.variantId}`);

      const result = await deductStock(item.variantId, item.quantity, session, item.lotId);
      withdrawalItems.push({
        variantId: item.variantId,
        sku: variant.sku,
        brand: variant.brandName || "",
        model: variant.model || "",
        color: variant.color || "",
        category: variant.category || "",
        lotId: result.breakdown[0]?.lotId,
        lotBreakdown: result.breakdown,
        quantity: item.quantity,
        price: result.price,
      });
      totalQty += item.quantity;
      totalPrice += result.price * item.quantity;

      movements.push({
        variantId: item.variantId,
        sku: variant.sku,
        type: "WITHDRAWAL",
        quantity: -item.quantity,
        beforeQuantity: result.before,
        afterQuantity: result.after,
        lotId: result.breakdown[0]?.lotId,
        lotBreakdown: result.breakdown,
        referenceType: "WITHDRAWAL",
        referenceId: withdrawal._id.toString(),
        note: `${reason}${note ? ` — ${note}` : ""}`,
        by,
        rackId: variant.rackId,
        rackLabel: variant.rackLabel,
      });
    }

    await InventoryMovement.create(movements, session ? { session } : {});

    withdrawal.items = withdrawalItems as any;
    withdrawal.totalQty = totalQty;
    withdrawal.totalPrice = round2(totalPrice);
    await withdrawal.save(session ? { session } : {});

    return { withdrawal, movements };
  });
}

export async function reverseWithdrawal(id: string, by: string = "") {
  return withTransaction(async (session) => {
    const withdrawal = await InventoryWithdrawalV2.findById(id, null, session ? { session } : {});
    if (!withdrawal) throw new AppError(404, "Withdrawal not found");
    if (withdrawal.reversed) throw new AppError(400, "Withdrawal has already been reversed");

    const movements: Array<Record<string, unknown>> = [];
    for (const item of withdrawal.items || []) {
      if (!item.variantId)
        throw new AppError(400, `Withdrawal item is missing variant for ${item.sku}`);
      const variant = await InventoryVariant.findById(
        item.variantId,
        null,
        session ? { session } : {}
      ).lean();
      if (!variant) throw new AppError(404, `Variant not found for ${item.sku}`);

      const before = variant.stockQuantity || 0;
      const lotBreakdown = (item.lotBreakdown || []).map((lb) => ({
        lotId: lb.lotId?.toString() || "",
        quantity: lb.quantity,
      }));
      await restoreStock(item.variantId.toString(), item.quantity, session, lotBreakdown);
      movements.push({
        variantId: item.variantId,
        sku: item.sku,
        type: "RETURN",
        quantity: item.quantity,
        beforeQuantity: before,
        afterQuantity: before + item.quantity,
        lotId: (item.lotBreakdown && item.lotBreakdown[0]?.lotId) || undefined,
        lotBreakdown: item.lotBreakdown || [],
        referenceType: "WITHDRAWAL",
        referenceId: withdrawal._id.toString(),
        note: `Reversal of withdrawal${withdrawal.note ? ` — ${withdrawal.note}` : ""}`,
        by,
        rackId: variant.rackId,
        rackLabel: variant.rackLabel,
      });
    }

    await InventoryMovement.create(movements, session ? { session } : {});

    withdrawal.reversed = true;
    withdrawal.reversedAt = new Date();
    await withdrawal.save(session ? { session } : {});

    return withdrawal;
  });
}

export async function adjustStock(
  variantId: string,
  delta: number,
  note: string = "",
  by: string = ""
) {
  const qty = Math.floor(Number(delta));
  if (!Number.isFinite(qty) || qty === 0)
    throw new AppError(400, "Adjustment quantity must be a non-zero number");

  return withTransaction(async (session) => {
    return applyAdjustmentInTxn(variantId, qty, note, by, "ADJUSTMENT", session);
  });
}

async function applyAdjustmentInTxn(
  variantId: string,
  qty: number,
  note: string,
  by: string,
  type: string,
  session: mongoose.ClientSession | null
) {
  const variant = await InventoryVariant.findById(
    variantId,
    null,
    session ? { session } : {}
  ).lean();
  if (!variant) throw new AppError(404, "Variant not found");
  const before = variant.stockQuantity || 0;

  let lotId: string | undefined;
  let breakdown: Array<{ lotId: string; quantity: number }>;

  if (qty > 0) {
    const lot = (
      await InventoryLot.create(
        [
          {
            variantId,
            lotNumber: await nextLotNumber(variantId, session),
            initialQuantity: qty,
            quantity: qty,
            purchasePrice: 0,
            sellingPrice: variant.defaultSellingPrice || 0,
            rackId: variant.rackId,
            rackLabel: variant.rackLabel,
            source: "ADJUSTMENT",
            note: note || "",
          },
        ],
        session ? { session } : {}
      )
    )[0];
    lotId = lot._id.toString();
    breakdown = [{ lotId: lotId, quantity: qty }];
    await InventoryVariant.updateOne(
      { _id: variantId },
      { $inc: { stockQuantity: qty } },
      session ? { session } : {}
    );
  } else {
    const result = await deductStock(variantId, -qty, session);
    lotId = result.breakdown[0]?.lotId;
    breakdown = result.breakdown;
  }

  const updated = await InventoryVariant.findById(
    variantId,
    null,
    session ? { session } : {}
  ).lean();
  const after = updated ? updated.stockQuantity || 0 : before + qty;

  const movement = (
    await InventoryMovement.create(
      [
        {
          variantId,
          sku: variant.sku,
          type,
          quantity: qty,
          beforeQuantity: before,
          afterQuantity: after,
          lotId,
          lotBreakdown: breakdown,
          referenceType: "MANUAL",
          note: note || "",
          by,
          rackId: variant.rackId,
          rackLabel: variant.rackLabel,
        },
      ],
      session ? { session } : {}
    )
  )[0];

  return { variant: updated, movement };
}

export async function applyStockCorrections(
  entries: Array<{ variantId: string; expectedQuantity: number; countedQuantity: number }>,
  note: string = "",
  by: string = ""
) {
  const normalized = entries.filter(
    (e) => Math.floor(Number(e.countedQuantity)) !== Math.floor(Number(e.expectedQuantity))
  );
  if (normalized.length === 0) return { movements: [], count: 0 };

  return withTransaction(async (session) => {
    const movements: any[] = [];
    for (const e of normalized) {
      const delta = Math.floor(Number(e.countedQuantity)) - Math.floor(Number(e.expectedQuantity));
      const result = await applyAdjustmentInTxn(
        e.variantId,
        delta,
        note,
        by,
        "COUNT_CORRECTION",
        session
      );
      movements.push(result.movement);
    }
    return { movements, count: normalized.length };
  });
}

export async function listWithdrawals(
  options: { page?: string; limit?: string; reason?: string; by?: string; search?: string } = {}
) {
  const filter: Record<string, unknown> = {};
  if (options.reason) filter.reason = options.reason;
  if (options.by) filter.by = { $regex: escapeRegex(options.by), $options: "i" };
  if (options.search) {
    const s = escapeRegex(options.search);
    filter.$or = [
      { "items.sku": { $regex: s, $options: "i" } },
      { "items.brand": { $regex: s, $options: "i" } },
      { "items.model": { $regex: s, $options: "i" } },
    ];
  }

  const baseQuery = InventoryWithdrawalV2.find(filter).sort({ createdAt: -1 }) as mongoose.Query<
    any[],
    any
  >;
  return paginateQuery(baseQuery, { page: options.page, limit: options.limit });
}

export async function getWithdrawalById(id: string) {
  const doc = await InventoryWithdrawalV2.findById(id).lean();
  if (!doc) throw new AppError(404, "Withdrawal not found");
  return doc;
}

export interface MovementFilters extends PaginationOptions {
  variantId?: string;
  sku?: string;
  type?: string;
  user?: string;
  rack?: string;
  search?: string;
  startDate?: string;
  endDate?: string;
}

export async function listMovements(options: MovementFilters = {}) {
  const filter: Record<string, unknown> = {};
  if (options.variantId) filter.variantId = options.variantId;
  if (options.sku) filter.sku = { $regex: escapeRegex(options.sku), $options: "i" };
  if (options.type) filter.type = options.type;
  if (options.user) filter.by = { $regex: escapeRegex(options.user), $options: "i" };
  if (options.rack) filter.rackLabel = { $regex: escapeRegex(options.rack), $options: "i" };
  if (options.search) {
    const s = escapeRegex(options.search.trim());
    filter.$or = [
      { sku: { $regex: s, $options: "i" } },
      { note: { $regex: s, $options: "i" } },
      { by: { $regex: s, $options: "i" } },
      { referenceType: { $regex: s, $options: "i" } },
    ];
  }
  if (options.startDate || options.endDate) {
    const createdAt: Record<string, Date> = {};
    if (options.startDate) createdAt.$gte = new Date(options.startDate);
    if (options.endDate) createdAt.$lte = new Date(options.endDate);
    filter.createdAt = createdAt;
  }

  const baseQuery = InventoryMovement.find(filter).sort({ createdAt: -1 }) as mongoose.Query<
    any[],
    any
  >;
  return paginateQuery(baseQuery, { page: options.page, limit: options.limit });
}
