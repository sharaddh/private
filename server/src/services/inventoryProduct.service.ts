import mongoose from "mongoose";
import { AppError } from "../middleware/errorHandler";
import { withTransaction } from "../utils/transaction";
import { Brand } from "../models/brand";
import { Rack } from "../models/rack";
import { InventoryProduct } from "../models/inventoryProduct";
import { InventoryVariant } from "../models/inventoryVariant";
import { InventoryLot } from "../models/inventoryLot";
import { InventoryMovement } from "../models/inventoryMovement";
import { escapeRegex, normalizeSku } from "../utils/string";
import { paginateQuery, PaginationOptions } from "../utils/pagination";
import { VALID_PRODUCT_CATEGORIES, VALID_GENDERS } from "../types";

function cleanBrandName(name: string): string {
  return String(name || "").trim();
}

export async function ensureBrand(nameOrId: string, session?: mongoose.ClientSession | null): Promise<{ _id: mongoose.Types.ObjectId; name: string } | null> {
  const raw = cleanBrandName(nameOrId);
  if (!raw) return null;

  if (mongoose.Types.ObjectId.isValid(raw)) {
    const existing = await Brand.findById(raw, null, session ? { session } : {}).lean();
    if (existing) return { _id: existing._id, name: existing.name };
  }

  const existing = await Brand.findOne(
    { name: { $regex: new RegExp(`^${escapeRegex(raw)}$`, "i") } },
    null,
    session ? { session } : {}
  ).lean();
  if (existing) return { _id: existing._id, name: existing.name };

  const created = await Brand.create([{ name: raw }], session ? { session } : {});
  return { _id: created[0]._id, name: created[0].name };
}

export async function findOrCreateProduct(
  input: { brandId: string; brandName: string; category?: string; inventoryType?: string; model: string; gender?: string; description?: string },
  session?: mongoose.ClientSession | null
) {
  const model = String(input.model || "").trim();
  if (!model) throw new AppError(400, "Model is required");
  const brandId = input.brandId || undefined;
  const category = input.category && VALID_PRODUCT_CATEGORIES.includes(input.category as any) ? input.category : "Specs";

  const existing = await InventoryProduct.findOne(
    { brandId, model: { $regex: new RegExp(`^${escapeRegex(model)}$`, "i") } },
    null,
    session ? { session } : {}
  ).lean();
  if (existing) return existing;

  const gender = input.gender && (VALID_GENDERS as readonly string[]).includes(input.gender) ? input.gender : "";
  const created = await InventoryProduct.create(
    [{
      brandId,
      brandName: input.brandName,
      category,
      inventoryType: input.inventoryType || "",
      model,
      displayName: `${input.brandName ? `${input.brandName} ` : ""}${model}`,
      gender,
      description: input.description || "",
    }],
    session ? { session } : {}
  );
  return created[0];
}

// ---------------------------------------------------------------------------
// Brands
// ---------------------------------------------------------------------------

export async function listBrands(threshold: number = 5) {
  const brands = await Brand.find({ active: true }).sort({ name: 1 }).lean();

  const summary = await InventoryVariant.aggregate([
    { $match: { active: true, brandId: { $exists: true, $ne: null } } },
    {
      $group: {
        _id: "$brandId",
        variants: { $sum: 1 },
        units: { $sum: "$stockQuantity" },
        lowStock: {
          $sum: {
            $cond: [{ $and: [{ $lte: ["$stockQuantity", threshold] }, { $gt: ["$stockQuantity", 0] }] }, 1, 0],
          },
        },
      },
    },
  ]);

  const summaryMap = new Map(summary.map((s) => [s._id.toString(), s]));
  return brands.map((b) => {
    const s = summaryMap.get(b._id.toString());
    return {
      _id: b._id,
      name: b.name,
      variants: s?.variants || 0,
      units: s?.units || 0,
      lowStock: s?.lowStock || 0,
    };
  });
}

