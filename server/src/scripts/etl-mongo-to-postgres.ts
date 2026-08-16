// ---------------------------------------------------------------------------
// ETL: MongoDB -> PostgreSQL (KMJ Optical ERP)
//
// Reads all Mongo data (global + per-branch DBs + warehouse DB) and writes it
// into the Prisma/PostgreSQL schema:
//   - Deterministic uuid v5 ids derived from Mongo ObjectIds, so re-runs are
//     idempotent and references stay consistent.
//   - Row-level tenancy: every branch-scoped row is stamped with branchId.
//   - Embedded Mongo arrays are expanded into child tables; Mixed fields are
//     stored as Json (Postgres JSONB).
//
// Run:  npm run etl -w server   (set MONGO_URI + DATABASE_URL in server/.env)
// ---------------------------------------------------------------------------

import mongoose from "mongoose";
import { createHash } from "crypto";
import { PrismaClient, type Prisma } from "@prisma/client";
import { MONGO_URI, DATABASE_URL, WAREHOUSE_DB_NAME } from "../config";

const prisma = new PrismaClient({ datasources: { db: { url: DATABASE_URL } } });

// --- deterministic uuid v5 (name-based, sha1 namespace DNS) -----------------
const DNS_NAMESPACE = Buffer.from("6ba7b8109dad11d180b400c04fd430c8", "hex");

function uuid5(name: string): string {
  const hash = createHash("sha1").update(DNS_NAMESPACE).update(name).digest();
  hash[6] = (hash[6] & 0x0f) | 0x50;
  hash[8] = (hash[8] & 0x3f) | 0x80;
  const hex = hash.toString("hex").slice(0, 32);
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}

// hex (24-char ObjectId) -> uuid
type HexMap = Map<string, string>;

const globalMap: HexMap = new Map(); // global collections (users, branches, ...)
const branchByHex = new Map<string, { uuid: string; dbName: string }>();

function hexOf(v: unknown): string | null {
  if (v == null) return null;
  if (typeof (v as any).toHexString === "function") return (v as any).toHexString();
  if (typeof v === "string" && /^[0-9a-fA-F]{24}$/.test(v)) return v.toLowerCase();
  return null;
}

// --- scalar converters ------------------------------------------------------
function num(v: unknown, d = 0): number {
  if (v == null || v === "") return d;
  const n = Number(v);
  return Number.isFinite(n) ? n : d;
}
function str(v: unknown, d = ""): string {
  if (v == null) return d;
  if (typeof v === "string") return v;
  if (v instanceof Date) return v.toISOString();
  return String(v);
}
function bool(v: unknown, d = false): boolean {
  return v == null ? d : Boolean(v);
}
function date(v: unknown): Date | null {
  if (v == null || v === "") return null;
  const d = v instanceof Date ? v : new Date(String(v));
  return Number.isNaN(d.getTime()) ? null : d;
}
function arrStr(v: unknown): string[] {
  return Array.isArray(v) ? v.map((x) => str(x)) : [];
}
function json(v: unknown, d: unknown = null): Prisma.InputJsonValue {
  if (v == null) return d as Prisma.InputJsonValue;
  if (typeof (v as any).toHexString === "function") return (v as any).toHexString();
  return v as Prisma.InputJsonValue;
}
function stamps(doc: any) {
  return {
    createdAt: date(doc.createdAt) ?? new Date(),
    updatedAt: date(doc.updatedAt) ?? new Date(),
  };
}

// --- reference resolution ---------------------------------------------------
function resolveRef(map: HexMap, v: unknown, dbKey: string, collection: string): string | null {
  const hex = hexOf(v);
  if (!hex) return null;
  const hit = map.get(hex);
  if (hit) return hit;
  return uuid5(`${dbKey}::${collection}::${hex}`);
}

function log(collection: string, n: number) {
  console.log(`  [ETL] ${collection}: ${n} rows`);
}

async function main() {
  if (!MONGO_URI) throw new Error("MONGO_URI is not set in server/.env");
  if (!DATABASE_URL) throw new Error("DATABASE_URL is not set in server/.env");

  await mongoose.connect(MONGO_URI, { bufferCommands: false });
  console.log("[ETL] connected to MongoDB");

  try {
    await prisma.$transaction(
      async (tx: Prisma.TransactionClient) => {
        await migrateGlobal(tx);
        await migrateBranches(tx);
        await migrateWarehouse(tx);
      },
      { maxWait: 60_000, timeout: 60 * 60 * 1000 }
    );
  } finally {
    await prisma.$disconnect();
    await mongoose.disconnect();
  }
  console.log("[ETL] done");
}

