import pino from "pino";
import { LOG_LEVEL, isProduction } from "../config";

const base = pino({
  level: LOG_LEVEL,
  base: { service: "kmj-erp-server" },
  timestamp: pino.stdTimeFunctions.isoTime,
  formatters: {
    level: (label) => ({ level: label }),
  },
  ...(isProduction
    ? {}
    : {
        transport: {
          target: "pino-pretty",
          options: { colorize: true, translateTime: "SYS:standard", ignore: "pid,hostname" },
        },
      }),
});

export const pinoLogger = base;

export interface AuditEntry {
  method: string;
  path: string;
  userId?: string;
  username?: string;
  ip?: string;
  requestId?: string;
}

export const logger = {
  debug(message: string, meta?: Record<string, unknown>): void {
    if (meta) base.debug(meta, message);
    else base.debug(message);
  },

  info(message: string, meta?: Record<string, unknown>): void {
    if (meta) base.info(meta, message);
    else base.info(message);
  },

  warn(message: string, meta?: Record<string, unknown>): void {
    if (meta) base.warn(meta, message);
    else base.warn(message);
  },

  error(message: string, meta?: Record<string, unknown>): void {
    if (meta) base.error(meta, message);
    else base.error(message);
  },

  audit(entry: AuditEntry): void {
    base.info({ event: "audit", ...entry }, "AUDIT");
  },

  child(bindings: Record<string, unknown>) {
    return base.child(bindings);
  },
};
