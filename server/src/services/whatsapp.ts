import makeWASocket, {
  DisconnectReason,
  AuthenticationState,
  AuthenticationCreds,
  SignalKeyStore,
  initAuthCreds,
  BufferJSON,
  Browsers,
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

async function useMongoDBAuthState(): Promise<{
  state: AuthenticationState;
  saveCreds: () => Promise<void>;
}> {
  const db = mongoose.connection.db;
  if (!db) throw new Error("MongoDB not connected");
  const collection = db.collection("baileys_auth");

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
      console.error("WhatsApp: failed to save auth state to MongoDB:", e);
    }
  };

  return { state: { creds, keys }, saveCreds };
}

// Hardcoded WA Web version that's currently accepted.
// fetchLatestBaileysVersion() is unreliable on Render (GitHub fetch may fail,
// falling back to stale default). Keep this updated if version rejection occurs.
const WA_VERSION: [number, number, number] = [2, 3000, 1035194821];

const QR_TIMEOUT_MS = 120000;
const MAX_RECONNECT_ATTEMPTS = 5;
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

  get ready() { return this._ready; }
  get qr() { return this._qr; }
  get qrBase64() { return this._qrBase64; }
  get error() { return this._error; }
  get pairingCode() { return this._pairingCode; }
  get queueLength() { return this.messageQueue.length; }

  async init() {
    this.reconnectAttempts = 0;
    if (this.sock) return;
    if (this.initializing) return this.initPromise;
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
      console.log("WhatsApp: connected successfully");
    } catch (err: any) {
      const msg = err?.message || "Failed to connect to WhatsApp";
      if (msg === "RESTART_REQUIRED") {
        // Pairing succeeded; creds saved to MongoDB. Re-init with the
        // new session. Don't destroy — that would cancel the reconnect.
        console.log("WhatsApp: pairing complete, restarting with saved session");
        this.initializing = false;
        this.initPromise = null;
        await this.init();
        return;
      }
      console.error("WhatsApp init failed:", msg);
      await this.destroy();
      this._error = msg;
    }
  }

  private async tryInit(): Promise<void> {
    const { state, saveCreds } = await useMongoDBAuthState();
    this.saveCredsFn = saveCreds;

    const isLoggedIn = !!state.creds.me?.id;

    return new Promise<void>((resolve, reject) => {
      let qrTimer: ReturnType<typeof setTimeout> | null = null;
      let resolved = false;

      if (isLoggedIn) {
        console.log("WhatsApp: found existing session for", state.creds.me?.id);
      }

      const sock = makeWASocket({
        auth: state,
        version: WA_VERSION,
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
          console.log("WhatsApp: QR code generated");
        }

        if (isNewLogin) {
          console.log("WhatsApp: new login detected, saving creds");
          if (this.saveCredsFn) await this.saveCredsFn();
        }

        if (connection === "open") {
          this._ready = true;
          this._qr = null;
          this._qrBase64 = null;
          this._error = null;
          this._pairingCode = null;
          if (qrTimer) clearTimeout(qrTimer);
          if (!resolved) {
            resolved = true;
            console.log("WhatsApp: connected!");
            this.drainQueue();
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

          console.log("WhatsApp: connection closed", {
            reason,
            statusCode,
            wasReady,
            resolved,
            errMsg,
            errStack: errStack.split("\n")[0],
          });

          // After a successful pairing, Baileys closes the socket
          // (restartRequired). The new creds are saved to MongoDB.
          // Clean up and let doInit() re-init with the saved session.
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
            console.log("WhatsApp: " + (DisconnectReason as any)[statusCode] + ", clearing session for re-auth");
            try {
              const db = mongoose.connection.db;
              if (db) await db.collection("baileys_auth").deleteOne({ _id: "auth_state" as any });
            } catch (e) { /* auth_state cleanup is best-effort */ }
          } else {
            this.scheduleReconnect();
          }

          // If connection closed before auth completed, clear partial session
          // so the next attempt starts completely fresh
          if (!resolved) {
            console.log("WhatsApp: connection closed before auth completed, clearing partial session");
            try {
              const db = mongoose.connection.db;
              if (db) await db.collection("baileys_auth").deleteOne({ _id: "auth_state" as any });
            } catch (e) { /* partial session cleanup is best-effort */ }
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

      // Long timeout to let user scan QR
      qrTimer = setTimeout(() => {
        if (!resolved) {
          resolved = true;
          console.log("WhatsApp: QR timeout — no connection within " + (QR_TIMEOUT_MS / 1000) + "s");
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

    const items = this.messageQueue.splice(0);
    if (items.length === 0) {
      this.drainInProgress = false;
      return;
    }

    console.log(`WhatsApp: draining ${items.length} queued messages...`);

    let sent = 0;
    let failed = 0;

    for (const item of items) {
      if (!this._ready) {
        this.messageQueue.unshift(...items.slice(items.indexOf(item)));
        break;
      }

      let ok: boolean;
      if (item.type === "text") {
        ok = await this.sendMessageNow(item.phone, item.message);
      } else {
        ok = await this.sendMediaNow(item.phone, item.base64, item.filename, item.mimetype, item.caption);
      }
      if (ok) sent++; else failed++;
      await new Promise((r) => setTimeout(r, 500));
    }

    console.log(`WhatsApp queue drain: ${sent} sent, ${failed} failed`);
    this.drainInProgress = false;
  }

  private async sendMessageNow(phone: string, message: string): Promise<boolean> {
    if (!this.sock) return false;
    try {
      const jid = toJID(phone);
      await this.sock.sendMessage(jid, { text: message });
      return true;
    } catch (err) {
      console.error("WhatsApp send error:", err);
      return false;
    }
  }

  private async sendMediaNow(phone: string, base64: string, filename: string, mimetype: string, caption?: string): Promise<boolean> {
    if (!this.sock) return false;
    try {
      const jid = toJID(phone);
      const buffer = Buffer.from(base64, "base64");
      const isImage = mimetype.startsWith("image/");
      const msg = isImage
        ? { image: buffer, caption: caption || "" }
        : { document: buffer, fileName: filename, mimetype, caption: caption || "" };
      await this.sock.sendMessage(jid, msg);
      return true;
    } catch (err: any) {
      console.error("WhatsApp sendMedia error:", err?.message || err);
      return false;
    }
  }

  async sendMessage(phone: string, message: string): Promise<boolean> {
    if (!this._ready || !this.sock) {
      this.messageQueue.push({ type: "text", phone, message });
      console.log(`WhatsApp: queued text message to ***${phone.slice(-2)} (queue: ${this.messageQueue.length})`);
      return false;
    }
    return this.sendMessageNow(phone, message);
  }

  async sendMedia(phone: string, base64: string, filename: string, mimetype: string, caption?: string, throwOnError?: boolean): Promise<boolean> {
    if (!this._ready || !this.sock) {
      this.messageQueue.push({ type: "media", phone, base64, filename, mimetype, caption });
      console.log(`WhatsApp: queued media message to ***${phone.slice(-2)} (queue: ${this.messageQueue.length})`);
      return false;
    }
    if (throwOnError) {
      const jid = toJID(phone);
      const buffer = Buffer.from(base64, "base64");
      const isImage = mimetype.startsWith("image/");
      const msg = isImage
        ? { image: buffer, caption: caption || "" }
        : { document: buffer, fileName: filename, mimetype, caption: caption || "" };
      await this.sock.sendMessage(jid, msg);
      return true;
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
        ok = await this.sendMedia(numbers[i], media.base64, media.filename, media.mimetype, caption);
        if (ok && !media.mimetype.startsWith("image/") && hasText) {
          await new Promise((r) => setTimeout(r, 500));
          ok = await this.sendMessage(numbers[i], message);
        }
      }
      if (hasText && !media) {
        ok = await this.sendMessage(numbers[i], message);
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
    console.log("WhatsApp: pairing code generated:", code);
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
      console.error("WhatsApp: max reconnect attempts reached, giving up");
      this._error = "Connection lost. Click 'Retry Connection' to try again.";
      return;
    }
    this.reconnectAttempts++;
    const delay = RECONNECT_BASE_DELAY * this.reconnectAttempts;
    console.log(`WhatsApp: scheduling reconnect in ${delay}ms (attempt ${this.reconnectAttempts}/${MAX_RECONNECT_ATTEMPTS})`);
    this.reconnectTimer = setTimeout(() => {
      this.reconnectTimer = null;
      this.init().catch((err) => console.error("WhatsApp reconnect failed:", err));
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
      if (db) await db.collection("baileys_auth").deleteOne({ _id: "auth_state" as any });
    } catch (e) { /* auth_state cleanup is best-effort */ }
    await this.destroy();
  }

  async reconnect() {
    await this.disconnect();
    await this.init();
  }
}

export const whatsapp = new WhatsAppService();
