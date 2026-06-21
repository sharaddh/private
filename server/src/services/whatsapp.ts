import { Client, LocalAuth, MessageMedia } from "whatsapp-web.js";
import * as QR from "qrcode";
import * as fs from "fs";
import * as path from "path";

class WhatsAppService {
  private client: Client | null = null;
  private _ready = false;
  private _qr: string | null = null;
  private _qrBase64: string | null = null;
  private _error: string | null = null;
  private initializing = false;
  private initPromise: Promise<void> | null = null;

  get ready() { return this._ready; }
  get qr() { return this._qr; }
  get qrBase64() { return this._qrBase64; }
  get error() { return this._error; }

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
    return new Client({
      authStrategy: new LocalAuth({ dataPath: ".wwebjs_auth" }),
      puppeteer: {
        headless: true,
        args: ["--no-sandbox", "--disable-setuid-sandbox", "--disable-dev-shm-usage", "--disable-gpu"],
      },
      webVersion: "2.2412.54",
      webVersionCache: {
        type: "remote",
        remotePath: "https://raw.githubusercontent.com/wppconnect-team/wa-js/master/src/api/js/waVersion.js",
      },
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
      console.error("WhatsApp first init attempt failed:", err?.message);
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
          resolve();
        });

        this.client.on("disconnected", (reason) => {
          this._ready = false;
          console.log("WhatsApp client disconnected:", reason);
        });

        this.client.on("auth_failure", (msg: string) => {
          this._error = msg || "Auth failure";
          console.error("WhatsApp auth failure:", this._error);
          this._ready = false;
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

  async sendMessage(phone: string, message: string): Promise<boolean> {
    if (!this._ready || !this.client) return false;
    try {
      const formatted = phone.replace(/[^0-9]/g, "");
      const chatId = `${formatted}@c.us`;
      await this.client.sendMessage(chatId, message);
      return true;
    } catch (err) {
      console.error("WhatsApp send error:", err);
      return false;
    }
  }

  async sendMedia(phone: string, base64: string, filename: string, caption?: string): Promise<boolean> {
    if (!this._ready || !this.client) {
      console.error("WhatsApp sendMedia: client not ready");
      return false;
    }
    try {
      const formatted = phone.replace(/[^0-9]/g, "");
      const chatId = `${formatted}@c.us`;
      console.log(`WhatsApp sendMedia: sending to ${chatId}, filename: ${filename}, base64 length: ${base64.length}`);
      console.log("WhatsApp sendMedia: creating MessageMedia object");
      const media = new MessageMedia("application/pdf", base64, filename);
      console.log("WhatsApp sendMedia: MessageMedia created, sending message");
      await this.client.sendMessage(chatId, media, { caption: caption || "" });
      console.log("WhatsApp sendMedia: sent successfully");
      return true;
    } catch (err) {
      console.error("WhatsApp sendMedia error:", err);
      return false;
    }
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
    if (this._ready) return { status: "connected" };
    if (this._qr) return { status: "qr", qr: this._qrBase64 };
    return { status: "initializing" };
  }

  async destroy() {
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
