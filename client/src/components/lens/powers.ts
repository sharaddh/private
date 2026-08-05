export type TabKey = "sph" | "cyl" | "compound" | "plain";

export const TABS: { key: TabKey; label: string }[] = [
  { key: "sph", label: "SPH" },
  { key: "cyl", label: "CYL" },
  { key: "compound", label: "Compound" },
  { key: "plain", label: "Plain" },
];

export const ZERO_KEYS = ["+0.00", "0.00", "-0.00"];

export function getTotalQty(item: { quantities?: Record<string, Record<string, number>> } | null | undefined): number {
  if (!item) return 0;
  const q = item.quantities as Record<string, Record<string, number>> | undefined || {};
  let total = 0;
  for (const lensType of ["sph", "cyl", "compound"]) {
    const map = q[lensType];
    if (map) {
      for (const v of Object.values(map)) {
        total += (v as number);
      }
    }
  }
  return total;
}

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

export const NEGATIVE_POWERS = POWER_VALUES.filter((p) => p.startsWith("-") && p !== "-0.00").reverse();
export const POSITIVE_POWERS = POWER_VALUES.filter((p) => p.startsWith("+") && p !== "+0.00");

export const CYL_RANGE = POWER_VALUES.filter((p) => {
  const n = parseFloat(p);
  return n >= -2 && n <= 2;
});
export const NEG_CYL = CYL_RANGE.filter((p) => p.startsWith("-")).reverse();
export const POS_CYL = CYL_RANGE.filter((p) => p.startsWith("+") && p !== "+0.00");

export const SPH_INNER = POWER_VALUES.filter((p) => {
  const n = parseFloat(p);
  return (n >= -6 && n <= -0.25) || (n >= 0.25 && n <= 6);
});
export const NEG_SPH_INNER = SPH_INNER.filter((p) => p.startsWith("-")).reverse();
export const POS_SPH_INNER = SPH_INNER.filter((p) => p.startsWith("+") && p !== "+0.00");
