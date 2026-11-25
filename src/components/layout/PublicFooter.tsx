'use client';

import React from 'react';
import Link from 'next/link';
import { useFest } from '@/context/FestContext';
import { formatPublicFestivalDates } from '@/components/layout/PublicIcon';

export const PublicFooter: React.FC = () => {
  const { theme } = useFest();
  const festivalName = theme.festivalName?.trim() || 'Festival';
  const festivalDates = formatPublicFestivalDates(theme.festivalStartDate, theme.festivalEndDate);
  const copyrightYear = theme.year?.trim() || theme.festivalStartDate?.slice(0, 4) || String(new Date().getFullYear());
  const institutionName = theme.institutionName?.trim();

  return (
    <footer className="public-site-footer mt-auto bg-[#120507] text-[#F2F3E6] border-t border-[#BA1912]/30 mb-16 lg:mb-0">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 sm:py-7">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="min-w-0">
            <Link href="/" className="inline-flex items-center gap-2">
              <span className="font-brand festival-name text-base font-bold tracking-wider text-[#F2F3E6] uppercase">
                {festivalName}
              </span>
              <span className="w-1.5 h-1.5 rounded-full bg-[#FDBF0F]" />
            </Link>
            {institutionName && (
              <p className="mt-1 text-xs text-[#F2F3E6]/65">{institutionName}</p>
            )}
            <p className="mt-1 text-xs text-[#F2F3E6]/65">{festivalDates}</p>
          </div>

          <div className="flex flex-col gap-3 sm:items-end">
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

            <nav aria-label="Social media links" className="flex flex-wrap items-center gap-4 text-xs font-medium">
              <span className="text-[10px] uppercase tracking-widest text-[#F2F3E6]/45">Follow us</span>
              <a
                href="https://www.instagram.com/suffa_vavoor_/"
                target="_blank"
                rel="noopener noreferrer"
                aria-label="Open Ma'din Suffa Campus on Instagram in a new tab"
                className="inline-flex items-center gap-1.5 text-[#F2F3E6]/75 transition-colors hover:text-[#FDBF0F] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#FDBF0F] focus-visible:ring-offset-2 focus-visible:ring-offset-[#120507] rounded"
              >
                <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true">
                  <rect x="3" y="3" width="18" height="18" rx="5" />
                  <circle cx="12" cy="12" r="4" />
                  <circle cx="17.5" cy="6.5" r="1" fill="currentColor" stroke="none" />
                </svg>
                <span>Instagram</span>
              </a>
              <a
                href="https://www.youtube.com/@MADINSUFFACAMPUSVAVOOR"
                target="_blank"
                rel="noopener noreferrer"
                aria-label="Open Ma'din Suffa Campus on YouTube in a new tab"
                className="inline-flex items-center gap-1.5 text-[#F2F3E6]/75 transition-colors hover:text-[#FDBF0F] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#FDBF0F] focus-visible:ring-offset-2 focus-visible:ring-offset-[#120507] rounded"
              >
                <svg viewBox="0 0 24 24" className="h-4 w-4" fill="currentColor" aria-hidden="true">
                  <path d="M23.2 7a3 3 0 0 0-2.1-2.1C19.3 4.4 12 4.4 12 4.4s-7.3 0-9.1.5A3 3 0 0 0 .8 7 31 31 0 0 0 .3 12a31 31 0 0 0 .5 5 3 3 0 0 0 2.1 2.1c1.8.5 9.1.5 9.1.5s7.3 0 9.1-.5a3 3 0 0 0 2.1-2.1 31 31 0 0 0 .5-5 31 31 0 0 0-.5-5ZM9.6 15.8V8.2l6.3 3.8-6.3 3.8Z"/>
                </svg>
                <span>YouTube</span>
              </a>
            </nav>
          </div>
        </div>

        <div className="mt-5 border-t border-[#BA1912]/20 pt-4 text-[10px] text-[#F2F3E6]/50">
          © {copyrightYear} {festivalName}. All rights reserved.
        </div>
      </div>
    </footer>
  );
};
