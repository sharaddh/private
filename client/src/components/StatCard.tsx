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
  primary: { bg: "bg-primary-50 dark:bg-primary-900/20 ring-primary-200 dark:ring-primary-800", text: "text-primary-600 dark:text-primary-400", icon: "text-primary-600 dark:text-primary-400" },
  emerald: { bg: "bg-emerald-50 dark:bg-emerald-900/20 ring-emerald-200 dark:ring-emerald-800", text: "text-emerald-600 dark:text-emerald-400", icon: "text-emerald-600 dark:text-emerald-400" },
  blue: { bg: "bg-blue-50 dark:bg-blue-900/20 ring-blue-200 dark:ring-blue-800", text: "text-blue-600 dark:text-blue-400", icon: "text-blue-600 dark:text-blue-400" },
  amber: { bg: "bg-amber-50 dark:bg-amber-900/20 ring-amber-200 dark:ring-amber-800", text: "text-amber-600 dark:text-amber-400", icon: "text-amber-600 dark:text-amber-400" },
  red: { bg: "bg-red-50 dark:bg-red-900/20 ring-red-200 dark:ring-red-800", text: "text-red-600 dark:text-red-400", icon: "text-red-600 dark:text-red-400" },
  purple: { bg: "bg-purple-50 dark:bg-purple-900/20 ring-purple-200 dark:ring-purple-800", text: "text-purple-600 dark:text-purple-400", icon: "text-purple-600 dark:text-purple-400" },
  cyan: { bg: "bg-cyan-50 dark:bg-cyan-900/20 ring-cyan-200 dark:ring-cyan-800", text: "text-cyan-600 dark:text-cyan-400", icon: "text-cyan-600 dark:text-cyan-400" },
};

export default function StatCard({ title, value, icon, color = "primary", subtitle, onClick }: StatCardProps) {
  const cc = colorClasses[color];

  return (
    <div onClick={onClick}
      className={`card transition-all duration-300 ${onClick ? "cursor-pointer hover:shadow-md hover:-translate-y-0.5" : ""}`}
    >
      <div className="flex items-center gap-3">
        <div className={`w-11 h-11 ${cc.bg} rounded-xl flex items-center justify-center ${cc.icon} ring-1 flex-shrink-0`}>
          {icon}
        </div>
        <div className="min-w-0">
          <p className="text-xl font-bold text-slate-900 dark:text-white tracking-tight">{value}</p>
          <p className="text-xs text-slate-500 dark:text-slate-400 truncate">{title}</p>
        </div>
      </div>
      {subtitle && <p className="text-[10px] text-slate-400 dark:text-slate-500 mt-1.5 ml-[3.25rem]">{subtitle}</p>}
    </div>
  );
}
