import makeWASocket, {
  DisconnectReason,
  AuthenticationState,
  AuthenticationCreds,
  SignalKeyStore,
  initAuthCreds,
  BufferJSON,
  Browsers,
  fetchLatestBaileysVersion,
} from "@whiskeysockets/baileys";
import * as QR from "qrcode";
import { Buffer } from "buffer";
import mongoose from "mongoose";

interface QueuedMessage {
  type: "text";
  phone: string;
  message: string;
}

interface QueuedMedia {
  type: "media";
  phone: string;
  base64: string;
  filename: string;
  mimetype: string;
  caption?: string;
}

type QueueItem = QueuedMessage | QueuedMedia;

import { normalizePhone, toWhatsAppJID as toJID, isValidWhatsAppPhone } from "../utils/phone";

async function useMongoDBAuthState(collectionName: string): Promise<{
  state: AuthenticationState;
  saveCreds: () => Promise<void>;
}> {
  const db = mongoose.connection.db;
  if (!db) throw new Error("MongoDB not connected");
  const collection = db.collection(collectionName);

  const saved = await collection.findOne({ _id: "auth_state" as any });
  let creds: AuthenticationCreds;
  let keysData: Record<string, Record<string, any>> = {};

  if (saved) {
    const raw = saved as any;
    creds = JSON.parse(JSON.stringify(raw.creds), BufferJSON.reviver);
    keysData = JSON.parse(JSON.stringify(raw.keys || {}), BufferJSON.reviver);
  } else {
    creds = initAuthCreds();
  }

  const keys: SignalKeyStore = {
    get: async (type, ids) => {
      const typeData = keysData[type] || {};
      const result: Record<string, any> = {};
      for (const id of ids) result[id] = typeData[id];
      return result;
    },
    set: async (data) => {
      for (const [type, entries] of Object.entries(data)) {
        if (!keysData[type]) keysData[type] = {};
        for (const [id, value] of Object.entries(entries as Record<string, any>)) {
          keysData[type][id] = value;
        }
      }
    },
  };

  const saveCreds = async () => {
    try {
      await collection.updateOne(
        { _id: "auth_state" as any },
        {
          $set: {
            creds: JSON.parse(JSON.stringify(creds, BufferJSON.replacer)),
            keys: JSON.parse(JSON.stringify(keysData, BufferJSON.replacer)),
            updatedAt: new Date(),
          },
        },
        { upsert: true }
      );
    } catch (e) {
      console.error(`WhatsApp [${collectionName}]: failed to save auth state to MongoDB:`, e);
    }
  };

  return { state: { creds, keys }, saveCreds };
}

// Fallback WA Web version. Updated dynamically via fetchLatestBaileysVersion().
const FALLBACK_WA_VERSION: [number, number, number] = [2, 3000, 1035194821];

const QR_TIMEOUT_MS = 120000;
const MAX_RECONNECT_ATTEMPTS = 15;
const RECONNECT_BASE_DELAY = 5000;
const HEALTH_CHECK_INTERVAL_MS = 60000;
const MAX_RECONNECT_DELAY = 300000;

export function shouldResetSessionForError(err: string | undefined): boolean {
  const lower = (err || "").toLowerCase();
  return (
    lower.includes("not authorized") ||
    lower.includes("session expired") ||
    lower.includes("unauthorized") ||
    lower.includes("bad session") ||
    lower.includes("logged out") ||
    lower.includes("restart required") ||
    lower.includes("missing creds") ||
    lower.includes("no such user") ||
    lower.includes("decode failed") ||
    lower.includes("item-not-found") ||
    lower.includes("invalid session")
  );
}

class WhatsAppService {
  private sock: ReturnType<typeof makeWASocket> | null = null;
  private _ready = false;
  private _qr: string | null = null;
  private _qrBase64: string | null = null;
  private _error: string | null = null;
  private _pairingCode: string | null = null;
  private initializing = false;
  private initPromise: Promise<void> | null = null;
  private initGen = 0;
  private messageQueue: QueueItem[] = [];
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null;
  private reconnectAttempts = 0;
  private drainInProgress = false;
  private saveCredsFn: (() => Promise<void>) | null = null;
  private _broadcastAborted = false;
  private authCollection: string;
  private healthCheckTimer: ReturnType<typeof setInterval> | null = null;
  private _lastActivityAt = 0;
  private _deliveryLog: Array<{ phone: string; status: string; timestamp: number; messageKey?: string }> = [];
  private _deliveryLogMax = 50;

