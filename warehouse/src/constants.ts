export const CATEGORIES = ["Lens"] as const;
export const LOCATIONS = ["warehouse", "shop"] as const;
export const INVENTORY_TYPES = ["lens"] as const;
export const GENDERS = ["", "Male", "Female", "Unisex"] as const;
export const LOW_STOCK_THRESHOLD = 5;
export const PAGE_SIZE = 20;
export const SEARCH_DEBOUNCE_MS = 300;
export const TOAST_DURATION_MS = 4000;
export const API_TIMEOUT_MS = 30000;
export const API_RETRIES = 1;

export const LENS_TYPES = ["sph", "cyl", "compound"] as const;
export const LENS_TYPE_LABELS: Record<string, string> = {
  sph: "SPH (Spherical)",
  cyl: "CYL (Cylindrical)",
  compound: "Compound",
};

function generatePowerValues(): string[] {
  const values: string[] = [];
  for (let i = 0; i <= 24; i++) {
    const num = i * 0.25;
    const formatted = num.toFixed(2);
    values.push(`+${formatted}`);
    if (num > 0) values.unshift(`-${formatted}`);
  }
  return values;
}

export const POWER_VALUES = generatePowerValues();

