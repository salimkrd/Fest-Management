/**
 * Official INSPIRATH Participant ID Card geometry.
 * Exact physical size: 74 × 105 mm, portrait.
 */
export const ID_CARD_DIMENSIONS = {
  widthMm: 74,
  heightMm: 105,
  aspectRatio: 74 / 105,
  baseWidth: 740,
  baseHeight: 1050,
  exportScale: 4,
} as const;

export const ID_CARD_COLORS = {
  headerRed: '#9E1B1E',
  headerRedGradientStart: '#B82425',
  headerRedGradientEnd: '#8D171A',
  starburstAmber: '#F59E0B',
  nameYellow: '#FBBF24',
  textWhite: '#FFFFFF',
  textBlack: '#111827',
  textMuted: '#475569',
  qrBorderBlack: '#111111',
  cardBgWhite: '#FFFFFF',
  footerRed: '#A51F22',
} as const;

/**
 * One canonical coordinate map used by SVG Preview, PNG Download and Print.
 * The red header occupies roughly 64% of the card, followed by a white details
 * panel and a simple red footer strip, matching the supplied new reference.
 */
export const ID_CARD_LAYOUT = {
  header: {
    height: 675,
    kickerY: 112,
    festivalNameY: 178,
    institutionNameY: 210,
    photo: {
      centerX: 370,
      centerY: 385,
      radius: 143,
      outerRadius: 150,
      x: 227,
      y: 242,
      size: 286,
    },
    participantNameY: 592,
    placeY: 638,
  },
  details: {
    leftX: 76,
    labelFontSize: 15,
    bibLabelY: 766,
    bibValueY: 792,
    teamLabelY: 824,
    teamValueY: 850,
    categoryLabelY: 882,
    categoryValueY: 908,
    contestsLabelY: 940,
    contestsValueY: 970,
    maxTextWidth: 290,
  },
  qr: {
    x: 405,
    y: 718,
    size: 260,
    innerX: 423,
    innerY: 736,
    innerSize: 224,
  },
  footer: {
    y: 1018,
    height: 32,
  },
} as const;

/** Keep existing formatter exports for other ID workflows and tests. */
export function formatCardBib(bib?: string): string {
  if (!bib) return '#0000';
  const clean = bib.trim();
  return clean.startsWith('#') ? clean : `#${clean}`;
}

export function formatRegisteredContests(count: number | null): string {
  return count === null ? '— Competitions' : `${count} Competitions`;
}

export function formatCardToken(token?: string): string {
  if (!token) return 'VERIFYING...';
  return token.trim().toUpperCase();
}
