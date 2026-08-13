import mongoose from "mongoose";
import dotenv from "dotenv";
import { WAREHOUSE_DB_NAME } from "../config";

dotenv.config();

const HALVE_MARKER = "halve-lens-stock";
const MARKER = "double-lens-stock";
const LENS_TYPES = ["sph", "cyl", "compound"];

async function doubleQuantities(collection: mongoose.Collection) {
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
        const d = Math.floor(v * 2);
        if (d !== v) {
          map[key] = d;
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

async function doubleCartItems(collection: mongoose.Collection) {
  const docs = await collection.find({}).toArray();
  let updated = 0;
  for (const doc of docs) {
    const v = Number(doc.quantity);
    if (!Number.isFinite(v) || v <= 0) continue;
    const d = Math.floor(v * 2);
    if (d !== v) {
      await collection.updateOne({ _id: doc._id }, { $set: { quantity: d } });
      updated++;
    }
  }
  return updated;
}

async function doubleWithdrawals(collection: mongoose.Collection) {
  const docs = await collection.find({}).toArray();
  let updated = 0;
  for (const doc of docs) {
    const items = Array.isArray(doc.items) ? doc.items : [];
    if (items.length === 0) continue;
    let changed = false;
    let totalQuantity = 0;
    const nextItems = items.map((it: any) => {
      const v = Number(it.quantity) || 0;
      const d = Math.floor(v * 2);
      if (d !== v) changed = true;
      totalQuantity += d;
      return { ...it, quantity: d };
    });
    if (changed) {
      // totalPrice is left unchanged: it already equals pairs x price
      // (money), while quantity is now the whole lens count.
      await collection.updateOne(
        { _id: doc._id },
        { $set: { items: nextItems, totalQuantity } }
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

  const halved = await db.collection("migration_runs").findOne({ name: HALVE_MARKER });
  if (!halved) {
    console.error(
      `Migration "${HALVE_MARKER}" has not run on this database. ` +
        "Refusing to double — data would be corrupted. Use --force to override."
    );
    await mongoose.disconnect();
    process.exit(1);
  }

  const report: string[] = [];

  // Warehouse DB
  const wh = mongoose.connection.useDb(WAREHOUSE_DB_NAME);
  report.push(
    `warehouse lensstocks: ${await doubleQuantities(wh.collection("lensstocks"))} updated`
  );
  report.push(
    `warehouse cartitems: ${await doubleCartItems(wh.collection("cartitems"))} updated`
  );
  report.push(
    `warehouse withdrawals: ${await doubleWithdrawals(wh.collection("withdrawals"))} updated`
  );

  // Branch DBs
  const branches = await db.collection("branches").find({}).toArray();
  for (const branch of branches) {
    const dbName = branch.dbName;
    if (!dbName) continue;
    const conn = mongoose.connection.useDb(dbName);
    report.push(
      `${dbName} lensstocks: ${await doubleQuantities(conn.collection("lensstocks"))} updated`
    );
    report.push(
      `${dbName} shopcartitems: ${await doubleCartItems(conn.collection("shopcartitems"))} updated`
    );
    report.push(
      `${dbName} shoplenswithdrawals: ${await doubleWithdrawals(conn.collection("shoplenswithdrawals"))} updated`
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
