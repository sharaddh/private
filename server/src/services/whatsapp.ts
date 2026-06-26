import { Client, LocalAuth, MessageMedia } from "whatsapp-web.js";
import * as QR from "qrcode";
import * as fs from "fs";
import * as path from "path";
import * as os from "os";
import { execSync } from "child_process";
import puppeteer from "puppeteer";
import puppeteerExtra from "puppeteer-extra";
import StealthPlugin from "puppeteer-extra-plugin-stealth";

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
  private _pairingCode: string | null = null;
  private initializing = false;
  private initPromise: Promise<void> | null = null;
  private messageQueue: QueueItem[] = [];
  private heartbeatTimer: ReturnType<typeof setInterval> | null = null;
  private drainInProgress = false;

  get ready() { return this._ready; }
  get qr() { return this._qr; }
  get qrBase64() { return this._qrBase64; }
  get error() { return this._error; }
  get pairingCode() { return this._pairingCode; }
  get queueLength() { return this.messageQueue.length; }

  private get sessionPath() {
    return path.resolve(process.cwd(), ".wwebjs_auth");
  }

  private cleanSession() {
    const sessionDir = this.sessionPath;
    if (fs.existsSync(sessionDir)) {
      try {
        fs.rmSync(sessionDir, { recursive: true, force: true });
        console.log("Cleaned WhatsApp session directory");
      } catch (e) {
        console.error("Failed to clean session directory:", e);
      }
    }
  }

  private stealthPatched = false;

  private patchPuppeteer() {
    if (this.stealthPatched) return;
    puppeteerExtra.use(StealthPlugin());
    const Module = require("module");
    const orig = Module.prototype.require;
    Module.prototype.require = function (id: string) {
      if (id === "puppeteer") return puppeteerExtra;
      return orig.apply(this, arguments);
    };
    this.stealthPatched = true;
    console.log("WhatsApp: puppeteer-extra stealth patched");
  }

  private async resolveExecutablePath(): Promise<string | undefined> {
    const envPath = process.env.PUPPETEER_EXECUTABLE_PATH;
    if (envPath && fs.existsSync(envPath)) {
      console.log("WhatsApp: using PUPPETEER_EXECUTABLE_PATH =", envPath);
      return envPath;
    }

    const systemPaths = [
      "/usr/bin/chromium-browser",
      "/usr/bin/chromium",
      "/usr/bin/google-chrome",
      "/usr/bin/google-chrome-stable",
      "/snap/bin/chromium",
    ];
    for (const p of systemPaths) {
      if (fs.existsSync(p)) {
        console.log("WhatsApp: found system Chrome at", p);
        return p;
      }
    }

    try {
      const browserPath = await puppeteer.executablePath();
      if (browserPath && fs.existsSync(browserPath)) {
        console.log("WhatsApp: using puppeteer.executablePath =", browserPath);
        return browserPath;
      }
    } catch (e: any) {
      console.log("WhatsApp: puppeteer.executablePath() threw:", e?.message);
    }

    console.log("WhatsApp: Chrome not found — attempting auto-install...");
    try {
      execSync("npx puppeteer browsers install chrome", { stdio: "pipe", timeout: 120000 });
      const installed = await puppeteer.executablePath();
      if (installed && fs.existsSync(installed)) {
        console.log("WhatsApp: auto-installed Chrome at", installed);
        return installed;
      }
    } catch (installErr: any) {
      console.warn("WhatsApp: auto-install failed:", installErr?.message);
    }

    console.log("WhatsApp: no Chrome binary found");
    return undefined;
  }

  private async createClient() {
    this.patchPuppeteer();
    const executablePath = await this.resolveExecutablePath();
    const args = [
      "--no-sandbox",
      "--disable-setuid-sandbox",
      "--disable-dev-shm-usage",
      "--use-gl=swiftshader",
      "--disable-background-timer-throttling",
      "--disable-backgrounding-occluded-windows",
      "--disable-renderer-backgrounding",
      "--no-zygote",
      "--no-first-run",
      "--no-default-browser-check",
      "--disable-features=TranslateUI,ChromeWhatsNewUI,ChromeInProductHelp,StorageBuckets",
      "--disk-cache-size=10485760",
    ];
    const opts: Record<string, any> = {
      headless: true,
      args,
      defaultViewport: { width: 800, height: 600 },
    };
    if (executablePath) opts.executablePath = executablePath;
    console.log("WhatsApp puppeteer config:", JSON.stringify({ executablePath, argsCount: args.length, headless: opts.headless }));
    return new Client({
      authStrategy: new LocalAuth({ dataPath: this.sessionPath }),
      puppeteer: opts,
      userAgent: "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/149.0.0.0 Safari/537.36",
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
          const delay = attempt * 10000;
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
      let diagTimer: ReturnType<typeof setTimeout> | null = null;

      try {
        const client = await this.createClient();
        this.client = client;

        client.on("loading_screen", (percent: any, message) => {
          const p = Number(percent);
          if (p && p % 25 === 0) console.log(`WhatsApp loading: ${p}% ${message || ""}`);
        });

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

        // Diagnostic: capture screenshot + console errors at 25s to debug QR timeout
        diagTimer = setTimeout(async () => {
          try {
            const page = (client as any).pupPage;
            if (!page) { console.log("WhatsApp diag: no pupPage yet"); return; }
            const url = page.url();
            const title = await page.title().catch(() => "?");
            console.log("WhatsApp diag: URL =", url, "title =", title);
            const pageErrors = await page.evaluate(() => {
              const logs = (window as any).__wwjErrors || [];
              const errors = (window as any).__wwjPageErrors || [];
              return { logs: logs.slice(-10), errors: errors.slice(-5) };
            }).catch(() => ({}));
            if (pageErrors.logs?.length || pageErrors.errors?.length) {
              console.log("WhatsApp diag: console errors:", JSON.stringify(pageErrors));
            }
            const screenshot = await page.screenshot({ type: "png", encoding: "base64" }).catch(() => null);
            if (screenshot) {
              console.log("WhatsApp diag: screenshot captured (base64 length:", screenshot.length, ")");
              // Write screenshot to disk for debugging
              const screenshotPath = path.join(process.cwd(), ".whatsapp-diag.png");
              fs.writeFileSync(screenshotPath, screenshot, "base64");
              console.log("WhatsApp diag: screenshot saved to", screenshotPath);
            }
          } catch (e: any) {
            console.log("WhatsApp diag error:", e?.message);
          }
        }, 25000);

        // Timeout: if no QR or ready within 120s, restart (Render 512MB is slow)
        qrTimer = setTimeout(() => {
          if (diagTimer) clearTimeout(diagTimer);
          clearInterval(pollPage);
          console.log("WhatsApp: QR timeout — no QR received within 120s, destroying client");
          client.removeListener("qr", onQr);
          client.removeListener("ready", onReady);
          client.removeListener("disconnected", onDisconnected);
          client.removeListener("auth_failure", onAuthFailure);
          client.destroy().catch(() => {});
          reject(new Error("QR timeout after 120s"));
        }, 120000);

        client.initialize().catch((err) => {
          if (qrTimer) clearTimeout(qrTimer);
          if (diagTimer) clearTimeout(diagTimer);
          reject(err);
        });

        // Capture page console errors as soon as page becomes available
        const pollPage = setInterval(() => {
          const page = (client as any).pupPage;
          if (!page) return;
          clearInterval(pollPage);
          page.on("console", (msg: any) => {
            if (msg.type() === "error") console.log("WhatsApp page error:", msg.text());
          });
          page.on("pageerror", (err: any) => {
            console.log("WhatsApp page crash:", err?.message || err);
          });
          // Inject error capture into page context
          page.evaluate(() => {
            (window as any).__wwjErrors = [];
            (window as any).__wwjPageErrors = [];
            const orig = console.error;
            console.error = (...args: any[]) => {
              (window as any).__wwjErrors.push(args.map(String).join(" "));
              orig.apply(console, args);
            };
            window.addEventListener("error", (e: any) => {
              (window as any).__wwjPageErrors.push(e.message || String(e));
            });
          }).catch(() => {});
          console.log("WhatsApp: page error listeners attached");
        }, 200);
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

  async requestPairingCode(phoneNumber: string): Promise<string> {
    if (!this.client) throw new Error("WhatsApp not initialized");
    this._pairingCode = null;
    const code = await this.client.requestPairingCode(phoneNumber);
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
    this._pairingCode = null;
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
