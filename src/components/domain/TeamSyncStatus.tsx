'use client';

import React from 'react';
import { AlertTriangle, CheckCircle2, RefreshCw } from 'lucide-react';
import { useFest } from '@/context/FestContext';

type SyncSource =
  | 'teams'
  | 'categories'
  | 'competitions'
  | 'participants'
  | 'registrations'
  | 'schedules'
  | 'results';

interface TeamSyncStatusProps {
  sources: SyncSource[];
  className?: string;
}

export function TeamSyncStatus({ sources, className = '' }: TeamSyncStatusProps) {
  const {
    teamsSyncState,
    categoriesSyncState,
    competitionsSyncState,
    participantsSyncState,
    registrationsSyncState,
    schedulesSyncState,
    resultsSyncState
  } = useFest();

  const stateBySource = {
    teams: teamsSyncState,
    categories: categoriesSyncState,
    competitions: competitionsSyncState,
    participants: participantsSyncState,
    registrations: registrationsSyncState,
    schedules: schedulesSyncState,
    results: resultsSyncState
  } as const;

  const states = sources.map(source => stateBySource[source]);
  const hasError = states.includes('error');
  const isLoading = states.includes('loading');
  const isReady = states.every(state => state === 'ready');

  if (hasError) {
    return (
      <div
        role="status"
        aria-live="polite"
        className={`flex items-start gap-2.5 rounded-xl border border-amber-200 bg-amber-50 px-3.5 py-3 text-xs leading-5 text-amber-900 ${className}`}
      >
        <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-amber-700" />
        <span>
          <strong className="font-semibold">Live sync issue.</strong>{' '}
          Some information may be out of date. Check your connection or access permissions, then refresh this page to retry.
        </span>
      </div>
    );
  }

  if (isLoading || !isReady) {
    return (
      <div
        role="status"
        aria-live="polite"
        className={`flex items-center gap-2.5 rounded-xl border border-blue-100 bg-blue-50/70 px-3.5 py-3 text-xs leading-5 text-blue-800 ${className}`}
      >
        <RefreshCw className="h-4 w-4 shrink-0 animate-spin text-blue-700" />
        <span>Connecting to live festival data…</span>
      </div>
    );
  }

  return (
    <div
      role="status"
      aria-live="polite"
      className={`flex items-center gap-2 rounded-xl border border-emerald-100 bg-emerald-50/70 px-3.5 py-2.5 text-xs font-medium text-emerald-800 ${className}`}
    >
      <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-700" />
      <span>Live data synced</span>
    </div>
  );
}
