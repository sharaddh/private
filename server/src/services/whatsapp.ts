import { Client, LocalAuth, MessageMedia } from "whatsapp-web.js";
import * as QR from "qrcode";
import * as fs from "fs";
import * as path from "path";
import * as os from "os";
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

  private async resolveExecutablePath(): Promise<string | undefined> {
    console.log("=== WhatsApp resolveExecutablePath START ===");
    console.log("process.env.PUPPETEER_EXECUTABLE_PATH =", process.env.PUPPETEER_EXECUTABLE_PATH);
    console.log("process.env.PUPPETEER_CACHE_DIR =", process.env.PUPPETEER_CACHE_DIR);
    console.log("process.env.PUPPETEER_SKIP_DOWNLOAD =", process.env.PUPPETEER_SKIP_DOWNLOAD);
    
    const candidates: string[] = [];

    try {
      const browserPath = await puppeteer.executablePath();
      console.log("puppeteer.executablePath() =", browserPath);
      if (browserPath) candidates.push(browserPath);
    } catch (e: any) {
      console.log("puppeteer.executablePath() threw:", e?.message || e);
    }

    const envPath = process.env.PUPPETEER_EXECUTABLE_PATH;
    if (envPath) {
      console.log("Adding env path:", envPath);
      candidates.push(envPath);
    }

    const cacheDir = process.env.PUPPETEER_CACHE_DIR || path.join(os.homedir(), ".cache", "puppeteer");
    console.log("Cache dir:", cacheDir);
    const browserDirs = ["chrome", "chrome-headless-shell"];
    for (const dirName of browserDirs) {
      try {
        const browserDir = path.join(cacheDir, dirName);
        if (fs.existsSync(browserDir)) {
          const entries = fs.readdirSync(browserDir);
          for (const entry of entries) {
            const platformDir = path.join(browserDir, entry);
            if (fs.statSync(platformDir).isDirectory()) {
              const files = fs.readdirSync(platformDir);
              for (const file of files) {
                candidates.push(path.join(platformDir, file, process.platform === "win32" ? `${dirName}.exe` : dirName));
              }
            }
          }
        }
      } catch {}
    }

    const linuxPaths = [
      "/usr/bin/chromium-browser", "/usr/bin/chromium",
      "/usr/bin/google-chrome", "/usr/bin/google-chrome-stable",
      "/snap/bin/chromium",
    ];
    candidates.push(...linuxPaths);

    console.log("All candidates:", candidates);
    for (const p of candidates) {
      const exists = p && fs.existsSync(p);
      console.log("Candidate:", p, "exists:", exists);
      if (exists) {
        console.log("=== USING:", p, "===");
        return p;
      }
    }

    console.log("=== NO CHROMIUM FOUND ===");
    return undefined;
  }

  private async createClient() {
    const executablePath = await this.resolveExecutablePath();
    const args = [
      "--no-sandbox",
      "--disable-setuid-sandbox",
      "--disable-dev-shm-usage",
      "--disable-gpu",
      "--disable-background-timer-throttling",
      "--disable-backgrounding-occluded-windows",
      "--disable-renderer-backgrounding",
      "--disable-web-security",
      "--disable-features=IsolateOrigins,site-per-process",
      "--single-process",
      "--no-zygote",
    ];
    const opts: Record<string, any> = {
      headless: true,
      args,
      defaultViewport: { width: 1280, height: 720 },
    };
    if (executablePath) opts.executablePath = executablePath;
    console.log("WhatsApp puppeteer config:", JSON.stringify({ executablePath, argsCount: args.length, headless: opts.headless }));
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
    let lastError: any;
    for (let attempt = 1; attempt <= 3; attempt++) {
      try {
        await this.tryInit();
        return;
      } catch (err: any) {
        lastError = err;
        console.error(`WhatsApp init attempt ${attempt}/3 failed:`, err?.message || err);
        if (err?.stack) console.error("Stack:", err.stack.split("\n").slice(0, 4).join("\n"));
        await this.destroy();
        this.cleanSession();
        if (attempt < 3) {
          const delay = attempt * 5000;
          console.log(`Retrying in ${delay}ms...`);
          await new Promise((r) => setTimeout(r, delay));
        }
      }
    }
    console.error("WhatsApp: all 3 init attempts failed — service unavailable");
    this._error = lastError?.message || "Init failed after 3 attempts";
    this.initializing = false;
    this.initPromise = null;
  }

  private async tryInit(): Promise<void> {
    return new Promise<void>(async (resolve, reject) => {
      let qrTimer: ReturnType<typeof setTimeout> | null = null;

      try {
        const client = await this.createClient();
        this.client = client;

        const onQr = async (qr: string) => {
          this._qr = qr;
          this._ready = false;
          this._error = null;
          try {
            this._qrBase64 = await QR.toDataURL(qr);
          } catch {
            this._qrBase64 = null;
          }
          console.log("WhatsApp QR code generated");
        };

        const onReady = () => {
          this._ready = true;
          this._qr = null;
          this._qrBase64 = null;
          this._error = null;
          if (qrTimer) clearTimeout(qrTimer);
          console.log("WhatsApp client is ready!");
          this.startHeartbeat();
          this.drainQueue();
          resolve();
        };

        const onDisconnected = (reason: string) => {
          this._ready = false;
          this.stopHeartbeat();
          this.client = null;
          this.initializing = false;
          this.initPromise = null;
          if (qrTimer) clearTimeout(qrTimer);
          console.log("WhatsApp client disconnected:", reason);
          if (reason !== "LOGOUT") {
            console.log("Auto-reconnecting WhatsApp...");
            this.init().catch(() => {});
          }
        };

        const onAuthFailure = (msg: string) => {
          this._error = msg || "Auth failure";
          console.error("WhatsApp auth failure:", this._error);
          this._ready = false;
          this.client = null;
          this.initializing = false;
          this.initPromise = null;
          if (qrTimer) clearTimeout(qrTimer);
          resolve();
        };

        client.on("qr", onQr);
        client.on("ready", onReady);
        client.on("disconnected", onDisconnected);
        client.on("auth_failure", onAuthFailure);

        // Timeout: if no QR or ready within 60s, restart
        qrTimer = setTimeout(() => {
          console.log("WhatsApp: QR timeout — no QR received within 60s, destroying client");
          client.removeListener("qr", onQr);
          client.removeListener("ready", onReady);
          client.removeListener("disconnected", onDisconnected);
          client.removeListener("auth_failure", onAuthFailure);
          client.destroy().catch(() => {});
          reject(new Error("QR timeout after 60s"));
        }, 60000);

        client.initialize().catch((err) => {
          if (qrTimer) clearTimeout(qrTimer);
          reject(err);
        });
      } catch (err: any) {
        if (qrTimer) clearTimeout(qrTimer);
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
