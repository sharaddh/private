import { connectDatabase, prisma } from "../db/prisma";
import { logger } from "../utils/logger";
import { initCache, destroyCache } from "../services/cache";
import { REDIS_URL } from "../config";
import { classifyError } from "./db-error";
import { startWhatsAppWorker } from "./worker";

async function main(): Promise<void> {
  await connectDatabase();
  if (REDIS_URL) {
    try {
      const redis = initCache(REDIS_URL);
      await redis.connect();
    } catch (err) {
      const error = classifyError(err);
      logger.warn("Redis connection failed in WhatsApp worker", {
        errorCode: error.errorCode,
        errorName: error.errorName,
        classification: error.classification,
      });
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

main().catch((err: unknown) => {
  const error = classifyError(err);
  logger.error("Failed to start WhatsApp worker", {
    errorCode: error.errorCode,
    errorName: error.errorName,
    classification: error.classification,
  });
  process.exit(1);
});
