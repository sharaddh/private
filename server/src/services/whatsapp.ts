import { Client, LocalAuth, MessageMedia } from "whatsapp-web.js";
import * as QR from "qrcode";
import * as fs from "fs";
import * as path from "path";
import puppeteer from "puppeteer";

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

class WhatsAppService {
  private client: Client | null = null;
  private _ready = false;
  private _qr: string | null = null;
  private _qrBase64: string | null = null;
  private _error: string | null = null;
  private initializing = false;
  private initPromise: Promise<void> | null = null;
  private messageQueue: QueueItem[] = [];
  private heartbeatTimer: ReturnType<typeof setInterval> | null = null;
  private drainInProgress = false;

  get ready() { return this._ready; }
  get qr() { return this._qr; }
  get qrBase64() { return this._qrBase64; }
  get error() { return this._error; }
  get queueLength() { return this.messageQueue.length; }

  private cleanSession() {
    const sessionDir = path.resolve(".wwebjs_auth");
    if (fs.existsSync(sessionDir)) {
      try {
        fs.rmSync(sessionDir, { recursive: true, force: true });
        console.log("Cleaned WhatsApp session directory");
      } catch (e) {
        console.error("Failed to clean session directory:", e);
      }
    }
  }

  private createClient() {
    let executablePath: string | undefined;
    try {
      const browserPath = puppeteer.executablePath();
      if (fs.existsSync(browserPath)) executablePath = browserPath;
    } catch {}
    const opts: Record<string, any> = {
      headless: true,
      args: [
        "--no-sandbox",
        "--disable-setuid-sandbox",
        "--disable-dev-shm-usage",
        "--disable-gpu",
        "--disable-background-timer-throttling",
        "--disable-backgrounding-occluded-windows",
        "--disable-renderer-backgrounding",
        "--single-process",
        "--no-zygote",
      ],
    };
    if (executablePath) opts.executablePath = executablePath;
    console.log("WhatsApp puppeteer config:", JSON.stringify({ executablePath, argsCount: opts.args.length }));
    return new Client({
      authStrategy: new LocalAuth({ dataPath: ".wwebjs_auth" }),
      puppeteer: opts,
    });
  }

  async init() {
    if (this.client) return;
    if (this.initializing) return this.initPromise;
    this.initializing = true;

    this.initPromise = this.doInit();

    return this.initPromise;
  }

  private async doInit(): Promise<void> {
    await this.tryInit().catch(async (err) => {
      console.error("WhatsApp first init attempt failed:", err?.message || err);
      if (err?.stack) console.error("Stack:", err.stack.split("\n").slice(0, 4).join("\n"));
      await this.destroy();
      this.cleanSession();
      console.log("Retrying WhatsApp initialization with clean session...");
      await this.tryInit();
    });
  }

  private async tryInit(): Promise<void> {
    return new Promise<void>((resolve, reject) => {
      try {
        this.client = this.createClient();

        this.client.on("qr", async (qr) => {
          this._qr = qr;
          this._ready = false;
          this._error = null;
          try {
            this._qrBase64 = await QR.toDataURL(qr);
          } catch {
            this._qrBase64 = null;
          }
          console.log("WhatsApp QR code generated");
        });

        this.client.on("ready", () => {
          this._ready = true;
          this._qr = null;
          this._qrBase64 = null;
          this._error = null;
          console.log("WhatsApp client is ready!");
          this.startHeartbeat();
          this.drainQueue();
          resolve();
        });

        this.client.on("disconnected", (reason) => {
          this._ready = false;
          this.stopHeartbeat();
          this.client = null;
          this.initializing = false;
          this.initPromise = null;
          console.log("WhatsApp client disconnected:", reason);
          if (reason !== "LOGOUT") {
            console.log("Auto-reconnecting WhatsApp...");
            this.init().catch(() => {});
          }
        });

        this.client.on("auth_failure", (msg: string) => {
          this._error = msg || "Auth failure";
          console.error("WhatsApp auth failure:", this._error);
          this._ready = false;
          this.client = null;
          this.initializing = false;
          this.initPromise = null;
          resolve();
        });

        this.client.initialize().catch((err) => {
          reject(err);
        });
      } catch (err: any) {
        reject(err);
      }
    });
  }

