import { prisma } from "../db/prisma";
import { AppError } from "../middleware/errorHandler";
import { requireCtx } from "../utils/requestContext"; // used inside getBranchId
import { normalizeSku } from "../utils/string";
import { paginateFind, PaginationOptions } from "../utils/pagination";
import { VALID_PRODUCT_CATEGORIES, VALID_GENDERS } from "../types";

function cleanBrandName(name: string): string {
  return String(name || "").trim();
}

function isValidUUID(str: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(str);
}

function getBranchId(): string {
  const branchId = getBranchId();
  if (!branchId) throw new AppError(400, "Branch context is required");
  return branchId;
}

export async function ensureBrand(
  nameOrId: string
): Promise<{ id: string; name: string } | null> {
  const raw = cleanBrandName(nameOrId);
  if (!raw) return null;

  if (isValidUUID(raw)) {
    const existing = await prisma.brand.findUnique({ where: { id: raw } });
    if (existing) return { id: existing.id, name: existing.name };
  }

  const existing = await prisma.brand.findFirst({
    where: { name: { equals: raw, mode: "insensitive" } },
  });
  if (existing) return { id: existing.id, name: existing.name };

  const branchId = getBranchId();
  const created = await prisma.brand.create({ data: { name: raw, branchId } });
  return { id: created.id, name: created.name };
}

export async function findOrCreateProduct(
  input: {
    brandId: string;
    brandName: string;
    category?: string;
    inventoryType?: string;
    model: string;
    gender?: string;
    description?: string;
  }
) {
  const model = String(input.model || "").trim();
  if (!model) throw new AppError(400, "Model is required");
  const category =
    input.category && VALID_PRODUCT_CATEGORIES.includes(input.category as any)
      ? input.category
      : "Specs";

  const where: any = {
    model: { equals: model, mode: "insensitive" as const },
  };
  if (input.brandId) where.brandId = input.brandId;

  const existing = await prisma.inventoryProduct.findFirst({ where });
  if (existing) return existing;

  const gender =
    input.gender && (VALID_GENDERS as readonly string[]).includes(input.gender) ? input.gender : "";
  const branchId = getBranchId();
  const created = await prisma.inventoryProduct.create({
    data: {
      brandId: input.brandId || null,
      brandName: input.brandName,
      category,
      inventoryType: input.inventoryType || "",
      model,
      displayName: `${input.brandName ? `${input.brandName} ` : ""}${model}`,
      gender,
      description: input.description || "",
      branchId,
    },
  });
  return created;
}

// ---------------------------------------------------------------------------
// Brands
// ---------------------------------------------------------------------------

export async function listBrands(threshold: number = 5) {
  const brands = await prisma.brand.findMany({
    where: { active: true },
    orderBy: { name: "asc" },
  });

  const variants = await prisma.inventoryVariant.findMany({
    where: { active: true, brandId: { not: null } },
    select: { brandId: true, stockQuantity: true },
  });

  const summaryMap = new Map<string, { variants: number; units: number; lowStock: number }>();
  for (const v of variants) {
    if (!v.brandId) continue;
    const s = summaryMap.get(v.brandId) || { variants: 0, units: 0, lowStock: 0 };
    s.variants += 1;
    s.units += v.stockQuantity || 0;
    if ((v.stockQuantity || 0) > 0 && (v.stockQuantity || 0) <= threshold) s.lowStock += 1;
    summaryMap.set(v.brandId, s);
  }

  return brands.map((b) => {
    const s = summaryMap.get(b.id);
    return {
      id: b.id,
      name: b.name,
      variants: s?.variants || 0,
      units: s?.units || 0,
      lowStock: s?.lowStock || 0,
    };
  });
}

export async function getBrandSummary(brandId: string) {
  const brand = await prisma.brand.findUnique({ where: { id: brandId } });
  if (!brand) throw new AppError(404, "Brand not found");

  const [products, variantCount, unitsResult] = await Promise.all([
    prisma.inventoryProduct.findMany({
      where: { brandId: brand.id, active: true },
      select: { category: true },
    }),
    prisma.inventoryVariant.count({ where: { brandId: brand.id, active: true } }),
    prisma.inventoryVariant.aggregate({
      where: { brandId: brand.id, active: true },
      _sum: { stockQuantity: true },
    }),
  ]);

  const categories: Record<string, number> = {};
  for (const p of products) if (p.category) categories[p.category] = (categories[p.category] || 0) + 1;

  return {
    brand,
    categoryCounts: categories,
    variants: variantCount,
    units: unitsResult._sum.stockQuantity || 0,
  };
}

