'use client';

import React, { useEffect, useState } from 'react';
import { useFest } from '@/context/FestContext';
import { getFestivalStatus, type FestivalStatus } from '@/domain/festivalSettings';

export function FestivalLogo({ size = 36, className = '' }: { size?: number; className?: string }) {
  const { theme } = useFest();
  const [error, setError] = useState(false);
  useEffect(() => { setError(false); }, [theme.logoUrl]);
  const initials = theme.festivalName.trim().charAt(0).toUpperCase() || 'F';
  if (theme.logoUrl?.trim() && !error) {
    return <img src={theme.logoUrl.trim()} alt={theme.festivalName + ' logo'}
      onError={() => setError(true)} loading="eager"
      className={'shrink-0 object-contain rounded-lg bg-white ' + className}
      style={{ width: size, height: size }} />;
  }
  return <span role="img" aria-label={theme.festivalName + ' logo placeholder'}
    className={'shrink-0 rounded-lg bg-[#2563EB] text-white flex items-center justify-center font-bold ' + className}
    style={{ width: size, height: size, fontSize: Math.max(12, Math.round(size * 0.4)) }}>{initials}</span>;
}

/** Date-based status shared by all portals; recalculated after Indian midnight. */
export function FestivalStatusBadge({ className = '' }: { className?: string }) {
  const { theme } = useFest();
  const [status, setStatus] = useState<FestivalStatus>({ phase: 'UNCONFIGURED', label: 'DATES NOT SET' });
  useEffect(() => {
    const refresh = () => setStatus(getFestivalStatus(theme));
    refresh();
    const timer = window.setInterval(refresh, 60_000);
    return () => window.clearInterval(timer);
  }, [theme.festivalStartDate, theme.festivalEndDate]);
  const live = status.phase === 'LIVE';
  const upcoming = status.phase === 'UPCOMING';
  const style = live ? 'bg-emerald-50 text-emerald-700 border-emerald-200' :
    upcoming ? 'bg-blue-50 text-blue-700 border-blue-200' :
    'bg-slate-100 text-slate-600 border-slate-200';
  return <span data-testid="festival-live-status" aria-live="polite"
    className={'inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[11px] font-bold uppercase tracking-wide ' + style + ' ' + className}>
    {live && <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />}
    {status.label}
  </span>;
}