  private startHeartbeat() {
    this.stopHeartbeat();
    this.heartbeatTimer = setInterval(async () => {
      if (!this.client || !this._ready) return;
      try {
        const state = await this.client.getState();
        if (state === "CONNECTED") return;
        console.log("WhatsApp heartbeat: state is", state, "— marking not ready");
        this._ready = false;
      } catch {
        this._ready = false;
      }
    }, 5 * 60 * 1000);
  }

  private stopHeartbeat() {
    if (this.heartbeatTimer) {
      clearInterval(this.heartbeatTimer);
      this.heartbeatTimer = null;
    }
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
        console.log("WhatsApp became not-ready during queue drain, re-queuing remaining");
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
    if (!this.client) return false;
    try {
            const formatted = phone.replace(/[^0-9]/g, "").replace(/^0+/, "");
            const chatId = `${formatted}@c.us`;
            await this.client.sendMessage(chatId, message);
      return true;
    } catch (err) {
      console.error("WhatsApp send error:", err);
      return false;
    }
  }

  private async sendMediaNow(phone: string, base64: string, filename: string, caption?: string): Promise<boolean> {
    if (!this.client) return false;
    try {
      const formatted = phone.replace(/[^0-9]/g, "").replace(/^0+/, "");
      const chatId = `${formatted}@c.us`;
      console.log(`sendMediaNow: sending to ${chatId}, filename: ${filename}, base64 length: ${base64.length}, client ready: ${this._ready}`);
      const media = new MessageMedia("application/pdf", base64, filename);
      await this.client.sendMessage(chatId, media, { caption: caption || "" });
      console.log("sendMediaNow: sent successfully");
      return true;
    } catch (err: any) {
      console.error("WhatsApp sendMedia error:", err?.message || err);
      if (err?.stack) console.error("Stack:", err.stack);
      return false;
    }
  }

  async sendMessage(phone: string, message: string): Promise<boolean> {
    if (!this._ready || !this.client) {
      this.messageQueue.push({ type: "text", phone, message });
      console.log(`WhatsApp: queued text message to ${phone} (queue: ${this.messageQueue.length})`);
      return false;
    }
    return this.sendMessageNow(phone, message);
  }

  async sendMedia(phone: string, base64: string, filename: string, caption?: string, throwOnError?: boolean): Promise<boolean> {
    if (!this._ready || !this.client) {
      this.messageQueue.push({ type: "media", phone, base64, filename, caption });
      console.log(`WhatsApp: queued media message to ${phone} (queue: ${this.messageQueue.length})`);
      return false;
    }
    if (throwOnError) {
      const formatted = phone.replace(/[^0-9]/g, "").replace(/^0+/, "");
      const chatId = `${formatted}@c.us`;
      const media = new MessageMedia("application/pdf", base64, filename);
      await this.client.sendMessage(chatId, media, { caption: caption || "" });
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

  async getStatus() {
    if (this._error) return { status: "error", error: this._error };
    if (this._ready) return { status: "connected", queueLength: this.messageQueue.length };
    if (this._qr) return { status: "qr", qr: this._qrBase64, queueLength: this.messageQueue.length };
    return { status: "initializing", queueLength: this.messageQueue.length };
  }

  async destroy() {
    this.stopHeartbeat();
    if (this.client) {
      try {
        await this.client.destroy();
      } catch {}
      this.client = null;
    }
    this._ready = false;
    this._qr = null;
    this._qrBase64 = null;
    this._error = null;
    this.initializing = false;
  }

  async disconnect() {
    await this.destroy();
    this.cleanSession();
    this.initializing = false;
    this.initPromise = null;
  }

  async reconnect() {
    await this.disconnect();
    await this.init();
  }
}

export const whatsapp = new WhatsAppService();