export async function createBrand(input: { name: string; description?: string; logo?: string }) {
  const name = cleanBrandName(input.name);
  if (!name) throw new AppError(400, "Brand name is required");
  const existing = await prisma.brand.findFirst({
    where: { name: { equals: name, mode: "insensitive" } },
  });
  if (existing) throw new AppError(409, `Brand "${name}" already exists`);
  const branchId = getBranchId();
  return prisma.brand.create({
    data: { name, description: input.description || "", logo: input.logo || "", branchId },
  });
}

export async function updateBrand(
  id: string,
  input: { name?: string; description?: string; logo?: string; active?: boolean }
) {
  const brand = await prisma.brand.findUnique({ where: { id } });
  if (!brand) throw new AppError(404, "Brand not found");

  const updateData: Record<string, unknown> = {};

  if (input.name !== undefined && input.name.trim()) {
    const name = cleanBrandName(input.name);
    const dup = await prisma.brand.findFirst({
      where: {
        name: { equals: name, mode: "insensitive" },
        id: { not: id },
      },
    });
    if (dup) throw new AppError(409, `Brand "${name}" already exists`);
    updateData.name = name;
    await prisma.inventoryVariant.updateMany({ where: { brandId: id }, data: { brandName: name } });
    await prisma.inventoryProduct.updateMany({ where: { brandId: id }, data: { brandName: name } });
  }
  if (input.description !== undefined) updateData.description = input.description;
  if (input.logo !== undefined) updateData.logo = input.logo;
  if (input.active !== undefined) updateData.active = input.active;

  return prisma.brand.update({ where: { id }, data: updateData });
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
  const filter: any = { active: true };
  if (options.brandId) filter.brandId = options.brandId;
  if (options.category) filter.category = options.category;
  if (options.gender) filter.gender = options.gender;
  if (options.search) {
    const s = options.search.trim();
    filter.OR = [
      { model: { contains: s, mode: "insensitive" } },
      { brandName: { contains: s, mode: "insensitive" } },
      { displayName: { contains: s, mode: "insensitive" } },
    ];
  }

  return paginateFind(
    (args) => prisma.inventoryProduct.findMany(args),
    (where) => prisma.inventoryProduct.count({ where }),
    { page: options.page, limit: options.limit },
    { where: filter, orderBy: [{ brandName: "asc" }, { model: "asc" }] }
  );
}

export async function getProductById(id: string) {
  const product = await prisma.inventoryProduct.findUnique({ where: { id } });
  if (!product) throw new AppError(404, "Product not found");

  const variants = await prisma.inventoryVariant.findMany({
    where: { productId: id, active: true },
    orderBy: { color: "asc" },
  });
  return { ...product, variants };
}

export async function createProduct(input: {
  brandId?: string;
  brandName?: string;
  category?: string;
  model: string;
  gender?: string;
  description?: string;
}) {
  const brand = await ensureBrand(input.brandId || input.brandName || "");
  const product = await findOrCreateProduct({
    brandId: brand?.id || "",
    brandName: brand?.name || input.brandName || "",
    category: input.category,
    model: input.model,
    gender: input.gender,
    description: input.description,
  });
  return product;
}

export async function updateProduct(id: string, input: Record<string, unknown>) {
  const product = await prisma.inventoryProduct.findUnique({ where: { id } });
  if (!product) throw new AppError(404, "Product not found");

  const allowed = [
    "category",
    "inventoryType",
    "model",
    "gender",
    "description",
    "image",
    "active",
    "sizeOptions",
  ];
  const updateData: Record<string, unknown> = {};
  for (const key of allowed) {
    if (key in input) updateData[key] = input[key];
  }
  if (input.model !== undefined) {
    await prisma.inventoryVariant.updateMany({ where: { productId: id }, data: { model: String(input.model) } });
  }
  if (input.category !== undefined) {
    await prisma.inventoryVariant.updateMany({ where: { productId: id }, data: { category: String(input.category) } });
  }
  return prisma.inventoryProduct.update({ where: { id }, data: updateData });
}

