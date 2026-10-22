import React from 'react';

interface StatCardProps {
  label: string;
  value: string | number;
  subValue?: string;
  trend?: string;
  icon?: React.ReactNode;
  variant?: 'default' | 'blue' | 'green' | 'amber';
  badge?: string;
}

export const StatCard: React.FC<StatCardProps> = ({
  label,
  value,
  subValue,
  trend,
  icon,
  badge
}) => {
  return (
    <div className="bg-white rounded-xl border border-[#E1E7EF] p-5 flex flex-col justify-between transition-all hover:border-neutral-300">
      <div className="flex items-center justify-between">
        <span className="text-xs font-semibold text-[#526070] uppercase tracking-wider">{label}</span>
        {icon && (
          <div className="w-9 h-9 rounded-lg bg-[#F8FAFC] border border-[#E1E7EF] flex items-center justify-center text-[#2563EB]">
            {icon}
          </div>
        )}
      </div>

      <div className="mt-3">
        <div className="flex items-baseline gap-2">
          <span className="text-2xl sm:text-3xl font-bold text-[#111111] tracking-tight">{value}</span>
          {badge && (
            <span className="text-xs font-medium px-2 py-0.5 rounded bg-blue-50 text-blue-700 border border-blue-200">
              {badge}
            </span>
          )}
        </div>
        {(subValue || trend) && (
          <div className="mt-1 flex items-center gap-1.5 text-xs text-[#526070]">
            {trend && <span className="font-medium text-emerald-600">{trend}</span>}
            {subValue && <span>{subValue}</span>}
          </div>
        )}
      </div>
    </div>
  );
};
