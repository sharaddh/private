/**
 * Shared prescription formatting utilities.
 * Follows standard optometry notation:
 *   SPH -2.00 / CYL -1.25 × AXIS 180
 *   ADD +2.00   PD 62   VA 6/6
 */

function fmtVal(v: number | string): string {
  const n = typeof v === 'string' ? parseFloat(v) : v;
  if (isNaN(n)) return String(v);
  return n > 0 ? `+${n.toFixed(2)}` : n.toFixed(2);
}

/** Check if a single eye has any prescription data */
export function hasEyeData(eye: any): boolean {
  if (!eye || typeof eye !== 'object') return false;
  for (const sub of ['dv', 'nv', 'pc'] as const) {
    const section = eye[sub];
    if (section && typeof section === 'object') {
      for (const val of Object.values(section)) {
        if (val != null && val !== '') return true;
      }
    }
  }
  return false;
}

export function cleanEyeSet(e: any): Record<string, Record<string, any>> | undefined {
  if (!e || typeof e !== 'object') return undefined;
  const out: Record<string, Record<string, any>> = {};
  for (const k of ['dv', 'nv', 'pc'] as const) {
    if (e[k] && typeof e[k] === 'object') {
      const vals = Object.entries(e[k]).filter(([_, v]) => v != null && v !== '');
      if (vals.length) out[k] = Object.fromEntries(vals);
    }
  }
  return Object.keys(out).length ? out : undefined;
}

export function formatRxBrief(sph?: number, cyl?: number, axis?: number): string {
  if (sph == null && cyl == null) return 'Plain';
  const s = sph != null ? fmtVal(sph) : '—';
  const c = cyl != null ? fmtVal(cyl) : '—';
  const a = axis != null ? `×${axis}` : '';
  return `${s} / ${c}${a ? ` ${a}` : ''}`;
}

/** Compact single-line: +1.00 | +2.00 × 50 */
export function compactRx(
  dv?: Record<string, unknown>,
  nv?: Record<string, unknown>
): string | null {
  if (!dv && !nv) return null;
  const d = dv || nv;
  if (!d) return null;
  const sph = d.sph != null ? Number(d.sph) : null;
  const cyl = d.cyl != null ? Number(d.cyl) : null;
  const axis = d.axis != null ? Number(d.axis) : null;
  if (sph == null && cyl == null) return null;
  const s = sph != null ? fmtVal(sph) : '—';
  if (cyl != null && axis != null) return `${s} | ${fmtVal(cyl)} × ${axis}`;
  if (cyl != null) return `${s} | ${fmtVal(cyl)}`;
  return s;
}
