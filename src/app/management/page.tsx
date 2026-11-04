'use client';

import Link from 'next/link';
import {
  Activity,
  ArrowRight,
  CheckCircle2,
  Gavel,
  Globe2,
  IdCard,
  ShieldCheck,
  Trophy,
  UsersRound,
  type LucideIcon,
} from 'lucide-react';
import { useFest } from '@/context/FestContext';
import { FestivalLogo, FestivalStatusBadge } from '@/components/domain/FestivalBrand';

type SyncState = 'loading' | 'ready' | 'error' | 'idle';

type PortalCard = {
  href: string;
  title: string;
  tag: string;
  description: string;
  action: string;
  icon: LucideIcon;
  iconStyle: string;
  tagStyle: string;
  hoverStyle: string;
  actionStyle: string;
};

const portals: PortalCard[] = [
  {
    href: '/admin',
    title: 'Admin Control Center',
    tag: 'Full authority',
    description: 'Manage festival settings, categories, teams, competitions, registrations, green room, judging, results, schedules, media, and exports.',
    action: 'Open admin dashboard',
    icon: ShieldCheck,
    iconStyle: 'bg-blue-50 text-blue-700 ring-blue-100',
    tagStyle: 'bg-blue-50 text-blue-700 border-blue-100',
    hoverStyle: 'hover:border-blue-300 hover:shadow-blue-950/5',
    actionStyle: 'text-blue-700',
  },
  {
    href: '/team',
    title: 'Team Manager Workspace',
    tag: 'Team operations',
    description: 'Register contestants, manage team entries, generate digital ID cards, and review published competition results.',
    action: 'Open team workspace',
    icon: UsersRound,
    iconStyle: 'bg-emerald-50 text-emerald-700 ring-emerald-100',
    tagStyle: 'bg-emerald-50 text-emerald-700 border-emerald-100',
    hoverStyle: 'hover:border-emerald-300 hover:shadow-emerald-950/5',
    actionStyle: 'text-emerald-700',
  },
  {
    href: '/judge/login',
    title: 'Judge Secure Evaluation',
    tag: 'Jury access',
    description: 'Open your assigned judging session, enter criteria-based marks, and submit the evaluation securely.',
    action: 'Continue to judge login',
    icon: Gavel,
    iconStyle: 'bg-violet-50 text-violet-700 ring-violet-100',
    tagStyle: 'bg-violet-50 text-violet-700 border-violet-100',
    hoverStyle: 'hover:border-violet-300 hover:shadow-violet-950/5',
    actionStyle: 'text-violet-700',
  },
  {
    href: '/',
    title: 'Public Results & Championship',
    tag: 'Public portal',
    description: 'Explore published results, winners, team championship standings, participant search, and released event posters.',
    action: 'View public portal',
    icon: Globe2,
    iconStyle: 'bg-amber-50 text-amber-700 ring-amber-100',
    tagStyle: 'bg-amber-50 text-amber-700 border-amber-100',
    hoverStyle: 'hover:border-amber-300 hover:shadow-amber-950/5',
    actionStyle: 'text-amber-700',
  },
  {
    href: '/participant/login',
    title: 'Participant Portal',
    tag: 'Personal access',
    description: 'Sign in with your Bib Number and Date of Birth to view your registered events, published results, and digital ID card.',
    action: 'Open participant login',
    icon: IdCard,
    iconStyle: 'bg-sky-50 text-sky-700 ring-sky-100',
    tagStyle: 'bg-sky-50 text-sky-700 border-sky-100',
    hoverStyle: 'hover:border-sky-300 hover:shadow-sky-950/5',
    actionStyle: 'text-sky-700',
  },
];

function syncLabel(state: SyncState) {
  if (state === 'ready') return 'Live';
  if (state === 'loading') return 'Syncing';
  if (state === 'error') return 'Unavailable';
  return 'Restricted';
}

