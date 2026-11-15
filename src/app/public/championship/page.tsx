'use client';

import React, { useState } from 'react';
import { PublicLayout } from '@/components/layout/PublicLayout';
import { useFest } from '@/context/FestContext';
import { ChampionshipPodium } from '@/components/domain/ChampionshipPodium';
import { Trophy, ChevronDown, ChevronUp } from 'lucide-react';

export default function PublicChampionshipPage() {
  const { teams, theme } = useFest();

  const [expandedTeamId, setExpandedTeamId] = useState<string | null>(null);

  const sortedTeams = [...teams].sort((a, b) => b.totalPoints - a.totalPoints);
  const totalFestPoints = sortedTeams.reduce((acc, t) => acc + t.totalPoints, 0) || 1;

  const toggleExpand = (id: string) => {
    setExpandedTeamId(prev => prev === id ? null : id);
  };

  return (
    <PublicLayout>
      <div className="public-page-stack space-y-7 sm:space-y-8 max-w-5xl mx-auto">
        {/* Header */}
        <div className="text-center max-w-2xl mx-auto">
          <span className="public-page-eyebrow inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[10px] sm:text-xs font-bold uppercase tracking-wider">
            <Trophy className="w-3.5 h-3.5 text-[#FDBF0F]" />
            Official <span className="festival-name">{theme.festivalName}</span> Trophy Race
          </span>
          <h1 className="public-page-title font-cinematic-editorial text-xl sm:text-2xl font-bold tracking-[0.1em] mt-3">
            Team Championship Standings
          </h1>
          <p className="public-page-description mt-2 text-xs sm:text-sm">
            Live accumulated points table across all solo, group, stage, and literary competitions
          </p>
        </div>

        {/* Top 3 Podium Component */}
        <ChampionshipPodium teams={teams} />

        {/* Master Standings Table */}
        <div className="public-table-card rounded-2xl border shadow-xs overflow-hidden">
          <div className="public-card-header px-4 sm:px-5 py-4 border-b flex items-center justify-between gap-3">
            <div>
              <h3 className="public-card-title text-sm sm:text-base font-bold">Overall House Leaderboard</h3>
              <p className="public-muted text-[11px]">Official points recorded in the festival tabulation</p>
            </div>
            <span className="public-muted text-[10px] sm:text-xs font-semibold text-right">{teams.length} Competing Delegations</span>
          </div>

          <div className="overflow-x-auto">
            <table className="public-table w-full min-w-[900px] text-left text-xs">
              <thead>
                <tr className="public-table-head border-b font-bold uppercase text-[10px]">
                  <th className="py-3.5 px-6">Rank</th>
                  <th className="py-3.5 px-6">Contingent House &amp; Insignia</th>
                  <th className="py-3.5 px-6 text-center">Solo Pts</th>
                  <th className="py-3.5 px-6 text-center">Group Pts</th>
                  <th className="py-3.5 px-6 text-center">Laureate Medals (1 / 2 / 3)</th>
                  <th className="py-3.5 px-6 text-center">Total Points</th>
                  <th className="py-3.5 px-6 w-36">Point Share %</th>
                  <th className="py-3.5 px-6 text-right">Detail</th>
                </tr>
              </thead>
              <tbody className="public-table-body divide-y">
                {sortedTeams.map((team, idx) => {
                  const sharePercent = Math.round((team.totalPoints / totalFestPoints) * 100);
                  const isExpanded = expandedTeamId === team.id;

                  return (
                    <React.Fragment key={team.id}>
                      <tr className="public-table-row transition-colors">
                        <td className="py-3 px-4 font-black text-xs">
                          <span className={`w-7 h-7 rounded-full flex items-center justify-center ${
                            idx === 0 ? 'bg-amber-400 text-neutral-900 font-black' :
                            idx === 1 ? 'bg-slate-300 text-neutral-900 font-bold' :
                            idx === 2 ? 'bg-amber-700 text-white font-bold' :
                            'bg-neutral-100 text-neutral-700'
                          }`}>
                            {idx + 1}
                          </span>
                        </td>
                        <td className="py-3 px-4">
                          <div className="flex items-center gap-3">
                            <div
                              className="w-8 h-8 rounded-lg flex items-center justify-center text-white font-black text-xs shrink-0 shadow-xs"
                              style={{ backgroundColor: team.color }}
                            >
                              {team.code}
                            </div>
                            <div>
                              <span className="public-winner-name font-bold text-[13px] block">{team.name}</span>
                              <span className="public-muted text-[10px]">{team.managerName} · {team.zone}</span>
                            </div>
                          </div>
                        </td>
                        <td className="py-3 px-4 text-center font-bold">
                          {team.soloPoints}
                        </td>
                        <td className="py-4 px-6 text-center font-bold text-[#111111]">
                          {team.groupPoints}
                        </td>
                        <td className="py-3 px-4 text-center">
                          <div className="flex items-center justify-center gap-2 font-bold text-xs">
                            <span className="text-[#C58B00]">🥇 {team.firstCount}</span>
                            <span className="text-slate-500">🥈 {team.secondCount}</span>
                            <span className="text-[#86152C]">🥉 {team.thirdCount}</span>
                          </div>
                        </td>
                        <td className="py-4 px-6 text-center">
                          <span className="public-points-total text-lg font-black">{team.totalPoints}</span>
                          <span className="text-[10px] text-[#526070] block">pts</span>
                        </td>
                        <td className="py-4 px-6">
                          <div className="space-y-1">
                            <div className="flex justify-between text-[10px] font-bold text-[#526070]">
                              <span>{sharePercent}%</span>
                            </div>
                            <div className="w-full bg-[#F8FAFC] h-2 rounded-full overflow-hidden border border-[#E1E7EF]">
                              <div
                                className="h-full rounded-full transition-all duration-500"
                                style={{
                                  width: `${sharePercent}%`,
                                  backgroundColor: team.color || '#2563EB'
                                }}
                              />
                            </div>
                          </div>
                        </td>
                        <td className="py-3 px-4 text-right">
                          <button
                            type="button"
                            onClick={() => toggleExpand(team.id)}
                            className="public-expand-button p-1.5 rounded-lg transition-colors"
                            aria-label="Expand team details"
                          >
                            {isExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                          </button>
                        </td>
                      </tr>

                      {/* Expanded Details Drawer inside table */}
                      {isExpanded && (
                        <tr className="public-expanded-row">
                          <td colSpan={8} className="p-4 sm:p-5">
                            <div className="public-expanded-panel p-4 rounded-xl border space-y-3">
                              <h4 className="public-card-title text-xs font-bold uppercase tracking-wider">
                                {team.name} Contingent Performance Summary
                              </h4>
                              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 sm:gap-4 text-xs">
                                <div>
                                  <span className="public-muted block text-[10px]">Total Enrolled Contestants:</span>
                                  <span className="public-expanded-value font-bold text-[13px]">{team.contestantsCount} Students</span>
                                </div>
                                <div>
                                  <span className="text-[#526070] block">Events Competed:</span>
                                  <span className="font-bold text-[#111111] text-sm">{team.eventsCount} Events</span>
                                </div>
                                <div>
                                  <span className="text-[#526070] block">Gold Laureates (1st Place):</span>
                                  <span className="font-bold text-[#C58B00] text-[13px]">{team.firstCount} Medals</span>
                                </div>
                                <div>
                                  <span className="text-[#526070] block">Silver Laureates (2nd Place):</span>
                                  <span className="font-bold text-[#86152C] text-[13px]">{team.secondCount} Medals</span>
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
        </div>
      </div>
    </PublicLayout>
  );
}
