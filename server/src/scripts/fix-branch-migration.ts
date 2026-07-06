import mongoose from "mongoose";
import dotenv from "dotenv";

dotenv.config();

const BRANCH_COLLECTIONS = [
  "customers", "visits", "prescriptions", "orders", "bills",
  "payments", "inventory", "deliveries", "settings", "todos",
];

async function fix() {
  const uri = process.env.MONGO_URI;
  if (!uri) { console.error("MONGO_URI not set"); process.exit(1); }

  await mongoose.connect(uri, { maxPoolSize: 10 });
  const db = mongoose.connection.db!;

  // 1. Fix Falka Bajar's dbName
  const falka = await db.collection("branches").findOne({ code: "FLK" });
  if (falka && falka.dbName !== "kmj_falke_bajar") {
    console.log(`Fixing Falka Bajar dbName: "${falka.dbName}" -> "kmj_falke_bajar"`);
    await db.collection("branches").updateOne(
      { _id: falka._id },
      { $set: { dbName: "kmj_falke_bajar" } }
    );
  }

  // 2. Get all active branches
  const branches = await db.collection("branches").find({ isActive: true }).toArray();
  console.log(`\nActive branches: ${branches.map((b: any) => `${b.name} (${b.dbName})`).join(", ")}`);

  // 3. Show status of all branch databases vs kmj
  console.log("\n=== DATA STATUS ===");
  const kmjCounts: Record<string, number> = {};
  for (const coll of BRANCH_COLLECTIONS) {
    kmjCounts[coll] = await db.collection(coll).countDocuments();
  }
  console.log("kmj database:", Object.entries(kmjCounts).filter(([_, c]) => c > 0).map(([n, c]) => `${n}=${c}`).join(", ") || "(empty)");

  const globalKmjHasData = Object.values(kmjCounts).some(c => c > 0);

  for (const branch of branches) {
    const branchDb = mongoose.connection.useDb(branch.dbName);
    const counts: Record<string, number> = {};
    for (const coll of BRANCH_COLLECTIONS) {
      counts[coll] = await branchDb.collection(coll).countDocuments();
    }
    const hasData = Object.values(counts).some(c => c > 0);
    console.log(`${branch.name} (${branch.dbName}):`, hasData
      ? Object.entries(counts).filter(([_, c]) => c > 0).map(([n, c]) => `${n}=${c}`).join(", ")
      : "(empty)");
  }

  // 4. Migrate
  console.log("\n=== MIGRATION ===");
  for (const branch of branches) {
    const branchDb = mongoose.connection.useDb(branch.dbName);

    for (const collName of BRANCH_COLLECTIONS) {
      const sourceColl = db.collection(collName);
      const targetColl = branchDb.collection(collName);
      const sourceCount = await sourceColl.countDocuments();
      const targetCount = await targetColl.countDocuments();

      if (targetCount === 0 && sourceCount > 0) {
        const docs = await sourceColl.find({}).toArray();
        await targetColl.insertMany(docs);
        console.log(`  ${branch.name} / ${collName}: migrated ${docs.length} docs from kmj`);
      }
    }
  }

  // 5. Cleanup kmj database
  if (globalKmjHasData) {
    console.log("\n=== CLEANUP ===");
    for (const collName of BRANCH_COLLECTIONS) {
      const count = await db.collection(collName).countDocuments();
      if (count > 0) {
        await db.collection(collName).drop();
        console.log(`  Dropped kmj.${collName} (${count} docs)`);
      }
    }
    console.log("  kmj database cleaned - only branches, users, baileys_auth remain");
  }

  console.log("\n✓ Migration complete!");
  await mongoose.disconnect();
}

fix().catch((err) => {
  console.error("Migration failed:", err);
  process.exit(1);
});
