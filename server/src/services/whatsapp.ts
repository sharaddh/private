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

import { normalizePhone, toWhatsAppJID as toJID } from "../utils/phone";

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

  constructor(branchKey: string) {
    this.authCollection = branchKey ? `baileys_auth_${branchKey}` : "baileys_auth";
  }

  get ready() { return this._ready; }
  get qr() { return this._qr; }
  get qrBase64() { return this._qrBase64; }
  get error() { return this._error; }
  get pairingCode() { return this._pairingCode; }
  get queueLength() { return this.messageQueue.length; }

  async init() {
    this.reconnectAttempts = 0;
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

    // Fetch latest Baileys version with fallback
    let waVersion = FALLBACK_WA_VERSION;
    try {
      const { version } = await fetchLatestBaileysVersion();
      waVersion = version;
    } catch {
      console.log(`WhatsApp [${this.authCollection}]: using fallback WA version`, FALLBACK_WA_VERSION);
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
          console.log(`WhatsApp [${this.authCollection}]: QR code generated`);
        }

        if (isNewLogin) {
          console.log(`WhatsApp [${this.authCollection}]: new login detected, saving creds`);
          if (this.saveCredsFn) await this.saveCredsFn();
        }

        if (connection === "open") {
          this._ready = true;
          this._qr = null;
          this._qrBase64 = null;
          this._error = null;
          this._pairingCode = null;
          this.reconnectAttempts = 0;
          if (qrTimer) clearTimeout(qrTimer);
          console.log(`WhatsApp [${this.authCollection}]: connected!`);
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
            statusCode === DisconnectReason.badSession;

          if (needsReAuth) {
            console.log(`WhatsApp [${this.authCollection}]: ${reason}, clearing session for re-auth`);
            try {
              const db = mongoose.connection.db;
              if (db) await db.collection(this.authCollection).deleteOne({ _id: "auth_state" as any });
            } catch (e) { /* auth_state cleanup is best-effort */ }
          } else {
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

      qrTimer = setTimeout(() => {
        if (!resolved) {
          resolved = true;
          console.log(`WhatsApp [${this.authCollection}]: QR timeout — no connection within ${QR_TIMEOUT_MS / 1000}s`);
          sock.ev.removeAllListeners("connection.update");
          sock.ev.removeAllListeners("creds.update");
          sock.end(new Error("QR timeout"));
          reject(new Error("QR timeout after " + (QR_TIMEOUT_MS / 1000) + "s"));
        }
      }, QR_TIMEOUT_MS);
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

  private async sendMessageNow(phone: string, message: string): Promise<{ ok: boolean; error?: string }> {
    if (!this.sock) return { ok: false, error: "WhatsApp socket not connected" };
    try {
      const jid = toJID(phone);
      await this.sock.sendMessage(jid, { text: message });
      return { ok: true };
    } catch (err: any) {
      const errMsg = err?.message || err?.toString() || "Unknown send error";
      console.error(`WhatsApp [${this.authCollection}] send error:`, errMsg);
      return { ok: false, error: errMsg };
    }
  }

  private async sendMediaNow(phone: string, base64: string, filename: string, mimetype: string, caption?: string): Promise<{ ok: boolean; error?: string }> {
    if (!this.sock) return { ok: false, error: "WhatsApp socket not connected" };
    try {
      const jid = toJID(phone);
      const buffer = Buffer.from(base64, "base64");
      const isImage = mimetype.startsWith("image/");
      const msg = isImage
        ? { image: buffer, caption: caption || "" }
        : { document: buffer, fileName: filename, mimetype, caption: caption || "" };
      await this.sock.sendMessage(jid, msg);
      return { ok: true };
    } catch (err: any) {
      const errMsg = err?.message || err?.toString() || "Unknown media send error";
      console.error(`WhatsApp [${this.authCollection}] sendMedia error:`, errMsg);
      return { ok: false, error: errMsg };
    }
  }

  async sendMessage(phone: string, message: string): Promise<{ ok: boolean; error?: string }> {
    if (!this._ready || !this.sock) {
      this.messageQueue.push({ type: "text", phone, message });
      console.log(`WhatsApp [${this.authCollection}]: queued text message to ***${phone.slice(-2)} (queue: ${this.messageQueue.length})`);
      if (this._ready) setTimeout(() => this.drainQueue(), 0);
      return { ok: false, error: "Not connected — message queued" };
    }
    return this.sendMessageNow(phone, message);
  }

  async sendMedia(phone: string, base64: string, filename: string, mimetype: string, caption?: string, throwOnError?: boolean): Promise<{ ok: boolean; error?: string }> {
    if (!this._ready || !this.sock) {
      this.messageQueue.push({ type: "media", phone, base64, filename, mimetype, caption });
      console.log(`WhatsApp [${this.authCollection}]: queued media message to ***${phone.slice(-2)} (queue: ${this.messageQueue.length})`);
      if (this._ready) setTimeout(() => this.drainQueue(), 0);
      return { ok: false, error: "Not connected — media queued" };
    }
    if (throwOnError) {
      const jid = toJID(phone);
      const buffer = Buffer.from(base64, "base64");
      const isImage = mimetype.startsWith("image/");
      const msg = isImage
        ? { image: buffer, caption: caption || "" }
        : { document: buffer, fileName: filename, mimetype, caption: caption || "" };
      await this.sock.sendMessage(jid, msg);
      return { ok: true };
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
    if (this._error) return { status: "error", error: this._error };
    if (this._ready) return { status: "connected", queueLength: this.messageQueue.length };
    if (this._pairingCode) return { status: "pairing", pairingCode: this._pairingCode };
    if (this._qr) return { status: "qr", qr: this._qrBase64, queueLength: this.messageQueue.length };
    return { status: "initializing", queueLength: this.messageQueue.length };
  }

  private scheduleReconnect() {
    this.cancelReconnect();
    if (this.reconnectAttempts >= MAX_RECONNECT_ATTEMPTS) {
      console.error(`WhatsApp [${this.authCollection}]: max reconnect attempts reached, giving up`);
      this._error = "Connection lost. Click 'Retry Connection' to try again.";
      return;
    }
    this.reconnectAttempts++;
    const delay = RECONNECT_BASE_DELAY * this.reconnectAttempts;
    console.log(`WhatsApp [${this.authCollection}]: scheduling reconnect in ${delay}ms (attempt ${this.reconnectAttempts}/${MAX_RECONNECT_ATTEMPTS})`);
    this.reconnectTimer = setTimeout(() => {
      this.reconnectTimer = null;
      this.init().catch((err) => console.error(`WhatsApp [${this.authCollection}] reconnect failed:`, err));
    }, delay);
  }

  private cancelReconnect() {
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
  }

  async destroy() {
    this.cancelReconnect();
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

  constructor() {
    this.defaultInstance = new WhatsAppService("");
  }

  /**
   * Get or create a WhatsApp instance for a branch.
   * If branchKey is empty, returns the default (legacy) instance.
   */
  getInstance(branchKey?: string | null): WhatsAppService {
    const key = branchKey || "";
    if (!key) return this.defaultInstance;

    let instance = this.instances.get(key);
    if (!instance) {
      instance = new WhatsAppService(key);
      this.instances.set(key, instance);
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
