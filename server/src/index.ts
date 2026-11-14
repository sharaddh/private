import os from "os";
import cluster from "cluster";
import { PORT, REDIS_URL, NODE_ENV, ENABLE_CLUSTER, CLUSTER_WORKERS } from "./config";
import app from "./app";
import { connectDatabase, prisma } from "./db/prisma";
import { initCache, destroyCache } from "./services/cache";
import { logger } from "./utils/logger";
import { getWhatsAppConfig } from "./whatsapp/config";
import { startWhatsAppWorker } from "./whatsapp/worker";

let server: ReturnType<typeof app.listen> | null = null;
let stopWhatsAppWorker: (() => void) | null = null;

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
  await connectDatabase();
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

  if (getWhatsAppConfig().workerInline) {
    stopWhatsAppWorker = startWhatsAppWorker();
  }
}

async function runPrimary(): Promise<void> {
  await connectDatabase();

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
  if (stopWhatsAppWorker) {
    stopWhatsAppWorker();
    stopWhatsAppWorker = null;
  }
  if (server) {
    server.close();
    server = null;
  }
  await destroyCache().catch(() => {});
  await prisma.$disconnect().catch(() => {});
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