// ===========================================================================
// GLOBAL collections
// ===========================================================================
async function migrateGlobal(tx: Prisma.TransactionClient) {
  const conn = mongoose.connection;
  const DB = "GLOBAL";

  // branches (record branch ids before any branch-scoped data is stamped)
  const branches = await conn.collection("branches").find().toArray();
  const branchRows: any[] = [];
  for (const b of branches) {
    const id = hexOf(b._id);
    const uuid = uuid5(`${DB}::branches::${id}`);
    globalMap.set(id!, uuid);
    branchByHex.set(id!, { uuid, dbName: str(b.dbName) });
    branchRows.push({
      id: uuid,
      name: str(b.name),
      code: str(b.code),
      address: str(b.address),
      phone: str(b.phone),
      email: str(b.email),
      dbName: str(b.dbName),
      isActive: bool(b.isActive, true),
      settings: json(b.settings, "{}"),
      ...stamps(b),
    });
  }
  if (branchRows.length) {
    await tx.branch.createMany({ data: branchRows, skipDuplicates: true });
    log("branches", branchRows.length);
  }

  // users (including branches[] many-to-many)
  const users = await conn.collection("users").find().toArray();
  const userRows: any[] = [];
  const userUuids = new Map<string, string>();
  for (const u of users) {
    const id = hexOf(u._id);
    const uuid = uuid5(`${DB}::users::${id}`);
    globalMap.set(id!, uuid);
    userUuids.set(id!, uuid);
    userRows.push({
      id: uuid,
      username: str(u.username),
      passwordHash: str(u.passwordHash),
      name: str(u.name),
      mobile: str(u.mobile),
      role: str(u.role, "owner"),
      ...stamps(u),
    });
  }
  if (userRows.length) {
    await tx.user.createMany({ data: userRows, skipDuplicates: true });
    log("users", userRows.length);
  }

  // user <-> branch join
  let joinCount = 0;
  for (const u of users) {
    const userId = userUuids.get(hexOf(u._id)!);
    if (!userId) continue;
    const branchIds = Array.isArray(u.branches)
      ? u.branches.map((b: unknown) => globalMap.get(hexOf(b)!)).filter(Boolean)
      : [];
    for (const branchId of branchIds as string[]) {
      await tx.$executeRawUnsafe(
        'INSERT INTO "_BranchToUser" ("A", "B") VALUES ($1, $2) ON CONFLICT DO NOTHING',
        branchId,
        userId
      );
      joinCount++;
    }
  }
  if (joinCount) log("_BranchToUser", joinCount);

  // cameras
  const cameras = await conn.collection("cameras").find().toArray();
  const cameraRows = cameras.map((c: any) => {
    const id = hexOf(c._id);
    const uuid = uuid5(`${DB}::cameras::${id}`);
    globalMap.set(id!, uuid);
    return {
      id: uuid,
      name: str(c.name),
      serialNumber: str(c.serialNumber),
      username: str(c.username, "admin"),
      password: str(c.password),
      streamPath: c.streamPath == null ? null : str(c.streamPath),
      status: str(c.status, "connecting"),
      lastError: c.lastError == null ? null : str(c.lastError),
      ...stamps(c),
    };
  });
  if (cameraRows.length) {
    await tx.camera.createMany({ data: cameraRows, skipDuplicates: true });
    log("cameras", cameraRows.length);
  }

  // messages (branchId is a plain string in Mongo)
  const messages = await conn.collection("messages").find().toArray();
  const messageRows = messages.map((m: any) => {
    const id = hexOf(m._id);
    const uuid = uuid5(`${DB}::messages::${id}`);
    globalMap.set(id!, uuid);
    return {
      id: uuid,
      branchId: str(m.branchId),
      phone: str(m.phone),
      direction: str(m.direction),
      type: str(m.type),
      content: str(m.content),
      filename: str(m.filename),
      mimetype: str(m.mimetype),
      metaMessageId: str(m.metaMessageId),
      status: str(m.status, "pending"),
      error: str(m.error),
      ...stamps(m),
    };
  });
  if (messageRows.length) {
    await tx.message.createMany({ data: messageRows, skipDuplicates: true });
    log("messages", messageRows.length);
  }
}

// ===========================================================================
// BRANCH databases (one DB per branch, all stamped with the branch's uuid)
// ===========================================================================
async function migrateBranches(tx: Prisma.TransactionClient) {
  for (const [, info] of branchByHex) {
    const { uuid: branchId, dbName } = info;
    const DB = `BRANCH:${dbName}`;
    const map: HexMap = new Map();
    console.log(`[ETL] branch ${dbName} -> ${branchId}`);
    const conn = mongoose.connection.useDb(dbName, { noListener: true });
    await migrateBranchCollections(tx, conn, DB, map, branchId);
  }
}