  constructor(branchKey: string) {
    this.authCollection = branchKey ? `baileys_auth_${branchKey}` : "baileys_auth";
  }

  get ready() { return this._ready; }
  get qr() { return this._qr; }
  get qrBase64() { return this._qrBase64; }
  get error() { return this._error; }
  get pairingCode() { return this._pairingCode; }
  get queueLength() { return this.messageQueue.length; }

  getConnectedPhone(): string | null {
    try {
      const id = (this.sock as any)?.user?.id;
      if (id) return id.split(":")[0].replace(/@.*/, "");
    } catch {}
    return null;
  }

  private isSessionError(errMsg: string): boolean {
    return shouldResetSessionForError(errMsg);
  }

  private async handleSendFailure(errMsg: string): Promise<void> {
    if (this.isSessionError(errMsg) && this._ready) {
      console.log(`WhatsApp [${this.authCollection}]: stale session detected, reconnecting: ${errMsg}`);
      this._ready = false;
      this.cancelReconnect();
      this.stopHealthCheck();
      try {
        const db = mongoose.connection.db;
        if (db) await db.collection(this.authCollection).deleteOne({ _id: "auth_state" as any });
      } catch {}
      this.sock = null;
      this.initializing = false;
      this.initPromise = null;
      this._error = "Session invalidated, reconnecting...";
      setTimeout(() => {
        this.init().catch((err) =>
          console.error(`WhatsApp [${this.authCollection}] reconnect after session error failed:`, err)
        );
      }, 2000);
    }
  }

  async init() {
    if (this.initializing) return this.initPromise;
    if (this.sock && this._ready) return;
    if (this.sock && !this._ready) {
      try { this.sock.end(new Error("Reinit: stale socket")); } catch {}
      this.sock = null;
    }
    this.initializing = true;
    const gen = ++this.initGen;

    this.initPromise = this.doInit().finally(() => {
      if (gen === this.initGen) {
        this.initializing = false;
        this.initPromise = null;
      }
    });

    return this.initPromise;
  }

  private async doInit(): Promise<void> {
    try {
      await this.tryInit();
      console.log(`WhatsApp [${this.authCollection}]: connected successfully`);
    } catch (err: any) {
      const msg = err?.message || "Failed to connect to WhatsApp";
      if (msg === "RESTART_REQUIRED") {
        console.log(`WhatsApp [${this.authCollection}]: pairing complete, restarting with saved session`);
        this.initializing = false;
        this.initPromise = null;
        await this.init();
        return;
      }
      console.error(`WhatsApp [${this.authCollection}] init failed:`, msg);
      this._error = msg;
      if (!this._ready) {
        this.scheduleReconnect();
      }
    }
  }

