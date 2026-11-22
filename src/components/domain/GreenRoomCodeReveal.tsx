'use client';

import React, { useEffect, useState } from 'react';
import { CheckCircle2, LoaderCircle, Printer, Sparkles } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { Modal } from '@/components/ui/Modal';
import type { FirestoreGreenRoomAssignment } from '@/types/firestore';

interface GreenRoomCodeRevealProps {
  isOpen: boolean;
  assignment: FirestoreGreenRoomAssignment | null;
  isExisting: boolean;
  onClose: () => void;
  onPrint: () => void;
}

type RevealPhase = 'rolling' | 'complete';

const ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'.split('');
const ROLLING_CODES = [
  ...ALPHABET,
  ...ALPHABET.flatMap(first => ALPHABET.map(second => `${first}${second}`))
];

/**
 * Presents the server-assigned Code Letter as a rolling reveal.
 * The animation is visual only: the authoritative value always comes from
 * the Firestore transaction response in GreenRoomService.
 */
export const GreenRoomCodeReveal: React.FC<GreenRoomCodeRevealProps> = ({
  isOpen,
  assignment,
  isExisting,
  onClose,
  onPrint
}) => {
  const [displayedCode, setDisplayedCode] = useState('A');
  const [phase, setPhase] = useState<RevealPhase>('rolling');

  useEffect(() => {
    if (!isOpen || !assignment) return;

    if (isExisting) {
      setDisplayedCode(assignment.codeLetter);
      setPhase('complete');
      return;
    }

    const delays = [55, 60, 65, 75, 85, 100, 120, 150, 190, 240, 310, 390];
    let step = 0;
    let timeout: ReturnType<typeof setTimeout> | undefined;

    setPhase('rolling');
    setDisplayedCode(ROLLING_CODES[0]);

    const tick = () => {
      if (step >= delays.length) {
        setDisplayedCode(assignment.codeLetter);
        setPhase('complete');
        return;
      }

      const nextIndex = Math.floor(Math.random() * ROLLING_CODES.length);
      setDisplayedCode(ROLLING_CODES[nextIndex]);
      timeout = setTimeout(tick, delays[step]);
      step += 1;
    };

    timeout = setTimeout(tick, delays[step]);
    step += 1;

    return () => {
      if (timeout) clearTimeout(timeout);
    };
  }, [isOpen, assignment?.id, assignment?.codeLetter, isExisting]);

  if (!assignment) return null;

  const title = isExisting
    ? 'Participant Already Checked In'
    : phase === 'complete'
      ? 'Code Letter Assigned'
      : 'Assigning Code Letter';

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={title}
      description={
        isExisting
          ? 'This participant already has a Green Room Code Letter. The original assignment has been retained.'
          : phase === 'complete'
            ? 'The random Code Letter has been securely assigned and saved.'
            : 'Revealing the Code Letter selected by the secure Green Room assignment process…'
      }
      maxWidth="md"
      footer={
        <div className="flex w-full flex-col-reverse gap-2 sm:flex-row sm:justify-end">
          <Button variant="outline" size="sm" onClick={onClose}>
            Done
          </Button>
          <Button
            variant="primary"
            size="sm"
            disabled={phase !== 'complete'}
            onClick={onPrint}
            leftIcon={<Printer className="h-4 w-4" />}
          >
            Print Code Slip
          </Button>
        </div>
      }
    >
      <div className="space-y-5">
        <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4 sm:p-5">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-slate-500">
                {assignment.competitionCode ? `${assignment.competitionCode} · ` : ''}{assignment.competitionName}
              </p>
              <h4 className="mt-1 break-words text-base font-extrabold text-slate-950 sm:text-lg">
                {assignment.participantName}
              </h4>
              <p className="mt-1 text-xs text-slate-500">
                {assignment.teamName}{assignment.teamCode ? ` · ${assignment.teamCode}` : ''}
              </p>
              {assignment.chestNumber && (
                <p className="mt-1 text-[11px] font-medium text-slate-500">
                  Chest #{assignment.chestNumber}
                </p>
              )}
            </div>
            {isExisting ? (
              <span className="shrink-0 rounded-full border border-amber-200 bg-amber-50 px-2.5 py-1 text-[10px] font-bold text-amber-800">
                Existing
              </span>
            ) : (
              <span className="shrink-0 rounded-full border border-emerald-200 bg-emerald-50 px-2.5 py-1 text-[10px] font-bold text-emerald-700">
                New Check-in
              </span>
            )}
          </div>
        </div>

        <div className="relative overflow-hidden rounded-2xl border border-blue-100 bg-gradient-to-br from-blue-50 via-white to-indigo-50 px-4 py-7 text-center sm:py-8">
          <div className="absolute -right-10 -top-12 h-32 w-32 rounded-full bg-blue-100/60 blur-2xl" />
          <div className="relative">
            <div className="mb-4 flex items-center justify-center gap-2 text-[10px] font-extrabold uppercase tracking-[0.2em] text-blue-700">
              {phase === 'complete' ? (
                <CheckCircle2 className="h-4 w-4 text-emerald-600" />
              ) : (
                <LoaderCircle className="h-4 w-4 animate-spin" />
              )}
              {isExisting
                ? 'Previously Assigned Code'
                : phase === 'complete'
                  ? 'Final Code Letter'
                  : 'Selecting Code Letter'}
            </div>

            <div className="relative mx-auto flex h-36 w-36 items-center justify-center sm:h-40 sm:w-40">
              <div
                className={`absolute inset-0 rounded-[2rem] border-[5px] border-dashed border-blue-200 ${phase === 'rolling' ? 'animate-spin' : ''}`}
                style={phase === 'rolling' ? { animationDuration: '1.8s' } : undefined}
                aria-hidden="true"
              />
              <div className="flex h-28 w-28 items-center justify-center rounded-3xl border border-blue-100 bg-white shadow-xl shadow-blue-900/10 sm:h-32 sm:w-32">
                <span
                  key={displayedCode}
                  aria-live="polite"
                  aria-atomic="true"
                  className={`font-mono text-6xl font-black tracking-tight text-blue-700 transition-all duration-150 sm:text-7xl ${phase === 'rolling' ? 'scale-95 blur-[0.4px]' : 'scale-100 blur-0'}`}
                >
                  {displayedCode}
                </span>
              </div>
            </div>

            <div className="mt-4 flex items-center justify-center gap-2 text-xs font-semibold">
              {phase === 'complete' ? (
                <>
                  <Sparkles className="h-4 w-4 text-emerald-600" />
                  <span className="text-emerald-700">
                    {isExisting ? 'Original Code Letter restored' : 'Code Letter successfully assigned'}
                  </span>
                </>
              ) : (
                <span className="text-slate-500">Please wait for the reveal to finish…</span>
              )}
            </div>
          </div>
        </div>

        {phase === 'complete' && (
          <p className="text-center text-[11px] leading-5 text-slate-500">
            This Code Letter is saved in the competition roster. It will not be reassigned by scanning this participant again.
          </p>
        )}
      </div>
    </Modal>
  );
};
