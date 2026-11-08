'use client';

import React, { Suspense, useEffect, useState } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { JudgeLayout } from '@/components/layout/JudgeLayout';
import { useFest } from '@/context/FestContext';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { CheckCircle2, Download, FileCheck2, Printer, ShieldCheck } from 'lucide-react';

interface ReceiptContestant {
  codeLetter: string;
  codeIndex: number;
}

interface VerifiedReceipt {
  verificationHash: string;
  submittedAt: string;
  marksRecorded: number;
  competition: {
    id: string;
    code: string;
    name: string;
    categoryName: string;
    type: string;
    stageName: string;
  };
  contestants: ReceiptContestant[];
}

interface StoredJudgeSession {
  secret?: string;
  assignment?: { id?: string; competitionId?: string };
}

function readStoredSession(): StoredJudgeSession | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = window.sessionStorage.getItem('judge_session');
    return raw ? JSON.parse(raw) as StoredJudgeSession : null;
  } catch {
    return null;
  }
}

function formatSubmittedAt(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return 'Time unavailable';
  return new Intl.DateTimeFormat('en-IN', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    timeZoneName: 'short'
  }).format(date);
}

function ConfirmationContent() {
  const searchParams = useSearchParams();
  const { theme } = useFest();
  const [sessionData] = useState<StoredJudgeSession | null>(readStoredSession);
  const assignmentId = searchParams.get('assignmentId') || sessionData?.assignment?.id || '';
  const competitionId = searchParams.get('competitionId') || sessionData?.assignment?.competitionId || '';
  const verificationHash = searchParams.get('hash') || '';
  const secret = sessionData?.secret || '';

  const [receipt, setReceipt] = useState<VerifiedReceipt | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    let active = true;
    const loadReceipt = async () => {
      if (!assignmentId || !competitionId || !verificationHash || !secret) {
        setError('The secure receipt details are missing. Open this page from the completed judge submission on the same browser.');
        setLoading(false);
        return;
      }
      setLoading(true);
      setError('');
      try {
        const response = await fetch('/api/judge/confirmation', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          cache: 'no-store',
          credentials: 'same-origin',
          body: JSON.stringify({ assignmentId, competitionId, secret, verificationHash })
        });
        const result = await response.json().catch(() => ({}));
        if (!response.ok) throw new Error(result.error || 'The official receipt could not be verified.');
        if (active) setReceipt(result as VerifiedReceipt);
      } catch (cause) {
        if (active) setError(cause instanceof Error ? cause.message : 'The official receipt could not be loaded.');
      } finally {
        if (active) setLoading(false);
      }
    };
    void loadReceipt();
    return () => { active = false; };
  }, [assignmentId, competitionId, verificationHash, secret]);

  const downloadReceiptPdf = () => {
    window.print();
  };

  return (
    <JudgeLayout competitionTitle={receipt?.competition.name || 'Submission receipt'} isLocked={true}>
      <div className="mx-auto w-full max-w-4xl space-y-5 pb-8 sm:space-y-6">
        {loading && (
          <div className="rounded-2xl border border-slate-200 bg-white px-5 py-16 text-center shadow-sm">
            <div className="mx-auto mb-3 h-8 w-8 animate-spin rounded-full border-2 border-emerald-600 border-t-transparent" />
            <p className="text-sm font-bold text-slate-900">Verifying official submission</p>
            <p className="mt-1 text-xs text-slate-500">Checking the signed scorecard and digital verification hash.</p>
          </div>
        )}

        {!loading && error && (
          <div role="alert" className="rounded-2xl border border-red-200 bg-white p-5 shadow-sm sm:p-6">
            <div className="flex items-start gap-3">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-red-50 text-red-600"><FileCheck2 className="h-5 w-5" /></div>
              <div className="min-w-0">
                <h1 className="text-base font-extrabold text-slate-950">Receipt verification failed</h1>
                <p className="mt-1 text-xs leading-5 text-red-700">{error}</p>
                <Link href="/judge/login" className="mt-4 inline-flex"><Button variant="outline" size="sm">Return to Judge Login</Button></Link>
              </div>
            </div>
          </div>
        )}

        {!loading && receipt && (
          <>
            <div className="no-print flex flex-col gap-3 rounded-xl border border-emerald-200 bg-emerald-50/80 p-3.5 sm:flex-row sm:items-center sm:justify-between sm:p-4">
              <div className="flex items-start gap-2.5">
                <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0 text-emerald-700" />
                <div><p className="text-sm font-bold text-emerald-950">Submission verified successfully</p><p className="mt-0.5 text-xs leading-5 text-emerald-800">The receipt matches the finalized scorecard stored by the judging service.</p></div>
              </div>
              <Button variant="primary" size="md" className="w-full bg-slate-950 hover:bg-slate-800 sm:w-auto" leftIcon={<Download className="h-4 w-4" />} onClick={downloadReceiptPdf}>
                Print / Save PDF
              </Button>
            </div>

            <div className="judge-receipt-print space-y-5 sm:space-y-6">
              <section className="rounded-2xl border border-slate-200 bg-white p-5 text-center shadow-sm sm:p-8">
                <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl border border-emerald-200 bg-emerald-50 text-emerald-700 sm:h-16 sm:w-16">
                  <CheckCircle2 className="h-8 w-8 sm:h-9 sm:w-9" />
                </div>
                <div className="mt-4 text-center">
                  {theme.logoUrl && <img src={theme.logoUrl} alt="" className="mx-auto mb-3 hidden h-12 max-w-[180px] object-contain print:block" />}
                  <p className="text-[11px] font-extrabold uppercase tracking-[0.18em] text-slate-500">{theme.festivalName || 'Official Festival'}</p>
                  <p className="mt-1 text-xs font-medium text-slate-500">{theme.institutionName}</p>
                </div>
                <Badge variant="success" size="md" className="mt-4">EVALUATION OFFICIALLY SEALED</Badge>
                <h1 className="mt-3 text-2xl font-black tracking-tight text-slate-950 sm:text-3xl">Official Adjudication Receipt</h1>
                <p className="mx-auto mt-2 max-w-2xl text-xs leading-5 text-slate-600 sm:text-sm">
                  The anonymous scorecard for <strong className="text-slate-950">{receipt.competition.name}</strong> has been finalized, cryptographically verified and archived.
                </p>

                <div className="mt-6 grid grid-cols-1 gap-3 rounded-xl border border-slate-200 bg-slate-50 p-3.5 text-left sm:grid-cols-3 sm:p-4">
                  <div className="min-w-0"><span className="block text-[10px] font-bold uppercase tracking-wide text-slate-500">Submission time</span><span className="mt-1 block text-xs font-bold leading-5 text-slate-950">{formatSubmittedAt(receipt.submittedAt)}</span></div>
                  <div className="min-w-0"><span className="block text-[10px] font-bold uppercase tracking-wide text-slate-500">Contestants evaluated</span><span className="mt-1 block text-xs font-bold leading-5 text-slate-950">{receipt.marksRecorded} anonymous codes</span></div>
                  <div className="min-w-0"><span className="block text-[10px] font-bold uppercase tracking-wide text-slate-500">Receipt status</span><span className="mt-1 block text-xs font-bold leading-5 text-emerald-700">Verified &amp; locked</span></div>
                </div>
              </section>

              <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
                <header className="flex flex-col gap-2 border-b border-slate-200 px-4 py-4 sm:flex-row sm:items-center sm:justify-between sm:px-5">
                  <div className="flex items-center gap-2.5">
                    <ShieldCheck className="h-5 w-5 text-emerald-700" />
                    <div><h2 className="text-sm font-extrabold text-slate-950">Anonymous Evaluation Register</h2><p className="mt-0.5 text-[11px] text-slate-500">{receipt.competition.code} · {receipt.competition.categoryName} · {receipt.competition.stageName}</p></div>
                  </div>
                  <Badge variant="success" size="sm">LOCKED &amp; ARCHIVED</Badge>
                </header>

                {receipt.contestants.length === 0 ? (
                  <div className="px-4 py-8 text-center text-xs text-slate-500">The scorecard was verified, but the archived anonymous code list is unavailable.</div>
                ) : (
                  <>
                    <div className="divide-y divide-slate-100 md:hidden judge-receipt-mobile">
                      {receipt.contestants.map(contestant => (
                        <div key={contestant.codeLetter} className="flex items-center justify-between gap-3 px-4 py-3">
                          <div className="flex min-w-0 items-center gap-3">
                            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-blue-600 font-mono text-base font-black text-white">{contestant.codeLetter}</span>
                            <div><p className="text-xs font-bold text-slate-950">Code {contestant.codeLetter}</p><p className="text-[10px] text-slate-500">Stage entry #{contestant.codeIndex + 1}</p></div>
                          </div>
                          <Badge variant="success" size="sm"><CheckCircle2 className="mr-1 h-3 w-3" /> Sealed</Badge>
                        </div>
                      ))}
                    </div>
                    <div className="hidden overflow-x-auto md:block judge-receipt-table">
                      <table className="w-full min-w-[640px] text-left text-xs">
                        <thead><tr className="border-b border-slate-200 bg-slate-50 text-[10px] font-bold uppercase tracking-wide text-slate-500">
                          <th className="px-5 py-3">Code letter</th><th className="px-5 py-3">Appearance order</th><th className="px-5 py-3 text-center">Scorecard state</th><th className="px-5 py-3 text-right">Lock state</th>
                        </tr></thead>
                        <tbody className="divide-y divide-slate-100">
                          {receipt.contestants.map(contestant => (
                            <tr key={contestant.codeLetter}>
                              <td className="px-5 py-3"><span className="inline-flex h-8 min-w-8 items-center justify-center rounded-lg bg-blue-600 px-2 font-mono text-sm font-black text-white">{contestant.codeLetter}</span></td>
                              <td className="px-5 py-3 font-semibold text-slate-900">Stage entry #{contestant.codeIndex + 1}</td>
                              <td className="px-5 py-3 text-center text-slate-500">Cryptographically recorded</td>
                              <td className="px-5 py-3 text-right font-bold text-emerald-700">Sealed</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </>
                )}
              </section>

              <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:p-5">
                <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                  <div><p className="text-[10px] font-bold uppercase tracking-wide text-slate-500">Digital verification hash · SHA-256</p><p className="mt-1 break-all font-mono text-[10px] leading-5 text-slate-800 sm:text-xs">{receipt.verificationHash}</p></div>
                  <Badge variant="success" size="sm" className="self-start">HASH MATCHED</Badge>
                </div>
              </section>

              <footer className="flex flex-col gap-1 border-t border-slate-200 pt-4 text-center text-[10px] leading-4 text-slate-500 sm:flex-row sm:items-center sm:justify-between sm:text-left">
                <span>System-generated receipt · No contestant names or personal information are included.</span>
                <span>Keep this receipt for your records.</span>
              </footer>
            </div>

            <div className="no-print flex flex-col gap-2 pt-1 sm:flex-row sm:items-center sm:justify-between">
              <Link href="/judge/login"><Button variant="outline" size="md" className="w-full sm:w-auto">Return to Judge Login</Button></Link>
              <Button variant="primary" size="md" className="w-full bg-slate-950 hover:bg-slate-800 sm:w-auto" leftIcon={<Printer className="h-4 w-4" />} onClick={downloadReceiptPdf}>Print / Save Receipt PDF</Button>
            </div>
          </>
        )}
      </div>
    </JudgeLayout>
  );
}

export default function JudgeConfirmationPage() {
  return (
    <Suspense fallback={<div className="mx-auto max-w-lg px-4 py-16 text-center text-sm text-slate-500">Loading secure submission receipt…</div>}>
      <ConfirmationContent />
    </Suspense>
  );
}
