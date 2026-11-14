import { PrismaClient, Prisma } from "@prisma/client";
import { DATABASE_URL } from "../config";
import { logger } from "../utils/logger";

const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };

/**
 * Neon hands out a pooled endpoint (`...-pooler...`) for Prisma. Without
 * `pgbouncer=true` Prisma uses prepared statements that transaction-mode
 * pooling cannot safely reuse, and without a small `connection_limit` one app
 * instance can exhaust the database's connection budget.
 */
function optimizeDatabaseUrl(raw: string): string {
  if (!raw) return raw;
  try {
    const url = new URL(raw);
    const pooled = /-pooler\./i.test(url.hostname) || /pooler/i.test(url.hostname);
    if (pooled && !url.searchParams.has("pgbouncer")) {
      url.searchParams.set("pgbouncer", "true");
    }
    if (!url.searchParams.has("connection_limit")) {
      url.searchParams.set("connection_limit", pooled ? "3" : "10");
    }
    if (pooled && !url.searchParams.has("pool_timeout")) {
      url.searchParams.set("pool_timeout", "10");
    }
    if (!url.searchParams.has("connect_timeout")) {
      url.searchParams.set("connect_timeout", "10");
    }
    return url.toString();
  } catch {
    return raw;
  }
}

export const prisma =
  globalForPrisma.prisma ??
  new PrismaClient({
    datasources: { db: { url: optimizeDatabaseUrl(DATABASE_URL) } },
    log: process.env.NODE_ENV === "development" ? ["warn", "error"] : ["error"],
  });

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

/**
 * Neon suspends idle computes. The first connection after a suspend can take
 * a few seconds, so a single failed connect should not crash the service and
 * trigger a Render restart loop.
 */
export async function connectDatabase(attempts = 5): Promise<void> {
  let lastError: unknown;
  for (let attempt = 1; attempt <= attempts; attempt += 1) {
    try {
      await prisma.$connect();
      await prisma.$queryRaw`SELECT 1`;
      logger.info("Postgres connection established", { attempt });
      return;
    } catch (err) {
      lastError = err;
      if (attempt < attempts) {
        const delay = Math.min(1000 * attempt, 5000);
        logger.warn("Postgres connection attempt failed; retrying", {
          attempt,
          attempts,
          retryInMs: delay,
          error: (err as Error).message,
        });
        await sleep(delay);
      }
    }
  }
  throw lastError instanceof Error ? lastError : new Error("Postgres connection failed");
}

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = prisma;
}

export { Prisma };
