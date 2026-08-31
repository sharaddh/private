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
  const prevValue = useRef<string>(String(value));
  const frameRef = useRef<number>(0);

  useEffect(() => {
    const targetStr = String(value);
    if (targetStr === prevValue.current) return;

    const targetNum = typeof value === 'number' ? value : parseFloat(targetStr.replace(/[^0-9.-]/g, ''));
    const startStr = prevValue.current;
    const startNum = parseFloat(startStr.replace(/[^0-9.-]/g, '')) || 0;

    if (isNaN(targetNum)) {
      setDisplay(prefix + targetStr);
      prevValue.current = targetStr;
      return;
    }

    const startTime = performance.now();

    const animate = (now: number) => {
      const elapsed = now - startTime;
      const progress = Math.min(elapsed / duration, 1);
      const eased = 1 - Math.pow(1 - progress, 3);
      const current = Math.round(startNum + (targetNum - startNum) * eased);
      setDisplay(prefix + current.toLocaleString());
      if (progress < 1) {
        frameRef.current = requestAnimationFrame(animate);
      } else {
        prevValue.current = targetStr;
      }
    };

    cancelAnimationFrame(frameRef.current);
    frameRef.current = requestAnimationFrame(animate);

    return () => cancelAnimationFrame(frameRef.current);
  }, [value, duration, prefix]);

  return <span className={className}>{display}</span>;
}
