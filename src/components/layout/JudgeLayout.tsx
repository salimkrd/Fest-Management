'use client';

import React from 'react';
import Link from 'next/link';
import { ShieldCheck, LogOut, Lock } from 'lucide-react';
import { useFest } from '@/context/FestContext';
import { FestivalLogo, FestivalStatusBadge } from '@/components/domain/FestivalBrand';

interface JudgeLayoutProps {
  children: React.ReactNode;
  competitionTitle?: string;
  isLocked?: boolean;
}

export const JudgeLayout: React.FC<JudgeLayoutProps> = ({
  children,
  competitionTitle = 'Evaluation Workspace',
  isLocked = false
}) => {
  const { theme, themeSyncState } = useFest();

  return (
    <div className="min-h-screen bg-[#F8FAFC] flex flex-col">
      {/* Top Header */}
      <header className="sticky top-0 z-30 border-b border-[#E1E7EF] bg-white shadow-xs">
        <div className="mx-auto flex w-full max-w-5xl flex-col gap-2.5 px-3 py-2.5 sm:min-h-16 sm:flex-row sm:items-center sm:justify-between sm:gap-3 sm:px-6 sm:py-2">
          <div className="flex min-w-0 items-center gap-2.5 sm:gap-3">
            <FestivalLogo size={32} />
            <div className="min-w-0 flex-1">
              <div className="flex min-w-0 flex-wrap items-center gap-x-2 gap-y-1">
                <span className="min-w-0 max-w-[62vw] truncate text-xs font-bold text-[#111111] sm:max-w-[360px] sm:text-sm">
                  <span className="festival-name">{theme.festivalName || (themeSyncState === 'loading' ? 'Loading festival…' : 'Festival name unavailable')}</span>
                </span>
                <span className="inline-flex shrink-0 items-center rounded-md border border-blue-200 bg-blue-50 px-1.5 py-0.5 text-[9px] font-bold tracking-wide text-[#2563EB] sm:px-2 sm:text-[10px]">
                  <span className="sm:hidden">JUDGE</span>
                  <span className="hidden sm:inline">SECURE JURY SESSION</span>
                </span>
              </div>
              <span className="mt-0.5 block max-w-full break-words text-[10px] font-medium leading-tight text-[#526070] [overflow-wrap:anywhere] sm:max-w-[360px] sm:truncate sm:text-[11px]">
                {competitionTitle}
              </span>
            </div>
          </div>

          <div className="flex w-full shrink-0 items-center justify-between gap-2 border-t border-slate-100 pt-2 sm:w-auto sm:justify-end sm:gap-3 sm:border-0 sm:pt-0">
            <FestivalStatusBadge className="hidden sm:inline-flex" />
            {isLocked ? (
              <span className="inline-flex min-h-8 shrink-0 items-center gap-1.5 rounded-full border border-emerald-200 bg-emerald-50 px-2.5 py-1 text-[10px] font-bold text-emerald-800 sm:px-3 sm:text-xs">
                <Lock className="h-3.5 w-3.5 shrink-0 text-emerald-600" />
                <span className="sm:hidden">LOCKED</span>
                <span className="hidden sm:inline">SIGNED &amp; LOCKED</span>
              </span>
            ) : (
              <span className="inline-flex min-h-8 shrink-0 items-center gap-1.5 rounded-full border border-blue-200 bg-blue-50 px-2.5 py-1 text-[10px] font-bold text-[#2563EB] sm:px-3 sm:text-xs">
                <ShieldCheck className="h-3.5 w-3.5 shrink-0 text-[#2563EB]" />
                <span className="sm:hidden">ACTIVE</span>
                <span className="hidden sm:inline">SESSION ACTIVE</span>
              </span>
            )}

            <Link
              href="/judge/login"
              aria-label="Exit Jury Session"
              className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-lg text-[#526070] transition-colors hover:bg-neutral-100 hover:text-[#DC2626] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
              title="Exit Jury Session"
            >
              <LogOut className="h-4 w-4" />
            </Link>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-5xl mx-auto px-4 sm:px-6 py-6 flex-1 w-full">
        {children}
      </main>
    </div>
  );
};
