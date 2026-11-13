'use client';

import React, { useCallback, useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { AlertCircle, Award, CalendarDays, CheckCircle2, Clock3, CloudCheck, DoorOpen, IdCard, LoaderCircle, LogOut, Medal, RefreshCw, Trophy, Users2 } from 'lucide-react';
import { ParticipantProfileEditor } from '@/components/domain/ParticipantProfileEditor';
import { DigitalIdCard } from '@/components/domain/DigitalIdCard';
import { ParticipantPhoto } from '@/components/domain/ParticipantPhoto';
import { useFest } from '@/context/FestContext';
import { FestivalLogo, FestivalStatusBadge } from '@/components/domain/FestivalBrand';
import type { Participant } from '@/types/fest';

type Profile = Pick<Participant, 'id' | 'bib' | 'name' | 'teamId' | 'teamName' | 'teamCode' | 'categoryName' | 'categoryId' | 'classGrade' | 'photoUrl' | 'idStatus' | 'email' | 'phone' | 'remarks'>;
type Entry = {
  registrationId: string; name: string; code: string; type: 'SOLO' | 'GROUP';
  mode: 'STAGE' | 'OFF_STAGE' | null; date: string; timeSlot: string;
  stageName: string; registrationStatus: string; groupName?: string;
  published: boolean; score: number | null; grade: string | null;
  position: number | null; individualPoints: number; groupTeamPoints: number;
};
type PortalData = { profile: Profile; events: Entry[]; summary: {
  competitions: number; soloEvents: number; groupEvents: number; individualPoints: number
} };

export default function ParticipantDashboard() {
  const router = useRouter();
  const { theme, themeSyncState } = useFest();
  const [data, setData] = useState<PortalData | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [logoutLoading, setLogoutLoading] = useState(false);
  const [error, setError] = useState('');
  const [lastSyncedAt, setLastSyncedAt] = useState<Date | null>(null);
  const [idOpen, setIdOpen] = useState(false);
  const requestInFlight = useRef(false);
  const hasLoadedOnce = useRef(false);

  const refresh = useCallback(async () => {
    if (requestInFlight.current) return;
    requestInFlight.current = true;
    if (hasLoadedOnce.current) setRefreshing(true);
    else setLoading(true);
    try {
      const res = await fetch('/api/participant/me', {
        cache: 'no-store',
        credentials: 'same-origin',
        headers: { Accept: 'application/json' }
      });
      if (res.status === 401) {
        setData(null);
        hasLoadedOnce.current = false;
        setError('');
        router.replace('/participant/login');
        return;
      }
      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(json.error || 'Could not load dashboard.');
      if (!json.profile || !Array.isArray(json.events) || !json.summary) {
        throw new Error('The participant dashboard returned incomplete data. Please retry.');
      }
      setData(json);
      hasLoadedOnce.current = true;
      setLastSyncedAt(new Date());
      setError('');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to load participant details.');
    } finally {
      requestInFlight.current = false;
      setLoading(false);
      setRefreshing(false);
    }
  }, [router]);

  useEffect(() => { void refresh(); }, [refresh]);

  // Participant data stays behind the authenticated API. Refresh on focus and
  // periodically so new registrations and published results appear without reload.
  useEffect(() => {
    const refreshWhenVisible = () => {
      if (document.visibilityState === 'visible') void refresh();
    };
    const interval = window.setInterval(refreshWhenVisible, 30_000);
    window.addEventListener('focus', refreshWhenVisible);
    document.addEventListener('visibilitychange', refreshWhenVisible);
    return () => {
      window.clearInterval(interval);
      window.removeEventListener('focus', refreshWhenVisible);
      document.removeEventListener('visibilitychange', refreshWhenVisible);
    };
  }, [refresh]);

  const logout = async () => {
    if (logoutLoading) return;
    setLogoutLoading(true);
    try {
      const response = await fetch('/api/participant/logout', { method: 'POST', credentials: 'same-origin', cache: 'no-store' });
      if (!response.ok) throw new Error('Unable to end the session. Please try again.');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to end the session.');
      setLogoutLoading(false);
      return;
    }
    setData(null);
    router.replace('/participant/login');
    router.refresh();
  };

  if (loading) return (
    <div className="min-h-screen bg-[#F5F7FC] px-4 py-8">
      <div className="mx-auto max-w-6xl animate-pulse space-y-5">
        <div className="h-[68px] rounded-2xl border border-slate-200 bg-white" />
        <div className="h-44 rounded-2xl border border-slate-200 bg-white" />
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">{[0, 1, 2, 3].map(item => <div key={item} className="h-28 rounded-xl border border-slate-200 bg-white" />)}</div>
        <div className="h-64 rounded-2xl border border-slate-200 bg-white" />
        <p className="text-center text-xs font-medium text-[#64748B]">Loading your Participant Portal…</p>
      </div>
    </div>
  );
  if (!data) return (
    <div className="min-h-screen bg-[#F5F7FC] flex items-center justify-center p-5">
      <div className="bg-white border border-[#E1E7EF] p-7 rounded-2xl max-w-md w-full space-y-4 text-center">
        <h1 className="font-extrabold text-xl text-[#111827]">Participant Portal</h1>
        <p className="text-sm text-red-700">{error || 'Your session has expired. Please sign in again.'}</p>
        <div className="flex gap-2 justify-center">
          <button type="button" onClick={() => { setLoading(true); void refresh(); }}
            className="text-sm font-bold rounded-lg border px-4 py-2">Retry</button>
          <Link href="/participant/login" className="text-sm font-bold text-white bg-[#2563EB] rounded-lg px-4 py-2">Sign In</Link>
        </div>
      </div>
    </div>
  );

  const { profile, events, summary } = data;
  const cardParticipant: Participant = {
    ...profile, email: '', phone: '', dob: '', remarks: '',
    registeredEventIds: events.map(e => e.registrationId)
  };
  const summaryCards = [
    { label: 'My Competitions', value: summary.competitions, icon: Trophy },
    { label: 'Individual Competitions', value: summary.soloEvents, icon: Medal },
    { label: 'Group Competitions', value: summary.groupEvents, icon: Users2 },
    { label: 'My Official Points', value: summary.individualPoints, icon: Award }
  ];

  return (
    <div className="min-h-screen bg-[#F5F7FC]">
      <header className="sticky top-0 z-30 border-b border-[#E1E7EF] bg-white/95 shadow-sm backdrop-blur">
        <div className="mx-auto flex min-h-[68px] max-w-7xl items-center justify-between gap-2 px-3 sm:min-h-[76px] sm:gap-4 sm:px-6 lg:px-8">
          <div className="flex min-w-0 items-center gap-2.5 sm:gap-3">
            <FestivalLogo size={38} />
            <div className="min-w-0">
              <span className="block truncate text-sm font-extrabold text-[#111827] sm:text-base"><span className="festival-name">{theme.festivalName || (themeSyncState === 'loading' ? 'Loading festival…' : 'Festival name unavailable')}</span></span>
              <span className="block text-[11px] text-[#526070]">Participant Dashboard</span>
            </div>
          </div>
          <div className="hidden sm:block"><FestivalStatusBadge /></div>
          <button type="button" onClick={() => void logout()} disabled={logoutLoading}
            className="inline-flex min-h-10 shrink-0 items-center justify-center gap-1.5 rounded-xl border border-[#E1E7EF] px-2.5 py-2 text-xs font-bold text-[#526070] transition hover:bg-[#F8FAFC] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 disabled:cursor-wait disabled:opacity-60 sm:px-3.5">
            {logoutLoading ? <LoaderCircle className="h-4 w-4 animate-spin" /> : <LogOut className="h-4 w-4" />}<span>{logoutLoading ? 'Signing out…' : 'Logout'}</span>
          </button>
        </div>
      </header>
      <main className="mx-auto w-full max-w-7xl space-y-5 px-3 py-5 sm:space-y-6 sm:px-6 sm:py-7 lg:px-8">
        {error && <div role="alert" className="flex items-start gap-2.5 rounded-xl border border-amber-200 bg-amber-50 px-3.5 py-3 text-xs leading-5 text-amber-900 sm:px-4"><AlertCircle className="mt-0.5 h-4 w-4 shrink-0" /><span>Could not refresh the latest portal data. Showing the last successfully loaded information. {error}</span></div>}
        <section className="flex flex-col gap-4 rounded-2xl border border-[#E1E7EF] bg-white p-4 shadow-sm sm:flex-row sm:items-center sm:gap-5 sm:p-6 lg:p-7">
          <ParticipantPhoto
            photoUrl={profile.photoUrl}
            name={profile.name}
            shape="rounded"
            size="lg"
            className="shrink-0 border border-[#E1E7EF] shadow-sm"
          />
          <div className="min-w-0 flex-1">
            <p className="text-xs font-semibold text-[#2563EB] uppercase tracking-widest">My Participant Profile</p>
            <h1 className="mt-1 break-words text-xl font-extrabold tracking-tight text-[#111827] sm:text-2xl">{profile.name}</h1>
            <p className="mt-1 break-words text-sm text-[#526070]">{profile.teamName} ({profile.teamCode}) · {profile.categoryName}</p>
            <div className="mt-3 flex flex-wrap gap-2 text-[11px] font-medium text-[#526070] sm:text-xs">
              <span className="max-w-full break-all rounded-lg border border-[#E1E7EF] bg-[#F5F7FC] px-2.5 py-1.5">ID: {profile.id}</span>
              <span className="rounded-lg border border-[#E1E7EF] bg-[#F5F7FC] px-2.5 py-1.5">Bib: {profile.bib}</span>
              <span className="rounded-lg border border-[#E1E7EF] bg-[#F5F7FC] px-2.5 py-1.5">Class: {profile.classGrade || '—'}</span>
            </div>
          </div>
          <div className="grid w-full grid-cols-1 gap-2 sm:ml-auto sm:w-auto sm:min-w-[190px]"><ParticipantProfileEditor participantId={profile.id} profile={profile} onSaved={refresh} /><button type="button" onClick={() => setIdOpen(true)}
            className="inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-xl bg-[#2563EB] px-4 py-3 text-sm font-bold text-white shadow-sm transition hover:bg-[#1D4ED8] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2">
            <IdCard className="h-5 w-5" /> My Digital ID Card
          </button></div>
        </section>

        <section aria-label="Participant summary" className="grid grid-cols-2 gap-3 xl:grid-cols-4 sm:gap-4">
          {summaryCards.map(({ label, value, icon: Icon }) => (
            <div key={label} className="min-w-0 rounded-xl border border-[#E1E7EF] bg-white p-3.5 shadow-sm sm:p-5">
              <div className="w-9 h-9 rounded-lg bg-[#EFF6FF] text-[#2563EB] flex items-center justify-center mb-3"><Icon className="w-5 h-5" /></div>
              <p className="text-2xl font-black tabular-nums text-[#111827] sm:text-3xl">{value}</p>
              <p className="text-xs text-[#526070] mt-1">{label}</p>
            </div>
          ))}
        </section>

        <div className="flex items-start gap-3 rounded-xl border border-blue-200 bg-blue-50 px-4 py-3.5 sm:px-5 sm:py-4">
          <CheckCircle2 className="w-5 h-5 shrink-0 text-[#2563EB]" />
          <p className="text-xs leading-relaxed text-blue-900">
            Individual points come from <strong>published Individual results only</strong>.
            Group competition awards count toward the team championship and never increase your individual points.
            Unpublished results remain confidential.
          </p>
        </div>

        <section className="bg-white rounded-2xl border border-[#E1E7EF] overflow-hidden">
          <div className="flex flex-col gap-3 border-b border-[#E1E7EF] p-4 sm:flex-row sm:items-center sm:justify-between sm:p-5">
            <div>
              <h2 className="text-lg font-extrabold text-[#111827]">My Competitions & Results</h2>
              <p className="text-xs text-[#526070] mt-1">Events assigned to your participant record; published grades and awarded points are shown here.</p>
            </div>
            <div className="flex w-full flex-col gap-1.5 sm:w-auto sm:items-end">
              <button type="button" onClick={() => void refresh()} disabled={refreshing}
                className="inline-flex min-h-10 w-full items-center justify-center gap-2 rounded-xl border border-[#CBD5E1] bg-white px-3.5 py-2 text-xs font-bold text-[#2563EB] transition hover:bg-blue-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 disabled:cursor-wait disabled:opacity-60 sm:w-auto">
                {refreshing ? <LoaderCircle className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
                {refreshing ? 'Refreshing…' : 'Refresh Portal'}
              </button>
              <span className="inline-flex items-center gap-1.5 text-[10px] text-[#64748B]">
                <CloudCheck className="h-3.5 w-3.5 text-emerald-600" />
                {lastSyncedAt ? 'Updated at ' + lastSyncedAt.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) + ' · Auto-sync on' : 'Connecting to your latest data…'}
              </span>
            </div>
          </div>
          {events.length ? (
            <div className="divide-y divide-[#E1E7EF]">
              {events.map(event => (
                <article key={event.registrationId} className="flex flex-col gap-3.5 p-4 sm:gap-4 sm:p-5 md:flex-row md:items-center md:justify-between">
                  <div className="min-w-0">
                    <div className="flex flex-wrap gap-2 items-center">
                      <span className="text-xs font-mono text-[#2563EB] font-bold">{event.code}</span>
                      <span className={'text-[10px] font-bold px-2 py-1 rounded-full ' +
                        (event.type === 'SOLO' ? 'bg-blue-50 text-blue-800' : 'bg-purple-50 text-purple-800')}>
                        {event.type === 'SOLO' ? 'Individual' : 'Group · Team points only'}
                      </span>
                      <span className="text-[10px] font-semibold rounded-full px-2 py-1 bg-[#F1F5F9] text-[#526070]">
                        {event.mode === 'STAGE' ? 'STAGE' : event.mode === 'OFF_STAGE' ? 'OFF STAGE' : 'UNCLASSIFIED'}
                      </span>
                    </div>
                    <h3 className="font-bold text-[#111827] mt-2">{event.name}</h3>
                    {event.groupName && <p className="text-xs text-[#526070] mt-0.5">{event.groupName}</p>}
                    <div className="text-xs text-[#526070] mt-2 flex flex-wrap gap-x-4 gap-y-1">
                      {event.date && <span className="flex items-center gap-1"><CalendarDays className="w-3.5 h-3.5" /> {event.date}</span>}
                      {event.timeSlot && <span className="flex items-center gap-1"><Clock3 className="w-3.5 h-3.5" /> {event.timeSlot}</span>}
                      {event.stageName && <span className="flex items-center gap-1"><DoorOpen className="w-3.5 h-3.5" /> {event.stageName}</span>}
                    </div>
                  </div>
                  <div className="shrink-0 rounded-xl bg-slate-50 p-3 md:bg-transparent md:p-0 md:text-right">
                    {event.published ? (
                      <>
                        <p className="text-sm font-black text-[#111827]">Grade {event.grade || '—'}</p>
                        <p className="text-xs text-[#526070] mt-0.5">
                          {event.position ? 'Position #' + event.position : 'No Prize'}
                        </p>
                        <p className="text-sm font-bold text-emerald-700 mt-1">
                          +{event.type === 'SOLO' ? event.individualPoints : event.groupTeamPoints} {event.type === 'SOLO' ? 'individual pts' : 'team pts'}
                        </p>
                      </>
                    ) : (
                      <span className="text-xs font-semibold px-3 py-2 bg-amber-50 text-amber-800 rounded-lg">
                        {event.registrationStatus === 'APPROVED' ? 'Result Not Published' : 'Registration Pending'}
                      </span>
                    )}
                  </div>
                </article>
              ))}
            </div>
          ) : (
            <div className="px-4 py-12 text-center text-sm text-[#526070] sm:py-14">
              No registrations are linked to this Participant ID yet. Contact your Team Manager.
            </div>
          )}
        </section>
        <p className="px-3 pb-2 text-center text-[11px] leading-5 text-[#64748B] sm:text-xs">This is a read-only participant workspace. Competition registration is managed by the authorized Team Manager.</p>
      </main>
      <DigitalIdCard participant={cardParticipant} isOpen={idOpen} onClose={() => setIdOpen(false)} authMode="participant" />
    </div>
  );
}