  private async tryInit(): Promise<void> {
    const { state, saveCreds } = await useMongoDBAuthState(this.authCollection);
    this.saveCredsFn = saveCreds;

    const isLoggedIn = !!state.creds.me?.id;

    // Fetch latest Baileys version with retry + fallback
    let waVersion = FALLBACK_WA_VERSION;
    for (let attempt = 0; attempt < 3; attempt++) {
      try {
        const { version } = await fetchLatestBaileysVersion();
        waVersion = version;
        break;
      } catch (err: any) {
        if (attempt < 2) {
          console.log(`WhatsApp [${this.authCollection}]: version fetch attempt ${attempt + 1} failed, retrying in 2s...`);
          await new Promise((r) => setTimeout(r, 2000));
        } else {
          console.log(`WhatsApp [${this.authCollection}]: using fallback WA version`, FALLBACK_WA_VERSION);
        }
      }
    }

    return new Promise<void>((resolve, reject) => {
      let qrTimer: ReturnType<typeof setTimeout> | null = null;
      let resolved = false;

      if (isLoggedIn) {
        console.log(`WhatsApp [${this.authCollection}]: found existing session for`, state.creds.me?.id);
      }

      const sock = makeWASocket({
        auth: state,
        version: waVersion,
        printQRInTerminal: false,
        browser: Browsers.macOS("Chrome"),
        syncFullHistory: false,
        markOnlineOnConnect: true,
        emitOwnEvents: false,
        generateHighQualityLinkPreview: false,
        keepAliveIntervalMs: 30000,
        connectTimeoutMs: 120000,
        defaultQueryTimeoutMs: 120000,
        transactionOpts: { maxCommitRetries: 3, delayBetweenTriesMs: 10000 },
      });

      this.sock = sock;

      const onConnectionUpdate = async (update: any) => {
        const { connection, lastDisconnect, qr, isNewLogin } = update;

        if (qr && !resolved) {
          this._qr = qr;
          this._ready = false;
          this._error = null;
          this._pairingCode = null;
          try {
            this._qrBase64 = await QR.toDataURL(qr);
          } catch {
            this._qrBase64 = null;
          }
          if (!qrTimer) {
            qrTimer = setTimeout(() => {
              if (!resolved) {
                resolved = true;
                console.log(`WhatsApp [${this.authCollection}]: QR timeout — no connection within ${QR_TIMEOUT_MS / 1000}s`);
                try {
                  sock.ev.removeAllListeners("connection.update");
                  sock.ev.removeAllListeners("creds.update");
                } catch {}
                sock.end(new Error("QR timeout"));
                reject(new Error("QR timeout after " + (QR_TIMEOUT_MS / 1000) + "s"));
              }
            }, QR_TIMEOUT_MS);
          }
          console.log(`WhatsApp [${this.authCollection}]: QR code generated`);
        }

        if (isNewLogin) {
          console.log(`WhatsApp [${this.authCollection}]: new login detected, saving creds`);
          if (this.saveCredsFn) await this.saveCredsFn();
        }

        if (connection === "open") {
          if (resolved) return;
          this._ready = true;
          this._qr = null;
          this._qrBase64 = null;
          this._error = null;
          this._pairingCode = null;
          this.reconnectAttempts = 0;
          this._lastActivityAt = Date.now();
          if (qrTimer) clearTimeout(qrTimer);
          console.log(`WhatsApp [${this.authCollection}]: connected!`);
          this.startHealthCheck();
          this.drainQueue();
          if (!resolved) {
            resolved = true;
            resolve();
          }
        }

        if (connection === "close") {
          const wasReady = this._ready;
          this._ready = false;

          const statusCode = lastDisconnect?.error?.output?.statusCode;
          const reason = statusCode !== undefined ? (DisconnectReason as any)[statusCode] || "Unknown" : "Unknown";
          const errMsg = lastDisconnect?.error?.message || lastDisconnect?.error?.toString() || "no error";
          const errStack = lastDisconnect?.error?.stack || "";

          console.log(`WhatsApp [${this.authCollection}]: connection closed`, {
            reason,
            statusCode,
            wasReady,
            resolved,
            errMsg,
            errStack: errStack.split("\n")[0],
          });

          if (statusCode === DisconnectReason.restartRequired) {
            this.cancelReconnect();
            if (qrTimer) clearTimeout(qrTimer);
            if (this.saveCredsFn) {
              try { await this.saveCredsFn(); } catch (e) {
                console.error(`WhatsApp [${this.authCollection}]: failed to save creds before restart`, e);
              }
            }
            if (this.sock) {
              try {
                this.sock.ev.removeAllListeners("connection.update");
                this.sock.ev.removeAllListeners("creds.update");
              } catch (e) { /* listener removal is best-effort */ }
            }
            this.sock = null;
            this._qr = null;
            this._qrBase64 = null;
            if (!resolved) {
              resolved = true;
              reject(new Error("RESTART_REQUIRED"));
            }
            return;
          }

          this.sock = null;

          const needsReAuth =
            statusCode === DisconnectReason.loggedOut ||
            statusCode === DisconnectReason.badSession ||
            shouldResetSessionForError(errMsg);

          if (needsReAuth) {
            console.log(`WhatsApp [${this.authCollection}]: ${reason}, clearing session for re-auth`);
            try {
              const db = mongoose.connection.db;
              if (db) await db.collection(this.authCollection).deleteOne({ _id: "auth_state" as any });
            } catch (e) { /* auth_state cleanup is best-effort */ }
          } else {
            console.log(`WhatsApp [${this.authCollection}]: transient disconnect detected, scheduling reconnect without clearing session`);
            this.scheduleReconnect();
          }

          if (!resolved) {
            console.log(`WhatsApp [${this.authCollection}]: connection closed before auth completed, scheduling reconnect`);
            this.scheduleReconnect();
          }

          if (qrTimer) clearTimeout(qrTimer);

          if (!resolved) {
            resolved = true;
            reject(new Error("Connection closed: " + reason + " — " + errMsg));
          }
        }
      };

      sock.ev.on("connection.update", onConnectionUpdate);

      sock.ev.on("creds.update", async () => {
        if (this.saveCredsFn) await this.saveCredsFn();
      });

      sock.ev.on("messages.update", (updates: any[]) => {
        for (const update of updates) {
          const status = update.update?.status;
          const key = update.key;
          if (status && key?.remoteJid) {
            const phone = key.remoteJid.replace(/@.*/, "");
            const statusStr = status === 3 ? "delivered" : status === 4 ? "read" : status === 2 ? "pending" : `status:${status}`;
            console.log(`WhatsApp [${this.authCollection}]: message ${phone} → ${statusStr}`);
            this.trackDelivery(key, phone, statusStr);
          }
        }
      });
    });
  }

