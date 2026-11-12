'use client';

import React from 'react';
import { CompetitionResult } from '@/types/fest';
import { Modal } from '@/components/ui/Modal';
import { Button } from '@/components/ui/Button';
import { Printer, Download } from 'lucide-react';
import { ExportService } from '@/services/exportService';

interface TabulationPrintSheetProps {
  results: CompetitionResult[];
  isOpen: boolean;
  onClose: () => void;
  festTitle?: string;
  institutionName?: string;
}

export const TabulationPrintSheet: React.FC<TabulationPrintSheetProps> = ({
  results,
  isOpen,
  onClose,
  festTitle = 'OFFICIAL FESTIVAL RESULTS',
  institutionName = 'Festival Institution'
}) => {
  if (!isOpen) return null;

  const handlePrint = () => {
    const cleanup = () => document.body.classList.remove('print-tabulation-mode');
    document.body.classList.add('print-tabulation-mode');
    window.addEventListener('afterprint', cleanup, { once: true });
    try {
      window.print();
    } catch {
      cleanup();
    }
  };

  const handleExportPDF = () => {
    const rows = ExportService.getOfficialPublishedWinners(results);
    const safeName = (festTitle || 'Festival').trim().replace(/\s+/g, '_') || 'Festival';
    ExportService.downloadWinnersPDF(
      rows,
      festTitle,
      institutionName,
      safeName + '_Official_Published_Tabulation.pdf'
    );
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Official Published Results Register"
      description="Official published results with grades and awarded points"
      maxWidth="4xl"
      footer={
        <div className="flex w-full flex-col-reverse gap-2 sm:flex-row sm:items-center sm:justify-between">
          <Button variant="outline" size="sm" onClick={onClose}>
            Close
          </Button>
          <div className="flex flex-col gap-2 sm:flex-row">
            <Button
              variant="secondary"
              size="sm"
              leftIcon={<Download className="w-4 h-4" />}
              onClick={handleExportPDF}
            >
              Export PDF
            </Button>
            <Button
              variant="primary"
              size="sm"
              leftIcon={<Printer className="w-4 h-4" />}
              onClick={handlePrint}
            >
              Print Official Results
            </Button>
          </div>
        </div>
      }
    >
      {/* Formal Printable Document Layout */}
      <div id="tabulation-print-document" className="rounded-xl border border-[#E1E7EF] bg-white p-4 shadow-sm sm:p-8 print:border-none print:shadow-none print:p-0">
        {/* Document Header */}
        <div className="text-center pb-6 border-b-2 border-neutral-900">
          <div className="text-xs uppercase tracking-widest text-[#526070] font-bold">
            INSTITUTIONAL ARTS &amp; LITERARY FESTIVAL
          </div>
          <h2 className="text-2xl font-black text-[#111111] uppercase tracking-wide mt-1">
            {festTitle}
          </h2>
          <p className="text-xs text-[#526070] font-medium mt-0.5">
            {institutionName} · Official Central Tabulation Register
          </p>
          <div className="mt-3 inline-flex items-center gap-3 text-xs text-[#111111] font-semibold bg-[#F8FAFC] px-4 py-1.5 rounded-full border border-[#E1E7EF]">
            <span>Date Generated: {new Date().toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}</span>
            <span>•</span>
            <span>Security Status: OFFICIALLY SEALED</span>
          </div>
        </div>

        {/* Competitions Table */}
        <div className="mt-6 space-y-6">
          {results.map((res) => (
            <div key={res.id} className="border border-[#E1E7EF] rounded-lg overflow-hidden">
              {/* Event Subheader */}
              <div className="flex flex-col gap-1 border-b border-[#E1E7EF] bg-[#F8FAFC] px-3 py-3 sm:flex-row sm:items-center sm:justify-between sm:px-4">
                <div>
                  <span className="text-[11px] font-mono font-bold text-[#2563EB] mr-2">[{res.competitionCode}]</span>
                  <span className="text-sm font-bold text-[#111111]">{res.competitionName}</span>
                </div>
                <div className="text-xs text-[#526070]">
                  <span className="font-semibold">{res.categoryName}</span> · <span>{res.type}</span> · <span>Venue: {res.stageName}</span>
                </div>
              </div>

              {/* Ranks Table */}
              <div className="overflow-x-auto"><table className="w-full min-w-[760px] text-left text-xs">
                <thead>
                  <tr className="border-b border-[#E1E7EF] bg-white text-[#526070] uppercase font-bold text-[10px]">
                    <th className="py-2 px-3 w-16">Rank</th>
                    <th className="py-2 px-3">Candidate / Group</th>
                    <th className="py-2 px-3">Chest / Bib</th>
                    <th className="py-2 px-3">House Contingent</th>
                    <th className="py-2 px-3 text-center">Grade</th>
                    <th className="py-2 px-3 text-right">Points Earned</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#E1E7EF]">
                  {res.ranks.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="py-3 text-center text-[#526070] italic">
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
                        <td className="py-2 px-3 text-center font-bold text-[#2563EB]">
                          Grade {rk.grade}
                        </td>
                        <td className="py-2 px-3 text-right font-bold text-emerald-600">
                          +{rk.officialPoints ?? rk.totalEarnedPoints ?? 0} pts
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table></div>
            </div>
          ))}
        </div>

        {/* Signature Box */}
        <div className="mt-10 grid grid-cols-1 gap-5 border-t border-neutral-300 pt-7 text-center text-xs sm:grid-cols-3 sm:gap-6">
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
      <style jsx global>{"\n#tabulation-print-document { background: #fff; color: #111827; }\n@media print {\n  @page { size: A4 landscape; margin: 10mm; }\n  body.print-tabulation-mode, body.print-tabulation-mode * { visibility: hidden !important; }\n  body.print-tabulation-mode #tabulation-print-document,\n  body.print-tabulation-mode #tabulation-print-document * { visibility: visible !important; }\n  body.print-tabulation-mode #tabulation-print-document {\n    display: block !important;\n    position: absolute !important;\n    top: 0 !important;\n    left: 0 !important;\n    width: 100% !important;\n    border: 0 !important;\n    border-radius: 0 !important;\n    box-shadow: none !important;\n    padding: 0 !important;\n    font-size: 8pt !important;\n  }\n  #tabulation-print-document { -webkit-print-color-adjust: exact; print-color-adjust: exact; }\n  #tabulation-print-document .overflow-x-auto { overflow: visible !important; }\n  #tabulation-print-document table { page-break-inside: auto; }\n  #tabulation-print-document tr { break-inside: avoid; page-break-inside: avoid; }\n}"}</style>
    </Modal>
  );
};
