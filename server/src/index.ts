import mongoose, { connect, disconnect } from "mongoose";
import bcrypt from "bcrypt";
import { PORT, MONGO_URI, REDIS_URL, NODE_ENV } from "./config";
import app from "./app";
import { initCache, destroyCache } from "./services/cache";
import { User } from "./models/user";
import { Branch } from "./models/branch";
import { getBranchModels } from "./models/db";
import { logger } from "./utils/logger";

let server: ReturnType<typeof app.listen> | null = null;

process.on("uncaughtException", async (err) => {
  const msg = err?.message || "";
  if (msg.includes("Unsupported state") || msg.includes("unable to authenticate data")) {
    logger.error("WhatsApp: auth decryption failed, clearing stale sessions");
    try {
      const { whatsappManager } = await import("./services/whatsapp");
      await whatsappManager.clearAllStaleAuth();
    } catch {}
    setTimeout(async () => {
      const { whatsappManager } = await import("./services/whatsapp");
      const branches = await Branch.find({ isActive: true }).lean();
      const branchKeys = branches.map((b) => (b as any)._id.toString());
      if (branchKeys.length > 0) {
        await whatsappManager.initAll(branchKeys).catch((err) => logger.error(`WhatsApp initAll after restart failed: ${err?.message || err}`));
      } else {
        const def = whatsappManager.getInstance();
        await def.init().catch((err) => logger.error(`WhatsApp default init after restart failed: ${err?.message || err}`));
      }
    }, 2000);
    return;
  }
  logger.error("Unhandled exception", { message: err.message, stack: err.stack });
  process.exit(1);
});

async function start() {
  if (!MONGO_URI) {
    logger.error("MONGO_URI not set");
    process.exit(1);
  }

  try {
    await connect(MONGO_URI, {
      maxPoolSize: 10,
      serverSelectionTimeoutMS: 5000,
      socketTimeoutMS: 45000,
    });
  } catch (err) {
    logger.error("MongoDB connection failed", { error: (err as Error).message });
    process.exit(1);
  }

  try {
    const customers = mongoose.connection.db.collection("customers");
    const indexes = await customers.indexes();
    for (const idx of indexes) {
      if ((idx.key?.customerId || idx.key?.mobile) && idx.unique) {
        await customers.dropIndex(idx.name);
        logger.info(`Dropped stale unique index: ${idx.name}`);
      }
    }
  } catch (e: any) {
    if (!e?.message?.includes?.("index not found")) {
      logger.warn("Could not check/drop indexes", { error: e?.message });
    }
  }

  try {
    const userCount = await User.countDocuments();
    if (userCount === 0) {
      const hash = await bcrypt.hash("admin123", 10);
      await User.create({ username: "admin", passwordHash: hash, name: "Admin", role: "owner" });
      await User.create({ username: "warehouse", passwordHash: hash, name: "Warehouse Staff", role: "warehouse" });
      logger.info("Default users created (Owner: admin / ***admin123, Warehouse: warehouse / ***admin123)");
    }
  } catch (e: any) {
    logger.warn("Could not seed users", { error: e?.message });
  }

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
      logger.info(`Default branch created: ${branch.name} (${branch.code})`);

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
          logger.info(`Migrated ${docs.length} documents from ${collName}`);
        }
      }

      await User.updateMany(
        { role: "owner" },
        { $set: { branches: [branch._id] } }
      );
    }
  } catch (e: any) {
    logger.warn("Could not seed branch", { error: e?.message });
  }

  if (REDIS_URL) {
    try {
      const redis = initCache(REDIS_URL);
      await redis.connect();
    } catch {}
  }

  async function initBranchWhatsApps() {
    try {
      const { whatsappManager } = await import("./services/whatsapp");
      const branches = await Branch.find({ isActive: true }).lean();
      const branchKeys = branches.map((b) => (b as any)._id.toString());
      if (branchKeys.length > 0) {
        logger.info(`WhatsApp: initializing for ${branchKeys.length} branch(es)...`);
        await whatsappManager.initAll(branchKeys);
      } else {
        const def = whatsappManager.getInstance();
        await def.init().catch(() => {});
      }
    } catch (e) {
      logger.error("WhatsApp init failed", { error: (e as Error).message });
    }
  }

  setTimeout(() => {
    initBranchWhatsApps();
  }, 1000);

  server = app.listen(PORT, () => {
    logger.info(`KMJ Optical ERP Server [${NODE_ENV}] started`, {
      port: PORT,
      api: `http://localhost:${PORT}/api`,
      client: `http://localhost:${PORT}`,
      warehouse: `http://localhost:${PORT}/warehouse`,
    });
  });
}

async function gracefulShutdown(signal: string) {
  logger.info(`Received ${signal}. Starting graceful shutdown...`);
  server?.close();
  await destroyCache().catch(() => {});
  await disconnect().catch(() => {});
  process.exit(0);
}

process.on("SIGTERM", () => gracefulShutdown("SIGTERM"));
process.on("SIGINT", () => gracefulShutdown("SIGINT"));

start().catch((err) => {
  logger.error("Failed to start server", { error: err.message, stack: err.stack });
  process.exit(1);
});
