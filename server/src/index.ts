import mongoose, { connect, disconnect } from "mongoose";
import { PORT, MONGO_URI, REDIS_URL, NODE_ENV, WAREHOUSE_DB_NAME } from "./config";
import app from "./app";
import { initCache, destroyCache } from "./services/cache";
import { logger } from "./utils/logger";

let server: ReturnType<typeof app.listen> | null = null;

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
    const whConn = mongoose.connection.useDb(WAREHOUSE_DB_NAME);
    const whCollections = ["inventory", "lensstocks", "cartitems", "withdrawals"];
    for (const collName of whCollections) {
      const sourceColl = mongoose.connection.db.collection(collName);
      const targetColl = whConn.collection(collName);
      const sourceCount = await sourceColl.countDocuments();
      const targetCount = await targetColl.countDocuments();
      if (sourceCount > 0 && targetCount === 0) {
        const docs = await sourceColl.find({}).toArray();
        if (docs.length > 0) {
          await targetColl.insertMany(docs);
          logger.info(`Migrated ${docs.length} documents from ${collName} to ${WAREHOUSE_DB_NAME}`);
        }
      }
    }
  } catch (e: any) {
    logger.warn("Could not migrate warehouse data", { error: e?.message });
  }

  if (REDIS_URL) {
    try {
      const redis = initCache(REDIS_URL);
      await redis.connect();
    } catch (err) {
      logger.warn("Redis connection failed, caching disabled", { error: (err as Error).message });
    }
  }

  server = app.listen(PORT, () => {
    logger.info(`KMJ Optical ERP Server [${NODE_ENV}] started`, {
      port: PORT,
      api: `http://localhost:${PORT}/api`,
      client: `http://localhost:${PORT}`,
      warehouse: `http://localhost:${PORT}/warehouse`,
    });
  });

  if (NODE_ENV === "production") {
    setInterval(() => {
      fetch(`http://localhost:${PORT}/api/health`).catch(() => {});
    }, 10 * 60 * 1000);
  }
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
