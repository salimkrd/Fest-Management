'use client';

import React from 'react';
import Link from 'next/link';
import { AdminLayout } from '@/components/layout/AdminLayout';
import { useFest } from '@/context/FestContext';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import {
  Users2,
  Trophy,
  CheckCircle2,
  Clock3,
  ExternalLink,
  PlusCircle,
  ClipboardList,
  FileSpreadsheet,
  PencilLine,
  CalendarDays,
  MapPin,
  ChevronRight,
  Settings,
  ArrowUpRight,
  Activity
} from 'lucide-react';
import { FestivalSettingsModal } from '@/components/domain/FestivalSettingsModal';

export default function AdminDashboardPage() {
  const { theme, participants, competitions, results, teams, schedules } = useFest();
  const [themeModalOpen, setThemeModalOpen] = React.useState(false);

  const publishedResults = results.filter(result => result.resultStatus === 'PUBLISHED');
  const publishedCompetitionIds = new Set(publishedResults.map(result => result.competitionId));
  const pendingResultsCount = competitions.filter(competition => !publishedCompetitionIds.has(competition.id)).length;

  const upcomingSchedules = schedules
    .filter(slot => slot.status === 'LIVE' || slot.status === 'SCHEDULED')
    .slice(0, 3);

  const recentPublished = [...publishedResults]
    .sort((a, b) => (b.publishedDate || '').localeCompare(a.publishedDate || ''))
    .slice(0, 3);

  const topTeams = [...teams]
    .sort((a, b) => b.totalPoints - a.totalPoints)
    .slice(0, 3);

  const stats = [
    {
      label: 'Total participants',
      value: participants.length,
      helper: 'Across all participating teams',
      icon: <Users2 className="h-5 w-5" />,
      iconSurface: 'bg-blue-50 text-blue-700'
    },
    {
      label: 'Competitions',
      value: competitions.length,
      helper: 'Individual and group events',
      icon: <Trophy className="h-5 w-5" />,
      iconSurface: 'bg-violet-50 text-violet-700'
    },
    {
      label: 'Published results',
      value: publishedResults.length,
      helper: 'Available on the public site',
      icon: <CheckCircle2 className="h-5 w-5" />,
      iconSurface: 'bg-emerald-50 text-emerald-700'
    },
    {
      label: 'Awaiting results',
      value: pendingResultsCount,
      helper: 'Competitions not yet published',
      icon: <Clock3 className="h-5 w-5" />,
      iconSurface: 'bg-amber-50 text-amber-700'
    }
  ];

  return (
    <AdminLayout>
      <div className="mx-auto w-full max-w-[1440px] space-y-7 sm:space-y-8">
        <FestivalSettingsModal
          isOpen={themeModalOpen}
          onClose={() => setThemeModalOpen(false)}
        />

        {/* Page heading */}
        <section className="flex flex-col gap-5 border-b border-slate-200 pb-6 sm:flex-row sm:items-end sm:justify-between">
          <div className="min-w-0">
            <p className="mb-2 text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">
              Administration
            </p>
            <div className="flex flex-wrap items-center gap-3">
              <h1 className="text-2xl font-semibold leading-tight tracking-tight text-slate-950 sm:text-3xl">
                <span className="festival-name">{theme.festivalName}</span> Workspace
              </h1>
              <Badge variant="info" size="sm" className="normal-case tracking-normal">
                Dashboard
              </Badge>
            </div>
            <p className="mt-2 text-sm leading-6 text-slate-600">
              {theme.institutionName}
              <span className="mx-2 text-slate-300" aria-hidden="true">/</span>
              Overview of festival operations and results
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <Button
              variant="outline"
              size="md"
              leftIcon={<Settings className="h-4 w-4" />}
              onClick={() => setThemeModalOpen(true)}
            >
              Festival settings
            </Button>
            <Link
              href="/"
              target="_blank"
              rel="noreferrer"
              className="inline-flex min-h-10 items-center gap-2 rounded-lg bg-slate-900 px-4 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-slate-800 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-600 focus-visible:ring-offset-2"
            >
              <ExternalLink className="h-4 w-4" />
              Public website
            </Link>
          </div>
        </section>

        {/* Overview metrics */}
        <section aria-label="Festival overview" className="grid grid-cols-1 gap-4 sm:grid-cols-2 2xl:grid-cols-4">
          {stats.map(stat => (
            <article
              key={stat.label}
              className="group rounded-2xl border border-slate-200 bg-white p-5 shadow-sm transition-all duration-200 hover:-translate-y-0.5 hover:border-slate-300 hover:shadow-md sm:p-6"
            >
              <div className="flex items-start justify-between gap-4">
                <div className="min-w-0">
                  <p className="text-sm font-medium text-slate-600">{stat.label}</p>
                  <p className="mt-3 text-3xl font-semibold tracking-tight text-slate-950 sm:text-[2.125rem]">
                    {stat.value.toLocaleString()}
                  </p>
                </div>
                <div className={'flex h-11 w-11 shrink-0 items-center justify-center rounded-xl ' + stat.iconSurface}>
                  {stat.icon}
                </div>
              </div>
              <p className="mt-3 text-sm leading-5 text-slate-500">{stat.helper}</p>
            </article>
          ))}
        </section>

        {/* Schedule and published results */}
        <section className="grid grid-cols-1 gap-5 xl:grid-cols-2">
          <article className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
            <div className="flex flex-col gap-3 border-b border-slate-100 pb-4 sm:flex-row sm:items-start sm:justify-between">
              <div className="flex items-start gap-3">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-blue-50 text-blue-700">
                  <CalendarDays className="h-5 w-5" />
                </div>
                <div>
                  <h2 className="text-base font-semibold tracking-tight text-slate-900">Live &amp; upcoming schedule</h2>
                  <p className="mt-1 text-sm text-slate-500">The next activities on your timetable</p>
                </div>
              </div>
              <Link href="/admin/schedule" className="inline-flex items-center gap-1 self-start text-sm font-semibold text-blue-700 transition-colors hover:text-blue-800">
                Full schedule <ChevronRight className="h-4 w-4" />
              </Link>
            </div>

            <div className="mt-4 space-y-3">
              {upcomingSchedules.length === 0 ? (
                <div className="rounded-xl border border-dashed border-slate-200 bg-slate-50 px-4 py-8 text-center">
                  <CalendarDays className="mx-auto h-6 w-6 text-slate-400" />
                  <p className="mt-2 text-sm font-medium text-slate-700">No live or upcoming activities</p>
                  <p className="mt-1 text-sm text-slate-500">Scheduled activities will appear here.</p>
                </div>
              ) : (
                upcomingSchedules.map(slot => (
                  <div
                    key={slot.id}
                    className="flex flex-col gap-3 rounded-xl border border-slate-200 p-4 transition-colors hover:border-slate-300 hover:bg-slate-50/70 sm:flex-row sm:items-center sm:justify-between"
                  >
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <h3 className="text-sm font-semibold leading-5 text-slate-900">{slot.competitionName}</h3>
                        <Badge variant={slot.status === 'LIVE' ? 'error' : 'info'} size="sm">
                          {slot.status === 'LIVE' ? 'Live now' : 'Scheduled'}
                        </Badge>
                      </div>
                      <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-slate-500">
                        <span className="inline-flex items-center gap-1.5">
                          <MapPin className="h-3.5 w-3.5 text-slate-400" />
                          {slot.stageName}
                        </span>
                        <span className="hidden text-slate-300 sm:inline" aria-hidden="true">•</span>
                        <span>{slot.categoryName} · {slot.type === 'GROUP' ? 'Group' : 'Individual'}</span>
                      </div>
                    </div>
                    <div className="flex shrink-0 items-baseline gap-2 sm:block sm:text-right">
                      <p className="text-sm font-semibold tabular-nums text-slate-900">{slot.startTime}</p>
                      <p className="text-xs tabular-nums text-slate-500">Until {slot.endTime}</p>
                    </div>
                  </div>
                ))
              )}
            </div>

            <div className="mt-4 border-t border-slate-100 pt-4">
              <Link href="/admin/stages" className="inline-flex items-center gap-1.5 text-sm font-medium text-slate-600 transition-colors hover:text-blue-700">
                Manage stages &amp; venues <ArrowUpRight className="h-4 w-4" />
              </Link>
            </div>
          </article>

          <article className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
            <div className="flex flex-col gap-3 border-b border-slate-100 pb-4 sm:flex-row sm:items-start sm:justify-between">
              <div className="flex items-start gap-3">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-emerald-50 text-emerald-700">
                  <CheckCircle2 className="h-5 w-5" />
                </div>
                <div>
                  <h2 className="text-base font-semibold tracking-tight text-slate-900">Recently published results</h2>
                  <p className="mt-1 text-sm text-slate-500">Latest official results released to the public</p>
                </div>
              </div>
              <Link href="/admin/results" className="inline-flex items-center gap-1 self-start text-sm font-semibold text-blue-700 transition-colors hover:text-blue-800">
                Results manager <ChevronRight className="h-4 w-4" />
              </Link>
            </div>

            <div className="mt-4 space-y-3">
              {recentPublished.length === 0 ? (
                <div className="rounded-xl border border-dashed border-slate-200 bg-slate-50 px-4 py-8 text-center">
                  <CheckCircle2 className="mx-auto h-6 w-6 text-slate-400" />
                  <p className="mt-2 text-sm font-medium text-slate-700">No results published yet</p>
                  <p className="mt-1 text-sm text-slate-500">Reviewed results will appear here once published.</p>
                </div>
              ) : (
                recentPublished.map(result => {
                  const winner = result.ranks.find(rank => rank.rank === 1);
                  return (
                    <div
                      key={result.id}
                      className="flex flex-col gap-3 rounded-xl border border-slate-200 p-4 transition-colors hover:border-slate-300 hover:bg-slate-50/70 sm:flex-row sm:items-center sm:justify-between"
                    >
                      <div className="min-w-0">
                        <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                          <h3 className="text-sm font-semibold leading-5 text-slate-900">{result.competitionName}</h3>
                          <span className="font-mono text-xs text-slate-500">{result.competitionCode}</span>
                        </div>
                        {winner ? (
                          <p className="mt-2 text-sm leading-5 text-slate-600">
                            Winner: <span className="font-semibold text-slate-900">{winner.candidateName}</span>
                            <span className="mx-1 text-slate-300">·</span>
                            {winner.teamCode}
                            <span className="mx-1 text-slate-300">·</span>
                            <span className="font-semibold text-blue-700">{winner.score} pts</span>
                          </p>
                        ) : (
                          <p className="mt-2 text-sm text-slate-500">Official result published</p>
                        )}
                      </div>
                      <div className="flex shrink-0 items-center justify-between gap-3 sm:flex-col sm:items-end">
                        <Badge variant="success" size="sm">Published</Badge>
                        <span className="text-xs tabular-nums text-slate-500">{result.publishedDate}</span>
                      </div>
                    </div>
                  );
                })
              )}
            </div>

            <div className="mt-4 border-t border-slate-100 pt-4">
              <Link href="/admin/media" className="inline-flex items-center gap-1.5 text-sm font-medium text-slate-600 transition-colors hover:text-blue-700">
                Create winners’ posters <ArrowUpRight className="h-4 w-4" />
              </Link>
            </div>
          </article>
        </section>

        {/* Standings and shortcuts */}
        <section className="grid grid-cols-1 gap-5 xl:grid-cols-12">
          <article className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6 xl:col-span-7">
            <div className="flex flex-col gap-3 border-b border-slate-100 pb-4 sm:flex-row sm:items-start sm:justify-between">
              <div className="flex items-start gap-3">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-amber-50 text-amber-700">
                  <Trophy className="h-5 w-5" />
                </div>
                <div>
                  <h2 className="text-base font-semibold tracking-tight text-slate-900">Championship standings</h2>
                  <p className="mt-1 text-sm text-slate-500">Top-performing teams by total points</p>
                </div>
              </div>
              <Link href="/admin/teams" className="inline-flex items-center gap-1 self-start text-sm font-semibold text-blue-700 transition-colors hover:text-blue-800">
                All teams ({teams.length}) <ChevronRight className="h-4 w-4" />
              </Link>
            </div>

            <div className="mt-4 space-y-3">
              {topTeams.length === 0 ? (
                <div className="rounded-xl border border-dashed border-slate-200 bg-slate-50 px-4 py-8 text-center">
                  <Users2 className="mx-auto h-6 w-6 text-slate-400" />
                  <p className="mt-2 text-sm font-medium text-slate-700">No teams added yet</p>
                  <p className="mt-1 text-sm text-slate-500">Create teams to start tracking standings.</p>
                </div>
              ) : (
                topTeams.map((team, index) => {
                  const maxPoints = Math.max(topTeams[0]?.totalPoints || 0, 1);
                  const percent = Math.max(0, Math.min(100, Math.round((team.totalPoints / maxPoints) * 100)));
                  const rankStyle = index === 0
                    ? 'bg-amber-100 text-amber-800 ring-amber-200'
                    : index === 1
                      ? 'bg-slate-100 text-slate-700 ring-slate-200'
                      : 'bg-orange-50 text-orange-800 ring-orange-100';

                  return (
                    <div key={team.id} className="rounded-xl border border-slate-200 p-4">
                      <div className="flex items-center justify-between gap-4">
                        <div className="flex min-w-0 items-center gap-3">
                          <span className={'flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-sm font-semibold ring-1 ' + rankStyle}>
                            {index + 1}
                          </span>
                          <div className="min-w-0">
                            <p className="truncate text-sm font-semibold text-slate-900">{team.name}</p>
                            <p className="mt-0.5 text-xs text-slate-500">Team code: {team.code}</p>
                          </div>
                        </div>
                        <p className="shrink-0 text-right">
                          <span className="text-lg font-semibold tabular-nums tracking-tight text-slate-900">{team.totalPoints.toLocaleString()}</span>
                          <span className="ml-1 text-xs font-medium text-slate-500">pts</span>
                        </p>
                      </div>
                      <div className="mt-4 h-2 overflow-hidden rounded-full bg-slate-100">
                        <div
                          className="h-full rounded-full transition-all duration-500"
                          style={{ width: String(percent) + '%', backgroundColor: team.color || '#2563EB' }}
                        />
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </article>

          <article className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6 xl:col-span-5">
            <div className="flex items-start gap-3 border-b border-slate-100 pb-4">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-violet-50 text-violet-700">
                <Activity className="h-5 w-5" />
              </div>
              <div>
                <h2 className="text-base font-semibold tracking-tight text-slate-900">Quick actions</h2>
                <p className="mt-1 text-sm text-slate-500">Common tasks for festival administration</p>
              </div>
            </div>

            <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2">
              <Link
                href="/admin/competitions"
                className="group flex min-h-28 flex-col rounded-xl border border-slate-200 p-4 transition-all hover:border-blue-300 hover:bg-blue-50/50 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-600 focus-visible:ring-offset-2"
              >
                <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-blue-50 text-blue-700 transition-colors group-hover:bg-blue-100">
                  <PlusCircle className="h-4.5 w-4.5" />
                </span>
                <span className="mt-3 text-sm font-semibold text-slate-900">Manage competitions</span>
                <span className="mt-1 text-xs leading-5 text-slate-500">Create and configure events</span>
              </Link>

              <Link
                href="/admin/registration"
                className="group flex min-h-28 flex-col rounded-xl border border-slate-200 p-4 transition-all hover:border-blue-300 hover:bg-blue-50/50 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-600 focus-visible:ring-offset-2"
              >
                <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-blue-50 text-blue-700 transition-colors group-hover:bg-blue-100">
                  <ClipboardList className="h-4.5 w-4.5" />
                </span>
                <span className="mt-3 text-sm font-semibold text-slate-900">Competition registration</span>
                <span className="mt-1 text-xs leading-5 text-slate-500">Review and manage entries</span>
              </Link>

              <Link
                href="/admin/mark-entry"
                className="group flex min-h-28 flex-col rounded-xl border border-slate-200 p-4 transition-all hover:border-blue-300 hover:bg-blue-50/50 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-600 focus-visible:ring-offset-2"
              >
                <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-blue-50 text-blue-700 transition-colors group-hover:bg-blue-100">
                  <PencilLine className="h-4.5 w-4.5" />
                </span>
                <span className="mt-3 text-sm font-semibold text-slate-900">Enter marks</span>
                <span className="mt-1 text-xs leading-5 text-slate-500">Review judge submissions</span>
              </Link>

              <Link
                href="/admin/export"
                className="group flex min-h-28 flex-col rounded-xl border border-slate-200 p-4 transition-all hover:border-blue-300 hover:bg-blue-50/50 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-600 focus-visible:ring-offset-2"
              >
                <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-blue-50 text-blue-700 transition-colors group-hover:bg-blue-100">
                  <FileSpreadsheet className="h-4.5 w-4.5" />
                </span>
                <span className="mt-3 text-sm font-semibold text-slate-900">Export center</span>
                <span className="mt-1 text-xs leading-5 text-slate-500">Download PDF and CSV reports</span>
              </Link>
            </div>

            <div className="mt-4 flex items-center gap-2 border-t border-slate-100 pt-4 text-sm text-slate-500">
              <span className="flex h-2 w-2 shrink-0 rounded-full bg-emerald-500" aria-hidden="true" />
              Data updates are synchronized across devices
            </div>
          </article>
        </section>
      </div>
    </AdminLayout>
  );
}