  private async drainQueue() {
    if (this.drainInProgress) return;
    this.drainInProgress = true;

    try {
      let items = this.messageQueue.splice(0);
      if (items.length === 0) {
        return;
      }

      console.log(`WhatsApp [${this.authCollection}]: draining ${items.length} queued messages...`);

      let sent = 0;
      let failed = 0;

      while (items.length > 0) {
        if (!this._ready || !this.sock) {
          this.messageQueue.unshift(...items);
          break;
        }

        const item = items.shift()!;
        let ok: boolean;
        if (item.type === "text") {
          const res = await this.sendMessageNow(item.phone, item.message);
          ok = res.ok;
        } else {
          const res = await this.sendMediaNow(item.phone, item.base64, item.filename, item.mimetype, item.caption);
          ok = res.ok;
        }
        if (ok) sent++; else failed++;
        await new Promise((r) => setTimeout(r, 500));
      }

      console.log(`WhatsApp [${this.authCollection}] queue drain: ${sent} sent, ${failed} failed`);

      if (this.messageQueue.length > 0 && this._ready) {
        setTimeout(() => this.drainQueue(), 100);
      }
    } finally {
      this.drainInProgress = false;
    }
  }

  private async sendMessageNow(phone: string, message: string, retries = 2): Promise<{ ok: boolean; error?: string }> {
    if (!this.sock) return { ok: false, error: "WhatsApp socket not connected" };
    const normalizedPhone = normalizePhone(phone);
    if (!isValidWhatsAppPhone(normalizedPhone)) {
      console.error(`WhatsApp [${this.authCollection}] invalid phone: "${phone}" → "${normalizedPhone}"`);
      return { ok: false, error: `Invalid phone number: ${phone}` };
    }
    const jid = toJID(normalizedPhone);
    console.log(`WhatsApp [${this.authCollection}] sending to ${normalizedPhone} (jid: ${jid})`);
    let lastError = "";
    for (let attempt = 0; attempt <= retries; attempt++) {
      try {
        const msgKey = await this.sock.sendMessage(jid, { text: message });
        this.trackDelivery(msgKey, normalizedPhone, "sent");
        console.log(`WhatsApp [${this.authCollection}] message sent to ${normalizedPhone}, key: ${msgKey?.key?.id || "unknown"}`);
        return { ok: true };
      } catch (err: any) {
        const errMsg = err?.message || err?.toString() || "Unknown send error";
        lastError = errMsg;
        if (attempt < retries) {
          console.log(`WhatsApp [${this.authCollection}] send retry ${attempt + 1}/${retries} to ${normalizedPhone}:`, errMsg);
          await new Promise((r) => setTimeout(r, 2000));
          continue;
        }
        console.error(`WhatsApp [${this.authCollection}] send failed after ${retries + 1} attempts to ${normalizedPhone}:`, errMsg);
      }
    }
    await this.handleSendFailure(lastError);
    return { ok: false, error: lastError };
  }

