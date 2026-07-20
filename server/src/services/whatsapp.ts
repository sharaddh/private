import { whatsappService } from "./whatsapp.service";

class WhatsAppCompat {
  async sendMessage(phone: string, message: string) {
    const res = await whatsappService.sendText(phone, message);
    return { ok: res.success, error: res.message };
  }

  async sendMedia(phone: string, base64: string, filename: string, mimetype: string, caption?: string, _throwOnError?: boolean) {
    const res = await whatsappService.sendMedia(phone, base64, filename, mimetype, caption);
    return { ok: res.success, error: res.message };
  }

  async broadcast(
    numbers: string[],
    message: string,
    antiban?: { delayMin?: number; delayMax?: number; batchSize?: number; pause?: number },
    media?: { base64: string; filename: string; mimetype: string }
  ) {
    return whatsappService.broadcast(numbers, message, undefined, antiban, media);
  }

  abortBroadcast() {
    whatsappService.abortBroadcast();
  }

  async getStatus() {
    return whatsappService.getStatus();
  }
}

class WhatsAppManagerCompat {
  private instance = new WhatsAppCompat();

  getInstance(_branchKey?: string | null) {
    return this.instance;
  }

  async initAll(_branchKeys: string[]) {
    // No-op for Cloud API
  }

  async clearAllStaleAuth() {
    // No-op for Cloud API
  }
}

export const whatsappManager = new WhatsAppManagerCompat();
export const whatsapp = whatsappManager.getInstance();
