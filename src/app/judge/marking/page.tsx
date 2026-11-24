'use client';

import React, { Suspense, useCallback, useEffect, useRef, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { JudgeLayout } from '@/components/layout/JudgeLayout';
import { calculateGrade } from '@/domain/scoring';
import { isValidJudgeMarkText, isValidJudgeTotalMark } from '@/domain/judgeMarks';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { Modal } from '@/components/ui/Modal';
import {
  AlertCircle,
  AlertTriangle,
  Gavel,
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

type LocalScores = Record<string, string>;
interface DraftSnapshot {
  scores: LocalScores;
  remarks: string;
}
interface LocalDraftBackup extends DraftSnapshot {
  rosterVersion: string;
  updatedAt: string;
}

function readLocalDraft(key: string): LocalDraftBackup | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = window.sessionStorage.getItem(key);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<LocalDraftBackup>;
    if (
      typeof parsed.rosterVersion !== 'string' ||
      typeof parsed.updatedAt !== 'string' ||
      !parsed.scores || typeof parsed.scores !== 'object' ||
      typeof parsed.remarks !== 'string'
    ) return null;
    return parsed as LocalDraftBackup;
  } catch {
    return null;
  }
}

function writeLocalDraft(key: string, rosterVersion: string, snapshot: DraftSnapshot) {
  if (typeof window === 'undefined') return;
  try {
    const backup: LocalDraftBackup = {
      ...snapshot,
      rosterVersion,
      updatedAt: new Date().toISOString()
    };
    window.sessionStorage.setItem(key, JSON.stringify(backup));
  } catch {
    // The server-side draft remains authoritative; local recovery is best-effort.
  }
}

