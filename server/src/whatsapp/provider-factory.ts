import { getWhatsAppConfig } from "./config";
import { MetaWhatsAppCloudProvider } from "./meta.provider";
import { MockWhatsAppProvider } from "./mock.provider";
import type { WhatsAppProvider } from "./provider";

const mock = new MockWhatsAppProvider();
const meta = new MetaWhatsAppCloudProvider();

export function getWhatsAppProvider(): WhatsAppProvider {
  return getWhatsAppConfig().provider === "meta" ? meta : mock;
}
