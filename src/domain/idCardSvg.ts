/**
 * Canonical SVG ID Card Renderer
 * Single authoritative source of truth for INSPIRATH Participant ID Cards.
 * Used identically for:
 * 1. On-screen Preview
 * 2. Downloaded PNG rasterization
 * 3. Physical 74mm x 105mm Print
 */

import type { Participant } from '@/types/fest';
import { FESTIVAL_NAME_FONTS, DEFAULT_FESTIVAL_NAME_FONT } from '@/domain/festivalFonts';
import { getParticipantInitials } from '@/components/domain/ParticipantPhoto';
import {
  ID_CARD_DIMENSIONS,
  ID_CARD_COLORS,
  WAVE_PATH,
  formatCardBib,
  formatCardToken
} from '@/domain/idCardDesign';

export interface IdCardData {
  festivalName: string;
  institutionName?: string;
  participantName: string;
  bib: string;
  teamName: string;
  teamCode?: string;
  categoryName: string;
  participantId: string;
  registeredCompetitionsCount: number;
  token?: string;
  festivalNameFont?: string;
}

export interface IdCardAssets {
  photoDataUri?: string;
  qrDataUri?: string;
  photoFallbackInitials?: string;
}

/**
 * Escapes special XML characters to prevent SVG injection or breakage
 */
