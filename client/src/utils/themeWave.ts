import { flushSync } from 'react-dom';

export type ThemeOrigin = {
  clientX: number;
  clientY: number;
};

type ViewTransitionDocument = Document & {
  startViewTransition?: (update: () => void) => { finished: Promise<void> };
};

const DURATION = 820;
const POINTS = 56;
const FRAMES = 30;

function buildWaterKeyframes(id: string, x: number, y: number): string {
  const width = window.innerWidth;
  const height = window.innerHeight;
  const reach = Math.hypot(Math.max(x, width - x), Math.max(y, height - y));
  const maxRadius = reach * 1.22 + 72;
  const drift = Math.min(14, Math.max(8, reach * 0.018));
  const rows: string[] = [];

  for (let frame = 0; frame <= FRAMES; frame += 1) {
    const t = frame / FRAMES;
    const eased = t * t * (3 - 2 * t);
    const radius = 2 + (maxRadius - 2) * eased;
    const phase = t * Math.PI * 4.4;
    const centerX = x + Math.cos(phase * 0.9) * drift * Math.sin(Math.PI * t);
    const centerY = y + Math.sin(phase * 0.75) * drift * 0.8 * Math.sin(Math.PI * t);
    const amplitude = 0.028 + 0.04 * Math.sin(Math.PI * t);
    const points: string[] = [];

    for (let point = 0; point < POINTS; point += 1) {
      const angle = (point / POINTS) * Math.PI * 2;
      const ripple =
        1 +
        amplitude * Math.sin(angle * 3 + phase) +
        amplitude * 0.52 * Math.sin(angle * 5 - phase * 1.35) +
        amplitude * 0.24 * Math.sin(angle * 9 + phase * 1.8);
      const r = radius * ripple;
      points.push(
        `${(centerX + Math.cos(angle) * r).toFixed(1)}px ${(centerY + Math.sin(angle) * r).toFixed(1)}px`
      );
    }

    rows.push(`${(t * 100).toFixed(2)}% { clip-path: polygon(${points.join(', ')}); }`);
  }

  return `
@keyframes ${id} {
  ${rows.join('\n  ')}
}
::view-transition-new(root) {
  animation: ${id} ${DURATION}ms linear both;
  will-change: clip-path;
}
`;
}

export function startThemeWave(origin: ThemeOrigin | undefined, applyTheme: () => void) {
  const doc = document as ViewTransitionDocument;
  const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  if (!doc.startViewTransition || reduceMotion) {
    applyTheme();
    return;
  }

  const x = origin?.clientX ?? window.innerWidth / 2;
  const y = origin?.clientY ?? window.innerHeight / 2;
  const id = `wh-theme-wave-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`;
  const style = document.createElement('style');
  style.dataset.themeWave = id;
  style.textContent = buildWaterKeyframes(id, x, y);
  document.head.appendChild(style);

  const cleanup = () => style.remove();
  const transition = doc.startViewTransition(() => {
    flushSync(applyTheme);
  });

  transition.finished.then(cleanup, cleanup);
}