  private async sendMediaNow(phone: string, base64: string, filename: string, mimetype: string, caption?: string, retries = 2): Promise<{ ok: boolean; error?: string }> {
    if (!this.sock) return { ok: false, error: "WhatsApp socket not connected" };
    const normalizedPhone = normalizePhone(phone);
    if (!isValidWhatsAppPhone(normalizedPhone)) {
      console.error(`WhatsApp [${this.authCollection}] invalid phone for media: "${phone}" → "${normalizedPhone}"`);
      return { ok: false, error: `Invalid phone number: ${phone}` };
    }
    const jid = toJID(normalizedPhone);
    console.log(`WhatsApp [${this.authCollection}] sending media to ${normalizedPhone} (jid: ${jid})`);
    let lastError = "";
    for (let attempt = 0; attempt <= retries; attempt++) {
      try {
        const buffer = Buffer.from(base64, "base64");
        const isImage = mimetype.startsWith("image/");
        const msg = isImage
          ? { image: buffer, caption: caption || "" }
          : { document: buffer, fileName: filename, mimetype, caption: caption || "" };
        const msgKey = await this.sock.sendMessage(jid, msg);
        this.trackDelivery(msgKey, normalizedPhone, "sent");
        console.log(`WhatsApp [${this.authCollection}] media sent to ${normalizedPhone}, key: ${msgKey?.key?.id || "unknown"}`);
        return { ok: true };
      } catch (err: any) {
        const errMsg = err?.message || err?.toString() || "Unknown media send error";
        lastError = errMsg;
        if (attempt < retries) {
          console.log(`WhatsApp [${this.authCollection}] sendMedia retry ${attempt + 1}/${retries} to ${normalizedPhone}:`, errMsg);
          await new Promise((r) => setTimeout(r, 2000));
          continue;
        }
        console.error(`WhatsApp [${this.authCollection}] sendMedia failed after ${retries + 1} attempts to ${normalizedPhone}:`, errMsg);
      }
    }
    await this.handleSendFailure(lastError);
    return { ok: false, error: lastError };
  }

  async sendMessage(phone: string, message: string): Promise<{ ok: boolean; error?: string }> {
    if (!this._ready || !this.sock) {
      this.messageQueue.push({ type: "text", phone, message });
      console.log(`WhatsApp [${this.authCollection}]: queued text message to ***${phone.slice(-2)} (queue: ${this.messageQueue.length})`);
      return { ok: false, error: "Not connected — message queued" };
    }
    return this.sendMessageNow(phone, message);
  }

  async sendMedia(phone: string, base64: string, filename: string, mimetype: string, caption?: string, throwOnError?: boolean): Promise<{ ok: boolean; error?: string }> {
    if (!this._ready || !this.sock) {
      this.messageQueue.push({ type: "media", phone, base64, filename, mimetype, caption });
      console.log(`WhatsApp [${this.authCollection}]: queued media message to ***${phone.slice(-2)} (queue: ${this.messageQueue.length})`);
      return { ok: false, error: "Not connected — media queued" };
    }
    if (throwOnError) {
      try {
        const normalizedPhone = normalizePhone(phone);
        const jid = toJID(normalizedPhone);
        const buffer = Buffer.from(base64, "base64");
        const isImage = mimetype.startsWith("image/");
        const msg = isImage
          ? { image: buffer, caption: caption || "" }
          : { document: buffer, fileName: filename, mimetype, caption: caption || "" };
        const msgKey = await this.sock.sendMessage(jid, msg);
        this.trackDelivery(msgKey, normalizedPhone, "sent");
        return { ok: true };
      } catch (err: any) {
        const errMsg = err?.message || err?.toString() || "Unknown media send error";
        console.error(`WhatsApp [${this.authCollection}] sendMedia (throwOnError) failed:`, errMsg);
        await this.handleSendFailure(errMsg);
        return { ok: false, error: errMsg };
      }
    }
    return this.sendMediaNow(phone, base64, filename, mimetype, caption);
  }

