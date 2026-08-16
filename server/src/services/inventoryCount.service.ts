import { AppError } from "../middleware/errorHandler";
import { Rack } from "../models/rack";
import { InventoryVariant } from "../models/inventoryVariant";
import { InventoryCountSession } from "../models/inventoryCount";
import { InventoryCountEntry } from "../models/inventoryCountEntry";
import { paginateFind, PaginationOptions } from "../utils/pagination";
import { requireBranchId } from "../utils/scope";
import { applyStockCorrections } from "./inventoryStock.service";

export async function createCountSession(rackId: string, by: string = "", note: string = "") {
  const rack = await Rack.findUnique({ where: { id: rackId } });
  if (!rack) throw new AppError(404, "Rack not found");

  const variants = await InventoryVariant.findMany({ where: { rackId, active: true } });
  const expectedUnits = variants.reduce((s: number, v: any) => s + (v.stockQuantity || 0), 0);

  const session = await InventoryCountSession.create({
    data: {
      rackId,
      rackLabel: rack.code,
      status: "draft",
      startedBy: by,
      startedAt: new Date(),
      expectedUnits,
      countedUnits: 0,
      note: note || "",
      branchId: requireBranchId(),
    },
  });

  const entries = variants.map((v: any) => ({
    countSessionId: session.id,
    branchId: requireBranchId(),
    variantId: v.id,
    sku: v.sku || "",
    brandName: v.brandName || "",
    model: v.model || "",
    color: v.color || "",
    size: v.size || "",
    expectedQuantity: v.stockQuantity || 0,
    countedQuantity: v.stockQuantity || 0,
    difference: 0,
  }));
  if (entries.length > 0) {
    await InventoryCountEntry.createMany({ data: entries });
  }

  return { session, entries };
}

export async function listCountSessions(options: PaginationOptions = {}) {
  return paginateFind(
    (args) => InventoryCountSession.findMany(args),
    (where) => InventoryCountSession.count({ where }),
    { page: options.page, limit: options.limit },
    { orderBy: { createdAt: "desc" } }
  );
}

export async function getCountSession(id: string) {
  const session = await InventoryCountSession.findUnique({ where: { id } });
  if (!session) throw new AppError(404, "Count session not found");
  const entries = await InventoryCountEntry.findMany({
    where: { countSessionId: id },
    orderBy: { sku: "asc" },
  });
  return { session, entries };
}

export async function updateCountEntries(
  id: string,
  inputs: Array<{ variantId: string; countedQuantity: number }>
) {
  const session = await InventoryCountSession.findUnique({ where: { id } });
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
    const entry = await InventoryCountEntry.findFirst({
      where: { countSessionId: id, variantId: input.variantId },
    });
    if (!entry) throw new AppError(404, `Count entry not found for variant ${input.variantId}`);
    await InventoryCountEntry.update({
      where: { id: entry.id },
      data: { countedQuantity: qty, difference: qty - entry.expectedQuantity },
    });
  }

  const allEntries = await InventoryCountEntry.findMany({ where: { countSessionId: id } });
  if (allEntries.length > 0) {
    const sum = allEntries.reduce((s: number, e: any) => s + (e.countedQuantity || 0), 0);
    const expectedSum = allEntries.reduce((s: number, e: any) => s + (e.expectedQuantity || 0), 0);
    await InventoryCountSession.update({
      where: { id },
      data: { countedUnits: sum, expectedUnits: expectedSum },
    });
  }

  return getCountSession(id);
}

export async function completeCountSession(id: string, by: string = "", note: string = "") {
  const session = await InventoryCountSession.findUnique({ where: { id } });
  if (!session) throw new AppError(404, "Count session not found");
  if (session.status !== "draft")
    throw new AppError(400, "Count session is already completed or cancelled");

  const entries = await InventoryCountEntry.findMany({ where: { countSessionId: id } });

  const corrections = entries.map((e: any) => ({
    variantId: e.variantId,
    expectedQuantity: e.expectedQuantity,
    countedQuantity: e.countedQuantity,
  }));

  const result = await applyStockCorrections(
    corrections,
    note || `Rack count for ${session.rackId}`,
    by
  );

  const updated = await InventoryCountSession.update({
    where: { id },
    data: {
      status: "completed",
      completedBy: by,
      completedAt: new Date(),
      note: note || session.note || "",
      countedUnits: entries.reduce((s: number, e: any) => s + (e.countedQuantity || 0), 0),
      expectedUnits: entries.reduce((s: number, e: any) => s + (e.expectedQuantity || 0), 0),
    },
  });

  return { session: updated, corrections: result.count };
}

export async function cancelCountSession(id: string, by: string = "") {
  const session = await InventoryCountSession.findUnique({ where: { id } });
  if (!session) throw new AppError(404, "Count session not found");
  if (session.status !== "draft")
    throw new AppError(400, "Count session is already completed or cancelled");

  const updated = await InventoryCountSession.update({
    where: { id },
    data: {
      status: "cancelled",
      completedBy: by,
      completedAt: new Date(),
    },
  });

  return updated;
}
