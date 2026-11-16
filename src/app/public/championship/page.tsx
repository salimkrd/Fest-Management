'use client';

import React, { useState, useMemo } from 'react';
import { PublicLayout } from '@/components/layout/PublicLayout';
import { useFest } from '@/context/FestContext';
import { ChampionshipPodium } from '@/components/domain/ChampionshipPodium';
import { Loader2, AlertCircle } from 'lucide-react';

export default function PublicChampionshipPage() {
  const { teams, theme, teamsSyncState } = useFest();

  const [selectedDivision, setSelectedDivision] = useState<'ALL' | 'SENIOR' | 'GENERAL' | 'SUB_JUNIOR'>('ALL');

  const sortedTeams = useMemo(() => {
    return [...teams].sort((a, b) => (b.totalPoints || 0) - (a.totalPoints || 0));
  }, [teams]);

  const totalFestPoints = useMemo(() => {
    return sortedTeams.reduce((acc, t) => acc + (t.totalPoints || 0), 0) || 1;
  }, [sortedTeams]);

  return (
    <PublicLayout>
      <div className="public-page-stack space-y-8 max-w-7xl mx-auto">
        {/* ========================================================= */}
        {/* SECTION 1: EDITORIAL CHAMPIONSHIP HEADER BANNER           */}
        {/* ========================================================= */}
        <section className="relative w-full rounded-2xl bg-gradient-to-b from-[#230D0F] via-[#1B090B] to-[#120507] p-6 sm:p-10 border border-[#BA1912]/30 shadow-2xl overflow-hidden text-center">
          {/* Top Ambient Glow Scrim */}
          <div className="pointer-events-none absolute -top-32 left-1/2 -translate-x-1/2 w-[750px] h-[300px] bg-gradient-to-b from-[#BA1912]/25 via-[#FDBF0F]/15 to-transparent blur-3xl" />
          <div className="pointer-events-none absolute top-10 right-10 w-64 h-64 bg-[#FDBF0F]/10 blur-[80px] rounded-full" />

          <div className="relative z-10 max-w-4xl mx-auto flex flex-col items-center">
            {/* Live Status & Eyebrow Pill */}
            <div className="flex flex-wrap items-center justify-center gap-2 mb-4">
              <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-[#1B090B] border border-[#FDBF0F]/30 text-[#FDBF0F] text-[10px] sm:text-xs font-bold uppercase tracking-[0.18em] shadow-sm">
                <span className="w-2 h-2 rounded-full bg-[#FDBF0F] animate-ping" />
                <span className="w-2 h-2 rounded-full bg-[#FDBF0F] -ml-3" />
                <span>OFFICIAL CONVOCATION GUILD TROPHY • LIVE STANDINGS</span>
              </div>

              <div className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-[#230D0F] border border-[#BA1912]/40 text-[#F2F3E6]/80 text-[10px] sm:text-xs">
                <span className="material-symbols-outlined text-[15px] text-[#FDBF0F]">verified_user</span>
                <span className="font-mono uppercase tracking-wider">
                  {teamsSyncState === 'ready'
                    ? 'Firestore Real-time Synced'
                    : teamsSyncState === 'loading'
                    ? 'Synchronizing Ledgers…'
                    : 'Ratified Festival Ledger'}
                </span>
              </div>
            </div>

            {/* Grand Editorial Title */}
            <div className="flex items-center justify-center gap-3 w-full my-2">
              <span className="text-[#FDBF0F] select-none text-base sm:text-xl">❖</span>
              <h1
                className="text-2xl sm:text-4xl lg:text-5xl font-extrabold uppercase tracking-wide text-[#F2F3E6]"
                style={{ fontFamily: "'Cinzel', serif" }}
              >
                TEAM CHAMPIONSHIP
              </h1>
              <span className="text-[#FDBF0F] select-none text-base sm:text-xl">❖</span>
            </div>

            {/* Festival & Campus Subtitle */}
            <div className="flex items-center gap-2 text-[#FDBF0F] text-[11px] sm:text-xs tracking-[0.25em] uppercase font-semibold my-1 font-mono">
              <span>{theme.institutionName || "MA'DIN SUFFA CAMPUS VAVOOR"}</span>
              <span>•</span>
              <span>ACADEMIC CYCLE {theme.year || '2026'}</span>
            </div>

            {/* Symmetrical Flourish Divider */}
            <div className="flex items-center justify-center gap-3 w-56 mx-auto my-3 opacity-80">
              <div className="h-[1px] flex-1 bg-gradient-to-r from-transparent to-[#FDBF0F]" />
              <span className="text-[#FDBF0F] text-xs">❖</span>
              <div className="h-[1px] flex-1 bg-gradient-to-l from-transparent to-[#FDBF0F]" />
            </div>

            <p className="text-xs sm:text-sm text-[#F2F3E6]/75 max-w-2xl leading-relaxed mb-6 font-sora">
              Grand guild registry, continuous point accumulation, and official house standings across all solo competitions, group ensembles, and scholastic exhibitions.
            </p>

            {/* Quick Tally Metric Ribbon */}
            <div className="flex flex-wrap items-center justify-center gap-2.5 sm:gap-4">
              <div className="flex items-center gap-2 px-3.5 py-1.5 rounded-lg bg-[#230D0F] border border-[#FDBF0F]/40 shadow-xs">
                <span className="w-2 h-2 rounded-full bg-[#FDBF0F] animate-pulse" />
                <span className="text-xs font-bold uppercase tracking-wider text-[#FDBF0F] font-mono">
                  {teams.length} Guild Delegations Competing
                </span>
              </div>

              <div className="flex items-center gap-2 px-3.5 py-1.5 rounded-lg bg-[#1B090B] border border-white/10 text-xs font-mono text-[#F2F3E6]">
                <span className="text-[#F2F3E6]/60 uppercase text-[10px]">Total Awarded:</span>
                <strong className="text-[#FDBF0F] font-black">{totalFestPoints} PTS</strong>
              </div>

              <div className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg bg-[#230D0F] border border-[#BA1912]/40 text-[#F2F3E6]/80 text-xs font-mono">
                <span className="material-symbols-outlined text-[15px] text-[#FDBF0F]">balance</span>
                <span className="uppercase text-[11px]">Audit Ratified</span>
              </div>
            </div>
          </div>
        </section>

        {/* FIRESTORE LOADING STATE */}
        {teamsSyncState === 'loading' && sortedTeams.length === 0 && (
          <div className="p-12 text-center rounded-2xl bg-[#230D0F] border border-[#BA1912]/30">
            <Loader2 className="w-8 h-8 text-[#FDBF0F] animate-spin mx-auto mb-3" />
            <h3 className="text-sm font-bold text-[#F2F3E6]">Loading House Championship Standings…</h3>
            <p className="text-xs text-[#F2F3E6]/60 mt-1">Calculating real-time team point accumulations</p>
          </div>
        )}

        {/* FIRESTORE ERROR STATE */}
        {teamsSyncState === 'error' && (
          <div role="alert" className="p-6 rounded-2xl bg-[#2D1217] border border-red-500/40 text-center">
            <AlertCircle className="w-7 h-7 text-red-400 mx-auto mb-2" />
            <h3 className="text-sm font-bold text-red-200">Unable to synchronize team scores live</h3>
            <p className="text-xs text-[#F2F3E6]/70 mt-1">
              Displaying ratified festival records. Real-time updates will resume once connected.
            </p>
          </div>
        )}

        {/* ========================================================= */}
        {/* SECTION 2: TOP 3 WINNERS PODIUM (Podium of Eminence)      */}
        {/* ========================================================= */}
        {sortedTeams.length > 0 && <ChampionshipPodium teams={teams} />}

        {/* ========================================================= */}
        {/* SECTION 3: OVERALL GUILD LEADERBOARD & RATIFICATION TABLE */}
        {/* ========================================================= */}
        <section className="w-full rounded-2xl bg-[#230D0F] border border-[#BA1912]/30 shadow-xl overflow-hidden">
          {/* Table Header & Division Filter Tabs */}
          <div className="p-5 sm:p-6 border-b border-[#BA1912]/30 flex flex-col md:flex-row md:items-end justify-between gap-4">
            <div>
              <div className="flex items-center gap-2 text-[#FDBF0F] text-[10px] font-bold uppercase tracking-widest mb-1 font-mono">
                <span>AUDITED TABULATION LEDGER</span>
                <span>—</span>
                <span>RECORD NO. SCV-2026-CH</span>
              </div>
              <h2
                className="text-lg sm:text-2xl font-bold uppercase text-[#F2F3E6]"
                style={{ fontFamily: "'Cinzel', serif" }}
              >
                OFFICIAL GUILD RATIFICATION TABLE
              </h2>
              <p className="text-xs text-[#F2F3E6]/70 max-w-2xl mt-1 leading-relaxed">
                Point allocation audited under Central Tabulation Committee standards: individual competition recitals, memorization trials, dialectical debates, and choir cantatas.
              </p>
            </div>

            {/* Division Filter Buttons Strip */}
            <div className="flex items-center gap-1.5 self-start md:self-auto bg-[#1B090B] p-1 rounded-lg border border-white/5 overflow-x-auto no-scrollbar">
              <button
                type="button"
                onClick={() => setSelectedDivision('ALL')}
                className={`px-3 py-1.5 rounded text-[11px] font-mono font-bold uppercase tracking-wider transition-colors whitespace-nowrap ${
                  selectedDivision === 'ALL'
                    ? 'bg-[#BA1912] text-[#F2F3E6] shadow-xs'
                    : 'text-[#F2F3E6]/70 hover:text-[#F2F3E6]'
                }`}
              >
                All Sessions
              </button>
              <button
                type="button"
                onClick={() => setSelectedDivision('SENIOR')}
                className={`px-3 py-1.5 rounded text-[11px] font-mono font-bold uppercase tracking-wider transition-colors whitespace-nowrap ${
                  selectedDivision === 'SENIOR'
                    ? 'bg-[#BA1912] text-[#F2F3E6] shadow-xs'
                    : 'text-[#F2F3E6]/70 hover:text-[#F2F3E6]'
                }`}
              >
                Senior Div
              </button>
              <button
                type="button"
                onClick={() => setSelectedDivision('GENERAL')}
                className={`px-3 py-1.5 rounded text-[11px] font-mono font-bold uppercase tracking-wider transition-colors whitespace-nowrap ${
                  selectedDivision === 'GENERAL'
                    ? 'bg-[#BA1912] text-[#F2F3E6] shadow-xs'
                    : 'text-[#F2F3E6]/70 hover:text-[#F2F3E6]'
                }`}
              >
                General Div
              </button>
              <button
                type="button"
                onClick={() => setSelectedDivision('SUB_JUNIOR')}
                className={`px-3 py-1.5 rounded text-[11px] font-mono font-bold uppercase tracking-wider transition-colors whitespace-nowrap ${
                  selectedDivision === 'SUB_JUNIOR'
                    ? 'bg-[#BA1912] text-[#F2F3E6] shadow-xs'
                    : 'text-[#F2F3E6]/70 hover:text-[#F2F3E6]'
                }`}
              >
                Sub-Junior
              </button>
            </div>
          </div>

          {/* DESKTOP TABLE VIEW (hidden on mobile) */}
          <div className="hidden md:block overflow-x-auto">
            <table className="w-full text-left border-collapse min-w-[900px] text-xs">
              <thead>
                <tr className="bg-[#1B090B]/80 border-b border-[#BA1912]/20 text-[#F2F3E6]/75 font-mono text-[10px] uppercase tracking-widest">
                  <th className="py-3.5 px-4 w-16 text-center">Rank</th>
                  <th className="py-3.5 px-4">Academic Guild &amp; Faculty Adviser</th>
                  <th className="py-3.5 px-4 text-center">Solo Events</th>
                  <th className="py-3.5 px-4 text-center">Group Events</th>
                  <th className="py-3.5 px-4 text-center">Medal Laurels (G/S/B)</th>
                  <th className="py-3.5 px-4 text-center font-bold">Cumulative Aggregate</th>
                  <th className="py-3.5 px-4 w-44">Share of Total Tally</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#BA1912]/15">
                {sortedTeams.map((team, idx) => {
                  const sharePercent = totalFestPoints > 0 ? ((team.totalPoints || 0) / totalFestPoints * 100).toFixed(1) : '0';

                  return (
                    <tr
                      key={team.id}
                      className="transition-colors hover:bg-[#281014]/60"
                    >
                      {/* Rank */}
                      <td className="py-4 px-4 text-center">
                        <span
                          className={`w-7 h-7 mx-auto rounded flex items-center justify-center font-mono font-black text-xs shadow-xs ${
                            idx === 0
                              ? 'bg-[#FDBF0F] text-[#1B090B]'
                              : idx === 1
                              ? 'bg-[#D8C8B7] text-[#1B090B]'
                              : idx === 2
                              ? 'bg-[#86152C] text-[#FFF8EE]'
                              : 'bg-[#1B090B] text-[#F2F3E6]/70 border border-white/5'
                          }`}
                        >
                          {String(idx + 1).padStart(2, '0')}
                        </span>
                      </td>

                      {/* Guild & Insignia */}
                      <td className="py-4 px-4">
                        <div className="flex items-center gap-3">
                          <div
                            className="w-10 h-10 rounded-lg flex items-center justify-center text-white font-mono font-black text-xs shrink-0 shadow-sm border border-white/10"
                            style={{ backgroundColor: team.color || '#86152C' }}
                          >
                            {team.code}
                          </div>
                          <div>
                            <span className="font-bold text-sm text-[#F2F3E6] block uppercase tracking-wide">
                              {team.name}
                            </span>
                            <span className="text-[10px] text-[#F2F3E6]/60">
                              {team.managerName || team.zone || 'Academic Faculty Delegation'}
                            </span>
                          </div>
                        </div>
                      </td>

                      {/* Solo Events */}
                      <td className="py-4 px-4 text-center font-mono text-sm font-semibold text-[#F2F3E6]">
                        {team.soloPoints || 0}
                      </td>

                      {/* Group Events */}
                      <td className="py-4 px-4 text-center font-mono text-sm font-semibold text-[#F2F3E6]">
                        {team.groupPoints || 0}
                      </td>

                      {/* Medals */}
                      <td className="py-4 px-4 text-center">
                        <div className="flex items-center justify-center gap-2 font-mono text-xs">
                          <span className="text-[#FDBF0F] font-bold" title="Gold Medals">
                            🥇 {team.firstCount || 0}
                          </span>
                          <span className="text-[#D8C8B7] font-bold" title="Silver Medals">
                            🥈 {team.secondCount || 0}
                          </span>
                          <span className="text-[#BA1912] font-bold" title="Bronze Medals">
                            🥉 {team.thirdCount || 0}
                          </span>
                        </div>
                      </td>

                      {/* Cumulative Aggregate */}
                      <td className="py-4 px-4 text-center">
                        <span
                          className="text-lg font-black text-[#FDBF0F] font-mono block leading-none"
                          style={{ fontFamily: "'Cinzel', serif" }}
                        >
                          {team.totalPoints || 0}
                        </span>
                        <span className="text-[9px] uppercase tracking-wider text-[#F2F3E6]/60 font-mono">
                          PTS
                        </span>
                      </td>

                      {/* Share % with Bar */}
                      <td className="py-4 px-4">
                        <div className="space-y-1">
                          <div className="flex justify-between text-[10px] font-mono text-[#F2F3E6]/75">
                            <span className="font-bold">{sharePercent}%</span>
                            <span className="text-[9px] text-[#F2F3E6]/50">of tally</span>
                          </div>
                          <div className="w-full bg-[#1B090B] h-2 rounded-full overflow-hidden border border-white/5">
                            <div
                              className="h-full rounded-full transition-all duration-500 shadow-xs"
                              style={{
                                width: `${Math.max(Number(sharePercent), 4)}%`,
                                backgroundColor: team.color || '#BA1912'
                              }}
                            />
                          </div>
                        </div>
                      </td>

                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* ========================================================= */}
          {/* MOBILE GUILD LEDGER CARDS (Matching Stitch Mobile)        */}
          {/* ========================================================= */}
          <div className="block md:hidden p-4 space-y-3">
            {sortedTeams.map((team, idx) => {
              const sharePercent = totalFestPoints > 0 ? ((team.totalPoints || 0) / totalFestPoints * 100).toFixed(1) : '0';

              return (
                <div
                  key={team.id}
                  className="rounded-xl p-4 bg-[#1B090B] border border-[#BA1912]/30 shadow-md space-y-3"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-center gap-3">
                      <div
                        className="w-10 h-10 rounded-lg flex items-center justify-center text-white font-mono font-black text-xs shrink-0 shadow-sm border border-white/10"
                        style={{ backgroundColor: team.color || '#86152C' }}
                      >
                        {team.code}
                      </div>
                      <div>
                        <div className="flex items-center gap-1.5">
                          <span
                            className={`w-5 h-5 rounded flex items-center justify-center font-mono font-black text-[10px] ${
                              idx === 0
                                ? 'bg-[#FDBF0F] text-[#1B090B]'
                                : idx === 1
                                ? 'bg-[#D8C8B7] text-[#1B090B]'
                                : idx === 2
                                ? 'bg-[#86152C] text-[#FFF8EE]'
                                : 'bg-[#230D0F] text-[#F2F3E6]/70'
                            }`}
                          >
                            {idx + 1}
                          </span>
                          <h4 className="font-bold text-sm text-[#F2F3E6] uppercase">{team.name}</h4>
                        </div>
                        <p className="text-[10px] text-[#F2F3E6]/60 mt-0.5">{team.managerName || team.zone || 'Guild Contingent'}</p>
                      </div>
                    </div>

                    <div className="text-right shrink-0">
                      <span className="text-xl font-black text-[#FDBF0F] font-mono leading-none block">
                        {team.totalPoints || 0}
                      </span>
                      <span className="text-[9px] uppercase tracking-wider text-[#F2F3E6]/60 block font-mono">
                        TOTAL PTS
                      </span>
                    </div>
                  </div>

                  {/* Points breakdown strip */}
                  <div className="grid grid-cols-2 gap-2 text-xs font-mono bg-[#230D0F] p-2 rounded-lg border border-white/5">
                    <div>
                      <span className="text-[9px] text-[#F2F3E6]/60 uppercase block">Solo Events</span>
                      <span className="font-bold text-[#F2F3E6] text-xs">{team.soloPoints || 0} pts</span>
                    </div>
                    <div className="text-right">
                      <span className="text-[9px] text-[#F2F3E6]/60 uppercase block">Group Ensembles</span>
                      <span className="font-bold text-[#F2F3E6] text-xs">{team.groupPoints || 0} pts</span>
                    </div>
                  </div>

                  {/* Medals & Share row */}
                  <div className="flex items-center justify-between text-xs font-mono pt-1">
                    <div className="flex items-center gap-2">
                      <span className="text-[#FDBF0F] font-bold">🥇 {team.firstCount || 0}</span>
                      <span className="text-[#D8C8B7] font-bold">🥈 {team.secondCount || 0}</span>
                      <span className="text-[#BA1912] font-bold">🥉 {team.thirdCount || 0}</span>
                    </div>
                    <span className="text-[11px] text-[#FDBF0F] font-bold">{sharePercent}% Share</span>
                  </div>

                  {/* Share progress bar */}
                  <div className="w-full bg-[#230D0F] h-1.5 rounded-full overflow-hidden border border-white/5">
                    <div
                      className="h-full rounded-full transition-all duration-500"
                      style={{
                        width: `${Math.max(Number(sharePercent), 4)}%`,
                        backgroundColor: team.color || '#BA1912'
                      }}
                    />
                  </div>

                </div>
              );
            })}
          </div>
        </section>

      </div>
    </PublicLayout>
  );
}