export async function archiveProduct(id: string) {
  const product = await prisma.inventoryProduct.findUnique({ where: { id } });
  if (!product) throw new AppError(404, "Product not found");

  const hasVariants = await prisma.inventoryVariant.findFirst({ where: { productId: id }, select: { id: true } });
  if (hasVariants) {
    await prisma.inventoryProduct.update({ where: { id }, data: { active: false } });
    await prisma.inventoryVariant.updateMany({ where: { productId: id }, data: { active: false } });
    return { ...product, active: false };
  }
  await prisma.inventoryProduct.delete({ where: { id } });
  await prisma.inventoryVariant.deleteMany({ where: { productId: id } });
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
  const filter: any = { active: true };
  if (options.productId) filter.productId = options.productId;
  if (options.brandId) filter.brandId = options.brandId;
  if (options.category) filter.category = options.category;
  if (options.color) filter.color = { contains: options.color, mode: "insensitive" };
  if (options.rackId) filter.rackId = options.rackId;
  if (options.gender) filter.gender = options.gender;

  if (options.stock && options.stock !== "all") {
    const t = Math.max(parseInt(options.threshold || "5", 10) || 5, 0);
    if (options.stock === "in") filter.stockQuantity = { gt: 0 };
    if (options.stock === "out") filter.stockQuantity = 0;
    if (options.stock === "low") filter.stockQuantity = { gt: 0, lte: t };
  }

  if (options.search) {
    const s = options.search.trim();
    filter.OR = [
      { sku: { contains: s, mode: "insensitive" } },
      { model: { contains: s, mode: "insensitive" } },
      { brandName: { contains: s, mode: "insensitive" } },
      { color: { contains: s, mode: "insensitive" } },
      { rackLabel: { contains: s, mode: "insensitive" } },
      { category: { contains: s, mode: "insensitive" } },
    ];
  }

  return paginateFind(
    (args) => prisma.inventoryVariant.findMany(args),
    (where) => prisma.inventoryVariant.count({ where }),
    { page: options.page, limit: options.limit },
    { where: filter, orderBy: [{ brandName: "asc" }, { model: "asc" }, { color: "asc" }] }
  );
}

export async function searchVariants(query: string, limit: number = 20) {
  const s = (query || "").trim();
  if (!s) return [];
  return prisma.inventoryVariant.findMany({
    where: {
      active: true,
      OR: [
        { sku: { contains: s, mode: "insensitive" } },
        { model: { contains: s, mode: "insensitive" } },
        { brandName: { contains: s, mode: "insensitive" } },
        { color: { contains: s, mode: "insensitive" } },
        { rackLabel: { contains: s, mode: "insensitive" } },
      ],
    },
    orderBy: [{ brandName: "asc" }, { model: "asc" }, { color: "asc" }],
    take: Math.min(Math.max(limit, 1), 100),
  });
}

export async function getVariantById(id: string) {
  const variant = await prisma.inventoryVariant.findUnique({ where: { id } });
  if (!variant) throw new AppError(404, "Variant not found");

  const [product, lots, rack, recentMovements] = await Promise.all([
    variant.productId ? prisma.inventoryProduct.findUnique({ where: { id: variant.productId } }) : null,
    prisma.inventoryLot.findMany({ where: { variantId: id }, orderBy: { createdAt: "asc" } }),
    variant.rackId ? prisma.rack.findUnique({ where: { id: variant.rackId }, select: { code: true, name: true } }) : null,
    prisma.inventoryMovement.findMany({ where: { variantId: id }, orderBy: { createdAt: "desc" }, take: 20 }),
  ]);

  return { variant, product, rack, lots, recentMovements };
}

export async function getVariantBySku(sku: string) {
  const variant = await prisma.inventoryVariant.findFirst({ where: { sku: normalizeSku(sku) } });
  if (!variant) throw new AppError(404, "Variant not found");
  return variant;
}

