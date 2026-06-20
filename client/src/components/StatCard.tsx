import React from "react";

interface StatCardProps {
  title: string;
  value: string | number;
  icon: React.ReactNode;
  color: "indigo" | "emerald" | "blue" | "amber" | "red" | "purple" | "cyan";
  subtitle?: string;
  onClick?: () => void;
}

const colorClasses = {
  indigo: { bg: "bg-indigo-50 dark:bg-indigo-900/30", text: "text-indigo-600 dark:text-indigo-400", icon: "text-indigo-500 dark:text-indigo-400" },
  emerald: { bg: "bg-emerald-50 dark:bg-emerald-900/30", text: "text-emerald-600 dark:text-emerald-400", icon: "text-emerald-500 dark:text-emerald-400" },
  blue: { bg: "bg-blue-50 dark:bg-blue-900/30", text: "text-blue-600 dark:text-blue-400", icon: "text-blue-500 dark:text-blue-400" },
  amber: { bg: "bg-amber-50 dark:bg-amber-900/30", text: "text-amber-600 dark:text-amber-400", icon: "text-amber-500 dark:text-amber-400" },
  red: { bg: "bg-red-50 dark:bg-red-900/30", text: "text-red-600 dark:text-red-400", icon: "text-red-500 dark:text-red-400" },
  purple: { bg: "bg-purple-50 dark:bg-purple-900/30", text: "text-purple-600 dark:text-purple-400", icon: "text-purple-500 dark:text-purple-400" },
  cyan: { bg: "bg-cyan-50 dark:bg-cyan-900/30", text: "text-cyan-600 dark:text-cyan-400", icon: "text-cyan-500 dark:text-cyan-400" },
};

export default function StatCard({ title, value, icon, color, subtitle, onClick }: StatCardProps) {
  const cc = colorClasses[color];

  return (
    <div
      onClick={onClick}
      className={`bg-white dark:bg-dark-800 rounded-2xl p-5 border border-gray-100 dark:border-dark-700 shadow-sm hover:shadow-md transition-all duration-200 ${
        onClick ? "cursor-pointer" : ""
      }`}
    >
      <div className="flex items-center justify-between mb-3">
        <div className={`w-11 h-11 ${cc.bg} rounded-xl flex items-center justify-center ${cc.icon}`}>
          {icon}
        </div>
      </div>
      <p className="text-2xl font-bold text-gray-900 dark:text-white mb-0.5">{value}</p>
      <p className="text-sm text-gray-500 dark:text-gray-400">{title}</p>
      {subtitle && <p className="text-xs text-gray-400 dark:text-gray-500 mt-1">{subtitle}</p>}
    </div>
  );
}
