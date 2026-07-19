export function normalizeWhatsAppPhone(phone: string): string {
  const digits = String(phone || "").replace(/\D/g, "");
  if (!digits) return "";

  if (digits.length === 10) return `91${digits}`;
  if (digits.length === 11 && digits.startsWith("0")) return `91${digits.slice(1)}`;
  if (digits.length === 12 && digits.startsWith("91")) return digits;
  if (digits.length === 13 && digits.startsWith("91")) return digits;
  if (digits.length > 13 && digits.startsWith("91")) return `91${digits.slice(digits.length - 10)}`;
  if (digits.length > 13) return `91${digits.slice(digits.length - 10)}`;

  return digits;
}
