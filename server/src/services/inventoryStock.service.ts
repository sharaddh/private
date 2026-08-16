import { AppError } from "../middleware/errorHandler";
import { prisma, Prisma } from "../db/prisma";
import { normalizeSku } from "../utils/string";
import { paginateFind, PaginationOptions } from "../utils/pagination";
import { ensureBrand, findOrCreateProduct } from "./inventoryProduct.service";

const FEFO_CATEGORIES = ["Contact Lens", "Solution"];

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

async function getRackLabel(rackId?: string): Promise<string> {
  if (!rackId) return "";
  const rack = await prisma.rack.findUnique({ where: { id: rackId }, select: { code: true } });
  return rack?.code || "";
}

async function nextLotNumber(variantId: string): Promise<string> {
  const count = await prisma.inventoryLot.count({ where: { variantId } });
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

async function createMovement(input: MovementInput) {
  await prisma.inventoryMovement.create({
    data: {
      variantId: input.variantId,
      sku: input.sku,
      type: input.type,
      quantity: input.quantity,
      beforeQuantity: input.beforeQuantity,
      afterQuantity: input.afterQuantity,
      lotId: input.lotId,
      referenceType: input.referenceType || "MANUAL",
      referenceId: input.referenceId,
      note: input.note || "",
      by: input.by || "",
      rackId: input.rackId,
      rackLabel: input.rackLabel || "",
      oldRackId: input.oldRackId,
      newRackId: input.newRackId,
      lots: {
        create: (input.lotBreakdown || []).map((lb) => ({
          lotId: lb.lotId,
          quantity: lb.quantity,
        })),
      },
    } as any,
  });
}

async function deductLots(
  variantId: string,
  category: string,
  quantity: number,
  lotId?: string
): Promise<Array<{ lotId: string; quantity: number }>> {
  if (quantity <= 0) return [];

  if (lotId) {
    const lot = await prisma.inventoryLot.findFirst({
      where: { id: lotId, variantId, quantity: { gte: quantity } },
    });
    if (!lot) throw new AppError(400, "Selected lot does not have enough stock.");
    await prisma.inventoryLot.update({
      where: { id: lotId },
      data: { quantity: { decrement: quantity } },
    });
    return [{ lotId, quantity }];
  }

  let lots = await prisma.inventoryLot.findMany({
    where: { variantId, quantity: { gt: 0 } },
  });
  if (FEFO_CATEGORIES.includes(category)) {
    lots = lots
      .filter((l) => !!l.expiryDate)
      .sort((a, b) => (a.expiryDate as Date).getTime() - (b.expiryDate as Date).getTime())
      .concat(
        lots
          .filter((l) => !l.expiryDate)
          .sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime())
      );
  } else {
    lots = lots.sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime());
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
    const currentLot = await prisma.inventoryLot.findFirst({
      where: { id: lot.id, quantity: { gte: take } },
    });
    if (!currentLot) throw new AppError(409, "Stock changed. Please refresh and retry.");
    await prisma.inventoryLot.update({
      where: { id: lot.id },
      data: { quantity: { decrement: take } },
    });
    breakdown.push({ lotId: lot.id, quantity: take });
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
  lotId?: string
): Promise<DeductResult> {
  const variant = await prisma.inventoryVariant.findUnique({ where: { id: variantId } });
  if (!variant) throw new AppError(404, "Variant not found");
  const before = variant.stockQuantity || 0;
  if (before < quantity) {
    throw new AppError(400, `Insufficient stock. Available: ${before}, requested: ${quantity}`);
  }

  const aggLot = await prisma.inventoryVariant.findFirst({
    where: { id: variantId, stockQuantity: { gte: quantity } },
  });
  if (!aggLot) throw new AppError(409, "Stock changed. Please refresh and retry.");
  const updated = await prisma.inventoryVariant.update({
    where: { id: variantId },
    data: { stockQuantity: { decrement: quantity } },
  });
  const after = updated.stockQuantity || 0;

  try {
    const breakdown = await deductLots(variantId, variant.category, quantity, lotId);
    const price = await weightedLotPrice(variantId, breakdown, variant.defaultSellingPrice);
    return { before, after, breakdown, price };
  } catch (err) {
    await prisma.inventoryVariant.update({
      where: { id: variantId },
      data: { stockQuantity: { increment: quantity } },
    });
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
    const lot = await prisma.inventoryLot.findUnique({
      where: { id: b.lotId },
      select: { sellingPrice: true },
    });
    total += (lot?.sellingPrice || fallback) * b.quantity;
    qty += b.quantity;
  }
  return qty > 0 ? round2(total / qty) : 0;
}

