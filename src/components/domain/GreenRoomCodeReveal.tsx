'use client';

import React, { useEffect, useMemo, useState } from 'react';
import { CheckCircle2, Printer, Sparkles } from 'lucide-react';
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

const SEGMENT_COUNT = 12;
const SEGMENT_ANGLE = 360 / SEGMENT_COUNT;
const SPIN_DURATION_MS = 5_000;
const EXTRA_SPIN_TURNS = 6;
const ROLLING_CODES = [
  ...'ABCDEFGHIJKLMNOPQRSTUVWXYZ'.split(''),
  ...'ABCDEFGHIJKLMNOPQRSTUVWXYZ'.split('').flatMap(first =>
    'ABCDEFGHIJKLMNOPQRSTUVWXYZ'.split('').map(second => `${first}${second}`)
  )
];

const SEGMENT_COLORS = [
  '#f4512d',
  '#ffc928',
  '#48b85b',
  '#1688ed',
  '#963bd0',
  '#f4512d',
  '#ffc928',
  '#48b85b',
  '#1688ed',
  '#963bd0',
  '#f4512d',
  '#ffc928'
];

function hashSeed(value: string): number {
  let hash = 2166136261;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

/** Build a stable wheel for this assignment so the first render is hydration-safe. */
function buildWheelCodes(seedValue: string, targetCode: string) {
  let seed = hashSeed(seedValue || targetCode);
  const random = () => {
    seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
    return seed / 0x1_0000_0000;
  };

  const available = ROLLING_CODES.filter(code => code !== targetCode);
  const codes: string[] = [];

  for (let index = 0; index < SEGMENT_COUNT - 1; index += 1) {
    const selectedIndex = Math.floor(random() * available.length);
    codes.push(available.splice(selectedIndex, 1)[0]);
  }

  const targetIndex = Math.floor(random() * SEGMENT_COUNT);
  codes.splice(targetIndex, 0, targetCode);

  return { codes, targetIndex };
}

function polarPoint(angleDegrees: number, radius: number) {
  const radians = (angleDegrees * Math.PI) / 180;
  return {
    x: 200 + Math.cos(radians) * radius,
    y: 200 + Math.sin(radians) * radius
  };
}

function describeSegment(index: number) {
  const startAngle = -90 + index * SEGMENT_ANGLE;
  const endAngle = startAngle + SEGMENT_ANGLE;
  const start = polarPoint(startAngle, 190);
  const end = polarPoint(endAngle, 190);

  return `M 200 200 L ${start.x} ${start.y} A 190 190 0 0 1 ${end.x} ${end.y} Z`;
}

/**
 * A visual Fortune Wheel for the Green Room check-in flow.
 * The Code Letter is already allocated by the authoritative server transaction.
 * The wheel only reveals that saved value; it never chooses or changes an assignment.
 */
export const GreenRoomCodeReveal: React.FC<GreenRoomCodeRevealProps> = ({
  isOpen,
  assignment,
  isExisting,
  onClose,
  onPrint
}) => {
  const [phase, setPhase] = useState<RevealPhase>('rolling');
  const [rotation, setRotation] = useState(0);
  const [isSpinning, setIsSpinning] = useState(false);

  const wheel = useMemo(
    () => buildWheelCodes(assignment?.id || assignment?.registrationId || '', assignment?.codeLetter || 'A'),
    [assignment?.id, assignment?.registrationId, assignment?.codeLetter]
  );

  const finalRotation =
    EXTRA_SPIN_TURNS * 360 - (wheel.targetIndex + 0.5) * SEGMENT_ANGLE;

  useEffect(() => {
    if (!isOpen || !assignment) return;

    let startTimer: ReturnType<typeof setTimeout> | undefined;
    let fallbackTimer: ReturnType<typeof setTimeout> | undefined;

    if (isExisting) {
      setRotation(finalRotation);
      setIsSpinning(false);
      setPhase('complete');
      return;
    }

    setPhase('rolling');
    setIsSpinning(false);
    setRotation(0);

    // Allow the zero-degree state to paint before starting the 5-second transition.
    startTimer = setTimeout(() => {
      setIsSpinning(true);
      setRotation(finalRotation);
    }, 50);

    // Transition-end is the normal completion signal; this is a defensive fallback.
    fallbackTimer = setTimeout(() => {
      setPhase('complete');
    }, SPIN_DURATION_MS + 700);

    return () => {
      if (startTimer) clearTimeout(startTimer);
      if (fallbackTimer) clearTimeout(fallbackTimer);
    };
  }, [isOpen, assignment?.id, assignment?.codeLetter, isExisting, finalRotation]);

  if (!assignment) return null;

  const handleClose = () => {
    if (phase === 'complete') onClose();
  };

  const handleWheelTransitionEnd = (event: React.TransitionEvent<HTMLDivElement>) => {
    if (event.propertyName === 'transform' && isSpinning) {
      setPhase('complete');
    }
  };

  const title = isExisting
    ? 'Participant Already Checked In'
    : phase === 'complete'
      ? 'Code Letter Assigned'
      : 'Spinning Code Letter Wheel';

  return (
    <Modal
      isOpen={isOpen}
      onClose={handleClose}
      title={title}
      description={
        isExisting
          ? 'This participant already has a Green Room Code Letter. The original assignment has been retained.'
          : phase === 'complete'
            ? 'The wheel has stopped on the Code Letter securely assigned and saved by the server.'
            : 'The Fortune Wheel is spinning for 5 seconds. The final Code Letter is already securely assigned.'
      }
      maxWidth="md"
      footer={
        <div className="flex w-full flex-col-reverse gap-2 sm:flex-row sm:justify-end">
          <Button variant="outline" size="sm" onClick={handleClose} disabled={phase !== 'complete'}>
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

        <div className="rounded-2xl border border-slate-200 bg-gradient-to-b from-slate-50 to-white px-3 py-5 sm:px-5 sm:py-6">
          <div className="mb-4 flex items-center justify-center gap-2 text-[10px] font-extrabold uppercase tracking-[0.2em] text-slate-600">
            {phase === 'complete' ? (
              <CheckCircle2 className="h-4 w-4 text-emerald-600" />
            ) : (
              <span className="h-2 w-2 animate-pulse rounded-full bg-orange-500" />
            )}
            {isExisting
              ? 'Previously Assigned Code'
              : phase === 'complete'
                ? 'Final Code Letter'
                : 'Wheel Spinning · 5 Seconds'}
          </div>

          <div className="relative mx-auto aspect-square w-full max-w-[340px]">
            <div
              className="absolute inset-0 rounded-full"
              style={{
                transform: `rotate(${rotation}deg)`,
                transition: isSpinning
                  ? `transform ${SPIN_DURATION_MS}ms cubic-bezier(0.08, 0.72, 0.12, 1)`
                  : 'none'
              }}
              onTransitionEnd={handleWheelTransitionEnd}
              role="img"
              aria-label={`Fortune Wheel with Code Letter segments. ${phase === 'complete' ? `Selected code: ${assignment.codeLetter}` : 'Wheel spinning'}.`}
            >
              <svg viewBox="0 0 400 400" className="h-full w-full overflow-visible drop-shadow-xl" aria-hidden="true">
                <circle cx="200" cy="200" r="197" fill="#18234f" />
                <circle cx="200" cy="200" r="192" fill="#f8fafc" stroke="#28366d" strokeWidth="5" />
                {wheel.codes.map((code, index) => {
                  const midAngle = -90 + (index + 0.5) * SEGMENT_ANGLE;
                  const label = polarPoint(midAngle, 132);

                  return (
                    <g key={`${code}-${index}`}>
                      <path
                        d={describeSegment(index)}
                        fill={SEGMENT_COLORS[index]}
                        stroke="#ffffff"
                        strokeWidth="3"
                        strokeLinejoin="round"
                      />
                      <text
                        x={label.x}
                        y={label.y}
                        textAnchor="middle"
                        dominantBaseline="central"
                        fill="#ffffff"
                        fontSize={code.length === 1 ? 31 : 23}
                        fontWeight="900"
                        transform={`rotate(${midAngle + 90} ${label.x} ${label.y})`}
                        style={{ paintOrder: 'stroke', stroke: 'rgba(0,0,0,0.16)', strokeWidth: 1.5 }}
                      >
                        {code}
                      </text>
                    </g>
                  );
                })}
                <circle cx="200" cy="200" r="191" fill="none" stroke="#101b49" strokeWidth="8" />
                <circle cx="200" cy="200" r="184" fill="none" stroke="rgba(255,255,255,0.48)" strokeWidth="2" />
              </svg>
            </div>

            {/* Fixed centre pointer, matching the supplied Fortune Wheel reference. */}
            <svg
              viewBox="0 0 400 400"
              className="pointer-events-none absolute inset-0 h-full w-full drop-shadow-lg"
              aria-hidden="true"
            >
              <path
                d="M 200 105 C 184 145 154 174 154 207 C 154 239 174 259 200 259 C 226 259 246 239 246 207 C 246 174 216 145 200 105 Z"
                fill="#ff6a00"
                stroke="#d94b00"
                strokeWidth="5"
              />
              <path
                d="M 200 119 C 190 151 166 178 166 207"
                fill="none"
                stroke="rgba(255,255,255,0.5)"
                strokeWidth="5"
                strokeLinecap="round"
              />
              <circle cx="200" cy="211" r="22" fill="#ffffff" stroke="#f1f5f9" strokeWidth="3" />
            </svg>
          </div>

          <div className="mt-4 flex min-h-6 items-center justify-center gap-2 text-xs font-semibold">
            {phase === 'complete' ? (
              <>
                <Sparkles className="h-4 w-4 text-emerald-600" />
                <span className="text-emerald-700">
                  {isExisting ? 'Original Code Letter retained' : 'Wheel stopped · Code Letter assigned'}
                </span>
              </>
            ) : (
              <span className="text-slate-500">Please wait for the wheel to stop…</span>
            )}
          </div>

          {phase === 'complete' && (
            <div className="mt-3 text-center">
              <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-slate-500">
                Assigned Code Letter
              </p>
              <div className="mt-1 inline-flex min-w-24 items-center justify-center rounded-2xl border-2 border-orange-200 bg-orange-50 px-6 py-2 font-mono text-4xl font-black text-orange-600 shadow-sm">
                {assignment.codeLetter}
              </div>
            </div>
          )}
        </div>

        {phase === 'complete' && (
          <p className="text-center text-[11px] leading-5 text-slate-500">
            This Code Letter is saved in the competition roster. Scanning or checking in this participant again will retain the original assignment.
          </p>
        )}
      </div>
    </Modal>
  );
};
