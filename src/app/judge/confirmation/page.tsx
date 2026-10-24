'use client';

import React, { Suspense, useMemo } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { JudgeLayout } from '@/components/layout/JudgeLayout';
import { useFest } from '@/context/FestContext';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { CheckCircle2, Printer, ShieldCheck } from 'lucide-react';
import { indexToCodeLetter } from '@/domain/greenRoom';

function ConfirmationContent() {
  const searchParams = useSearchParams();
  const { competitions } = useFest();

  const compId = searchParams.get('competitionId') || 'cmp-1';
  const hash = searchParams.get('hash') || 'SHA256:7e9b41a82f3c091d';

  const [sessionData] = React.useState(() => {
    if (typeof window !== 'undefined') {
      try {
        const raw = sessionStorage.getItem('judge_session');
        if (raw) return JSON.parse(raw);
      } catch (e) {}
    }
    return null;
  });

  const competition = competitions.find(c => c.id === compId) || sessionData?.competition || competitions[0];

  const contestants = useMemo(() => {
    const rawList = sessionData?.contestants || sessionData?.registrations || [];
    if (Array.isArray(rawList) && rawList.length > 0) {
      return rawList.map((item: any, idx: number) => ({
        codeLetter: item.codeLetter || (item.id && /^[A-Z]{1,2}$/.test(item.id) ? item.id : indexToCodeLetter(idx)),
        codeIndex: typeof item.codeIndex === 'number' ? item.codeIndex : idx
      }));
    }
    const count = competition?.entriesCount || 4;
    return Array.from({ length: count }, (_, idx) => ({
      codeLetter: indexToCodeLetter(idx),
      codeIndex: idx
    }));
  }, [sessionData, competition]);

  const timestamp = new Date().toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  });

  return (
    <JudgeLayout competitionTitle={competition.name} isLocked={true}>
      <div className="space-y-6 max-w-3xl mx-auto">
        {/* Receipt Confirmation Banner */}
        <div className="bg-white rounded-2xl border border-[#E1E7EF] p-8 shadow-xs text-center">
          <div className="w-16 h-16 rounded-2xl bg-emerald-50 text-emerald-600 border border-emerald-200 flex items-center justify-center mx-auto shadow-sm">
            <CheckCircle2 className="w-9 h-9" />
          </div>

          <span className="mt-4 inline-block text-[11px] font-bold uppercase tracking-widest text-emerald-800 bg-emerald-50 border border-emerald-200 px-3 py-1 rounded-full">
            EVALUATION OFFICIALLY SEALED
          </span>

          <h1 className="text-2xl font-black text-[#111111] tracking-tight mt-2">
            Official Adjudication Receipt
          </h1>
          <p className="text-xs text-[#526070] mt-1">
            Anonymous evaluations for <strong className="text-[#111111]">{competition.name}</strong> ({competition.categoryName}) have been cryptographically signed and archived.
          </p>

          <div className="mt-6 p-4 rounded-xl bg-[#F8FAFC] border border-[#E1E7EF] grid grid-cols-2 sm:grid-cols-3 gap-3 text-xs text-left">
            <div>
              <span className="text-[#526070] font-medium block">Timestamp</span>
              <span className="font-bold text-[#111111]">{timestamp}</span>
            </div>
            <div>
              <span className="text-[#526070] font-medium block">Audited Contestants</span>
              <span className="font-bold text-[#111111]">{contestants.length} Anonymous Codes</span>
            </div>
            <div className="col-span-2 sm:col-span-1">
              <span className="text-[#526070] font-medium block">Digital Verification Hash</span>
              <span className="font-mono text-[11px] font-bold text-[#2563EB] truncate block">{hash}</span>
            </div>
          </div>
        </div>

        {/* Breakdown Table: Strictly Anonymous */}
        <div className="bg-white rounded-xl border border-[#E1E7EF] shadow-xs overflow-hidden">
          <div className="px-6 py-4 border-b border-[#E1E7EF] bg-white flex items-center justify-between">
            <div className="flex items-center gap-2">
              <ShieldCheck className="w-4 h-4 text-emerald-600" />
              <h3 className="text-sm font-bold text-[#111111]">Anonymous Evaluation Register</h3>
            </div>
            <Badge variant="success" size="sm">LOCKED &amp; ARCHIVED</Badge>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="border-b border-[#E1E7EF] bg-[#F8FAFC] text-[#526070] font-bold uppercase text-[11px]">
                  <th className="py-3 px-6">Code Letter</th>
                  <th className="py-3 px-6">Appearance Order</th>
                  <th className="py-3 px-6 text-center">Scorecard Sealed</th>
                  <th className="py-3 px-6 text-right">Lock State</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#E1E7EF]">
                {contestants.map((c) => (
                  <tr key={c.codeLetter} className="hover:bg-[#F8FAFC]">
                    <td className="py-3.5 px-6">
                      <div className="w-8 h-8 rounded-lg bg-[#2563EB] text-white flex items-center justify-center font-mono font-black text-sm">
                        {c.codeLetter}
                      </div>
                    </td>
                    <td className="py-3.5 px-6 font-semibold text-[#111111]">
                      Stage Entry #{c.codeIndex + 1}
                    </td>
                    <td className="py-3.5 px-6 text-center text-[#526070] font-mono text-xs">
                      Cryptographically Recorded
                    </td>
                    <td className="py-3.5 px-6 text-right">
                      <span className="text-emerald-700 font-bold text-[11px] flex items-center justify-end gap-1">
                        <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                        Sealed
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Footer Actions */}
        <div className="flex flex-col sm:flex-row items-center justify-between gap-3 pt-2">
          <Link href="/judge/login">
            <Button variant="outline" size="md">
              Return to Session Overview
            </Button>
          </Link>

          <Button
            variant="primary"
            size="md"
            className="bg-[#111111] hover:bg-neutral-800"
            leftIcon={<Printer className="w-4 h-4" />}
            onClick={() => window.print()}
          >
            Print / Save Receipt PDF
          </Button>
        </div>
      </div>
    </JudgeLayout>
  );
}

export default function JudgeConfirmationPage() {
  return (
    <Suspense fallback={<div className="p-12 text-center text-xs text-[#526070]">Loading submission receipt...</div>}>
      <ConfirmationContent />
    </Suspense>
  );
}
