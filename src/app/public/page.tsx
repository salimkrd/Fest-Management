'use client';

import React, { useState, useMemo } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { useFest } from '@/context/FestContext';
import { PosterDownloadDialog } from '@/components/domain/PosterDownloadDialog';
import { PublicFooter } from '@/components/layout/PublicFooter';
import type { CompetitionResult, ResultRank } from '@/types/fest';

const parseFestivalCalendarDate = (value?: string): Date | null => {
  if (!value || !/^\\d{4}-\\d{2}-\\d{2}$/.test(value)) return null;
  const parsed = new Date(`${value}T00:00:00Z`);
  if (!Number.isFinite(parsed.getTime()) || parsed.toISOString().slice(0, 10) !== value) return null;
  return parsed;
};

export default function InspirathPublicHomePage() {
  const { theme, teams, results, categories, competitions, teamsSyncState, resultsSyncState } = useFest();

  // Mobile navigation drawer toggle
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  // Active Division Tab for Latest Results Gazette
  const [activeDivisionTab, setActiveDivisionTab] = useState<string>('ALL');

  // Quick Competition Result Finder form state
  const [finderCategory, setFinderCategory] = useState<string>('all');
  const [finderEvent, setFinderEvent] = useState<string>('all');
  const [finderInput, setFinderInput] = useState<string>('');
  const [finderHasSearched, setFinderHasSearched] = useState<boolean>(false);
  const [matchedRecord, setMatchedRecord] = useState<{
    result: CompetitionResult;
    rank: ResultRank;
  } | null>(null);

  // Filter published results only
  const publishedResults = useMemo(() => {
    return results.filter(r => r.resultStatus === 'PUBLISHED');
  }, [results]);

  // Sort teams by totalPoints descending for House Championship Standings
  const sortedTeams = useMemo(() => {
    return [...teams].sort((a, b) => (b.totalPoints || 0) - (a.totalPoints || 0));
  }, [teams]);

  // Point margin of leader over 2nd place
  const leaderMargin = useMemo(() => {
    if (sortedTeams.length < 2) return 0;
    return (sortedTeams[0]?.totalPoints || 0) - (sortedTeams[1]?.totalPoints || 0);
  }, [sortedTeams]);

  // Competitions available in finder dropdown (optionally filtered by selected finder category)
  const availableFinderEvents = useMemo(() => {
    if (finderCategory === 'all') return competitions;
    return competitions.filter(
      c => c.categoryId === finderCategory || c.categoryName.toLowerCase() === finderCategory.toLowerCase()
    );
  }, [competitions, finderCategory]);

  // Handle Quick Result Finder search
  const handleQuickSearch = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    setFinderHasSearched(true);

    const query = finderInput.trim().toLowerCase();
    if (!query && finderCategory === 'all' && finderEvent === 'all') {
      setMatchedRecord(null);
      return;
    }

    // Search through all published results
    for (const res of publishedResults) {
      // Category filter check
      if (finderCategory !== 'all') {
        const catMatch = res.categoryName.toLowerCase() === finderCategory.toLowerCase();
        if (!catMatch) continue;
      }

      // Competition filter check
      if (finderEvent !== 'all') {
        const eventMatch =
          res.competitionId === finderEvent ||
          res.competitionCode.toLowerCase() === finderEvent.toLowerCase() ||
          res.competitionName.toLowerCase() === finderEvent.toLowerCase();
        if (!eventMatch) continue;
      }

      // Query filter check (Candidate Name, Bib #, or House / Team Name)
      if (query) {
        const foundRank = res.ranks.find(rk => {
          const nameMatch = rk.candidateName.toLowerCase().includes(query);
          const bibMatch = rk.bib.toLowerCase().includes(query) || (`#${rk.bib.toLowerCase()}`).includes(query);
          const teamMatch = rk.teamName.toLowerCase().includes(query) || rk.teamCode.toLowerCase().includes(query);
          return nameMatch || bibMatch || teamMatch;
        });

        if (foundRank) {
          setMatchedRecord({ result: res, rank: foundRank });
          return;
        }

        // If query matches the event title itself, return rank 1 of that event
        if (
          res.competitionName.toLowerCase().includes(query) ||
          res.competitionCode.toLowerCase().includes(query)
        ) {
          const rank1 = res.ranks.find(rk => rk.rank === 1) || res.ranks[0];
          if (rank1) {
            setMatchedRecord({ result: res, rank: rank1 });
            return;
          }
        }
      } else {
        // No specific text query, but category or event matched: return rank 1
        const rank1 = res.ranks.find(rk => rk.rank === 1) || res.ranks[0];
        if (rank1) {
          setMatchedRecord({ result: res, rank: rank1 });
          return;
        }
      }
    }

    // No matching published record found
    setMatchedRecord(null);
  };

  // Filtered latest results based on activeDivisionTab
  const filteredLatestResults = useMemo(() => {
    if (activeDivisionTab === 'ALL') return publishedResults;
    return publishedResults.filter(res => {
      const catLower = res.categoryName.toLowerCase();
      const tabLower = activeDivisionTab.toLowerCase();
      return catLower === tabLower || catLower.includes(tabLower);
    });
  }, [publishedResults, activeDivisionTab]);

  // Format only verified Festival Settings dates; never invent a fallback date.
  const formattedDates = useMemo(() => {
    const start = parseFestivalCalendarDate(theme.festivalStartDate);
    const end = parseFestivalCalendarDate(theme.festivalEndDate);
    if (!start || !end || end.getTime() < start.getTime()) return 'Dates to be announced';

    const startYear = start.getUTCFullYear();
    const endYear = end.getUTCFullYear();
    const startMonth = start.getUTCMonth();
    const endMonth = end.getUTCMonth();
    const startDay = start.getUTCDate();
    const endDay = end.getUTCDate();

    if (start.getTime() === end.getTime()) {
      return new Intl.DateTimeFormat('en-US', {
        month: 'short',
        day: 'numeric',
        year: 'numeric',
        timeZone: 'UTC',
      }).format(start);
    }

    if (startYear === endYear && startMonth === endMonth) {
      const month = start.toLocaleDateString('en-US', { month: 'short', timeZone: 'UTC' });
      return `${startYear} ${month} ${startDay} & ${endDay}`;
    }

    const formatter = new Intl.DateTimeFormat('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      timeZone: 'UTC',
    });
    return `${formatter.format(start)} – ${formatter.format(end)}`;
  }, [theme.festivalStartDate, theme.festivalEndDate]);

  const formattedDays = useMemo(() => {
    const start = parseFestivalCalendarDate(theme.festivalStartDate);
    const end = parseFestivalCalendarDate(theme.festivalEndDate);
    if (!start || !end || end.getTime() < start.getTime()) return 'Dates to be announced';

    const startDay = start.toLocaleDateString('en-US', { weekday: 'long', timeZone: 'UTC' });
    const endDay = end.toLocaleDateString('en-US', { weekday: 'long', timeZone: 'UTC' });
    return start.getTime() === end.getTime() ? startDay : `${startDay} & ${endDay}`;
  }, [theme.festivalStartDate, theme.festivalEndDate]);

  // Displayed institution and venue
  const institutionName = theme.institutionName || "Ma'din Suffa Campus";
  const venueLocation = 'Vavoor, Malappuram';
  const festivalTitle = theme.festivalName || 'INSPIRAATH';

  return (
    <div className="public-experience bg-[#FDBF0F] font-body antialiased selection:bg-[#4A0A1C] selection:text-[#FDBF0F] text-[#1A080B] min-h-screen">


      <main className="w-full">
        {/* HERO SECTION: Vibrant Rich Ruby-Crimson (#4A0A1C -> #86152C -> #A91D3A), theme.png as primary title, solo glowing lamp */}
        <section
          className="relative w-full hero-ruby-bg crimson-hero-gradient text-[#FFF8EE] overflow-hidden border-b border-[#4A0A1C]"
          id="home"
        >
          {/* HEADER: Deep Ruby-Espresso Header strictly matching approved branding */}
          <header className="absolute top-0 left-0 right-0 z-50 bg-transparent">
            <div className="max-w-[1440px] mx-auto flex items-center justify-between py-6 sm:py-8 px-4 sm:px-6 lg:px-8">
              <Link
                className="flex items-center gap-2 group"
                data-path="home"
                href="#home"
                id="brand-logo"
                aria-label={`${festivalTitle} Home`}
              >
                <span className="font-brand font-bruno text-2xl sm:text-4xl md:text-5xl font-extrabold tracking-wider text-[#FFF8EE] group-hover:text-[#FDBF0F] transition-colors uppercase leading-none whitespace-nowrap">
                  {festivalTitle}
                </span>
                <span className="w-2 h-2 rounded-full bg-[#FDBF0F] inline-block shadow-[0_0_8px_rgba(253,191,15,0.9)] shrink-0" />
              </Link>

              {/* Desktop Navigation */}
              <nav className="hidden md:flex items-center font-body gap-8">
                <Link
                  aria-current="page"
                  className="px-4 py-2 text-base uppercase tracking-wider font-bold text-[#FDBF0F] border-b-2 border-[#FDBF0F] transition-colors"
                  data-path="home"
                  href="#home"
                >
                  Home
                </Link>
                <Link
                  className="px-4 py-2 text-base uppercase tracking-wider text-[#FFF8EE] hover:text-[#FDBF0F] font-semibold transition-colors"
                  data-path="results-directory"
                  href="/public/directory"
                >
                  Results Directory
                </Link>
                <Link
                  className="px-4 py-2 text-base uppercase tracking-wider text-[#FFF8EE] hover:text-[#FDBF0F] font-semibold transition-colors"
                  data-path="team-championship"
                  href="/public/championship"
                >
                  Team Championship
                </Link>
              </nav>

              {/* Mobile Hamburger Button */}
              <div className="md:hidden flex items-center">
                <button
                  type="button"
                  onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
                  className="p-2.5 rounded-lg bg-[#4A0A1C]/90 text-[#FDBF0F] border border-[#FDBF0F]/40 hover:bg-[#86152C] transition-colors focus:outline-none focus:ring-2 focus:ring-[#FDBF0F]"
                  aria-label="Toggle navigation menu"
                  aria-expanded={mobileMenuOpen}
              aria-controls="mobile-navigation"
                >
                  {mobileMenuOpen ? (
                    <span className="material-symbols-outlined text-[28px] block leading-none">close</span>
                  ) : (
                    <span className="material-symbols-outlined text-[28px] block leading-none">menu</span>
                  )}
                </button>
              </div>
            </div>

            {/* Mobile Navigation Drawer */}
            {mobileMenuOpen && (
              <div id="mobile-navigation" className="md:hidden bg-[#1A080B]/95 border-b border-[#FDBF0F]/40 px-5 py-4 backdrop-blur-lg space-y-4 shadow-2xl">
                <Link
                  href="#home"
                  onClick={() => setMobileMenuOpen(false)}
                  className="block text-base uppercase tracking-wider font-bold text-[#FDBF0F] py-2 border-b border-[#FDBF0F]/20"
                >
                  Home
                </Link>
                <Link
                  href="/public/directory"
                  onClick={() => setMobileMenuOpen(false)}
                  className="block text-base uppercase tracking-wider text-[#FFF8EE] hover:text-[#FDBF0F] font-semibold py-2 border-b border-[#FDBF0F]/20"
                >
                  Results Directory
                </Link>
                <Link
                  href="/public/championship"
                  onClick={() => setMobileMenuOpen(false)}
                  className="block text-base uppercase tracking-wider text-[#FFF8EE] hover:text-[#FDBF0F] font-semibold py-2"
                >
                  Team Championship
                </Link>
              </div>
            )}
          </header>

          {/* Ambient Glows */}
          <div
            className="ambient-glow absolute top-1/2 right-[14%] -translate-y-1/2 w-[520px] h-[520px] rounded-full pointer-events-none"
            style={{
              background:
                'radial-gradient(circle, rgba(253, 191, 15, 0.38) 0%, rgba(189, 16, 1, 0.45) 45%, rgba(74, 10, 28, 0.2) 75%, transparent 100%)',
              filter: 'blur(100px)',
            }}
          />
          <div
            className="absolute -top-24 left-10 w-[460px] h-[460px] rounded-full pointer-events-none"
            style={{
              background:
                'radial-gradient(circle, rgba(189, 16, 1, 0.5) 0%, rgba(74, 10, 28, 0.4) 50%, transparent 75%)',
              filter: 'blur(120px)',
            }}
          />

          <div className="max-w-[1440px] mx-auto px-4 sm:px-6 lg:px-8 relative z-10 pt-32 pb-24">
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-10 items-center">
              {/* Left Hero Identity Column */}
              <div className="lg:col-span-7 flex flex-col items-start">
                {/* Festival Badge */}
                <div
                  className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded bg-[#4A0A1C]/90 border border-[#FDBF0F]/50 shadow-sm mb-8"
                  style={{
                    background:
                      'linear-gradient(135deg, rgba(74, 10, 28, 0.95) 0%, rgba(189, 16, 1, 0.85) 100%)',
                    boxShadow: 'rgba(189, 16, 1, 0.4) 0px 0px 16px',
                  }}
                >
                  <span className="w-2 h-2 rounded-full bg-[#FDBF0F] animate-pulse" />
                  <span className="font-body text-sm font-semibold uppercase tracking-[0.2em] text-[#FFF8EE]">
                    Suffa Campus Vavoor Art Fest {theme.year ? theme.year.slice(-2) : '26'}
                  </span>
                </div>

                {/* PRIMARY HERO TITLE: Exact Theme PNG asset (theme.png) */}
                <div className="w-full max-w-3xl mb-10 theme-glow">
                  <Image
                    src="/images/theme.png"
                    alt="Proactive Paradigms"
                    width={512}
                    height={179}
                    priority
                    className="w-full h-auto object-contain select-none"
                    style={{ filter: 'drop-shadow(rgba(0, 0, 0, 0.25) 0px 2px 8px)' }}
                  />
                </div>

                {/* Dates & Location Badges */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5 max-w-lg w-full mb-10">
                  <div className="flex items-center gap-3.5 py-3 px-4 rounded-xl bg-[#1A080B]/80 border border-[#FDBF0F]/30 backdrop-blur-md shadow-md min-w-0 w-full">
                    <div className="w-10 h-10 rounded-lg bg-[#FDBF0F]/15 border border-[#FDBF0F]/40 flex items-center justify-center shrink-0">
                      <span className="material-symbols-outlined text-[#FDBF0F] text-[22px]">calendar_month</span>
                    </div>
                    <div className="flex flex-col min-w-0 justify-center">
                      <span className="text-xs sm:text-[13px] font-bold text-[#FFF8EE] tracking-tight leading-snug whitespace-nowrap">
                        {formattedDates}
                      </span>
                      <span className="text-xs text-[#FFF8EE]/80 mt-0.5 whitespace-nowrap">
                        {formattedDays}
                      </span>
                    </div>
                  </div>

                  <div className="flex items-center gap-3.5 py-3 px-4 rounded-xl bg-[#1A080B]/80 border border-[#FDBF0F]/30 backdrop-blur-md shadow-md min-w-0 w-full">
                    <div className="w-10 h-10 rounded-lg bg-[#FDBF0F]/15 border border-[#FDBF0F]/40 flex items-center justify-center shrink-0">
                      <span className="material-symbols-outlined text-[#FDBF0F] text-[22px]">location_on</span>
                    </div>
                    <div className="flex flex-col min-w-0 justify-center">
                      <span className="text-xs sm:text-[13px] font-bold text-[#FFF8EE] tracking-tight leading-snug whitespace-nowrap">
                        {"Ma'din Suffa Campus"}
                      </span>
                      <span className="text-xs text-[#FFF8EE]/80 mt-0.5 whitespace-nowrap">
                        Vavoor, Malappuram
                      </span>
                    </div>
                  </div>
                </div>

                {/* Primary CTAs with enhanced hover animations & glowing effects */}
                <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-4 w-full sm:w-auto">
                  <Link
                    className="btn-hero-primary px-7 py-3.5 rounded text-[#1A080B] font-body text-sm sm:text-base uppercase tracking-wider font-bold shadow-lg border-2 border-[#FDBF0F] inline-flex items-center justify-center gap-2.5 group cursor-pointer leading-none whitespace-nowrap w-full sm:w-auto"
                    data-path="results-directory"
                    href="#results-directory"
                  >
                    <span className="material-symbols-outlined text-[20px] group-hover:scale-110 transition-transform text-[#1A080B]">
                      verified
                    </span>
                    <span className="tracking-wide">Explore Results</span>
                  </Link>

                  <Link
                    className="btn-hero-secondary px-7 py-3.5 rounded text-[#FFF8EE] font-body text-sm sm:text-base uppercase tracking-wider font-bold backdrop-blur-md inline-flex items-center justify-center gap-2.5 group shadow-lg cursor-pointer leading-none whitespace-nowrap w-full sm:w-auto"
                    data-path="team-championship"
                    href="#team-championship"
                  >
                    <span className="material-symbols-outlined text-[20px] group-hover:translate-x-0.5 transition-transform text-[#FDBF0F]">
                      leaderboard
                    </span>
                    <span className="tracking-wide">Team Championship</span>
                  </Link>
                </div>
              </div>

              {/* Right Hero Visual Artwork: Exclusive Lamp PNG with gentle golden glow & flicker */}
              <div className="lg:col-span-5 relative flex items-center justify-center py-2">
                <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                  <div className="sm:w-[450px] sm:h-[450px] rounded-full border border-[#FDBF0F]/30 opacity-50 w-[460px] h-[460px] animated-halo" />
                  <div className="rounded-full border border-[#FDBF0F]/15 opacity-30 w-[520px] h-[520px]" />
                </div>
                <div className="relative z-10 w-full flex flex-col items-center max-w-lg">
                  <div
                    className="w-full flex justify-center pendulum-lamp"
                    style={{
                      transformOrigin: 'center top',
                      animation: '4.2s ease-in-out 0s infinite alternate none running lampSwing',
                    }}
                  >
                    <Image
                      src="/images/lamp.png"
                      alt={`The Scholar's Lamp of ${festivalTitle}`}
                      width={512}
                      height={512}
                      priority
                      className="w-full h-auto object-contain select-none animated-lamp"
                      style={{
                        transformOrigin: 'top center',
                        animation: 'lampFlameGlow 3.6s ease-in-out infinite',
                      }}
                    />
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* THEMATIC EXPOSITION (PROACTIVE PARADIGMS) - Styled in #FDBF0F with Deep Ruby & Espresso Typography */}
        <section className="w-full bg-[#FDBF0F] border-b border-[#D69700] py-10 sm:py-12">
          <div className="max-w-[1440px] mx-auto px-4 sm:px-6 lg:px-8">
            <div className="max-w-4xl mx-auto text-center">
              <div className="inline-flex items-center gap-2.5 mb-5">
                <span className="w-1.5 h-1.5 rounded-full bg-[#4A0A1C]" />
                <span className="font-body text-xs uppercase tracking-[0.24em] text-[#4A0A1C] font-extrabold px-3 py-1 rounded border border-[#4A0A1C]/30 bg-[#F5B300]/80">
                  The Idea Behind the Theme
                </span>
                <span className="w-1.5 h-1.5 rounded-full bg-[#4A0A1C]" />
              </div>
              <h2 className="font-cinematic-editorial text-2xl sm:text-4xl font-extrabold text-[#1A080B] tracking-[0.16em] mb-4 uppercase drop-shadow-sm">
                Proactive Paradigms
              </h2>
              <div className="w-16 h-1 bg-[#4A0A1C] mx-auto mb-8 rounded-full opacity-30" />
              <p className="font-editorial text-base md:text-lg text-[#2D1217] leading-relaxed max-w-3xl mx-auto font-medium text-center">
                “Proactive Paradigms” represents a shift from reacting to problems after they emerge to anticipating
                challenges and preparing meaningful solutions in advance. It calls upon Ulama to understand changing
                realities and create relevant approaches across education, public life, human rights and media. Through
                knowledge, foresight and responsibility, scholars guide society, empower younger generations and
                inspire constructive action.
              </p>
            </div>
          </div>
        </section>

        {/* RESULTS & STANDINGS CONSOLE (SPLIT-COLUMN LAYOUT) */}
        {/* Dark Ruby/Espresso atmosphere backdrop (#2D1217 to #4A0A1C) with gold highlights */}
        <section className="w-full console-dark-bg text-[#FFF8EE] border-b border-[#4A0A1C]/80 py-10 sm:py-12" id="team-championship">
          <div className="max-w-[1440px] mx-auto px-4 sm:px-6 lg:px-8">
            <div className="flex items-center justify-between mb-8 pb-4 border-b border-[#FDBF0F]/20">
              <div>
                <span className="text-sm uppercase tracking-[0.2em] text-[#FDBF0F] font-bold">
                  Ratified Tabulation Portal
                </span>
                <h2 className="font-cinematic-editorial text-lg sm:text-2xl font-bold text-[#FFF8EE] mt-1 tracking-[0.14em] uppercase">
                  Results &amp; Standings Console
                </h2>
              </div>
              <div className="hidden sm:flex items-center gap-2 text-[13px] text-[#FFF8EE]/80 font-medium">
                <span className="w-2.5 h-2.5 rounded-full bg-emerald-400" />
                <span>Official Live Standing • Cycle {theme.year || '2026'}</span>
              </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
              {/* LEFT COLUMN: House Championship Standings (From Live Firebase Teams) */}
              <div className="lg:col-span-6 flex flex-col gap-4">
                <div className="flex items-center justify-between mb-1">
                  <h3 className="font-cinematic-editorial text-lg sm:text-lg font-bold text-[#FFF8EE] flex items-center gap-2 tracking-[0.12em] uppercase">
                    <span className="material-symbols-outlined text-[#FDBF0F] text-[24px]">trophy</span>
                    <span>House Championship Standings</span>
                  </h3>
                  <Link
                    href="/public/championship"
                    className="text-sm text-[#FDBF0F] font-bold uppercase tracking-wider hover:underline"
                  >
                    View All Guilds &rarr;
                  </Link>
                </div>

                {teamsSyncState === 'loading' ? (
                  <div className="p-5 sm:p-6 rounded-lg bg-[#4A0A1C]/60 border border-[#FDBF0F]/20 text-center">
                    <p className="text-sm font-semibold text-[#FFF8EE]">Loading official championship standings…</p>
                  </div>
                ) : teamsSyncState === 'error' ? (
                  <div className="p-5 sm:p-6 rounded-lg bg-[#4A0A1C]/60 border border-[#FDBF0F]/20 text-center">
                    <p className="text-sm font-semibold text-[#FFF8EE]">Championship standings are temporarily unavailable.</p>
                    <p className="text-xs text-[#FFF8EE]/70 mt-1">Please check back shortly.</p>
                  </div>
                ) : sortedTeams.length === 0 ? (
                  <div className="p-5 sm:p-6 rounded-lg bg-[#4A0A1C]/60 border border-[#FDBF0F]/20 text-center">
                    <span className="material-symbols-outlined text-[#FDBF0F] text-[36px] mb-2 inline-block">
                      leaderboard
                    </span>
                    <h4 className="text-base font-bold text-[#FFF8EE]">Championship Standings Awaiting Tabulation</h4>
                    <p className="text-xs text-[#FFF8EE]/70 mt-1">
                      House points will be ratified and updated live as official results are published.
                    </p>
                  </div>
                ) : (
                  sortedTeams.slice(0, 4).map((team, idx) => {
                    const isLeader = idx === 0;

                    if (isLeader) {
                      return (
                        <div
                          key={team.id}
                          className="bg-[#4A0A1C]/90 text-[#FFF8EE] rounded-lg p-4 sm:p-5 border-2 border-[#FDBF0F] shadow-lg flex items-center justify-between relative overflow-hidden"
                          style={{
                            background:
                              'linear-gradient(135deg, rgba(74, 10, 28, 0.95) 0%, rgba(189, 16, 1, 0.65) 55%, rgba(45, 18, 23, 0.95) 100%)',
                            boxShadow:
                              'rgba(189, 16, 1, 0.35) 0px 4px 20px, rgba(253, 191, 15, 0.2) 0px 0px 15px',
                          }}
                        >
                          <div className="absolute top-0 right-0 w-24 h-24 bg-[#FDBF0F]/15 rounded-bl-full pointer-events-none" />
                          <div className="flex items-center gap-4">
                            <div className="w-14 h-14 rounded-lg bg-[#FDBF0F] text-[#1A080B] flex flex-col items-center justify-center font-bold shadow-md">
                              <span className="text-xs uppercase leading-none font-bold">Rank</span>
                              <span className="text-xl font-extrabold leading-none mt-1">01</span>
                            </div>
                            <div>
                              <div className="flex items-center gap-2">
                                <h4 className="font-cinematic-editorial text-lg sm:text-xl font-extrabold text-[#FFF8EE] tracking-[0.1em] uppercase">
                                  {team.name}
                                </h4>
                                <span className="px-2.5 py-0.5 rounded bg-[#FDBF0F] text-[#1A080B] text-xs uppercase font-extrabold tracking-wider">
                                  Leader
                                </span>
                              </div>
                              <p className="text-[13px] text-[#FFF8EE]/90 mt-1 font-medium">
                                {team.zone || team.code || 'House Guild'} • {leaderMargin > 0 ? `+${leaderMargin} pt margin` : 'Current Leader'}
                              </p>
                            </div>
                          </div>
                          <div className="text-right z-10">
                            <span className="text-3xl font-extrabold text-[#FDBF0F]">{team.totalPoints || 0}</span>
                            <span className="block text-xs text-[#FFF8EE] uppercase tracking-wider font-bold">Points</span>
                          </div>
                        </div>
                      );
                    }

                    return (
                      <div
                        key={team.id}
                        className="bg-[#4A0A1C]/90 text-[#FFF8EE] rounded-lg p-3.5 sm:p-4 border border-[#FDBF0F]/30 shadow-sm flex items-center justify-between"
                        style={{
                          background:
                            'linear-gradient(135deg, rgba(74, 10, 28, 0.9) 0%, rgba(189, 16, 1, 0.3) 100%)',
                          borderColor: 'rgba(189, 16, 1, 0.5)',
                        }}
                      >
                        <div className="flex items-center gap-4">
                          <div className="w-12 h-12 rounded-md bg-[#2D1217] text-[#FDBF0F] border border-[#FDBF0F]/40 flex flex-col items-center justify-center font-bold">
                            <span className="text-xs uppercase leading-none font-bold">Rank</span>
                            <span className="text-lg font-bold leading-none mt-1">
                              {String(idx + 1).padStart(2, '0')}
                            </span>
                          </div>
                          <div>
                            <h4 className="text-lg font-bold text-[#FFF8EE]">{team.name}</h4>
                            <p className="text-[13px] text-[#FFF8EE]/80 mt-0.5 font-medium">
                              {team.zone || team.code || 'House Guild'}
                            </p>
                          </div>
                        </div>
                        <div className="text-right">
                          <span className="text-2xl font-extrabold text-[#FFF8EE]">{team.totalPoints || 0}</span>
                          <span className="block text-xs text-[#FFF8EE] uppercase tracking-wider font-bold">Points</span>
                        </div>
                      </div>
                    );
                  })
                )}
              </div>

              {/* RIGHT COLUMN: Quick Competition Result Finder with Real Searchable Dropdowns/Filters */}
              <div className="lg:col-span-6 flex flex-col">
                <div className="flex items-center justify-between mb-1">
                  <h3 className="font-cinematic-editorial text-lg sm:text-lg font-bold text-[#FFF8EE] flex items-center gap-2 tracking-[0.12em] uppercase">
                    <span className="material-symbols-outlined text-[#FDBF0F] text-[24px]">manage_search</span>
                    <span>Quick Competition Result Finder</span>
                  </h3>
                  <span className="text-sm text-[#FDBF0F] font-bold">Instant Tabulation</span>
                </div>

                <div
                  className="bg-[#4A0A1C]/90 text-[#FFF8EE] rounded-lg p-4 sm:p-5 border border-[#FDBF0F]/30 shadow-lg mt-1"
                  style={{
                    background:
                      'linear-gradient(140deg, rgba(74, 10, 28, 0.95) 0%, rgba(189, 16, 1, 0.4) 60%, rgba(45, 18, 23, 0.95) 100%)',
                    borderColor: 'rgba(189, 16, 1, 0.6)',
                    boxShadow: 'rgba(189, 16, 1, 0.25) 0px 8px 30px',
                  }}
                >
                  <p className="text-[13px] text-[#FFF8EE]/90 mb-4">
                    Filter ratified scores by official festival category, competition event, or enter candidate bib number:
                  </p>

                  <form className="space-y-4" onSubmit={handleQuickSearch}>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      {/* Category Dropdown */}
                      <div>
                        <label
                          className="block text-xs uppercase tracking-wider text-[#FDBF0F] font-bold mb-1.5"
                          htmlFor="finder-category"
                        >
                          Category Division
                        </label>
                        <select
                          className="w-full bg-[#1A080B] border border-[#FDBF0F]/40 rounded px-3.5 py-3 text-sm font-body text-[#FFF8EE] font-medium focus:outline-none focus:border-[#FDBF0F] cursor-pointer"
                          id="finder-category"
                          value={finderCategory}
                          onChange={e => {
                            setFinderCategory(e.target.value);
                            setFinderEvent('all');
                          }}
                        >
                          <option value="all">All Categories</option>
                          {categories.map(cat => (
                            <option key={cat.id} value={cat.name}>
                              {cat.name} Category
                            </option>
                          ))}
                        </select>
                      </div>

                      {/* Event Dropdown */}
                      <div>
                        <label
                          className="block text-xs uppercase tracking-wider text-[#FDBF0F] font-bold mb-1.5"
                          htmlFor="finder-event"
                        >
                          Competition Event
                        </label>
                        <select
                          className="w-full bg-[#1A080B] border border-[#FDBF0F]/40 rounded px-3.5 py-3 text-sm font-body text-[#FFF8EE] font-medium focus:outline-none focus:border-[#FDBF0F] cursor-pointer"
                          id="finder-event"
                          value={finderEvent}
                          onChange={e => setFinderEvent(e.target.value)}
                        >
                          <option value="all">All Ratified Events</option>
                          {availableFinderEvents.map(comp => (
                            <option key={comp.id} value={comp.id}>
                              {comp.name}
                            </option>
                          ))}
                        </select>
                      </div>
                    </div>

                    {/* Search Input & Button */}
                    <div className="flex gap-2 pt-1">
                      <div className="relative flex-1">
                        <input
                          className="w-full bg-[#1A080B] border border-[#FDBF0F]/40 rounded px-4 py-3 text-sm font-body text-[#FFF8EE] placeholder:text-[#FFF8EE]/50 focus:outline-none focus:border-[#FDBF0F]"
                          id="finder-input"
                          placeholder="Search Candidate Name, Bib # (e.g., 112), or House..."
                          type="text"
                          value={finderInput}
                          onChange={e => setFinderInput(e.target.value)}
                        />
                      </div>
                      <button
                        className="btn-lookup px-5 sm:px-7 py-3 border border-[#FDBF0F] rounded font-body text-sm font-bold uppercase tracking-wider flex items-center justify-center gap-2 shadow-md cursor-pointer text-[#1A080B] whitespace-nowrap"
                        type="submit"
                      >
                        <span className="material-symbols-outlined text-[20px] text-[#1A080B]">search</span>
                        <span>Lookup</span>
                      </button>
                    </div>
                  </form>

                  {/* Interactive Search Result Preview Box */}
                  <div className="mt-4 sm:mt-5 p-3 sm:p-4 rounded bg-[#1A080B] border border-[#FDBF0F]/40" id="finder-preview">
                    {matchedRecord ? (
                      <div>
                        <div className="flex items-center justify-between pb-2 border-b border-[#FDBF0F]/20 mb-3">
                          <span className="text-xs uppercase font-bold text-[#FDBF0F] tracking-wider">
                            Matched Ratified Record
                          </span>
                          <span className="px-2.5 py-0.5 rounded bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 text-xs font-bold uppercase">
                            Published
                          </span>
                        </div>
                        <div className="flex items-start justify-between gap-4">
                          <div>
                            <h5 className="text-lg font-bold text-[#FFF8EE]">{matchedRecord.rank.candidateName}</h5>
                            <p className="text-[13px] text-[#FFF8EE]/90 mt-0.5 font-medium">
                              Bib #{matchedRecord.rank.bib} • {matchedRecord.rank.teamName} • {matchedRecord.result.categoryName} Category
                            </p>
                            <p className="text-sm text-[#FDBF0F] font-semibold mt-1">
                              Event: {matchedRecord.result.competitionName}
                            </p>
                          </div>
                          <div className="text-right shrink-0">
                            <span className="inline-block px-3 py-1 bg-[#FDBF0F] text-[#1A080B] text-sm font-bold rounded shadow-sm">
                              {matchedRecord.rank.rank ? `Rank ${matchedRecord.rank.rank}` : 'Contestant'} • Grade {matchedRecord.rank.grade || '—'}
                            </span>
                            <span className="block text-xs text-[#FFF8EE]/70 mt-1 font-medium">
                              Status: Ratified
                            </span>
                          </div>
                        </div>
                      </div>
                    ) : finderHasSearched && (finderInput.trim() || finderCategory !== 'all' || finderEvent !== 'all') ? (
                      <div className="text-center py-4">
                        <span className="material-symbols-outlined text-[#FDBF0F]/60 text-[32px] block mb-1">
                          search_off
                        </span>
                        <p className="text-[13px] font-bold text-[#FFF8EE]">No Matching Ratified Record Found</p>
                        <p className="text-xs text-[#FFF8EE]/70 mt-1">
                          Check the bib number or candidate name spelling, or ensure the event result is published.
                        </p>
                      </div>
                    ) : (
                      <div className="text-center py-4">
                        <span className="material-symbols-outlined text-[#FDBF0F]/50 text-[30px] block mb-1">
                          manage_search
                        </span>
                        <p className="text-xs text-[#FFF8EE]/80 font-medium">
                          Enter candidate name or bib above, or select a category and event to lookup ratified records.
                        </p>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* LATEST RESULTS GAZETTE - Styled in #FDBF0F with Deep Dark Ruby / Rich Espresso elements */}
        <section className="w-full bg-[#FDBF0F] border-b border-[#D69700] py-10 sm:py-12" id="results-directory">
          <div className="max-w-[1440px] mx-auto px-4 sm:px-6 lg:px-8">
            <div className="text-center max-w-3xl mx-auto mb-10">
              <div className="inline-flex items-center gap-2 mb-3">
                <span className="w-2 h-2 rounded-full bg-[#4A0A1C] animate-pulse" />
                <span className="font-body text-xs uppercase tracking-[0.2em] text-[#4A0A1C] font-extrabold bg-[#F5B300] px-3.5 py-1 rounded shadow-sm border border-[#D69700]">
                  Official Convocation Tabulation
                </span>
                <span className="w-2 h-2 rounded-full bg-[#4A0A1C] animate-pulse" />
              </div>
              <h2 className="font-cinematic-editorial text-2xl sm:text-4xl font-extrabold text-[#1A080B] tracking-[0.15em] uppercase">
                Latest Competition Results
              </h2>
              <div className="w-16 h-1 bg-[#4A0A1C] mx-auto my-3 rounded-full opacity-30" />
              <p className="font-body text-sm sm:text-base text-[#2D1217] font-medium leading-relaxed">
                Authenticated scorecards ratified by the Convocation Grand Jury. Live updates across Senior, General,
                and Sub-Junior divisions.
              </p>

              {/* Division Tabs Filter */}
              <div className="flex flex-wrap items-center justify-center gap-2 mt-6">
                <button
                  type="button"
                  onClick={() => setActiveDivisionTab('ALL')}
                  className={`px-4 py-1.5 rounded-full font-body text-xs uppercase tracking-wider transition-all cursor-pointer ${
                    activeDivisionTab === 'ALL'
                      ? 'bg-[#4A0A1C] text-[#FDBF0F] font-bold shadow-sm'
                      : 'bg-[#F5B300] text-[#1A080B] hover:bg-[#4A0A1C] hover:text-[#FDBF0F] font-semibold'
                  }`}
                >
                  All Events
                </button>

                {categories.length > 0 ? (
                  categories.map(cat => (
                    <button
                      key={cat.id}
                      type="button"
                      onClick={() => setActiveDivisionTab(cat.name)}
                      className={`px-4 py-1.5 rounded-full font-body text-xs uppercase tracking-wider transition-all cursor-pointer ${
                        activeDivisionTab === cat.name
                          ? 'bg-[#4A0A1C] text-[#FDBF0F] font-bold shadow-sm'
                          : 'bg-[#F5B300] text-[#1A080B] hover:bg-[#4A0A1C] hover:text-[#FDBF0F] font-semibold'
                      }`}
                    >
                      {cat.name}
                    </button>
                  ))
                ) : (
                  <>
                    <button
                      type="button"
                      onClick={() => setActiveDivisionTab('Senior')}
                      className={`px-4 py-1.5 rounded-full font-body text-xs uppercase tracking-wider transition-all cursor-pointer ${
                        activeDivisionTab === 'Senior'
                          ? 'bg-[#4A0A1C] text-[#FDBF0F] font-bold shadow-sm'
                          : 'bg-[#F5B300] text-[#1A080B] hover:bg-[#4A0A1C] hover:text-[#FDBF0F] font-semibold'
                      }`}
                    >
                      Senior
                    </button>
                    <button
                      type="button"
                      onClick={() => setActiveDivisionTab('General')}
                      className={`px-4 py-1.5 rounded-full font-body text-xs uppercase tracking-wider transition-all cursor-pointer ${
                        activeDivisionTab === 'General'
                          ? 'bg-[#4A0A1C] text-[#FDBF0F] font-bold shadow-sm'
                          : 'bg-[#F5B300] text-[#1A080B] hover:bg-[#4A0A1C] hover:text-[#FDBF0F] font-semibold'
                      }`}
                    >
                      General
                    </button>
                    <button
                      type="button"
                      onClick={() => setActiveDivisionTab('Sub-Junior')}
                      className={`px-4 py-1.5 rounded-full font-body text-xs uppercase tracking-wider transition-all cursor-pointer ${
                        activeDivisionTab === 'Sub-Junior'
                          ? 'bg-[#4A0A1C] text-[#FDBF0F] font-bold shadow-sm'
                          : 'bg-[#F5B300] text-[#1A080B] hover:bg-[#4A0A1C] hover:text-[#FDBF0F] font-semibold'
                      }`}
                    >
                      Sub-Junior
                    </button>
                  </>
                )}
              </div>
            </div>

            {/* Results Grid */}
            {resultsSyncState === 'loading' ? (
              <div className="max-w-md mx-auto text-center py-12 px-6 rounded-xl bg-[#F5B300]/60 border border-[#D69700]">
                <p className="text-sm font-semibold text-[#1A080B]">Loading published competition results…</p>
              </div>
            ) : resultsSyncState === 'error' ? (
              <div className="max-w-md mx-auto text-center py-12 px-6 rounded-xl bg-[#F5B300]/60 border border-[#D69700]">
                <p className="text-sm font-semibold text-[#1A080B]">Published results are temporarily unavailable.</p>
                <p className="text-xs text-[#2D1217] mt-1">Please check back shortly.</p>
              </div>
            ) : filteredLatestResults.length === 0 ? (
              <div className="max-w-md mx-auto text-center py-12 px-6 rounded-xl bg-[#F5B300]/60 border border-[#D69700]">
                <span className="material-symbols-outlined text-[#4A0A1C] text-[40px] block mb-2">
                  rate_review
                </span>
                <h4 className="text-lg font-bold text-[#1A080B]">No Ratified Results Published Yet</h4>
                <p className="text-sm text-[#2D1217] mt-1 font-medium">
                  {activeDivisionTab === 'ALL'
                    ? 'Published competition results will appear here as soon as jury panels ratify scorecards.'
                    : `No results published for the ${activeDivisionTab} division yet.`}
                </p>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6 max-w-6xl mx-auto">
                {filteredLatestResults.slice(0, 6).map(res => {
                  const rank1 = res.ranks.find(r => r.rank === 1);
                  const rank2 = res.ranks.find(r => r.rank === 2);
                  const rank3 = res.ranks.find(r => r.rank === 3);

                  return (
                    <div
                      key={res.id}
                      className="bg-[#4A0A1C] text-[#FFF8EE] rounded-xl p-4 sm:p-5 border border-[#FDBF0F]/30 shadow-xl relative overflow-hidden flex flex-col justify-between group"
                      style={{
                        background: 'linear-gradient(145deg, #4A0A1C 0%, #3B161E 50%, #2D1217 100%)',
                      }}
                    >
                      <div>
                        <div className="flex items-center justify-between pb-3 border-b border-[#FDBF0F]/20 mb-4">
                          <span className="text-xs uppercase font-extrabold tracking-wider text-[#FDBF0F]">
                            {res.categoryName} Division • Item #{res.competitionCode}
                          </span>
                          <span className="px-2.5 py-0.5 rounded bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 text-xs font-bold uppercase">
                            Ratified
                          </span>
                        </div>

                        <h3 className="font-cinematic-editorial text-lg sm:text-lg font-bold text-[#FFF8EE] mb-2 tracking-[0.1em] uppercase">
                          {res.competitionName}
                        </h3>

                        {/* Top 3 Ranks Preview */}
                        <div className="space-y-2 mt-3">
                          {rank1 && (
                            <div className="flex items-center justify-between p-2 rounded bg-[#1A080B]/80 border border-[#FDBF0F]/20">
                              <div className="flex items-center gap-2.5">
                                <span className="w-6 h-6 rounded-full bg-[#FDBF0F] text-[#1A080B] font-bold text-xs flex items-center justify-center shrink-0">
                                  1
                                </span>
                                <div>
                                  <h4 className="text-[13px] font-bold text-[#FFF8EE]">{rank1.candidateName}</h4>
                                  <p className="text-xs text-[#FFF8EE]/80">
                                    Bib #{rank1.bib} • {rank1.teamName}
                                  </p>
                                </div>
                              </div>
                              <div className="text-right shrink-0">
                                <span className="text-xs font-bold text-[#FDBF0F] block">
                                  Grade {rank1.grade || '—'}
                                </span>
                                <span className="text-[11px] text-[#FFF8EE]/70 font-medium">Rank 1</span>
                              </div>
                            </div>
                          )}

                          {rank2 && (
                            <div className="flex items-center justify-between p-2 rounded bg-[#1A080B]/80 border border-[#FDBF0F]/10">
                              <div className="flex items-center gap-2.5">
                                <span className="w-6 h-6 rounded-full bg-[#2D1217] text-[#FFF8EE] border border-[#FDBF0F]/40 font-bold text-xs flex items-center justify-center shrink-0">
                                  2
                                </span>
                                <div>
                                  <h4 className="text-[13px] font-bold text-[#FFF8EE]">{rank2.candidateName}</h4>
                                  <p className="text-xs text-[#FFF8EE]/80">
                                    Bib #{rank2.bib} • {rank2.teamName}
                                  </p>
                                </div>
                              </div>
                              <div className="text-right shrink-0">
                                <span className="text-xs font-bold text-[#FFF8EE] block">
                                  Grade {rank2.grade || '—'}
                                </span>
                                <span className="text-[11px] text-[#FFF8EE]/70 font-medium">Rank 2</span>
                              </div>
                            </div>
                          )}

                          {rank3 && (
                            <div className="flex items-center justify-between p-2 rounded bg-[#1A080B]/80 border border-[#FDBF0F]/10">
                              <div className="flex items-center gap-2.5">
                                <span className="w-6 h-6 rounded-full bg-[#2D1217] text-[#FFF8EE] border border-[#FDBF0F]/40 font-bold text-xs flex items-center justify-center shrink-0">
                                  3
                                </span>
                                <div>
                                  <h4 className="text-[13px] font-bold text-[#FFF8EE]">{rank3.candidateName}</h4>
                                  <p className="text-xs text-[#FFF8EE]/80">
                                    Bib #{rank3.bib} • {rank3.teamName}
                                  </p>
                                </div>
                              </div>
                              <div className="text-right shrink-0">
                                <span className="text-xs font-bold text-[#FFF8EE] block">
                                  Grade {rank3.grade || '—'}
                                </span>
                                <span className="text-[11px] text-[#FFF8EE]/70 font-medium">Rank 3</span>
                              </div>
                            </div>
                          )}
                        </div>
                      </div>

                      {/* Card Footer Links & Poster Download Dialog */}
                      <div className="mt-6 pt-4 border-t border-[#FDBF0F]/20 flex flex-wrap items-center justify-between gap-3">
                        <span className="text-[11px] text-[#FFF8EE]/70">
                          {res.publishedDate ? `Published: ${res.publishedDate}` : 'Official Ratification'}
                        </span>
                        <div className="flex items-center gap-4">
                          <PosterDownloadDialog result={res} theme={theme} />
                          <Link
                            href={`/public/competition/${res.competitionId}`}
                            className="text-xs font-bold text-[#FDBF0F] hover:text-[#FFF8EE] flex items-center gap-1 group transition-colors"
                          >
                            <span>Full Result</span>
                            <span className="material-symbols-outlined text-[16px] group-hover:translate-x-1 transition-transform">
                              arrow_forward
                            </span>
                          </Link>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}

            <div className="text-center mt-10">
              <Link
                className="inline-flex items-center justify-center gap-2 px-6 sm:px-8 py-3.5 rounded bg-[#4A0A1C] hover:bg-[#2D1217] text-[#FDBF0F] border-2 border-[#FDBF0F] font-body text-xs sm:text-sm font-bold uppercase tracking-wider shadow-lg transition-colors cursor-pointer max-w-full"
                href="/public/directory"
              >
                <span className="material-symbols-outlined text-[20px] shrink-0">menu_book</span>
                <span className="whitespace-nowrap">View All Published Results ({publishedResults.length} Events)</span>
              </Link>
            </div>
          </div>
        </section>

        {/* OFFICIAL PUBLISHED RESULTS DIRECTORY BANNER */}
        <section className="w-full banner-ruby-bg text-[#FFF8EE] border-b border-[#4A0A1C] py-8 sm:py-10">
          <div className="max-w-[1440px] mx-auto px-4 sm:px-6 lg:px-8">
            <div
              className="max-w-4xl mx-auto flex flex-col md:flex-row items-center justify-between gap-6 bg-[#4A0A1C]/80 border border-[#FDBF0F]/50 rounded-xl p-5 sm:p-6 backdrop-blur-sm shadow-2xl"
              style={{
                background:
                  'linear-gradient(135deg, rgba(74, 10, 28, 0.92) 0%, rgba(189, 16, 1, 0.7) 50%, rgba(45, 18, 23, 0.92) 100%)',
                borderColor: 'rgba(253, 191, 15, 0.65)',
                boxShadow:
                  'rgba(189, 16, 1, 0.4) 0px 12px 40px, rgba(253, 191, 15, 0.2) 0px 0px 20px',
              }}
            >
              <div>
                <div className="inline-flex items-center gap-2 mb-2">
                  <span className="material-symbols-outlined text-[#FDBF0F] text-[22px]">badge</span>
                  <span className="text-sm uppercase tracking-widest text-[#FDBF0F] font-bold">
                    Official Published Results
                  </span>
                </div>
                <h3 className="font-cinematic-editorial text-lg sm:text-2xl font-bold text-[#FFF8EE] tracking-[0.12em] uppercase">
                  Explore the Results Directory
                </h3>
                <p className="text-xs sm:text-[13px] text-[#FFF8EE]/90 font-normal mt-1 max-w-xl leading-relaxed">
                  Browse officially published competition results, view awarded grades, and access released result posters through the public directory.
                </p>
              </div>

              {/* Enhanced Verify Candidate button with radiant golden border bloom on hover */}
              <Link
                className="btn-verify px-8 py-4 whitespace-nowrap rounded bg-[#2D1217] border-2 border-[#FDBF0F] text-[#FDBF0F] hover:bg-[#FDBF0F] hover:text-[#1A080B] font-body text-sm uppercase tracking-wider font-bold shadow-lg flex items-center gap-2 group cursor-pointer"
                data-path="results-directory"
                href="/public/directory"
              >
                <span className="material-symbols-outlined text-[20px] text-[#FDBF0F] group-hover:text-[#1A080B] group-hover:scale-110 transition-transform">
                  verified
                </span>
                <span>Open Results Directory</span>
              </Link>
            </div>
          </div>
        </section>
      </main>

      <PublicFooter />

      {/* Mobile Fixed Bottom Navigation Bar */}
      <nav
        className="fixed bottom-0 left-0 right-0 z-50 md:hidden bg-[#1B090B]/95 backdrop-blur-md border-t border-[#FDBF0F]/30 px-4 py-2 shadow-[0_-4px_24px_rgba(0,0,0,0.6)]"
        style={{ paddingBottom: 'calc(env(safe-area-inset-bottom, 0px) + 8px)' }}
        aria-label="Mobile Bottom Navigation"
      >
        <div className="max-w-md mx-auto flex items-center justify-around">
          <Link href="#home" className="flex flex-col items-center gap-1 text-[#FDBF0F] py-1">
            <span className="material-symbols-outlined text-[22px]">home</span>
            <span className="text-[10px] font-bold tracking-wider uppercase font-sora">Home</span>
          </Link>
          <Link href="#results-directory" className="flex flex-col items-center gap-1 text-[#FFF8EE]/60 hover:text-[#FDBF0F] py-1 transition-colors">
            <span className="material-symbols-outlined text-[22px]">menu_book</span>
            <span className="text-[10px] font-semibold tracking-wider uppercase font-sora">Results</span>
          </Link>
          <Link href="#team-championship" className="flex flex-col items-center gap-1 text-[#FFF8EE]/60 hover:text-[#FDBF0F] py-1 transition-colors">
            <span className="material-symbols-outlined text-[22px]">trophy</span>
            <span className="text-[10px] font-semibold tracking-wider uppercase font-sora">Points</span>
          </Link>
          <Link href="/public/directory" className="flex flex-col items-center gap-1 text-[#FFF8EE]/60 hover:text-[#FDBF0F] py-1 transition-colors">
            <span className="material-symbols-outlined text-[22px]">search</span>
            <span className="text-[10px] font-semibold tracking-wider uppercase font-sora">Lookup</span>
          </Link>
        </div>
      </nav>
    </div>
  );
}