async function migrateBranchCollections(
  tx: Prisma.TransactionClient,
  conn: mongoose.Connection,
  DB: string,
  map: HexMap,
  branchId: string
) {
  // helper: build uuid for a doc, register in branch hex map
  function uid(collection: string, doc: any): string {
    const hex = hexOf(doc._id)!;
    const u = uuid5(`${DB}::${collection}::${hex}`);
    map.set(hex, u);
    return u;
  }
  const ref = (v: unknown) => resolveRef(map, v, DB, "ANY") as string | null;
  const reqRef = (v: unknown) => ref(v) as string;

  // customers
  const customers = await conn.collection("customers").find().toArray();
  if (customers.length) {
    await tx.customer.createMany({
      data: customers.map((c: any) => ({
        id: uid("customers", c),
        branchId,
        customerId: c.customerId == null ? null : str(c.customerId),
        name: str(c.name),
        email: c.email == null ? null : str(c.email),
        age: c.age == null ? null : num(c.age),
        gender: c.gender == null ? null : str(c.gender),
        mobile: c.mobile == null ? null : str(c.mobile),
        alternateMobile: c.alternateMobile == null ? null : str(c.alternateMobile),
        address: c.address == null ? null : str(c.address),
        city: c.city == null ? null : str(c.city),
        tags: arrStr(c.tags),
        totalVisits: num(c.totalVisits),
        totalSpent: num(c.totalSpent),
        pendingAmount: num(c.pendingAmount),
        ...stamps(c),
      })),
      skipDuplicates: true,
    });
    log("customers", customers.length);
  }

  // visits
  const visits = await conn.collection("visits").find().toArray();
  if (visits.length) {
    await tx.visit.createMany({
      data: visits.map((v: any) => ({
        id: uid("visits", v),
        branchId,
        customerId: reqRef(v.customerId),
        visitDate: date(v.visitDate) ?? new Date(),
        visitType: str(v.visitType, "new"),
        doctorName: v.doctorName == null ? null : str(v.doctorName),
        shop: v.shop == null ? null : str(v.shop),
        shopId: v.shopId == null ? null : ref(v.shopId),
        remarks: v.remarks == null ? null : str(v.remarks),
        ...stamps(v),
      })),
      skipDuplicates: true,
    });
    log("visits", visits.length);
  }

  // prescriptions (rightEye/leftEye -> Json)
  const prescriptions = await conn.collection("prescriptions").find().toArray();
  if (prescriptions.length) {
    await tx.prescription.createMany({
      data: prescriptions.map((p: any) => ({
        id: uid("prescriptions", p),
        branchId,
        customerId: reqRef(p.customerId),
        visitId: ref(p.visitId),
        rightEye: json(p.rightEye, {}),
        leftEye: json(p.leftEye, {}),
        pd: p.pd == null ? null : str(p.pd),
        notes: p.notes == null ? null : str(p.notes),
        ...stamps(p),
      })),
      skipDuplicates: true,
    });
    log("prescriptions", prescriptions.length);
  }

  // orders (+ order_stock_items)
  const orders = await conn.collection("orders").find().toArray();
  if (orders.length) {
    const orderRows: any[] = [];
    const stockRows: any[] = [];
    for (const o of orders) {
      const id = uid("orders", o);
      orderRows.push({
        id,
        branchId,
        customerId: reqRef(o.customerId),
        visitId: ref(o.visitId),
        frame: o.frame == null ? null : str(o.frame),
        frameBrand: o.frameBrand == null ? null : str(o.frameBrand),
        frameModel: o.frameModel == null ? null : str(o.frameModel),
        frameColor: o.frameColor == null ? null : str(o.frameColor),
        frameSize: o.frameSize == null ? null : str(o.frameSize),
        framePrice: num(o.framePrice),
        lens: o.lens == null ? null : str(o.lens),
        lensBrand: o.lensBrand == null ? null : str(o.lensBrand),
        lensType: o.lensType == null ? null : str(o.lensType),
        lensIndex: o.lensIndex == null ? null : str(o.lensIndex),
        lensPrice: num(o.lensPrice),
        coating: o.coating == null ? null : str(o.coating),
        coatingPrice: num(o.coatingPrice),
        accessories: arrStr(o.accessories),
        quantity: num(o.quantity, 1),
        forwardedCount: num(o.forwardedCount),
        deliveryDate: date(o.deliveryDate),
        actualDeliveryDate: date(o.actualDeliveryDate),
        status: str(o.status, "Draft"),
        labAssigned: o.labAssigned == null ? null : str(o.labAssigned),
        labExpectedDate: date(o.labExpectedDate),
        labRemarks: o.labRemarks == null ? null : str(o.labRemarks),
        reviewed: bool(o.reviewed),
        classification: str(o.classification, "pending"),
        rightLensStatus: str(o.rightLensStatus, "pending"),
        leftLensStatus: str(o.leftLensStatus, "pending"),
        ...stamps(o),
      });
      const items = Array.isArray(o.stockItems) ? o.stockItems : [];
      for (const [j, it] of items.entries()) {
        stockRows.push({
          id: uuid5(`${DB}::orders::${hexOf(o._id)}::stock::${j}`),
          orderId: id,
          sku: it.sku == null ? null : str(it.sku),
          quantity: num(it.quantity, 1),
        });
      }
    }
    await tx.order.createMany({ data: orderRows, skipDuplicates: true });
    log("orders", orderRows.length);
    if (stockRows.length) {
      await tx.orderStockItem.createMany({ data: stockRows, skipDuplicates: true });
      log("order_stock_items", stockRows.length);
    }
  }

  // bills (+ bill_items, bill_stock_items)
  const bills = await conn.collection("bills").find().toArray();
  if (bills.length) {
    const billRows: any[] = [];
    const itemRows: any[] = [];
    const stockRows: any[] = [];
    for (const b of bills) {
      const id = uid("bills", b);
      billRows.push({
        id,
        branchId,
        billNumber: str(b.billNumber),
        customerId: reqRef(b.customerId),
        visitId: ref(b.visitId),
        subtotal: num(b.subtotal),
        discount: num(b.discount),
        tax: num(b.tax),
        advancePaid: num(b.advancePaid),
        pendingAmount: num(b.pendingAmount),
        totalAmount: num(b.totalAmount),
        status: str(b.status, "Active"),
        ...stamps(b),
      });
      const items = Array.isArray(b.items) ? b.items : [];
      for (const [j, it] of items.entries()) {
        itemRows.push({
          id: uuid5(`${DB}::bills::${hexOf(b._id)}::item::${j}`),
          billId: id,
          description: str(it.description),
          quantity: num(it.quantity, 1),
          unitPrice: num(it.unitPrice),
          total: num(it.total),
        });
      }
      const stock = Array.isArray(b.stockItems) ? b.stockItems : [];
      for (const [j, it] of stock.entries()) {
        stockRows.push({
          id: uuid5(`${DB}::bills::${hexOf(b._id)}::stock::${j}`),
          billId: id,
          sku: it.sku == null ? null : str(it.sku),
          quantity: num(it.quantity, 1),
        });
      }
    }
    await tx.bill.createMany({ data: billRows, skipDuplicates: true });
    log("bills", billRows.length);
    if (itemRows.length) {
      await tx.billItem.createMany({ data: itemRows, skipDuplicates: true });
      log("bill_items", itemRows.length);
    }
    if (stockRows.length) {
      await tx.billStockItem.createMany({ data: stockRows, skipDuplicates: true });
      log("bill_stock_items", stockRows.length);
    }
  }

  // payments
  const payments = await conn.collection("payments").find().toArray();
  if (payments.length) {
    await tx.payment.createMany({
      data: payments.map((p: any) => ({
        id: uid("payments", p),
        branchId,
        customerId: reqRef(p.customerId),
        billId: ref(p.billId),
        amount: num(p.amount),
        paymentMode: str(p.paymentMode, "Cash"),
        paymentDate: date(p.paymentDate) ?? new Date(),
        notes: p.notes == null ? null : str(p.notes),
        ...stamps(p),
      })),
      skipDuplicates: true,
    });
    log("payments", payments.length);
  }

  // deliveries
  const deliveries = await conn.collection("deliveries").find().toArray();
  if (deliveries.length) {
    await tx.delivery.createMany({
      data: deliveries.map((d: any) => ({
        id: uid("deliveries", d),
        branchId,
        customerId: reqRef(d.customerId),
        orderId: ref(d.orderId),
        address: d.address == null ? null : str(d.address),
        expectedDeliveryDate: date(d.expectedDeliveryDate),
        actualDeliveryDate: date(d.actualDeliveryDate),
        status: str(d.status, "Pending"),
        ...stamps(d),
      })),
      skipDuplicates: true,
    });
    log("deliveries", deliveries.length);
  }

  // settings
  const settings = await conn.collection("settings").find().toArray();
  if (settings.length) {
    await tx.settings.createMany({
      data: settings.map((s: any) => ({
        id: uid("settings", s),
        branchId,
        shopName: str(s.shopName, "KMJ Optical"),
        shopAddress: str(s.shopAddress),
        shopPhone: str(s.shopPhone),
        shopEmail: str(s.shopEmail),
        adminWhatsApp: str(s.adminWhatsApp),
        logo: str(s.logo),
        ...stamps(s),
      })),
      skipDuplicates: true,
    });
    log("settings", settings.length);
  }

  // todos
  const todos = await conn.collection("todos").find().toArray();
  if (todos.length) {
    await tx.todo.createMany({
      data: todos.map((t: any) => ({
        id: uid("todos", t),
        branchId,
        task: str(t.task),
        done: bool(t.done),
        notes: t.notes == null ? null : str(t.notes),
        ...stamps(t),
      })),
      skipDuplicates: true,
    });
    log("todos", todos.length);
  }

  // brands
  const brands = await conn.collection("brands").find().toArray();
  if (brands.length) {
    await tx.brand.createMany({
      data: brands.map((b: any) => ({
        id: uid("brands", b),
        branchId,
        name: str(b.name),
        description: str(b.description),
        logo: str(b.logo),
        active: bool(b.active, true),
        ...stamps(b),
      })),
      skipDuplicates: true,
    });
    log("brands", brands.length);
  }

  // inventory products
  const products = await conn.collection("inventoryproducts").find().toArray();
  if (products.length) {
    await tx.inventoryProduct.createMany({
      data: products.map((p: any) => ({
        id: uid("inventoryproducts", p),
        branchId,
        brandId: ref(p.brandId),
        brandName: str(p.brandName),
        category: str(p.category, "Specs"),
        inventoryType: str(p.inventoryType),
        model: str(p.model),
        displayName: str(p.displayName),
        gender: str(p.gender),
        description: str(p.description),
        image: str(p.image),
        sizeOptions: arrStr(p.sizeOptions),
        active: bool(p.active, true),
        ...stamps(p),
      })),
      skipDuplicates: true,
    });
    log("inventory_products", products.length);
  }

  // racks
  const racks = await conn.collection("racks").find().toArray();
  if (racks.length) {
    await tx.rack.createMany({
      data: racks.map((r: any) => ({
        id: uid("racks", r),
        branchId,
        name: str(r.name),
        code: str(r.code),
        section: str(r.section),
        description: str(r.description),
        active: bool(r.active, true),
        sortOrder: num(r.sortOrder),
        ...stamps(r),
      })),
      skipDuplicates: true,
    });
    log("racks", racks.length);
  }

  // inventory variants (attributes -> Json)
  const variants = await conn.collection("inventoryvariants").find().toArray();
  if (variants.length) {
    await tx.inventoryVariant.createMany({
      data: variants.map((v: any) => ({
        id: uid("inventoryvariants", v),
        branchId,
        productId: ref(v.productId),
        brandId: ref(v.brandId),
        brandName: str(v.brandName),
        category: str(v.category),
        model: str(v.model),
        gender: str(v.gender),
        sku: str(v.sku),
        variantCode: str(v.variantCode),
        color: str(v.color),
        size: str(v.size),
        material: str(v.material),
        frameShape: str(v.frameShape),
        frameType: str(v.frameType),
        templeSize: str(v.templeSize),
        bridgeSize: str(v.bridgeSize),
        lensWidth: str(v.lensWidth),
        status: str(v.status, "active"),
        attributes: json(v.attributes, {}),
        image: str(v.image),
        stockQuantity: num(v.stockQuantity),
        defaultSellingPrice: num(v.defaultSellingPrice),
        rackId: ref(v.rackId),
        rackLabel: str(v.rackLabel),
        supplierId: ref(v.supplierId),
        supplierName: str(v.supplierName),
        lastSoldAt: date(v.lastSoldAt),
        active: bool(v.active, true),
        ...stamps(v),
      })),
      skipDuplicates: true,
    });
    log("inventory_variants", variants.length);
  }

  // inventory lots
  const lots = await conn.collection("inventorylots").find().toArray();
  if (lots.length) {
    await tx.inventoryLot.createMany({
      data: lots.map((l: any) => ({
        id: uid("inventorylots", l),
        branchId,
        variantId: ref(l.variantId),
        lotNumber: str(l.lotNumber),
        initialQuantity: num(l.initialQuantity),
        quantity: num(l.quantity),
        purchasePrice: num(l.purchasePrice),
        sellingPrice: num(l.sellingPrice),
        supplierId: ref(l.supplierId),
        supplierName: str(l.supplierName),
        rackId: ref(l.rackId),
        rackLabel: str(l.rackLabel),
        purchaseDate: date(l.purchaseDate),
        batchNumber: str(l.batchNumber),
        expiryDate: date(l.expiryDate),
        source: str(l.source, "PURCHASE"),
        note: str(l.note),
        ...stamps(l),
      })),
      skipDuplicates: true,
    });
    log("inventory_lots", lots.length);
  }

  // inventory (legacy flat SKU stock + stockHistory)
  const inventory = await conn.collection("inventories").find().toArray();
  if (inventory.length) {
    const invRows: any[] = [];
    const histRows: any[] = [];
    for (const s of inventory) {
      const id = uid("inventories", s);
      invRows.push({
        id,
        branchId,
        sku: str(s.sku),
        category: str(s.category, "Specs"),
        inventoryType: str(s.inventoryType, "spectacles"),
        brand: s.brand == null ? null : str(s.brand),
        model: s.model == null ? null : str(s.model),
        color: s.color == null ? null : str(s.color),
        size: s.size == null ? null : str(s.size),
        gender: str(s.gender),
        supplier: s.supplier == null ? null : str(s.supplier),
        quantity: num(s.quantity),
        location: str(s.location, "shop"),
        purchasePrice: num(s.purchasePrice),
        sellingPrice: num(s.sellingPrice),
        description: s.description == null ? null : str(s.description),
        lensIndex: s.lensIndex == null ? null : str(s.lensIndex),
        lensCoating: s.lensCoating == null ? null : str(s.lensCoating),
        sphRight: s.sphRight == null ? null : str(s.sphRight),
        cylRight: s.cylRight == null ? null : str(s.cylRight),
        axisRight: s.axisRight == null ? null : str(s.axisRight),
        sphLeft: s.sphLeft == null ? null : str(s.sphLeft),
        cylLeft: s.cylLeft == null ? null : str(s.cylLeft),
        axisLeft: s.axisLeft == null ? null : str(s.axisLeft),
        addPower: s.addPower == null ? null : str(s.addPower),
        ...stamps(s),
      });
      const history = Array.isArray(s.stockHistory) ? s.stockHistory : [];
      for (const [j, h] of history.entries()) {
        histRows.push({
          id: uuid5(`${DB}::inventories::${hexOf(s._id)}::hist::${j}`),
          inventoryId: id,
          qty: num(h.qty),
          type: str(h.type, "adjust"),
          note: str(h.note),
          by: str(h.by),
          at: date(h.at) ?? new Date(),
        });
      }
    }
    await tx.inventory.createMany({ data: invRows, skipDuplicates: true });
    log("inventory", invRows.length);
    if (histRows.length) {
      await tx.inventoryMovementHistory.createMany({ data: histRows, skipDuplicates: true });
      log("inventory_movement_history", histRows.length);
    }
  }

  // lens stock (quantities -> Json)
  const lensStock = await conn.collection("lensstocks").find().toArray();
  if (lensStock.length) {
    await tx.lensStock.createMany({
      data: lensStock.map((l: any) => ({
        id: uid("lensstocks", l),
        branchId,
        coating: str(l.coating),
        price: num(l.price),
        priceNeg: num(l.priceNeg),
        pricePos: num(l.pricePos),
        quantities: json(l.quantities, {}),
        ...stamps(l),
      })),
      skipDuplicates: true,
    });
    log("lens_stock", lensStock.length);
  }

  // inventory movements (+ lot breakdown)
  const movements = await conn.collection("inventorymovements").find().toArray();
  if (movements.length) {
    const movRows: any[] = [];
    const lotRows: any[] = [];
    for (const m of movements) {
      const id = uid("inventorymovements", m);
      movRows.push({
        id,
        branchId,
        variantId: ref(m.variantId),
        sku: str(m.sku),
        lotId: ref(m.lotId),
        type: str(m.type),
        quantity: num(m.quantity),
        beforeQuantity: num(m.beforeQuantity),
        afterQuantity: num(m.afterQuantity),
        referenceType: str(m.referenceType, "MANUAL"),
        referenceId: ref(m.referenceId),
        note: str(m.note),
        by: str(m.by),
        performedBy: str(m.performedBy),
        rackId: ref(m.rackId),
        rackLabel: str(m.rackLabel),
        oldRackId: ref(m.oldRackId),
        newRackId: ref(m.newRackId),
        ...stamps(m),
      });
      const breakdown = Array.isArray(m.lotBreakdown) ? m.lotBreakdown : [];
      for (const [j, lb] of breakdown.entries()) {
        lotRows.push({
          id: uuid5(`${DB}::inventorymovements::${hexOf(m._id)}::lot::${j}`),
          movementId: id,
          lotId: ref(lb.lotId),
          quantity: num(lb.quantity),
        });
      }
    }
    await tx.inventoryMovement.createMany({ data: movRows, skipDuplicates: true });
    log("inventory_movements", movRows.length);
    if (lotRows.length) {
      await tx.inventoryMovementLot.createMany({ data: lotRows, skipDuplicates: true });
      log("inventory_movement_lots", lotRows.length);
    }
  }

  // inventory count sessions
  const countSessions = await conn.collection("inventorycountsessions").find().toArray();
  if (countSessions.length) {
    await tx.inventoryCountSession.createMany({
      data: countSessions.map((cs: any) => ({
        id: uid("inventorycountsessions", cs),
        branchId,
        rackId: ref(cs.rackId),
        rackLabel: str(cs.rackLabel),
        status: str(cs.status, "draft"),
        startedBy: str(cs.startedBy),
        completedBy: str(cs.completedBy),
        startedAt: date(cs.startedAt) ?? new Date(),
        completedAt: date(cs.completedAt),
        expectedUnits: num(cs.expectedUnits),
        countedUnits: num(cs.countedUnits),
        note: str(cs.note),
        ...stamps(cs),
      })),
      skipDuplicates: true,
    });
    log("inventory_count_sessions", countSessions.length);
  }

  // inventory count entries
  const countEntries = await conn.collection("inventorycountentries").find().toArray();
  if (countEntries.length) {
    await tx.inventoryCountEntry.createMany({
      data: countEntries.map((ce: any) => ({
        id: uid("inventorycountentries", ce),
        branchId,
        countSessionId: reqRef(ce.countSessionId),
        variantId: ref(ce.variantId),
        sku: str(ce.sku),
        brandName: str(ce.brandName),
        model: str(ce.model),
        color: str(ce.color),
        size: str(ce.size),
        lotId: ref(ce.lotId),
        expectedQuantity: num(ce.expectedQuantity),
        countedQuantity: num(ce.countedQuantity),
        difference: num(ce.difference),
        ...stamps(ce),
      })),
      skipDuplicates: true,
    });
    log("inventory_count_entries", countEntries.length);
  }

  // inventory withdrawals (legacy)
  const withdrawals = await conn.collection("inventorywithdrawals").find().toArray();
  if (withdrawals.length) {
    const wRows: any[] = [];
    const itemRows: any[] = [];
    for (const w of withdrawals) {
      const id = uid("inventorywithdrawals", w);
      wRows.push({
        id,
        branchId,
        note: str(w.note),
        by: str(w.by),
        totalQty: num(w.totalQty),
        totalPrice: num(w.totalPrice),
        ...stamps(w),
      });
      const items = Array.isArray(w.items) ? w.items : [];
      for (const [j, it] of items.entries()) {
        itemRows.push({
          id: uuid5(`${DB}::inventorywithdrawals::${hexOf(w._id)}::item::${j}`),
          withdrawalId: id,
          sku: str(it.sku),
          brand: str(it.brand),
          model: str(it.model),
          color: str(it.color),
          category: str(it.category),
          qty: num(it.qty),
          price: num(it.price),
        });
      }
    }
    await tx.inventoryWithdrawal.createMany({ data: wRows, skipDuplicates: true });
    log("inventory_withdrawals", wRows.length);
    if (itemRows.length) {
      await tx.inventoryWithdrawalItem.createMany({ data: itemRows, skipDuplicates: true });
      log("inventory_withdrawal_items", itemRows.length);
    }
  }

  // inventory withdrawals v2 (+ items + per-item lot breakdown)
  const withdrawalsV2 = await conn.collection("inventorywithdrawalsv2").find().toArray();
  if (withdrawalsV2.length) {
    const wRows: any[] = [];
    const itemRows: any[] = [];
    const lotRows: any[] = [];
    for (const w of withdrawalsV2) {
      const id = uid("inventorywithdrawalsv2", w);
      wRows.push({
        id,
        branchId,
        reason: str(w.reason, "Other"),
        note: str(w.note),
        by: str(w.by),
        totalQty: num(w.totalQty),
        totalPrice: num(w.totalPrice),
        reversed: bool(w.reversed),
        reversedAt: date(w.reversedAt),
        ...stamps(w),
      });
      const items = Array.isArray(w.items) ? w.items : [];
      for (const [j, it] of items.entries()) {
        const itemId = uuid5(`${DB}::inventorywithdrawalsv2::${hexOf(w._id)}::item::${j}`);
        itemRows.push({
          id: itemId,
          withdrawalId: id,
          variantId: ref(it.variantId),
          sku: str(it.sku),
          brand: str(it.brand),
          model: str(it.model),
          color: str(it.color),
          category: str(it.category),
          lotId: ref(it.lotId),
          quantity: num(it.quantity),
          price: num(it.price),
        });
        const breakdown = Array.isArray(it.lotBreakdown) ? it.lotBreakdown : [];
        for (const [k, lb] of breakdown.entries()) {
          lotRows.push({
            id: uuid5(`${DB}::inventorywithdrawalsv2::${hexOf(w._id)}::item::${j}::lot::${k}`),
            itemId,
            lotId: ref(lb.lotId),
            quantity: num(lb.quantity),
          });
        }
      }
    }
    await tx.inventoryWithdrawalV2.createMany({ data: wRows, skipDuplicates: true });
    log("inventory_withdrawals_v2", wRows.length);
    if (itemRows.length) {
      await tx.inventoryWithdrawalV2Item.createMany({ data: itemRows, skipDuplicates: true });
      log("inventory_withdrawal_v2_items", itemRows.length);
    }
    if (lotRows.length) {
      await tx.inventoryWithdrawalV2ItemLot.createMany({ data: lotRows, skipDuplicates: true });
      log("inventory_withdrawal_v2_item_lots", lotRows.length);
    }
  }

  // shop lens withdrawals (+ items)
  const shopWithdrawals = await conn.collection("shoplenswithdrawals").find().toArray();
  if (shopWithdrawals.length) {
    const wRows: any[] = [];
    const itemRows: any[] = [];
    for (const w of shopWithdrawals) {
      const id = uid("shoplenswithdrawals", w);
      wRows.push({
        id,
        branchId,
        userId: reqRef(w.user),
        username: str(w.username),
        totalQuantity: num(w.totalQuantity),
        totalPrice: num(w.totalPrice),
        note: str(w.note),
        withdrawnAt: date(w.withdrawnAt) ?? new Date(),
        ...stamps(w),
      });
      const items = Array.isArray(w.items) ? w.items : [];
      for (const [j, it] of items.entries()) {
        itemRows.push({
          id: uuid5(`${DB}::shoplenswithdrawals::${hexOf(w._id)}::item::${j}`),
          withdrawalId: id,
          coating: str(it.coating),
          lensType: str(it.lensType),
          powerKey: str(it.powerKey),
          quantity: num(it.quantity),
          price: num(it.price),
        });
      }
    }
    await tx.shopLensWithdrawal.createMany({ data: wRows, skipDuplicates: true });
    log("shop_lens_withdrawals", wRows.length);
    if (itemRows.length) {
      await tx.shopLensWithdrawalItem.createMany({ data: itemRows, skipDuplicates: true });
      log("shop_lens_withdrawal_items", itemRows.length);
    }
  }

  // shop cart items (user -> global user)
  const shopCart = await conn.collection("shopcartitems").find().toArray();
  if (shopCart.length) {
    await tx.shopCartItem.createMany({
      data: shopCart.map((c: any) => ({
        id: uid("shopcartitems", c),
        branchId,
        userId: reqRef(c.user),
        coating: str(c.coating),
        lensType: str(c.lensType),
        powerKey: str(c.powerKey),
        quantity: num(c.quantity),
        price: num(c.price),
        ...stamps(c),
      })),
      skipDuplicates: true,
    });
    log("shop_cart_items", shopCart.length);
  }
}

