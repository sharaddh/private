import { Settings } from "../models/settings";
import { requireBranchId } from "../utils/scope";

interface SettingsData {
  shopName?: string;
  shopAddress?: string;
  shopPhone?: string;
  shopEmail?: string;
  adminWhatsApp?: string;
  logo?: string;
}

const UPDATE_WHITELIST = [
  "shopName",
  "shopAddress",
  "shopPhone",
  "shopEmail",
  "adminWhatsApp",
  "logo",
] as const;

const DEFAULT_SETTINGS = {
  shopName: "KMJ Optical",
  shopAddress: "",
  shopPhone: "",
  shopEmail: "",
  adminWhatsApp: "",
  logo: "",
};

export async function getSettings() {
  let settings = await Settings.findFirst();
  if (!settings) {
    settings = await Settings.create({ data: { ...DEFAULT_SETTINGS, branchId: requireBranchId() } });
    return settings;
  }
  return settings;
}

export async function updateSettings(data: SettingsData) {
  const filtered: Record<string, unknown> = {};
  for (const key of UPDATE_WHITELIST) {
    if (key in data) {
      filtered[key] = data[key];
    }
  }

  const existing = await Settings.findFirst();
  if (!existing) {
    return Settings.create({ data: { ...DEFAULT_SETTINGS, ...filtered, branchId: requireBranchId() } });
  }

  return Settings.update({ where: { id: existing.id }, data: filtered });
}