export async function getBrandSummary(brandId: string) {
  const brand = await Brand.findById(brandId).lean();
  if (!brand) throw new AppError(404, "Brand not found");

  const [productSummary, variantCount, units] = await Promise.all([
    InventoryProduct.aggregate([
      { $match: { brandId: brand._id, active: true } },
      { $group: { _id: "$category", products: { $sum: 1 } } },
    ]),
    InventoryVariant.countDocuments({ brandId: brand._id, active: true }),
    InventoryVariant.aggregate([
      { $match: { brandId: brand._id, active: true } },
      { $group: { _id: null, units: { $sum: "$stockQuantity" } } },
    ]),
  ]);

  const categories: Record<string, number> = {};
  for (const c of productSummary) if (c._id) categories[c._id] = c.products;

  return {
    brand,
    categoryCounts: categories,
    variants: variantCount,
    units: units[0]?.units || 0,
  };
}

export async function createBrand(input: { name: string; description?: string; logo?: string }) {
  const name = cleanBrandName(input.name);
  if (!name) throw new AppError(400, "Brand name is required");
  const existing = await Brand.findOne({ name: { $regex: new RegExp(`^${escapeRegex(name)}$`, "i") } }).lean();
  if (existing) throw new AppError(409, `Brand "${name}" already exists`);
  return Brand.create({ name, description: input.description || "", logo: input.logo || "" });
}

export async function updateBrand(id: string, input: { name?: string; description?: string; logo?: string; active?: boolean }) {
  const brand = await Brand.findById(id);
  if (!brand) throw new AppError(404, "Brand not found");
  if (input.name !== undefined && input.name.trim()) {
    const name = cleanBrandName(input.name);
    const dup = await Brand.findOne({ name: { $regex: new RegExp(`^${escapeRegex(name)}$`, "i") }, _id: { $ne: id } }).lean();
    if (dup) throw new AppError(409, `Brand "${name}" already exists`);
    brand.name = name;
    await InventoryVariant.updateMany({ brandId: id }, { $set: { brandName: name } });
    await InventoryProduct.updateMany({ brandId: id }, { $set: { brandName: name } });
  }
  if (input.description !== undefined) brand.description = input.description;
  if (input.logo !== undefined) brand.logo = input.logo;
  if (input.active !== undefined) brand.active = input.active;
  await brand.save();
  return brand;
}

// ---------------------------------------------------------------------------
// Products
// ---------------------------------------------------------------------------

export interface ProductFilters extends PaginationOptions {
  brandId?: string;
  category?: string;
  gender?: string;
  search?: string;
}

export async function listProducts(options: ProductFilters = {}) {
  const filter: Record<string, unknown> = { active: true };
  if (options.brandId) filter.brandId = options.brandId;
  if (options.category) filter.category = options.category;
  if (options.gender) filter.gender = options.gender;
  if (options.search) {
    const s = escapeRegex(options.search.trim());
    filter.$or = [
      { model: { $regex: s, $options: "i" } },
      { brandName: { $regex: s, $options: "i" } },
      { displayName: { $regex: s, $options: "i" } },
    ];
  }

  const baseQuery = InventoryProduct.find(filter).sort({ brandName: 1, model: 1 }) as mongoose.Query<any[], any>;
  return paginateQuery(baseQuery, { page: options.page, limit: options.limit });
}

export async function getProductById(id: string) {
  const product = await InventoryProduct.findById(id).lean();
  if (!product) throw new AppError(404, "Product not found");

  const variants = await InventoryVariant.find({ productId: id, active: true }).sort({ color: 1 }).lean();
  return { ...product, variants };
}

export async function createProduct(input: { brandId?: string; brandName?: string; category?: string; model: string; gender?: string; description?: string }) {
  const brand = await ensureBrand(input.brandId || input.brandName || "", null);
  const product = await findOrCreateProduct({
    brandId: brand?._id?.toString() || "",
    brandName: brand?.name || input.brandName || "",
    category: input.category,
    model: input.model,
    gender: input.gender,
    description: input.description,
  });
  return product;
}

export async function updateProduct(id: string, input: Record<string, unknown>) {
  const product = await InventoryProduct.findById(id);
  if (!product) throw new AppError(404, "Product not found");
  const allowed = ["category", "inventoryType", "model", "gender", "description", "image", "active", "sizeOptions"];
  const target = product as unknown as Record<string, unknown>;
  for (const key of allowed) {
    if (key in input) target[key] = input[key];
  }
  if (input.model !== undefined) {
    await InventoryVariant.updateMany({ productId: id }, { $set: { model: String(input.model) } });
  }
  if (input.category !== undefined) {
    await InventoryVariant.updateMany({ productId: id }, { $set: { category: String(input.category) } });
  }
  await product.save();
  return product;
}

