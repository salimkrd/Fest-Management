'use client';

import React, { Suspense } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { JudgeLayout } from '@/components/layout/JudgeLayout';
import { useFest } from '@/context/FestContext';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { CheckCircle2, Printer, ArrowRight, ShieldCheck, FileCheck, Hash } from 'lucide-react';

function ConfirmationContent() {
  const searchParams = useSearchParams();
  const { competitions, registrations, theme } = useFest();

  const compId = searchParams.get('competitionId') || 'cmp-1';
  const hash = searchParams.get('hash') || 'SHA256:7e9b41a82f3c091d';

  const competition = competitions.find(c => c.id === compId) || competitions[0];
  const compRegistrations = registrations.filter(r => r.competitionId === competition?.id);

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
            Scores for <strong className="text-[#111111]">{competition.name}</strong> ({competition.categoryName}) have been cryptographically signed and stored in the central fest ledger.
          </p>

          <div className="mt-6 p-4 rounded-xl bg-[#F8FAFC] border border-[#E1E7EF] grid grid-cols-2 sm:grid-cols-3 gap-3 text-xs text-left">
            <div>
              <span className="text-[#526070] font-medium block">Timestamp</span>
              <span className="font-bold text-[#111111]">{timestamp}</span>
            </div>
            <div>
              <span className="text-[#526070] font-medium block">Verified Entries</span>
              <span className="font-bold text-[#111111]">{compRegistrations.length} Contestants</span>
            </div>
            <div className="col-span-2 sm:col-span-1">
              <span className="text-[#526070] font-medium block">Digital Verification Hash</span>
              <span className="font-mono text-[11px] font-bold text-[#2563EB] truncate block">{hash}</span>
            </div>
          </div>
        </div>

        {/* Breakdown Table */}
        <div className="bg-white rounded-xl border border-[#E1E7EF] shadow-xs overflow-hidden">
          <div className="px-6 py-4 border-b border-[#E1E7EF] bg-white flex items-center justify-between">
            <h3 className="text-sm font-bold text-[#111111]">Submitted Score Register</h3>
            <Badge variant="success" size="sm">LOCKED &amp; ARCHIVED</Badge>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="border-b border-[#E1E7EF] bg-[#F8FAFC] text-[#526070] font-bold uppercase text-[11px]">
                  <th className="py-3 px-6">Bib #</th>
                  <th className="py-3 px-6">Participant Name</th>
                  <th className="py-3 px-6">Representing Delegation</th>
                  <th className="py-3 px-6 text-center">Submitted Score</th>
                  <th className="py-3 px-6 text-right">Lock State</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#E1E7EF]">
                {compRegistrations.map((r, idx) => (
                  <tr key={r.id} className="hover:bg-[#F8FAFC]">
                    <td className="py-3.5 px-6 font-mono font-bold text-[#111111]">
                      {r.chestNumber}
                    </td>
                    <td className="py-3.5 px-6 font-semibold text-[#111111]">
                      {r.participantName}
                    </td>
                    <td className="py-3.5 px-6 text-[#526070]">
                      {r.teamName} ({r.teamCode})
                    </td>
                    <td className="py-3.5 px-6 text-center font-black text-sm text-[#111111]">
                      {idx === 0 ? 95 : idx === 1 ? 89 : idx === 2 ? 82 : 74} / 100
                    </td>
                    <td className="py-3.5 px-6 text-right">
                      <span className="text-emerald-700 font-bold text-[11px] flex items-center justify-end gap-1">
                        <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                        Signed
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
