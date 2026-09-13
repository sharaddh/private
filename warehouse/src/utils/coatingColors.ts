export const COATING_COLORS = [
  { text: 'text-sky-500', border: 'border-sky-500/40', softBg: 'bg-sky-500/10', ring: 'ring-sky-500/20', dot: 'bg-sky-500' },
  { text: 'text-violet-500', border: 'border-violet-500/40', softBg: 'bg-violet-500/10', ring: 'ring-violet-500/20', dot: 'bg-violet-500' },
  { text: 'text-rose-500', border: 'border-rose-500/40', softBg: 'bg-rose-500/10', ring: 'ring-rose-500/20', dot: 'bg-rose-500' },
  { text: 'text-teal-500', border: 'border-teal-500/40', softBg: 'bg-teal-500/10', ring: 'ring-teal-500/20', dot: 'bg-teal-500' },
  { text: 'text-orange-500', border: 'border-orange-500/40', softBg: 'bg-orange-500/10', ring: 'ring-orange-500/20', dot: 'bg-orange-500' },
  { text: 'text-fuchsia-500', border: 'border-fuchsia-500/40', softBg: 'bg-fuchsia-500/10', ring: 'ring-fuchsia-500/20', dot: 'bg-fuchsia-500' },
  { text: 'text-indigo-500', border: 'border-indigo-500/40', softBg: 'bg-indigo-500/10', ring: 'ring-indigo-500/20', dot: 'bg-indigo-500' },
  { text: 'text-lime-600', border: 'border-lime-500/40', softBg: 'bg-lime-500/10', ring: 'ring-lime-500/20', dot: 'bg-lime-500' },
];

export function coatingColor(name: string) {
  let h = 0;
  for (let i = 0; i < name.length; i++) h = (h * 31 + name.charCodeAt(i)) | 0;
  return COATING_COLORS[Math.abs(h) % COATING_COLORS.length];
}