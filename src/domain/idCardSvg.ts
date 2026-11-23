/**
 * Canonical SVG ID Card Renderer.
 * The same artwork is embedded for Preview/Print and rasterized for PNG Download.
 */

import type { Participant } from '@/types/fest';
import { FESTIVAL_NAME_FONTS, DEFAULT_FESTIVAL_NAME_FONT } from '@/domain/festivalFonts';
import { getParticipantInitials } from '@/components/domain/ParticipantPhoto';
import {
  ID_CARD_DIMENSIONS,
  ID_CARD_COLORS,
  ID_CARD_LAYOUT,
  formatCardBib,
  formatRegisteredContests
} from '@/domain/idCardDesign';

export interface IdCardData {
  festivalName: string;
  institutionName?: string;
  festivalNameFont?: string;
  participantName: string;
  place?: string;
  bib: string;
  teamName: string;
  categoryName: string;
  registeredCompetitionsCount: number | null;
}

export interface IdCardAssets {
  photoDataUri?: string;
  qrDataUri?: string;
  photoFallbackInitials?: string;
}

/** Escapes untrusted data before embedding it in SVG text or attributes. */
export function escapeXml(value?: string | null): string {
  if (!value) return '';
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

export function extractIdCardData(
  participant: Participant,
  options?: {
    festivalName?: string;
    institutionName?: string;
    festivalNameFont?: string;
    registeredCompetitionsCount?: number | null;
  }
): IdCardData {
  return {
    festivalName: options?.festivalName || 'INSPIRATH',
    institutionName: options?.institutionName,
    festivalNameFont: options?.festivalNameFont,
    participantName: participant.name,
    place: participant.place || '',
    bib: participant.bib,
    teamName: participant.teamName,
    categoryName: participant.categoryName,
    registeredCompetitionsCount: options && 'registeredCompetitionsCount' in options
      ? options.registeredCompetitionsCount ?? null
      : participant.registeredEventIds?.length || 0,
  };
}

const fitFont = (length: number, width: number, max: number, min = 18, factor = 0.56) =>
  Math.max(min, Math.min(max, Math.floor(width / Math.max(length * factor, 1))));

/** Builds the exact 740 × 1050 SVG composition used by every ID output. */
export function buildIdCardSvg(data: IdCardData, assets: IdCardAssets = {}): string {
  const width = ID_CARD_DIMENSIONS.baseWidth;
  const height = ID_CARD_DIMENSIONS.baseHeight;
  const layout = ID_CARD_LAYOUT;
  const header = layout.header;
  const detail = layout.details;
  const qr = layout.qr;

  const festival = escapeXml(data.festivalName.toUpperCase());
  const institution = escapeXml(data.institutionName || '');
  const name = escapeXml(data.participantName);
  const place = escapeXml(data.place?.trim() || 'Place not added');
  const bib = escapeXml(formatCardBib(data.bib));
  const team = escapeXml(data.teamName || '—');
  const category = escapeXml(data.categoryName || '—');
  const contests = escapeXml(formatRegisteredContests(data.registeredCompetitionsCount));
  const initials = escapeXml(assets.photoFallbackInitials || getParticipantInitials(data.participantName) || 'P');

  const festivalFont = FESTIVAL_NAME_FONTS.find(font => font.name === data.festivalNameFont)
    || FESTIVAL_NAME_FONTS.find(font => font.name === DEFAULT_FESTIVAL_NAME_FONT)!;
  const festivalFontFamily = festivalFont.name === 'Montserrat'
    ? 'Montserrat, Arial, sans-serif'
    : `${festivalFont.name}, Montserrat, Arial, sans-serif`;

  const festivalFontSize = fitFont(data.festivalName.length, 620, 58, 28, 0.62);
  const participantFontSize = fitFont(data.participantName.length, 650, 48, 25, 0.58);
  const placeFontSize = fitFont(data.place?.length || 14, 600, 28, 18, 0.58);
  const teamFontSize = fitFont(data.teamName.length, detail.maxTextWidth, 25, 15, 0.55);
  const categoryFontSize = fitFont(data.categoryName.length, detail.maxTextWidth, 25, 15, 0.55);

  let photoSvg = '';
  if (assets.photoDataUri) {
    photoSvg = `<image data-testid="participant-photo-image" href="${escapeXml(assets.photoDataUri)}" x="${header.photo.x}" y="${header.photo.y}" width="${header.photo.size}" height="${header.photo.size}" preserveAspectRatio="xMidYMid slice" clip-path="url(#participant-photo-clip)" />`;
  } else {
    photoSvg = `
      <g data-testid="participant-photo-fallback" aria-label="Photo placeholder for ${name}">
        <circle cx="${header.photo.centerX}" cy="${header.photo.centerY}" r="${header.photo.radius}" fill="#F3F4F6" />
        <g data-testid="participant-silhouette" clip-path="url(#participant-photo-clip)">
          <circle cx="${header.photo.centerX}" cy="${header.photo.centerY - 28}" r="48" fill="#D1D5DB" />
          <ellipse cx="${header.photo.centerX}" cy="${header.photo.centerY + 65}" rx="78" ry="54" fill="#D1D5DB" />
        </g>
        <text data-testid="participant-initials" x="${header.photo.centerX}" y="${header.photo.centerY + 18}" text-anchor="middle" fill="#374151" font-size="56" font-weight="800">${initials}</text>
      </g>`;
  }

  const qrSvg = assets.qrDataUri
    ? `<image data-testid="participant-qr" href="${escapeXml(assets.qrDataUri)}" x="${qr.innerX}" y="${qr.innerY}" width="${qr.innerSize}" height="${qr.innerSize}" preserveAspectRatio="xMidYMid meet" />`
    : `<g data-testid="participant-qr-placeholder">
        <rect x="${qr.innerX}" y="${qr.innerY}" width="${qr.innerSize}" height="${qr.innerSize}" rx="12" fill="#F8FAFC" stroke="#E2E8F0" stroke-width="2" />
        <text x="${qr.innerX + qr.innerSize / 2}" y="${qr.innerY + qr.innerSize / 2 + 12}" text-anchor="middle" fill="#64748B" font-size="26" font-weight="800">QR CODE</text>
      </g>`;

  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${width} ${height}" width="100%" height="100%" style="display:block;aspect-ratio:74/105;" data-testid="participant-id-card" data-status="VERIFIED" aria-label="Official participant festival pass" role="img">
  <defs>
    <style>
      @import url('https://fonts.googleapis.com/css2?family=Montserrat:wght@400;500;600;700;800;900&amp;family=Sora:wght@400;500;600;700;800&amp;display=swap');
      text { font-family: 'Sora', Arial, sans-serif; }
      .festival-title { font-family: ${festivalFontFamily}; }
    </style>
    <linearGradient id="id-header-gradient" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0%" stop-color="${ID_CARD_COLORS.headerRedGradientStart}" />
      <stop offset="100%" stop-color="${ID_CARD_COLORS.headerRedGradientEnd}" />
    </linearGradient>
    <pattern id="id-halftone" width="12" height="12" patternUnits="userSpaceOnUse">
      <circle cx="6" cy="6" r="1.1" fill="#FFFFFF" opacity="0.13" />
    </pattern>
    <filter id="id-starburst-left" x="-50%" y="-50%" width="200%" height="200%">
      <feGaussianBlur stdDeviation="13" />
    </filter>
    <filter id="id-starburst-right" x="-50%" y="-50%" width="200%" height="200%">
      <feGaussianBlur stdDeviation="14" />
    </filter>
    <clipPath id="participant-photo-clip">
      <circle cx="${header.photo.centerX}" cy="${header.photo.centerY}" r="${header.photo.radius}" />
    </clipPath>
  </defs>

  <!-- White card base -->
  <rect x="0" y="0" width="${width}" height="${height}" fill="${ID_CARD_COLORS.cardBgWhite}" />

  <!-- Solid red upper section with reference halftone texture -->
  <rect x="0" y="0" width="${width}" height="${header.height}" fill="url(#id-header-gradient)" />
  <rect x="0" y="0" width="${width}" height="${header.height}" fill="url(#id-halftone)" />

  <!-- Soft amber starbursts -->
  <g transform="translate(-8, 470)" filter="url(#id-starburst-left)" fill="${ID_CARD_COLORS.starburstAmber}" opacity="0.55">
    <rect x="-20" y="-145" width="40" height="290" rx="20" />
    <rect x="-20" y="-145" width="40" height="290" rx="20" transform="rotate(45)" />
    <rect x="-20" y="-145" width="40" height="290" rx="20" transform="rotate(90)" />
    <rect x="-20" y="-145" width="40" height="290" rx="20" transform="rotate(135)" />
  </g>
  <g transform="translate(748, 255)" filter="url(#id-starburst-right)" fill="${ID_CARD_COLORS.starburstAmber}" opacity="0.52">
    <rect x="-22" y="-150" width="44" height="300" rx="22" />
    <rect x="-22" y="-150" width="44" height="300" rx="22" transform="rotate(45)" />
    <rect x="-22" y="-150" width="44" height="300" rx="22" transform="rotate(90)" />
    <rect x="-22" y="-150" width="44" height="300" rx="22" transform="rotate(135)" />
  </g>

  <!-- Festival identity -->
  <text x="370" y="${header.kickerY}" text-anchor="middle" fill="${ID_CARD_COLORS.textWhite}" font-size="25" font-weight="700" letter-spacing="5.5">OFFICIAL FEST PASS</text>
  <text x="370" y="${header.festivalNameY}" text-anchor="middle" fill="${ID_CARD_COLORS.textWhite}" font-size="${festivalFontSize}" font-weight="800" letter-spacing="2" class="festival-title">${festival}</text>
  ${institution ? `<text x="370" y="${header.institutionNameY}" text-anchor="middle" fill="${ID_CARD_COLORS.textWhite}" font-size="22" font-weight="500">${institution}</text>` : ''}

  <!-- Participant portrait -->
  <circle cx="${header.photo.centerX}" cy="${header.photo.centerY}" r="${header.photo.outerRadius}" fill="${ID_CARD_COLORS.textWhite}" />
  ${photoSvg}

  <!-- Participant name and place -->
  <text x="370" y="${header.participantNameY}" text-anchor="middle" fill="${ID_CARD_COLORS.nameYellow}" font-size="${participantFontSize}" font-weight="900">${name}</text>
  <text x="370" y="${header.placeY}" text-anchor="middle" fill="${ID_CARD_COLORS.textWhite}" font-size="${placeFontSize}" font-weight="500">${place}</text>

  <!-- Lower white information panel: only the fields requested in the reference -->
  <g text-anchor="start">
    <text x="${detail.leftX}" y="${detail.bibLabelY}" fill="${ID_CARD_COLORS.textBlack}" font-size="${detail.labelFontSize}" font-weight="600">Bib Number</text>
    <text x="${detail.leftX}" y="${detail.bibValueY}" fill="${ID_CARD_COLORS.textBlack}" font-size="23" font-weight="800">${bib}</text>

    <text x="${detail.leftX}" y="${detail.teamLabelY}" fill="${ID_CARD_COLORS.textBlack}" font-size="${detail.labelFontSize}" font-weight="600">Team Name</text>
    <text x="${detail.leftX}" y="${detail.teamValueY}" fill="${ID_CARD_COLORS.textBlack}" font-size="${teamFontSize}" font-weight="800">${team}</text>

    <text x="${detail.leftX}" y="${detail.categoryLabelY}" fill="${ID_CARD_COLORS.textBlack}" font-size="${detail.labelFontSize}" font-weight="600">Category Name</text>
    <text x="${detail.leftX}" y="${detail.categoryValueY}" fill="${ID_CARD_COLORS.textBlack}" font-size="${categoryFontSize}" font-weight="800">${category}</text>

    <text x="${detail.leftX}" y="${detail.contestsLabelY}" fill="${ID_CARD_COLORS.textBlack}" font-size="${detail.labelFontSize}" font-weight="600">Registered Contests:</text>
    <text x="${detail.leftX}" y="${detail.contestsValueY}" fill="${ID_CARD_COLORS.textBlack}" font-size="21" font-weight="800">${contests}</text>
  </g>

  <!-- QR code -->
  <rect x="${qr.x}" y="${qr.y}" width="${qr.size}" height="${qr.size}" rx="26" fill="${ID_CARD_COLORS.cardBgWhite}" stroke="${ID_CARD_COLORS.qrBorderBlack}" stroke-width="3" />
  ${qrSvg}

  <!-- Simple solid red footer strip from the supplied reference -->
  <rect x="0" y="${layout.footer.y}" width="${width}" height="${layout.footer.height}" fill="${ID_CARD_COLORS.footerRed}" />
</svg>`;
}

export function idCardSvgDataUrl(data: IdCardData, assets: IdCardAssets = {}): string {
  return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(buildIdCardSvg(data, assets))}`;
}
