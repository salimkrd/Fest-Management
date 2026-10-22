import React from 'react';

export type BadgeVariant = 'default' | 'success' | 'warning' | 'error' | 'info' | 'purple' | 'blue';

interface BadgeProps {
  children: React.ReactNode;
  variant?: BadgeVariant;
  size?: 'sm' | 'md';
  className?: string;
  dot?: boolean;
}

export const Badge: React.FC<BadgeProps> = ({
  children,
  variant = 'default',
  size = 'md',
  className = '',
  dot = false,
}) => {
  const variantStyles = {
    default: 'bg-[#F8FAFC] text-[#526070] border-[#E1E7EF]',
    success: 'bg-[#ECFDF5] text-[#065F46] border-[#A7F3D0]',
    warning: 'bg-[#FFFBEB] text-[#92400E] border-[#FDE68A]',
    error: 'bg-[#FEF2F2] text-[#991B1B] border-[#FECACA]',
    info: 'bg-[#EFF6FF] text-[#1E40AF] border-[#BFDBFE]',
    purple: 'bg-[#FAF5FF] text-[#6B21A8] border-[#E9D5FF]',
    blue: 'bg-[#2563EB]/10 text-[#2563EB] border-[#2563EB]/20',
  };

  const dotColors = {
    default: 'bg-[#526070]',
    success: 'bg-[#10B981]',
    warning: 'bg-[#F59E0B]',
    error: 'bg-[#EF4444]',
    info: 'bg-[#3B82F6]',
    purple: 'bg-[#8B5CF6]',
    blue: 'bg-[#2563EB]',
  };

  const sizeStyles = {
    sm: 'text-[11px] px-2 py-0.5 font-semibold',
    md: 'text-xs px-2.5 py-1 font-semibold'
  };

  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-md border tracking-wide uppercase ${variantStyles[variant]} ${sizeStyles[size]} ${className}`}
    >
      {dot && (
        <span className={`w-1.5 h-1.5 rounded-full ${dotColors[variant]}`} />
      )}
      {children}
    </span>
  );
};
