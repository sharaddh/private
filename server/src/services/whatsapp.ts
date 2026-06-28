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
  caption?: string;
}

type QueueItem = QueuedMessage | QueuedMedia;

function normalizePhone(phone: string): string {
  const digits = phone.replace(/\D/g, "");
  if (digits.length === 10) return "91" + digits;
  if (digits.length === 11 && digits.startsWith("0")) return "91" + digits.slice(1);
  if (digits.length === 12 && digits.startsWith("91")) return digits;
  return digits;
}

function toJID(phone: string): string {
  return normalizePhone(phone) + "@s.whatsapp.net";
}

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

const QR_TIMEOUT_MS = 60000;
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
    let lastError: any;
    for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
      try {
        await this.tryInit();
        console.log("WhatsApp: connected successfully");
        return;
      } catch (err: any) {
        lastError = err;
        console.error(`WhatsApp init attempt ${attempt}/${MAX_RETRIES} failed:`, err?.message || err);
        await this.destroy();
        if (attempt < MAX_RETRIES) {
          const delay = RETRY_BASE_DELAY * attempt;
          console.log(`WhatsApp: retrying in ${delay}ms...`);
          await new Promise((r) => setTimeout(r, delay));
        }
      }
    }
    console.error("WhatsApp: all init attempts failed");
    this._error = lastError?.message || "Init failed after " + MAX_RETRIES + " attempts";
    this.initializing = false;
    this.initPromise = null;
  }

  private async tryInit(): Promise<void> {
    const { state, saveCreds } = await useMongoDBAuthState();
    this.saveCredsFn = saveCreds;

    const isLoggedIn = !!state.creds.me?.id;
    const { version } = await fetchLatestBaileysVersion();

    return new Promise<void>((resolve, reject) => {
      let qrTimer: ReturnType<typeof setTimeout> | null = null;
      let resolved = false;

      if (isLoggedIn) {
        console.log("WhatsApp: found existing session for", state.creds.me?.id);
      }

      const sock = makeWASocket({
        auth: state,
        version,
        printQRInTerminal: false,
        browser: Browsers.macOS("Chrome"),
        syncFullHistory: false,
        markOnlineOnConnect: true,
        emitOwnEvents: false,
        generateHighQualityLinkPreview: false,
        keepAliveIntervalMs: 30000,
        connectTimeoutMs: 60000,
        defaultQueryTimeoutMs: 60000,
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
          this.sock = null;

          const statusCode = lastDisconnect?.error?.output?.statusCode;
          const reason = statusCode !== undefined ? (DisconnectReason as any)[statusCode] || "Unknown" : "Unknown";

          const needsReAuth =
            statusCode === DisconnectReason.loggedOut ||
            statusCode === DisconnectReason.badSession;

          if (needsReAuth) {
            console.log("WhatsApp: " + (DisconnectReason as any)[statusCode] + ", clearing session for re-auth");
            try {
              const db = mongoose.connection.db;
              if (db) await db.collection("baileys_auth").deleteOne({ _id: "auth_state" as any });
            } catch {}
          } else {
            this.scheduleReconnect();
          }

          if (qrTimer) clearTimeout(qrTimer);

          if (!resolved) {
            resolved = true;
            reject(new Error("Connection closed: " + reason));
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
        ok = await this.sendMediaNow(item.phone, item.base64, item.filename, item.caption);
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

  private async sendMediaNow(phone: string, base64: string, filename: string, caption?: string): Promise<boolean> {
    if (!this.sock) return false;
    try {
      const jid = toJID(phone);
      const buffer = Buffer.from(base64, "base64");
      await this.sock.sendMessage(jid, {
        document: buffer,
        fileName: filename,
        mimetype: "application/pdf",
        caption: caption || "",
      });
      return true;
    } catch (err: any) {
      console.error("WhatsApp sendMedia error:", err?.message || err);
      return false;
    }
  }

  async sendMessage(phone: string, message: string): Promise<boolean> {
    if (!this._ready || !this.sock) {
      this.messageQueue.push({ type: "text", phone, message });
      console.log(`WhatsApp: queued text message to ${phone} (queue: ${this.messageQueue.length})`);
      return false;
    }
    return this.sendMessageNow(phone, message);
  }

  async sendMedia(phone: string, base64: string, filename: string, caption?: string, throwOnError?: boolean): Promise<boolean> {
    if (!this._ready || !this.sock) {
      this.messageQueue.push({ type: "media", phone, base64, filename, caption });
      console.log(`WhatsApp: queued media message to ${phone} (queue: ${this.messageQueue.length})`);
      return false;
    }
    if (throwOnError) {
      const jid = toJID(phone);
      const buffer = Buffer.from(base64, "base64");
      await this.sock.sendMessage(jid, {
        document: buffer,
        fileName: filename,
        mimetype: "application/pdf",
        caption: caption || "",
      });
      return true;
    }
    return this.sendMediaNow(phone, base64, filename, caption);
  }

  async broadcast(numbers: string[], message: string): Promise<{ sent: number; failed: number }> {
    let sent = 0;
    let failed = 0;
    for (const phone of numbers) {
      const ok = await this.sendMessage(phone, message);
      if (ok) sent++; else failed++;
      await new Promise((r) => setTimeout(r, 1000));
    }
    return { sent, failed };
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
      this.init().catch(() => {});
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
      } catch {}
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
    } catch {}
    await this.destroy();
  }

  async reconnect() {
    await this.disconnect();
    await this.init();
  }
}

export const whatsapp = new WhatsAppService();
