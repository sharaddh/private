type LogLevel = "debug" | "info" | "warn" | "error";

const LEVEL_PRIORITY: Record<LogLevel, number> = {
  debug: 0,
  info: 1,
  warn: 2,
  error: 3,
};

const MIN_LEVEL: LogLevel = (process.env.LOG_LEVEL as LogLevel) || "info";

function shouldLog(level: LogLevel): boolean {
  return LEVEL_PRIORITY[level] >= LEVEL_PRIORITY[MIN_LEVEL];
}

function formatTimestamp(): string {
  return new Date().toISOString();
}

function formatMessage(level: LogLevel, message: string, meta?: Record<string, unknown>): string {
  const base = `[${formatTimestamp()}] [${level.toUpperCase()}] ${message}`;
  if (meta && Object.keys(meta).length > 0) {
    return `${base} ${JSON.stringify(meta)}`;
  }
  return base;
}

export const logger = {
  debug(message: string, meta?: Record<string, unknown>): void {
    if (shouldLog("debug")) console.debug(formatMessage("debug", message, meta));
  },

  info(message: string, meta?: Record<string, unknown>): void {
    if (shouldLog("info")) console.log(formatMessage("info", message, meta));
  },

  warn(message: string, meta?: Record<string, unknown>): void {
    if (shouldLog("warn")) console.warn(formatMessage("warn", message, meta));
  },

  error(message: string, meta?: Record<string, unknown>): void {
    if (shouldLog("error")) console.error(formatMessage("error", message, meta));
  },

  audit(entry: {
    method: string;
    path: string;
    userId?: string;
    username?: string;
    ip?: string;
    requestId?: string;
  }): void {
    if (shouldLog("info")) {
      console.log(formatMessage("info", "AUDIT", entry as unknown as Record<string, unknown>));
    }
  },
};
