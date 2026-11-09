import { prisma } from "../db/prisma";
import { logger } from "../utils/logger";
import { initCache, destroyCache } from "../services/cache";
import { REDIS_URL } from "../config";
import { startWhatsAppWorker } from "./worker";

async function main(): Promise<void> {
  await prisma.$connect();
  await prisma.$queryRaw`SELECT 1`;
  if (REDIS_URL) {
    try {
      const redis = initCache(REDIS_URL);
      await redis.connect();
    } catch (err) {
      logger.warn("Redis connection failed in WhatsApp worker", { error: (err as Error).message });
    }
  }
  const stop = startWhatsAppWorker();
  const shutdown = async (signal: string) => {
    logger.info("Stopping WhatsApp worker process", { signal });
    stop();
    await destroyCache().catch(() => {});
    await prisma.$disconnect().catch(() => {});
    process.exit(0);
  };
  process.once("SIGINT", () => void shutdown("SIGINT"));
  process.once("SIGTERM", () => void shutdown("SIGTERM"));
}

main().catch((err) => {
  logger.error("Failed to start WhatsApp worker", { error: err.message, stack: err.stack });
  process.exit(1);
});
