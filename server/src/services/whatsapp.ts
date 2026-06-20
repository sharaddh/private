import { Client, LocalAuth } from "whatsapp-web.js";
import * as QR from "qrcode";

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

  async init() {
    if (this.client) return;
    if (this.initializing) return this.initPromise;
    this.initializing = true;

    this.initPromise = new Promise<void>((resolve) => {
      try {
        this.client = new Client({
          authStrategy: new LocalAuth({ dataPath: ".wwebjs_auth" }),
          puppeteer: {
            headless: true,
            args: ["--no-sandbox", "--disable-setuid-sandbox", "--disable-dev-shm-usage", "--disable-gpu"],
          },
        });

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
          resolve();
        });

        this.client.initialize().catch((err) => {
          this._error = err?.message || "Failed to initialize";
          console.error("WhatsApp init error:", this._error);
          this.initializing = false;
          resolve();
        });
      } catch (err: any) {
        this._error = err?.message || "Failed to create client";
        console.error("WhatsApp create error:", this._error);
        this.initializing = false;
        resolve();
      }
    });

    return this.initPromise;
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
      await this.client.destroy();
      this.client = null;
    }
    this._ready = false;
    this._qr = null;
    this._qrBase64 = null;
    this._error = null;
    this.initializing = false;
  }
}

export const whatsapp = new WhatsAppService();
