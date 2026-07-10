/**
 * Shared prescription formatting utilities.
 * Follows standard optometry notation:
 *   SPH -2.00 / CYL -1.25 × AXIS 180
 *   ADD +2.00   PD 62   VA 6/6
 */

function fmtVal(v: number): string {
  return v > 0 ? `+${v.toFixed(2)}` : v.toFixed(2);
}

export function formatEyeRx(sph?: number, cyl?: number, axis?: number): string {
  if (sph == null && cyl == null) return "—";
  const parts: string[] = [];
  if (sph != null) parts.push(`SPH ${fmtVal(sph)}`);
  if (cyl != null) parts.push(`CYL ${fmtVal(cyl)}`);
  if (axis != null) parts.push(`× ${axis}`);
  return parts.join("  ");
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

export function formatRxBrief(sph?: number, cyl?: number, axis?: number): string {
  if (sph == null && cyl == null) return "—";
  const s = sph != null ? fmtVal(sph) : "—";
  const c = cyl != null ? fmtVal(cyl) : "—";
  const a = axis != null ? `×${axis}` : "";
  return `${s} / ${c}${a ? ` ${a}` : ""}`;
}
