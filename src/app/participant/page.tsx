'use client';

import React, { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Award, CalendarDays, CheckCircle2, Clock3, DoorOpen, IdCard, LogOut, Medal, Trophy, Users2 } from 'lucide-react';
import { DigitalIdCard } from '@/components/domain/DigitalIdCard';
import { ParticipantPhoto } from '@/components/domain/ParticipantPhoto';
import type { Participant } from '@/types/fest';

type Profile = Pick<Participant, 'id' | 'bib' | 'name' | 'teamId' | 'teamName' | 'teamCode' | 'categoryName' | 'categoryId' | 'classGrade' | 'division' | 'photoUrl' | 'idStatus'>;
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
  const [data, setData] = useState<PortalData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [idOpen, setIdOpen] = useState(false);

  const refresh = useCallback(async () => {
    try {
      const res = await fetch('/api/participant/me', { cache: 'no-store', credentials: 'same-origin' });
      if (res.status === 401) {
        router.replace('/participant/login');
        return;
      }
      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(json.error || 'Could not load dashboard.');
      setData(json);
      setError('');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to load participant details.');
    } finally {
      setLoading(false);
    }
  }, [router]);

  useEffect(() => { void refresh(); }, [refresh]);

  const logout = async () => {
    try {
      await fetch('/api/participant/logout', { method: 'POST', credentials: 'same-origin' });
    } finally {
      setData(null);
      router.replace('/participant/login');
      router.refresh();
    }
  };

  if (loading) return (
    <div className="min-h-screen bg-[#F5F7FC] flex items-center justify-center text-[#526070] text-sm">
      Loading your Participant Portal...
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
    { label: 'Solo Competitions', value: summary.soloEvents, icon: Medal },
    { label: 'Group Competitions', value: summary.groupEvents, icon: Users2 },
    { label: 'My Official Points', value: summary.individualPoints, icon: Award }
  ];

  return (
    <div className="min-h-screen bg-[#F5F7FC]">
      <header className="bg-white border-b border-[#E1E7EF] sticky top-0 z-20">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 h-[72px] flex items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-[#2563EB] text-white font-black rounded-xl flex items-center justify-center">I</div>
            <div>
              <span className="block text-sm font-extrabold text-[#111827]">INSPIRATH</span>
              <span className="block text-[11px] text-[#526070]">Participant Dashboard</span>
            </div>
          </div>
          <button type="button" onClick={() => void logout()}
            className="inline-flex items-center gap-1.5 text-xs font-bold border border-[#E1E7EF] rounded-lg px-3 py-2 text-[#526070] hover:bg-[#F8FAFC]">
            <LogOut className="w-4 h-4" /> Logout
          </button>
        </div>
      </header>
      <main className="max-w-6xl mx-auto px-4 sm:px-6 py-7 space-y-6">
        <section className="rounded-2xl border border-[#E1E7EF] bg-white p-5 sm:p-7 flex flex-col sm:flex-row sm:items-center gap-5">
          <ParticipantPhoto
            photoUrl={profile.photoUrl}
            name={profile.name}
            shape="rounded"
            size="lg"
            className="border border-[#E1E7EF] shrink-0"
          />
          <div className="flex-1">
            <p className="text-xs font-semibold text-[#2563EB] uppercase tracking-widest">My Participant Profile</p>
            <h1 className="text-2xl font-extrabold text-[#111827] mt-1">{profile.name}</h1>
            <p className="text-sm text-[#526070] mt-1">{profile.teamName} ({profile.teamCode}) · {profile.categoryName}</p>
            <div className="mt-3 flex flex-wrap gap-2 text-xs text-[#526070]">
              <span className="px-2.5 py-1.5 rounded-lg bg-[#F5F7FC] border border-[#E1E7EF]">ID: {profile.id}</span>
              <span className="px-2.5 py-1.5 rounded-lg bg-[#F5F7FC] border border-[#E1E7EF]">Bib: {profile.bib}</span>
              <span className="px-2.5 py-1.5 rounded-lg bg-[#F5F7FC] border border-[#E1E7EF]">{profile.classGrade} · Division {profile.division}</span>
            </div>
          </div>
          <button type="button" onClick={() => setIdOpen(true)}
            className="inline-flex items-center justify-center gap-2 bg-[#2563EB] text-white rounded-xl px-5 py-3 text-sm font-bold hover:bg-[#1D4ED8]">
            <IdCard className="w-5 h-5" /> My Digital ID Card
          </button>
        </section>

        <section className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          {summaryCards.map(({ label, value, icon: Icon }) => (
            <div key={label} className="rounded-xl border border-[#E1E7EF] bg-white p-5">
              <div className="w-9 h-9 rounded-lg bg-[#EFF6FF] text-[#2563EB] flex items-center justify-center mb-3"><Icon className="w-5 h-5" /></div>
              <p className="text-3xl font-black text-[#111827]">{value}</p>
              <p className="text-xs text-[#526070] mt-1">{label}</p>
            </div>
          ))}
        </section>

        <div className="rounded-xl border border-blue-200 bg-blue-50 px-5 py-4 flex items-start gap-3">
          <CheckCircle2 className="w-5 h-5 shrink-0 text-[#2563EB]" />
          <p className="text-xs leading-relaxed text-blue-900">
            Individual points come from <strong>published SOLO results only</strong>.
            Group competition awards count toward the team championship and never increase your individual points.
            Unpublished scores remain confidential.
          </p>
        </div>

        <section className="bg-white rounded-2xl border border-[#E1E7EF] overflow-hidden">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between p-5 border-b border-[#E1E7EF] gap-3">
            <div>
              <h2 className="text-lg font-extrabold text-[#111827]">My Competitions & Results</h2>
              <p className="text-xs text-[#526070] mt-1">Events assigned to your participant record; only officially published marks are shown.</p>
            </div>
            <button onClick={() => void refresh()} className="px-3 py-2 border border-[#E1E7EF] rounded-lg text-xs font-semibold text-[#2563EB]">Refresh Results</button>
          </div>
          {events.length ? (
            <div className="divide-y divide-[#E1E7EF]">
              {events.map(event => (
                <article key={event.registrationId} className="p-5 flex flex-col md:flex-row md:items-center justify-between gap-4">
                  <div className="min-w-0">
                    <div className="flex flex-wrap gap-2 items-center">
                      <span className="text-xs font-mono text-[#2563EB] font-bold">{event.code}</span>
                      <span className={'text-[10px] font-bold px-2 py-1 rounded-full ' +
                        (event.type === 'SOLO' ? 'bg-blue-50 text-blue-800' : 'bg-purple-50 text-purple-800')}>
                        {event.type === 'SOLO' ? 'SOLO' : 'GROUP · Team points only'}
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
                  <div className="md:text-right shrink-0">
                    {event.published ? (
                      <>
                        <p className="text-sm font-black text-[#111827]">{event.score ?? '—'} marks · Grade {event.grade || '—'}</p>
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
            <div className="py-14 text-center text-sm text-[#526070]">
              No registrations are linked to this Participant ID yet. Contact your Team Manager.
            </div>
          )}
        </section>
        <p className="text-xs text-[#64748B] text-center">This is a read-only participant workspace. Competition registration is managed by the authorized Team Manager.</p>
      </main>
      <DigitalIdCard participant={cardParticipant} isOpen={idOpen} onClose={() => setIdOpen(false)} authMode="participant" />
    </div>
  );
}
