'use client';

import React, { useState, useEffect } from 'react';
import { Participant } from '@/types/fest';
import { Modal } from '@/components/ui/Modal';
import { Button } from '@/components/ui/Button';
import { Printer, Download, QrCode } from 'lucide-react';
import { exportDigitalIdAsPng } from '@/utils/canvasExport';
import QRCode from 'qrcode';
import { encodeParticipantQrPayload } from '@/domain/greenRoom';

interface DigitalIdCardProps {
  participant: Participant | null;
  isOpen: boolean;
  onClose: () => void;
}

export const DigitalIdCard: React.FC<DigitalIdCardProps> = ({
  participant,
  isOpen,
  onClose
}) => {
  const [qrDataUrl, setQrDataUrl] = useState<string>('');

  useEffect(() => {
    if (!participant) {
      setQrDataUrl('');
      return;
    }

    const payload = encodeParticipantQrPayload({
      id: participant.id,
      bib: participant.bib,
      name: participant.name,
      teamCode: participant.teamCode
    });

    QRCode.toDataURL(payload, {
      width: 180,
      margin: 1,
      errorCorrectionLevel: 'M',
      color: {
        dark: '#111111',
        light: '#FFFFFF'
      }
    })
      .then(url => setQrDataUrl(url))
      .catch(err => {
        console.error('[DigitalIdCard] QR generation error:', err);
      });
  }, [participant]);

  if (!participant) return null;

  const handlePrint = () => {
    window.print();
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Official Participant Digital ID"
      description="Printable festival accreditation badge with security verification code"
      maxWidth="md"
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
              onClick={() => exportDigitalIdAsPng(participant)}
            >
              Download PNG
            </Button>
            <Button variant="primary" size="sm" leftIcon={<Printer className="w-4 h-4" />} onClick={handlePrint}>
              Print ID Badge
            </Button>
          </div>
        </div>
      }
    >
      <div className="flex justify-center py-2">
        {/* Printable Card */}
        <div className="w-[320px] rounded-2xl border-2 border-[#111111] overflow-hidden shadow-lg bg-white flex flex-col">
          {/* Top Banner */}
          <div className="bg-[#2563EB] text-white p-4 text-center relative">
            <span className="text-[10px] font-bold uppercase tracking-widest text-blue-200 block">
              OFFICIAL FESTIVAL PASS
            </span>
            <h4 className="text-base font-bold tracking-tight">SAHITHYOLSAV 2025</h4>
            <p className="text-[11px] text-blue-100">Annual Cultural &amp; Literary Festival</p>
            <div className="absolute top-2 right-2 px-1.5 py-0.5 rounded bg-white text-[#2563EB] text-[10px] font-bold">
              {participant.categoryName.toUpperCase()}
            </div>
          </div>

          {/* Photo & Bib */}
          <div className="p-5 flex flex-col items-center text-center bg-gradient-to-b from-blue-50/50 to-white">
            <div className="relative">
              <img
                src={participant.photoUrl || "https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=300&q=80"}
                alt={participant.name}
                className="w-24 h-24 rounded-full object-cover border-4 border-white shadow-md"
              />
              <span className="absolute bottom-0 right-0 bg-[#111111] text-white text-[11px] font-bold px-2 py-0.5 rounded-full border border-white">
                {participant.bib}
              </span>
            </div>

            <h3 className="mt-3 text-base font-bold text-[#111111]">{participant.name}</h3>
            <p className="text-xs text-[#526070]">{participant.classGrade} - Div {participant.division}</p>

            <div className="mt-3 inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-blue-50 border border-blue-200 text-[#2563EB] text-xs font-semibold">
              <span className="w-2 h-2 rounded-full bg-[#2563EB]" />
              {participant.teamName} ({participant.teamCode})
            </div>
          </div>

          {/* Metadata Grid */}
          <div className="px-5 py-3 border-t border-b border-[#E1E7EF] bg-[#F8FAFC] grid grid-cols-2 gap-2 text-left text-xs">
            <div>
              <span className="text-[10px] uppercase font-bold text-[#526070] block">Participant ID</span>
              <span className="font-semibold text-[#111111]">{participant.id.toUpperCase()}</span>
            </div>
            <div>
              <span className="text-[10px] uppercase font-bold text-[#526070] block">Category Tier</span>
              <span className="font-semibold text-[#111111]">{participant.categoryName}</span>
            </div>
            <div>
              <span className="text-[10px] uppercase font-bold text-[#526070] block">Events Registered</span>
              <span className="font-semibold text-[#111111]">{participant.registeredEventIds.length} Contests</span>
            </div>
            <div>
              <span className="text-[10px] uppercase font-bold text-[#526070] block">Security Auth</span>
              <span className="font-semibold text-emerald-600">VERIFIED</span>
            </div>
          </div>

          {/* QR Code & Barcode */}
          <div className="p-4 bg-white flex items-center justify-between">
            <div className="text-left">
              <span className="text-[9px] text-[#526070] uppercase font-medium block">Scan at Venue Gate &amp; Green Room</span>
              <span className="text-[10px] font-mono text-[#111111]">HASH: {participant.bib}-2025-AUTH-V2</span>
            </div>
            <div className="w-14 h-14 bg-white border border-[#E1E7EF] rounded-lg p-0.5 flex items-center justify-center shadow-xs">
              {qrDataUrl ? (
                <img
                  src={qrDataUrl}
                  alt={`QR Verification for ${participant.bib}`}
                  className="w-full h-full object-contain"
                />
              ) : (
                <QrCode className="w-8 h-8 text-neutral-400 animate-pulse" />
              )}
            </div>
          </div>
        </div>
      </div>
    </Modal>
  );
};