export async function archiveProduct(id: string) {
  const product = await InventoryProduct.findById(id);
  if (!product) throw new AppError(404, "Product not found");
  const hasMovements = await InventoryVariant.exists({ productId: id });
  if (hasMovements) {
    product.active = false;
    await product.save();
    await InventoryVariant.updateMany({ productId: id }, { $set: { active: false } });
    return product;
  }
  await InventoryProduct.findByIdAndDelete(id);
  await InventoryVariant.deleteMany({ productId: id });
  return { deleted: true };
}

// ---------------------------------------------------------------------------
// Variants
// ---------------------------------------------------------------------------

export interface VariantFilters extends PaginationOptions {
  productId?: string;
  brandId?: string;
  category?: string;
  color?: string;
  rackId?: string;
  gender?: string;
  stock?: "all" | "in" | "low" | "out";
  threshold?: string;
  search?: string;
}

export async function listVariants(options: VariantFilters = {}) {
  const filter: Record<string, unknown> = { active: true };
  if (options.productId) filter.productId = options.productId;
  if (options.brandId) filter.brandId = options.brandId;
  if (options.category) filter.category = options.category;
  if (options.color) filter.color = { $regex: escapeRegex(options.color), $options: "i" };
  if (options.rackId) filter.rackId = options.rackId;
  if (options.gender) filter.gender = options.gender;

  if (options.stock && options.stock !== "all") {
    const t = Math.max(parseInt(options.threshold || "5", 10) || 5, 0);
    if (options.stock === "in") filter.stockQuantity = { $gt: 0 };
    if (options.stock === "out") filter.stockQuantity = 0;
    if (options.stock === "low") filter.stockQuantity = { $gt: 0, $lte: t };
  }

  if (options.search) {
    const s = escapeRegex(options.search.trim());
    filter.$or = [
      { sku: { $regex: s, $options: "i" } },
      { model: { $regex: s, $options: "i" } },
      { brandName: { $regex: s, $options: "i" } },
      { color: { $regex: s, $options: "i" } },
      { rackLabel: { $regex: s, $options: "i" } },
      { category: { $regex: s, $options: "i" } },
    ];
  }

  const baseQuery = InventoryVariant.find(filter).sort({ brandName: 1, model: 1, color: 1 }) as mongoose.Query<any[], any>;
  return paginateQuery(baseQuery, { page: options.page, limit: options.limit });
}

export async function searchVariants(query: string, limit: number = 20) {
  const s = escapeRegex((query || "").trim());
  if (!s) return [];
  return InventoryVariant.find({
    active: true,
    $or: [
      { sku: { $regex: s, $options: "i" } },
      { model: { $regex: s, $options: "i" } },
      { brandName: { $regex: s, $options: "i" } },
      { color: { $regex: s, $options: "i" } },
      { rackLabel: { $regex: s, $options: "i" } },
    ],
  })
    .sort({ brandName: 1, model: 1, color: 1 })
    .limit(Math.min(Math.max(limit, 1), 100))
    .lean();
}

export async function getVariantById(id: string) {
  const variant = await InventoryVariant.findById(id).lean();
  if (!variant) throw new AppError(404, "Variant not found");

  const [product, lots, rack, recentMovements] = await Promise.all([
    variant.productId ? InventoryProduct.findById(variant.productId).lean() : null,
    InventoryLot.find({ variantId: id }).sort({ createdAt: 1 }).lean(),
    variant.rackId ? Rack.findById(variant.rackId).select("code name").lean() : null,
    InventoryMovement.find({ variantId: id }).sort({ createdAt: -1 }).limit(20).lean(),
  ]);

  return { variant, product, rack, lots, recentMovements };
}

export async function getVariantBySku(sku: string) {
  const variant = await InventoryVariant.findOne({ sku: normalizeSku(sku) }).lean();
  if (!variant) throw new AppError(404, "Variant not found");
  return variant;
}