// ===========================================================================
// WAREHOUSE database
// ===========================================================================
async function migrateWarehouse(tx: Prisma.TransactionClient) {
  const DB = `WAREHOUSE:${WAREHOUSE_DB_NAME}`;
  const map: HexMap = new Map();
  console.log(`[ETL] warehouse ${WAREHOUSE_DB_NAME}`);
  const conn = mongoose.connection.useDb(WAREHOUSE_DB_NAME, { noListener: true });

  const uid = (collection: string, doc: any): string => {
    const hex = hexOf(doc._id)!;
    const u = uuid5(`${DB}::${collection}::${hex}`);
    map.set(hex, u);
    return u;
  };
  const ref = (v: unknown) => resolveRef(map, v, DB, "ANY") as string | null;
  const reqRef = (v: unknown) => ref(v) as string;

  // inventory (+ stockHistory)
  const inventory = await conn.collection("inventories").find().toArray();
  if (inventory.length) {
    const invRows: any[] = [];
    const histRows: any[] = [];
    for (const s of inventory) {
      const id = uid("inventories", s);
      invRows.push({
        id,
        sku: str(s.sku),
        category: str(s.category, "Specs"),
        inventoryType: str(s.inventoryType, "spectacles"),
        brand: s.brand == null ? null : str(s.brand),
        model: s.model == null ? null : str(s.model),
        color: s.color == null ? null : str(s.color),
        size: s.size == null ? null : str(s.size),
        gender: str(s.gender),
        supplier: s.supplier == null ? null : str(s.supplier),
        quantity: num(s.quantity),
        location: str(s.location, "shop"),
        purchasePrice: num(s.purchasePrice),
        sellingPrice: num(s.sellingPrice),
        description: s.description == null ? null : str(s.description),
        lensIndex: s.lensIndex == null ? null : str(s.lensIndex),
        lensCoating: s.lensCoating == null ? null : str(s.lensCoating),
        sphRight: s.sphRight == null ? null : str(s.sphRight),
        cylRight: s.cylRight == null ? null : str(s.cylRight),
        axisRight: s.axisRight == null ? null : str(s.axisRight),
        sphLeft: s.sphLeft == null ? null : str(s.sphLeft),
        cylLeft: s.cylLeft == null ? null : str(s.cylLeft),
        axisLeft: s.axisLeft == null ? null : str(s.axisLeft),
        addPower: s.addPower == null ? null : str(s.addPower),
        ...stamps(s),
      });
      const history = Array.isArray(s.stockHistory) ? s.stockHistory : [];
      for (const [j, h] of history.entries()) {
        histRows.push({
          id: uuid5(`${DB}::inventories::${hexOf(s._id)}::hist::${j}`),
          inventoryId: id,
          qty: num(h.qty),
          type: str(h.type, "adjust"),
          note: str(h.note),
          by: str(h.by),
          at: date(h.at) ?? new Date(),
        });
      }
    }
    await tx.warehouseInventory.createMany({ data: invRows, skipDuplicates: true });
    log("warehouse_inventory", invRows.length);
    if (histRows.length) {
      await tx.warehouseInventoryMovementHistory.createMany({ data: histRows, skipDuplicates: true });
      log("warehouse_inventory_movement_history", histRows.length);
    }
  }

  // lens stock
  const lensStock = await conn.collection("lensstocks").find().toArray();
  if (lensStock.length) {
    await tx.warehouseLensStock.createMany({
      data: lensStock.map((l: any) => ({
        id: uid("lensstocks", l),
        coating: str(l.coating),
        price: num(l.price),
        priceNeg: num(l.priceNeg),
        pricePos: num(l.pricePos),
        quantities: json(l.quantities, {}),
        ...stamps(l),
      })),
      skipDuplicates: true,
    });
    log("warehouse_lens_stock", lensStock.length);
  }

  // cart items (user -> global user)
  const cart = await conn.collection("cartitems").find().toArray();
  if (cart.length) {
    await tx.cartItem.createMany({
      data: cart.map((c: any) => ({
        id: uid("cartitems", c),
        userId: reqRef(c.user),
        coating: str(c.coating),
        lensType: str(c.lensType),
        powerKey: str(c.powerKey),
        quantity: num(c.quantity, 1),
        price: num(c.price),
        fogMark: str(c.fogMark),
        ...stamps(c),
      })),
      skipDuplicates: true,
    });
    log("cart_items", cart.length);
  }

  // withdrawals (+ items)
  const withdrawals = await conn.collection("withdrawals").find().toArray();
  if (withdrawals.length) {
    const wRows: any[] = [];
    const itemRows: any[] = [];
    for (const w of withdrawals) {
      const id = uid("withdrawals", w);
      wRows.push({
        id,
        userId: reqRef(w.user),
        username: str(w.username),
        totalQuantity: num(w.totalQuantity),
        totalPrice: num(w.totalPrice),
        paid: bool(w.paid),
        paidAt: date(w.paidAt),
        withdrawnAt: date(w.withdrawnAt) ?? new Date(),
        ...stamps(w),
      });
      const items = Array.isArray(w.items) ? w.items : [];
      for (const [j, it] of items.entries()) {
        itemRows.push({
          id: uuid5(`${DB}::withdrawals::${hexOf(w._id)}::item::${j}`),
          withdrawalId: id,
          coating: str(it.coating),
          lensType: str(it.lensType),
          powerKey: str(it.powerKey),
          quantity: num(it.quantity),
          price: num(it.price),
          fogMark: str(it.fogMark),
        });
      }
    }
    await tx.withdrawal.createMany({ data: wRows, skipDuplicates: true });
    log("withdrawals", wRows.length);
    if (itemRows.length) {
      await tx.withdrawalItem.createMany({ data: itemRows, skipDuplicates: true });
      log("withdrawal_items", itemRows.length);
    }
  }

  // fog marks
  const fogMarks = await conn.collection("fogmarks").find().toArray();
  if (fogMarks.length) {
    await tx.fogMark.createMany({
      data: fogMarks.map((f: any) => ({
        id: uid("fogmarks", f),
        name: str(f.name),
        ...stamps(f),
      })),
      skipDuplicates: true,
    });
    log("fog_marks", fogMarks.length);
  }
}

main().catch((err) => {
  console.error("[ETL] FAILED:", err);
  process.exitCode = 1;
});
