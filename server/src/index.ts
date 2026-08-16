import os from "os";
import cluster from "cluster";
import { PORT, REDIS_URL, NODE_ENV, ENABLE_CLUSTER, CLUSTER_WORKERS, isProduction } from "./config";
import app from "./app";
import { prisma } from "./db/prisma";
import { initCache, destroyCache } from "./services/cache";
import { logger } from "./utils/logger";

let server: ReturnType<typeof app.listen> | null = null;

async function connectDb(): Promise<void> {
  try {
    await prisma.$connect();
    await prisma.$queryRaw`SELECT 1`;
    logger.info("Postgres connection established");
  } catch (err) {
    logger.error("Postgres connection failed", { error: (err as Error).message });
    process.exit(1);
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
  await connectDb();
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
  await connectDb();

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
