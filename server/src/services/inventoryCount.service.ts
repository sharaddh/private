import mongoose from "mongoose";
import { AppError } from "../middleware/errorHandler";
import { Rack } from "../models/rack";
import { InventoryVariant } from "../models/inventoryVariant";
import { InventoryCountSession } from "../models/inventoryCount";
import { InventoryCountEntry } from "../models/inventoryCountEntry";
import { paginateQuery, PaginationOptions } from "../utils/pagination";
import { applyStockCorrections } from "./inventoryStock.service";

export async function createCountSession(rackId: string, by: string = "", note: string = "") {
  const rack = await Rack.findById(rackId).lean();
  if (!rack) throw new AppError(404, "Rack not found");

  const variants = await InventoryVariant.find({ rackId, active: true }).lean();
  const expectedUnits = variants.reduce((s, v) => s + (v.stockQuantity || 0), 0);

  const session = await InventoryCountSession.create({
    rackId,
    rackLabel: rack.code,
    status: "draft",
    startedBy: by,
    startedAt: new Date(),
    expectedUnits,
    countedUnits: 0,
    note: note || "",
  });

  const entries = variants.map((v) => ({
    countSessionId: session._id,
    variantId: v._id,
    sku: v.sku,
    brandName: v.brandName || "",
    model: v.model || "",
    color: v.color || "",
    size: v.size || "",
    expectedQuantity: v.stockQuantity || 0,
    countedQuantity: v.stockQuantity || 0,
    difference: 0,
  }));
  if (entries.length > 0) {
    await InventoryCountEntry.insertMany(entries);
  }

  return { session, entries };
}

export async function listCountSessions(options: PaginationOptions = {}) {
  const baseQuery = InventoryCountSession.find().sort({ createdAt: -1 }) as mongoose.Query<
    any[],
    any
  >;
  return paginateQuery(baseQuery, { page: options.page, limit: options.limit });
}

export async function getCountSession(id: string) {
  const session = await InventoryCountSession.findById(id).lean();
  if (!session) throw new AppError(404, "Count session not found");
  const entries = await InventoryCountEntry.find({ countSessionId: id }).sort({ sku: 1 }).lean();
  return { session, entries };
}

export async function updateCountEntries(
  id: string,
  inputs: Array<{ variantId: string; countedQuantity: number }>
) {
  const session = await InventoryCountSession.findById(id);
  if (!session) throw new AppError(404, "Count session not found");
  if (session.status !== "draft")
    throw new AppError(400, "Only draft count sessions can be updated");

  for (const input of inputs || []) {
    const qty = Math.floor(Number(input.countedQuantity));
    if (!Number.isFinite(qty) || qty < 0) {
      throw new AppError(
        400,
        `Counted quantity for ${input.variantId} must be a non-negative number`
      );
    }
    const entry = await InventoryCountEntry.findOne({
      countSessionId: id,
      variantId: input.variantId,
    });
    if (!entry) throw new AppError(404, `Count entry not found for variant ${input.variantId}`);
    entry.countedQuantity = qty;
    entry.difference = qty - entry.expectedQuantity;
    await entry.save();
  }

  const allEntries = await InventoryCountEntry.find({ countSessionId: id }).lean();
  if (allEntries.length > 0) {
    const sum = allEntries.reduce((s, e) => s + (e.countedQuantity || 0), 0);
    session.countedUnits = sum;
    session.expectedUnits = allEntries.reduce((s, e) => s + (e.expectedQuantity || 0), 0);
    await session.save();
  }

  return getCountSession(id);
}

export async function completeCountSession(id: string, by: string = "", note: string = "") {
  const session = await InventoryCountSession.findById(id);
  if (!session) throw new AppError(404, "Count session not found");
  if (session.status !== "draft")
    throw new AppError(400, "Count session is already completed or cancelled");

  const entries = await InventoryCountEntry.find({ countSessionId: id }).lean();

  const corrections = entries.map((e) => ({
    variantId: e.variantId!.toString(),
    expectedQuantity: e.expectedQuantity,
    countedQuantity: e.countedQuantity,
  }));

  const result = await applyStockCorrections(
    corrections,
    note || `Rack count for ${session.rackId}`,
    by
  );

  session.status = "completed";
  session.completedBy = by;
  session.completedAt = new Date();
  session.note = note || session.note || "";
  session.countedUnits = entries.reduce((s, e) => s + (e.countedQuantity || 0), 0);
  session.expectedUnits = entries.reduce((s, e) => s + (e.expectedQuantity || 0), 0);
  await session.save();

  return { session, corrections: result.count };
}

export async function cancelCountSession(id: string, by: string = "") {
  const session = await InventoryCountSession.findById(id);
  if (!session) throw new AppError(404, "Count session not found");
  if (session.status !== "draft")
    throw new AppError(400, "Count session is already completed or cancelled");
  session.status = "cancelled";
  session.completedBy = by;
  session.completedAt = new Date();
  await session.save();
  return session;
}
