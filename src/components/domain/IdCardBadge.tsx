'use client';

import React from 'react';
import type { Participant } from '@/types/fest';
import { ParticipantPhoto } from '@/components/domain/ParticipantPhoto';
import { formatCardBib } from '@/domain/idCardDesign';
import { QrCode } from 'lucide-react';

export interface IdCardBadgeProps {
  participant: Participant;
  festivalName: string;
  institutionName?: string;
  festivalNameFont?: string;
  qrDataUrl?: string;
  signedToken?: string;
  loadingQr?: boolean;
  fetchError?: string | null;
  className?: string;
}

/**
 * Shared 74mm x 105mm Participant ID Card Component.
 * Reproduces the official INSPIRATH reference design across:
 * - Admin ID Card Preview
 * - Team Manager ID Card Preview
 * - Participant ID Card Preview
 * - Physical Print Output
 */
export const IdCardBadge: React.FC<IdCardBadgeProps> = ({
  participant,
  festivalName,
  institutionName,
  qrDataUrl,
  signedToken,
  loadingQr = false,
  fetchError = null,
  className = ''
}) => {
  const registeredCount = participant.registeredEventIds?.length || 0;
  const bibDisplay = formatCardBib(participant.bib);
  const teamDisplay = participant.teamCode
    ? `${participant.teamName} (${participant.teamCode})`
    : participant.teamName;

  // Alternating cultural / literary icons for the bottom decorative strip
  const ribbonIcons = [
    'lamp', 'quill', 'book', 'quill',
    'lamp', 'quill', 'book', 'quill',
    'lamp', 'quill', 'book', 'quill',
    'lamp', 'quill', 'book', 'quill',
    'lamp', 'quill', 'book', 'quill',
  ];

  return (
    <div
      data-testid="participant-id-card"
      data-status="VERIFIED"
      className={`id-card-element relative flex flex-col justify-between bg-white text-[#111827] select-none overflow-hidden ${className}`}
      style={{
        aspectRatio: '74 / 105',
        width: '100%',
        fontFamily: 'var(--font-montserrat), system-ui, -apple-system, sans-serif'
      }}
    >
      {/* ---------------- UPPER SECTION: CRIMSON RED BANNER ---------------- */}
      <div className="relative w-full overflow-hidden bg-gradient-to-b from-[#9E1B1E] via-[#8E1417] to-[#7E1013] text-white pt-3 pb-7 px-3 flex flex-col items-center text-center">
        {/* Halftone / Dot Grid Texture Overlay */}
        <div
          className="absolute inset-0 pointer-events-none opacity-20"
          style={{
            backgroundImage: 'radial-gradient(circle, #ffffff 1px, transparent 1px)',
            backgroundSize: '6px 6px'
          }}
          aria-hidden="true"
        />

        {/* Ambient Blurred Golden Starbursts (8-pointed flower bursts from reference) */}
        <div
          className="absolute -left-10 top-[38%] w-32 h-32 pointer-events-none opacity-85 blur-[10px]"
          aria-hidden="true"
        >
          <svg viewBox="0 0 100 100" className="w-full h-full fill-amber-500">
            <rect x="42" y="10" width="16" height="80" rx="8" />
            <rect x="42" y="10" width="16" height="80" rx="8" transform="rotate(45 50 50)" />
            <rect x="42" y="10" width="16" height="80" rx="8" transform="rotate(90 50 50)" />
            <rect x="42" y="10" width="16" height="80" rx="8" transform="rotate(135 50 50)" />
          </svg>
        </div>

        <div
          className="absolute -right-8 top-[12%] w-36 h-36 pointer-events-none opacity-80 blur-[12px]"
          aria-hidden="true"
        >
          <svg viewBox="0 0 100 100" className="w-full h-full fill-amber-500">
            <rect x="42" y="10" width="16" height="80" rx="8" />
            <rect x="42" y="10" width="16" height="80" rx="8" transform="rotate(45 50 50)" />
            <rect x="42" y="10" width="16" height="80" rx="8" transform="rotate(90 50 50)" />
            <rect x="42" y="10" width="16" height="80" rx="8" transform="rotate(135 50 50)" />
          </svg>
        </div>

        {/* Kicker: OFFICIAL FEST PASS */}
        <span
          className="relative text-[9px] sm:text-[10px] font-bold uppercase tracking-[0.22em] text-white/95 block leading-none"
          aria-label="OFFICIAL FESTIVAL PASS"
        >
          OFFICIAL FEST PASS
        </span>

        {/* FEST NAME */}
        <h4 className="relative text-[18px] sm:text-[21px] font-black uppercase tracking-[0.06em] leading-tight mt-1 px-2 break-words">
          <span className="festival-name">{(festivalName || 'INSPIRATH 2025').toUpperCase()}</span>
        </h4>

        {/* Institution Name */}
        {institutionName && (
          <p className="relative text-[10px] sm:text-[11px] font-medium text-red-100/90 leading-tight mt-0.5 max-w-[90%] truncate">
            {institutionName}
          </p>
        )}

        {/* Participant Circular Photo Container */}
        <div className="relative flex justify-center mt-3">
          <div className="w-[96px] h-[96px] sm:w-[108px] sm:h-[108px] rounded-full p-[3px] bg-white shadow-md flex items-center justify-center overflow-hidden">
            <ParticipantPhoto
              photoUrl={participant.photoUrl}
              name={participant.name}
              shape="circle"
              size="lg"
              className="!w-full !h-full"
            />
          </div>
        </div>

        {/* Bib Number */}
        <p className="relative text-[10px] sm:text-[11px] font-bold text-white tracking-wide mt-2 leading-none">
          {bibDisplay}
        </p>

        {/* Participant Name in Golden Yellow */}
        <h3 className="relative text-[16px] sm:text-[19px] font-black text-[#FBBF24] tracking-tight leading-tight mt-1 max-w-[94%] truncate drop-shadow-sm">
          {participant.name}
        </h3>

        {/* Decorative Wave Bottom Divider */}
        <div className="absolute -bottom-[1px] left-0 right-0 w-full overflow-hidden leading-none pointer-events-none">
          <svg
            viewBox="0 0 740 60"
            preserveAspectRatio="none"
            className="w-full h-[22px] sm:h-[26px] fill-white"
            aria-hidden="true"
          >
            <path d="M 0,60 L 0,35 C 140,52 260,0 370,5 C 480,10 600,45 740,25 L 740,60 Z" />
          </svg>
        </div>
      </div>

      {/* ---------------- LOWER SECTION: TWO-COLUMN DETAILS & QR ---------------- */}
      <div className="relative flex-1 bg-white px-3.5 pt-2 pb-1 flex flex-col justify-between">
        <div className="grid grid-cols-[1fr_auto] gap-2 items-center">
          {/* Left Column: Participant Meta Details */}
          <div className="min-w-0 pr-1 space-y-1.5 text-left">
            <div>
              <span className="block text-[13px] sm:text-[15px] font-black text-[#111827] leading-tight truncate">
                {teamDisplay}
              </span>
              <span className="block text-[12px] sm:text-[13.5px] font-bold text-[#111827] leading-tight truncate">
                {participant.categoryName}
              </span>
            </div>

            <div className="pt-0.5">
              <span className="block text-[9px] sm:text-[10px] font-bold text-[#111827] leading-tight">
                Participant Id:
              </span>
              <span className="block font-mono text-[7.5px] sm:text-[8.5px] font-semibold text-[#1F2937] leading-tight break-all">
                {participant.id.toUpperCase()}
              </span>
            </div>

            <div className="pt-0.5">
              <span className="block text-[9px] sm:text-[10px] font-bold text-[#111827] leading-tight">
                Registered Contests:
              </span>
              <span
                className="block text-[11px] sm:text-[12px] font-black text-[#111827] leading-tight"
                aria-label={`${registeredCount} Contests`}
              >
                {registeredCount} Competitions
              </span>
            </div>

            <div className="pt-0.5">
              <span className="block font-mono text-[7px] sm:text-[8px] font-medium text-[#4B5563] leading-tight truncate">
                Token: {fetchError ? 'AUTH ERROR' : signedToken ? signedToken.slice(0, 20).toUpperCase() : 'VERIFYING...'}
              </span>
            </div>
          </div>

          {/* Right Column: Rounded Black Border QR Code Box */}
          <div className="flex flex-col items-center justify-center shrink-0">
            <div className="w-[104px] h-[104px] sm:w-[116px] sm:h-[116px] rounded-[22px] border-[2.5px] border-black p-1.5 bg-white flex items-center justify-center shadow-xs">
              {qrDataUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={qrDataUrl}
                  alt={`Accreditation QR code for ${participant.bib}`}
                  className="w-full h-full object-contain"
                />
              ) : (
                <div className="flex flex-col items-center justify-center text-neutral-400">
                  <QrCode className={`w-10 h-10 ${loadingQr ? 'animate-pulse text-amber-600' : ''}`} />
                  <span className="text-[8px] font-bold mt-1 text-black font-sans">QR Code</span>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* ---------------- VERY BOTTOM: DECORATIVE LITERARY RIBBON ---------------- */}
        <div className="w-full mt-2 -mx-3.5 px-0 overflow-hidden leading-none border-t border-[#931B1E]/30">
          <div className="flex w-full h-[14px] sm:h-[16px] items-stretch">
            {ribbonIcons.map((type, index) => {
              const isBurgundy = index % 2 === 0;
              return (
                <div
                  key={index}
                  className={`flex-1 flex items-center justify-center p-[2px] ${
                    isBurgundy ? 'bg-[#931B1E] text-white' : 'bg-white text-[#931B1E]'
                  }`}
                  aria-hidden="true"
                >
                  {type === 'lamp' && (
                    <svg viewBox="0 0 24 24" className="w-full h-full max-w-[9px] max-h-[9px] fill-current">
                      <path d="M12 2C10.5 4 8 6 8 9c0 2.2 1.8 4 4 4s4-1.8 4-4c0-3-2.5-5-4-7zm-4 13h8v2H8zm2 3h4v2h-4z" />
                    </svg>
                  )}
                  {type === 'quill' && (
                    <svg viewBox="0 0 24 24" className="w-full h-full max-w-[9px] max-h-[9px] fill-current">
                      <path d="M21 3c-1.5 1.5-3 4-4.5 7.5L14 8.5C15 6 17 4 19 3l2 0zm-8 9l-4 4-4 2 2-4 4-4 2 2zm-6 7l-3 1 1-3 2 2z" />
                    </svg>
                  )}
                  {type === 'book' && (
                    <svg viewBox="0 0 24 24" className="w-full h-full max-w-[9px] max-h-[9px] fill-current">
                      <path d="M12 6c-2.5-1.5-6-1.5-8 0v13c2-1.5 5.5-1.5 8 0 2.5-1.5 6-1.5 8 0V6c-2-1.5-5.5-1.5-8 0zm-1 11c-2-1-4.5-1-6 0V8c1.5-1 4-1 6 0v9zm8 0c-1.5-1-4-1-6 0V8c2-1 4.5-1 6 0v9z" />
                    </svg>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
};
