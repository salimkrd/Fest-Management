'use client';

import React, { useState, useMemo, Suspense } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { PublicLayout } from '@/components/layout/PublicLayout';
import { PosterDownloadDialog } from '@/components/domain/PosterDownloadDialog';
import { useFest } from '@/context/FestContext';

function DirectoryContent() {
  const searchParams = useSearchParams();
  const initialQuery = searchParams.get('q') || '';

  const { results, categories, competitions, competitionsSyncState, theme, resultsSyncState } = useFest();

  const [search, setSearch] = useState(initialQuery);
  const [prevInitialQuery, setPrevInitialQuery] = useState(initialQuery);

  if (prevInitialQuery !== initialQuery) {
    setPrevInitialQuery(initialQuery);
    setSearch(initialQuery);
  }

  const [selectedCategory, setSelectedCategory] = useState<string>('ALL');
  const [selectedType, setSelectedType] = useState<string>('ALL');

  // Filter ratified published results only
  const publishedResults = useMemo(() => {
    return results.filter(r => r.resultStatus === 'PUBLISHED');
  }, [results]);

  // Compute category counts
  const categoryCounts = useMemo(() => {
    const counts: Record<string, number> = { ALL: publishedResults.length };
    for (const res of publishedResults) {
      counts[res.categoryName] = (counts[res.categoryName] || 0) + 1;
    }
    return counts;
  }, [publishedResults]);

  // Filtered results list
  const filtered = useMemo(() => {
    const query = search.trim().toLowerCase();
    return publishedResults.filter(res => {
      const matchesSearch =
        !query ||
        res.competitionName.toLowerCase().includes(query) ||
        res.competitionCode.toLowerCase().includes(query) ||
        res.stageName.toLowerCase().includes(query) ||
        res.ranks.some(
          rk =>
            rk.candidateName.toLowerCase().includes(query) ||
            rk.bib.toLowerCase().includes(query) ||
            (`#${rk.bib.toLowerCase()}`).includes(query) ||
            rk.teamName.toLowerCase().includes(query) ||
            rk.teamCode.toLowerCase().includes(query)
        );

      const matchesCat = selectedCategory === 'ALL' || res.categoryName === selectedCategory;
      const matchesType = selectedType === 'ALL' || res.type === selectedType;

      return matchesSearch && matchesCat && matchesType;
    });
  }, [publishedResults, search, selectedCategory, selectedType]);

  const handleResetFilters = () => {
    setSearch('');
    setSelectedCategory('ALL');
    setSelectedType('ALL');
  };

  return (
    <div className="public-page-stack space-y-6 sm:space-y-8 max-w-7xl mx-auto w-full">
      {/* EDITORIAL HEADER BANNER (MATCHING STITCH) */}
      <section className="relative w-full rounded-2xl bg-gradient-to-b from-[#230D0F] via-[#1B090B] to-[#120507] p-6 sm:p-10 border border-[#BA1912]/30 shadow-2xl overflow-hidden text-center">
        {/* Ambient Ruby & Gold Radial Overlays */}
        <div className="pointer-events-none absolute -top-24 left-1/2 -translate-x-1/2 w-[760px] h-[340px] bg-[#BA1912]/20 blur-[120px] rounded-full" />
        <div className="pointer-events-none absolute top-12 right-12 w-80 h-80 bg-[#FDBF0F]/10 blur-[90px] rounded-full" />

        <div className="relative z-10 max-w-4xl mx-auto flex flex-col items-center">
          {/* Eyebrow Badge */}
          <div className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-full bg-[#1B090B] border border-[#FDBF0F]/40 text-[#FDBF0F] text-[10px] sm:text-xs font-bold uppercase tracking-[0.2em] shadow-sm mb-4">
            <span className="material-symbols-outlined text-[15px] text-[#FDBF0F]">verified</span>
            <span>Ratified Tabulation Directory • Cycle 2026</span>
          </div>

          {/* Main Editorial Title */}
          <h1
            className="text-2xl sm:text-4xl lg:text-5xl font-extrabold uppercase tracking-wide text-[#F2F3E6] mb-3"
            style={{ fontFamily: "'Cinzel', serif" }}
          >
            Public Results Directory
          </h1>

          {/* Symmetrical Gold Flourish Divider */}
          <div className="flex items-center justify-center gap-3 w-48 mx-auto my-3 opacity-80">
            <div className="h-[1px] flex-1 bg-gradient-to-r from-transparent to-[#FDBF0F]" />
            <span className="text-[#FDBF0F] text-xs">❖</span>
            <div className="h-[1px] flex-1 bg-gradient-to-l from-transparent to-[#FDBF0F]" />
          </div>

          {/* Subtitle Description */}
          <p className="text-xs sm:text-sm text-[#F2F3E6]/75 max-w-2xl leading-relaxed mb-6">
            Official merit ledger, ratified scorecards, and commemorative gazette records across all individual items and group ensembles.
          </p>

          {/* Live Results Counter & Metadata Ribbon */}
          <div className="flex flex-wrap items-center justify-center gap-2.5 sm:gap-3">
            <div className="flex items-center gap-2 px-3.5 py-1.5 rounded-lg bg-[#230D0F] border border-[#FDBF0F]/40 shadow-xs">
              <span className="w-2 h-2 rounded-full bg-[#FDBF0F] animate-pulse" />
              <span className="text-xs font-bold uppercase tracking-wider text-[#FDBF0F] font-mono">
                {competitionsSyncState === 'loading'
                  ? 'Loading event total…'
                  : competitionsSyncState === 'ready'
                  ? `${publishedResults.length} / ${competitions.length} Events Ratified`
                  : `${publishedResults.length} Published Results`}
              </span>
            </div>

            <div className="hidden sm:flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[#1B090B] border border-[#BA1912]/40 text-[#F2F3E6]/80 text-xs">
              <span className="material-symbols-outlined text-[16px] text-[#FDBF0F]">gavel</span>
              <span className="uppercase tracking-wider text-[11px] font-medium">Grand Jury Authentication: Pass 03</span>
            </div>

            <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[#1B090B] border border-[#BA1912]/40 text-[#F2F3E6]/80 text-xs">
              <span className="material-symbols-outlined text-[16px] text-[#FDBF0F]">schedule</span>
              <span className="uppercase tracking-wider text-[11px] font-medium font-mono">
                {resultsSyncState === 'ready' ? 'Live Sync Active' : resultsSyncState === 'loading' ? 'Syncing...' : 'Official Ledger'}
              </span>
            </div>
          </div>
        </div>
      </section>

      {/* SEARCH, DIVISION TABS & ADVANCED FILTER SUITE (MATCHING STITCH) */}
      <section className="w-full bg-[#230D0F] rounded-2xl border border-[#BA1912]/30 p-4 sm:p-6 shadow-xl">
        <div className="flex flex-col gap-4 sm:gap-5">
          {/* Instant Lookup Bar */}
          <div className="relative w-full flex flex-col md:flex-row items-stretch gap-2 bg-[#1B090B] p-1.5 sm:p-2 rounded-xl border border-[#BA1912]/30 shadow-inner">
            <div className="relative flex-1 flex items-center">
              <span className="material-symbols-outlined absolute left-3.5 text-[#F2F3E6]/50 text-[20px] pointer-events-none">search</span>
              <input
                id="searchDirectory"
                type="text"
                placeholder="Search candidate name, Bib # (e.g. #112), competition title, or guild..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="w-full h-11 pl-11 pr-10 bg-[#1B090B] text-[#F2F3E6] placeholder:text-[#F2F3E6]/40 text-xs sm:text-sm font-medium rounded-lg focus:outline-none focus:bg-[#281014] transition-all"
              />
              {search && (
                <button
                  type="button"
                  onClick={() => setSearch('')}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-[#F2F3E6]/60 hover:text-[#FDBF0F] p-1"
                  aria-label="Clear search input"
                >
                  ✕
                </button>
              )}
            </div>
            <div className="flex items-center gap-1.5">
              <button
                type="button"
                className="w-full md:w-auto h-11 px-5 sm:px-6 bg-[#BA1912] hover:bg-[#A91D3A] text-[#F2F3E6] font-bold text-xs uppercase tracking-wider rounded-lg flex items-center justify-center gap-1.5 shadow-md active:scale-95 transition-all shrink-0"
              >
                <span className="material-symbols-outlined text-[18px]">manage_search</span>
                <span className="hidden sm:inline">Lookup Records</span>
                <span className="sm:hidden">Lookup</span>
              </button>
            </div>
          </div>

          {/* Division Category Tabs & Format Dropdown */}
          <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3 pt-1">
            {/* Scrollable Division Pills on mobile, flex-wrap on desktop */}
            <div className="flex items-center gap-1.5 sm:gap-2 overflow-x-auto no-scrollbar -mx-4 px-4 sm:mx-0 sm:px-0 pb-1 sm:pb-0">
              <button
                type="button"
                onClick={() => setSelectedCategory('ALL')}
                className={`shrink-0 px-3.5 py-2 rounded-lg text-xs font-semibold tracking-wider uppercase transition-all flex items-center gap-1.5 ${
                  selectedCategory === 'ALL'
                    ? 'bg-[#FDBF0F] text-[#1B090B] font-bold shadow-md'
                    : 'bg-[#1B090B] border border-[#BA1912]/30 text-[#F2F3E6]/80 hover:text-[#F2F3E6] hover:border-[#FDBF0F]'
                }`}
              >
                <span>All Divisions</span>
                <span className={`px-1.5 py-0.2 rounded text-[10px] font-mono font-bold ${selectedCategory === 'ALL' ? 'bg-[#1B090B] text-[#FDBF0F]' : 'bg-[#230D0F] text-[#F2F3E6]/80'}`}>
                  {categoryCounts['ALL'] || 0}
                </span>
              </button>

              {categories.map(cat => {
                const count = categoryCounts[cat.name] || 0;
                const isSelected = selectedCategory === cat.name;
                return (
                  <button
                    key={cat.id}
                    type="button"
                    onClick={() => setSelectedCategory(cat.name)}
                    className={`shrink-0 px-3.5 py-2 rounded-lg text-xs font-semibold tracking-wider uppercase transition-all flex items-center gap-1.5 ${
                      isSelected
                        ? 'bg-[#BA1912] text-[#F2F3E6] font-bold shadow-md border border-[#BA1912]'
                        : 'bg-[#1B090B] border border-[#BA1912]/30 text-[#F2F3E6]/80 hover:text-[#F2F3E6] hover:border-[#FDBF0F]'
                    }`}
                  >
                    <span>{cat.name}</span>
                    <span className={`px-1.5 py-0.2 rounded text-[10px] font-mono ${isSelected ? 'bg-[#FDBF0F] text-[#1B090B] font-bold' : 'bg-[#230D0F] text-[#F2F3E6]/80'}`}>
                      {count}
                    </span>
                  </button>
                );
              })}

              <div className="shrink-0 hidden sm:flex items-center gap-1 h-8 px-2.5 rounded bg-[#BA1912]/20 border border-[#BA1912]/50 text-[#FDBF0F] text-[11px] font-bold uppercase tracking-wider">
                <span className="material-symbols-outlined text-[15px]">verified</span>
                <span>Ratified</span>
              </div>
            </div>

            {/* Format Filter & Reset Button */}
            <div className="flex items-center gap-2 self-start lg:self-auto shrink-0">
              <div className="relative">
                <select
                  aria-label="Filter by Competition Format"
                  value={selectedType}
                  onChange={(e) => setSelectedType(e.target.value)}
                  className="bg-[#1B090B] hover:bg-[#281014] text-[#F2F3E6] text-xs font-medium py-2 pl-3 pr-8 rounded-lg border border-[#BA1912]/40 focus:border-[#FDBF0F] focus:outline-none appearance-none cursor-pointer"
                >
                  <option value="ALL">All Formats (Stage &amp; Non-Stage)</option>
                  <option value="SOLO">Individual Items (Solo)</option>
                  <option value="GROUP">Group Ensembles</option>
                </select>
                <span className="material-symbols-outlined text-[18px] text-[#FDBF0F] absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none">expand_more</span>
              </div>

              {(search || selectedCategory !== 'ALL' || selectedType !== 'ALL') && (
                <button
                  type="button"
                  onClick={handleResetFilters}
                  className="flex items-center gap-1 px-2.5 py-2 rounded-lg bg-[#1B090B] hover:bg-[#281014] text-[#FDBF0F] text-xs font-semibold border border-[#FDBF0F]/30 transition-colors"
                >
                  <span className="material-symbols-outlined text-[16px]">restart_alt</span>
                  <span className="hidden sm:inline">Reset</span>
                </button>
              )}
            </div>
          </div>

          {/* Active Filter Pill Tags */}
          <div className="flex flex-wrap items-center gap-2 pt-2 border-t border-[#BA1912]/20 text-[11px] text-[#F2F3E6]/70">
            <span className="uppercase tracking-widest text-[#FDBF0F]/80 font-bold">Active Filters:</span>
            <span className="inline-flex items-center gap-1 px-2.5 py-1 bg-[#1B090B] text-[#F2F3E6] rounded border border-white/5">
              Cycle: 2026 Academic Biennial
            </span>
            <span className="inline-flex items-center gap-1 px-2.5 py-1 bg-[#1B090B] text-[#F2F3E6] rounded border border-white/5">
              Status: Ratified Scorecards Only
            </span>
            {selectedCategory !== 'ALL' && (
              <span className="inline-flex items-center gap-1 px-2.5 py-1 bg-[#BA1912]/30 text-[#FDBF0F] rounded border border-[#BA1912]/60 font-semibold">
                Division: {selectedCategory}
                <button onClick={() => setSelectedCategory('ALL')} className="hover:text-white ml-0.5" aria-label="Clear division filter">✕</button>
              </span>
            )}
            {search && (
              <span className="inline-flex items-center gap-1 px-2.5 py-1 bg-[#BA1912]/30 text-[#FDBF0F] rounded border border-[#BA1912]/60 font-semibold">
                Search: &ldquo;{search}&rdquo;
                <button onClick={() => setSearch('')} className="hover:text-white ml-0.5" aria-label="Clear search query">✕</button>
              </span>
            )}
          </div>
        </div>
      </section>

      {/* RESULTS COUNT & STATUS STRIP */}
      <div className="flex items-center justify-between text-xs text-[#F2F3E6]/75 px-1">
        <div className="flex items-center gap-2">
          <span className="w-2 h-2 rounded-full bg-[#FDBF0F]" />
          <span>
            Showing <strong className="text-[#FDBF0F] font-bold">{filtered.length}</strong> of{' '}
            <strong className="text-[#F2F3E6]">{publishedResults.length}</strong> Ratified Events
          </span>
        </div>
        {search && (
          <button
            onClick={() => setSearch('')}
            className="text-[#FDBF0F] hover:underline font-semibold text-xs"
          >
            Clear Search Filter
          </button>
        )}
      </div>

      {/* FIRESTORE LOADING STATE */}
      {resultsSyncState === 'loading' && publishedResults.length === 0 && (
        <div className="p-12 text-center rounded-2xl bg-[#230D0F] border border-[#BA1912]/30">
          <div className="w-8 h-8 rounded-full border-2 border-[#FDBF0F] border-t-transparent animate-spin mx-auto mb-3" />
          <h3 className="text-sm font-bold text-[#F2F3E6]">Loading Ratified Results Directory…</h3>
          <p className="text-xs text-[#F2F3E6]/60 mt-1">Connecting to official Firestore event tabulation</p>
        </div>
      )}

      {/* FIRESTORE ERROR STATE */}
      {resultsSyncState === 'error' && (
        <div role="alert" className="p-6 rounded-2xl bg-[#2D1217] border border-red-500/40 text-center">
          <span className="material-symbols-outlined text-[28px] text-red-400 mx-auto mb-2 block">error</span>
          <h3 className="text-sm font-bold text-red-200">Unable to synchronize results live</h3>
          <p className="text-xs text-[#F2F3E6]/70 mt-1">
            Displaying cached festival records. Real-time updates will resume once connected.
          </p>
        </div>
      )}

      {/* OFFICIAL COMPETITION RESULTS GRID (3 COLUMNS DESKTOP, 1 COLUMN MOBILE) */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5 sm:gap-6">
        {filtered.length === 0 && resultsSyncState !== 'loading' ? (
          <div className="col-span-full p-12 text-center rounded-2xl bg-[#230D0F] border border-[#BA1912]/30">
            <span className="material-symbols-outlined text-[36px] text-[#FDBF0F] mx-auto mb-3 block">search_off</span>
            <h3 className="text-base font-bold text-[#F2F3E6]">No Results Found</h3>
            <p className="text-xs text-[#F2F3E6]/70 max-w-md mx-auto mt-1 leading-relaxed">
              {search
                ? `No published competition matches "${search}". Try searching by another candidate name, Bib #, or division.`
                : 'No published results found for the selected division or format.'}
            </p>
            {(search || selectedCategory !== 'ALL' || selectedType !== 'ALL') && (
              <button
                type="button"
                onClick={handleResetFilters}
                className="mt-4 px-4 py-2 rounded-lg bg-[#BA1912] hover:bg-[#A91D3A] text-[#F2F3E6] text-xs font-bold transition-colors"
              >
                Reset All Filters
              </button>
            )}
          </div>
        ) : (
          filtered.map(res => {
            const rank1 = res.ranks.find(r => r.rank === 1);
            const rank2 = res.ranks.find(r => r.rank === 2);
            const rank3 = res.ranks.find(r => r.rank === 3);

            return (
              <article
                key={res.id}
                className="flex flex-col bg-[#230D0F] hover:bg-[#281014] rounded-2xl p-4 sm:p-5 border border-[#BA1912]/30 hover:border-[#BA1912]/60 shadow-lg hover:shadow-2xl transition-all justify-between group"
              >
                <div>
                  {/* Card Header & Metadata */}
                  <div className="flex items-start justify-between gap-2 mb-3">
                    <div className="flex flex-wrap items-center gap-1.5">
                      <span className="px-2 py-0.5 bg-[#BA1912] text-[#F2F3E6] font-mono text-[11px] font-bold uppercase rounded shadow-xs">
                        #{res.competitionCode}
                      </span>
                      <span className="px-2 py-0.5 bg-[#1B090B] text-[#F2F3E6]/85 text-[11px] font-medium uppercase rounded border border-white/5">
                        {res.categoryName} Division
                      </span>
                    </div>
                    <span className="px-2 py-0.5 bg-[#1B090B] text-[#FDBF0F] text-[10px] font-semibold uppercase rounded flex items-center gap-1 border border-[#FDBF0F]/20 shrink-0">
                      <span className="w-1.5 h-1.5 rounded-full bg-[#FDBF0F] inline-block" />
                      Stage: {res.stageName}
                    </span>
                  </div>

                  {/* Competition Title */}
                  <h3
                    className="text-base font-bold text-[#F2F3E6] group-hover:text-[#FDBF0F] uppercase line-clamp-1 transition-colors"
                    style={{ fontFamily: "'Cinzel', serif" }}
                  >
                    {res.competitionName}
                  </h3>

                  {/* Grand Jury Certified Strip */}
                  <div className="flex items-center gap-1.5 text-[#F2F3E6]/75 text-[10px] uppercase tracking-wider my-3 py-1.5 px-2.5 rounded bg-[#1B090B]/60 border border-[#BA1912]/20">
                    <span className="material-symbols-outlined text-[15px] text-[#FDBF0F] shrink-0">verified_user</span>
                    <span className="truncate">Grand Jury Certified • {res.publishedDate}</span>
                  </div>

                  {/* Laureates Roster (Grade Only) */}
                  <div className="flex flex-col gap-2 my-3">
                    {/* 1st Place Champion */}
                    {rank1 && (
                      <div className="flex items-center justify-between p-2.5 bg-[#1B090B] rounded-xl border border-[#FDBF0F]/30 shadow-xs">
                        <div className="flex items-center gap-2.5 min-w-0">
                          <span className="w-6 h-6 rounded bg-[#FDBF0F] text-[#1B090B] font-black text-xs flex items-center justify-center shrink-0 shadow-xs">
                            1
                          </span>
                          <div className="min-w-0">
                            <h4 className="text-xs font-bold text-[#F2F3E6] truncate">{rank1.candidateName}</h4>
                            <div className="flex items-center gap-1.5 text-[10px] text-[#F2F3E6]/60">
                              <span className="font-mono text-[#FDBF0F] font-bold">Bib #{rank1.bib}</span>
                              <span>•</span>
                              <span className="truncate">{rank1.teamName}</span>
                            </div>
                          </div>
                        </div>
                        <div className="text-right shrink-0">
                          <span className="px-2 py-0.5 rounded bg-[#2D1217] text-[#FDBF0F] text-[10px] font-bold uppercase block border border-[#FDBF0F]/30">
                            Grade {rank1.grade || '—'}
                          </span>
                        </div>
                      </div>
                    )}

                    {/* 2nd Place Silver */}
                    {rank2 && (
                      <div className="flex items-center justify-between p-2 bg-[#1B090B]/60 rounded-xl border border-white/5">
                        <div className="flex items-center gap-2.5 min-w-0">
                          <span className="w-5 h-5 rounded bg-[#D8C8B7] text-[#1B090B] font-bold text-[11px] flex items-center justify-center shrink-0">
                            2
                          </span>
                          <div className="min-w-0">
                            <h4 className="text-xs font-semibold text-[#F2F3E6] truncate">{rank2.candidateName}</h4>
                            <div className="flex items-center gap-1.5 text-[10px] text-[#F2F3E6]/60">
                              <span className="font-mono text-[#D8C8B7]">Bib #{rank2.bib}</span>
                              <span>•</span>
                              <span className="truncate">{rank2.teamName}</span>
                            </div>
                          </div>
                        </div>
                        <div className="text-right shrink-0">
                          <span className="px-2 py-0.5 rounded bg-[#230D0F] text-[#F2F3E6]/80 text-[10px] font-semibold uppercase block">
                            Grade {rank2.grade || '—'}
                          </span>
                        </div>
                      </div>
                    )}

                    {/* 3rd Place Bronze */}
                    {rank3 && (
                      <div className="flex items-center justify-between p-2 bg-[#1B090B]/60 rounded-xl border border-white/5">
                        <div className="flex items-center gap-2.5 min-w-0">
                          <span className="w-5 h-5 rounded bg-[#86152C] text-[#FFF8EE] font-bold text-[11px] flex items-center justify-center shrink-0">
                            3
                          </span>
                          <div className="min-w-0">
                            <h4 className="text-xs font-semibold text-[#F2F3E6] truncate">{rank3.candidateName}</h4>
                            <div className="flex items-center gap-1.5 text-[10px] text-[#F2F3E6]/60">
                              <span className="font-mono text-[#FDBF0F]/80">Bib #{rank3.bib}</span>
                              <span>•</span>
                              <span className="truncate">{rank3.teamName}</span>
                            </div>
                          </div>
                        </div>
                        <div className="text-right shrink-0">
                          <span className="px-2 py-0.5 rounded bg-[#230D0F] text-[#F2F3E6]/80 text-[10px] font-semibold uppercase block">
                            Grade {rank3.grade || '—'}
                          </span>
                        </div>
                      </div>
                    )}
                  </div>
                </div>

                {/* Card Actions Footer matching Stitch (Poster & Tabulation) */}
                <div className="grid grid-cols-2 gap-2 pt-3 mt-2 border-t border-[#BA1912]/20">
                  <PosterDownloadDialog result={res} theme={theme} />
                  <Link
                    href={`/public/competition/${res.competitionId}`}
                    className="px-3 py-2 bg-[#BA1912] hover:bg-[#A91D3A] text-[#F2F3E6] text-xs font-bold uppercase tracking-wider rounded-lg flex items-center justify-center gap-1.5 transition-colors shadow-sm"
                  >
                    <span>Tabulation</span>
                    <span className="material-symbols-outlined text-[16px]">arrow_forward</span>
                  </Link>
                </div>
              </article>
            );
          })
        )}
      </div>

    </div>
  );
}

export default function PublicResultsDirectoryPage() {
  return (
    <PublicLayout>
      <Suspense
        fallback={
          <div className="p-12 text-center rounded-2xl bg-[#230D0F] border border-[#BA1912]/30 max-w-xl mx-auto text-xs text-[#F2F3E6]/70">
            <div className="w-6 h-6 rounded-full border-2 border-[#FDBF0F] border-t-transparent animate-spin mx-auto mb-2" />
            Loading ratified results directory…
          </div>
        }
      >
        <DirectoryContent />
      </Suspense>
    </PublicLayout>
  );
}
