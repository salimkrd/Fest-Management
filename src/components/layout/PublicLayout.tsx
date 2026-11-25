'use client';

import React, { Suspense, useMemo } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useFest } from '@/context/FestContext';
import { PublicFooter } from '@/components/layout/PublicFooter';
import { PublicIcon, formatPublicFestivalDates } from '@/components/layout/PublicIcon';
import { Trophy, Sparkles, FileText, UserRound, Image as ImageIcon } from 'lucide-react';

interface PublicLayoutProps {
  children: React.ReactNode;
  fullBleed?: boolean;
}

function PublicNavLinks() {
  const pathname = usePathname();
  const { theme } = useFest();

  const navLinks = [
    { name: 'Latest Results', href: '/', icon: Sparkles, label: 'HOME' },
    { name: 'Gallery', href: '/gallery', icon: ImageIcon, label: 'GALLERY' },
    { name: 'Results Directory', href: '/public/directory', icon: FileText, label: 'RESULTS DIRECTORY' },
    ...(theme.showHouseChampionshipLeaderboard !== false ? [{ name: 'Team Championship', href: '/public/championship', icon: Trophy, label: 'TEAM CHAMPIONSHIP' }] : []),
  ];

  return (
    <nav className="hidden lg:flex items-center gap-1.5" aria-label="Main Navigation">
      {navLinks.map((link) => {
        const isActive = link.href === '/' ? pathname === '/' : pathname.startsWith(link.href);
        const Icon = link.icon;
        return (
          <Link
            key={link.name}
            href={link.href}
            aria-current={isActive ? 'page' : undefined}
            className={`flex items-center gap-2 px-3.5 py-2 rounded-lg text-xs tracking-wider uppercase font-semibold transition-all ${
              isActive
                ? 'bg-[#BA1912] text-[#F2F3E6] shadow-sm shadow-[#BA1912]/40 font-bold'
                : 'text-[#F2F3E6]/75 hover:text-[#F2F3E6] hover:bg-[#230D0F]'
            }`}
          >
            <Icon className="w-3.5 h-3.5" style={{ color: isActive ? '#FDBF0F' : undefined }} />
            <span>{link.label || link.name}</span>
          </Link>
        );
      })}
    </nav>
  );
}

