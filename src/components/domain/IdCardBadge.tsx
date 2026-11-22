'use client';

import React, { useMemo } from 'react';
import type { Participant } from '@/types/fest';
import { extractIdCardData, buildIdCardSvg, type IdCardAssets } from '@/domain/idCardSvg';
import { getParticipantInitials, isStockPhotoPlaceholder } from '@/components/domain/ParticipantPhoto';

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
 * Powered by the canonical SVG renderer (buildIdCardSvg) ensuring 100% visual parity across:
 * - Admin ID Card Preview
 * - Team Manager ID Card Preview
 * - Participant ID Card Preview
 * - Physical 74mm x 105mm Print
 */
export const IdCardBadge: React.FC<IdCardBadgeProps> = ({
  participant,
  festivalName,
  institutionName,
  festivalNameFont,
  qrDataUrl,
  signedToken,
  className = ''
}) => {
  const cardData = useMemo(() => {
    return extractIdCardData(participant, {
      festivalName,
      institutionName,
      festivalNameFont,
      token: signedToken
    });
  }, [participant, festivalName, institutionName, festivalNameFont, signedToken]);

  const assets: IdCardAssets = useMemo(() => {
    const rawPhoto = participant.photoUrl?.trim();
    const validPhoto = rawPhoto && !isStockPhotoPlaceholder(rawPhoto) ? rawPhoto : undefined;

    return {
      photoDataUri: validPhoto,
      qrDataUri: qrDataUrl,
      photoFallbackInitials: getParticipantInitials(participant.name)
    };
  }, [participant.photoUrl, participant.name, qrDataUrl]);

  const svgMarkup = useMemo(() => {
    return buildIdCardSvg(cardData, assets);
  }, [cardData, assets]);

  return (
    <div
      data-testid="participant-id-card"
      data-status="VERIFIED"
      className={`id-card-element relative flex items-center justify-center bg-white text-[#111827] select-none overflow-hidden ${className}`}
      style={{
        aspectRatio: '74 / 105',
        width: '100%',
        fontFamily: 'var(--font-montserrat), system-ui, -apple-system, sans-serif'
      }}
      dangerouslySetInnerHTML={{ __html: svgMarkup }}
    />
  );
};