function clearLocalDraft(key: string) {
  if (typeof window === 'undefined') return;
  try {
    window.sessionStorage.removeItem(key);
  } catch {
    // Ignore unavailable browser storage.
  }
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

function JudgeMarkingContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [sessionData] = useState<StoredJudgeSession | null>(readStoredSession);

  const assignmentId = searchParams.get('assignmentId') || sessionData?.assignment?.id || '';
  const competitionId = searchParams.get('competitionId') || sessionData?.assignment?.competitionId || '';
  const secret = sessionData?.secret || '';
  const localDraftKey = `judge-mark-draft:${assignmentId}:${competitionId}`;

  const [competition, setCompetition] = useState<CompetitionSession | null>(null);
  const [contestants, setContestants] = useState<AnonymousContestant[]>([]);
  const [criteria, setCriteria] = useState<Criterion[]>([]);
  const [scores, setScores] = useState<LocalScores>({});
  const [rosterVersion, setRosterVersion] = useState('');
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
  const [autoSaveState, setAutoSaveState] = useState<'idle' | 'pending' | 'saving' | 'saved' | 'error'>('idle');
  const autoSaveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const autoSaveQueueRef = useRef<Promise<void>>(Promise.resolve());
  const autoSaveRevisionRef = useRef(0);
  const latestDraftRef = useRef<DraftSnapshot>({ scores: {}, remarks: '' });
  latestDraftRef.current = { scores, remarks };

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

      if (typeof result.rosterVersion !== 'string' || !/^[a-f0-9]{64}$/.test(result.rosterVersion)) {
        throw new Error('The anonymous Green Room roster could not be verified. Refresh the judge session before entering marks.');
      }

      const nextCriteria = Array.isArray(result.competition?.criteria)
        ? result.competition.criteria as Criterion[]
        : [];
      const nextContestants = Array.isArray(result.contestants)
        ? result.contestants as AnonymousContestant[]
        : [];
      const nextScores: LocalScores = {};

      nextContestants.forEach(contestant => {
        nextScores[contestant.codeLetter] = '';
      });

      if (result.scores && typeof result.scores === 'object') {
        Object.entries(result.scores as Record<string, Record<string, number> | number>).forEach(([codeLetter, rawScore]) => {
          if (!(codeLetter in nextScores)) return;
          if (typeof rawScore === 'number' && Number.isFinite(rawScore)) {
            nextScores[codeLetter] = String(rawScore);
            return;
          }

          // Convert drafts created by the previous criterion-wise UI into the
          // equivalent total mark so judges can continue editing without data loss.
          const restoredRawTotal = Object.entries(rawScore || {}).reduce((sum, [criterionId, value]) => {
            const isKnownCriterion = nextCriteria.some(criterion => criterion.id === criterionId);
            return isKnownCriterion && typeof value === 'number' && Number.isFinite(value)
              ? sum + value
              : sum;
          }, 0);
          const previousCriteriaMaximum = nextCriteria.reduce((sum, criterion) => sum + criterion.maxMarks, 0);
          const restoredTotal = previousCriteriaMaximum > 0
            ? Math.round((restoredRawTotal / previousCriteriaMaximum) * 100)
            : restoredRawTotal;
          nextScores[codeLetter] = String(restoredTotal);
        });
      }

      const serverRemarks = typeof result.draftRemarks === 'string' ? result.draftRemarks : '';
      const serverUpdatedAt = Date.parse(typeof result.draftUpdatedAt === 'string' ? result.draftUpdatedAt : '');
      const localBackup = readLocalDraft(localDraftKey);
      let restoredScores = nextScores;
      let restoredRemarks = serverRemarks;
      let restoreLocalBackup = false;

      if (localBackup && localBackup.rosterVersion === result.rosterVersion) {
        const localUpdatedAt = Date.parse(localBackup.updatedAt);
        if (Number.isFinite(localUpdatedAt) && localUpdatedAt > (Number.isFinite(serverUpdatedAt) ? serverUpdatedAt : 0)) {
          restoredScores = { ...nextScores };
          nextContestants.forEach(contestant => {
            const localValue = localBackup.scores[contestant.codeLetter];
            if (typeof localValue === 'string' && isValidJudgeMarkText(localValue)) {
              restoredScores[contestant.codeLetter] = localValue;
            }
          });
          restoredRemarks = localBackup.remarks;
          restoreLocalBackup = true;
        } else {
          clearLocalDraft(localDraftKey);
        }
      } else if (localBackup) {
        clearLocalDraft(localDraftKey);
      }

      setCompetition(result.competition as CompetitionSession);
      setCriteria(nextCriteria);
      setContestants(nextContestants);
      setScores(restoredScores);
      setRosterVersion(result.rosterVersion);
      setRemarks(restoredRemarks);
      latestDraftRef.current = { scores: restoredScores, remarks: restoredRemarks };
      setDraftSavedAt(typeof result.draftUpdatedAt === 'string' ? result.draftUpdatedAt : '');
      setStaleDraft(Boolean(result.staleDraft));
      setIsDirty(restoreLocalBackup);
      setAutoSaveState(restoreLocalBackup ? 'pending' : 'idle');
      setSyncState('ready');
    } catch (error) {
      setSyncState('error');
      setSessionError(error instanceof Error ? error.message : 'Could not synchronize your judging session.');
    } finally {
      setRefreshing(false);
    }
  }, [assignmentId, competitionId, secret, router, localDraftKey]);

  useEffect(() => {
    void loadSession();
  }, [loadSession]);

  const maxMarksTotal = 100;

  const calculateTotal = (codeLetter: string) => {
    const value = Number(scores[codeLetter] ?? '0');
    return Number.isFinite(value) ? value : 0;
  };

  const getGrade = (total: number) => {
    const grade = Number.isFinite(total) && total >= 0 && total <= maxMarksTotal
      ? calculateGrade(total, maxMarksTotal)
      : '—';
    const color = grade === 'A+'
      ? 'border-emerald-200 bg-emerald-50 text-emerald-700'
      : grade === 'A'
        ? 'border-blue-200 bg-blue-50 text-blue-700'
        : grade === 'B' || grade === 'C'
          ? 'border-amber-200 bg-amber-50 text-amber-700'
          : 'border-slate-200 bg-slate-100 text-slate-600';
    return { grade, color };
  };

  const adjustScore = (codeLetter: string, nextValue: string) => {
    if (!isValidJudgeMarkText(nextValue)) return;
    const nextScores = { ...latestDraftRef.current.scores, [codeLetter]: nextValue };
    const snapshot = { scores: nextScores, remarks: latestDraftRef.current.remarks };
    latestDraftRef.current = snapshot;
    writeLocalDraft(localDraftKey, rosterVersion, snapshot);
    setScores(nextScores);
    setIsDirty(true);
    setDraftSavedNotice(false);
    setSubmissionError('');
  };

  const adjustRemarks = (nextRemarks: string) => {
    const snapshot = { scores: latestDraftRef.current.scores, remarks: nextRemarks };
    latestDraftRef.current = snapshot;
    writeLocalDraft(localDraftKey, rosterVersion, snapshot);
    setRemarks(nextRemarks);
    setIsDirty(true);
    setDraftSavedNotice(false);
  };

  const saveMarks = useCallback(async (
    action: 'DRAFT' | 'SUBMIT',
    snapshot: DraftSnapshot = latestDraftRef.current
  ) => {
    if (!assignmentId || !secret || !competition?.id || !rosterVersion) {
      throw new Error('Your verified Green Room roster session is missing. Refresh the judge session before saving.');
    }
    if (contestants.length === 0) {
      throw new Error('The Green Room roster is empty. Refresh the session or contact the administrator.');
    }

    const validatedScores: Record<string, number> = {};
    for (const contestant of contestants) {
      const rawValue = snapshot.scores[contestant.codeLetter] ?? '';
      if (rawValue.trim() === '') {
        if (action === 'DRAFT') continue;
        throw new Error(`Enter a mark from 0 to ${maxMarksTotal} for Code ${contestant.codeLetter}.`);
      }
      const value = Number(rawValue);
      if (!isValidJudgeTotalMark(value)) {
        throw new Error(`Mark for Code ${contestant.codeLetter} must be a whole number from 0 to ${maxMarksTotal}.`);
      }
      validatedScores[contestant.codeLetter] = value;
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
        rosterVersion,
        scores: validatedScores,
        remarks: snapshot.remarks
      })
    });
    const result = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(result.error || `Could not ${action.toLowerCase()} the scorecard.`);
    return result;
  }, [assignmentId, secret, competition?.id, rosterVersion, contestants, maxMarksTotal]);

  useEffect(() => {
    if (!isDirty || syncState !== 'ready' || contestants.length === 0 || !rosterVersion || submitting) return;

    const revision = ++autoSaveRevisionRef.current;
    if (autoSaveTimerRef.current) clearTimeout(autoSaveTimerRef.current);
    setAutoSaveState('pending');

    const timer = setTimeout(() => {
      autoSaveTimerRef.current = null;
      const snapshot: DraftSnapshot = { scores, remarks };
      autoSaveQueueRef.current = autoSaveQueueRef.current
        .catch(() => undefined)
        .then(async () => {
          if (revision !== autoSaveRevisionRef.current) return;
          setAutoSaveState('saving');
          try {
            const result = await saveMarks('DRAFT', snapshot);
            if (revision !== autoSaveRevisionRef.current) return;
            setDraftSavedAt(result.updatedAt || new Date().toISOString());
            setDraftSavedNotice(true);
            setSubmissionError('');
            if (JSON.stringify(latestDraftRef.current) === JSON.stringify(snapshot)) {
              setIsDirty(false);
              setAutoSaveState('saved');
              clearLocalDraft(localDraftKey);
            } else {
              setAutoSaveState('pending');
            }
          } catch (error) {
            if (revision === autoSaveRevisionRef.current) {
              setAutoSaveState('error');
              setSubmissionError(error instanceof Error
                ? `Auto-save failed. Your entries are still on this screen. Tap “Save draft” to retry. ${error.message}`
                : 'Auto-save failed. Your entries are still on this screen. Tap “Save draft” to retry.');
            }
          }
        });
    }, 650);
    autoSaveTimerRef.current = timer;

    return () => {
      clearTimeout(timer);
      if (autoSaveTimerRef.current === timer) autoSaveTimerRef.current = null;
    };
  }, [scores, remarks, isDirty, syncState, contestants.length, rosterVersion, submitting, saveMarks, localDraftKey]);

  const handleSaveDraft = async () => {
    if (autoSaveTimerRef.current) clearTimeout(autoSaveTimerRef.current);
    autoSaveTimerRef.current = null;
    const revision = ++autoSaveRevisionRef.current;
    const snapshot = latestDraftRef.current;
    setSavingDraft(true);
    setSubmissionError('');
    setDraftSavedNotice(false);
    try {
      await autoSaveQueueRef.current.catch(() => undefined);
      if (revision !== autoSaveRevisionRef.current) return;
      const result = await saveMarks('DRAFT', snapshot);
      setDraftSavedAt(result.updatedAt || new Date().toISOString());
      setDraftSavedNotice(true);
      setAutoSaveState('saved');
      if (JSON.stringify(latestDraftRef.current) === JSON.stringify(snapshot)) {
        setIsDirty(false);
        clearLocalDraft(localDraftKey);
      }
    } catch (error) {
      setAutoSaveState('error');
      setSubmissionError(error instanceof Error ? error.message : 'Could not save the draft scorecard.');
    } finally {
      setSavingDraft(false);
    }
  };

  const handleFinalSubmit = async () => {
    if (submitting || savingDraft) return;
    if (autoSaveTimerRef.current) clearTimeout(autoSaveTimerRef.current);
    autoSaveTimerRef.current = null;
    ++autoSaveRevisionRef.current;
    const snapshot = latestDraftRef.current;
    setSubmitting(true);
    setSubmissionError('');
    try {
      await autoSaveQueueRef.current.catch(() => undefined);
      const result = await saveMarks('SUBMIT', snapshot);
      setIsDirty(false);
      setAutoSaveState('saved');
      clearLocalDraft(localDraftKey);
      setConfirmModalOpen(false);
      const params = new URLSearchParams({
        assignmentId,
        competitionId: competition?.id || competitionId,
        hash: result.verificationHash
      });
      router.push(`/judge/confirmation?${params.toString()}`);
    } catch (error) {
      setSubmissionError(error instanceof Error ? error.message : 'Could not submit the final scorecard.');
      setAutoSaveState(isDirty ? 'error' : autoSaveState);
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

  const isReadyToScore = syncState === 'ready' && contestants.length > 0 && Boolean(rosterVersion) && !submitting;
  const statusText = syncState === 'loading'
    ? 'Syncing assignment'
    : syncState === 'error'
      ? 'Session unavailable'
      : autoSaveState === 'saving' || savingDraft
        ? 'Saving draft…'
        : autoSaveState === 'pending' || isDirty
          ? 'Auto-save pending'
          : autoSaveState === 'error'
            ? 'Auto-save failed · use Save draft'
            : draftSavedAt
              ? `Saved ${formatSavedAt(draftSavedAt)}`
              : 'Ready to evaluate';

  return (
    <JudgeLayout competitionTitle={competition?.name || 'Judge Evaluation'}>
      <div className="mx-auto w-full max-w-6xl space-y-4 pb-36 sm:space-y-6 sm:pb-8">
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
            <span aria-live="polite" className={`text-xs font-semibold ${syncState === 'error' || autoSaveState === 'error' ? 'text-red-700' : isDirty || autoSaveState === 'saving' || autoSaveState === 'pending' ? 'text-amber-700' : 'text-emerald-700'}`}>
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
        ) : syncState === 'ready' ? (
          <div className="space-y-4">
            {contestants.map((contestant, index) => {
              const total = calculateTotal(contestant.codeLetter);
              const hasMark = (scores[contestant.codeLetter] ?? '').trim() !== '';
              const { grade, color: gradeColor } = getGrade(total);
              return (
                <article key={contestant.codeLetter} className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
                  <div className="grid grid-cols-[minmax(0,1fr)_minmax(132px,42%)] items-center gap-3 border-b border-slate-100 p-3 sm:flex sm:justify-between sm:gap-4 sm:px-5 sm:py-4">
                    <div className="flex min-w-0 items-center gap-2.5 sm:gap-3">
                      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-blue-600 font-mono text-xl font-black text-white shadow-sm sm:h-12 sm:w-12 sm:text-2xl">
                        {contestant.codeLetter}
                      </div>
                      <div className="min-w-0">
                        <div className="flex flex-wrap items-center gap-1.5">
                          <h2 className="text-xs font-extrabold text-slate-950 sm:text-sm">Code {contestant.codeLetter}</h2>
                          <Badge variant="info" size="sm">ANONYMOUS</Badge>
                        </div>
                        <p className="mt-0.5 text-[10px] leading-4 text-slate-500 sm:text-xs">Entry order #{index + 1}</p>
                        {contestant.status && <p className="mt-0.5 break-words text-[9px] font-medium uppercase tracking-wide text-slate-400">{contestant.status.replaceAll('_', ' ')}</p>}
                      </div>
                    </div>
                    <div className="min-w-0 rounded-xl bg-slate-50 p-2.5 sm:w-64 sm:flex sm:items-end sm:justify-end sm:gap-2 sm:bg-transparent sm:p-0">
                      <div className="min-w-0 sm:flex-1">
                        <label htmlFor={`score-${contestant.codeLetter}`} className="mb-1 block text-[9px] font-bold uppercase tracking-wider text-slate-500 sm:mb-1.5 sm:text-[10px]">
                          Mark / {maxMarksTotal}
                        </label>
                        <div className="flex items-center gap-1.5">
                          <input
                            id={`score-${contestant.codeLetter}`}
                            type="text"
                            inputMode="numeric"
                            pattern="[0-9]*"
                            maxLength={3}
                            autoComplete="off"
                            value={scores[contestant.codeLetter] ?? ''}
                            onChange={event => adjustScore(contestant.codeLetter, event.target.value)}
                            disabled={savingDraft || submitting}
                            aria-label={`Enter mark for Code ${contestant.codeLetter}, from 0 to ${maxMarksTotal}`}
                            className="h-11 min-w-0 w-full rounded-lg border border-slate-200 bg-white px-2 text-center font-mono text-lg font-extrabold tabular-nums text-slate-950 outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-100 disabled:cursor-not-allowed disabled:bg-slate-100 disabled:opacity-60 sm:h-12 sm:rounded-xl sm:px-3 sm:text-xl"
                          />
                          <span className="shrink-0 text-[10px] font-bold text-slate-500 sm:text-xs">/100</span>
                        </div>
                      </div>
                      <span className={`mt-2 inline-flex w-full justify-center rounded-md border px-2 py-1 text-[10px] font-bold sm:mt-0 sm:w-auto sm:shrink-0 sm:rounded-lg sm:px-3 sm:py-1.5 sm:text-xs ${hasMark ? gradeColor : 'border-slate-200 bg-white text-slate-500'}`}>
                        {hasMark ? `Grade ${grade}` : 'NOT SCORED'}
                      </span>
                    </div>
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
                onChange={event => adjustRemarks(event.target.value)}
                placeholder="Add a short note for the Chief Adjudicator, if required."
                disabled={savingDraft || submitting}
                className="mt-2 w-full rounded-xl border border-slate-200 bg-slate-50 px-3.5 py-3 text-sm leading-5 text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-blue-500 focus:bg-white focus:ring-2 focus:ring-blue-100 disabled:opacity-60"
              />
              <p className="mt-1 text-right text-[10px] text-slate-400">{remarks.length}/1500</p>
            </section>
          </div>
        ) : null}

        {syncState === 'ready' && contestants.length > 0 && Boolean(rosterVersion) && (
          <div className="fixed inset-x-3 bottom-3 z-30 rounded-2xl border border-slate-200 bg-white/95 p-3 shadow-[0_12px_36px_-16px_rgba(15,23,42,0.4)] backdrop-blur-md sm:sticky sm:bottom-3 sm:inset-x-auto sm:mt-2 sm:flex sm:items-center sm:justify-between sm:gap-4 sm:p-4">
            <div className="mb-2 flex items-center justify-between gap-2 text-[10px] font-semibold text-slate-600 sm:hidden">
              <span>{contestants.filter(item => (scores[item.codeLetter] ?? '').trim() !== '').length}/{contestants.length} marked</span>
              <span aria-live="polite" className={autoSaveState === 'error' ? 'text-red-700' : autoSaveState === 'saved' ? 'text-emerald-700' : 'text-slate-500'}>{statusText}</span>
            </div>
            <div className="hidden min-w-0 items-center gap-2 text-xs font-semibold text-slate-600 sm:flex">
              <Gavel className="h-4 w-4 shrink-0 text-blue-600" />
              <span>{contestants.length} anonymous codes · Marks out of 100</span>
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
              <div><p className="font-bold">Final submission is irreversible</p><p className="mt-0.5 text-amber-800">Verify every Code Letter and its total mark. After signing, amendments require administrator authorization.</p></div>
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
