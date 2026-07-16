/**
 * Shared prescription formatting utilities.
 * Follows standard optometry notation:
 *   SPH -2.00 / CYL -1.25 × AXIS 180
 *   ADD +2.00   PD 62   VA 6/6
 */

function fmtVal(v: number | string): string {
  const n = typeof v === "string" ? parseFloat(v) : v;
  if (isNaN(n)) return String(v);
  return n > 0 ? `+${n.toFixed(2)}` : n.toFixed(2);
}

export function formatEyeRx(sph?: number, cyl?: number, axis?: number): string {
  if (sph == null && cyl == null) return "Plain";
  const parts: string[] = [];
  if (sph != null) parts.push(`SPH ${fmtVal(sph)}`);
  if (cyl != null) parts.push(`CYL ${fmtVal(cyl)}`);
  if (axis != null) parts.push(`× ${axis}`);
  return parts.join("  ");
}

/** Check if a single eye has any prescription data */
export function hasEyeData(eye: any): boolean {
  if (!eye || typeof eye !== "object") return false;
  for (const sub of ["dv", "nv", "pc"] as const) {
    const section = eye[sub];
    if (section && typeof section === "object") {
      for (const val of Object.values(section)) {
        if (val != null && val !== "") return true;
      }
    }
  }
  return false;
}

export function formatFullRx(
  dv: Record<string, unknown> | undefined,
  nv: Record<string, unknown> | undefined,
  pd?: string | number | null,
): string | null {
  if (!dv?.sph && !nv?.sph) return null;
  const parts: string[] = [];

  if (dv?.sph != null || dv?.cyl != null || dv?.axis != null) {
    const s = dv.sph != null ? fmtVal(dv.sph as number) : "—";
    const c = dv.cyl != null ? fmtVal(dv.cyl as number) : "—";
    const a = dv.axis != null ? `× ${dv.axis}` : "—";
    parts.push(`DV  SPH ${s}  CYL ${c}  ${a}`);
    if (dv.va) parts.push(`VA ${dv.va}`);
  }

  if (nv?.sph != null || nv?.cyl != null || nv?.axis != null) {
    const s = nv.sph != null ? fmtVal(nv.sph as number) : "—";
    const c = nv.cyl != null ? fmtVal(nv.cyl as number) : "—";
    const a = nv.axis != null ? `× ${nv.axis}` : "—";
    parts.push(`NV  SPH ${s}  CYL ${c}  ${a}`);
  }

  if (dv?.sph != null && nv?.sph != null) {
    const add = (nv.sph as number) - (dv.sph as number);
    parts.push(`ADD ${fmtVal(add)}`);
  }

  if (pd) parts.push(`PD ${pd}`);
  return parts.length ? parts.join("\n") : null;
}

export function cleanEyeSet(e: any): Record<string, Record<string, any>> | undefined {
  if (!e || typeof e !== "object") return undefined;
  const out: Record<string, Record<string, any>> = {};
  for (const k of ["dv", "nv", "pc"] as const) {
    if (e[k] && typeof e[k] === "object") {
      const vals = Object.entries(e[k]).filter(([_, v]) => v != null && v !== "");
      if (vals.length) out[k] = Object.fromEntries(vals);
    }
  }
  return Object.keys(out).length ? out : undefined;
}

export function formatRxBrief(sph?: number, cyl?: number, axis?: number): string {
  if (sph == null && cyl == null) return "Plain";
  const s = sph != null ? fmtVal(sph) : "—";
  const c = cyl != null ? fmtVal(cyl) : "—";
  const a = axis != null ? `×${axis}` : "";
  return `${s} / ${c}${a ? ` ${a}` : ""}`;
}

/** Compact single-line: +1.00 | +2.00 × 50 */
export function compactRx(dv?: Record<string, unknown>, nv?: Record<string, unknown>): string | null {
  if (!dv && !nv) return null;
  const d = dv || nv;
  if (!d) return null;
  const sph = d.sph != null ? Number(d.sph) : null;
  const cyl = d.cyl != null ? Number(d.cyl) : null;
  const axis = d.axis != null ? Number(d.axis) : null;
  if (sph == null && cyl == null) return null;
  const s = sph != null ? fmtVal(sph) : "—";
  if (cyl != null && axis != null) return `${s} | ${fmtVal(cyl)} × ${axis}`;
  if (cyl != null) return `${s} | ${fmtVal(cyl)}`;
  return s;
}
