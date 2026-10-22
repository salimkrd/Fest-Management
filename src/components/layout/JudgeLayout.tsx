'use client';

import React from 'react';
import Link from 'next/link';
import { ShieldCheck, LogOut, Lock } from 'lucide-react';
import { useFest } from '@/context/FestContext';

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
  const { theme } = useFest();

  return (
    <div className="min-h-screen bg-[#F8FAFC] flex flex-col">
      {/* Top Header */}
      <header className="bg-white border-b border-[#E1E7EF] sticky top-0 z-30 shadow-xs">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-[#111111] text-white flex items-center justify-center font-bold text-xs">
              J
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-xs font-bold text-[#111111]">{theme.festivalName}</span>
                <span className="text-[10px] font-bold px-1.5 py-0.2 rounded bg-blue-50 text-[#2563EB] border border-blue-200">
                  SECURE JURY SESSION
                </span>
              </div>
              <span className="text-[11px] text-[#526070] font-medium block leading-tight">
                {competitionTitle}
              </span>
            </div>
          </div>

          <div className="flex items-center gap-3">
            {isLocked ? (
              <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-50 text-emerald-800 border border-emerald-200 text-xs font-bold">
                <Lock className="w-3.5 h-3.5 text-emerald-600" />
                SIGNED &amp; LOCKED
              </span>
            ) : (
              <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-blue-50 text-[#2563EB] border border-blue-200 text-xs font-bold">
                <ShieldCheck className="w-3.5 h-3.5 text-[#2563EB]" />
                SESSION ACTIVE
              </span>
            )}

            <Link
              href="/judge/login"
              className="p-2 text-[#526070] hover:text-[#DC2626] rounded-lg hover:bg-neutral-100 transition-colors"
              title="Exit Jury Session"
            >
              <LogOut className="w-4 h-4" />
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
