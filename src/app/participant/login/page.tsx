'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { CalendarDays, IdCard, LogIn, ArrowLeft, ShieldCheck } from 'lucide-react';
import { useFest } from '@/context/FestContext';
import { FestivalLogo, FestivalStatusBadge } from '@/components/domain/FestivalBrand';

export default function ParticipantLoginPage() {
  const router = useRouter();
  const { theme, themeSyncState } = useFest();
  const [bib, setBib] = useState('');
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
        body: JSON.stringify({ bib: bib.trim(), dob })
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
    <main className="flex min-h-dvh items-center justify-center bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-blue-50 via-slate-50 to-white px-4 py-6 sm:px-6 sm:py-10">
      <div className="w-full max-w-[440px]">
        <div className="mb-5 flex items-center justify-between gap-3">
          <Link href="/" className="inline-flex min-h-9 items-center gap-1.5 rounded-lg text-xs font-semibold text-slate-600 transition hover:text-blue-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500">
            <ArrowLeft className="h-4 w-4" />
            Festival Home
          </Link>
          <FestivalStatusBadge />
        </div>

        <section className="overflow-hidden rounded-3xl border border-slate-200/90 bg-white shadow-[0_20px_60px_-28px_rgba(15,23,42,0.24)]">
          <header className="bg-gradient-to-br from-blue-700 to-blue-600 px-5 py-6 text-white sm:px-8 sm:py-7">
            <div className="mb-5 flex items-center gap-3">
              <FestivalLogo size={48} className="border border-white/20" />
              <div className="min-w-0">
                <p className="truncate text-xs font-semibold text-blue-100">
                  <span className="festival-name">{theme.festivalName || (themeSyncState === 'loading' ? 'Loading festival…' : 'Festival name unavailable')}</span> · Participant Portal
                </p>
                <h1 className="mt-1 text-2xl font-bold tracking-tight">Participant Login</h1>
              </div>
            </div>
            <p className="max-w-sm text-[13px] leading-5 text-blue-50">
              Sign in to view your competition schedule, published results and digital ID card.
            </p>
          </header>

          <form className="space-y-5 p-5 sm:p-8" onSubmit={handleLogin}>
            <div>
              <label htmlFor="participant-bib" className="mb-2 block text-xs font-semibold uppercase tracking-[0.08em] text-slate-700">Bib Number <span className="text-red-600">*</span></label>
              <div className="relative">
                <IdCard className="absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500" />
                <input
                  id="participant-bib"
                  name="bib"
                  type="text"
                  required
                  inputMode="numeric"
                  autoComplete="username"
                  maxLength={10}
                  value={bib}
                  onChange={e => setBib(e.target.value)}
                  placeholder="e.g. 1042 or #1042"
                  className="min-h-[50px] w-full rounded-xl border border-slate-300 bg-white py-3 pl-10 pr-3 text-sm text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-blue-600 focus:ring-2 focus:ring-blue-100"
                />
              </div>
              <p className="mt-1.5 text-xs leading-5 text-slate-500">Enter the short Bib Number printed on your Digital ID Card. Both 1042 and #1042 work.</p>
            </div>

            <div>
              <label htmlFor="participant-dob" className="mb-2 block text-xs font-semibold uppercase tracking-[0.08em] text-slate-700">Date of Birth <span className="text-red-600">*</span></label>
              <div className="relative">
                <CalendarDays className="absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500" />
                <input
                  id="participant-dob"
                  name="dob"
                  type="date"
                  required
                  autoComplete="bday"
                  value={dob}
                  onChange={e => setDob(e.target.value)}
                  className="min-h-[50px] w-full rounded-xl border border-slate-300 bg-white py-3 pl-10 pr-3 text-sm text-slate-900 outline-none transition focus:border-blue-600 focus:ring-2 focus:ring-blue-100"
                />
              </div>
            </div>

            {error && (
              <p role="alert" className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm leading-5 text-red-700">{error}</p>
            )}

            <button
              type="submit"
              disabled={!bib.trim() || !dob || submitting}
              className="flex min-h-[52px] w-full items-center justify-center gap-2 rounded-xl bg-blue-700 px-5 py-3 text-sm font-semibold text-white shadow-sm shadow-blue-900/10 transition hover:bg-blue-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-600 focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {submitting ? (
                <span className="h-4 w-4 animate-spin rounded-full border-2 border-white/40 border-t-white" />
              ) : (
                <LogIn className="h-4 w-4" />
              )}
              {submitting ? 'Signing In...' : 'Sign In to My Portal'}
            </button>

            <div className="flex items-start gap-2.5 rounded-xl bg-slate-50 px-3.5 py-3 text-xs leading-5 text-slate-600">
              <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-blue-700" />
              <span>Only information belonging to the signed-in participant is accessible. Ask your Team Manager if your Bib Number or registered Date of Birth is incorrect.</span>
            </div>
          </form>
        </section>
      </div>
    </main>
  );
}