  async broadcast(
    numbers: string[],
    message: string,
    antiban?: { delayMin: number; delayMax: number; batchSize: number; pause: number },
    media?: { base64: string; filename: string; mimetype: string }
  ): Promise<{ sent: number; failed: number; results: { phone: string; status: "sent" | "failed" }[] }> {
    let sent = 0;
    let failed = 0;
    const results: { phone: string; status: "sent" | "failed" }[] = [];
    const delayMin = antiban?.delayMin ?? 2000;
    const delayMax = antiban?.delayMax ?? 5000;
    const batchSize = antiban?.batchSize ?? 20;
    const batchPause = antiban?.pause ?? 15000;

    for (let i = 0; i < numbers.length; i++) {
      if (this._broadcastAborted) break;

      const hasText = message.trim().length > 0;
      let ok = true;

      if (media) {
        const caption = media.mimetype.startsWith("image/") && hasText ? message : undefined;
        const res = await this.sendMedia(numbers[i], media.base64, media.filename, media.mimetype, caption);
        ok = res.ok;
        if (ok && !media.mimetype.startsWith("image/") && hasText) {
          await new Promise((r) => setTimeout(r, 500));
          const res2 = await this.sendMessage(numbers[i], message);
          ok = res2.ok;
        }
      }
      if (hasText && !media) {
        const res = await this.sendMessage(numbers[i], message);
        ok = res.ok;
      }

      if (ok) { sent++; results.push({ phone: numbers[i], status: "sent" }); }
      else { failed++; results.push({ phone: numbers[i], status: "failed" }); }

      const ms = delayMin + Math.random() * (delayMax - delayMin);
      await new Promise((r) => setTimeout(r, ms));

      if ((i + 1) % batchSize === 0 && i + 1 < numbers.length) {
        const jitter = Math.random() * 5000;
        await new Promise((r) => setTimeout(r, batchPause + jitter));
      }
    }

    this._broadcastAborted = false;
    return { sent, failed, results };
  }

  abortBroadcast() {
    this._broadcastAborted = true;
  }

  async requestPairingCode(phoneNumber: string): Promise<string> {
    if (!this.sock) throw new Error("WhatsApp not initialized");
    this._pairingCode = null;
    const code = await this.sock.requestPairingCode(normalizePhone(phoneNumber));
    this._pairingCode = code;
    this._qr = null;
    this._qrBase64 = null;
    this._error = null;
    console.log(`WhatsApp [${this.authCollection}]: pairing code generated:`, code);
    return code;
  }

  async getStatus() {
    const connectedPhone = this.getConnectedPhone();
    if (this._error) return { status: "error", error: this._error, queueLength: this.messageQueue.length, connectedPhone };
    if (this._ready) return { status: "connected", queueLength: this.messageQueue.length, connectedPhone };
    if (this._pairingCode) return { status: "pairing", pairingCode: this._pairingCode, connectedPhone };
    if (this._qr) return { status: "qr", qr: this._qrBase64, queueLength: this.messageQueue.length, connectedPhone };
    if (this.initializing) return { status: "initializing", queueLength: this.messageQueue.length, connectedPhone };
    return { status: "disconnected", queueLength: this.messageQueue.length, connectedPhone };
  }

  async checkNumberOnWhatsApp(phone: string): Promise<{ exists: boolean; jid: string } | null> {
    if (!this.sock || !this._ready) return null;
    try {
      const jid = toJID(normalizePhone(phone));
      const results = await (this.sock as any).onWhatsApp(jid);
      if (results && results.length > 0) {
        return { exists: results[0].exists, jid: results[0].jid };
      }
    } catch (e: any) {
      console.error(`WhatsApp [${this.authCollection}]: onWhatsApp check failed:`, e?.message || e);
    }
    return null;
  }

  getDeliveryLog() {
    return this._deliveryLog.slice(-20);
  }

  private trackDelivery(messageKey: any, phone: string, status: string) {
    this._deliveryLog.push({ phone, status, timestamp: Date.now(), messageKey: messageKey?.id || messageKey?.remoteJid });
    if (this._deliveryLog.length > this._deliveryLogMax) {
      this._deliveryLog = this._deliveryLog.slice(-this._deliveryLogMax);
    }
  }

  private scheduleReconnect() {
    this.cancelReconnect();
    if (this.reconnectAttempts >= MAX_RECONNECT_ATTEMPTS) {
      console.log(`WhatsApp [${this.authCollection}]: max reconnect attempts reached, will retry via health check`);
      this._error = "Connection lost. Retrying automatically...";
      return;
    }
    this.reconnectAttempts++;
    const delay = Math.min(RECONNECT_BASE_DELAY * this.reconnectAttempts, MAX_RECONNECT_DELAY);
    console.log(`WhatsApp [${this.authCollection}]: scheduling reconnect in ${delay}ms (attempt ${this.reconnectAttempts}/${MAX_RECONNECT_ATTEMPTS})`);
    this.reconnectTimer = setTimeout(() => {
      this.reconnectTimer = null;
      this.initializing = false;
      this.initPromise = null;
      this.sock = null;
      this.init().catch((err) => console.error(`WhatsApp [${this.authCollection}] reconnect failed:`, err));
    }, delay);
  }

  private cancelReconnect() {
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
  }

