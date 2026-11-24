import { PrismaClient, Prisma } from "@prisma/client";
import { DATABASE_URL } from "../config";
import { logger } from "../utils/logger";
import { getCtx } from "../utils/requestContext";

const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };

function normalizeDatabaseUrl(raw: string): string {
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
    datasources: { db: { url: normalizeDatabaseUrl(DATABASE_URL) } },
    log: [
      { emit: "event", level: "query" },
      ...(process.env.NODE_ENV === "development"
        ? (["warn", "error"] as const)
        : (["error"] as const)),
    ],
  });

const queryInstrumentation = Symbol.for("kmj.prisma.queryInstrumentation");
type InstrumentedPrismaClient = PrismaClient & { [queryInstrumentation]?: true };

function normalizeLabel(value: unknown): string | undefined {
  if (typeof value !== "string") return undefined;
  const label = value.replace(/[^A-Za-z0-9_.:-]/g, "").slice(0, 120);
  return label || undefined;
}

function queryLabel(event: Prisma.QueryEvent): string {
  const extended = event as Prisma.QueryEvent & { model?: unknown; action?: unknown };
  const model = normalizeLabel(extended.model);
  const action = normalizeLabel(extended.action);
  if (model && action) return `${model}.${action}`;
  if (action || model) return (action ?? model) as string;
  return normalizeLabel(event.target) ?? "unknown";
}

function queryOrigin(): "api" | "whatsapp-worker" {
  const lifecycle = process.env.npm_lifecycle_event ?? "";
  const entry = process.argv[1] ?? "";
  return /whatsapp/i.test(lifecycle) || /whatsapp/i.test(entry) ? "whatsapp-worker" : "api";
}

const instrumentedPrisma = prisma as InstrumentedPrismaClient;
const queryEmitter = prisma as unknown as {
  $on(event: "query", callback: (event: Prisma.QueryEvent) => void): void;
};
if (!instrumentedPrisma[queryInstrumentation]) {
  const origin = queryOrigin();
  queryEmitter.$on("query", (event) => {
    logger.info("db.query", {
      event: "db.query",
      label: queryLabel(event),
      duration_ms: event.duration,
      request_id: getCtx()?.requestId,
      origin,
    });
  });
  instrumentedPrisma[queryInstrumentation] = true;
}

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

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
