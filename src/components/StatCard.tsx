import React from "react";
import type { LucideIcon } from "lucide-react";
import { TrendingUp, TrendingDown } from "lucide-react";

interface StatCardProps {
  title: string;
  value: string | number;
  subtitle: string;
  icon: LucideIcon;
  iconBgColor: string;    // e.g. "bg-emerald-100"
  iconTextColor: string;  // e.g. "text-emerald-600"
  /** Optional accent element (e.g., trend indicator) */
  accent?: React.ReactNode;
  /** Optional trend percentage (positive = up, negative = down) */
  trend?: number;
  /** Optional accent bar color at bottom - defaults to match icon color */
  accentBarColor?: string;
  /** Animation delay for staggered entrance */
  animationDelay?: number;
}

const StatCard: React.FC<StatCardProps> = ({
  title,
  value,
  subtitle,
  icon: Icon,
  iconBgColor,
  iconTextColor,
  accent,
  trend,
  accentBarColor,
  animationDelay = 0,
}) => {
  return (
    <div
      className="bg-white p-6 rounded-2xl border border-stone-200/80 shadow-sm card-hover relative overflow-hidden animate-fade-in-up group"
      style={{ animationDelay: `${animationDelay}ms` }}
    >
      {/* Top accent bar */}
      <div className={`absolute top-0 left-0 right-0 h-1 ${accentBarColor || iconBgColor} opacity-60 group-hover:opacity-100 transition-opacity`} />

      <div className="flex items-start justify-between mb-4">
        <div className="space-y-1">
          <h3 className="text-stone-400 font-medium text-sm tracking-wide">{title}</h3>
        </div>
        <div className={`w-11 h-11 ${iconBgColor} ${iconTextColor} rounded-xl flex items-center justify-center shadow-sm`}>
          <Icon className="w-5 h-5" />
        </div>
      </div>

      <p className="text-3xl font-black text-stone-900 tracking-tight animate-count-up">{value}</p>

      <div className="flex items-center justify-between mt-3">
        {accent ? (
          <div className="text-sm">{accent}</div>
        ) : trend !== undefined ? (
          <div className={`flex items-center gap-1 text-xs font-bold ${trend >= 0 ? 'text-emerald-600' : 'text-red-500'}`}>
            {trend >= 0 ? (
              <TrendingUp className="w-3.5 h-3.5" />
            ) : (
              <TrendingDown className="w-3.5 h-3.5" />
            )}
            <span>{Math.abs(trend)}%</span>
            <span className="text-stone-400 font-medium ml-1">vs last period</span>
          </div>
        ) : (
          <p className="text-xs text-stone-400 font-medium">{subtitle}</p>
        )}
      </div>
    </div>
  );
};

export default StatCard;
