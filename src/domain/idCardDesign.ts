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

export const WAVE_PATH = 'M 0,0 L 740,0 L 740,605 C 600,625 480,580 370,585 C 260,590 140,635 0,620 Z';

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
