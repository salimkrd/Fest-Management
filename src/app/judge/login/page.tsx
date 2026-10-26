'use client';

import React, { useState, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useFest } from '@/context/FestContext';
import { FestivalLogo, FestivalStatusBadge } from '@/components/domain/FestivalBrand';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Select } from '@/components/ui/Select';
import { ShieldCheck, Lock, Key, ArrowRight, AlertCircle, Gavel } from 'lucide-react';
import Link from 'next/link';

function JudgeLoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { competitions, markEntries, theme } = useFest();

  const urlCode = searchParams.get('code') || '';
  const urlSecret = searchParams.get('token') || '';
  const urlCompId = searchParams.get('competitionId') || '';

  const [accessCode, setAccessCode] = useState(urlCode);
  const [sessionSecret, setSessionSecret] = useState(urlSecret);
  const [competitionId, setCompetitionId] = useState(urlCompId || competitions[0]?.id || '');
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
          competitionId,
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
    <div className="bg-white py-8 px-6 shadow-xs rounded-2xl border border-[#E1E7EF] sm:px-10">
      {error && (
        <div className="mb-6 p-3 rounded-lg bg-red-50 border border-red-200 text-xs text-[#DC2626] flex items-center gap-2">
          <AlertCircle className="w-4 h-4 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      <form className="space-y-5" onSubmit={handleSubmit}>
        <div>
          <Select
            label="Assigned Stage Competition"
            value={competitionId}
            onChange={(e) => setCompetitionId(e.target.value)}
            options={competitions.map(c => ({
              value: c.id,
              label: `${c.name} (${c.code} - ${c.categoryName})`
            }))}
          />
        </div>

        <div>
          <Input
            label="Official Juror Access Code"
            value={accessCode}
            onChange={(e) => setAccessCode(e.target.value)}
            required
            placeholder="JRY-XXXX (e.g. JRY-4101)"
            leftIcon={<Key className="w-4 h-4" />}
            helperText="Provided via official WhatsApp dispatch by the fest convener"
          />
        </div>

        <div>
          <Input
            label="Juror Confidential Session Secret (PIN)"
            type="password"
            value={sessionSecret}
            onChange={(e) => setSessionSecret(e.target.value)}
            placeholder="Enter one-time secret or PIN"
            leftIcon={<Lock className="w-4 h-4" />}
            helperText="Confidential verification credential"
          />
        </div>

        <div>
          <Button
            type="submit"
            variant="primary"
            size="md"
            className="w-full font-bold bg-[#111111] hover:bg-neutral-800"
            isLoading={loading}
            rightIcon={<ArrowRight className="w-4 h-4" />}
          >
            Authenticate Jury Session
          </Button>
        </div>
      </form>

      <div className="mt-6 pt-6 border-t border-[#E1E7EF] text-center">
        <div className="inline-flex items-center gap-1.5 text-[11px] text-[#526070] font-medium bg-[#F8FAFC] px-3 py-1 rounded-full border border-[#E1E7EF]">
          <ShieldCheck className="w-3.5 h-3.5 text-neutral-800" />
          <span>Assignment-Bound Cryptographic Authentication</span>
        </div>
      </div>
    </div>
  );
}

export default function JudgeLoginPage() {
  const { theme } = useFest();

  return (
    <div className="min-h-screen bg-[#F8FAFC] flex flex-col justify-center py-12 sm:px-6 lg:px-8">
      <div className="sm:mx-auto sm:w-full sm:max-w-md">
        <div className="flex justify-center">
          <FestivalLogo size={48} />
        </div>

        <h2 className="mt-4 text-center text-2xl font-bold tracking-tight text-[#111111]">
          Secure Jury Access
        </h2>
        <p className="mt-1 text-center text-xs text-[#526070]">
          {theme.festivalName} · Adjudicator Session Portal
        </p>
        <div className="mt-3 flex justify-center"><FestivalStatusBadge /></div>
      </div>

      <div className="mt-8 sm:mx-auto sm:w-full sm:max-w-md px-4 sm:px-0">
        <Suspense fallback={<div className="bg-white p-8 rounded-2xl border text-center text-xs text-[#526070]">Loading jury credentials...</div>}>
          <JudgeLoginForm />
        </Suspense>

        <div className="mt-6 text-center text-xs text-[#526070]">
          <span>Need convener assistance? </span>
          <Link href="/" className="text-[#2563EB] font-bold hover:underline">
            Return to Public Results Portal
          </Link>
        </div>
      </div>
    </div>
  );
}
