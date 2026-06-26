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
  primary: { bg: "bg-primary-50 dark:bg-primary-500/10", text: "text-primary-600 dark:text-primary-400", icon: "text-primary-500 dark:text-primary-400", ring: "ring-primary-500/20" },
  emerald: { bg: "bg-emerald-50 dark:bg-emerald-500/10", text: "text-emerald-600 dark:text-emerald-400", icon: "text-emerald-500 dark:text-emerald-400", ring: "ring-emerald-500/20" },
  blue: { bg: "bg-blue-50 dark:bg-blue-500/10", text: "text-blue-600 dark:text-blue-400", icon: "text-blue-500 dark:text-blue-400", ring: "ring-blue-500/20" },
  amber: { bg: "bg-amber-50 dark:bg-amber-500/10", text: "text-amber-600 dark:text-amber-400", icon: "text-amber-500 dark:text-amber-400", ring: "ring-amber-500/20" },
  red: { bg: "bg-red-50 dark:bg-red-500/10", text: "text-red-600 dark:text-red-400", icon: "text-red-500 dark:text-red-400", ring: "ring-red-500/20" },
  purple: { bg: "bg-purple-50 dark:bg-purple-500/10", text: "text-purple-600 dark:text-purple-400", icon: "text-purple-500 dark:text-purple-400", ring: "ring-purple-500/20" },
  cyan: { bg: "bg-cyan-50 dark:bg-cyan-500/10", text: "text-cyan-600 dark:text-cyan-400", icon: "text-cyan-500 dark:text-cyan-400", ring: "ring-cyan-500/20" },
};

export default function StatCard({ title, value, icon, color = "primary", subtitle, onClick }: StatCardProps) {
  const cc = colorClasses[color];

  return (
    <div onClick={onClick}
      className={`card p-4 transition-all duration-300 ${onClick ? "cursor-pointer hover:-translate-y-0.5 hover:shadow-glass-lg" : ""}`}
    >
      <div className="flex items-center gap-3">
        <div className={`w-10 h-10 ${cc.bg} rounded-xl flex items-center justify-center ${cc.icon} ring-1 ${cc.ring} flex-shrink-0`}>
          {icon}
        </div>
        <div className="min-w-0">
          <p className="text-xl font-bold text-muted-900 dark:text-white tracking-tight">{value}</p>
          <p className="text-xs text-muted-500 dark:text-muted-400 truncate">{title}</p>
        </div>
      </div>
      {subtitle && <p className="text-[10px] text-muted-400 dark:text-muted-500 mt-1.5 ml-[3.25rem]">{subtitle}</p>}
    </div>
  );
}
