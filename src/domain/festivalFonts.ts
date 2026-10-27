/** Approved festival-name-only typefaces. The rest of the application keeps Montserrat. */
export const FESTIVAL_NAME_FONTS = [
  { name: 'Montserrat', family: 'var(--font-montserrat), Montserrat, sans-serif', google: '' },
  { name: 'Poppins', family: '"Poppins", sans-serif', google: 'Poppins:wght@400;700;800' },
  { name: 'Raleway', family: '"Raleway", sans-serif', google: 'Raleway:wght@400;700;800' },
  { name: 'Oswald', family: '"Oswald", sans-serif', google: 'Oswald:wght@400;700' },
  { name: 'Anton', family: '"Anton", sans-serif', google: 'Anton' },
  { name: 'Bebas Neue', family: '"Bebas Neue", sans-serif', google: 'Bebas+Neue' },
  { name: 'Cinzel', family: '"Cinzel", serif', google: 'Cinzel:wght@400;700;900' },
  { name: 'Orbitron', family: '"Orbitron", sans-serif', google: 'Orbitron:wght@400;700;800' },
  { name: 'Bruno Ace', family: '"Bruno Ace", sans-serif', google: 'Bruno+Ace' },
  { name: 'Bruno Ace SC', family: '"Bruno Ace SC", sans-serif', google: 'Bruno+Ace+SC' },
  { name: 'Bruno Ace', family: '"Bruno Ace", sans-serif', google: 'Bruno+Ace' },
  { name: 'Bruno Ace SC', family: '"Bruno Ace SC", sans-serif', google: 'Bruno+Ace+SC' },
  { name: 'Rajdhani', family: '"Rajdhani", sans-serif', google: 'Rajdhani:wght@400;700' },
  { name: 'Barlow Condensed', family: '"Barlow Condensed", sans-serif', google: 'Barlow+Condensed:wght@400;700;800' },
  { name: 'Playfair Display', family: '"Playfair Display", serif', google: 'Playfair+Display:wght@400;700;800' },
  { name: 'DM Serif Display', family: '"DM Serif Display", serif', google: 'DM+Serif+Display' },
  { name: 'Teko', family: '"Teko", sans-serif', google: 'Teko:wght@400;700' },
  { name: 'Archivo Black', family: '"Archivo Black", sans-serif', google: 'Archivo+Black' },
  { name: 'Cormorant Garamond', family: '"Cormorant Garamond", serif', google: 'Cormorant+Garamond:wght@400;700' },
  { name: 'Abril Fatface', family: '"Abril Fatface", serif', google: 'Abril+Fatface' }
] as const;

export const DEFAULT_FESTIVAL_NAME_FONT = 'Montserrat';

export function isFestivalNameFont(value: unknown): value is string {
  return typeof value === 'string' && FESTIVAL_NAME_FONTS.some(font => font.name === value);
}

export function festivalNameFontFamily(value?: string): string {
  return FESTIVAL_NAME_FONTS.find(font => font.name === value)?.family
    || FESTIVAL_NAME_FONTS[0].family;
}

/** Only known Google Fonts URLs are loaded; stored user text cannot become a URL. */
export function festivalFontStylesheet(fontNames: readonly string[]): string | null {
  const families = FESTIVAL_NAME_FONTS
    .filter(font => font.google && fontNames.includes(font.name))
    .map(font => 'family=' + font.google);
  return families.length ? 'https://fonts.googleapis.com/css2?' + families.join('&') + '&display=swap' : null;
}
