import { useEffect, useRef, useState } from 'react';

interface AnimatedCounterProps {
  value: number | string;
  duration?: number;
  prefix?: string;
  className?: string;
}

export default function AnimatedCounter({
  value,
  duration = 600,
  prefix = '',
  className = '',
}: AnimatedCounterProps) {
  const [display, setDisplay] = useState<string>(prefix + String(value));
  const frameRef = useRef<number>(0);
  const shownRef = useRef<string>(String(value));

  useEffect(() => {
    const targetStr = String(value);

    if (targetStr === shownRef.current) return;
    shownRef.current = targetStr;

    const targetNum = typeof value === 'number' ? value : parseFloat(targetStr.replace(/[^0-9.-]/g, ''));
    const startStr = display;
    const startNum = parseFloat(startStr.replace(/[^0-9.-]/g, '')) || 0;

    if (isNaN(targetNum)) {
      const id = requestAnimationFrame(() => setDisplay(prefix + targetStr));
      frameRef.current = id;
      return () => cancelAnimationFrame(id);
    }

    const startTime = performance.now();

    const step = (now: number) => {
      const elapsed = now - startTime;
      const progress = Math.min(elapsed / duration, 1);
      const eased = 1 - Math.pow(1 - progress, 3);
      const current = Math.round(startNum + (targetNum - startNum) * eased);
      setDisplay(prefix + current.toLocaleString());
      if (progress < 1) {
        frameRef.current = requestAnimationFrame(step);
      }
    };

    frameRef.current = requestAnimationFrame(step);

    return () => cancelAnimationFrame(frameRef.current);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value, duration, prefix]);

  return <span className={className}>{display}</span>;
}
