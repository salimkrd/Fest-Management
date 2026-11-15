'use client';

import React, { useState, useMemo } from 'react';
import { PublicLayout } from '@/components/layout/PublicLayout';
import { useFest } from '@/context/FestContext';
import { ChampionshipPodium } from '@/components/domain/ChampionshipPodium';
import {
  Trophy,
  ChevronDown,
  ChevronUp,
  Award,
  Medal,
  ShieldCheck,
  FileText,
  Users,
  CheckCircle2,
  Calendar,
  Layers,
  Loader2,
  AlertCircle
} from 'lucide-react';

export default function PublicChampionshipPage() {
  const { teams, theme, teamsSyncState } = useFest();

  const [expandedTeamId, setExpandedTeamId] = useState<string | null>(null);

  const sortedTeams = useMemo(() => {
    return [...teams].sort((a, b) => (b.totalPoints || 0) - (a.totalPoints || 0));
  }, [teams]);

  const totalFestPoints = useMemo(() => {
    return sortedTeams.reduce((acc, t) => acc + (t.totalPoints || 0), 0) || 1;
  }, [sortedTeams]);

  const toggleExpand = (id: string) => {
    setExpandedTeamId(prev => (prev === id ? null : id));
  };

  return (
    <PublicLayout>
      <div className="public-page-stack space-y-8 max-w-7xl mx-auto">
        {/* EDITORIAL HERO BANNER */}
        <section className="relative w-full rounded-2xl bg-gradient-to-b from-[#230D0F] via-[#1B090B] to-[#120507] p-6 sm:p-10 border border-[#BA1912]/30 shadow-2xl overflow-hidden text-center">
          <div className="pointer-events-none absolute -top-24 left-1/2 -translate-x-1/2 w-[600px] h-[280px] bg-[#BA1912]/20 blur-[100px] rounded-full" />
          <div className="pointer-events-none absolute top-10 right-10 w-64 h-64 bg-[#FDBF0F]/10 blur-[80px] rounded-full" />

          <div className="relative z-10 max-w-4xl mx-auto flex flex-col items-center">
            {/* Eyebrow Badge */}
            <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-[#1B090B] border border-[#FDBF0F]/30 text-[#FDBF0F] text-[10px] sm:text-xs font-bold uppercase tracking-[0.18em] shadow-sm mb-4">
              <Trophy className="w-3.5 h-3.5 text-[#FDBF0F]" />
              <span>Official Conclave Championship • Cycle 2026</span>
            </div>

            {/* Title */}
            <h1
              className="text-2xl sm:text-4xl lg:text-5xl font-extrabold uppercase tracking-wide text-[#F2F3E6] mb-3"
              style={{ fontFamily: "'Cinzel', serif" }}
            >
              TEAM CHAMPIONSHIP
            </h1>

            {/* Divider */}
            <div className="flex items-center justify-center gap-3 w-48 mx-auto my-3 opacity-80">
              <div className="h-[1px] flex-1 bg-gradient-to-r from-transparent to-[#FDBF0F]" />
              <span className="text-[#FDBF0F] text-xs">❖</span>
              <div className="h-[1px] flex-1 bg-gradient-to-l from-transparent to-[#FDBF0F]" />
            </div>

            <p className="text-xs sm:text-sm text-[#F2F3E6]/75 max-w-2xl leading-relaxed mb-6">
              Grand guild registry, continuous point accumulation, and official house standings across all solo competitions, group ensembles, and scholastic exhibitions.
            </p>

            <div className="flex flex-wrap items-center justify-center gap-2.5 sm:gap-3">
              <div className="flex items-center gap-2 px-3.5 py-1.5 rounded-lg bg-[#230D0F] border border-[#FDBF0F]/40 shadow-xs">
                <span className="w-2 h-2 rounded-full bg-[#FDBF0F] animate-pulse" />
                <span className="text-xs font-bold uppercase tracking-wider text-[#FDBF0F] font-mono">
                  {teams.length} Guild Delegations Competing
                </span>
              </div>

              <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[#1B090B] border border-[#BA1912]/40 text-[#F2F3E6]/80 text-xs">
                <ShieldCheck className="w-3.5 h-3.5 text-[#FDBF0F]" />
                <span className="uppercase tracking-wider text-[11px] font-medium font-mono">
                  {teamsSyncState === 'ready' ? 'Live Firestore Synced' : teamsSyncState === 'loading' ? 'Syncing...' : 'Ratified Ledger'}
                </span>
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

        {/* TOP PODIUM COMPONENT */}
        {sortedTeams.length > 0 && <ChampionshipPodium teams={teams} />}

        {/* MASTER GUILD RATIFICATION TABLE MATCHING STITCH */}
        <section className="w-full rounded-2xl bg-[#230D0F] border border-[#BA1912]/30 shadow-xl overflow-hidden">
          <div className="p-5 sm:p-6 border-b border-[#BA1912]/30 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <div className="flex items-center gap-2">
                <span className="text-[10px] font-bold uppercase tracking-widest text-[#FDBF0F]">
                  Official Tabulation
                </span>
              </div>
              <h3
                className="text-lg sm:text-xl font-bold uppercase text-[#F2F3E6] mt-0.5"
                style={{ fontFamily: "'Cinzel', serif" }}
              >
                Official Guild Ratification Table
              </h3>
            </div>
            <span className="text-xs text-[#F2F3E6]/70 font-mono bg-[#1B090B] px-3 py-1.5 rounded-lg border border-white/5">
              Total Points Awarded: <strong className="text-[#FDBF0F]">{totalFestPoints} PTS</strong>
            </span>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full min-w-[850px] text-left text-xs">
              <thead>
                <tr className="border-b border-[#BA1912]/20 bg-[#1B090B]/60 text-[10px] uppercase font-bold tracking-wider text-[#F2F3E6]/75">
                  <th className="py-3.5 px-4 text-center w-16">Rank</th>
                  <th className="py-3.5 px-4">Contingent House &amp; Insignia</th>
                  <th className="py-3.5 px-4 text-center">Solo Events</th>
                  <th className="py-3.5 px-4 text-center">Group Ensembles</th>
                  <th className="py-3.5 px-4 text-center">Medals (🥇/🥈/🥉)</th>
                  <th className="py-3.5 px-4 text-center font-mono">Cumulative</th>
                  <th className="py-3.5 px-4 w-40">Tally Share %</th>
                  <th className="py-3.5 px-4 text-right">Dossier</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#BA1912]/15">
                {sortedTeams.map((team, idx) => {
                  const sharePercent = totalFestPoints > 0 ? Math.round(((team.totalPoints || 0) / totalFestPoints) * 100) : 0;
                  const isExpanded = expandedTeamId === team.id;

                  return (
                    <React.Fragment key={team.id}>
                      <tr className="hover:bg-[#281014]/60 transition-colors">
                        {/* Rank */}
                        <td className="py-4 px-4 text-center">
                          <span
                            className={`w-7 h-7 mx-auto rounded-lg flex items-center justify-center font-mono font-black text-xs shadow-xs ${
                              idx === 0
                                ? 'bg-[#FDBF0F] text-[#1B090B]'
                                : idx === 1
                                ? 'bg-[#D8C8B7] text-[#1B090B]'
                                : idx === 2
                                ? 'bg-[#86152C] text-[#FFF8EE]'
                                : 'bg-[#1B090B] text-[#F2F3E6]/70 border border-white/5'
                            }`}
                          >
                            {idx + 1}
                          </span>
                        </td>

                        {/* House */}
                        <td className="py-4 px-4">
                          <div className="flex items-center gap-3">
                            <div
                              className="w-9 h-9 rounded-xl flex items-center justify-center text-white font-extrabold text-xs shrink-0 shadow-sm border border-white/10"
                              style={{ backgroundColor: team.color || '#86152C' }}
                            >
                              {team.code}
                            </div>
                            <div>
                              <span className="font-bold text-sm text-[#F2F3E6] block">{team.name}</span>
                              <span className="text-[10px] text-[#F2F3E6]/60">
                                {team.managerName || team.zone || 'Academic Delegation'}
                              </span>
                            </div>
                          </div>
                        </td>

                        {/* Solo */}
                        <td className="py-4 px-4 text-center font-mono text-sm font-semibold text-[#F2F3E6]">
                          {team.soloPoints || 0}
                        </td>

                        {/* Group */}
                        <td className="py-4 px-4 text-center font-mono text-sm font-semibold text-[#F2F3E6]">
                          {team.groupPoints || 0}
                        </td>

                        {/* Medals */}
                        <td className="py-4 px-4 text-center">
                          <div className="flex items-center justify-center gap-2.5 font-mono text-xs">
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

                        {/* Cumulative */}
                        <td className="py-4 px-4 text-center">
                          <span className="text-base font-black text-[#FDBF0F] font-mono block leading-none">
                            {team.totalPoints || 0}
                          </span>
                          <span className="text-[9px] uppercase tracking-wider text-[#F2F3E6]/60 font-mono">
                            PTS
                          </span>
                        </td>

                        {/* Share % */}
                        <td className="py-4 px-4">
                          <div className="space-y-1">
                            <div className="flex justify-between text-[10px] font-mono font-bold text-[#F2F3E6]/75">
                              <span>{sharePercent}%</span>
                            </div>
                            <div className="w-full bg-[#1B090B] h-2 rounded-full overflow-hidden border border-white/5">
                              <div
                                className="h-full rounded-full transition-all duration-500 shadow-xs"
                                style={{
                                  width: `${Math.max(sharePercent, 3)}%`,
                                  backgroundColor: team.color || '#BA1912'
                                }}
                              />
                            </div>
                          </div>
                        </td>

                        {/* Expand toggle */}
                        <td className="py-4 px-4 text-right">
                          <button
                            type="button"
                            onClick={() => toggleExpand(team.id)}
                            className="p-2 rounded-lg bg-[#1B090B] hover:bg-[#281014] text-[#FDBF0F] border border-[#BA1912]/30 transition-colors"
                            aria-label={`Toggle dossier for ${team.name}`}
                          >
                            {isExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                          </button>
                        </td>
                      </tr>

                      {/* Expanded Team Audit Dossier */}
                      {isExpanded && (
                        <tr className="bg-[#1B090B]/80">
                          <td colSpan={8} className="p-4 sm:p-6 border-b border-[#BA1912]/30">
                            <div className="rounded-xl p-4 sm:p-5 bg-[#230D0F] border border-[#BA1912]/40 space-y-4">
                              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-[#BA1912]/20 pb-3">
                                <div>
                                  <span className="text-[10px] uppercase tracking-widest text-[#FDBF0F] font-bold">
                                    Audit Dossier
                                  </span>
                                  <h4 className="text-sm sm:text-base font-bold text-[#F2F3E6]">
                                    {team.name} Contingent Performance Summary
                                  </h4>
                                </div>
                                <span className="text-xs font-mono text-[#FDBF0F] bg-[#1B090B] px-3 py-1 rounded-lg border border-[#FDBF0F]/30 self-start sm:self-auto">
                                  Guild Code: {team.code}
                                </span>
                              </div>

                              <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 text-xs">
                                <div className="p-3 rounded-lg bg-[#1B090B] border border-white/5">
                                  <span className="text-[10px] text-[#F2F3E6]/60 uppercase block">Enrolled Contestants</span>
                                  <span className="text-base font-bold text-[#F2F3E6] font-mono mt-0.5 block">
                                    {team.contestantsCount || 0} Students
                                  </span>
                                </div>

                                <div className="p-3 rounded-lg bg-[#1B090B] border border-white/5">
                                  <span className="text-[10px] text-[#F2F3E6]/60 uppercase block">Events Competed</span>
                                  <span className="text-base font-bold text-[#F2F3E6] font-mono mt-0.5 block">
                                    {team.eventsCount || 0} Events
                                  </span>
                                </div>

                                <div className="p-3 rounded-lg bg-[#1B090B] border border-white/5">
                                  <span className="text-[10px] text-[#FDBF0F] uppercase block">Gold Laureates (1st)</span>
                                  <span className="text-base font-bold text-[#FDBF0F] font-mono mt-0.5 block">
                                    {team.firstCount || 0} Medals
                                  </span>
                                </div>

                                <div className="p-3 rounded-lg bg-[#1B090B] border border-white/5">
                                  <span className="text-[10px] text-[#D8C8B7] uppercase block">Silver Laureates (2nd)</span>
                                  <span className="text-base font-bold text-[#D8C8B7] font-mono mt-0.5 block">
                                    {team.secondCount || 0} Medals
                                  </span>
                                </div>
                              </div>
                            </div>
                          </td>
                        </tr>
                      )}
                    </React.Fragment>
                  );
                })}
              </tbody>
            </table>
          </div>
        </section>

        {/* POINT ALLOCATION FRAMEWORK & CENTRAL TABULATION SEAL MATCHING STITCH */}
        <div className="grid grid-cols-1 md:grid-cols-12 gap-6">
          {/* Framework Rubric Card */}
          <section className="md:col-span-7 rounded-2xl bg-[#230D0F] border border-[#BA1912]/30 p-5 sm:p-6 shadow-xl">
            <div className="flex items-center gap-2 mb-2">
              <span className="text-[10px] uppercase tracking-widest text-[#FDBF0F] font-bold">
                Ratification Rubric
              </span>
            </div>
            <h3
              className="text-base sm:text-lg font-bold uppercase text-[#F2F3E6] mb-4"
              style={{ fontFamily: "'Cinzel', serif" }}
            >
              Championship Point Allocation Framework
            </h3>

            <div className="grid grid-cols-2 gap-3 text-xs">
              <div className="p-3 rounded-xl bg-[#1B090B] border border-white/5">
                <span className="text-[10px] uppercase tracking-wider text-[#FDBF0F] font-bold block mb-1">
                  Individual (Solo) Items
                </span>
                <ul className="space-y-1 text-[#F2F3E6]/80 text-[11px] font-mono">
                  <li>🥇 1st Place: +10 pts</li>
                  <li>🥈 2nd Place: +5 pts</li>
                  <li>🥉 3rd Place: +3 pts</li>
                </ul>
              </div>

              <div className="p-3 rounded-xl bg-[#1B090B] border border-white/5">
                <span className="text-[10px] uppercase tracking-wider text-[#FDBF0F] font-bold block mb-1">
                  Group Ensembles
                </span>
                <ul className="space-y-1 text-[#F2F3E6]/80 text-[11px] font-mono">
                  <li>🥇 1st Place: +20 pts</li>
                  <li>🥈 2nd Place: +10 pts</li>
                  <li>🥉 3rd Place: +5 pts</li>
                </ul>
              </div>
            </div>

            <div className="mt-3 p-3 rounded-xl bg-[#1B090B] border border-white/5 text-[11px] text-[#F2F3E6]/75">
              <span className="text-[#FDBF0F] font-bold">Grade Accreditations:</span> Grade A+ (+5 pts) · Grade A (+3 pts) · Grade B (+1 pt). Grade points are ratified automatically into the team aggregate.
            </div>
          </section>

          {/* Central Directorate Seal Card */}
          <section className="md:col-span-5 rounded-2xl bg-[#230D0F] border border-[#BA1912]/30 p-5 sm:p-6 shadow-xl flex flex-col justify-between">
            <div>
              <div className="flex items-center gap-2 mb-2">
                <ShieldCheck className="w-4 h-4 text-[#FDBF0F]" />
                <span className="text-[10px] uppercase tracking-widest text-[#FDBF0F] font-bold">
                  Authentication Seal
                </span>
              </div>
              <h3
                className="text-base sm:text-lg font-bold uppercase text-[#F2F3E6] mb-2"
                style={{ fontFamily: "'Cinzel', serif" }}
              >
                Central Tabulation Directorate
              </h3>
              <p className="text-xs text-[#F2F3E6]/75 leading-relaxed">
                All house championship points and laureate placings are ratified live by the Central Board of Examination. Tabulation records are synchronized in real-time from the official festival core.
              </p>
            </div>

            <div className="mt-4 pt-3 border-t border-[#BA1912]/20 flex items-center justify-between text-[11px] text-[#FDBF0F] font-mono">
              <span className="flex items-center gap-1.5">
                <CheckCircle2 className="w-3.5 h-3.5" /> Certified Ratified
              </span>
              <span className="text-[#F2F3E6]/50">Cycle 2026</span>
            </div>
          </section>
        </div>
      </div>
    </PublicLayout>
  );
}