export function escapeXml(str?: string | null): string {
  if (!str) return '';
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

/**
 * Extracts IdCardData from a Participant entity and theme settings
 */
export function extractIdCardData(
  participant: Participant,
  options?: {
    festivalName?: string;
    institutionName?: string;
    festivalNameFont?: string;
    token?: string;
  }
): IdCardData {
  return {
    festivalName: options?.festivalName || 'INSPIRATH 2025',
    institutionName: options?.institutionName,
    participantName: participant.name,
    bib: participant.bib,
    teamName: participant.teamName,
    teamCode: participant.teamCode,
    categoryName: participant.categoryName,
    participantId: participant.id,
    registeredCompetitionsCount: participant.registeredEventIds?.length || 0,
    token: options?.token,
    festivalNameFont: options?.festivalNameFont,
  };
}

/**
 * Builds the canonical SVG artwork for the 74mm x 105mm Participant ID Card.
 * Exact 740 x 1050 canonical coordinate space.
 */
export function buildIdCardSvg(data: IdCardData, assets: IdCardAssets = {}): string {
  const width = ID_CARD_DIMENSIONS.baseWidth;   // 740
  const height = ID_CARD_DIMENSIONS.baseHeight; // 1050

  const escapedFestival = escapeXml(data.festivalName.toUpperCase());
  const escapedInstitution = escapeXml(data.institutionName);
  const escapedName = escapeXml(data.participantName);
  const escapedBib = escapeXml(formatCardBib(data.bib));

  const teamDisplay = data.teamCode
    ? `${data.teamName} (${data.teamCode})`
    : data.teamName;
  const escapedTeam = escapeXml(teamDisplay);
  const escapedCategory = escapeXml(data.categoryName);

  const participantIdUpper = (data.participantId || '').toUpperCase();
  const idChunks = participantIdUpper.match(/.{1,18}/g) || [participantIdUpper];
  const escapedId1 = escapeXml(idChunks[0] || '');
  const escapedId2 = escapeXml(idChunks.slice(1).join('') || '');

  const count = data.registeredCompetitionsCount || 0;
  const tokenFormatted = formatCardToken(data.token);
  const escapedToken = escapeXml(tokenFormatted.slice(0, 24));

  const initials = assets.photoFallbackInitials || getParticipantInitials(data.participantName) || 'P';
  const escapedInitials = escapeXml(initials);

  // Dynamic typography sizing to protect against text overflows on long names
  const festNameLength = data.festivalName.length;
  const festFontSize = festNameLength > 28 ? 22 : festNameLength > 20 ? 26 : festNameLength > 15 ? 30 : 34;

  const nameLength = data.participantName.length;
  const nameFontSize = nameLength > 26 ? 22 : nameLength > 18 ? 26 : 32;

  const teamLength = teamDisplay.length;
  const teamFontSize = teamLength > 30 ? 17 : teamLength > 22 ? 20 : 23;

  // Font family resolution
  const fontChoice = FESTIVAL_NAME_FONTS.find(font => font.name === data.festivalNameFont)
    || FESTIVAL_NAME_FONTS.find(font => font.name === DEFAULT_FESTIVAL_NAME_FONT)!;
  const festFontFamily = fontChoice.name === 'Montserrat' ? 'Montserrat, system-ui, sans-serif' : `${fontChoice.name}, Montserrat, system-ui, sans-serif`;

  // Pre-generate bottom ribbon 20 tiles
  const numRibbonTiles = 20;
  const tileWidth = width / numRibbonTiles; // 37
  const ribbonY = 1005;
  const ribbonHeight = 45;

  let ribbonTilesSvg = '';
  for (let i = 0; i < numRibbonTiles; i++) {
    const isBurgundy = i % 2 === 0;
    const tileX = i * tileWidth;
    const glyphType = i % 4;
    const glyphCenterX = tileX + tileWidth / 2;
    const glyphCenterY = ribbonY + ribbonHeight / 2;

    const bgRect = `<rect x="${tileX}" y="${ribbonY}" width="${tileWidth}" height="${ribbonHeight}" fill="${isBurgundy ? ID_CARD_COLORS.ribbonBurgundy : ID_CARD_COLORS.cardBgWhite}" />`;
    const glyphFill = isBurgundy ? ID_CARD_COLORS.cardBgWhite : ID_CARD_COLORS.ribbonBurgundy;

    let glyphSvg = '';
    if (glyphType === 0) {
      // Lamp / Lantern
      glyphSvg = `<g transform="translate(${glyphCenterX}, ${glyphCenterY})" fill="${glyphFill}"><path d="M 0 -8 C -2 -5 -4 0 -4 4 C -4 7 -2 9 0 9 C 2 9 4 7 4 4 C 4 0 2 -5 0 -8 Z M -5 10 L 5 10 L 5 13 L -5 13 Z M -3 14 L 3 14 L 3 16 L -3 16 Z" /></g>`;
    } else if (glyphType === 2) {
      // Open Book
      glyphSvg = `<g transform="translate(${glyphCenterX}, ${glyphCenterY})" fill="${glyphFill}"><path d="M -9 -7 C -4 -8 0 -6 0 -4 L 0 7 C 0 5 -4 3 -9 4 Z M 9 -7 C 4 -8 0 -6 0 -4 L 0 7 C 0 5 4 3 9 4 Z" /></g>`;
    } else {
      // Feather Quill
      glyphSvg = `<g transform="translate(${glyphCenterX}, ${glyphCenterY})" fill="${glyphFill}"><path d="M 6 -9 C 3 -6 1 -1 -2 4 L -5 9 L -3 9 L -1 5 C 1 2 4 -2 7 -8 Z" /></g>`;
    }

    ribbonTilesSvg += bgRect + glyphSvg;
  }

  // Participant Photo inside frame
  let photoContentSvg = '';
  if (assets.photoDataUri) {
    photoContentSvg = `<image data-testid="participant-photo-image" href="${escapeXml(assets.photoDataUri)}" x="262" y="177" width="216" height="216" preserveAspectRatio="xMidYMid slice" clip-path="url(#photo-circle-clip)" />`;
  } else {
    photoContentSvg = `
      <g data-testid="participant-photo-fallback" aria-label="Photo placeholder for ${escapedName}">
        <circle cx="370" cy="285" r="108" fill="#F3F4F6" />
        <g data-testid="participant-silhouette" clip-path="url(#photo-circle-clip)">
          <circle cx="370" cy="260" r="40" fill="#D1D5DB" />
          <ellipse cx="370" cy="345" rx="70" ry="48" fill="#D1D5DB" />
        </g>
        <text data-testid="participant-initials" x="370" y="297" text-anchor="middle" fill="#374151" font-size="52" font-weight="800" font-family="'Montserrat', system-ui, sans-serif">${escapedInitials}</text>
      </g>
    `;
  }

  // QR Code inside container
  let qrContentSvg = '';
  if (assets.qrDataUri) {
    qrContentSvg = `<image href="${escapeXml(assets.qrDataUri)}" x="410" y="640" width="265" height="265" preserveAspectRatio="xMidYMid meet" />`;
  } else {
    qrContentSvg = `
      <g>
        <rect x="435" y="665" width="215" height="215" rx="16" fill="#F3F4F6" stroke="#E5E7EB" stroke-width="2" />
        <text x="542" y="780" text-anchor="middle" fill="#6B7280" font-size="20" font-weight="800" font-family="'Montserrat', system-ui, sans-serif">QR CODE</text>
      </g>
    `;
  }

  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${width} ${height}" width="100%" height="100%" style="display:block;aspect-ratio:74/105;" data-testid="participant-id-card" data-status="VERIFIED" aria-label="OFFICIAL FESTIVAL PASS" role="img">
  <defs>
    <style>
      @import url('https://fonts.googleapis.com/css2?family=Montserrat:wght@400;500;600;700;800;900&amp;display=swap');
      text {
        font-family: 'Montserrat', system-ui, -apple-system, sans-serif;
      }
      .fest-title {
        font-family: ${festFontFamily};
      }
    </style>
    <linearGradient id="header-red-gradient" x1="0%" y1="0%" x2="0%" y2="100%">
      <stop offset="0%" stop-color="${ID_CARD_COLORS.headerRedGradientStart}" />
      <stop offset="50%" stop-color="${ID_CARD_COLORS.headerRed}" />
      <stop offset="100%" stop-color="${ID_CARD_COLORS.headerRedGradientEnd}" />
    </linearGradient>
    <pattern id="halftone-dots" width="16" height="16" patternUnits="userSpaceOnUse">
      <circle cx="8" cy="8" r="1.5" fill="#FFFFFF" opacity="0.14" />
    </pattern>
    <filter id="starburst-blur-left" x="-50%" y="-50%" width="200%" height="200%">
      <feGaussianBlur stdDeviation="15" />
    </filter>
    <filter id="starburst-blur-right" x="-50%" y="-50%" width="200%" height="200%">
      <feGaussianBlur stdDeviation="16" />
    </filter>
    <clipPath id="header-wave-clip">
      <path d="${WAVE_PATH}" />
    </clipPath>
    <clipPath id="photo-circle-clip">
      <circle cx="370" cy="285" r="108" />
    </clipPath>
  </defs>

  <!-- 1. White Base Background -->
  <rect x="0" y="0" width="${width}" height="${height}" fill="${ID_CARD_COLORS.cardBgWhite}" />

  <!-- 2. Crimson Red Header Group with Wave Cutout -->
  <g clip-path="url(#header-wave-clip)">
    <!-- Red Gradient Fill -->
    <rect x="0" y="0" width="${width}" height="640" fill="url(#header-red-gradient)" />

    <!-- Halftone Texture Overlay -->
    <rect x="0" y="0" width="${width}" height="640" fill="url(#halftone-dots)" />

    <!-- Ambient Amber Starburst (Left) -->
    <g transform="translate(-10, 380)" filter="url(#starburst-blur-left)" fill="${ID_CARD_COLORS.starburstAmber}" opacity="0.68">
      <rect x="-22" y="-140" width="44" height="280" rx="22" />
      <rect x="-22" y="-140" width="44" height="280" rx="22" transform="rotate(45)" />
      <rect x="-22" y="-140" width="44" height="280" rx="22" transform="rotate(90)" />
      <rect x="-22" y="-140" width="44" height="280" rx="22" transform="rotate(135)" />
    </g>

    <!-- Ambient Amber Starburst (Upper-Right) -->
    <g transform="translate(710, 140)" filter="url(#starburst-blur-right)" fill="${ID_CARD_COLORS.starburstAmber}" opacity="0.62">
      <rect x="-24" y="-150" width="48" height="300" rx="24" />
      <rect x="-24" y="-150" width="48" height="300" rx="24" transform="rotate(45)" />
      <rect x="-24" y="-150" width="48" height="300" rx="24" transform="rotate(90)" />
      <rect x="-24" y="-150" width="48" height="300" rx="24" transform="rotate(135)" />
    </g>
  </g>

  <!-- 3. Top Header Typography -->
  <text x="370" y="55" text-anchor="middle" fill="${ID_CARD_COLORS.textWhite}" font-size="16" font-weight="700" letter-spacing="4" aria-label="OFFICIAL FESTIVAL PASS">OFFICIAL FEST PASS</text>

  <text x="370" y="105" text-anchor="middle" fill="${ID_CARD_COLORS.textWhite}" font-size="${festFontSize}" font-weight="800" letter-spacing="1" class="fest-title">${escapedFestival}</text>

  ${escapedInstitution ? `<text x="370" y="140" text-anchor="middle" fill="${ID_CARD_COLORS.textWhiteMuted}" font-size="17" font-weight="600">${escapedInstitution}</text>` : ''}

  <!-- 4. Circular Participant Photo Container -->
  <!-- Outer White Circle Ring -->
  <circle cx="370" cy="285" r="114" fill="${ID_CARD_COLORS.textWhite}" />

  <!-- Inside Photo or Neutral Silhouette -->
  ${photoContentSvg}

  <!-- 5. Bib Number (Centered Below Photo) -->
  <text x="370" y="432" text-anchor="middle" fill="${ID_CARD_COLORS.textWhite}" font-size="17" font-weight="700" letter-spacing="1">${escapedBib}</text>

  <!-- 6. Participant Name (Yellow Centered) -->
  <text x="370" y="480" text-anchor="middle" fill="${ID_CARD_COLORS.nameYellow}" font-size="${nameFontSize}" font-weight="900" letter-spacing="0">${escapedName}</text>

  <!-- 7. Lower Section: Two Balanced Columns -->
  <!-- Left Column: Team, Category, Participant Id, Registered Contests, Token -->
  <g text-anchor="start">
    <!-- Team Name -->
    <text x="45" y="650" fill="${ID_CARD_COLORS.textBlack}" font-size="${teamFontSize}" font-weight="800">${escapedTeam}</text>

    <!-- Category Name -->
    <text x="45" y="685" fill="${ID_CARD_COLORS.textBlack}" font-size="21" font-weight="700">${escapedCategory}</text>

    <!-- Participant Id -->
    <text x="45" y="725" fill="${ID_CARD_COLORS.textBlack}" font-size="15" font-weight="700">Participant Id:</text>
    <text x="45" y="746" fill="#1F2937" font-size="12.5" font-weight="600" font-family="'Montserrat', monospace, sans-serif">${escapedId1}</text>
    ${escapedId2 ? `<text x="45" y="764" fill="#1F2937" font-size="12.5" font-weight="600" font-family="'Montserrat', monospace, sans-serif">${escapedId2}</text>` : ''}

    <!-- Registered Contests -->
    <text x="45" y="808" fill="${ID_CARD_COLORS.textBlack}" font-size="15" font-weight="700">Registered Contests:</text>
    <text x="45" y="834" fill="${ID_CARD_COLORS.textBlack}" font-size="18" font-weight="800" aria-label="${count} Contests">${count} Competitions</text>

    <!-- Token -->
    <text x="45" y="875" fill="${ID_CARD_COLORS.textMuted}" font-size="12" font-weight="600" font-family="monospace, sans-serif">Token: ${escapedToken}</text>
  </g>

  <!-- Right Column: Rounded Black Border QR Code Box -->
  <rect x="390" y="620" width="305" height="305" rx="32" fill="${ID_CARD_COLORS.cardBgWhite}" stroke="${ID_CARD_COLORS.qrBorderBlack}" stroke-width="5" />
  ${qrContentSvg}

  <!-- 8. Bottom Decorative Ribbon Strip -->
  ${ribbonTilesSvg}
  <line x1="0" y1="1005" x2="${width}" y2="1005" stroke="${ID_CARD_COLORS.ribbonBurgundy}" stroke-width="1" />
</svg>`;
}

/**
 * Convenience helper to produce a data URI from the canonical SVG
 */
export function idCardSvgDataUrl(data: IdCardData, assets: IdCardAssets = {}): string {
  const svg = buildIdCardSvg(data, assets);
  return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
}
