'use client';

import React, { useState, Suspense } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useFest } from '@/context/FestContext';
import { Trophy, Search, Sparkles, Award, FileText, Menu, X } from 'lucide-react';

interface PublicLayoutProps {
  children: React.ReactNode;
}

function PublicNavLinks() {
  const pathname = usePathname();
  const { theme } = useFest();

  const navLinks = [
    { name: 'Latest Results', href: '/', icon: Sparkles },
    { name: 'Results Directory', href: '/public/directory', icon: FileText },
    { name: 'Team Championship', href: '/public/championship', icon: Trophy },
  ];

  return (
    <nav className="hidden md:flex items-center gap-1">
      {navLinks.map((link) => {
        const isActive = pathname === link.href;
        const Icon = link.icon;
        return (
          <Link
            key={link.name}
            href={link.href}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-bold transition-all ${
              isActive
                ? 'bg-neutral-100 text-[#111111]'
                : 'text-[#526070] hover:text-[#111111] hover:bg-[#F8FAFC]'
            }`}
          >
            <Icon className="w-4 h-4" style={{ color: isActive ? theme.primaryColor : undefined }} />
            <span>{link.name}</span>
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
    <form onSubmit={handleSearchSubmit} className="relative w-64 lg:w-72">
      <Search className="w-4 h-4 text-[#526070] absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
      <input
        type="text"
        placeholder="Search Bib, Candidate, Event..."
        value={searchQuery}
        onChange={(e) => setSearchQuery(e.target.value)}
        className="w-full text-xs pl-9 pr-4 py-2 bg-[#F8FAFC] border border-[#E1E7EF] rounded-lg text-[#111111] placeholder:text-[#8E9CAE] focus:outline-none focus:bg-white focus:border-[#2563EB] transition-all"
      />
    </form>
  );
}

export const PublicLayout: React.FC<PublicLayoutProps> = ({ children }) => {
  const { theme } = useFest();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  return (
    <div 
      className="min-h-screen bg-[#FAFAFA] flex flex-col transition-colors"
      style={{
        ['--fest-primary' as any]: theme.primaryColor,
        ['--fest-secondary' as any]: theme.secondaryColor || '#111111',
        ['--fest-accent' as any]: theme.accentColor,
        fontFamily: theme.bodyFont ? `${theme.bodyFont}, Montserrat, sans-serif` : 'Montserrat, sans-serif'
      }}
    >

      {/* Top Festival Announcement Bar */}
      <div 
        className="text-white text-xs py-2 px-4 text-center font-medium transition-colors"
        style={{ backgroundColor: theme.primaryColor }}
      >
        <div className="max-w-7xl mx-auto flex items-center justify-center gap-2">
          <span className="font-bold tracking-wide uppercase">{theme.festivalName}</span>
          <span>·</span>
          <span>Official Real-Time Results &amp; Championship Tabulation Center</span>
          <span className="hidden sm:inline">·</span>
          <span className="hidden sm:inline text-white/80">Markaz Knowledge City</span>
        </div>
      </div>

      {/* Main Navbar */}
      <header className="bg-white border-b border-[#E1E7EF] sticky top-0 z-30 shadow-xs">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-18">
            {/* Brand Logo & Title */}
            <Link href="/" className="flex items-center gap-3">
              <div 
                className="w-10 h-10 rounded-xl flex items-center justify-center text-white font-extrabold text-base shadow-sm"
                style={{ backgroundColor: theme.primaryColor }}
              >
                S
              </div>
              <div>
                <span className="text-base font-extrabold text-[#111111] tracking-tight block leading-tight">
                  {theme.festivalName}
                </span>
                <span className="text-[11px] text-[#526070] font-medium block">
                  {theme.institutionName}
                </span>
              </div>
            </Link>

            {/* Desktop Navigation */}
            <Suspense fallback={<div className="h-8 w-48 bg-neutral-100 rounded animate-pulse" />}>
              <PublicNavLinks />
            </Suspense>

            {/* Search Input Bar */}
            <div className="hidden sm:flex items-center">
              <Suspense fallback={<div className="h-8 w-48 bg-neutral-100 rounded animate-pulse" />}>
                <PublicSearchBar />
              </Suspense>
            </div>

            {/* Mobile menu trigger */}
            <div className="flex md:hidden items-center gap-2">
              <button
                onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
                className="p-2 rounded-lg text-[#526070] hover:bg-[#F8FAFC]"
                aria-label="Toggle navigation"
              >
                {mobileMenuOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
              </button>
            </div>
          </div>
        </div>

        {/* Mobile Navigation Drawer */}
        {mobileMenuOpen && (
          <div className="md:hidden border-t border-[#E1E7EF] bg-white px-4 pt-3 pb-6 space-y-3">
            <Suspense fallback={null}>
              <PublicSearchBar />
            </Suspense>
            <nav className="space-y-1 pt-2">
              <Link
                href="/"
                onClick={() => setMobileMenuOpen(false)}
                className="flex items-center gap-3 px-3.5 py-2.5 rounded-lg text-xs font-bold text-[#111111] hover:bg-neutral-100"
              >
                <Sparkles className="w-4 h-4" />
                <span>Latest Results</span>
              </Link>
              <Link
                href="/public/directory"
                onClick={() => setMobileMenuOpen(false)}
                className="flex items-center gap-3 px-3.5 py-2.5 rounded-lg text-xs font-bold text-[#526070] hover:bg-neutral-100"
              >
                <FileText className="w-4 h-4" />
                <span>Results Directory</span>
              </Link>
              <Link
                href="/public/championship"
                onClick={() => setMobileMenuOpen(false)}
                className="flex items-center gap-3 px-3.5 py-2.5 rounded-lg text-xs font-bold text-[#526070] hover:bg-neutral-100"
              >
                <Trophy className="w-4 h-4" />
                <span>Team Championship</span>
              </Link>
            </nav>
          </div>
        )}
      </header>

      {/* Main Content Area */}
      <main className="flex-1 max-w-7xl mx-auto w-full px-4 sm:px-6 lg:px-8 py-8">
        {children}
      </main>

      {/* Public Footer */}
      <footer className="bg-white border-t border-[#E1E7EF] mt-auto">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <div className="flex flex-col sm:flex-row items-center justify-between gap-4 text-xs text-[#526070]">
            <div>
              <span className="font-bold text-[#111111]">{theme.festivalName}</span> — {theme.tagline}
              <p className="text-[11px] mt-0.5">Results authenticated by the Central Board of Fest Adjudication</p>
            </div>
            <div className="flex flex-wrap items-center justify-center gap-4">
              <Link href="/management" className="hover:text-[#111111] hover:underline font-semibold">
                Management Hub
              </Link>
              <span>•</span>
              <Link href="/admin/login" className="hover:text-[#111111] hover:underline font-semibold">
                Admin Portal
              </Link>
              <span>•</span>
              <Link href="/team/login" className="hover:text-[#111111] hover:underline font-semibold">
                Team Manager Portal
              </Link>
              <span>•</span>
              <Link href="/judge/login" className="hover:text-[#111111] hover:underline font-semibold">
                Jury Access
              </Link>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
};