export async function createVariant(input: Record<string, unknown>) {
  const sku = normalizeSku(String(input.sku || ""));
  if (!sku) throw new AppError(400, "SKU is required");
  const existing = await prisma.inventoryVariant.findFirst({ where: { sku } });
  if (existing) throw new AppError(409, `SKU ${sku} already exists`);

  const brand = await ensureBrand(String(input.brandId || input.brandName || ""));
  const product = await findOrCreateProduct({
    brandId: brand?.id || "",
    brandName: brand?.name || String(input.brandName || ""),
    category: String(input.category || "Specs"),
    model: String(input.model || ""),
    gender: String(input.gender || ""),
  });

  const rackLabel = input.rackId
    ? (await prisma.rack.findUnique({ where: { id: String(input.rackId) }, select: { code: true } }))?.code || ""
    : "";

  const branchId = getBranchId();

  const variant = await prisma.inventoryVariant.create({
    data: {
      productId: product.id,
      branchId,
      brandId: brand?.id || null,
      brandName: brand?.name || String(input.brandName || ""),
      category: product.category,
      model: product.model,
      gender: String(input.gender || product.gender || ""),
      sku,
      variantCode: String(input.color || ""),
      color: String(input.color || ""),
      size: String(input.size || ""),
      material: String(input.material || ""),
      frameShape: String(input.frameShape || ""),
      frameType: String(input.frameType || ""),
      templeSize: String(input.templeSize || ""),
      bridgeSize: String(input.bridgeSize || ""),
      lensWidth: String(input.lensWidth || ""),
      defaultSellingPrice: Math.max(Number(input.defaultSellingPrice) || 0, 0),
      rackId: (input.rackId as string) || null,
      rackLabel,
      supplierId: (input.supplierId as string) || null,
      supplierName: String(input.supplierName || ""),
      attributes: (input.attributes as any) || {},
    },
  });
  return variant;
}

export async function updateVariant(id: string, input: Record<string, unknown>) {
  const variant = await prisma.inventoryVariant.findUnique({ where: { id } });
  if (!variant) throw new AppError(404, "Variant not found");

  const allowed = [
    "color",
    "size",
    "gender",
    "material",
    "frameShape",
    "frameType",
    "templeSize",
    "bridgeSize",
    "lensWidth",
    "status",
    "attributes",
    "image",
    "defaultSellingPrice",
    "supplierId",
    "supplierName",
    "active",
  ];
  const updateData: Record<string, unknown> = {};
  for (const key of allowed) {
    if (key in input) {
      if (key === "defaultSellingPrice") {
        updateData[key] = Math.max(Number(input[key]) || 0, 0);
      } else {
        updateData[key] = input[key];
      }
    }
  }

  if (input.rackId !== undefined) {
    const newRackId = input.rackId as string;
    if (newRackId && variant.rackId !== newRackId) {
      const oldRackId = variant.rackId;
      const oldRackLabel = variant.rackLabel;
      const newRack = await prisma.rack.findUnique({ where: { id: newRackId }, select: { code: true } });
      const newRackLabel = newRack?.code || "";
      updateData.rackId = newRackId;
      updateData.rackLabel = newRackLabel;

      const branchId = getBranchId();
      await prisma.inventoryMovement.create({
        data: {
          variantId: id,
          branchId,
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
        },
      });
    } else if (!newRackId) {
      updateData.rackId = null;
      updateData.rackLabel = "";
    }
  }

  return prisma.inventoryVariant.update({ where: { id }, data: updateData });
}

export async function archiveVariant(id: string) {
  const variant = await prisma.inventoryVariant.findUnique({ where: { id } });
  if (!variant) throw new AppError(404, "Variant not found");

  const hasMovements = await prisma.inventoryMovement.findFirst({ where: { variantId: id }, select: { id: true } });
  if (hasMovements) {
    await prisma.inventoryVariant.update({ where: { id }, data: { active: false } });
    return { ...variant, active: false };
  }
  await prisma.inventoryVariant.delete({ where: { id } });
  await prisma.inventoryLot.deleteMany({ where: { variantId: id } });
  return { deleted: true };
}

// ---------------------------------------------------------------------------
// Racks
// ---------------------------------------------------------------------------

export async function listRacks() {
  const racks = await prisma.rack.findMany({
    where: { active: true },
    orderBy: { section: "asc" },
  });

  const variants = await prisma.inventoryVariant.findMany({
    where: { active: true, rackId: { not: null } },
    select: { rackId: true, stockQuantity: true },
  });

  const summaryMap = new Map<string, { variants: number; units: number }>();
  for (const v of variants) {
    if (!v.rackId) continue;
    const s = summaryMap.get(v.rackId) || { variants: 0, units: 0 };
    s.variants += 1;
    s.units += v.stockQuantity || 0;
    summaryMap.set(v.rackId, s);
  }

  return racks.map((r) => ({
    id: r.id,
    name: r.name,
    code: r.code,
    section: r.section,
    sortOrder: r.sortOrder,
    variants: summaryMap.get(r.id)?.variants || 0,
    units: summaryMap.get(r.id)?.units || 0,
  }));
}

