'use client';

import React, { useState, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { JudgeLayout } from '@/components/layout/JudgeLayout';
import { useFest } from '@/context/FestContext';
import { Registration } from '@/types/fest';
import { calculateGrade } from '@/domain/scoring';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { Modal } from '@/components/ui/Modal';
import {
  Gavel,
  Minus,
  Plus,
  CheckCircle2,
  Save,
  Send,
  AlertTriangle,
  Clock,
  ShieldCheck,
  Award
} from 'lucide-react';

interface LocalScore {
  [criterionId: string]: number;
}

function JudgeMarkingContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { competitions, registrations } = useFest();

  const compId = searchParams.get('competitionId') || 'cmp-1';
  const token = searchParams.get('token') || 'JRY-9921-EN';

  const [sessionData] = useState(() => {
    if (typeof window !== 'undefined') {
      try {
        const raw = sessionStorage.getItem('judge_session');
        if (raw) return JSON.parse(raw);
      } catch (e) {}
    }
    return null;
  });

  const competition = competitions.find(c => c.id === compId) || sessionData?.competition || competitions[0];
  const contextRegs = registrations.filter(r => r.competitionId === competition?.id);
  const compRegistrations: Registration[] = (contextRegs.length > 0 ? contextRegs : (sessionData?.registrations || [])) as Registration[];

  // Criteria setup
  const criteria: Array<{ id: string; name: string; maxMarks: number }> = competition?.criteria && competition.criteria.length > 0
    ? competition.criteria
    : [
        { id: 'cr-1', name: 'Subject Mastery & Content', maxMarks: 30 },
        { id: 'cr-2', name: 'Fluency, Delivery & Diction', maxMarks: 25 },
        { id: 'cr-3', name: 'Poise, Body Language & Gestures', maxMarks: 25 },
        { id: 'cr-4', name: 'Time Adherence (5 mins)', maxMarks: 20 }
      ];

  // Initialize scores state for all registered participants
  const [scores, setScores] = useState<Record<string, LocalScore>>(() => {
    const initial: Record<string, LocalScore> = {};
    compRegistrations.forEach((registration, index) => {
      const percentage = index === 0 ? 0.95 : index === 1 ? 0.85 : 0.75;
      initial[registration.id] = Object.fromEntries(
        criteria.map(criterion => [criterion.id, Math.round(criterion.maxMarks * percentage)])
      );
    });
    return initial;
  });

  const [remarks, setRemarks] = useState<Record<string, string>>({});
  const [confirmModalOpen, setConfirmModalOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [draftSavedNotice, setDraftSavedNotice] = useState(false);
  const [submissionError, setSubmissionError] = useState('');

  const saveMarks = async (action: 'DRAFT' | 'SUBMIT') => {
    const assignmentId = searchParams.get('assignmentId') || sessionData?.assignment?.id;
    const secret = sessionData?.secret;
    if (!assignmentId || !secret || !competition?.id) {
      throw new Error('Judge assignment or session secret is missing. Reopen the secure assignment link.');
    }

    const response = await fetch('/api/judge/marks', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        action,
        assignmentId,
        competitionId: competition.id,
        secret,
        scores
      })
    });
    const result = await response.json().catch(() => ({}));
    if (!response.ok) {
      throw new Error(result.error || `Could not ${action.toLowerCase()} marks.`);
    }
    return result;
  };

  // Handler to adjust score with +/- steppers
  const adjustScore = (regId: string, criterionId: string, delta: number, max: number) => {
    setScores(prev => {
      const currentVal = prev[regId]?.[criterionId] || 0;
      const newVal = Math.max(0, Math.min(max, currentVal + delta));
      return {
        ...prev,
        [regId]: {
          ...prev[regId],
          [criterionId]: newVal
        }
      };
    });
  };

  const calculateTotal = (regId: string) => {
    const participantScores = scores[regId] || {};
    return Object.values(participantScores).reduce((acc, val) => acc + val, 0);
  };

  const getGrade = (total: number) => {
    const maxMarks = criteria.reduce((sum, criterion) => sum + criterion.maxMarks, 0);
    const grade = calculateGrade(total, maxMarks);
    const color = grade === 'A+'
      ? 'text-emerald-700 bg-emerald-50 border-emerald-200'
      : grade === 'A'
        ? 'text-blue-700 bg-blue-50 border-blue-200'
        : grade === 'B' || grade === 'C'
          ? 'text-amber-700 bg-amber-50 border-amber-200'
          : 'text-neutral-600 bg-neutral-100 border-neutral-200';
    return { grade, color };
  };

  const handleSaveDraft = async () => {
    setSubmissionError('');
    try {
      await saveMarks('DRAFT');
      setDraftSavedNotice(true);
      setTimeout(() => setDraftSavedNotice(false), 2500);
    } catch (error) {
      setSubmissionError(error instanceof Error ? error.message : 'Could not save draft marks.');
    }
  };

  const handleFinalSubmit = async () => {
    setSubmitting(true);
    setSubmissionError('');
    try {
      const result = await saveMarks('SUBMIT');
      setSubmitting(false);
      setConfirmModalOpen(false);
      router.push(`/judge/confirmation?competitionId=${competition.id}&hash=${encodeURIComponent(result.verificationHash)}`);
    } catch (error) {
      setSubmissionError(error instanceof Error ? error.message : 'Could not submit the scorecard.');
      setSubmitting(false);
    }
  };

  return (
    <JudgeLayout competitionTitle={`${competition.name} (${competition.categoryName})`}>
      <div className="space-y-6">
        {/* Stage Roster Header */}
        <div className="bg-white rounded-2xl border border-[#E1E7EF] p-5 shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2">
              <span className="font-mono text-xs font-bold text-[#2563EB] bg-blue-50 px-2.5 py-0.5 rounded border border-blue-200">
                {competition.code}
              </span>
              <h2 className="text-lg font-black text-[#111111]">{competition.name}</h2>
            </div>
            <p className="text-xs text-[#526070] mt-1">
              Category: <strong className="text-[#111111]">{competition.categoryName}</strong> · Format: <strong className="text-[#111111]">{competition.type}</strong> · Venue: <strong className="text-[#111111]">{competition.stageName}</strong>
            </p>
          </div>

          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              leftIcon={<Save className="w-4 h-4 text-[#526070]" />}
              onClick={handleSaveDraft}
            >
              Save Draft
            </Button>
            <Button
              variant="primary"
              size="sm"
              className="bg-[#111111] hover:bg-neutral-800"
              leftIcon={<Send className="w-4 h-4" />}
              onClick={() => setConfirmModalOpen(true)}
            >
              Finalize &amp; Sign
            </Button>
          </div>
        </div>

        {draftSavedNotice && (
          <div className="p-3 bg-blue-50 border border-blue-200 rounded-lg text-xs text-blue-900 font-semibold flex items-center gap-2 animate-fade-in">
            <CheckCircle2 className="w-4 h-4 text-[#2563EB]" />
            Score sheet evaluation draft securely saved.
          </div>
        )}
        {submissionError && (
          <div role="alert" className="p-3 bg-red-50 border border-red-200 rounded-lg text-xs text-red-700 font-semibold">
            {submissionError}
          </div>
        )}

        {/* Participant Scoring Cards */}
        <div className="space-y-4">
          {compRegistrations.length === 0 ? (
            <div className="bg-white p-12 text-center rounded-2xl border border-[#E1E7EF]">
              <Clock className="w-8 h-8 text-[#526070] mx-auto mb-2" />
              <h4 className="text-sm font-bold text-[#111111]">Awaiting Contestant Check-In</h4>
              <p className="text-xs text-[#526070] mt-1">
                No contestants registered or checked into stage queue yet.
              </p>
            </div>
          ) : (
            compRegistrations.map((reg, rIndex) => {
              const total = calculateTotal(reg.id);
              const { grade, color: gradeColor } = getGrade(total);

              return (
                <div
                  key={reg.id}
                  className="bg-white rounded-xl border border-[#E1E7EF] p-5 shadow-xs hover:border-neutral-300 transition-all"
                >
                  {/* Card Top Banner */}
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-4 border-b border-[#E1E7EF]">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-xl bg-neutral-900 text-white flex items-center justify-center font-mono font-bold text-sm shadow-xs">
                        {reg.chestNumber}
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <h3 className="text-base font-extrabold text-[#111111]">{reg.participantName}</h3>
                          <span className="text-xs font-semibold px-2 py-0.5 rounded bg-[#F8FAFC] border border-[#E1E7EF] text-[#526070]">
                            {reg.teamName} ({reg.teamCode})
                          </span>
                        </div>
                        <span className="text-[11px] text-[#526070]">
                          Order of Appearance: Stage Entry #{rIndex + 1}
                        </span>
                      </div>
                    </div>

                    {/* Total Score & Grade Badge */}
                    <div className="flex items-center gap-3 self-end sm:self-auto">
                      <div className="text-right">
                        <span className="text-[10px] uppercase font-bold text-[#526070] tracking-wider block">
                          Tally (Max 100)
                        </span>
                        <span className="text-2xl font-black text-[#111111]">{total}</span>
                      </div>
                      <span className={`text-xs font-bold px-3 py-1.5 rounded-lg border ${gradeColor}`}>
                        Grade {grade}
                      </span>
                    </div>
                  </div>

                  {/* Criteria Sliders & Steppers */}
                  <div className="mt-4 grid grid-cols-1 md:grid-cols-2 gap-4">
                    {criteria.map((cr) => {
                      const currentVal = scores[reg.id]?.[cr.id] || 0;
                      return (
                        <div
                          key={cr.id}
                          className="p-3.5 rounded-lg border border-[#E1E7EF] bg-[#F8FAFC] flex flex-col justify-between"
                        >
                          <div className="flex items-center justify-between text-xs mb-2">
                            <span className="font-bold text-[#111111]">{cr.name}</span>
                            <span className="text-[#526070] font-semibold">Max {cr.maxMarks} pts</span>
                          </div>

                          <div className="flex items-center gap-3">
                            {/* Stepper Minus */}
                            <button
                              type="button"
                              onClick={() => adjustScore(reg.id, cr.id, -1, cr.maxMarks)}
                              disabled={currentVal <= 0}
                              className="w-8 h-8 rounded-lg bg-white border border-[#E1E7EF] text-[#111111] flex items-center justify-center font-bold hover:bg-neutral-100 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                              aria-label="Decrease score"
                            >
                              <Minus className="w-3.5 h-3.5" />
                            </button>

                            {/* Range Slider */}
                            <input
                              type="range"
                              min={0}
                              max={cr.maxMarks}
                              value={currentVal}
                              onChange={(e) => adjustScore(reg.id, cr.id, Number(e.target.value) - currentVal, cr.maxMarks)}
                              className="flex-1 accent-[#2563EB] cursor-pointer"
                            />

                            {/* Stepper Plus */}
                            <button
                              type="button"
                              onClick={() => adjustScore(reg.id, cr.id, 1, cr.maxMarks)}
                              disabled={currentVal >= cr.maxMarks}
                              className="w-8 h-8 rounded-lg bg-white border border-[#E1E7EF] text-[#111111] flex items-center justify-center font-bold hover:bg-neutral-100 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                              aria-label="Increase score"
                            >
                              <Plus className="w-3.5 h-3.5" />
                            </button>

                            {/* Current Score Tag */}
                            <span className="w-9 text-right font-mono font-bold text-sm text-[#111111]">
                              {currentVal}
                            </span>
                          </div>
                        </div>
                      );
                    })}
                  </div>

                  {/* Remarks Input */}
                  <div className="mt-4">
                    <input
                      type="text"
                      placeholder="Optional adjudicator feedback / stage remarks..."
                      value={remarks[reg.id] || ''}
                      onChange={(e) => setRemarks({ ...remarks, [reg.id]: e.target.value })}
                      className="w-full text-xs px-3 py-2 bg-[#F8FAFC] border border-[#E1E7EF] rounded-lg text-[#111111] placeholder:text-[#8E9CAE] focus:outline-none focus:bg-white focus:border-[#2563EB]"
                    />
                  </div>
                </div>
              );
            })
          )}
        </div>

        {/* Bottom Submission Action Bar */}
        <div className="p-4 rounded-xl bg-white border border-[#E1E7EF] flex flex-col sm:flex-row items-center justify-between gap-4 shadow-xs">
          <div className="flex items-center gap-2 text-xs text-[#526070]">
            <ShieldCheck className="w-4 h-4 text-emerald-600" />
            <span>Digital Cryptographic Juror Signing Protocol Active</span>
          </div>
          <div className="flex items-center gap-3 w-full sm:w-auto">
            <Button
              variant="outline"
              size="md"
              leftIcon={<Save className="w-4 h-4" />}
              onClick={handleSaveDraft}
            >
              Save Draft
            </Button>
            <Button
              variant="primary"
              size="md"
              className="bg-[#111111] hover:bg-neutral-800"
              leftIcon={<Send className="w-4 h-4" />}
              onClick={() => setConfirmModalOpen(true)}
            >
              Finalize &amp; Sign Submission
            </Button>
          </div>
        </div>

        {/* Confirmation Modal */}
        <Modal
          isOpen={confirmModalOpen}
          onClose={() => setConfirmModalOpen(false)}
          title="Sign &amp; Lock Jury Evaluation"
          description="Once submitted, the evaluation sheet is cryptographically locked and forwarded directly to the Chief Adjudicator."
          maxWidth="md"
          footer={
            <div className="flex items-center justify-end gap-2 w-full">
              <Button variant="outline" size="sm" onClick={() => setConfirmModalOpen(false)}>
                Back to Scoring
              </Button>
              <Button
                variant="primary"
                size="sm"
                className="bg-[#111111] hover:bg-neutral-800"
                isLoading={submitting}
                onClick={handleFinalSubmit}
              >
                Sign &amp; Issue Receipt
              </Button>
            </div>
          }
        >
          <div className="space-y-4">
            <div className="p-3.5 bg-amber-50 border border-amber-200 rounded-lg text-xs text-amber-900 flex items-start gap-2.5">
              <AlertTriangle className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
              <div>
                <h4 className="font-bold">Irreversible Score Lockout</h4>
                <p className="mt-0.5 text-amber-800">
                  Please verify that all contestant scores are accurately tallied. Post submission, scores can only be amended with written authorization from the Central Board.
                </p>
              </div>
            </div>

            <div className="bg-[#F8FAFC] p-3 rounded-lg border border-[#E1E7EF] space-y-1.5 text-xs">
              <div className="flex justify-between">
                <span className="text-[#526070]">Contest:</span>
                <span className="font-bold text-[#111111]">{competition.name}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-[#526070]">Audited Contestants:</span>
                <span className="font-bold text-[#111111]">{compRegistrations.length}</span>
              </div>
            </div>
          </div>
        </Modal>
      </div>
    </JudgeLayout>
  );
}

export default function JudgeMarkingPage() {
  return (
    <Suspense fallback={<div className="p-12 text-center text-xs text-[#526070]">Loading evaluation roster...</div>}>
      <JudgeMarkingContent />
    </Suspense>
  );
}
