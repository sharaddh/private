import mongoose from "mongoose";
import dotenv from "dotenv";
import { WAREHOUSE_DB_NAME } from "../config";

dotenv.config();

const MARKER = "halve-lens-stock";
const LENS_TYPES = ["sph", "cyl", "compound"];

function half(v: number): number {
  return Math.round((v / 2) * 2) / 2;
}

async function halveQuantities(collection: mongoose.Collection) {
  const docs = await collection.find({ quantities: { $exists: true } }).toArray();
  let updated = 0;
  for (const doc of docs) {
    const q = doc.quantities || {};
    let changed = false;
    for (const lt of LENS_TYPES) {
      const map = q[lt];
      if (!map || typeof map !== "object") continue;
      for (const key of Object.keys(map)) {
        const v = Number(map[key]);
        if (!Number.isFinite(v) || v <= 0) continue;
        const h = half(v);
        if (h !== v) {
          map[key] = h;
          changed = true;
        }
      }
    }
    if (changed) {
      await collection.updateOne({ _id: doc._id }, { $set: { quantities: q } });
      updated++;
    }
  }
  return updated;
}

async function halveCartItems(collection: mongoose.Collection) {
  const docs = await collection.find({}).toArray();
  let updated = 0;
  for (const doc of docs) {
    const v = Number(doc.quantity);
    if (!Number.isFinite(v) || v <= 0) continue;
    const h = half(v);
    if (h !== v) {
      await collection.updateOne({ _id: doc._id }, { $set: { quantity: h } });
      updated++;
    }
  }
  return updated;
}

async function halveWithdrawals(collection: mongoose.Collection) {
  const docs = await collection.find({}).toArray();
  let updated = 0;
  for (const doc of docs) {
    const items = Array.isArray(doc.items) ? doc.items : [];
    if (items.length === 0) continue;
    let changed = false;
    let totalQuantity = 0;
    let totalPrice = 0;
    const nextItems = items.map((it: any) => {
      const v = Number(it.quantity) || 0;
      const h = half(v);
      if (h !== v) changed = true;
      totalQuantity += h;
      totalPrice += h * (Number(it.price) || 0);
      return { ...it, quantity: h };
    });
    if (changed) {
      await collection.updateOne(
        { _id: doc._id },
        { $set: { items: nextItems, totalQuantity, totalPrice } }
      );
      updated++;
    }
  }
  return updated;
}

async function run() {
  const uri = process.env.MONGO_URI || "";
  if (!uri) {
    console.error("MONGO_URI not set");
    process.exit(1);
  }

  await mongoose.connect(uri, { maxPoolSize: 10 });
  console.log("Connected to MongoDB");

  const db = mongoose.connection.db!;

  const ran = await db.collection("migration_runs").findOne({ name: MARKER });
  if (ran) {
    console.log(`Migration "${MARKER}" already ran at ${ran.runAt}, skipping`);
    await mongoose.disconnect();
    return;
  }

  const report: string[] = [];

  // Warehouse DB
  const wh = mongoose.connection.useDb(WAREHOUSE_DB_NAME);
  report.push(
    `warehouse lensstocks: ${await halveQuantities(wh.collection("lensstocks"))} updated`
  );
  report.push(`warehouse cartitems: ${await halveCartItems(wh.collection("cartitems"))} updated`);
  report.push(
    `warehouse withdrawals: ${await halveWithdrawals(wh.collection("withdrawals"))} updated`
  );

  // Branch DBs
  const branches = await db.collection("branches").find({}).toArray();
  for (const branch of branches) {
    const dbName = branch.dbName;
    if (!dbName) continue;
    const conn = mongoose.connection.useDb(dbName);
    report.push(
      `${dbName} lensstocks: ${await halveQuantities(conn.collection("lensstocks"))} updated`
    );
    report.push(
      `${dbName} shopcartitems: ${await halveCartItems(conn.collection("shopcartitems"))} updated`
    );
    report.push(
      `${dbName} shoplenswithdrawals: ${await halveWithdrawals(conn.collection("shoplenswithdrawals"))} updated`
    );
  }

  await db.collection("migration_runs").insertOne({ name: MARKER, runAt: new Date() });

  for (const line of report) console.log(line);
  console.log(`\nMigration "${MARKER}" complete.`);
  await mongoose.disconnect();
}

run().catch((err) => {
  console.error("Migration failed:", err);
  process.exit(1);
});