async function restoreStock(
  variantId: string,
  quantity: number,
  lotBreakdown?: Array<{ lotId: string; quantity: number }>
): Promise<void> {
  const variant = await prisma.inventoryVariant.findUnique({ where: { id: variantId } });
  if (!variant) throw new AppError(404, "Variant not found");

  if (Array.isArray(lotBreakdown) && lotBreakdown.length > 0) {
    for (const b of lotBreakdown) {
      const existing = await prisma.inventoryLot.findFirst({
        where: { id: b.lotId, variantId },
      });
      if (existing) {
        await prisma.inventoryLot.update({
          where: { id: b.lotId },
          data: { quantity: { increment: b.quantity } },
        });
      } else {
        await prisma.inventoryLot.create({
          data: {
            variantId,
            lotNumber: await nextLotNumber(variantId),
            initialQuantity: b.quantity,
            quantity: b.quantity,
            source: "RETURN",
            purchasePrice: 0,
          } as any,
        });
      }
    }
  } else {
    await prisma.inventoryLot.create({
      data: {
        variantId,
        lotNumber: await nextLotNumber(variantId),
        initialQuantity: quantity,
        quantity,
        source: "RETURN",
        purchasePrice: 0,
      } as any,
    });
  }

  await prisma.inventoryVariant.update({
    where: { id: variantId },
    data: { stockQuantity: { increment: quantity } },
  });
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

  const variant = await prisma.inventoryVariant.findUnique({ where: { id: input.variantId } });
  if (!variant) throw new AppError(404, "Variant not found");
  const before = variant.stockQuantity || 0;

  const rackLabel = await getRackLabel(input.rackId);
  const lot = await prisma.inventoryLot.create({
    data: {
      variantId: input.variantId,
      lotNumber: await nextLotNumber(input.variantId),
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
    } as any,
  });

  const updateData: Record<string, unknown> = {
    stockQuantity: { increment: qty },
  };
  if (sellingPrice !== undefined) updateData.defaultSellingPrice = sellingPrice;
  if (input.rackId) {
    updateData.rackId = input.rackId;
    updateData.rackLabel = rackLabel;
  }
  if (input.supplierName) updateData.supplierName = input.supplierName;

  const updated = await prisma.inventoryVariant.update({
    where: { id: input.variantId },
    data: updateData,
  });
  const after = updated.stockQuantity || 0;

  await createMovement({
    variantId: input.variantId,
    sku: variant.sku,
    type: "PURCHASE",
    quantity: qty,
    beforeQuantity: before,
    afterQuantity: after,
    lotId: lot.id,
    lotBreakdown: [{ lotId: lot.id, quantity: qty }],
    referenceType: "MANUAL",
    note: input.note || "",
    by,
    rackId: input.rackId,
    rackLabel: rackLabel || variant.rackLabel,
  });

  return { variant: updated, lot };
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

  const existing = await prisma.inventoryVariant.findFirst({ where: { sku } });
  if (existing) {
    throw new AppError(
      409,
      `SKU ${sku} already exists. Add this stock to the existing variant instead?`
    );
  }

  const brand = await ensureBrand(input.brandId || input.brand || "");
  const product = await findOrCreateProduct({
    brandId: brand?.id?.toString() || "",
    brandName: brand?.name || input.brand || "",
    category: input.category || "Specs",
    inventoryType: input.inventoryType,
    model: input.model,
    gender: input.gender,
  });

  const rackLabel = await getRackLabel(input.rackId);
  const v = await prisma.inventoryVariant.create({
    data: {
      productId: product.id.toString(),
      brandId: brand?.id?.toString() || undefined,
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
      attributes: (input.attributes as any) || {},
    } as any,
  });

  const lot = await prisma.inventoryLot.create({
    data: {
      variantId: v.id,
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
    } as any,
  });

  await createMovement({
    variantId: v.id,
    sku,
    type: "PURCHASE",
    quantity: qty,
    beforeQuantity: 0,
    afterQuantity: qty,
    lotId: lot.id,
    lotBreakdown: [{ lotId: lot.id, quantity: qty }],
    referenceType: "MANUAL",
    note: input.note || "",
    by,
    rackId: input.rackId,
    rackLabel: rackLabel || "",
  });

  return { variant: v, lot, product, brand };
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

  const withdrawal = await prisma.inventoryWithdrawalV2.create({
    data: {
      reason,
      note,
      by,
      totalQty: 0,
      totalPrice: 0,
    } as any,
  });

  const withdrawalItems: Array<{
    variantId: string;
    sku: string;
    brand: string;
    model: string;
    color: string;
    category: string;
    lotId?: string;
    lotBreakdown: Array<{ lotId: string; quantity: number }>;
    quantity: number;
    price: number;
  }> = [];
  const movements: Array<Record<string, unknown>> = [];
  let totalQty = 0;
  let totalPrice = 0;

  for (const item of Array.from(items.values())) {
    const variant = await prisma.inventoryVariant.findUnique({ where: { id: item.variantId } });
    if (!variant) throw new AppError(404, `Variant not found: ${item.variantId}`);

    const result = await deductStock(item.variantId, item.quantity, item.lotId);
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
      referenceId: withdrawal.id,
      note: `${reason}${note ? ` — ${note}` : ""}`,
      by,
      rackId: variant.rackId,
      rackLabel: variant.rackLabel,
    });
  }

  for (const m of movements) {
    await prisma.inventoryMovement.create({
      data: {
        variantId: m.variantId as string,
        sku: m.sku as string,
        type: m.type as string,
        quantity: m.quantity as number,
        beforeQuantity: m.beforeQuantity as number,
        afterQuantity: m.afterQuantity as number,
        lotId: m.lotId as string | undefined,
        referenceType: m.referenceType as string,
        referenceId: m.referenceId as string,
        note: m.note as string,
        by: m.by as string,
        rackId: m.rackId as string | undefined,
        rackLabel: m.rackLabel as string,
        lots: {
          create: ((m.lotBreakdown as Array<{ lotId: string; quantity: number }>) || []).map(
            (lb) => ({
              lotId: lb.lotId,
              quantity: lb.quantity,
            })
          ),
        },
      } as any,
    });
  }

  await prisma.inventoryWithdrawalV2.update({
    where: { id: withdrawal.id },
    data: {
      totalQty,
      totalPrice: round2(totalPrice),
      items: {
        create: withdrawalItems.map((item) => ({
          variantId: item.variantId,
          sku: item.sku,
          brand: item.brand,
          model: item.model,
          color: item.color,
          category: item.category,
          lotId: item.lotId,
          quantity: item.quantity,
          price: item.price,
          lots: {
            create: (item.lotBreakdown || []).map((lb) => ({
              lotId: lb.lotId,
              quantity: lb.quantity,
            })),
          },
        })),
      },
    } as any,
  });

  return { withdrawal, movements };
}

