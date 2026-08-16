import { connect, connection } from "mongoose";
import { MONGO_URI } from "../config";
import { Branch } from "../models/branch";
import { InventorySchema } from "../models/inventory";
import { getBranchModels } from "../models/db";

function normalizeSku(sku: unknown): string {
  return String(sku || "")
    .trim()
    .toUpperCase()
    .replace(/\s+/g, "");
}

function cleanText(value: unknown): string {
  return String(value ?? "").trim();
}

function escapeRegex(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

async function findOrCreateBrand(
  models: ReturnType<typeof getBranchModels>,
  name: string
): Promise<any | null> {
  const clean = cleanText(name);
  if (!clean) return null;
  let brand = (await models.Brand.findOne({
    name: { $regex: `^${escapeRegex(clean)}$`, $options: "i" },
  }).lean()) as any | null;
  if (!brand) {
    const created = await models.Brand.create({ name: clean });
    brand = created.toObject();
  }
  return brand;
}

async function findOrCreateProduct(
  models: ReturnType<typeof getBranchModels>,
  data: {
    brandId?: string | null;
    brandName: string;
    category: string;
    inventoryType: string;
    model: string;
    gender: string;
    description: string;
  }
): Promise<any | null> {
  const modelKey = cleanText(data.model);
  if (!modelKey) {
    return null;
  }
  let product = (await models.InventoryProduct.findOne({
    ...(data.brandId ? { brandId: data.brandId } : {}),
    model: { $regex: `^${escapeRegex(modelKey)}$`, $options: "i" },
  }).lean()) as any | null;
  if (!product) {
    const created = await models.InventoryProduct.create({
      brandId: data.brandId || undefined,
      brandName: data.brandName,
      category: data.category,
      inventoryType: data.inventoryType,
      model: modelKey,
      displayName: data.brandName ? `${data.brandName} ${modelKey}` : modelKey,
      gender: data.gender,
      description: data.description,
    });
    product = created.toObject();
  }
  return product;
}

async function migrateBranch(branch: { dbName: string; code?: string; name: string }) {
  const conn = connection.useDb(branch.dbName);
  const LegacyInventory = conn.model<any>("LegacyInventory", InventorySchema, "inventories");
  const models = getBranchModels(branch.dbName);

  const legacyItems = (await LegacyInventory.find({}).lean()) as any[];
  console.log(
    `[${branch.code || branch.name}] migrating ${legacyItems.length} legacy inventory items`
  );

  let created = 0;
  let skipped = 0;

  for (const item of legacyItems) {
    const sku = normalizeSku(item.sku);
    if (!sku) {
      skipped += 1;
      console.warn(
        `[${branch.code || branch.name}] skipped item with missing SKU (_id=${item._id})`
      );
      continue;
    }

    const existing = await models.InventoryVariant.findOne({ sku }).lean();
    if (existing) {
      skipped += 1;
      continue;
    }

    const category = [
      "Specs",
      "Sunglasses",
      "Contact Lens",
      "Hearing Aid",
      "Solution",
      "Kit",
      "Accessory",
      "Other",
    ].includes(item.category)
      ? item.category
      : "Specs";
    const brandName = cleanText(item.brand);
    const brand = brandName ? await findOrCreateBrand(models, brandName) : null;
    const product = await findOrCreateProduct(models, {
      brandId: brand?._id ? brand._id.toString() : null,
      brandName,
      category,
      inventoryType: cleanText(item.inventoryType),
      model: cleanText(item.model),
      gender: item.gender || "",
      description: cleanText(item.description),
    });

    const quantity = Math.max(Number(item.quantity) || 0, 0);
    const purchasePrice = Math.max(Number(item.purchasePrice) || 0, 0);
    const sellingPrice = Math.max(Number(item.sellingPrice) || 0, 0);

    const variant = await models.InventoryVariant.create({
      productId: product?._id,
      brandId: brand?._id,
      brandName,
      category,
      model: cleanText(item.model),
      gender: item.gender || "",
      sku,
      variantCode: cleanText(item.color),
      color: cleanText(item.color),
      size: cleanText(item.size),
      stockQuantity: quantity,
      defaultSellingPrice: sellingPrice,
      supplierName: cleanText(item.supplier),
      attributes: {
        legacyId: item._id.toString(),
        location: item.location || "shop",
        lensIndex: cleanText(item.lensIndex),
        lensCoating: cleanText(item.lensCoating),
        sphRight: cleanText(item.sphRight),
        cylRight: cleanText(item.cylRight),
        axisRight: cleanText(item.axisRight),
        sphLeft: cleanText(item.sphLeft),
        cylLeft: cleanText(item.cylLeft),
        axisLeft: cleanText(item.axisLeft),
        addPower: cleanText(item.addPower),
      },
    });

    let lot: { _id: unknown } | null = null;
    if (quantity > 0) {
      const createdLot = await models.InventoryLot.create({
        variantId: variant._id,
        lotNumber: "LOT-001",
        initialQuantity: quantity,
        quantity,
        purchasePrice,
        sellingPrice,
        supplierName: cleanText(item.supplier),
        source: "OPENING_BALANCE",
        note: "Migrated from legacy inventory",
      });
      lot = createdLot;
    }

    await models.InventoryMovement.create({
      variantId: variant._id,
      sku,
      lotId: lot?._id || undefined,
      type: "OPENING_BALANCE",
      quantity,
      beforeQuantity: 0,
      afterQuantity: quantity,
      referenceType: "IMPORT",
      by: "migration",
      performedBy: "migration",
      note: "Opening balance migrated from legacy inventory",
    });

    created += 1;
    if (created % 50 === 0) {
      console.log(`[${branch.code || branch.name}] migrated ${created} items...`);
    }
  }

  console.log(`[${branch.code || branch.name}] done: ${created} created, ${skipped} skipped`);
}

async function main() {
  if (!MONGO_URI) {
    console.error("MONGO_URI not set in environment");
    process.exit(1);
  }

  await connect(MONGO_URI);
  console.log("Connected to MongoDB for inventory migration");

  const branches = await Branch.find({ isActive: true }).lean();
  console.log(`Found ${branches.length} active branches`);

  for (const branch of branches) {
    try {
      await migrateBranch(branch as any);
    } catch (err) {
      console.error(`[${branch.code || branch.name}] migration failed:`, (err as Error).message);
    }
  }

  console.log("Inventory migration completed");
  process.exit(0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
