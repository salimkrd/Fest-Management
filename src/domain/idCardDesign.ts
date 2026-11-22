/**
 * Official ID Card Design System & Geometry Specification
 * Exact 74mm x 105mm physical print dimensions (aspect ratio 74:105).
 */

export const ID_CARD_DIMENSIONS = {
  widthMm: 74,
  heightMm: 105,
  aspectRatio: 74 / 105,
  // Logical coordinate space for high-fidelity rendering
  baseWidth: 740,
  baseHeight: 1050,
  exportScale: 4, // 2960 x 4200 px (over 1000 DPI for ultra-sharp prints)
} as const;

export const ID_CARD_COLORS = {
  headerRed: '#931B1E',
  headerRedGradientStart: '#9D1C20',
  headerRedGradientEnd: '#821417',
  starburstAmber: '#F59E0B',
  starburstAmberDark: '#D97706',
  nameYellow: '#FBBF24',
  textWhite: '#FFFFFF',
  textWhiteMuted: '#FEE2E2',
  textBlack: '#111827',
  textMuted: '#4B5563',
  qrBorderBlack: '#000000',
  cardBgWhite: '#FFFFFF',
  ribbonBurgundy: '#931B1E',
} as const;

/**
 * Canonical layout coordinates shared by the SVG preview, PNG export and print.
 * The card uses a 740 × 1050 viewBox for an exact 74 × 105 mm physical ratio.
 */
export const ID_CARD_LAYOUT = {
  photo: {
    centerX: 370,
    centerY: 338,
    radius: 140,
    outerRadius: 146,
    x: 230,
    y: 198,
    size: 280,
  },
  bibY: 520,
  participantNameY: 575,
  details: {
    leftX: 45,
    teamY: 704,
    categoryY: 745,
    participantIdLabelY: 790,
    participantIdLine1Y: 814,
    participantIdLine2Y: 834,
    registeredLabelY: 882,
    registeredCountY: 908,
    tokenY: 954,
  },
  qr: {
    x: 390,
    y: 655,
    size: 305,
    innerX: 410,
    innerY: 675,
    innerSize: 265,
  },
  ribbon: {
    y: 1018,
    height: 32,
    tiles: 20,
  },
} as const;

/**
 * Smooth multi-wave lower edge inspired by the supplied reference card.
 * This replaces the previous single broad curve with a more refined rhythm.
 */
export const WAVE_PATH = 'M 0,0 H 740 V 612 C 700,612 680,625 650,626 C 610,628 580,606 550,592 C 520,578 490,580 460,595 C 425,614 392,628 355,618 C 318,607 290,590 255,592 C 220,594 190,616 155,625 C 115,635 70,626 0,618 Z';

/**
 * Normalizes participant bib with leading #
 */
export function formatCardBib(bib?: string): string {
  if (!bib) return '#0000';
  const clean = bib.trim();
  return clean.startsWith('#') ? clean : `#${clean}`;
}

/**
 * Normalizes participant registered competitions count label
 */
export function formatRegisteredContests(count: number): string {
  return `${count} Competitions`;
}

/**
 * Truncates / slices cryptographic token for display
 */
export function formatCardToken(token?: string): string {
  if (!token) return 'VERIFYING...';
  return token.trim().toUpperCase();
}
