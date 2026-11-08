'use client';

import React, { Suspense, useCallback, useEffect, useMemo, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { JudgeLayout } from '@/components/layout/JudgeLayout';
import { calculateGrade } from '@/domain/scoring';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { Modal } from '@/components/ui/Modal';
import {
  AlertCircle,
  AlertTriangle,
  CheckCircle2,
  Clock,
  Gavel,
  Minus,
  Plus,
  RefreshCw,
  Save,
  Send,
  ShieldCheck,
  Users
} from 'lucide-react';

interface Criterion {
  id: string;
  name: string;
  maxMarks: number;
}

interface AnonymousContestant {
  codeLetter: string;
  codeIndex: number;
  status: string;
}

interface CompetitionSession {
  id: string;
  code: string;
  name: string;
  categoryName: string;
  type: string;
  stageName: string;
  criteria: Criterion[];
}

interface StoredJudgeSession {
  secret?: string;
  assignment?: { id?: string; competitionId?: string };
  competition?: CompetitionSession;
}

type LocalScores = Record<string, Record<string, number>>;

function readStoredSession(): StoredJudgeSession | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = window.sessionStorage.getItem('judge_session');
    return raw ? JSON.parse(raw) as StoredJudgeSession : null;
  } catch {
    return null;
  }
}

function JudgeMarkingContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [sessionData] = useState<StoredJudgeSession | null>(readStoredSession);

  const assignmentId = searchParams.get('assignmentId') || sessionData?.assignment?.id || '';
  const competitionId = searchParams.get('competitionId') || sessionData?.assignment?.competitionId || '';
  const secret = sessionData?.secret || '';

  const [competition, setCompetition] = useState<CompetitionSession | null>(null);
  const [contestants, setContestants] = useState<AnonymousContestant[]>([]);
  const [criteria, setCriteria] = useState<Criterion[]>([]);
  const [scores, setScores] = useState<LocalScores>({});
  const [remarks, setRemarks] = useState('');
  const [syncState, setSyncState] = useState<'loading' | 'ready' | 'error'>('loading');
  const [refreshing, setRefreshing] = useState(false);
  const [savingDraft, setSavingDraft] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [confirmModalOpen, setConfirmModalOpen] = useState(false);
  const [draftSavedNotice, setDraftSavedNotice] = useState(false);
  const [draftSavedAt, setDraftSavedAt] = useState('');
  const [staleDraft, setStaleDraft] = useState(false);
  const [isDirty, setIsDirty] = useState(false);
  const [sessionError, setSessionError] = useState('');
  const [submissionError, setSubmissionError] = useState('');

  const loadSession = useCallback(async () => {
    if (!assignmentId || !competitionId || !secret) {
      setSyncState('error');
      setSessionError('Your secure judge session is missing or expired. Return to Judge Login and authenticate again.');
      return;
    }

    setRefreshing(true);
    setSyncState('loading');
    setSessionError('');
    setSubmissionError('');

    try {
      const response = await fetch('/api/judge/session', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        cache: 'no-store',
        credentials: 'same-origin',
        body: JSON.stringify({ assignmentId, competitionId, secret })
      });
      const result = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(result.error || 'Could not load your assigned judging session.');

      if (result.isSubmitted) {
        const params = new URLSearchParams({
          assignmentId,
          competitionId,
          hash: result.verificationHash || ''
        });
        router.replace(`/judge/confirmation?${params.toString()}`);
        return;
      }

      const nextCriteria = Array.isArray(result.competition?.criteria)
        ? result.competition.criteria as Criterion[]
        : [];
      const nextContestants = Array.isArray(result.contestants)
        ? result.contestants as AnonymousContestant[]
        : [];
      const nextScores: LocalScores = {};

      nextContestants.forEach(contestant => {
        nextScores[contestant.codeLetter] = Object.fromEntries(
          nextCriteria.map(criterion => [criterion.id, 0])
        );
      });

      if (result.scores && typeof result.scores === 'object') {
        Object.entries(result.scores as Record<string, Record<string, number> | number>).forEach(([codeLetter, rawScore]) => {
          if (!nextScores[codeLetter]) return;
          if (typeof rawScore === 'number') return;
          nextScores[codeLetter] = {
            ...nextScores[codeLetter],
            ...Object.fromEntries(
              Object.entries(rawScore || {}).filter(([criterionId, value]) =>
                nextCriteria.some(criterion => criterion.id === criterionId) &&
                typeof value === 'number' && Number.isFinite(value)
              )
            )
          };
        });
      }

      setCompetition(result.competition as CompetitionSession);
      setCriteria(nextCriteria);
      setContestants(nextContestants);
      setScores(nextScores);
      setRemarks(typeof result.draftRemarks === 'string' ? result.draftRemarks : '');
      setDraftSavedAt(typeof result.draftUpdatedAt === 'string' ? result.draftUpdatedAt : '');
      setStaleDraft(Boolean(result.staleDraft));
      setIsDirty(false);
      setSyncState('ready');
    } catch (error) {
      setSyncState('error');
      setSessionError(error instanceof Error ? error.message : 'Could not synchronize your judging session.');
    } finally {
      setRefreshing(false);
    }
  }, [assignmentId, competitionId, secret, router]);

  useEffect(() => {
    void loadSession();
  }, [loadSession]);

  const maxMarksTotal = useMemo(
    () => criteria.reduce((sum, criterion) => sum + criterion.maxMarks, 0),
    [criteria]
  );

  const calculateTotal = (codeLetter: string) => {
    const contestantScores = scores[codeLetter] || {};
    return criteria.reduce((sum, criterion) => sum + (contestantScores[criterion.id] || 0), 0);
  };

  const getGrade = (total: number) => {
    const grade = maxMarksTotal > 0 ? calculateGrade(total, maxMarksTotal) : '—';
    const color = grade === 'A+'
      ? 'border-emerald-200 bg-emerald-50 text-emerald-700'
      : grade === 'A'
        ? 'border-blue-200 bg-blue-50 text-blue-700'
        : grade === 'B' || grade === 'C'
          ? 'border-amber-200 bg-amber-50 text-amber-700'
          : 'border-slate-200 bg-slate-100 text-slate-600';
    return { grade, color };
  };

  const adjustScore = (codeLetter: string, criterionId: string, nextValue: number, max: number) => {
    setScores(previous => ({
      ...previous,
      [codeLetter]: {
        ...previous[codeLetter],
        [criterionId]: Math.max(0, Math.min(max, Math.round(nextValue)))
      }
    }));
    setIsDirty(true);
    setDraftSavedNotice(false);
  };

  const saveMarks = async (action: 'DRAFT' | 'SUBMIT') => {
    if (!assignmentId || !secret || !competition?.id) {
      throw new Error('Your secure judge session is missing. Authenticate again before saving.');
    }
    if (contestants.length === 0 || criteria.length === 0) {
      throw new Error('The current contestant roster or scoring rubric is empty. Refresh the session or contact the administrator.');
    }

    const response = await fetch('/api/judge/marks', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      cache: 'no-store',
      credentials: 'same-origin',
      body: JSON.stringify({
        action,
        assignmentId,
        competitionId: competition.id,
        secret,
        scores,
        remarks
      })
    });
    const result = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(result.error || `Could not ${action.toLowerCase()} the scorecard.`);
    return result;
  };

  const handleSaveDraft = async () => {
    setSavingDraft(true);
    setSubmissionError('');
    setDraftSavedNotice(false);
    try {
      const result = await saveMarks('DRAFT');
      setIsDirty(false);
      setDraftSavedAt(result.updatedAt || new Date().toISOString());
      setDraftSavedNotice(true);
    } catch (error) {
      setSubmissionError(error instanceof Error ? error.message : 'Could not save the draft scorecard.');
    } finally {
      setSavingDraft(false);
    }
  };

  const handleFinalSubmit = async () => {
    if (submitting || savingDraft) return;
    setSubmitting(true);
    setSubmissionError('');
    try {
      const result = await saveMarks('SUBMIT');
      setIsDirty(false);
      setConfirmModalOpen(false);
      const params = new URLSearchParams({
        assignmentId,
        competitionId: competition?.id || competitionId,
        hash: result.verificationHash
      });
      router.push(`/judge/confirmation?${params.toString()}`);
    } catch (error) {
      setSubmissionError(error instanceof Error ? error.message : 'Could not submit the final scorecard.');
      setSubmitting(false);
    }
  };

  const handleRefresh = async () => {
    if (isDirty && !window.confirm('Refreshing reloads the latest Green Room roster and last saved draft. Unsaved score changes will be discarded. Continue?')) {
      return;
    }
    await loadSession();
  };

  const formatSavedAt = (value: string) => {
    if (!value) return '';
    const date = new Date(value);
    return Number.isNaN(date.getTime()) ? '' : date.toLocaleString('en-IN', {
      day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit'
    });
  };

  const isReadyToScore = syncState === 'ready' && contestants.length > 0 && criteria.length > 0 && !submitting;
  const statusText = syncState === 'loading'
    ? 'Syncing assignment'
    : syncState === 'error'
      ? 'Session unavailable'
      : isDirty
        ? 'Unsaved changes'
        : draftSavedAt
          ? `Draft saved ${formatSavedAt(draftSavedAt)}`
          : 'Ready to evaluate';

  return (
    <JudgeLayout competitionTitle={competition?.name || 'Judge Evaluation'}>
      <div className="mx-auto w-full max-w-6xl space-y-5 pb-28 sm:space-y-6 sm:pb-8">
        <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:p-5">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <span className="rounded-md border border-blue-200 bg-blue-50 px-2.5 py-1 font-mono text-[11px] font-bold text-blue-700">
                  {competition?.code || 'ASSIGNED EVENT'}
                </span>
                <Badge variant={syncState === 'ready' ? 'success' : syncState === 'error' ? 'error' : 'warning'} size="sm" dot>
                  {syncState === 'ready' ? 'SESSION VERIFIED' : syncState === 'error' ? 'SYNC ERROR' : 'SYNCING'}
                </Badge>
              </div>
              <h1 className="mt-2 break-words text-lg font-extrabold tracking-tight text-slate-950 sm:text-xl">
                {competition?.name || 'Loading assigned competition…'}
              </h1>
              <p className="mt-1 text-xs leading-5 text-slate-500 sm:text-sm">
                {competition ? `${competition.categoryName} · ${competition.type === 'SOLO' ? 'Individual' : competition.type} · ${competition.stageName}` : 'Only the competition assigned to your secure credential is available.'}
              </p>
            </div>
            <div className="flex w-full flex-col gap-2 sm:flex-row lg:w-auto">
              <Button variant="outline" size="sm" className="w-full sm:w-auto" onClick={handleRefresh} isLoading={refreshing} disabled={refreshing || submitting || savingDraft}>
                <RefreshCw className="mr-1.5 h-4 w-4" /> Refresh roster
              </Button>
              <Button variant="outline" size="sm" className="w-full sm:w-auto" leftIcon={<Save className="h-4 w-4" />} onClick={handleSaveDraft} disabled={!isReadyToScore || savingDraft || submitting} isLoading={savingDraft}>
                Save draft
              </Button>
            </div>
          </div>
          <div className="mt-4 flex flex-col gap-2 border-t border-slate-100 pt-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex min-w-0 items-center gap-2 text-xs text-slate-600">
              <ShieldCheck className="h-4 w-4 shrink-0 text-blue-600" />
              <span>Blind evaluation · Names, photographs and team identities are hidden.</span>
            </div>
            <span className={`text-xs font-semibold ${syncState === 'error' ? 'text-red-700' : isDirty ? 'text-amber-700' : 'text-slate-500'}`}>
              {statusText}
            </span>
          </div>
        </section>

        {staleDraft && (
          <div role="alert" className="flex flex-col gap-2 rounded-xl border border-amber-200 bg-amber-50 p-3.5 text-xs leading-5 text-amber-900 sm:flex-row sm:items-center sm:justify-between">
            <span>The Green Room roster changed after the last saved draft. Only scores that still match an active anonymous code were restored; review every score before continuing.</span>
            <Button variant="outline" size="sm" className="shrink-0" onClick={handleRefresh} disabled={refreshing}>Reload roster</Button>
          </div>
        )}

        {syncState === 'error' && (
          <div role="alert" className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-800">
            <div className="flex items-start gap-2.5">
              <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
              <div className="min-w-0 flex-1">
                <p className="font-bold">Could not load the assigned evaluation session</p>
                <p className="mt-1 text-xs leading-5">{sessionError}</p>
                <div className="mt-3 flex flex-col gap-2 sm:flex-row">
                  <Button size="sm" variant="outline" onClick={loadSession} isLoading={refreshing}>Retry sync</Button>
                  <Link href="/judge/login"><Button size="sm" variant="secondary">Return to Judge Login</Button></Link>
                </div>
              </div>
            </div>
          </div>
        )}

        {submissionError && (
          <div role="alert" className="rounded-xl border border-red-200 bg-red-50 p-3.5 text-xs font-semibold leading-5 text-red-800">
            <div className="flex items-start gap-2"><AlertCircle className="mt-0.5 h-4 w-4 shrink-0" /><span>{submissionError}</span></div>
            {(submissionError.toLowerCase().includes('stale mapping') || submissionError.toLowerCase().includes('roster changed')) && (
              <Button variant="outline" size="sm" className="mt-3" onClick={handleRefresh} isLoading={refreshing}>Refresh anonymous roster</Button>
            )}
          </div>
        )}

        {syncState === 'loading' ? (
          <div className="rounded-2xl border border-slate-200 bg-white px-5 py-14 text-center shadow-sm">
            <div className="mx-auto mb-3 h-8 w-8 animate-spin rounded-full border-2 border-blue-600 border-t-transparent" />
            <p className="text-sm font-bold text-slate-900">Loading your assigned scorecard</p>
            <p className="mt-1 text-xs text-slate-500">Verifying your credentials and refreshing anonymous Green Room codes.</p>
          </div>
        ) : syncState === 'ready' && contestants.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-slate-300 bg-white px-5 py-12 text-center">
            <Users className="mx-auto mb-3 h-8 w-8 text-slate-400" />
            <h2 className="text-sm font-bold text-slate-900">Awaiting Green Room check-in</h2>
            <p className="mx-auto mt-1 max-w-md text-xs leading-5 text-slate-500">No anonymous contestants are currently assigned to this stage queue. Refresh the roster after the Green Room team checks contestants in.</p>
            <Button variant="outline" size="sm" className="mt-4" onClick={handleRefresh} isLoading={refreshing}>Refresh roster</Button>
          </div>
        ) : syncState === 'ready' && criteria.length === 0 ? (
          <div role="alert" className="rounded-2xl border border-amber-200 bg-amber-50 p-5 text-sm text-amber-900">
            This competition has no configured marking criteria. Contact the administrator; do not use a sample rubric.
          </div>
        ) : syncState === 'ready' ? (
          <div className="space-y-4">
            {contestants.map((contestant, index) => {
              const total = calculateTotal(contestant.codeLetter);
              const { grade, color: gradeColor } = getGrade(total);
              return (
                <article key={contestant.codeLetter} className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
                  <div className="flex flex-col gap-3 border-b border-slate-100 p-4 sm:flex-row sm:items-center sm:justify-between sm:px-5 sm:py-4">
                    <div className="flex min-w-0 items-center gap-3">
                      <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-blue-600 font-mono text-2xl font-black text-white shadow-sm">
                        {contestant.codeLetter}
                      </div>
                      <div className="min-w-0">
                        <div className="flex flex-wrap items-center gap-2">
                          <h2 className="text-sm font-extrabold text-slate-950">Contestant {contestant.codeLetter}</h2>
                          <Badge variant="info" size="sm">ANONYMOUS</Badge>
                        </div>
                        <p className="mt-0.5 text-xs text-slate-500">Stage entry order #{index + 1}</p>
                        {contestant.status && <p className="mt-0.5 text-[10px] font-medium uppercase tracking-wide text-slate-400">{contestant.status.replaceAll('_', ' ')}</p>}
                      </div>
                    </div>
                    <div className="flex items-center justify-between gap-3 rounded-xl bg-slate-50 px-3.5 py-2.5 sm:justify-end sm:bg-transparent sm:px-0 sm:py-0">
                      <div className="sm:text-right">
                        <span className="block text-[10px] font-bold uppercase tracking-wider text-slate-500">Total score</span>
                        <span className="text-2xl font-black tabular-nums text-slate-950">{total}<span className="ml-1 text-xs font-semibold text-slate-400">/ {maxMarksTotal}</span></span>
                      </div>
                      <span className={`rounded-lg border px-3 py-1.5 text-xs font-bold ${gradeColor}`}>Grade {grade}</span>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 gap-3 p-3.5 sm:grid-cols-2 sm:gap-4 sm:p-5">
                    {criteria.map(criterion => {
                      const value = scores[contestant.codeLetter]?.[criterion.id] ?? 0;
                      return (
                        <section key={criterion.id} className="min-w-0 rounded-xl border border-slate-200 bg-slate-50/80 p-3.5 sm:p-4">
                          <div className="mb-3 flex items-start justify-between gap-3">
                            <h3 className="min-w-0 break-words text-xs font-bold leading-5 text-slate-900">{criterion.name}</h3>
                            <span className="shrink-0 rounded-md bg-white px-2 py-1 text-[10px] font-bold text-slate-500">Max {criterion.maxMarks}</span>
                          </div>
                          <div className="flex items-center gap-2.5 sm:gap-3">
                            <button
                              type="button"
                              onClick={() => adjustScore(contestant.codeLetter, criterion.id, value - 1, criterion.maxMarks)}
                              disabled={value <= 0 || savingDraft || submitting}
                              className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border border-slate-200 bg-white text-slate-700 transition hover:border-blue-300 hover:bg-blue-50 disabled:cursor-not-allowed disabled:opacity-40"
                              aria-label={`Decrease ${criterion.name} for contestant ${contestant.codeLetter}`}
                            ><Minus className="h-4 w-4" /></button>
                            <input
                              type="range"
                              min={0}
                              max={criterion.maxMarks}
                              step={1}
                              value={value}
                              onChange={event => adjustScore(contestant.codeLetter, criterion.id, Number(event.target.value), criterion.maxMarks)}
                              disabled={savingDraft || submitting}
                              aria-label={`${criterion.name} score for contestant ${contestant.codeLetter}`}
                              className="h-8 min-w-0 flex-1 cursor-pointer accent-blue-600 disabled:cursor-not-allowed"
                            />
                            <button
                              type="button"
                              onClick={() => adjustScore(contestant.codeLetter, criterion.id, value + 1, criterion.maxMarks)}
                              disabled={value >= criterion.maxMarks || savingDraft || submitting}
                              className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border border-slate-200 bg-white text-slate-700 transition hover:border-blue-300 hover:bg-blue-50 disabled:cursor-not-allowed disabled:opacity-40"
                              aria-label={`Increase ${criterion.name} for contestant ${contestant.codeLetter}`}
                            ><Plus className="h-4 w-4" /></button>
                            <output className="w-9 shrink-0 text-right font-mono text-sm font-extrabold tabular-nums text-slate-950">{value}</output>
                          </div>
                        </section>
                      );
                    })}
                  </div>
                </article>
              );
            })}

            <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:p-5">
              <label htmlFor="judge-remarks" className="block text-xs font-bold text-slate-900">Evaluation remarks <span className="font-normal text-slate-400">(optional)</span></label>
              <textarea
                id="judge-remarks"
                rows={3}
                maxLength={1500}
                value={remarks}
                onChange={event => { setRemarks(event.target.value); setIsDirty(true); }}
                placeholder="Add a short note for the Chief Adjudicator, if required."
                disabled={savingDraft || submitting}
                className="mt-2 w-full rounded-xl border border-slate-200 bg-slate-50 px-3.5 py-3 text-sm leading-5 text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-blue-500 focus:bg-white focus:ring-2 focus:ring-blue-100 disabled:opacity-60"
              />
              <p className="mt-1 text-right text-[10px] text-slate-400">{remarks.length}/1500</p>
            </section>
          </div>
        ) : null}

        {syncState === 'ready' && contestants.length > 0 && criteria.length > 0 && (
          <div className="fixed inset-x-3 bottom-3 z-30 rounded-2xl border border-slate-200 bg-white/95 p-3 shadow-[0_12px_36px_-16px_rgba(15,23,42,0.4)] backdrop-blur-md sm:sticky sm:bottom-3 sm:inset-x-auto sm:mt-2 sm:flex sm:items-center sm:justify-between sm:gap-4 sm:p-4">
            <div className="hidden min-w-0 items-center gap-2 text-xs font-semibold text-slate-600 sm:flex">
              <Gavel className="h-4 w-4 shrink-0 text-blue-600" />
              <span>{contestants.length} anonymous contestants · {criteria.length} criteria</span>
            </div>
            <div className="grid grid-cols-2 gap-2 sm:flex sm:w-auto sm:gap-2">
              <Button variant="outline" size="md" className="w-full sm:w-auto" leftIcon={<Save className="h-4 w-4" />} onClick={handleSaveDraft} disabled={savingDraft || submitting} isLoading={savingDraft}>Save draft</Button>
              <Button variant="primary" size="md" className="w-full bg-slate-950 hover:bg-slate-800 sm:w-auto" leftIcon={<Send className="h-4 w-4" />} onClick={() => setConfirmModalOpen(true)} disabled={!isReadyToScore || savingDraft || submitting}>Finalize &amp; sign</Button>
            </div>
          </div>
        )}

        <Modal
          isOpen={confirmModalOpen}
          onClose={() => { if (!submitting) setConfirmModalOpen(false); }}
          title="Finalize and sign evaluation"
          description="Review the submission details. Once finalized, this scorecard is locked and cannot be edited."
          maxWidth="md"
          footer={
            <div className="grid w-full grid-cols-1 gap-2 sm:flex sm:justify-end">
              <Button variant="outline" size="sm" className="w-full sm:w-auto" onClick={() => setConfirmModalOpen(false)} disabled={submitting}>Back to scoring</Button>
              <Button variant="primary" size="sm" className="w-full bg-slate-950 hover:bg-slate-800 sm:w-auto" leftIcon={<ShieldCheck className="h-4 w-4" />} isLoading={submitting} disabled={submitting || savingDraft || contestants.length === 0} onClick={handleFinalSubmit}>Sign &amp; issue receipt</Button>
            </div>
          }
        >
          <div className="space-y-4">
            <div className="flex items-start gap-3 rounded-xl border border-amber-200 bg-amber-50 p-3.5 text-xs leading-5 text-amber-950">
              <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-amber-600" />
              <div><p className="font-bold">Final submission is irreversible</p><p className="mt-0.5 text-amber-800">Verify every anonymous code and criterion score. After signing, amendments require administrator authorization.</p></div>
            </div>
            <div className="grid grid-cols-2 gap-3 rounded-xl border border-slate-200 bg-slate-50 p-3.5 text-xs">
              <div className="col-span-2"><span className="block text-[10px] font-bold uppercase tracking-wide text-slate-500">Assigned competition</span><span className="mt-1 block font-bold text-slate-950">{competition?.name}</span></div>
              <div><span className="block text-[10px] font-bold uppercase tracking-wide text-slate-500">Contestants</span><span className="mt-1 block font-bold text-slate-950">{contestants.length} anonymous codes</span></div>
              <div><span className="block text-[10px] font-bold uppercase tracking-wide text-slate-500">Maximum marks</span><span className="mt-1 block font-bold text-slate-950">{maxMarksTotal} points</span></div>
            </div>
          </div>
        </Modal>
      </div>
    </JudgeLayout>
  );
}

export default function JudgeMarkingPage() {
  return (
    <Suspense fallback={<div className="mx-auto max-w-lg px-4 py-16 text-center text-sm text-slate-500">Loading secure evaluation session…</div>}>
      <JudgeMarkingContent />
    </Suspense>
  );
}