function MetricCard({
  label,
  value,
  icon: Icon,
  state,
}: {
  label: string;
  value: number;
  icon: LucideIcon;
  state: SyncState;
}) {
  const valueText = state === 'ready' ? value.toLocaleString('en-IN') : '—';

  return (
    <div className="min-w-0 rounded-2xl border border-slate-200/80 bg-white/90 p-4 shadow-sm sm:p-5">
      <div className="flex items-center justify-between gap-3">
        <span className="text-xs font-semibold text-slate-500 sm:text-sm">{label}</span>
        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-slate-50 text-slate-600">
          <Icon className="h-[18px] w-[18px]" aria-hidden="true" />
        </span>
      </div>
      <div className="mt-3 flex items-end justify-between gap-2">
        <p className="text-2xl font-bold tracking-tight text-slate-950 sm:text-3xl" aria-live="polite">
          {valueText}
        </p>
        <span className="pb-1 text-[10px] font-semibold uppercase tracking-wide text-slate-400">
          {syncLabel(state)}
        </span>
      </div>
    </div>
  );
}

export default function ManagementPage() {
  const {
    theme,
    competitions,
    competitionsSyncState,
    results,
    resultsSyncState,
  } = useFest();

  const publishedCount = results.filter((result) => result.resultStatus === 'PUBLISHED').length;
  const hasSyncError = competitionsSyncState === 'error' || resultsSyncState === 'error';
  const isSynced = competitionsSyncState === 'ready' && resultsSyncState === 'ready';

  return (
    <div className="flex min-h-screen flex-col bg-[#F5F7FB] text-slate-900">
      <header className="border-b border-slate-200/80 bg-white/95">
        <div className="mx-auto flex w-full max-w-7xl flex-col gap-3 px-4 py-4 sm:flex-row sm:items-center sm:justify-between sm:px-6 lg:px-8">
          <div className="flex min-w-0 items-center gap-3">
            <FestivalLogo size={46} className="rounded-xl" />
            <div className="min-w-0">
              <h1 className="truncate text-base font-extrabold leading-tight tracking-tight text-slate-950 sm:text-lg">
                <span className="festival-name">{theme.festivalName}</span>
              </h1>
              <p className="mt-0.5 truncate text-xs font-medium text-slate-500 sm:text-sm">
                {theme.institutionName} <span className="px-1 text-slate-300">/</span> Festival management
              </p>
            </div>
          </div>
          <div className="flex items-center justify-between gap-3 sm:justify-end">
            <span className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-slate-50 px-3 py-1.5 text-[11px] font-semibold text-slate-600">
              <span className="h-1.5 w-1.5 rounded-full bg-blue-600" />
              Operations hub
            </span>
            <FestivalStatusBadge className="shrink-0" />
          </div>
        </div>
      </header>

      <main className="mx-auto w-full max-w-7xl flex-1 px-4 py-7 sm:px-6 sm:py-10 lg:px-8 lg:py-12">
        <section className="grid gap-7 xl:grid-cols-[minmax(0,1.12fr)_minmax(340px,0.88fr)] xl:items-end">
          <div className="max-w-3xl">
            <div className="inline-flex items-center gap-2 rounded-full border border-blue-100 bg-blue-50 px-3 py-1.5 text-[10px] font-bold uppercase tracking-[0.16em] text-blue-700 sm:text-[11px]">
              <Activity className="h-3.5 w-3.5" aria-hidden="true" />
              Unified festival operations platform
            </div>
            <h2 className="mt-5 text-[2.15rem] font-extrabold leading-[1.12] tracking-tight text-slate-950 sm:text-4xl lg:text-5xl">
              Every role.
              <span className="block text-blue-700">One festival hub.</span>
            </h2>
            <p className="mt-4 max-w-2xl text-sm leading-6 text-slate-600 sm:text-base sm:leading-7">
              Choose the workspace that matches your role. Each portal provides the tools and information required for your part in the festival.
            </p>
          </div>

          <aside className="rounded-3xl border border-slate-200 bg-slate-100/80 p-4 sm:p-5" aria-label="Festival data overview">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <p className="text-sm font-bold text-slate-900">Festival overview</p>
                <p className="mt-1 text-xs leading-5 text-slate-500">
                  {hasSyncError
                    ? 'Some overview data could not be synchronized.'
                    : isSynced
                      ? 'Overview figures update automatically as records change.'
                      : 'Waiting for the latest overview data.'}
                </p>
              </div>
              <span className={'inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[10px] font-bold uppercase tracking-wide ' + (
                hasSyncError
                  ? 'border-rose-200 bg-rose-50 text-rose-700'
                  : isSynced
                    ? 'border-emerald-200 bg-emerald-50 text-emerald-700'
                    : 'border-blue-200 bg-blue-50 text-blue-700'
              )}>
                {hasSyncError ? (
                  <Activity className="h-3 w-3" aria-hidden="true" />
                ) : isSynced ? (
                  <CheckCircle2 className="h-3 w-3" aria-hidden="true" />
                ) : (
                  <Activity className="h-3 w-3 animate-pulse" aria-hidden="true" />
                )}
                {hasSyncError ? 'Sync issue' : isSynced ? 'Connected' : 'Syncing'}
              </span>
            </div>
            <div className="mt-4 grid grid-cols-2 gap-3">
              <MetricCard
                label="Competitions"
                value={competitions.length}
                icon={Trophy}
                state={competitionsSyncState}
              />
              <MetricCard
                label="Published results"
                value={publishedCount}
                icon={CheckCircle2}
                state={resultsSyncState}
              />
            </div>
          </aside>
        </section>

        <section className="mt-10 sm:mt-12" aria-labelledby="portal-heading">
          <div className="mb-5 flex flex-col gap-1 sm:mb-6 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-blue-700">Choose your destination</p>
              <h3 id="portal-heading" className="mt-1 text-xl font-extrabold tracking-tight text-slate-950 sm:text-2xl">
                Access a portal
              </h3>
            </div>
            <p className="text-xs text-slate-500 sm:text-sm">Select a card to continue</p>
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 sm:gap-5 xl:grid-cols-3">
            {portals.map((portal) => {
              const Icon = portal.icon;
              return (
                <Link
                  key={portal.href}
                  href={portal.href}
                  aria-label={portal.action + ': ' + portal.title}
                  className={'group flex min-h-[248px] min-w-0 flex-col rounded-3xl border border-slate-200 bg-white p-5 shadow-sm transition duration-200 hover:-translate-y-0.5 hover:shadow-lg focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-blue-200 sm:p-6 ' + portal.hoverStyle}
                >
                  <div className="flex items-start justify-between gap-3">
                    <span className={'flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl ring-1 ring-inset ' + portal.iconStyle}>
                      <Icon className="h-6 w-6" strokeWidth={1.9} aria-hidden="true" />
                    </span>
                    <span className={'max-w-[55%] rounded-full border px-2.5 py-1 text-center text-[9px] font-bold uppercase tracking-[0.1em] ' + portal.tagStyle}>
                      {portal.tag}
                    </span>
                  </div>

                  <div className="mt-5 min-w-0">
                    <h4 className="text-base font-bold leading-snug tracking-tight text-slate-950 sm:text-lg">
                      {portal.title}
                    </h4>
                    <p className="mt-2 text-xs leading-6 text-slate-500 sm:text-[13px]">
                      {portal.description}
                    </p>
                  </div>

                  <div className={'mt-auto flex items-center justify-between gap-3 border-t border-slate-100 pt-4 ' + portal.actionStyle}>
                    <span className="text-xs font-bold">{portal.action}</span>
                    <ArrowRight className="h-4 w-4 shrink-0 transition-transform duration-200 group-hover:translate-x-1" aria-hidden="true" />
                  </div>
                </Link>
              );
            })}
          </div>
        </section>
      </main>

      <footer className="border-t border-slate-200 bg-white">
        <div className="mx-auto flex w-full max-w-7xl flex-col gap-1 px-4 py-4 text-center text-[11px] text-slate-500 sm:flex-row sm:items-center sm:justify-between sm:px-6 sm:text-left lg:px-8">
          <span>
            {theme.institutionName} <span className="px-1 text-slate-300">·</span>
            <span className="festival-name">{theme.festivalName}</span>
          </span>
          <span className="font-medium text-slate-400">Festival Management System</span>
        </div>
      </footer>
    </div>
  );
}
