import { describe, it, expect } from "vitest";
import { whatsappService } from "./whatsapp.service";
import { isWhatsAppConfigured } from "../config/whatsapp.config";

describe("whatsapp.service", () => {
  it("returns a valid status object", () => {
    const status = whatsappService.getStatus();
    expect(status).toBeTruthy();
    expect(["connected", "error", "disconnected"]).toContain(status.status);
  });

  it("reports configuration state without throwing", () => {
    expect(() => isWhatsAppConfigured()).not.toThrow();
  });
});
