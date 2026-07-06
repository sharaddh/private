import mongoose from "mongoose";
import dotenv from "dotenv";

dotenv.config();

async function migrate() {
  const uri = process.env.MONGO_URI || "";
  if (!uri) {
    console.error("MONGO_URI not set");
    process.exit(1);
  }

  await mongoose.connect(uri, { maxPoolSize: 10 });
  console.log("Connected to MongoDB");

  const db = mongoose.connection.db!;

  // 1. Check if branches already exist
  const branchCount = await db.collection("branches").countDocuments();
  if (branchCount > 0) {
    console.log(`Branches already exist (${branchCount}), skipping seed`);
  } else {
    // Create Govindpuri branch
    const govindpuri = await db.collection("branches").insertOne({
      name: "Govindpuri",
      code: "GVP",
      dbName: "kmj_govindpuri",
      address: "",
      phone: "",
      email: "",
      isActive: true,
      settings: {
        shopName: "KMJ Optical - Govindpuri",
        shopAddress: "",
        shopPhone: "",
        shopEmail: "",
        adminWhatsApp: "",
        logo: "",
      },
      createdAt: new Date(),
      updatedAt: new Date(),
    });
    console.log(`Created branch: Govindpuri (${govindpuri.insertedId})`);
  }

  // 2. Get the Govindpuri branch
  const branch = await db.collection("branches").findOne({ code: "GVP" });
  if (!branch) {
    console.error("Govindpuri branch not found");
    process.exit(1);
  }

  // 3. Copy existing collections to the branch database
  const branchDb = mongoose.connection.useDb(branch.dbName);
  const collections = ["customers", "visits", "prescriptions", "orders", "bills", "payments", "inventory", "deliveries", "settings", "todos"];

  for (const collName of collections) {
    const sourceColl = db.collection(collName);
    const targetColl = branchDb.collection(collName);
    const sourceCount = await sourceColl.countDocuments();
    const targetCount = await targetColl.countDocuments();

    if (sourceCount === 0) {
      console.log(`  ${collName}: no data to migrate`);
      continue;
    }

    if (targetCount > 0) {
      console.log(`  ${collName}: already has ${targetCount} documents, skipping`);
      continue;
    }

    const docs = await sourceColl.find({}).toArray();
    if (docs.length > 0) {
      // Remove _id to let MongoDB generate new ones (or keep them if we want same IDs)
      const result = await targetColl.insertMany(docs);
      console.log(`  ${collName}: migrated ${result.insertedCount} documents`);
    }
  }

  // 4. Update admin user to have access to the Govindpuri branch
  await db.collection("users").updateMany(
    { role: "owner" },
    { $set: { branches: [branch._id] } }
  );
  console.log("  users: updated admin user with branch access");

  console.log("\nMigration complete!");
  await mongoose.disconnect();
}

migrate().catch((err) => {
  console.error("Migration failed:", err);
  process.exit(1);
});
