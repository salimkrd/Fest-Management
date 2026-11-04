'use client';

import React from 'react';
import Link from 'next/link';
import { TeamLayout } from '@/components/layout/TeamLayout';
import { TeamSyncStatus } from '@/components/domain/TeamSyncStatus';
import { useFest } from '@/context/FestContext';
import {
  Users,
  Trophy,
  ClipboardList,
  Award,
  Plus,
  CalendarDays,
  ChevronRight,
  ArrowUpRight,
  IdCard,
  FileDown
} from 'lucide-react';

export default function TeamManagerDashboardPage() {
  const {
    currentTeamUser,
    teams,
    participants,
    registrations,
    schedules,
    results
  } = useFest();

  const team = currentTeamUser
    ? teams.find(candidate => candidate.id === currentTeamUser.id) || currentTeamUser
    : null;

  const teamParticipants = participants.filter(participant => participant.teamId === team?.id);
  const teamRegistrations = registrations.filter(registration => registration.teamId === team?.id);
  const registeredCompetitionIds = new Set(teamRegistrations.map(registration => registration.competitionId));

  const upcomingTeamEvents = schedules
    .filter(slot => registeredCompetitionIds.has(slot.competitionId))
    .sort((a, b) => (a.date + a.startTime).localeCompare(b.date + b.startTime))
    .slice(0, 4);

  const recentTeamRegistrations = [...teamRegistrations].reverse().slice(0, 5);
  const publishedAwards = results
    .filter(result => result.resultStatus === 'PUBLISHED')
    .reduce((total, result) => total + result.ranks.filter(rank => rank.teamId === team?.id).length, 0);

  const quickLinks = [
    {
      href: '/team/participants',
      title: 'Manage participants',
      description: 'Add contestants and update their profiles',
      icon: Users,
      tone: 'bg-blue-50 text-blue-700'
    },
    {
      href: '/team/registration',
      title: 'Competition registration',
      description: 'Enroll eligible team members in events',
      icon: ClipboardList,
      tone: 'bg-emerald-50 text-emerald-700'
    },
    {
      href: '/team/results',
      title: 'Results and standings',
      description: 'Review published grades and team standings',
      icon: Award,
      tone: 'bg-amber-50 text-amber-700'
    },
    {
      href: '/team/export',
      title: 'Export team results',
      description: 'Download your official results register',
      icon: FileDown,
      tone: 'bg-violet-50 text-violet-700'
    }
  ];

  const statusClass = (status: string) => {
    if (status === 'APPROVED') return 'bg-emerald-50 text-emerald-700';
    if (status === 'REJECTED') return 'bg-red-50 text-red-700';
    return 'bg-amber-50 text-amber-700';
  };

  return (
    <TeamLayout>
      <div className="space-y-5 sm:space-y-6">
        <TeamSyncStatus sources={['teams', 'participants', 'registrations', 'schedules', 'results']} />

        <section className="relative overflow-hidden rounded-3xl border border-slate-200 bg-white p-5 shadow-sm sm:p-7">
          <div
            className="absolute inset-y-0 left-0 w-1.5"
            style={{ backgroundColor: team?.color || '#2563EB' }}
          />
          <div className="flex flex-col gap-5 pl-2 sm:flex-row sm:items-center sm:justify-between">
            <div className="min-w-0">
              <p className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">
                {team?.zone || 'Festival'} · House contingent
              </p>
              <h1 className="mt-2 break-words text-2xl font-bold tracking-tight text-slate-950 sm:text-[30px]">
                {team?.name || 'Team Workspace'}
              </h1>
              <p className="mt-1.5 text-sm text-slate-600">
                {team?.code ? `Contingent code: ${team.code}` : 'Your team management overview'}
                {team?.managerName ? ` · Manager: ${team.managerName}` : ''}
              </p>
              {team?.managerPhone && <p className="mt-1 text-xs text-slate-500">Contact: {team.managerPhone}</p>}
            </div>
            <Link
              href="/team/registration"
              className="inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-xl bg-blue-700 px-4 py-3 text-sm font-semibold text-white shadow-sm transition hover:bg-blue-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-600 focus-visible:ring-offset-2 sm:w-auto"
            >
              <Plus className="h-4 w-4" />
              Register for an event
            </Link>
          </div>
        </section>

        <section className="grid grid-cols-2 gap-3 sm:gap-4 xl:grid-cols-4">
          <MetricCard label="Participants" value={teamParticipants.length} detail="Team roster" icon={<Users className="h-5 w-5" />} tone="blue" />
          <MetricCard label="Event entries" value={teamRegistrations.length} detail="Individual and group" icon={<ClipboardList className="h-5 w-5" />} tone="emerald" />
          <MetricCard label="Published awards" value={publishedAwards} detail="Officially released placings" icon={<Award className="h-5 w-5" />} tone="amber" />
          <MetricCard label="Championship points" value={team?.totalPoints ?? 0} detail={`Rank #${team?.rank || 1} · Live standings`} icon={<Trophy className="h-5 w-5" />} tone="violet" />
        </section>

        <section className="grid grid-cols-1 gap-5 xl:grid-cols-5">
          <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm xl:col-span-3">
            <div className="flex items-center justify-between gap-3 border-b border-slate-200 px-4 py-4 sm:px-5">
              <div className="flex items-center gap-2.5">
                <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-blue-50 text-blue-700">
                  <CalendarDays className="h-4 w-4" />
                </span>
                <div>
                  <h2 className="text-sm font-bold text-slate-950">Upcoming team competitions</h2>
                  <p className="mt-0.5 text-xs text-slate-500">Schedule slots linked to your registrations</p>
                </div>
              </div>
              <Link href="/team/registration" className="inline-flex shrink-0 items-center gap-1 text-xs font-semibold text-blue-700 hover:text-blue-800">
                Registrations <ChevronRight className="h-3.5 w-3.5" />
              </Link>
            </div>
            <div className="space-y-3 p-4 sm:p-5">
              {upcomingTeamEvents.length === 0 ? (
                <div className="rounded-xl border border-dashed border-slate-200 px-4 py-8 text-center">
                  <CalendarDays className="mx-auto h-7 w-7 text-slate-300" />
                  <p className="mt-2 text-sm font-medium text-slate-700">No linked schedule slots yet</p>
                  <p className="mt-1 text-xs text-slate-500">Your registered competitions will appear here when the schedule is published.</p>
                </div>
              ) : (
                upcomingTeamEvents.map(slot => (
                  <article key={slot.id} className="flex flex-col gap-3 rounded-xl border border-slate-200 bg-slate-50/70 p-3.5 sm:flex-row sm:items-center sm:justify-between">
                    <div className="min-w-0">
                      <h3 className="break-words text-sm font-semibold text-slate-900">{slot.competitionName}</h3>
                      <p className="mt-1 text-xs text-slate-500">{slot.categoryName} · {slot.stageName || 'Stage not assigned'}</p>
                    </div>
                    <div className="flex shrink-0 items-center justify-between gap-3 sm:justify-end">
                      <div className="text-left sm:text-right">
                        <p className="text-xs font-semibold text-slate-800">{slot.date || 'Date to be announced'}</p>
                        <p className="mt-0.5 text-xs text-slate-500">{slot.startTime || 'Time to be announced'} · {slot.status}</p>
                      </div>
                    </div>
                  </article>
                ))
              )}
            </div>
            <div className="border-t border-slate-100 px-4 py-3 sm:px-5">
              <Link href="/team/participants" className="inline-flex items-center gap-1.5 text-xs font-semibold text-slate-600 transition hover:text-blue-700">
                View participant roster <ArrowUpRight className="h-3.5 w-3.5" />
              </Link>
            </div>
          </div>

          <div className="space-y-5 xl:col-span-2">
            <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:p-5">
              <h2 className="text-sm font-bold text-slate-950">Quick actions</h2>
              <div className="mt-3 grid grid-cols-1 gap-2.5">
                {quickLinks.map(item => {
                  const Icon = item.icon;
                  return (
                    <Link
                      key={item.href}
                      href={item.href}
                      className="group flex min-w-0 items-center gap-3 rounded-xl border border-slate-200 p-3 transition hover:border-blue-200 hover:bg-slate-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
                    >
                      <span className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ${item.tone}`}>
                        <Icon className="h-4 w-4" />
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-sm font-semibold text-slate-900">{item.title}</span>
                        <span className="mt-0.5 block text-xs leading-4 text-slate-500">{item.description}</span>
                      </span>
                      <ChevronRight className="h-4 w-4 shrink-0 text-slate-400 transition group-hover:translate-x-0.5 group-hover:text-blue-700" />
                    </Link>
                  );
                })}
              </div>
            </section>

            <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
              <div className="border-b border-slate-200 px-4 py-4 sm:px-5">
                <h2 className="text-sm font-bold text-slate-950">Recent team activity</h2>
                <p className="mt-0.5 text-xs text-slate-500">Latest event registrations</p>
              </div>
              <div className="divide-y divide-slate-100">
                {recentTeamRegistrations.length === 0 ? (
                  <p className="px-4 py-7 text-center text-xs text-slate-500">No registrations to show yet.</p>
                ) : (
                  recentTeamRegistrations.map(registration => (
                    <div key={registration.id} className="flex items-start justify-between gap-3 px-4 py-3 sm:px-5">
                      <div className="min-w-0">
                        <p className="break-words text-xs font-semibold text-slate-900">{registration.participantName}</p>
                        <p className="mt-0.5 break-words text-xs text-slate-500">{registration.competitionName}</p>
                      </div>
                      <span className={`shrink-0 rounded-full px-2 py-1 text-[10px] font-bold ${statusClass(registration.status)}`}>
                        {registration.status}
                      </span>
                    </div>
                  ))
                )}
              </div>
              <div className="border-t border-slate-100 px-4 py-3 sm:px-5">
                <Link href="/team/registration" className="inline-flex items-center gap-1.5 text-xs font-semibold text-blue-700 hover:text-blue-800">
                  View all registrations <ChevronRight className="h-3.5 w-3.5" />
                </Link>
              </div>
            </section>
          </div>
        </section>
      </div>
    </TeamLayout>
  );
}

function MetricCard({
  label,
  value,
  detail,
  icon,
  tone
}: {
  label: string;
  value: string | number;
  detail: string;
  icon: React.ReactNode;
  tone: 'blue' | 'emerald' | 'amber' | 'violet';
}) {
  const iconTone = {
    blue: 'bg-blue-50 text-blue-700',
    emerald: 'bg-emerald-50 text-emerald-700',
    amber: 'bg-amber-50 text-amber-700',
    violet: 'bg-violet-50 text-violet-700'
  }[tone];

  return (
    <article className="min-w-0 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:p-5">
      <div className="flex items-center justify-between gap-2">
        <p className="text-xs font-semibold text-slate-500">{label}</p>
        <span className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-xl ${iconTone}`}>{icon}</span>
      </div>
      <p className="mt-2 text-2xl font-bold tabular-nums tracking-tight text-slate-950 sm:text-[28px]">{value}</p>
      <p className="mt-1 truncate text-[11px] text-slate-500">{detail}</p>
    </article>
  );
}