export async function createRack(input: {
  name?: string;
  code: string;
  section?: string;
  description?: string;
  sortOrder?: number;
}) {
  const code = String(input.code || "")
    .trim()
    .toUpperCase();
  if (!code) throw new AppError(400, "Rack code is required");
  const existing = await prisma.rack.findFirst({
    where: { code: { equals: code, mode: "insensitive" } },
  });
  if (existing) throw new AppError(409, `Rack ${code} already exists`);
  const branchId = getBranchId();
  return prisma.rack.create({
    data: {
      name: input.name || code,
      code,
      section: input.section || "",
      description: input.description || "",
      sortOrder: Number(input.sortOrder) || 0,
      branchId,
    },
  });
}

export async function updateRack(
  id: string,
  input: {
    name?: string;
    code?: string;
    section?: string;
    description?: string;
    sortOrder?: number;
    active?: boolean;
  }
) {
  const rack = await prisma.rack.findUnique({ where: { id } });
  if (!rack) throw new AppError(404, "Rack not found");

  const updateData: Record<string, unknown> = {};
  if (input.name !== undefined) updateData.name = input.name;
  if (input.code !== undefined) {
    const code = String(input.code).trim().toUpperCase();
    if (!code) throw new AppError(400, "Rack code is required");
    const dup = await prisma.rack.findFirst({
      where: {
        code: { equals: code, mode: "insensitive" },
        id: { not: id },
      },
    });
    if (dup) throw new AppError(409, `Rack ${code} already exists`);
    updateData.code = code;
    await prisma.inventoryVariant.updateMany({ where: { rackId: id }, data: { rackLabel: code } });
  }
  if (input.section !== undefined) updateData.section = input.section;
  if (input.description !== undefined) updateData.description = input.description;
  if (input.sortOrder !== undefined) updateData.sortOrder = Number(input.sortOrder) || 0;
  if (input.active !== undefined) updateData.active = input.active;

  return prisma.rack.update({ where: { id }, data: updateData });
}

export async function getRackItems(rackId: string) {
  const rack = await prisma.rack.findUnique({ where: { id: rackId } });
  if (!rack) throw new AppError(404, "Rack not found");
  const items = await prisma.inventoryVariant.findMany({
    where: { rackId, active: true },
    orderBy: [{ brandName: "asc" }, { model: "asc" }, { color: "asc" }],
  });
  return { rack, items };
}

// ---------------------------------------------------------------------------
// Dashboard
// ---------------------------------------------------------------------------

export async function getDashboard(threshold: number = 5) {
  const t = Math.max(threshold, 0);

  const [
    products,
    variants,
    stockAgg,
    lowStock,
    outOfStock,
    brands,
    recentMovements,
  ] = await Promise.all([
    prisma.inventoryProduct.count({ where: { active: true } }),
    prisma.inventoryVariant.count({ where: { active: true } }),
    prisma.inventoryVariant.aggregate({ where: { active: true }, _sum: { stockQuantity: true } }),
    prisma.inventoryVariant.count({ where: { active: true, stockQuantity: { gt: 0, lte: t } } }),
    prisma.inventoryVariant.count({ where: { active: true, stockQuantity: 0 } }),
    prisma.brand.count({ where: { active: true } }),
    prisma.inventoryMovement.findMany({ orderBy: { createdAt: "desc" }, take: 15 }),
  ]);

  const stockUnits = stockAgg._sum.stockQuantity || 0;

  const lots = await prisma.inventoryLot.findMany({ select: { quantity: true, purchasePrice: true } });
  const inventoryCost = lots.reduce((sum, l) => sum + l.quantity * l.purchasePrice, 0);

  const activeVariants = await prisma.inventoryVariant.findMany({
    where: { active: true },
    select: { stockQuantity: true, defaultSellingPrice: true },
  });
  const inventoryValue = activeVariants.reduce(
    (sum, v) => sum + (v.stockQuantity || 0) * (v.defaultSellingPrice || 0),
    0
  );

  return {
    products,
    variants,
    stockUnits,
    lowStock,
    outOfStock,
    brands,
    inventoryCost,
    inventoryValue,
    lowStockThreshold: t,
    recentActivity: recentMovements,
  };
}
