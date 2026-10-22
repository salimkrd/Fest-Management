'use client';

import React from 'react';
import { CompetitionResult } from '@/types/fest';
import { Modal } from '@/components/ui/Modal';
import { Button } from '@/components/ui/Button';
import { Printer, Download } from 'lucide-react';

interface TabulationPrintSheetProps {
  results: CompetitionResult[];
  isOpen: boolean;
  onClose: () => void;
  festTitle?: string;
}

export const TabulationPrintSheet: React.FC<TabulationPrintSheetProps> = ({
  results,
  isOpen,
  onClose,
  festTitle = 'SAHITHYOLSAV FESTIVAL 2025'
}) => {
  if (!isOpen) return null;

  const handlePrint = () => {
    window.print();
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Official Tabulation Sheet (Printable Register)"
      description="Formal signed certificate document of verified festival contest rankings"
      maxWidth="4xl"
      footer={
        <div className="flex items-center justify-between w-full">
          <Button variant="outline" size="sm" onClick={onClose}>
            Close
          </Button>
          <div className="flex items-center gap-2">
            <Button
              variant="secondary"
              size="sm"
              leftIcon={<Download className="w-4 h-4" />}
              onClick={() => alert('Exporting Tabulation Register as PDF...')}
            >
              Export PDF
            </Button>
            <Button
              variant="primary"
              size="sm"
              leftIcon={<Printer className="w-4 h-4" />}
              onClick={handlePrint}
            >
              Print Official Sheet
            </Button>
          </div>
        </div>
      }
    >
      {/* Formal Printable Document Layout */}
      <div className="p-8 bg-white border border-[#E1E7EF] rounded-xl shadow-xs print:border-none print:shadow-none print:p-0">
        {/* Document Header */}
        <div className="text-center pb-6 border-b-2 border-neutral-900">
          <div className="text-xs uppercase tracking-widest text-[#526070] font-bold">
            INSTITUTIONAL ARTS &amp; LITERARY FESTIVAL
          </div>
          <h2 className="text-2xl font-black text-[#111111] uppercase tracking-wide mt-1">
            {festTitle}
          </h2>
          <p className="text-xs text-[#526070] font-medium mt-0.5">
            Markaz Knowledge City · Official Central Tabulation Register
          </p>
          <div className="mt-3 inline-flex items-center gap-3 text-xs text-[#111111] font-semibold bg-[#F8FAFC] px-4 py-1.5 rounded-full border border-[#E1E7EF]">
            <span>Date Generated: {new Date().toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}</span>
            <span>•</span>
            <span>Security Status: OFFICIALLY SEALED</span>
          </div>
        </div>

        {/* Competitions Table */}
        <div className="mt-6 space-y-6">
          {results.map((res, index) => (
            <div key={res.id} className="border border-[#E1E7EF] rounded-lg overflow-hidden">
              {/* Event Subheader */}
              <div className="bg-[#F8FAFC] px-4 py-2.5 border-b border-[#E1E7EF] flex items-center justify-between">
                <div>
                  <span className="text-[11px] font-mono font-bold text-[#2563EB] mr-2">[{res.competitionCode}]</span>
                  <span className="text-sm font-bold text-[#111111]">{res.competitionName}</span>
                </div>
                <div className="text-xs text-[#526070]">
                  <span className="font-semibold">{res.categoryName}</span> · <span>{res.type}</span> · <span>Venue: {res.stageName}</span>
                </div>
              </div>

              {/* Ranks Table */}
              <table className="w-full text-left text-xs">
                <thead>
                  <tr className="border-b border-[#E1E7EF] bg-white text-[#526070] uppercase font-bold text-[10px]">
                    <th className="py-2 px-3 w-16">Rank</th>
                    <th className="py-2 px-3">Candidate / Group</th>
                    <th className="py-2 px-3">Chest / Bib</th>
                    <th className="py-2 px-3">House Contingent</th>
                    <th className="py-2 px-3 text-center">Score</th>
                    <th className="py-2 px-3 text-center">Grade</th>
                    <th className="py-2 px-3 text-right">Points Earned</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#E1E7EF]">
                  {res.ranks.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="py-3 text-center text-[#526070] italic">
                        Results under review / No public ranks published yet.
                      </td>
                    </tr>
                  ) : (
                    res.ranks.map(rk => (
                      <tr key={rk.registrationId} className="hover:bg-[#F8FAFC]">
                        <td className="py-2 px-3 font-bold text-[#111111]">
                          {rk.rank === 1 ? '1st Place' : rk.rank === 2 ? '2nd Place' : '3rd Place'}
                        </td>
                        <td className="py-2 px-3 font-semibold text-[#111111]">{rk.candidateName}</td>
                        <td className="py-2 px-3 font-mono text-[#526070]">{rk.bib}</td>
                        <td className="py-2 px-3">
                          <span className="font-medium text-[#111111]">{rk.teamName}</span> ({rk.teamCode})
                        </td>
                        <td className="py-2 px-3 text-center font-bold text-[#111111]">{rk.score}</td>
                        <td className="py-2 px-3 text-center font-bold text-[#2563EB]">
                          Grade {rk.grade}
                        </td>
                        <td className="py-2 px-3 text-right font-bold text-emerald-600">
                          +{rk.totalEarnedPoints} pts
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          ))}
        </div>

        {/* Signature Box */}
        <div className="mt-12 pt-8 border-t border-neutral-300 grid grid-cols-3 gap-6 text-center text-xs">
          <div>
            <div className="h-12 border-b border-dashed border-neutral-400 mb-2" />
            <span className="font-bold text-[#111111] block">Chief Jury Evaluator</span>
            <span className="text-[10px] text-[#526070]">Central Board of Adjudication</span>
          </div>
          <div>
            <div className="h-12 border-b border-dashed border-neutral-400 mb-2" />
            <span className="font-bold text-[#111111] block">General Convener</span>
            <span className="text-[10px] text-[#526070]">Fest Executive Council</span>
          </div>
          <div>
            <div className="h-12 border-b border-dashed border-neutral-400 mb-2" />
            <span className="font-bold text-[#111111] block">Festival Director</span>
            <span className="text-[10px] text-[#526070]">Institutional Seal &amp; Authority</span>
          </div>
        </div>
      </div>
    </Modal>
  );
};