  private startHealthCheck() {
    this.stopHealthCheck();
    this.healthCheckTimer = setInterval(() => {
      if (!this._ready || !this.sock) {
        console.log(`WhatsApp [${this.authCollection}]: health check — not ready, triggering reconnect`);
        this.initializing = false;
        this.initPromise = null;
        this.sock = null;
        this.init().catch(() => {});
      } else {
        this._lastActivityAt = Date.now();
      }
    }, HEALTH_CHECK_INTERVAL_MS);
  }

  private stopHealthCheck() {
    if (this.healthCheckTimer) {
      clearInterval(this.healthCheckTimer);
      this.healthCheckTimer = null;
    }
  }

  async destroy() {
    this.cancelReconnect();
    this.stopHealthCheck();
    if (this.sock) {
      try {
        this.sock.ev.removeAllListeners("connection.update");
        this.sock.ev.removeAllListeners("creds.update");
        this.sock.end(new Error("Service destroy"));
      } catch (e) { /* socket teardown is best-effort */ }
      this.sock = null;
    }
    this._ready = false;
    this._qr = null;
    this._qrBase64 = null;
    this._pairingCode = null;
    this._error = null;
    this.initializing = false;
    this.initPromise = null;
    this.saveCredsFn = null;
  }

  async disconnect() {
    try {
      const db = mongoose.connection.db;
      if (db) await db.collection(this.authCollection).deleteOne({ _id: "auth_state" as any });
    } catch (e) { /* auth_state cleanup is best-effort */ }
    await this.destroy();
  }

  async reconnect() {
    await this.disconnect();
    await this.init();
  }
}

// ─── WhatsApp Manager: manages per-branch WhatsApp instances ───

class WhatsAppManager {
  private instances = new Map<string, WhatsAppService>();
  private defaultInstance: WhatsAppService;
  private defaultInitialized = false;

  constructor() {
    this.defaultInstance = new WhatsAppService("");
  }

  /**
   * Get or create a WhatsApp instance for a branch.
   * If branchKey is empty, returns the default (legacy) instance.
   */
  getInstance(branchKey?: string | null): WhatsAppService {
    const key = branchKey || "";
    if (!key) {
      if (!this.defaultInitialized) {
        this.defaultInitialized = true;
        this.defaultInstance.init().catch(() => {});
      }
      return this.defaultInstance;
    }

    let instance = this.instances.get(key);
    if (!instance) {
      instance = new WhatsAppService(key);
      this.instances.set(key, instance);
      instance.init().catch(() => {});
    }
    return instance;
  }

  /**
   * Initialize all active branch WhatsApp instances.
   */
  async initAll(branchKeys: string[]): Promise<void> {
    const inits: Promise<void>[] = [];
    for (const key of branchKeys) {
      const instance = this.getInstance(key);
      inits.push(instance.init().catch((err: any) => {
        console.error(`WhatsApp [${key}] init failed (initAll):`, err?.message || err);
      }) as Promise<void>);
    }
    await Promise.allSettled(inits);
  }

  /**
   * Clear stale auth across all known collections (default + all branches).
   */
  async clearAllStaleAuth(): Promise<void> {
    const db = mongoose.connection.db;
    if (!db) return;

    try {
      // Clear default auth
      await db.collection("baileys_auth").deleteOne({ _id: "auth_state" as any });
    } catch {}

    // Clear all branch auths
    for (const [key, instance] of this.instances) {
      try {
        await db.collection(`baileys_auth_${key}`).deleteOne({ _id: "auth_state" as any });
      } catch {}
    }

    // Also clear any orphaned baileys_auth_* collections
    try {
      const collections = await db.listCollections({ name: { $regex: "^baileys_auth_" } }).toArray();
      for (const coll of collections) {
        try {
          await db.collection(coll.name).deleteOne({ _id: "auth_state" as any });
        } catch {}
      }
    } catch {}
  }

  /**
   * Destroy all instances.
   */
  async destroyAll(): Promise<void> {
    this.defaultInitialized = false;
    await this.defaultInstance.destroy().catch(() => {});
    for (const [, instance] of this.instances) {
      await instance.destroy().catch(() => {});
    }
    this.instances.clear();
  }
}

export const whatsappManager = new WhatsAppManager();

// Backward-compatible export: returns the default (legacy) instance
export const whatsapp = whatsappManager.getInstance();