export async function createVariant(input: Record<string, unknown>) {
  const sku = normalizeSku(String(input.sku || ""));
  if (!sku) throw new AppError(400, "SKU is required");
  const existing = await InventoryVariant.findOne({ sku }).lean();
  if (existing) throw new AppError(409, `SKU ${sku} already exists`);

  const brand = await ensureBrand(String(input.brandId || input.brandName || ""), null);
  const product = await findOrCreateProduct({
    brandId: brand?._id?.toString() || "",
    brandName: brand?.name || String(input.brandName || ""),
    category: String(input.category || "Specs"),
    model: String(input.model || ""),
    gender: String(input.gender || ""),
  });

  const rackLabel = input.rackId ? (await Rack.findById(input.rackId).select("code").lean())?.code || "" : "";
  const variant = await InventoryVariant.create({
    productId: product._id,
    brandId: brand?._id || undefined,
    brandName: brand?.name || String(input.brandName || ""),
    category: product.category,
    model: product.model,
    gender: input.gender || product.gender || "",
    sku,
    variantCode: String(input.color || ""),
    color: String(input.color || ""),
    size: String(input.size || ""),
    material: String(input.material || ""),
    frameShape: String(input.frameShape || ""),
    defaultSellingPrice: Math.max(Number(input.defaultSellingPrice) || 0, 0),
    rackId: input.rackId,
    rackLabel,
    supplierId: input.supplierId,
    supplierName: String(input.supplierName || ""),
    attributes: (input.attributes as Record<string, unknown>) || {},
  });
  return variant;
}

export async function updateVariant(id: string, input: Record<string, unknown>) {
  return withTransaction(async (session) => {
    const variant = await InventoryVariant.findById(id, null, session ? { session } : {});
    if (!variant) throw new AppError(404, "Variant not found");

    const allowed = [
      "color", "size", "gender", "material", "frameShape", "frameType", "templeSize",
      "bridgeSize", "lensWidth", "status", "attributes", "image", "defaultSellingPrice",
      "supplierId", "supplierName", "active",
    ];
    const target = variant as unknown as Record<string, unknown>;
    for (const key of allowed) {
      if (key in input) {
        if (key === "defaultSellingPrice") {
          target[key] = Math.max(Number(input[key]) || 0, 0);
        } else {
          target[key] = input[key];
        }
      }
    }

    if (input.rackId !== undefined) {
      const newRackId = input.rackId as string;
      if (newRackId && variant.rackId?.toString() !== newRackId) {
        const oldRackId = variant.rackId?.toString();
        const oldRackLabel = variant.rackLabel;
        const newRack = await Rack.findById(newRackId).select("code").lean();
        const newRackLabel = newRack?.code || "";
        variant.rackId = newRackId as any;
        variant.rackLabel = newRackLabel;
        await InventoryMovement.create(
          [{
            variantId: id,
            sku: variant.sku,
            type: "LOCATION_CHANGE",
            quantity: 0,
            beforeQuantity: variant.stockQuantity || 0,
            afterQuantity: variant.stockQuantity || 0,
            oldRackId,
            newRackId,
            rackId: newRackId,
            rackLabel: newRackLabel,
            referenceType: "MANUAL",
            note: `Moved from ${oldRackLabel || "unknown"} to ${newRackLabel}`,
          }],
          session ? { session } : {}
        );
      } else if (!newRackId) {
        variant.rackId = undefined as any;
        variant.rackLabel = "";
      }
    }

    await variant.save(session ? { session } : {});
    return variant;
  });
}

export async function archiveVariant(id: string) {
  const variant = await InventoryVariant.findById(id);
  if (!variant) throw new AppError(404, "Variant not found");
  const hasMovements = await InventoryMovement.exists({ variantId: id });
  if (hasMovements) {
    variant.active = false;
    await variant.save();
    return variant;
  }
  await InventoryVariant.findByIdAndDelete(id);
  await InventoryLot.deleteMany({ variantId: id });
  return { deleted: true };
}

// ---------------------------------------------------------------------------
// Racks
// ---------------------------------------------------------------------------

