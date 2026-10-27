/**
 * Curated font catalogue for the Media / Result Poster Studio editor.
 * The values are an allow-list: stored poster data cannot request arbitrary CSS
 * font families or turn user input into a remote stylesheet URL.
 */
export interface PosterFontOption {
  name: string;
  family: string;
}

export interface PosterFontGroup {
  category: string;
  fonts: PosterFontOption[];
}

const makeFonts = (names: string[], fallback = 'sans-serif'): PosterFontOption[] =>
  names.map(name => ({ name, family: '"' + name.replace(/"/g, '') + '", ' + fallback }));

export const POSTER_FONT_GROUPS: PosterFontGroup[] = [
  {
    category: 'Sans-Serif',
    fonts: makeFonts([
      'Roboto', 'Open Sans', 'Lato', 'Inter', 'Source Sans 3', 'Noto Sans',
      'Poppins', 'Raleway', 'Work Sans', 'Nunito', 'Rubik', 'DM Sans',
      'Outfit', 'Plus Jakarta Sans', 'Figtree', 'Quicksand', 'Cabin', 'Karla',
      'Mukta', 'Exo 2', 'Titillium Web', 'Mulish', 'Barlow', 'PT Sans',
      'Ubuntu', 'Fira Sans', 'Lexend', 'Manrope',
    ]),
  },
  {
    category: 'Display / Headlines',
    fonts: makeFonts([
      'Montserrat', 'Oswald', 'Roboto Condensed', 'Fjalla One', 'Bebas Neue',
      'Sora', 'Anton', 'Archivo Black', 'Righteous', 'Passion One',
      'Alfa Slab One', 'Bangers', 'Permanent Marker', 'Black Ops One',
      'Russo One', 'Kanit', 'Saira Condensed', 'Teko', 'Archivo', 'Staatliches',
      'Big Shoulders Display',
    ]),
  },
  {
    category: 'Serif',
    fonts: makeFonts([
      'Playfair Display', 'Lora', 'Cormorant Garamond', 'Merriweather',
      'Libre Baskerville', 'Crimson Text', 'Bitter', 'Alegreya', 'Play',
      'PT Serif', 'Noto Serif', 'Source Serif 4', 'Roboto Slab', 'DM Serif Display',
      'Libre Caslon Text', 'EB Garamond', 'Vollkorn', 'Spectral', 'Cardo',
      'Cinzel', 'Old Standard TT',
    ], 'serif'),
  },
  {
    category: 'Script / Handwriting',
    fonts: makeFonts([
      'Dancing Script', 'Pacifico', 'Great Vibes', 'Tangerine', 'Satisfy',
      'Lobster', 'Lobster Two', 'Sacramento', 'Kaushan Script', 'Caveat',
      'Shadows Into Light', 'Indie Flower', 'Amatic SC', 'Allura', 'Cookie',
      'Courgette', 'Playball', 'Alex Brush', 'Rouge Script', 'Marck Script',
    ], 'cursive'),
  },
  {
    category: 'Monospace',
    fonts: makeFonts([
      'Roboto Mono', 'Source Code Pro', 'Fira Code', 'JetBrains Mono',
      'IBM Plex Mono', 'Space Mono', 'Inconsolata',
    ], 'monospace'),
  },
  {
    category: 'Malayalam',
    fonts: makeFonts([
      'Chilanka', 'Manjari', 'Baloo Chettan 2', 'Anek Malayalam', 'Arima',
      'Gayathri', 'Noto Serif Malayalam', 'Noto Sans Malayalam',
    ]),
  },
  {
    category: 'Special / Fun',
    fonts: makeFonts([
      'Josefin Sans', 'IBM Plex Sans', 'Space Grotesk', 'Comfortaa',
      'Varela Round', 'Fredoka', 'Baloo 2', 'Patrick Hand',
      'Architects Daughter', 'Gloria Hallelujah', 'Orbitron', 'Press Start 2P',
    ]),
  },
  {
    category: 'System fallback',
    fonts: [
      { name: 'Sans-serif · Arial (legacy)', family: 'Arial, sans-serif' },
      { name: 'Serif · Georgia (legacy)', family: 'Georgia, serif' },
      { name: 'Monospace (legacy)', family: 'monospace' },
    ],
  },
];

export const LEGACY_POSTER_FONT_VALUES = ['sans', 'serif', 'mono'] as const;
export const POSTER_FONT_OPTIONS = POSTER_FONT_GROUPS.flatMap(group => group.fonts);
export const POSTER_FONT_NAMES = POSTER_FONT_OPTIONS
  .filter(font => !font.name.endsWith('(legacy)'))
  .map(font => font.name);

export function isPosterFont(value: unknown): value is string {
  return typeof value === 'string' &&
    (POSTER_FONT_NAMES.includes(value) ||
      LEGACY_POSTER_FONT_VALUES.includes(value as typeof LEGACY_POSTER_FONT_VALUES[number]));
}

export function posterFontCssFamily(value: string): string {
  if (value === 'serif') return 'Georgia, serif';
  if (value === 'mono') return 'monospace';
  if (value === 'sans') return 'Arial, sans-serif';
  return POSTER_FONT_OPTIONS.find(font => font.name === value)?.family ?? 'Arial, sans-serif';
}

function posterFontStylesheetUrl(fontName: string): string {
  return 'https://fonts.googleapis.com/css2?family=' +
    encodeURIComponent(fontName).replace(/%20/g, '+') + '&display=swap';
}

/** Load only the requested allow-listed fonts; avoid downloading the entire catalogue. */
export async function loadPosterFonts(fontNames: readonly string[]): Promise<void> {
  if (typeof document === 'undefined') return;
  const safeNames = [...new Set(fontNames)].filter((name): name is string =>
    typeof name === 'string' && POSTER_FONT_NAMES.includes(name)
  );
  await Promise.all(safeNames.map(async name => {
    const id = 'poster-web-font-' + name.toLowerCase().replace(/[^a-z0-9]+/g, '-');
    let link = document.getElementById(id) as HTMLLinkElement | null;
    const alreadyLoaded = link?.dataset.loaded === 'true';
    if (!link) {
      link = document.createElement('link');
      link.id = id;
      link.rel = 'stylesheet';
      link.href = posterFontStylesheetUrl(name);
    }
    if (!alreadyLoaded) {
      await new Promise<void>(resolve => {
        if (!link) return resolve();
        const finish = () => { if (link) link.dataset.loaded = 'true'; resolve(); };
        link.addEventListener('load', finish, { once: true });
        link.addEventListener('error', finish, { once: true });
        if (!link.isConnected) document.head.appendChild(link);
      });
    }
    if (document.fonts?.load) {
      try { await document.fonts.load('400 16px "' + name.replace(/"/g, '') + '"'); }
      catch { /* The CSS font stack provides a safe fallback when offline. */ }
    }
  }));
}
