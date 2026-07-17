import { Settings } from "../models/settings";
import { AppError } from "../middleware/errorHandler";

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
  let settings = await Settings.findOne().lean();
  if (!settings) {
    settings = await Settings.create(DEFAULT_SETTINGS);
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

  let settings = await Settings.findOne();
  if (!settings) {
    settings = await Settings.create({ ...DEFAULT_SETTINGS, ...filtered });
    return settings;
  }

  Object.assign(settings, filtered);
  await settings.save();
  return settings;
}