function MobileBottomNav() {
  const pathname = usePathname();
  const { theme } = useFest();

  const mobileTabs = [
    { name: 'Home', href: '/', icon: 'home' },
    { name: 'Gallery', href: '/gallery', icon: 'photo_library' },
    { name: 'Results', href: '/public/directory', icon: 'menu_book' },
    ...(theme.showHouseChampionshipLeaderboard !== false ? [{ name: 'Teams', href: '/public/championship', icon: 'military_tech' }] : []),
  ];

  return (
    <nav
      className="fixed bottom-0 left-0 right-0 z-50 lg:hidden bg-[#1B090B]/95 backdrop-blur-xl border-t border-[#BA1912]/40 shadow-[0_-4px_24px_rgba(0,0,0,0.6)]"
      style={{ paddingBottom: 'calc(env(safe-area-inset-bottom, 0px) + 6px)' }}
      aria-label="Mobile Navigation"
    >
      <div className="flex justify-around items-center h-16 px-2">
        {mobileTabs.map(tab => {
          const isActive = tab.href === '/' ? pathname === '/' : pathname.startsWith(tab.href);
          return (
            <Link
              key={tab.name}
              href={tab.href}
              aria-current={isActive ? 'page' : undefined}
              className={`flex flex-col items-center justify-center flex-1 h-full py-1 gap-1 transition-all ${
                isActive ? 'text-[#FDBF0F] font-bold' : 'text-[#F2F3E6]/60 hover:text-[#F2F3E6]'
              }`}
            >
              <div className="relative">
                <PublicIcon name={tab.icon} className="text-[#FDBF0F]" size={22} />
                {isActive && (
                  <span className="absolute -top-1 -right-1 w-1.5 h-1.5 rounded-full bg-[#FDBF0F] shadow-[0_0_8px_#FDBF0F]" />
                )}
              </div>
              <span className="text-[10px] tracking-wide uppercase font-medium">{tab.name}</span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}

export const PublicLayout: React.FC<PublicLayoutProps> = ({ children, fullBleed = false }) => {
  const { theme, themeSyncState } = useFest();

  const formattedDates = useMemo(
    () => formatPublicFestivalDates(theme.festivalStartDate, theme.festivalEndDate),
    [theme.festivalStartDate, theme.festivalEndDate]
  );
  const festivalDisplayName = theme.festivalName?.trim()
    || (themeSyncState === 'loading' ? 'Loading festival' : 'Festival');

  return (
    <div 
      className="public-experience min-h-screen bg-[#1B090B] text-[#F2F3E6] flex flex-col selection:bg-[#FDBF0F] selection:text-[#1A080B]"
      style={{
        '--fest-primary': theme.primaryColor || '#86152C',
        '--fest-secondary': theme.secondaryColor || '#BA1912',
        '--fest-accent': theme.accentColor || '#FDBF0F',
        fontFamily: "'Sora', sans-serif"
      } as React.CSSProperties}
    >
      {/* Main Navbar */}
      <header className="sticky top-0 z-40 bg-[#1B090B]/90 backdrop-blur-md border-b border-[#BA1912]/30 shadow-[0_4px_24px_rgba(0,0,0,0.45)]">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between gap-3 min-h-[4.5rem] py-2 lg:h-[4.5rem]">
            {/* Brand Logo & Title */}
            <Link href="/" className="flex items-center gap-2 min-w-0 group" aria-label={festivalDisplayName} title={festivalDisplayName}>
              <div className="min-w-0 max-w-[55vw] lg:max-w-[24vw]">
                <span className="public-brand-title font-brand font-bruno block text-xl sm:text-2xl lg:text-3xl font-extrabold tracking-wider text-[#F2F3E6] group-hover:text-[#FDBF0F] transition-colors uppercase truncate">
                  <span className="festival-name">{festivalDisplayName}</span>
                </span>
                <span className="lg:hidden mt-0.5 block truncate text-[10px] sm:text-xs font-medium tracking-wide text-[#FDBF0F]/90">{formattedDates}</span>
              </div>
              <span className="w-1.5 h-1.5 rounded-full bg-[#FDBF0F] inline-block shadow-[0_0_6px_#FDBF0F] shrink-0" />
            </Link>

            {/* Desktop Navigation */}
            <Suspense fallback={<div className="h-8 w-48 bg-[#230D0F] rounded animate-pulse" />}>
              <PublicNavLinks />
            </Suspense>

            {/* Desktop festival date and Participant Portal; mobile keeps only the portal icon. */}
            <div className="flex items-center gap-2 sm:gap-3">
              <div className="hidden lg:flex items-center gap-1.5 px-3 py-1.5 rounded bg-[#230D0F] border border-[#FDBF0F]/30 text-[#FDBF0F] shadow-xs">
                <span className="w-2 h-2 rounded-full bg-[#FDBF0F] animate-pulse" />
                <span className="text-[10px] uppercase font-bold tracking-widest font-mono">
                  {formattedDates}
                </span>
              </div>
              <Link
                href="/participant/login"
                aria-label="Participant Login"
                title="Participant Login"
                className="inline-flex items-center justify-center w-10 h-10 rounded-lg border border-[#FDBF0F]/50 bg-[#230D0F] text-[#FDBF0F] hover:bg-[#FDBF0F] hover:text-[#1B090B] hover:border-[#FDBF0F] transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#FDBF0F] focus-visible:ring-offset-2 focus-visible:ring-offset-[#1B090B]"
              >
                <UserRound className="w-5 h-5" aria-hidden="true" />
              </Link>
            </div>
          </div>
        </div>

      </header>

      {/* Main Content Area - padded at bottom for mobile nav bar */}
      <main
        className={`public-main ${fullBleed ? 'public-main--full-bleed' : ''} min-w-0 flex-1 w-full overflow-x-clip ${
          fullBleed
            ? 'pb-24 lg:pb-0'
            : 'max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 sm:py-8 pb-24 lg:pb-12'
        }`}
      >
        {children}
      </main>

      {/* Mobile Fixed Bottom Nav */}
      <MobileBottomNav />

      <PublicFooter />
    </div>
  );
};
