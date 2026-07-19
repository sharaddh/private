export function normalizePhone(phone: string): string {
  const digits = phone.replace(/\D/g, "");
  if (digits.length === 10) return "91" + digits;
  if (digits.length === 11 && digits.startsWith("0")) return "91" + digits.slice(1);
  if (digits.length === 12 && digits.startsWith("91")) return digits;
  if (digits.length === 13 && digits.startsWith("91")) return digits;
  if (digits.length > 13 && digits.startsWith("91")) return "91" + digits.slice(digits.length - 10);
  if (digits.length > 13) return "91" + digits.slice(digits.length - 10);
  return digits;
}

export function toWhatsAppJID(phone: string): string {
  return phone + "@s.whatsapp.net";
}

export function isValidWhatsAppPhone(phone: string): boolean {
  const digits = phone.replace(/\D/g, "");
  if (digits.length === 12 && digits.startsWith("91")) return true;
  if (digits.length === 13 && digits.startsWith("91")) return true;
  return false;
}
