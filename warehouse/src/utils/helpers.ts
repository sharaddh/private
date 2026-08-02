export function formatCurrency(amount: number): string {
  return `₹${amount.toLocaleString("en-IN")}`;
}

export function formatDate(date: string | Date): string {
  return new Date(date).toLocaleDateString("en-IN", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

export function formatDateTime(date: string | Date): string {
  return new Date(date).toLocaleString("en-IN", {
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function capitalize(str: string): string {
  return str.charAt(0).toUpperCase() + str.slice(1);
}

export function lensTypeLabel(lensType: string): string {
  if (lensType === "compound") return "Compound";
  return (lensType || "").toUpperCase();
}

function normPower(v: string): string {
  return v === "+0.00" || v === "0.00" || v === "-0.00" ? "0.00" : v;
}

export function formatLensPower(powerKey: string): string {
  if (!powerKey) return "—";
  if (powerKey.includes("|")) {
    const [sph, cyl] = powerKey.split("|");
    return `SPH ${normPower(sph)} · CYL ${normPower(cyl)}`;
  }
  return normPower(powerKey);
}

export function powerSign(powerKey: string): "neg" | "pos" | "zero" {
  const first = powerKey.includes("|") ? powerKey.split("|")[0] : powerKey;
  if (first.startsWith("-")) return "neg";
  if (first === "+0.00" || first === "0.00" || first === "-0.00") return "zero";
  return "pos";
}

export function powerChipClass(powerKey: string): string {
  const s = powerSign(powerKey);
  if (s === "neg") return "bg-amber-400/15 text-amber-500";
  if (s === "pos") return "bg-emerald-400/15 text-emerald-500";
  return "bg-th-elevated text-th-secondary";
}

export function powerTextClass(powerKey: string): string {
  const s = powerSign(powerKey);
  if (s === "neg") return "text-amber-500";
  if (s === "pos") return "text-emerald-500";
  return "text-th-secondary";
}

export function truncate(str: string, max: number): string {
  return str.length > max ? str.slice(0, max) + "..." : str;
}

export function classNames(...classes: (string | false | null | undefined)[]): string {
  return classes.filter(Boolean).join(" ");
}
