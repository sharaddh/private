import type { ReactNode } from "react";

interface StatCardProps {
  title: string;
  value: string | number;
  icon: ReactNode;
  color?: "primary" | "emerald" | "blue" | "amber" | "red" | "purple" | "cyan";
  subtitle?: string;
  onClick?: () => void;
}

const colorClasses = {
  primary: { bg: "bg-[#1ed760]/10 ring-[#1ed760]/30", text: "text-[#1ed760]", icon: "text-[#1ed760]" },
  emerald: { bg: "bg-[#1ed760]/10 ring-[#1ed760]/30", text: "text-[#1ed760]", icon: "text-[#1ed760]" },
  blue: { bg: "bg-[#509bf5]/10 ring-[#509bf5]/30", text: "text-[#509bf5]", icon: "text-[#509bf5]" },
  amber: { bg: "bg-[#f59e0b]/10 ring-[#f59e0b]/30", text: "text-[#f59e0b]", icon: "text-[#f59e0b]" },
  red: { bg: "bg-[#e91429]/10 ring-[#e91429]/30", text: "text-[#e91429]", icon: "text-[#e91429]" },
  purple: { bg: "bg-[#af2896]/10 ring-[#af2896]/30", text: "text-[#af2896]", icon: "text-[#af2896]" },
  cyan: { bg: "bg-[#509bf5]/10 ring-[#509bf5]/30", text: "text-[#509bf5]", icon: "text-[#509bf5]" },
};

export default function StatCard({ title, value, icon, color = "primary", subtitle, onClick }: StatCardProps) {
  const cc = colorClasses[color];

  return (
    <div onClick={onClick}
      className={`bg-th-surface rounded-[8px] p-4 transition-all duration-200 hover:bg-th-card ${onClick ? "cursor-pointer active:scale-[0.95]" : ""}`}
    >
      <div className="flex items-center gap-3">
        <div className={`w-11 h-11 ${cc.bg} rounded-[8px] flex items-center justify-center ${cc.icon} ring-1 flex-shrink-0`}>
          {icon}
        </div>
        <div className="min-w-0">
          <p className="text-[22px] font-bold text-th-text tracking-tight">{value}</p>
          <p className="text-[13px] text-th-secondary truncate">{title}</p>
        </div>
      </div>
      {subtitle && <p className="text-[11px] text-th-secondary mt-1.5 ml-[3.25rem]">{subtitle}</p>}
    </div>
  );
}