export async function listRacks() {
  const racks = await Rack.find({ active: true }).sort({ section: 1, sortOrder: 1, code: 1 }).lean();
  const summary = await InventoryVariant.aggregate([
    { $match: { active: true, rackId: { $exists: true, $ne: null } } },
    { $group: { _id: "$rackId", variants: { $sum: 1 }, units: { $sum: "$stockQuantity" } } },
  ]);
  const summaryMap = new Map(summary.map((s) => [s._id.toString(), s]));
  return racks.map((r) => ({
    _id: r._id,
    name: r.name,
    code: r.code,
    section: r.section,
    sortOrder: r.sortOrder,
    variants: summaryMap.get(r._id.toString())?.variants || 0,
    units: summaryMap.get(r._id.toString())?.units || 0,
  }));
}

export async function createRack(input: { name?: string; code: string; section?: string; description?: string; sortOrder?: number }) {
  const code = String(input.code || "").trim().toUpperCase();
  if (!code) throw new AppError(400, "Rack code is required");
  const existing = await Rack.findOne({ code: { $regex: new RegExp(`^${escapeRegex(code)}$`, "i") } }).lean();
  if (existing) throw new AppError(409, `Rack ${code} already exists`);
  return Rack.create({
    name: input.name || code,
    code,
    section: input.section || "",
    description: input.description || "",
    sortOrder: Number(input.sortOrder) || 0,
  });
}

export async function updateRack(id: string, input: { name?: string; code?: string; section?: string; description?: string; sortOrder?: number; active?: boolean }) {
  const rack = await Rack.findById(id);
  if (!rack) throw new AppError(404, "Rack not found");
  if (input.name !== undefined) rack.name = input.name;
  if (input.code !== undefined) {
    const code = String(input.code).trim().toUpperCase();
    if (!code) throw new AppError(400, "Rack code is required");
    const dup = await Rack.findOne({ code: { $regex: new RegExp(`^${escapeRegex(code)}$`, "i") }, _id: { $ne: id } }).lean();
    if (dup) throw new AppError(409, `Rack ${code} already exists`);
    rack.code = code;
    await InventoryVariant.updateMany({ rackId: id }, { $set: { rackLabel: code } });
  }
  if (input.section !== undefined) rack.section = input.section;
  if (input.description !== undefined) rack.description = input.description;
  if (input.sortOrder !== undefined) rack.sortOrder = Number(input.sortOrder) || 0;
  if (input.active !== undefined) rack.active = input.active;
  await rack.save();
  return rack;
}

export async function getRackItems(rackId: string) {
  const rack = await Rack.findById(rackId).lean();
  if (!rack) throw new AppError(404, "Rack not found");
  const items = await InventoryVariant.find({ rackId, active: true }).sort({ brandName: 1, model: 1, color: 1 }).lean();
  return { rack, items };
}

// ---------------------------------------------------------------------------
// Dashboard
// ---------------------------------------------------------------------------

export async function getDashboard(threshold: number = 5) {
  const t = Math.max(threshold, 0);
  const [products, variants, stockUnits, lowStock, outOfStock, brands, costValueResult, retailValueResult, recentMovements] = await Promise.all([
    InventoryProduct.countDocuments({ active: true }),
    InventoryVariant.countDocuments({ active: true }),
    InventoryVariant.aggregate([{ $match: { active: true } }, { $group: { _id: null, total: { $sum: "$stockQuantity" } } }]),
    InventoryVariant.countDocuments({ active: true, stockQuantity: { $gt: 0, $lte: t } }),
    InventoryVariant.countDocuments({ active: true, stockQuantity: 0 }),
    Brand.countDocuments({ active: true }),
    InventoryLot.aggregate([{ $group: { _id: null, total: { $sum: { $multiply: ["$quantity", "$purchasePrice"] } } } }]),
    InventoryVariant.aggregate([{ $match: { active: true } }, { $group: { _id: null, total: { $sum: { $multiply: ["$stockQuantity", "$defaultSellingPrice"] } } } }]),
    InventoryMovement.find().sort({ createdAt: -1 }).limit(15).lean(),
  ]);

  return {
    products,
    variants,
    stockUnits: stockUnits[0]?.total || 0,
    lowStock: lowStock,
    outOfStock,
    brands,
    inventoryCost: costValueResult[0]?.total || 0,
    inventoryValue: retailValueResult[0]?.total || 0,
    lowStockThreshold: t,
    recentActivity: recentMovements,
  };
}
