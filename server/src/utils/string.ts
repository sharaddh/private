export function escapeRegex(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

export function normalizeSku(sku: string): string {
  return String(sku || "")
    .trim()
    .toUpperCase()
    .replace(/\s+/g, "");
}
