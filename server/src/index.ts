import os from "os";
import cluster from "cluster";
import mongoose, { connect, disconnect } from "mongoose";
import {
  PORT,
  MONGO_URI,
  REDIS_URL,
  NODE_ENV,
  WAREHOUSE_DB_NAME,
  ENABLE_CLUSTER,
  CLUSTER_WORKERS,
  isProduction,
} from "./config";
import app from "./app";
import { initCache, destroyCache } from "./services/cache";
import { logger } from "./utils/logger";

const MONGO_OPTIONS = {
  maxPoolSize: 10,
  serverSelectionTimeoutMS: 5000,
  socketTimeoutMS: 45000,
};

let server: ReturnType<typeof app.listen> | null = null;

async function connectMongo(): Promise<void> {
  if (!MONGO_URI) {
    logger.error("MONGO_URI not set");
    process.exit(1);
  }
  try {
    await connect(MONGO_URI, MONGO_OPTIONS);
  } catch (err) {
    logger.error("MongoDB connection failed", { error: (err as Error).message });
    process.exit(1);
  }
}

// One-time startup migrations. Run in the cluster primary only so workers never
// race on index drops or data seeding.
async function runMigrations(): Promise<void> {
  try {
    const customers = mongoose.connection.db!.collection("customers");
    const indexes = await customers.indexes();
    for (const idx of indexes) {
      if ((idx.key?.customerId || idx.key?.mobile) && idx.unique) {
        await customers.dropIndex(idx.name);
        logger.info(`Dropped stale unique index: ${idx.name}`);
      }
    }
  } catch (e: unknown) {
    const msg = (e as Error)?.message;
    if (!msg?.includes?.("index not found")) {
      logger.warn("Could not check/drop indexes", { error: msg });
    }
  }

  try {
    const whConn = mongoose.connection.useDb(WAREHOUSE_DB_NAME);
    const whCollections = ["inventory", "lensstocks", "cartitems", "withdrawals"];
    for (const collName of whCollections) {
      const sourceColl = mongoose.connection.db!.collection(collName);
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
  } catch (e: unknown) {
    logger.warn("Could not migrate warehouse data", { error: (e as Error).message });
  }

  try {
    const whConn = mongoose.connection.useDb(WAREHOUSE_DB_NAME);
    const fogMarkColl = whConn.collection("fogmarks");
    const fogMarkCount = await fogMarkColl.countDocuments();
    if (fogMarkCount === 0) {
      const defaults = ["HD PX", "HD Pixi", "Super"].map((name) => ({
        name,
        createdAt: new Date(),
        updatedAt: new Date(),
      }));
      await fogMarkColl.insertMany(defaults);
      logger.info("Seeded default fog marks");
    }
  } catch (e: unknown) {
    logger.warn("Could not seed fog marks", { error: (e as Error).message });
  }
}

async function initCacheIfConfigured(): Promise<void> {
  if (!REDIS_URL) return;
  try {
    const redis = initCache(REDIS_URL);
    await redis.connect();
  } catch (err) {
    logger.warn("Redis connection failed, caching disabled", { error: (err as Error).message });
  }
}

async function startWorker(): Promise<void> {
  await connectMongo();
  await initCacheIfConfigured();

  server = app.listen(PORT, () => {
    logger.info(`KMJ Optical ERP Server [${NODE_ENV}] started`, {
      port: PORT,
      api: `http://localhost:${PORT}/api`,
      client: `http://localhost:${PORT}`,
      warehouse: `http://localhost:${PORT}/warehouse`,
      pid: process.pid,
      workerId: cluster.isWorker ? cluster.worker?.id : undefined,
    });
  });

  if (isProduction) {
    setInterval(
      () => {
        fetch(`http://localhost:${PORT}/api/health`).catch(() => {});
      },
      10 * 60 * 1000
    );
  }
}

async function runPrimary(): Promise<void> {
  await connectMongo();
  await runMigrations();
  await disconnect().catch(() => {});

  const workerCount = CLUSTER_WORKERS || os.cpus().length;
  logger.info(`Starting cluster with ${workerCount} workers`);
  for (let i = 0; i < workerCount; i++) {
    cluster.fork();
  }

  cluster.on("exit", (worker, code, signal) => {
    logger.warn(`Worker ${worker.process.pid} exited`, { code, signal });
    cluster.fork();
  });
}

async function gracefulShutdown(signal: string): Promise<void> {
  logger.info(`Received ${signal}. Starting graceful shutdown...`, { pid: process.pid });
  if (server) {
    server.close();
    server = null;
  }
  await destroyCache().catch(() => {});
  await disconnect().catch(() => {});
  process.exit(0);
}

process.on("SIGTERM", () => gracefulShutdown("SIGTERM"));
process.on("SIGINT", () => gracefulShutdown("SIGINT"));

async function main(): Promise<void> {
  if (ENABLE_CLUSTER && cluster.isPrimary) {
    await runPrimary();
  } else {
    await startWorker();
  }
}

main().catch((err) => {
  logger.error("Failed to start server", { error: err.message, stack: err.stack });
  process.exit(1);
});
