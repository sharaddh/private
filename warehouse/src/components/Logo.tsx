import { Package } from "lucide-react";

interface Props {
  size?: "sm" | "md" | "lg";
  showText?: boolean;
}

const sizeMap = {
  sm: { box: "w-6 h-6", icon: 12, text: "text-xs" },
  md: { box: "w-8 h-8", icon: 16, text: "text-sm" },
  lg: { box: "w-12 h-12", icon: 24, text: "text-lg" },
};

export default function Logo({ size = "md", showText = false }: Props) {
  const s = sizeMap[size];
  return (
    <div className="flex items-center gap-2">
      <div className={`${s.box} bg-primary-500 rounded-md flex items-center justify-center flex-shrink-0`}>
        <Package size={s.icon} className="text-surface-950" />
      </div>
      {showText && (
        <div>
          <h1 className={`${s.text} font-bold text-th-text leading-tight`}>Lens Warehouse</h1>
          <p className="text-micro text-th-muted font-medium">KMJ Optical</p>
        </div>
      )}
    </div>
  );
}
