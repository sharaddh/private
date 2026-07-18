import { useRef, useCallback, type ReactNode } from "react";

interface ShineCardProps {
  children: ReactNode;
  className?: string;
  onClick?: (e?: React.MouseEvent) => void;
  role?: string;
  tabIndex?: number;
  onKeyDown?: (e: React.KeyboardEvent) => void;
  id?: string;
  "aria-label"?: string;
  style?: React.CSSProperties;
}

export default function ShineCard({ children, className = "", onClick, role, tabIndex, onKeyDown, id, "aria-label": ariaLabel, style }: ShineCardProps) {
  const ref = useRef<HTMLDivElement>(null);

  const onMove = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
    const el = ref.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    el.style.setProperty("--sx", `${e.clientX - rect.left}px`);
    el.style.setProperty("--sy", `${e.clientY - rect.top}px`);
  }, []);

  const onLeave = useCallback(() => {
    const el = ref.current;
    if (!el) return;
    el.style.setProperty("--sx", "-200px");
    el.style.setProperty("--sy", "-200px");
  }, []);

  return (
    <div
      ref={ref}
      onMouseMove={onMove}
      onMouseLeave={onLeave}
      onClick={onClick}
      role={role}
      tabIndex={tabIndex}
      onKeyDown={onKeyDown}
      id={id}
      aria-label={ariaLabel}
      style={style}
      className={`shine-card ${className}`}
    >
      {children}
    </div>
  );
}
