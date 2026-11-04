'use client';

import React, { useState, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useFest } from '@/context/FestContext';
import { FestivalLogo, FestivalStatusBadge } from '@/components/domain/FestivalBrand';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { ShieldCheck, Lock, Key, ArrowRight, AlertCircle } from 'lucide-react';
import Link from 'next/link';

function JudgeLoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { competitions, theme } = useFest();

  const urlCode = searchParams.get('code') || '';
  const urlSecret = searchParams.get('token') || '';
  const urlCompId = searchParams.get('competitionId') || '';
  const assignedCompetition = competitions.find((competition) => competition.id === urlCompId);

  const [accessCode, setAccessCode] = useState(urlCode);
  const [sessionSecret, setSessionSecret] = useState(urlSecret);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    const cleanCode = accessCode.trim().toUpperCase();
    if (!cleanCode) {
      setError('Please provide your assigned Juror Access Code (e.g. JRY-4101).');
      return;
    }

    setLoading(true);

    try {
      // 1. Authenticate via Server API against Firestore
      const res = await fetch('/api/judge/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          accessCode: cleanCode,
          secret: sessionSecret
        })
      });

      if (res.ok) {
        const data = await res.json();
        if (typeof window !== 'undefined') {
          sessionStorage.setItem('judge_session', JSON.stringify({
            assignment: data.assignment,
            competition: data.competition,
            registrations: data.registrations || [],
            secret: sessionSecret || ''
          }));
        }
        setLoading(false);
        router.push(`/judge/marking?assignmentId=${data.assignment.id}&competitionId=${data.assignment.competitionId}`);
        return;
      }

      // If server returned a specific error (like REVOKED, EXPIRED, MISMATCH, or BAD_SECRET)
      const errData = await res.json().catch(() => null);
      setError(errData?.error || 'Authentication failed. Please verify your Access Code and PIN.');
      setLoading(false);
    } catch {
      setError('Connection error. Please check your network or contact fest conveners.');
      setLoading(false);
    }
  };

  return (
    <section className="rounded-3xl border border-slate-200/90 bg-white p-5 shadow-[0_20px_60px_-28px_rgba(15,23,42,0.24)] sm:p-8">
      <div className="mb-6">
        <p className="text-sm font-semibold text-slate-900">Judge authentication</p>
        <p className="mt-1 text-xs leading-5 text-slate-500">Enter the official credentials issued by the fest convener.</p>
      </div>

      {error && (
        <div role="alert" className="mb-5 flex items-start gap-2.5 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm leading-5 text-red-700">
          <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      <form className="space-y-5" onSubmit={handleSubmit}>
        <div className="rounded-2xl border border-violet-100 bg-violet-50/70 px-4 py-4 sm:px-5">
          <p className="text-[11px] font-bold uppercase tracking-[0.14em] text-violet-700">Assigned Stage Competition</p>
          <p className="mt-1.5 text-sm font-semibold leading-5 text-slate-900">
            {assignedCompetition ? assignedCompetition.name : "Automatically linked to your access code"}
          </p>
          <p className="mt-1.5 text-xs leading-5 text-slate-600">
            {assignedCompetition ? `${assignedCompetition.code} · ${assignedCompetition.categoryName || "Assigned stage competition"}` : "Your assigned competition is verified securely from your official Juror Access Code. No manual selection is required."}
          </p>
        </div>

        <Input
          label="Official Juror Access Code"
          value={accessCode}
          onChange={(e) => setAccessCode(e.target.value)}
          required
          placeholder="JRY-XXXX (e.g. JRY-4101)"
          leftIcon={<Key className="h-4 w-4" />}
          helperText="Provided via official WhatsApp dispatch by the fest convener."
          className="!min-h-[50px] !rounded-xl !border-slate-300 !text-sm focus:!border-violet-600 focus:!ring-2 focus:!ring-violet-100"
        />

        <Input
          label="Juror Confidential Session Secret (PIN)"
          type="password"
          autoComplete="current-password"
          value={sessionSecret}
          onChange={(e) => setSessionSecret(e.target.value)}
          placeholder="Enter your one-time PIN"
          leftIcon={<Lock className="h-4 w-4" />}
          helperText="Keep this verification credential confidential."
          className="!min-h-[50px] !rounded-xl !border-slate-300 !text-sm focus:!border-violet-600 focus:!ring-2 focus:!ring-violet-100"
        />

        <Button
          type="submit"
          variant="primary"
          size="lg"
          className="mt-1 w-full !min-h-[52px] !rounded-xl !bg-slate-900 !font-semibold shadow-sm shadow-slate-900/10 hover:!bg-slate-800 focus:!ring-slate-700"
          isLoading={loading}
          rightIcon={<ArrowRight className="h-4 w-4" />}
        >
          Authenticate Jury Session
        </Button>
      </form>

      <div className="mt-6 flex items-start gap-2.5 rounded-xl bg-slate-50 px-3.5 py-3 text-xs leading-5 text-slate-600">
        <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-slate-700" />
        <span>Access is restricted to your assigned judging session.</span>
      </div>
    </section>
  );
}

export default function JudgeLoginPage() {
  const { theme } = useFest();

  return (
    <main className="flex min-h-dvh items-center justify-center bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-violet-50 via-slate-50 to-white px-4 py-8 sm:px-6 sm:py-12">
      <div className="w-full max-w-[440px]">
        <header className="mb-7 text-center">
          <div className="mb-4 flex justify-center"><FestivalLogo size={52} /></div>
          <h1 className="text-[25px] font-bold tracking-tight text-slate-950 sm:text-[28px]">Secure Jury Access</h1>
          <p className="mt-2 text-[13px] leading-5 text-slate-600">
            <span className="festival-name font-semibold text-slate-800">{theme.festivalName}</span>
            <span className="px-1.5 text-slate-300">·</span>
            Adjudicator Session Portal
          </p>
          <div className="mt-4 flex justify-center"><FestivalStatusBadge /></div>
        </header>

        <Suspense fallback={<div className="rounded-3xl border border-slate-200 bg-white p-8 text-center text-sm text-slate-500 shadow-sm">Loading jury credentials...</div>}>
          <JudgeLoginForm />
        </Suspense>

        <footer className="mt-6 text-center text-xs text-slate-500">
          <span>Need convener assistance? </span>
          <Link href="/" className="font-semibold text-violet-700 underline-offset-4 transition hover:text-violet-800 hover:underline">Public Website</Link>
        </footer>
      </div>
    </main>
  );
}