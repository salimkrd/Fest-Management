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
  { name: 'Rajdhani', family: '"Rajdhani", sans-serif', google: 'Rajdhani:wght@400;700' },
  { name: 'Barlow Condensed', family: '"Barlow Condensed", sans-serif', google: 'Barlow+Condensed:wght@400;700;800' },
  { name: 'Playfair Display', family: '"Playfair Display", serif', google: 'Playfair+Display:wght@400;700;800' },
  { name: 'DM Serif Display', family: '"DM Serif Display", serif', google: 'DM+Serif+Display' },
  { name: 'Teko', family: '"Teko", sans-serif', google: 'Teko:wght@400;700' },
  { name: 'Archivo Black', family: '"Archivo Black", sans-serif', google: 'Archivo+Black' },
  { name: 'Cormorant Garamond', family: '"Cormorant Garamond", serif', google: 'Cormorant+Garamond:wght@400;700' },
  { name: 'Abril Fatface', family: '"Abril Fatface", serif', google: 'Abril+Fatface' },
  { name: 'League Spartan', family: '"League Spartan", sans-serif', google: 'League+Spartan:wght@400;700;800;900' },
  { name: 'Bungee', family: '"Bungee", sans-serif', google: 'Bungee' },
  { name: 'Black Ops One', family: '"Black Ops One", sans-serif', google: 'Black+Ops+One' },
  { name: 'Russo One', family: '"Russo One", sans-serif', google: 'Russo+One' },
  { name: 'Audiowide', family: '"Audiowide", sans-serif', google: 'Audiowide' },
  { name: 'Chakra Petch', family: '"Chakra Petch", sans-serif', google: 'Chakra+Petch:wght@400;700' },
  { name: 'Exo 2', family: '"Exo 2", sans-serif', google: 'Exo+2:wght@400;700;800' },
  { name: 'Sora', family: '"Sora", sans-serif', google: 'Sora:wght@400;700;800' },
  { name: 'Space Grotesk', family: '"Space Grotesk", sans-serif', google: 'Space+Grotesk:wght@400;700' },
  { name: 'Unbounded', family: '"Unbounded", sans-serif', google: 'Unbounded:wght@400;700;800' },
  { name: 'Righteous', family: '"Righteous", sans-serif', google: 'Righteous' },
  { name: 'Staatliches', family: '"Staatliches", sans-serif', google: 'Staatliches' },
  { name: 'Teko', family: '"Teko", sans-serif', google: 'Teko:wght@400;700' },
  { name: 'Lilita One', family: '"Lilita One", sans-serif', google: 'Lilita+One' },
  { name: 'Bowlby One SC', family: '"Bowlby One SC", sans-serif', google: 'Bowlby+One+SC' },
  { name: 'Josefin Sans', family: '"Josefin Sans", sans-serif', google: 'Josefin+Sans:wght@400;700' },
  { name: 'Manrope', family: '"Manrope", sans-serif', google: 'Manrope:wght@400;700;800' },
  { name: 'Inter', family: '"Inter", sans-serif', google: 'Inter:wght@400;700;800' },
  { name: 'Roboto Condensed', family: '"Roboto Condensed", sans-serif', google: 'Roboto+Condensed:wght@400;700;800' },
  { name: 'Fira Sans Condensed', family: '"Fira Sans Condensed", sans-serif', google: 'Fira+Sans+Condensed:wght@400;700;800' },
  { name: 'Barlow', family: '"Barlow", sans-serif', google: 'Barlow:wght@400;700;800' },
  { name: 'Titillium Web', family: '"Titillium Web", sans-serif', google: 'Titillium+Web:wght@400;700;900' },
  { name: 'Lora', family: '"Lora", serif', google: 'Lora:wght@400;700' },
  { name: 'Merriweather', family: '"Merriweather", serif', google: 'Merriweather:wght@400;700;900' },
  { name: 'Bodoni Moda', family: '"Bodoni Moda", serif', google: 'Bodoni+Moda:wght@400;700;900' },
  { name: 'Libre Baskerville', family: '"Libre Baskerville", serif', google: 'Libre+Baskerville:wght@400;700' },
  { name: 'Cormorant SC', family: '"Cormorant SC", serif', google: 'Cormorant+SC:wght@400;700' },
  { name: 'Playfair Display SC', family: '"Playfair Display SC", serif', google: 'Playfair+Display+SC:wght@400;700;900' }
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
