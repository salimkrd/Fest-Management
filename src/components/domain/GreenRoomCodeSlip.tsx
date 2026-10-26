'use client';

import React from 'react';
import { Modal } from '@/components/ui/Modal';
import { useFest } from '@/context/FestContext';
import { FestivalLogo } from '@/components/domain/FestivalBrand';
import { Button } from '@/components/ui/Button';
import { Printer, ShieldAlert, Award, Sparkles } from 'lucide-react';
import { FirestoreGreenRoomAssignment } from '@/types/firestore';

interface GreenRoomCodeSlipProps {
  isOpen: boolean;
  onClose: () => void;
  assignment: FirestoreGreenRoomAssignment | null;
}

export const GreenRoomCodeSlip: React.FC<GreenRoomCodeSlipProps> = ({
  isOpen,
  onClose,
  assignment
}) => {
  const { theme } = useFest();
  if (!assignment) return null;

  const handlePrint = () => {
    window.print();
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Official Anonymous Stage Entry Slip"
      description="Printable accreditation slip for the contestant to carry backstage"
      maxWidth="md"
      footer={
        <div className="flex items-center justify-between w-full">
          <Button variant="outline" size="sm" onClick={onClose}>
            Close
          </Button>
          <Button
            variant="primary"
            size="sm"
            leftIcon={<Printer className="w-4 h-4" />}
            onClick={handlePrint}
          >
            Print Code Slip
          </Button>
        </div>
      }
    >
      <div className="flex justify-center py-2">
        {/* Printable Thermal/Badge Card */}
        <div
          id="printable-code-slip"
          className="w-[320px] rounded-2xl border-2 border-[#111111] overflow-hidden shadow-lg bg-white flex flex-col text-center"
        >
          {/* Header */}
          <div className="bg-[#111111] text-white p-3.5">
            {theme.logoUrl && <div className="flex justify-center mb-1"><FestivalLogo size={28} /></div>}
            <span className="text-[10px] font-bold uppercase tracking-widest text-neutral-400 block">
              GREEN ROOM ENTRY SLIP
            </span>
            <h4 className="text-sm font-extrabold tracking-tight">{theme.festivalName}</h4>
            <p className="text-[11px] text-neutral-300">Annual Cultural &amp; Literary Festival</p>
          </div>

          {/* Competition Context */}
          <div className="p-3 bg-neutral-50 border-b border-[#E1E7EF] text-xs">
            <div className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded font-mono font-bold bg-blue-50 text-[#2563EB] border border-blue-200 text-[11px] mb-1">
              {assignment.competitionCode}
            </div>
            <h3 className="font-extrabold text-[#111111] text-sm leading-tight">
              {assignment.competitionName}
            </h3>
            <p className="text-[11px] text-[#526070] mt-0.5">
              Category: <strong>{assignment.categoryName}</strong> · Stage: <strong>{assignment.stageName}</strong>
            </p>
          </div>

          {/* GIANT Code Letter Box */}
          <div className="py-6 px-4 bg-white flex flex-col items-center justify-center border-b border-[#E1E7EF]">
            <span className="text-[11px] font-bold uppercase text-[#526070] tracking-wider mb-1">
              Your Anonymous Jury Code
            </span>
            <div className="w-28 h-28 rounded-2xl bg-[#2563EB] text-white flex items-center justify-center shadow-md border-4 border-blue-100 my-1">
              <span className="text-6xl font-black font-mono tracking-wider">
                {assignment.codeLetter}
              </span>
            </div>
            <span className="text-[11px] font-semibold text-[#111111] mt-2">
              Appearance Order #{assignment.codeIndex + 1}
            </span>
          </div>

          {/* Confidentiality Rules Notice */}
          <div className="p-4 bg-amber-50/70 border-b border-amber-200 text-left text-[11px] space-y-1.5 text-amber-900">
            <div className="flex items-center gap-1.5 font-bold text-amber-950">
              <ShieldAlert className="w-3.5 h-3.5 text-amber-600 shrink-0" />
              <span>STRICT ANONYMITY RULES</span>
            </div>
            <ul className="list-disc pl-4 space-y-1 text-[10px] leading-tight">
              <li>Announce <strong>ONLY</strong> your Code Letter ({assignment.codeLetter}) when entering the stage.</li>
              <li>Do <strong>NOT</strong> disclose your name, team, chest number, or institution to the judges.</li>
              <li>Hand this slip to the Stage Manager upon entering performance area.</li>
            </ul>
          </div>

          {/* Verification Barcode Footer */}
          <div className="p-3 bg-white flex items-center justify-between text-left text-[10px]">
            <div>
              <span className="text-[#526070] block">Participant Ref:</span>
              <span className="font-mono font-bold text-[#111111]">
                {assignment.chestNumber ? `CHEST #${assignment.chestNumber}` : assignment.registrationCode}
              </span>
            </div>
            <div className="text-right">
              <span className="text-[#526070] block">Checked In:</span>
              <span className="font-semibold text-[#111111]">
                {new Date(assignment.checkedInAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
              </span>
            </div>
          </div>
        </div>
      </div>
    </Modal>
  );
};
