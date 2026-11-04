'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { TeamLayout } from '@/components/layout/TeamLayout';
import { TeamSyncStatus } from '@/components/domain/TeamSyncStatus';
import { useFest } from '@/context/FestContext';
import { Button } from '@/components/ui/Button';
import { Trophy, Award, Medal, Search, ExternalLink } from 'lucide-react';

export default function TeamResultsPage() {
  const { currentTeamUser, teams, results } = useFest();
  const team = currentTeamUser
    ? teams.find(candidate => candidate.id === currentTeamUser.id) || currentTeamUser
    : null;

  const [search, setSearch] = useState('');
  const teamRankings = results
    .filter(result => result.resultStatus === 'PUBLISHED')
    .flatMap(result =>
      result.ranks
        .filter(rank => rank.teamId === team?.id)
        .map(rank => ({
          ...rank,
          competitionName: result.competitionName,
          competitionCode: result.competitionCode,
          categoryName: result.categoryName,
          type: result.type,
          competitionId: result.competitionId,
          publishedDate: result.publishedDate
        }))
    );

  const normalizedSearch = search.trim().toLowerCase();
  const filtered = teamRankings.filter(rank =>
    rank.candidateName.toLowerCase().includes(normalizedSearch) ||
    rank.competitionName.toLowerCase().includes(normalizedSearch) ||
    rank.competitionCode.toLowerCase().includes(normalizedSearch) ||
    (rank.bib || '').toLowerCase().includes(normalizedSearch)
  );

  const firstPlaces = teamRankings.filter(rank => rank.rank === 1).length;
  const secondPlaces = teamRankings.filter(rank => rank.rank === 2).length;
  const thirdPlaces = teamRankings.filter(rank => rank.rank === 3).length;

  const placeLabel = (rank: number | null | undefined) => {
    if (rank === 1) return '1st Place';
    if (rank === 2) return '2nd Place';
    if (rank === 3) return '3rd Place';
    return 'Grade only';
  };

  const placeTone = (rank: number | null | undefined) => {
    if (rank === 1) return 'border-amber-200 bg-amber-50 text-amber-800';
    if (rank === 2) return 'border-slate-200 bg-slate-100 text-slate-700';
    if (rank === 3) return 'border-orange-200 bg-orange-50 text-orange-800';
    return 'border-blue-100 bg-blue-50 text-blue-700';
  };

  return (
    <TeamLayout>
      <div className="space-y-5 sm:space-y-6">
        <header className="flex flex-col gap-4 border-b border-slate-200 pb-5 lg:flex-row lg:items-end lg:justify-between">
          <div className="min-w-0">
            <div className="mb-1 flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.12em] text-blue-700">
              <Trophy className="h-4 w-4" />
              Official results
            </div>
            <h1 className="text-2xl font-bold tracking-tight text-slate-950 sm:text-[28px]">Team Results &amp; Standings</h1>
            <p className="mt-1.5 text-sm leading-5 text-slate-600">
              Published grades, prize positions and championship standings for {team?.name || 'your team'}.
            </p>
          </div>
          <Link href="/public/championship" target="_blank" rel="noreferrer" className="w-full sm:w-auto">
            <Button variant="outline" size="md" className="w-full !rounded-xl sm:w-auto" leftIcon={<ExternalLink className="h-4 w-4" />}>
              Public championship standings
            </Button>
          </Link>
        </header>

        <TeamSyncStatus sources={['teams', 'results']} />

        <section className="grid grid-cols-2 gap-3 sm:gap-4 xl:grid-cols-5">
          <article className="col-span-2 rounded-2xl border border-blue-200 bg-gradient-to-br from-blue-50 to-white p-4 shadow-sm sm:p-5 xl:col-span-2">
            <p className="text-xs font-semibold uppercase tracking-wide text-blue-800">Total championship points</p>
            <div className="mt-2 flex items-baseline gap-2">
              <span className="text-4xl font-bold tabular-nums tracking-tight text-slate-950">{team?.totalPoints ?? 0}</span>
              <span className="text-xs font-semibold text-slate-500">official points</span>
            </div>
            <p className="mt-1.5 text-xs text-slate-600">
              Current overall position: <strong className="text-slate-900">#{team?.rank || 1}</strong>
            </p>
          </article>

          <MetricTile label="Individual points" value={team?.soloPoints ?? 0} detail="Individual events" />
          <MetricTile label="Group points" value={team?.groupPoints ?? 0} detail="Credited to the team" />
          <article className="col-span-2 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:p-5 xl:col-span-1">
            <div className="flex items-center gap-2 text-xs font-semibold text-slate-500">
              <Medal className="h-4 w-4 text-amber-600" />
              Prize positions
            </div>
            <div className="mt-3 flex items-center gap-2 text-sm font-bold">
              <span className="text-amber-600">🥇 {team?.firstCount ?? firstPlaces}</span>
              <span className="text-slate-300">/</span>
              <span className="text-slate-600">🥈 {team?.secondCount ?? secondPlaces}</span>
              <span className="text-slate-300">/</span>
              <span className="text-orange-700">🥉 {team?.thirdCount ?? thirdPlaces}</span>
            </div>
            <p className="mt-1.5 text-[11px] text-slate-500">1st / 2nd / 3rd</p>
          </article>
        </section>

        <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
          <div className="flex flex-col gap-3 border-b border-slate-200 p-4 sm:flex-row sm:items-center sm:justify-between sm:p-5">
            <div>
              <h2 className="text-sm font-bold text-slate-950">Published team results</h2>
              <p className="mt-1 text-xs text-slate-500">Only officially released grades and prize positions are listed.</p>
            </div>
            <div className="flex w-full items-center gap-3 sm:w-auto">
              <div className="relative min-w-0 flex-1 sm:w-72">
                <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                <input
                  type="search"
                  aria-label="Search published results"
                  placeholder="Search event, contestant or Bib…"
                  value={search}
                  onChange={event => setSearch(event.target.value)}
                  className="min-h-11 w-full rounded-xl border border-slate-300 bg-white py-2.5 pl-9 pr-3 text-sm text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-blue-600 focus:ring-2 focus:ring-blue-100"
                />
              </div>
              <span className="shrink-0 text-xs font-semibold tabular-nums text-slate-500">{filtered.length} entries</span>
            </div>
          </div>

          {filtered.length === 0 ? (
            <div className="px-5 py-12 text-center">
              <Award className="mx-auto h-9 w-9 text-slate-300" />
              <h3 className="mt-3 text-sm font-semibold text-slate-900">
                {teamRankings.length === 0 ? 'No published results yet' : 'No results match this search'}
              </h3>
              <p className="mx-auto mt-1 max-w-md text-xs leading-5 text-slate-500">
                {teamRankings.length === 0
                  ? 'Your team’s grades and prize positions will appear here after results are officially published.'
                  : 'Try another event name, contestant name or Bib number.'}
              </p>
            </div>
          ) : (
            <>
              <div className="space-y-3 p-3 md:hidden">
                {filtered.map(rank => (
                  <article key={rank.registrationId} className="rounded-xl border border-slate-200 p-3.5">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <p className="break-words text-sm font-semibold text-slate-950">{rank.competitionName}</p>
                        <p className="mt-1 text-xs text-slate-500">{rank.competitionCode} · {rank.categoryName}</p>
                      </div>
                      <span className={`shrink-0 rounded-full border px-2.5 py-1 text-[10px] font-bold ${placeTone(rank.rank)}`}>
                        {placeLabel(rank.rank)}
                      </span>
                    </div>
                    <div className="mt-3 flex items-center justify-between gap-3 border-t border-slate-100 pt-3">
                      <div className="min-w-0">
                        <p className="break-words text-sm font-semibold text-slate-800">{rank.candidateName}</p>
                        <p className="mt-0.5 text-xs text-slate-500">{rank.bib || '—'} · {rank.type === 'SOLO' ? 'Individual' : 'Group'}</p>
                      </div>
                      <span className="shrink-0 rounded-lg border border-blue-100 bg-blue-50 px-3 py-2 text-sm font-bold text-blue-800">
                        Grade {rank.grade || '—'}
                      </span>
                    </div>
                  </article>
                ))}
              </div>

              <div className="hidden overflow-x-auto md:block">
                <table className="min-w-[760px] w-full text-left text-sm">
                  <thead className="bg-slate-50 text-[11px] font-semibold uppercase tracking-wide text-slate-500">
                    <tr>
                      <th className="px-5 py-3.5">Competition</th>
                      <th className="px-5 py-3.5">Participant / group</th>
                      <th className="px-5 py-3.5">Category</th>
                      <th className="px-5 py-3.5">Type</th>
                      <th className="px-5 py-3.5 text-center">Grade</th>
                      <th className="px-5 py-3.5 text-center">Prize position</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {filtered.map(rank => (
                      <tr key={rank.registrationId} className="transition hover:bg-slate-50/80">
                        <td className="px-5 py-4">
                          <p className="text-sm font-semibold text-slate-900">{rank.competitionName}</p>
                          <p className="mt-0.5 font-mono text-xs text-blue-700">{rank.competitionCode}</p>
                        </td>
                        <td className="px-5 py-4">
                          <p className="text-sm font-semibold text-slate-900">{rank.candidateName}</p>
                          <p className="mt-0.5 text-xs text-slate-500">{rank.bib || '—'}</p>
                        </td>
                        <td className="px-5 py-4 text-sm text-slate-600">{rank.categoryName || '—'}</td>
                        <td className="px-5 py-4 text-sm text-slate-600">{rank.type === 'SOLO' ? 'Individual' : 'Group'}</td>
                        <td className="px-5 py-4 text-center">
                          <span className="inline-flex rounded-lg border border-blue-100 bg-blue-50 px-3 py-1.5 text-sm font-bold text-blue-800">Grade {rank.grade || '—'}</span>
                        </td>
                        <td className="px-5 py-4 text-center">
                          <span className={`inline-flex rounded-full border px-2.5 py-1 text-xs font-bold ${placeTone(rank.rank)}`}>{placeLabel(rank.rank)}</span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </>
          )}
        </section>
      </div>
    </TeamLayout>
  );
}

function MetricTile({ label, value, detail }: { label: string; value: number; detail: string }) {
  return (
    <article className="min-w-0 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:p-5">
      <p className="text-xs font-semibold text-slate-500">{label}</p>
      <p className="mt-2 text-2xl font-bold tabular-nums text-slate-950">{value}</p>
      <p className="mt-1 truncate text-[11px] text-slate-500">{detail}</p>
    </article>
  );
}
