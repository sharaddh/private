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
  indigo: { bg: "bg-indigo-50", text: "text-indigo-600", icon: "text-indigo-500" },
  emerald: { bg: "bg-emerald-50", text: "text-emerald-600", icon: "text-emerald-500" },
  blue: { bg: "bg-blue-50", text: "text-blue-600", icon: "text-blue-500" },
  amber: { bg: "bg-amber-50", text: "text-amber-600", icon: "text-amber-500" },
  red: { bg: "bg-red-50", text: "text-red-600", icon: "text-red-500" },
  purple: { bg: "bg-purple-50", text: "text-purple-600", icon: "text-purple-500" },
  cyan: { bg: "bg-cyan-50", text: "text-cyan-600", icon: "text-cyan-500" },
};

export default function StatCard({ title, value, icon, color, subtitle, onClick }: StatCardProps) {
  const cc = colorClasses[color];

  return (
    <div
      onClick={onClick}
      className={`bg-white rounded-2xl p-5 border border-gray-100 shadow-sm hover:shadow-md transition-all duration-200 ${
        onClick ? "cursor-pointer" : ""
      }`}
    >
      <div className="flex items-center justify-between mb-3">
        <div className={`w-11 h-11 ${cc.bg} rounded-xl flex items-center justify-center ${cc.icon}`}>
          {icon}
        </div>
      </div>
      <p className="text-2xl font-bold text-gray-900 mb-0.5">{value}</p>
      <p className="text-sm text-gray-500">{title}</p>
      {subtitle && <p className="text-xs text-gray-400 mt-1">{subtitle}</p>}
    </div>
  );
}
