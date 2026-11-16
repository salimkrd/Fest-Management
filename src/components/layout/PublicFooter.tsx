'use client';

import React from 'react';
import Link from 'next/link';
import { useFest } from '@/context/FestContext';

export const PublicFooter: React.FC = () => {
  const { theme } = useFest();
  const festivalName = theme.festivalName?.trim() || 'INSPIRATH';
  const institutionName = theme.institutionName?.trim();

  return (
    <footer className="public-site-footer mt-auto bg-[#120507] text-[#F2F3E6] border-t border-[#BA1912]/30 mb-16 lg:mb-0">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 sm:py-7">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="min-w-0">
            <Link href="/" className="inline-flex items-center gap-2">
              <span className="font-brand text-base font-bold tracking-wider text-[#F2F3E6] uppercase">
                {festivalName}
              </span>
              <span className="w-1.5 h-1.5 rounded-full bg-[#FDBF0F]" />
            </Link>
            {institutionName && (
              <p className="mt-1 text-xs text-[#F2F3E6]/65">{institutionName}</p>
            )}
          </div>

          <nav
            aria-label="Public footer navigation"
            className="flex flex-wrap items-center gap-x-5 gap-y-2 text-xs font-medium"
          >
            <Link href="/" className="text-[#F2F3E6]/75 hover:text-[#FDBF0F] transition-colors">
              Home
            </Link>
            <Link href="/public/directory" className="text-[#F2F3E6]/75 hover:text-[#FDBF0F] transition-colors">
              Results Directory
            </Link>
            <Link href="/public/championship" className="text-[#F2F3E6]/75 hover:text-[#FDBF0F] transition-colors">
              Team Championship
            </Link>
          </nav>
        </div>

        <div className="mt-5 border-t border-[#BA1912]/20 pt-4 text-[10px] text-[#F2F3E6]/50">
          © {new Date().getFullYear()} {festivalName}. All rights reserved.
        </div>
      </div>
    </footer>
  );
};
