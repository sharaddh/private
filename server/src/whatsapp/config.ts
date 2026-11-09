export type WhatsAppProviderMode = "mock" | "meta";

function env(name: string): string {
  return (process.env[name] || "").trim();
}

function boolEnv(name: string): boolean {
  return /^(1|true|yes|on)$/i.test(env(name));
}

function intEnv(name: string, fallback: number, min = 1, max = 100): number {
  const parsed = Number.parseInt(env(name), 10);
  if (!Number.isFinite(parsed)) return fallback;
  return Math.min(max, Math.max(min, parsed));
}

export interface WhatsAppConfig {
  provider: WhatsAppProviderMode;
  graphApiVersion: string;
  accessToken: string;
  phoneNumberId: string;
  wabaId: string;
  appSecret: string;
  webhookVerifyToken: string;
  webhookPublicUrl: string;
  defaultCountryCode: string;
  sendEnabled: boolean;
  campaignSendEnabled: boolean;
  maxWorkerConcurrency: number;
  queueName: string;
  workerPollMs: number;
  workerInline: boolean;
  maxAttempts: number;
  workerWindowEnabled: boolean;
  workerWindowStart: number;
  workerWindowEnd: number;
  workerWindowTimezone: string;
}

export function getWhatsAppConfig(): WhatsAppConfig {
  const provider = env("WHATSAPP_PROVIDER").toLowerCase() === "meta" ? "meta" : "mock";
  return {
    provider,
    // One configurable place; the Graph version must never be hard-coded in
    // individual API calls.
    graphApiVersion: env("META_GRAPH_API_VERSION") || "v23.0",
    accessToken: env("META_ACCESS_TOKEN"),
    phoneNumberId: env("META_PHONE_NUMBER_ID"),
    wabaId: env("META_WABA_ID"),
    appSecret: env("META_APP_SECRET"),
    webhookVerifyToken: env("META_WEBHOOK_VERIFY_TOKEN"),
    webhookPublicUrl: env("WHATSAPP_WEBHOOK_PUBLIC_URL"),
    defaultCountryCode: env("WHATSAPP_DEFAULT_COUNTRY_CODE") || "91",
    sendEnabled: boolEnv("WHATSAPP_SEND_ENABLED"),
    campaignSendEnabled: boolEnv("WHATSAPP_CAMPAIGN_SEND_ENABLED"),
    maxWorkerConcurrency: intEnv("WHATSAPP_MAX_WORKER_CONCURRENCY", 1, 1, 20),
    queueName: env("WHATSAPP_QUEUE_NAME") || "whatsapp-notifications",
    workerPollMs: intEnv("WHATSAPP_WORKER_POLL_MS", 5000, 1000, 60000),
    workerInline: boolEnv("WHATSAPP_WORKER_INLINE"),
    maxAttempts: intEnv("WHATSAPP_MAX_ATTEMPTS", 5, 1, 10),
    workerWindowEnabled: boolEnv("WHATSAPP_WORKER_WINDOW_ENABLED"),
    workerWindowStart: intEnv("WHATSAPP_WORKER_WINDOW_START", 9, 0, 23),
    workerWindowEnd: intEnv("WHATSAPP_WORKER_WINDOW_END", 21, 0, 23),
    workerWindowTimezone: env("WHATSAPP_WORKER_TIMEZONE") || "Asia/Kolkata",
  };
}

function minutesInTimezone(now: Date, timeZone: string): number {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone,
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).formatToParts(now);
  const hour = Number(parts.find((part) => part.type === "hour")?.value ?? "0");
  const minute = Number(parts.find((part) => part.type === "minute")?.value ?? "0");
  return hour * 60 + minute;
}

/**
 * The worker window keeps Neon/Postgres from being queried around the clock.
 * When disabled (default) the worker runs continuously.
 */
export function isWorkerWindowOpen(
  cfg = getWhatsAppConfig(),
  now = new Date()
): boolean {
  if (!cfg.workerWindowEnabled) return true;
  const start = cfg.workerWindowStart * 60;
  const end = cfg.workerWindowEnd * 60;
  if (start === end) return true;
  const current = minutesInTimezone(now, cfg.workerWindowTimezone);
  return start < end
    ? current >= start && current < end
    : current >= start || current < end;
}

export function isMetaConfigured(cfg = getWhatsAppConfig()): boolean {
  return Boolean(
    cfg.accessToken &&
      cfg.phoneNumberId &&
      cfg.wabaId &&
      cfg.appSecret &&
      cfg.webhookVerifyToken
  );
}

export function getConfigStatus() {
  const cfg = getWhatsAppConfig();
  const missing: string[] = [];
  if (cfg.provider !== "meta") {
    return {
      provider: cfg.provider,
      providerConfigured: true,
      missing: [] as string[],
      webhookPublicUrlSet: Boolean(cfg.webhookPublicUrl),
      sendEnabled: cfg.sendEnabled,
      campaignSendEnabled: cfg.campaignSendEnabled,
      workerPollMs: cfg.workerPollMs,
      maxWorkerConcurrency: cfg.maxWorkerConcurrency,
      workerWindowEnabled: cfg.workerWindowEnabled,
      workerWindowStart: cfg.workerWindowStart,
      workerWindowEnd: cfg.workerWindowEnd,
      workerWindowTimezone: cfg.workerWindowTimezone,
    };
  }
  if (!cfg.accessToken) missing.push("META_ACCESS_TOKEN");
  if (!cfg.phoneNumberId) missing.push("META_PHONE_NUMBER_ID");
  if (!cfg.wabaId) missing.push("META_WABA_ID");
  if (!cfg.appSecret) missing.push("META_APP_SECRET");
  if (!cfg.webhookVerifyToken) missing.push("META_WEBHOOK_VERIFY_TOKEN");
  return {
    provider: cfg.provider,
    providerConfigured: missing.length === 0,
    missing,
    webhookPublicUrlSet: Boolean(cfg.webhookPublicUrl),
    sendEnabled: cfg.sendEnabled,
    campaignSendEnabled: cfg.campaignSendEnabled,
    workerPollMs: cfg.workerPollMs,
    maxWorkerConcurrency: cfg.maxWorkerConcurrency,
    workerWindowEnabled: cfg.workerWindowEnabled,
    workerWindowStart: cfg.workerWindowStart,
    workerWindowEnd: cfg.workerWindowEnd,
    workerWindowTimezone: cfg.workerWindowTimezone,
  };
}

/** Never includes secret values. */
export function assertProviderReady(): void {
  const cfg = getWhatsAppConfig();
  if (cfg.provider === "meta" && !isMetaConfigured(cfg)) {
    throw new Error("Meta WhatsApp is not configured");
  }
}