export async function reverseWithdrawal(id: string, by: string = "") {
  const withdrawal = await prisma.inventoryWithdrawalV2.findUnique({
    where: { id },
    include: { items: { include: { lots: true } } },
  });
  if (!withdrawal) throw new AppError(404, "Withdrawal not found");
  if (withdrawal.reversed) throw new AppError(400, "Withdrawal has already been reversed");

  const movements: Array<{
    data: {
      variantId: string;
      sku: string;
      type: string;
      quantity: number;
      beforeQuantity: number;
      afterQuantity: number;
      lotId?: string;
      lotBreakdown: Array<{ lotId: string; quantity: number }>;
      referenceType: string;
      referenceId: string;
      note: string;
      by: string;
      rackId?: string;
      rackLabel: string;
    };
  }> = [];
  for (const item of withdrawal.items || []) {
    if (!item.variantId)
      throw new AppError(400, `Withdrawal item is missing variant for ${item.sku}`);
    const variant = await prisma.inventoryVariant.findUnique({ where: { id: item.variantId } });
    if (!variant) throw new AppError(404, `Variant not found for ${item.sku}`);

    const before = variant.stockQuantity || 0;
    const lotBreakdown = (item.lots || []).map((lb) => ({
      lotId: lb.lotId || "",
      quantity: lb.quantity,
    }));
    await restoreStock(item.variantId, item.quantity, lotBreakdown);
    movements.push({
      data: {
        variantId: item.variantId,
        sku: item.sku,
        type: "RETURN",
        quantity: item.quantity,
        beforeQuantity: before,
        afterQuantity: before + item.quantity,
        lotId: (item.lots && item.lots[0]?.lotId) || undefined,
        lotBreakdown: (item.lots || []).map((lb) => ({
          lotId: lb.lotId || "",
          quantity: lb.quantity,
        })),
        referenceType: "WITHDRAWAL",
        referenceId: withdrawal.id,
        note: `Reversal of withdrawal${withdrawal.note ? ` — ${withdrawal.note}` : ""}`,
        by,
        rackId: variant.rackId ?? undefined,
        rackLabel: variant.rackLabel,
      },
    });
  }

  for (const m of movements) {
    await prisma.inventoryMovement.create({
      data: {
        variantId: m.data.variantId,
        sku: m.data.sku,
        type: m.data.type,
        quantity: m.data.quantity,
        beforeQuantity: m.data.beforeQuantity,
        afterQuantity: m.data.afterQuantity,
        lotId: m.data.lotId,
        referenceType: m.data.referenceType,
        referenceId: m.data.referenceId,
        note: m.data.note,
        by: m.data.by,
        rackId: m.data.rackId,
        rackLabel: m.data.rackLabel,
        lots: {
          create: m.data.lotBreakdown.map((lb) => ({
            lotId: lb.lotId,
            quantity: lb.quantity,
          })),
        },
      } as any,
    });
  }

  return await prisma.inventoryWithdrawalV2.update({
    where: { id },
    data: {
      reversed: true,
      reversedAt: new Date(),
    },
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

  return applyAdjustment(variantId, qty, note, by, "ADJUSTMENT");
}

async function applyAdjustment(
  variantId: string,
  qty: number,
  note: string,
  by: string,
  type: string
) {
  const variant = await prisma.inventoryVariant.findUnique({ where: { id: variantId } });
  if (!variant) throw new AppError(404, "Variant not found");
  const before = variant.stockQuantity || 0;

  let lotId: string | undefined;
  let breakdown: Array<{ lotId: string; quantity: number }>;

  if (qty > 0) {
    const lot = await prisma.inventoryLot.create({
      data: {
        variantId,
        lotNumber: await nextLotNumber(variantId),
        initialQuantity: qty,
        quantity: qty,
        purchasePrice: 0,
        sellingPrice: variant.defaultSellingPrice || 0,
        rackId: variant.rackId,
        rackLabel: variant.rackLabel,
        source: "ADJUSTMENT",
        note: note || "",
      } as any,
    });
    lotId = lot.id;
    breakdown = [{ lotId, quantity: qty }];
    await prisma.inventoryVariant.update({
      where: { id: variantId },
      data: { stockQuantity: { increment: qty } },
    });
  } else {
    const result = await deductStock(variantId, -qty);
    lotId = result.breakdown[0]?.lotId;
    breakdown = result.breakdown;
  }

  const updated = await prisma.inventoryVariant.findUnique({ where: { id: variantId } });
  const after = updated ? updated.stockQuantity || 0 : before + qty;

  const movement = await prisma.inventoryMovement.create({
    data: {
      variantId,
      sku: variant.sku,
      type,
      quantity: qty,
      beforeQuantity: before,
      afterQuantity: after,
      lotId,
      referenceType: "MANUAL",
      note: note || "",
      by,
      rackId: variant.rackId,
      rackLabel: variant.rackLabel,
      lots: {
        create: breakdown.map((lb) => ({
          lotId: lb.lotId,
          quantity: lb.quantity,
        })),
      },
    } as any,
  });

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

  const movements: any[] = [];
  for (const e of normalized) {
    const delta = Math.floor(Number(e.countedQuantity)) - Math.floor(Number(e.expectedQuantity));
    const result = await applyAdjustment(e.variantId, delta, note, by, "COUNT_CORRECTION");
    movements.push(result.movement);
  }
  return { movements, count: normalized.length };
}

export async function listWithdrawals(
  options: { page?: string; limit?: string; reason?: string; by?: string; search?: string } = {}
) {
  const where: Record<string, unknown> = {};
  if (options.reason) where.reason = options.reason;
  if (options.by) where.by = { contains: options.by, mode: "insensitive" };
  if (options.search) {
    const s = options.search;
    where.OR = [
      { items: { some: { sku: { contains: s, mode: "insensitive" } } } },
      { items: { some: { brand: { contains: s, mode: "insensitive" } } } },
      { items: { some: { model: { contains: s, mode: "insensitive" } } } },
    ];
  }

  return paginateFind(
    (args) => prisma.inventoryWithdrawalV2.findMany({ ...args, include: { items: true } }),
    (w) => prisma.inventoryWithdrawalV2.count({ where: w }),
    { page: options.page, limit: options.limit },
    { where, orderBy: { createdAt: "desc" } }
  );
}

export async function getWithdrawalById(id: string) {
  const doc = await prisma.inventoryWithdrawalV2.findUnique({
    where: { id },
    include: { items: { include: { lots: true } } },
  });
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
  const where: Record<string, unknown> = {};
  if (options.variantId) where.variantId = options.variantId;
  if (options.sku) where.sku = { contains: options.sku, mode: "insensitive" };
  if (options.type) where.type = options.type;
  if (options.user) where.by = { contains: options.user, mode: "insensitive" };
  if (options.rack) where.rackLabel = { contains: options.rack, mode: "insensitive" };
  if (options.search) {
    const s = options.search.trim();
    where.OR = [
      { sku: { contains: s, mode: "insensitive" } },
      { note: { contains: s, mode: "insensitive" } },
      { by: { contains: s, mode: "insensitive" } },
      { referenceType: { contains: s, mode: "insensitive" } },
    ];
  }
  if (options.startDate || options.endDate) {
    const createdAt: Record<string, Date> = {};
    if (options.startDate) createdAt.gte = new Date(options.startDate);
    if (options.endDate) createdAt.lte = new Date(options.endDate);
    where.createdAt = createdAt;
  }

  return paginateFind(
    (args) => prisma.inventoryMovement.findMany({ ...args, include: { lots: true } }),
    (w) => prisma.inventoryMovement.count({ where: w }),
    { page: options.page, limit: options.limit },
    { where, orderBy: { createdAt: "desc" } }
  );
}
