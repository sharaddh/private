import mongoose, { connect, disconnect } from "mongoose";
import bcrypt from "bcrypt";
import { PORT, MONGO_URI, REDIS_URL, NODE_ENV } from "./config";
import app from "./app";
import { initCache, destroyCache } from "./services/cache";
import { User } from "./models/user";
import { Branch } from "./models/branch";
import { getBranchModels } from "./models/db";

let server: ReturnType<typeof app.listen> | null = null;

// Catch Baileys AES-GCM decryption errors from stale/incompatible auth creds.
// Clear the session and restart WhatsApp so a fresh QR scan can begin.
process.on("uncaughtException", async (err) => {
  const msg = err?.message || "";
  if (msg.includes("Unsupported state") || msg.includes("unable to authenticate data")) {
    console.error("WhatsApp: auth decryption failed, clearing stale session:", msg);
    try {
      if (mongoose.connection.db) {
        await mongoose.connection.db.collection("baileys_auth").deleteOne({ _id: "auth_state" as any });
      }
    } catch {}
    // Restart WhatsApp after a short delay
    setTimeout(() => {
      import("./services/whatsapp").then(({ whatsapp }) => {
        whatsapp.reconnect().catch(() => {});
      });
    }, 2000);
    return;
  }
  console.error("Unhandled exception:", err);
  process.exit(1);
});

async function start() {
  if (!MONGO_URI) {
    console.error("MONGO_URI not set");
    process.exit(1);
  }

  try {
    await connect(MONGO_URI, {
      maxPoolSize: 10,
      serverSelectionTimeoutMS: 5000,
      socketTimeoutMS: 45000,
    });
  } catch (err) {
    console.error("MongoDB connection failed:", err);
    process.exit(1);
  }

  // Drop stale unique indexes that block customer creation (MongoDB 8.x rejects
  // duplicate nulls in unique indexes). customerId and mobile were previously
  // unique but the frontend never sends customerId, and mobile allowed empty
  // strings that became null.
  try {
    const customers = mongoose.connection.db.collection("customers");
    const indexes = await customers.indexes();
    for (const idx of indexes) {
      if ((idx.key?.customerId || idx.key?.mobile) && idx.unique) {
        await customers.dropIndex(idx.name);
        console.log("Dropped stale unique index: " + idx.name);
      }
    }
  } catch (e: any) {
    if (!e?.message?.includes?.("index not found")) {
      console.warn("Could not check/drop indexes:", e?.message);
    }
  }

  // Seed default users if none exist
  try {
    const userCount = await User.countDocuments();
    if (userCount === 0) {
      const hash = await bcrypt.hash("admin123", 10);
      await User.create({ username: "admin", passwordHash: hash, name: "Admin", role: "owner" });
      await User.create({ username: "warehouse", passwordHash: hash, name: "Warehouse Staff", role: "warehouse" });
      console.log("  Default users created:");
      console.log("    Owner:     admin / admin123");
      console.log("    Warehouse: warehouse / admin123");
    }
  } catch (e: any) {
    console.warn("Could not seed users:", e?.message);
  }

  // Seed default branch if none exist
  try {
    const branchCount = await Branch.countDocuments();
    if (branchCount === 0) {
      const branch = await Branch.create({
        name: "Govindpuri",
        code: "GVP",
        dbName: "kmj_govindpuri",
        isActive: true,
        settings: { shopName: "KMJ Optical - Govindpuri" },
      });
      console.log(`  Default branch created: ${branch.name} (${branch.code})`);

      // Copy existing collections to branch database
      const branchModels = getBranchModels(branch.dbName);
      const collections = ["customers", "visits", "prescriptions", "orders", "bills", "payments", "inventory", "deliveries", "settings", "todos"];
      for (const collName of collections) {
        const sourceColl = mongoose.connection.db.collection(collName);
        const targetColl = mongoose.connection.useDb(branch.dbName).collection(collName);
        const sourceCount = await sourceColl.countDocuments();
        const targetCount = await targetColl.countDocuments();
        if (sourceCount > 0 && targetCount === 0) {
          const docs = await sourceColl.find({}).toArray();
          await targetColl.insertMany(docs);
          console.log(`    Migrated ${docs.length} documents from ${collName}`);
        }
      }

      // Assign branch to admin user
      await User.updateMany(
        { role: "owner" },
        { $set: { branches: [branch._id] } }
      );
    }
  } catch (e: any) {
    console.warn("Could not seed branch:", e?.message);
  }

  if (REDIS_URL) {
    try {
      const redis = initCache(REDIS_URL);
      await redis.connect();
    } catch {
      // Redis is optional
    }
  }

  // Lazy-init WhatsApp: import and init in background after server starts
  setTimeout(() => {
    import("./services/whatsapp").then(({ whatsapp }) => {
      whatsapp.init().catch(() => {});
    });
  }, 1000);

  server = app.listen(PORT, () => {
    console.log(`\n  KMJ Optical ERP Server [${NODE_ENV}]`);
    console.log(`  API:        http://localhost:${PORT}/api`);
    console.log(`  Client:     http://localhost:${PORT}`);
    console.log(`  Warehouse:  http://localhost:${PORT}/warehouse\n`);
  });
}

async function gracefulShutdown(signal: string) {
  console.log(`\nReceived ${signal}. Starting graceful shutdown...`);
  server?.close();
  await destroyCache().catch(() => {});
  await disconnect().catch(() => {});
  process.exit(0);
}

process.on("SIGTERM", () => gracefulShutdown("SIGTERM"));
process.on("SIGINT", () => gracefulShutdown("SIGINT"));

start().catch((err) => {
  console.error("Failed to start server:", err);
  process.exit(1);
});
