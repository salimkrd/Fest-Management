'use client';

import React, { useState, Suspense, useMemo } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useFest } from '@/context/FestContext';
import { Trophy, Search, Sparkles, FileText, Menu, X, Calendar } from 'lucide-react';

interface PublicLayoutProps {
  children: React.ReactNode;
}

const parseFestivalDate = (value?: string): Date | null => {
  if (!value || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return null;
  const parsed = new Date(`${value}T00:00:00Z`);
  if (!Number.isFinite(parsed.getTime()) || parsed.toISOString().slice(0, 10) !== value) return null;
  return parsed;
};

const formatFestivalDateSpan = (startDate?: string, endDate?: string) => {
  const start = parseFestivalDate(startDate);
  const end = parseFestivalDate(endDate);

  if (!start && !endDate) return 'Official Convocation';
  if (start && end) {
    const startDay = start.getUTCDate();
    const endDay = end.getUTCDate();
    const month = start.toLocaleString('en-US', { month: 'short', timeZone: 'UTC' });
    const year = start.getUTCFullYear();
    if (start.getUTCMonth() === end.getUTCMonth() && start.getUTCFullYear() === end.getUTCFullYear()) {
      return `${startDay}–${endDay} ${month} ${year}`;
    }
    return `${start.toLocaleDateString('en-US', { month: 'short', day: 'numeric', timeZone: 'UTC' })} – ${end.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric', timeZone: 'UTC' })}`;
  }
  if (start) {
    return start.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric', timeZone: 'UTC' });
  }
  return endDate || 'Official Convocation';
};

function PublicNavLinks() {
  const pathname = usePathname();

  const navLinks = [
    { name: 'Latest Results', href: '/', icon: Sparkles, label: 'HOME' },
    { name: 'Results Directory', href: '/public/directory', icon: FileText, label: 'RESULTS DIRECTORY' },
    { name: 'Team Championship', href: '/public/championship', icon: Trophy, label: 'TEAM CHAMPIONSHIP' },
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

function PublicSearchBar() {
  const router = useRouter();
  const [searchQuery, setSearchQuery] = useState('');

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (searchQuery.trim()) {
      router.push(`/public/directory?q=${encodeURIComponent(searchQuery.trim())}`);
    }
  };

  return (
    <form onSubmit={handleSearchSubmit} className="relative w-full sm:w-60 lg:w-64">
      <Search className="w-3.5 h-3.5 text-[#FDBF0F] absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
      <input
        type="text"
        placeholder="Search Bib, Candidate, Event..."
        value={searchQuery}
        onChange={(e) => setSearchQuery(e.target.value)}
        className="w-full text-xs pl-8 pr-3 py-2 rounded-lg bg-[#1B090B] text-[#F2F3E6] placeholder-[#F2F3E6]/40 border border-[#BA1912]/30 focus:border-[#FDBF0F] focus:outline-none focus:ring-1 focus:ring-[#FDBF0F]/50 transition-all"
      />
    </form>
  );
}

function MobileBottomNav() {
  const pathname = usePathname();

  const mobileTabs = [
    { name: 'Home', href: '/', icon: 'home' },
    { name: 'Results', href: '/public/directory', icon: 'menu_book' },
    { name: 'Teams', href: '/public/championship', icon: 'military_tech' },
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
                <span className="material-symbols-outlined text-[22px]">{tab.icon}</span>
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

export const PublicLayout: React.FC<PublicLayoutProps> = ({ children }) => {
  const { theme, themeSyncState } = useFest();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const formattedDates = useMemo(() => {
    return formatFestivalDateSpan(theme.festivalStartDate, theme.festivalEndDate);
  }, [theme.festivalStartDate, theme.festivalEndDate]);

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
          <div className="flex items-center justify-between h-18">
            {/* Brand Logo & Title */}
            <Link href="/" className="flex items-center gap-0 group">
              <div>
                <div className="flex items-center gap-1.5">
                  <span className="public-brand-title font-brand font-bruno text-base sm:text-xl font-extrabold tracking-wider text-[#F2F3E6] group-hover:text-[#FDBF0F] transition-colors uppercase whitespace-nowrap">
                    <span className="festival-name">{theme.festivalName || (themeSyncState === 'loading' ? 'Loading festival…' : 'Festival name unavailable')}</span>
                  </span>
                  <span className="w-1.5 h-1.5 rounded-full bg-[#FDBF0F] inline-block shadow-[0_0_6px_#FDBF0F] shrink-0" />
                </div>
                <span className="public-brand-subtitle text-[10px] text-[#F2F3E6]/70 uppercase tracking-widest font-medium block">
                  {theme.institutionName || (themeSyncState === 'loading' ? 'Loading institution…' : 'Institution unavailable')}
                </span>
              </div>
            </Link>

            {/* Desktop Navigation */}
            <Suspense fallback={<div className="h-8 w-48 bg-[#230D0F] rounded animate-pulse" />}>
              <PublicNavLinks />
            </Suspense>

            {/* Date Badge & Search Input */}
            <div className="hidden lg:flex items-center gap-3">
              <div className="flex items-center gap-1.5 px-3 py-1.5 rounded bg-[#230D0F] border border-[#FDBF0F]/30 text-[#FDBF0F] shadow-xs">
                <span className="w-2 h-2 rounded-full bg-[#FDBF0F] animate-pulse" />
                <span className="text-[10px] uppercase font-bold tracking-widest font-mono">
                  {formattedDates}
                </span>
              </div>
              <Suspense fallback={<div className="h-8 w-48 bg-[#230D0F] rounded animate-pulse" />}>
                <PublicSearchBar />
              </Suspense>
            </div>

            {/* Mobile menu trigger */}
            <div className="flex lg:hidden items-center gap-2">
              <button
                onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
                className="p-2 rounded-lg text-[#F2F3E6] hover:bg-[#230D0F] border border-[#BA1912]/40 transition-colors"
                aria-label="Toggle navigation"
                aria-expanded={mobileMenuOpen}
                aria-controls="public-mobile-navigation"
              >
                {mobileMenuOpen ? <X className="w-5 h-5 text-[#FDBF0F]" /> : <Menu className="w-5 h-5" />}
              </button>
            </div>
          </div>
        </div>

        {/* Mobile Navigation Drawer */}
        {mobileMenuOpen && (
          <div id="public-mobile-navigation" className="lg:hidden border-t border-[#BA1912]/30 bg-[#1B090B]/98 px-4 pt-3 pb-5 space-y-3 shadow-2xl">
            <Suspense fallback={null}>
              <PublicSearchBar />
            </Suspense>
            <nav className="space-y-1 pt-2">
              <Link
                href="/"
                onClick={() => setMobileMenuOpen(false)}
                className="flex items-center gap-3 px-3.5 py-2.5 rounded-lg text-xs font-bold text-[#F2F3E6] hover:bg-[#230D0F] transition-colors"
              >
                <Sparkles className="w-4 h-4 text-[#FDBF0F]" />
                <span>Latest Results</span>
              </Link>
              <Link
                href="/public/directory"
                onClick={() => setMobileMenuOpen(false)}
                className="flex items-center gap-3 px-3.5 py-2.5 rounded-lg text-xs font-bold text-[#F2F3E6] hover:bg-[#230D0F] transition-colors"
              >
                <FileText className="w-4 h-4 text-[#FDBF0F]" />
                <span>Results Directory</span>
              </Link>
              <Link
                href="/public/championship"
                onClick={() => setMobileMenuOpen(false)}
                className="flex items-center gap-3 px-3.5 py-2.5 rounded-lg text-xs font-bold text-[#F2F3E6] hover:bg-[#230D0F] transition-colors"
              >
                <Trophy className="w-4 h-4 text-[#FDBF0F]" />
                <span>Team Championship</span>
              </Link>
            </nav>
          </div>
        )}
      </header>

      {/* Main Content Area - padded at bottom for mobile nav bar */}
      <main className="public-main min-w-0 flex-1 max-w-7xl mx-auto w-full overflow-x-clip px-4 sm:px-6 lg:px-8 py-6 sm:py-8 pb-24 lg:pb-12">
        {children}
      </main>

      {/* Mobile Fixed Bottom Nav */}
      <MobileBottomNav />

      {/* Public Footer matching Stitch 3-Column Design */}
      <footer className="public-site-footer mt-auto bg-[#120507] text-[#F2F3E6] border-t border-[#BA1912]/30 mb-16 lg:mb-0">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10 sm:py-12">
          <div className="grid grid-cols-1 md:grid-cols-12 gap-8 mb-8">
            {/* Column 1: Festival Convocation Summary */}
            <div className="md:col-span-5 flex flex-col gap-3">
              <div className="flex items-center gap-2">
                <span className="font-brand text-lg font-bold tracking-wider text-[#F2F3E6] uppercase">
                  {theme.festivalName || 'INSPIRAATH'}
                </span>
                <span className="w-2 h-2 rounded-full bg-[#FDBF0F]" />
                <span className="text-xs text-[#FDBF0F] uppercase px-2 py-0.5 rounded bg-[#230D0F] border border-[#FDBF0F]/30 font-mono font-bold">
                  2026
                </span>
              </div>
              <p className="text-xs text-[#F2F3E6]/75 leading-relaxed max-w-md">
                Biennial Academic &amp; Cultural Convocation for Huffazul Qur&apos;an, convening sacred scholasticism, competitive qira&apos;at, and sublime Islamic literary arts at {theme.institutionName || "Ma'din Suffa Campus, Vavoor, Malappuram"}.
              </p>
              <div className="flex flex-wrap items-center gap-2 pt-2 text-[10px] uppercase font-bold tracking-widest text-[#FDBF0F]">
                <span>◆ SOLEMNITY</span>
                <span className="text-[#F2F3E6]/40">—</span>
                <span>DISCIPLINE</span>
                <span className="text-[#F2F3E6]/40">—</span>
                <span>EXCELLENCE ◆</span>
              </div>
            </div>

            {/* Column 2: Festival Folio Navigation */}
            <div className="md:col-span-3 flex flex-col gap-2">
              <span className="text-xs uppercase tracking-widest text-[#FDBF0F] font-bold mb-1">
                Festival Folio
              </span>
              <Link href="/" className="text-xs text-[#F2F3E6]/75 hover:text-[#FDBF0F] transition-colors py-1">
                Conclave Overview
              </Link>
              <Link href="/public/directory" className="text-xs text-[#F2F3E6]/75 hover:text-[#FDBF0F] transition-colors py-1">
                Official Merit Ledger
              </Link>
              <Link href="/public/championship" className="text-xs text-[#F2F3E6]/75 hover:text-[#FDBF0F] transition-colors py-1">
                Championship Points Tally
              </Link>
            </div>

            {/* Column 3: Convocation Secretariat */}
            <div className="md:col-span-4 flex flex-col gap-2">
              <span className="text-xs uppercase tracking-widest text-[#FDBF0F] font-bold mb-1">
                Convocation Secretariat
              </span>
              <p className="text-xs text-[#F2F3E6]/75 leading-relaxed">
                Central Directorate of Examination &amp; Literary Arts<br />
                {theme.institutionName || "Ma'din Suffa Campus, Vavoor"}<br />
                Malappuram District, Kerala — 673645
              </p>
              <div className="flex items-center gap-2 pt-2 text-xs text-[#FDBF0F]">
                <Calendar className="w-3.5 h-3.5 text-[#FDBF0F]" />
                <span className="font-mono uppercase font-bold tracking-wider">{formattedDates}</span>
              </div>
            </div>
          </div>

          {/* Bottom Bar */}
          <div className="pt-6 border-t border-[#BA1912]/20 flex flex-col sm:flex-row items-center justify-between gap-4 text-[11px] text-[#F2F3E6]/60">
            <span>
              &copy; 2026 {theme.festivalName?.toUpperCase() || 'INSPIRAATH'} FESTIVAL COMMITTEE • {theme.institutionName?.toUpperCase() || "MA'DIN SUFFA CAMPUS VAVOOR"}. ALL RIGHTS RESERVED.
            </span>
            <div className="flex items-center gap-2">
              <span className="uppercase tracking-widest text-[#FDBF0F] font-semibold text-[10px]">
                SANCTIFIED UNDER CENTRAL DIRECTIVE
              </span>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
};
