import assert from "assert";
import { whatsappService } from "./whatsapp.service";
import { isWhatsAppConfigured } from "../config/whatsapp.config";

function run(): void {
  const status = whatsappService.getStatus();
  assert.ok(status, "getStatus should return a value");
  assert.ok(["connected", "error", "disconnected"].includes(status.status), "status should be valid");
  console.log(`WhatsApp status: ${status.status}`);
  console.log(`WhatsApp configured: ${isWhatsAppConfigured()}`);
}

run();
console.log("whatsapp service regression checks passed");
