export type ErrorClassification = "transient_db" | "other" | "none";

export interface ClassifiedError {
  errorCode: string | null;
  errorName: string | null;
  classification: ErrorClassification;
}

const TRANSIENT_DB_CODES = new Set(["P1001", "P1002", "P1008", "P1017", "P2024"]);

export function classifyError(error: unknown): ClassifiedError {
  if (!error || typeof error !== "object") {
    return { errorCode: null, errorName: null, classification: "other" };
  }

  const candidate = error as { name?: unknown; code?: unknown };
  const errorName = typeof candidate.name === "string" && candidate.name ? candidate.name : null;
  const errorCode = typeof candidate.code === "string" ? candidate.code : null;
  const transientDb =
    errorName === "PrismaClientInitializationError" ||
    (errorCode !== null && TRANSIENT_DB_CODES.has(errorCode));

  return {
    errorCode,
    errorName,
    classification: transientDb ? "transient_db" : "other",
  };
}

export function isTransientDbError(error: unknown): boolean {
  return classifyError(error).classification === "transient_db";
}
