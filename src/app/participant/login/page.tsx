'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { CalendarDays, IdCard, LogIn, ArrowLeft, ShieldCheck } from 'lucide-react';

export default function ParticipantLoginPage() {
  const router = useRouter();
  const [participantId, setParticipantId] = useState('');
  const [dob, setDob] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  const handleLogin = async (event: React.FormEvent) => {
    event.preventDefault();
    setSubmitting(true);
    setError('');
    try {
      const response = await fetch('/api/participant/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'same-origin',
        cache: 'no-store',
        body: JSON.stringify({ participantId: participantId.trim(), dob })
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data.error || 'Sign in failed.');
      router.replace('/participant');
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to sign in.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#F5F7FC] flex items-center justify-center px-4 py-12">
      <div className="w-full max-w-md">
        <Link href="/" className="inline-flex items-center gap-1.5 text-xs text-[#526070] hover:text-[#2563EB] mb-5">
          <ArrowLeft className="w-4 h-4" /> Back to Festival Home
        </Link>
        <div className="rounded-2xl bg-white border border-[#E1E7EF] shadow-sm overflow-hidden">
          <div className="bg-[#225DEE] text-white px-7 py-7">
            <div className="flex items-center gap-2.5 mb-5">
              <div className="w-11 h-11 rounded-xl bg-white/20 flex items-center justify-center"><IdCard className="w-6 h-6" /></div>
              <div>
                <p className="text-xs font-semibold text-blue-100">INSPIRATH · Participant Portal</p>
                <h1 className="text-2xl font-extrabold tracking-tight">Participant Login</h1>
              </div>
            </div>
            <p className="text-sm text-blue-50">Access your competition schedule, published scores, individual points, and verified digital ID card.</p>
          </div>
          <form className="p-7 space-y-5" onSubmit={handleLogin}>
            <div>
              <label htmlFor="participant-id" className="block text-sm font-bold text-[#111827] mb-2">Participant ID</label>
              <div className="relative">
                <IdCard className="w-4 h-4 text-[#526070] absolute left-3 top-3.5" />
                <input id="participant-id" name="participantId" type="text" required
                  autoComplete="username" maxLength={110} value={participantId}
                  onChange={e => setParticipantId(e.target.value)}
                  placeholder="Enter your complete Participant ID"
                  className="w-full border border-[#CBD5E1] bg-white rounded-lg text-sm p-3 pl-10 text-[#111827] focus:ring-2 focus:ring-[#2563EB] outline-none" />
              </div>
              <p className="text-xs text-[#64748B] mt-1">Use the Participant ID on your official Digital ID Card, not the short Bib number.</p>
            </div>
            <div>
              <label htmlFor="participant-dob" className="block text-sm font-bold text-[#111827] mb-2">Date of Birth</label>
              <div className="relative">
                <CalendarDays className="w-4 h-4 text-[#526070] absolute left-3 top-3.5" />
                <input id="participant-dob" name="dob" type="date" required
                  autoComplete="bday" value={dob} onChange={e => setDob(e.target.value)}
                  className="w-full border border-[#CBD5E1] bg-white rounded-lg text-sm p-3 pl-10 text-[#111827] focus:ring-2 focus:ring-[#2563EB] outline-none" />
              </div>
            </div>
            {error && <p role="alert" className="text-xs bg-red-50 border border-red-200 text-red-700 rounded-lg px-4 py-3">{error}</p>}
            <button type="submit" disabled={!participantId.trim() || !dob || submitting}
              className="w-full rounded-lg bg-[#2563EB] disabled:opacity-60 text-white text-sm font-bold py-3 flex items-center justify-center gap-2 hover:bg-[#1D4ED8] transition-colors">
              <LogIn className="w-4 h-4" /> {submitting ? 'Signing In...' : 'Sign In to My Portal'}
            </button>
            <p className="flex items-start gap-2 text-xs text-[#64748B] leading-relaxed">
              <ShieldCheck className="w-4 h-4 mt-0.5 shrink-0" />
              Only information belonging to the signed-in participant is accessible. Ask your Team Manager if your ID or registered birth date is incorrect.
            </p>
          </form>
        </div>
      </div>
    </div>
  );
}
