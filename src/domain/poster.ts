import type { CompetitionResult, PosterConfig, PosterElement, PosterField, PosterWinnerContainer, PosterWinnerField, PosterWinnerLayer, PublicThemeSettings, ResultRank } from '@/types/fest';
import { festivalNameFontFamily } from '@/domain/festivalFonts';
import { isPosterFont, posterFontCssFamily } from '@/domain/posterFonts';

// Legacy alias retained for existing callers and saved templates.
export const POSTER_FONTS = { sans: 'Arial, sans-serif', serif: 'Georgia, serif', mono: 'monospace' };


export const POSTER_FIELDS: { value: PosterField; label: string }[] = [
  { value: 'text', label: 'Custom text' }, { value: 'festivalName', label: 'Festival name' },
  { value: 'institutionName', label: 'Institution name' }, { value: 'competitionName', label: 'Competition name' },
  { value: 'categoryName', label: 'Category' }, { value: 'competitionCode', label: 'Competition code' },
  ...([1, 2, 3] as const).flatMap(rank => (['name', 'team'] as const).map(field => ({
    value: `rank${rank}.${field}` as PosterField, label: `Rank ${rank} · ${field === 'name' ? 'Winner name' : 'Team name'}`,
  }))),
];

// Legacy grade/score dynamic fields remain valid only so existing saved templates load;
// they are deliberately hidden from the editor and render no data on poster outputs.
const HIDDEN_LEGACY_POSTER_FIELDS = new Set<PosterField>(
  ([1, 2, 3] as const).flatMap(rank => [
    `rank${rank}.grade` as PosterField,
    `rank${rank}.score` as PosterField,
  ]),
);
export const POSTER_PALETTES = {
  royal: { background: '#142C50', accent: '#EACB85', text: '#FFFFFF' },
  crimson: { background: '#571E32', accent: '#F9D59B', text: '#FFFFFF' },
  emerald: { background: '#123F38', accent: '#D6E5B2', text: '#FFFFFF' },
  monochrome: { background: '#F3EEE5', accent: '#846E45', text: '#252D32' },
};
export const POSTER_PRESETS = [
  { id: 'laureate', name: 'The Laureate', description: 'Classic blue & gold', color: '#142C50' },
  { id: 'editorial', name: 'Editorial', description: 'Warm paper & serif', color: '#F3EEE5' },
  { id: 'celebration', name: 'Celebration', description: 'Fresh green & confetti', color: '#123F38' },
] as const;
export type PosterPreset = typeof POSTER_PRESETS[number]['id'];
export function posterDimensions(ratio: PosterConfig['aspectRatio']) {
  return { width: 1080, height: ratio === '4:5' ? 1350 : ratio === '9:16' ? 1920 : 1080 };
}
export function createTextElement(id: string, field: PosterField = 'text', text = 'Your text'): PosterElement {
  return { id, type: 'text', label: POSTER_FIELDS.find(item => item.value === field)?.label ?? 'Text', field, text,
    x: 10, y: 45, width: 80, height: 8, fontSize: 42, fontFamily: 'sans', fontWeight: '600', color: '#FFFFFF', align: 'center' };
}
export function createPosterPreset(preset: PosterPreset = 'laureate'): PosterConfig {
  const colorPreset = preset === 'editorial' ? 'monochrome' : preset === 'celebration' ? 'emerald' : 'royal';
  const palette = POSTER_PALETTES[colorPreset];
  const element = (id: string, field: PosterField, text: string, y: number, fontSize: number, height: number, color = palette.text): PosterElement => ({
    ...createTextElement(id, field, text), y, fontSize, height, color,
    fontFamily: preset === 'editorial' ? 'serif' : 'sans', fontWeight: '800',
  });
  const elements: PosterElement[] = [
    element('festival', 'festivalName', '', 6, 28, 5, palette.accent),
    element('announcement', 'text', 'THE WINNERS', 12, 70, 9),
    element('competition', 'competitionName', '', 23, 38, 9),
    element('category', 'categoryName', '', 33, 24, 4, palette.accent),
  ];
  elements.push(element('institution', 'institutionName', '', 91.5, 22, 4, palette.accent));
  elements.push(element('footer', 'text', 'OFFICIAL RESULTS · CELEBRATING EXCELLENCE', 96, 14, 2));
  const winnerContainer: PosterWinnerContainer = {
    x: 10, y: 41, width: 80, height: 45, rowGap: 1,
    layers: [
      { id: 'winner-position', field: 'position', label: 'Position', type: 'text', text: '', x: 0, y: 0, width: 24, height: 23, fontSize: 17, fontFamily: preset === 'editorial' ? 'serif' : 'sans', fontWeight: '800', color: palette.accent, align: 'left' },
      { id: 'winner-name', field: 'name', label: 'Name', type: 'text', text: '', x: 24, y: 22, width: 61, height: 46, fontSize: 35, fontFamily: preset === 'editorial' ? 'serif' : 'sans', fontWeight: '800', color: palette.text, align: 'left' },
      { id: 'winner-team', field: 'team', label: 'Team', type: 'text', text: '', x: 24, y: 69, width: 61, height: 26, fontSize: 22, fontFamily: preset === 'editorial' ? 'serif' : 'sans', fontWeight: '800', color: palette.accent, align: 'left' },
      { id: 'winner-photo', field: 'photo', label: 'Photo', type: 'image', text: '', x: 86, y: 0, width: 14, height: 95, fontSize: 12, fontFamily: 'sans', fontWeight: '600', color: palette.accent, align: 'center' },
    ],
  };
  return { version: 2, aspectRatio: '4:5', colorPreset, fontFamily: 'Arial', fontSize: 'standard', fontWeight: '800',
    backgroundColor: palette.background, accentColor: palette.accent, textColor: palette.text, backgroundOpacity: 1,
    decoration: preset === 'editorial' ? 'minimal' : preset === 'celebration' ? 'confetti' : 'arches', elements,
    winnerContainer };
}
type LegacyWinnerField = PosterWinnerField | 'grade' | 'score';

function legacyWinnerBinding(element: PosterElement): { rank: 1 | 2 | 3; field: LegacyWinnerField } | null {
  const fieldMatch = /^rank([123])\.(name|team|grade|score)$/.exec(element.field);
  if (fieldMatch) return { rank: Number(fieldMatch[1]) as 1 | 2 | 3, field: fieldMatch[2] as LegacyWinnerField };
  const idMatch = /^(place|position|name|team)[-_ ]*([123])$/i.exec(element.id);
  if (!idMatch) return null;
  const idField = idMatch[1].toLowerCase();
  return {
    rank: Number(idMatch[2]) as 1 | 2 | 3,
    field: idField === 'place' || idField === 'position' ? 'position' : idField as 'name' | 'team',
  };
}

function migrateLegacyWinnerContainer(elements: PosterElement[]): { elements: PosterElement[]; winnerContainer?: PosterWinnerContainer } {
  const bound = elements.map(element => ({ element, binding: legacyWinnerBinding(element) }));
  if (!bound.some(item => item.binding)) return { elements };

  const relevant = bound.filter(item => item.binding && ['position', 'name', 'team'].includes(item.binding.field));
  // Old grade/score-only bindings should be removed without constructing an
  // invalid container when there is no legacy position/name/team layout.
  if (!relevant.length) return { elements: elements.filter(element => !legacyWinnerBinding(element)) };
  const rankOne = relevant.filter(item => item.binding?.rank === 1);
  const firstAvailableRank = (relevant.find(item => item.binding?.field === 'name')?.binding?.rank ?? 1) as 1 | 2 | 3;
  const base = rankOne.length ? rankOne : relevant.filter(item => item.binding?.rank === firstAvailableRank);
  const placeSource = base.find(item => item.binding?.field === 'position')?.element;
  const baseY = placeSource?.y ?? Math.min(...base.map(item => item.element.y));
  const rowStart = (rank: number) => {
    const place = relevant.find(item => item.binding?.rank === rank && item.binding.field === 'position')?.element;
    const name = relevant.find(item => item.binding?.rank === rank && item.binding.field === 'name')?.element;
    return place?.y ?? name?.y ?? null;
  };
  const starts = [rowStart(1), rowStart(2), rowStart(3)].filter((value): value is number => value !== null).sort((a, b) => a - b);
  const differences = starts.slice(1).map((value, index) => value - starts[index]).filter(value => value >= 5);
  const rowStep = differences.length ? Math.min(...differences) : 15;
  const containerX = Math.max(0, Math.min(...base.map(item => item.element.x)));
  const containerWidth = Math.max(1, Math.min(100 - containerX, Math.max(...base.map(item => item.element.x + item.element.width)) - containerX));
  const containerY = Math.max(0, baseY);
  const containerHeight = Math.max(1, Math.min(100 - containerY, rowStep * 3 + 2));
  const defaults = createPosterPreset().winnerContainer!;
  const layers: PosterWinnerLayer[] = defaults.layers.map(defaultLayer => {
    const source = base.find(item => item.binding?.field === defaultLayer.field)?.element;
    if (!source) return defaultLayer;
    return {
      ...defaultLayer,
      label: defaultLayer.label,
      text: '',
      x: Math.max(0, Math.min(100, (source.x - containerX) / containerWidth * 100)),
      y: Math.max(0, Math.min(99, (source.y - containerY) / rowStep * 100)),
      width: Math.max(1, Math.min(100, source.width / containerWidth * 100)),
      height: Math.max(1, Math.min(100, source.height / rowStep * 100)),
      fontSize: source.fontSize,
      fontFamily: source.fontFamily,
      fontWeight: source.fontWeight,
      color: source.color,
      align: source.align,
    };
  });
  const migrated = new Set(bound.filter(item => item.binding).map(item => item.element.id));
  return {
    elements: elements.filter(element => !migrated.has(element.id)),
    winnerContainer: { x: containerX, y: containerY, width: containerWidth, height: containerHeight, rowGap: 1, layers },
  };
}

/** Stable labels for the single reusable winner row. Tied winners repeat the same place label. */
export function formatWinnerPosition(rank: 1 | 2 | 3): string {
  const names: Record<1 | 2 | 3, string> = { 1: 'FIRST', 2: 'SECOND', 3: 'THIRD' };
  return `${String(rank).padStart(2, '0')}  /  ${names[rank]} PLACE`;
}

export function orderedPosterWinners(result: CompetitionResult): ResultRank[] {
  return result.ranks
    .filter((rank): rank is ResultRank & { rank: 1 | 2 | 3 } => rank.rank === 1 || rank.rank === 2 || rank.rank === 3)
    .filter(rank => Boolean((rank.candidateName || rank.teamName || rank.teamCode || '').trim()))
    .slice()
    .sort((a, b) => a.rank - b.rank);
}

export function normalizePosterConfig(config?: PosterConfig): PosterConfig {
  const fallback = createPosterPreset(config?.colorPreset === 'monochrome' ? 'editorial' : config?.colorPreset === 'emerald' ? 'celebration' : 'laureate');
  const palette = POSTER_PALETTES[config?.colorPreset ?? 'royal'] ?? POSTER_PALETTES.royal;
  const normalized = { ...fallback, ...config, version: 2 as const,
    backgroundColor: config?.backgroundColor ?? palette.background,
    accentColor: config?.accentColor ?? palette.accent, textColor: config?.textColor ?? palette.text,
    elements: config?.elements ?? fallback.elements?.map(element => ({ ...element, color: element.color === fallback.accentColor ? palette.accent : palette.text })),
  };
  if (!config?.elements && config?.customTitle) normalized.elements = normalized.elements?.map(element => element.id === 'announcement' ? { ...element, text: config.customTitle! } : element);
  // Migrate earlier templates that stored separate rank-1/2/3 layers to one
  // reusable winner-item container. The container then repeats for all winners,
  // including ties, while unrelated text and image layers remain untouched.
  if (!config?.winnerContainer && config?.elements?.length) {
    const migrated = migrateLegacyWinnerContainer(normalized.elements ?? []);
    normalized.elements = migrated.elements;
    if (migrated.winnerContainer) normalized.winnerContainer = migrated.winnerContainer;
    else normalized.winnerContainer = undefined;
  }
  return normalized;
}
const isHex = (value: unknown): value is string => typeof value === 'string' && /^#[0-9a-f]{6}$/i.test(value);
export function isPosterImage(value: unknown): value is string {
  return typeof value === 'string' && /^data:image\/(png|jpeg|webp);base64,[A-Za-z0-9+/]+=*$/.test(value) && value.length <= 600000;
}
/** Shared server/client whitelist. No external URLs, SVG uploads or arbitrary markup. */
export function validatePosterConfig(value: unknown): PosterConfig {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error('Invalid poster configuration.');
  if (JSON.stringify(value).length > 700000) throw new Error('Invalid poster: images are too large. Please use smaller images.');
  const raw = value as Record<string, unknown>;
  const choice = <T extends string>(key: string, options: readonly T[], fallback: T): T => {
    if (raw[key] === undefined) return fallback;
    if (!options.includes(raw[key] as T)) throw new Error(`Invalid poster ${key}.`);
    return raw[key] as T;
  };
  const config: PosterConfig = {
    aspectRatio: choice<PosterConfig['aspectRatio']>('aspectRatio', ['1:1', '4:5', '9:16'], '4:5'),
    colorPreset: choice<PosterConfig['colorPreset']>('colorPreset', ['royal', 'crimson', 'emerald', 'monochrome'], 'royal'),
    fontFamily: 'Arial', fontSize: choice<PosterConfig['fontSize']>('fontSize', ['standard', 'large', 'compact'], 'standard'), fontWeight: '800', version: 2,
    decoration: choice<NonNullable<PosterConfig['decoration']>>('decoration', ['arches', 'confetti', 'minimal'], 'arches'),
  };
  for (const key of ['backgroundColor', 'accentColor', 'textColor'] as const) {
    if (raw[key] !== undefined) { if (!isHex(raw[key])) throw new Error(`Invalid poster ${key}.`); config[key] = raw[key]; }
  }
  if (raw.customTitle !== undefined) {
    if (typeof raw.customTitle !== 'string' || raw.customTitle.length > 160) throw new Error('Invalid poster title.');
    config.customTitle = raw.customTitle;
  }
  if (raw.backgroundImage) { if (!isPosterImage(raw.backgroundImage)) throw new Error('Invalid background image.'); config.backgroundImage = raw.backgroundImage; }
  if (raw.backgroundOpacity !== undefined) {
    if (typeof raw.backgroundOpacity !== 'number' || !Number.isFinite(raw.backgroundOpacity) || raw.backgroundOpacity < 0 || raw.backgroundOpacity > 1) throw new Error('Invalid background opacity.');
    config.backgroundOpacity = raw.backgroundOpacity;
  }
  if (raw.elements !== undefined) {
    if (!Array.isArray(raw.elements) || raw.elements.length > 30) throw new Error('Invalid poster: maximum 30 layers.');
    const ids = new Set<string>();
    config.elements = raw.elements.map((input: unknown) => {
      if (!input || typeof input !== 'object') throw new Error('Invalid poster layer.');
      const item = input as PosterElement;
      if (typeof item.id !== 'string' || !/^[\w-]{1,80}$/.test(item.id) || ids.has(item.id)) throw new Error('Invalid or duplicate layer ID.');
      ids.add(item.id);
      if (!['text', 'image'].includes(item.type) || (!POSTER_FIELDS.some(field => field.value === item.field) && !HIDDEN_LEGACY_POSTER_FIELDS.has(item.field))) throw new Error('Invalid layer type or field.');
      for (const key of ['label', 'text'] as const) if (typeof item[key] !== 'string' || item[key].length > (key === 'text' ? 500 : 80)) throw new Error('Invalid layer text.');
      for (const key of ['x', 'y', 'width', 'height', 'fontSize'] as const) {
        if (!Number.isFinite(item[key]) || item[key] < (key === 'width' || key === 'height' ? 1 : key === 'fontSize' ? 8 : 0) || item[key] > (key === 'fontSize' ? 180 : 100)) throw new Error('Invalid layer position or size.');
      }
      if (item.x + item.width > 100.01 || item.y + item.height > 100.01) throw new Error('Invalid layer: keep layers within the canvas.');
      if (!isHex(item.color) || !isPosterFont(item.fontFamily) || !['400', '600', '800'].includes(item.fontWeight) || !['left', 'center', 'right'].includes(item.align)) throw new Error('Invalid layer typography.');
      const layer: PosterElement = { id: item.id, type: item.type, label: item.label, field: item.field, text: item.text, x: item.x, y: item.y, width: item.width, height: item.height, fontSize: item.fontSize, fontFamily: item.fontFamily, fontWeight: item.fontWeight, color: item.color, align: item.align };
      if (item.type === 'image') { if (!isPosterImage(item.image)) throw new Error('Invalid layer image.'); layer.image = item.image; }
      return layer;
    });
  }

  if (raw.winnerContainer !== undefined && raw.winnerContainer !== null) {
    if (typeof raw.winnerContainer !== 'object' || Array.isArray(raw.winnerContainer)) throw new Error('Invalid winner container.');
    const container = raw.winnerContainer as PosterWinnerContainer;
    for (const key of ['x', 'y', 'width', 'height', 'rowGap'] as const) {
      const min = key === 'width' || key === 'height' ? 1 : 0;
      const max = key === 'rowGap' ? 10 : 100;
      if (!Number.isFinite(container[key]) || container[key] < min || container[key] > max) throw new Error('Invalid winner container dimensions.');
    }
    if (container.x + container.width > 100.01 || container.y + container.height > 100.01) throw new Error('Winner container must stay inside the poster.');
    if (!Array.isArray(container.layers) || container.layers.length > 8) throw new Error('Invalid winner item layers.');
    const allowedFields: PosterWinnerField[] = ['position', 'name', 'team', 'photo'];
    const childIds = new Set<string>();
    const winnerLayers: PosterWinnerLayer[] = container.layers.map((input: unknown) => {
      if (!input || typeof input !== 'object') throw new Error('Invalid winner item layer.');
      const item = input as PosterWinnerLayer;
      if (typeof item.id !== 'string' || !/^[\w-]{1,80}$/.test(item.id) || childIds.has(item.id)) throw new Error('Invalid or duplicate winner item layer ID.');
      childIds.add(item.id);
      if (!allowedFields.includes(item.field) || !['text', 'image'].includes(item.type)) throw new Error('Invalid winner item field.');
      if ((item.field === 'photo') !== (item.type === 'image')) throw new Error('Photo must be an image layer; other winner fields must be text layers.');
      if (typeof item.label !== 'string' || item.label.length > 80 || typeof item.text !== 'string' || item.text.length > 500) throw new Error('Invalid winner item text.');
      for (const key of ['x', 'y', 'width', 'height', 'fontSize'] as const) {
        if (!Number.isFinite(item[key]) || item[key] < (key === 'width' || key === 'height' ? 1 : key === 'fontSize' ? 8 : 0) || item[key] > (key === 'fontSize' ? 180 : 100)) throw new Error('Invalid winner item position or size.');
      }
      if (item.x + item.width > 100.01 || item.y + item.height > 100.01) throw new Error('Winner item layer must stay within its row.');
      if (!isHex(item.color) || !isPosterFont(item.fontFamily) || !['400', '600', '800'].includes(item.fontWeight) || !['left', 'center', 'right'].includes(item.align)) throw new Error('Invalid winner item typography.');
      const layer: PosterWinnerLayer = { id: item.id, field: item.field, label: item.label, type: item.type, text: item.text, x: item.x, y: item.y, width: item.width, height: item.height, fontSize: item.fontSize, fontFamily: item.fontFamily, fontWeight: item.fontWeight, color: item.color, align: item.align };
      if (item.image !== undefined) {
        if (!isPosterImage(item.image)) throw new Error('Invalid winner item image.');
        layer.image = item.image;
      }
      return layer;
    });
    config.winnerContainer = { x: container.x, y: container.y, width: container.width, height: container.height, rowGap: container.rowGap, layers: winnerLayers };
  } else if (raw.elements !== undefined) {
    // Distinguish older/custom layers from newly generated defaults in normalizePosterConfig.
    config.winnerContainer = undefined;
  }
  return normalizePosterConfig(config);
}
function rankMarkerForTextLayer(element: PosterElement): 1 | 2 | 3 | null {
  // Support the built-in presets and custom templates that use a separate text
  // layer for markers such as "03", "03 / THIRD PLACE", or "THIRD PLACE".
  const idMatch = /^(?:place|rank|position|prize)[-_ ]*0?([123])(?:$|[-_ ])/i.exec(element.id);
  if (idMatch) return Number(idMatch[1]) as 1 | 2 | 3;

  const candidates = [element.text, element.label];
  for (const candidate of candidates) {
    const value = candidate.trim();
    const numberMatch = /^0?([123])$/.exec(value);
    if (numberMatch) return Number(numberMatch[1]) as 1 | 2 | 3;

    const labelledMatch = /^0?([123])\s*(?:\/|[-–—:·|])\s*(?:FIRST|1ST|SECOND|2ND|THIRD|3RD)(?:\s+PLACE)?$/i.exec(value);
    if (labelledMatch) return Number(labelledMatch[1]) as 1 | 2 | 3;

    const ordinalMatch = /^(FIRST|1ST|SECOND|2ND|THIRD|3RD)(?:\s+PLACE)?$/i.exec(value);
    if (ordinalMatch) {
      const ordinal = ordinalMatch[1].toUpperCase();
      return ordinal === 'FIRST' || ordinal === '1ST' ? 1
        : ordinal === 'SECOND' || ordinal === '2ND' ? 2 : 3;
    }

    const prefixedMatch = /^(?:PLACE|RANK|POSITION|PRIZE)[-_ ]*0?([123])$/i.exec(value);
    if (prefixedMatch) return Number(prefixedMatch[1]) as 1 | 2 | 3;
  }
  return null;
}

function hasWinnerAtRank(result: CompetitionResult, rankNumber: number): boolean {
  return result.ranks.some(rank =>
    rank.rank === rankNumber &&
    Boolean((rank.candidateName || rank.teamName || rank.teamCode || '').trim())
  );
}

export function resolvePosterField(element: PosterElement, result: CompetitionResult, theme: PublicThemeSettings): string {
  if (element.field === 'text') {
    const markerRank = rankMarkerForTextLayer(element);
    if (markerRank && !hasWinnerAtRank(result, markerRank)) return '';
    return element.text;
  }
  if (element.field === 'festivalName' || element.field === 'institutionName') return theme[element.field] || '';
  if (element.field === 'competitionName' || element.field === 'categoryName' || element.field === 'competitionCode') return result[element.field] || '';
  const match = /^rank([123])\.(name|team)$/.exec(element.field);
  if (!match) return '';
  // The Rankify-style winner-list behaviour is preserved: every winner sharing a
  // rank is included, in order, with a line per person/team rather than taking
  // only the first matching entry.
  return result.ranks.filter(rank => rank.rank === Number(match[1])).map(rank =>
    match[2] === 'name' ? rank.candidateName : (rank.teamName || rank.teamCode)
  ).filter(Boolean).join('\n');
}
const escapeXml = (value: string) => value.replace(/[<>&"']/g, character => ({ '<': '&lt;', '>': '&gt;', '&': '&amp;', '"': '&quot;', "'": '&apos;' })[character]!);
function wrapText(text: string, capacity: number): string[] {
  return text.split('\n').flatMap(paragraph => {
    const words = paragraph.split(/\s+/).filter(Boolean); const lines: string[] = []; let line = '';
    for (const word of words) {
      if (line && (line.length + word.length + 1) > capacity) { lines.push(line); line = ''; }
      if (word.length > capacity) {
        if (line) { lines.push(line); line = ''; }
        const chars = Array.from(word);
        while (chars.length > capacity) lines.push(chars.splice(0, capacity).join(''));
        line = chars.join('');
      } else line = line ? `${line} ${word}` : word;
    }
    if (line) lines.push(line);
    return lines.length ? lines : [''];
  });
}
/** The same self-contained SVG is shown in the editor, public page and PNG export. */
export function renderPosterSvg(result: CompetitionResult, theme: PublicThemeSettings, input?: PosterConfig): string {
  const config = normalizePosterConfig(input); const { width, height } = posterDimensions(config.aspectRatio);
  const accent = isHex(config.accentColor) ? config.accentColor : '#EACB85';
  const background = isHex(config.backgroundColor) ? config.backgroundColor : '#142C50';
  // When an uploaded artwork is used as the background, it is the complete
  // background design. Do not add preset arches, lines, or confetti over it.
  let decoration = '';
  if (!config.backgroundImage) {
    if (config.decoration === 'arches') decoration = `<g fill="none" stroke="${accent}" opacity=".25"><path d="M32 ${height} V300 Q32 32 540 32 Q1048 32 1048 300 V${height}" stroke-width="2"/><path d="M52 ${height} V310 Q52 52 540 52 Q1028 52 1028 310 V${height}"/></g><circle cx="1060" cy="25" r="260" fill="${accent}" opacity=".05"/>`;
    if (config.decoration === 'minimal') decoration = `<path d="M72 50H1008M72 ${height - 45}H1008" stroke="${accent}" stroke-width="3"/>`;
    if (config.decoration === 'confetti') decoration = Array.from({ length: 26 }, (_, index) => `<circle cx="${index % 2 ? 28 + (index * 13) % 70 : 985 + (index * 11) % 70}" cy="${(index * 137 + 37) % height}" r="${3 + index % 6}" fill="${accent}" opacity=".4"/>`).join('');
  }
  const renderTextLayer = (
    element: { fontSize: number; fontWeight: '400' | '600' | '800'; fontFamily: string; color: string; align: 'left' | 'center' | 'right'; field: PosterField | PosterWinnerField },
    value: string,
    x: number,
    y: number,
    w: number,
    h: number,
  ) => {
    let size = element.fontSize;
    let lines = wrapText(value, Math.max(1, Math.floor(w / (size * .62))));
    while ((lines.length * size * 1.2 > h || Math.max(...lines.map(line => line.length), 0) * size * .62 > w) && size > 8) {
      size -= 1;
      lines = wrapText(value, Math.max(1, Math.floor(w / (size * .62))));
    }
    if (!value.trim()) return '';
    const anchor = element.align === 'left' ? 'start' : element.align === 'right' ? 'end' : 'middle';
    const tx = x + (element.align === 'center' ? w / 2 : element.align === 'right' ? w : 0);
    const ty = y + Math.max(size, (h - lines.length * size * 1.2) / 2 + size);
    const font = element.field === 'festivalName'
      ? festivalNameFontFamily(theme.festivalNameFont).replaceAll('"', '').replace('var(--font-montserrat), ', '')
      : posterFontCssFamily(element.fontFamily);
    return `<text fill="${isHex(element.color) ? element.color : '#FFFFFF'}" font-family="${escapeXml(font)}" font-size="${size}" font-weight="${element.fontWeight}" text-anchor="${anchor}">${lines.map((line, index) => `<tspan x="${tx}" y="${ty + index * size * 1.2}">${escapeXml(line)}</tspan>`).join('')}</text>`;
  };

  const layers = (config.elements ?? []).map(element => {
    const x = element.x / 100 * width, y = element.y / 100 * height, w = element.width / 100 * width, h = element.height / 100 * height;
    if (element.type === 'image') return isPosterImage(element.image) ? `<image x="${x}" y="${y}" width="${w}" height="${h}" href="${element.image}" preserveAspectRatio="xMidYMid meet"/>` : '';
    return renderTextLayer(element, resolvePosterField(element, result, theme), x, y, w, h);
  }).join('');

  const container = config.winnerContainer;
  const winners = orderedPosterWinners(result);
  // Keep the baseline three-row rhythm when only one or two places are
  // awarded. Additional tied winners compress evenly to fit the same container.
  const rowCapacity = Math.max(3, winners.length);
  const rowHeight = container && winners.length
    ? Math.max(0, (container.height - container.rowGap * (rowCapacity - 1)) / rowCapacity)
    : 0;
  const winnerLayers = container && winners.length ? winners.map((winner, rowIndex) => {
    const rowTop = container.y + rowIndex * (rowHeight + container.rowGap);
    return container.layers.map(layer => {
      const xPercent = container.x + container.width * layer.x / 100;
      const yPercent = rowTop + rowHeight * layer.y / 100;
      const wPercent = container.width * layer.width / 100;
      const hPercent = rowHeight * layer.height / 100;
      const x = xPercent / 100 * width, y = yPercent / 100 * height;
      const w = wPercent / 100 * width, h = hPercent / 100 * height;
      if (layer.field === 'photo') {
        if (isPosterImage(layer.image)) {
          return `<image x="${x}" y="${y}" width="${w}" height="${h}" href="${layer.image}" preserveAspectRatio="xMidYMid slice"/>`;
        }
        return `<g><rect x="${x}" y="${y}" width="${w}" height="${h}" rx="4" fill="#F8FAFC" stroke="#CBD5E1" stroke-width="2"/><text x="${x + w / 2}" y="${y + h / 2}" fill="#94A3B8" font-family="Arial, sans-serif" font-size="12" text-anchor="middle">PHOTO</text></g>`;
      }
      const value = layer.field === 'position'
        ? formatWinnerPosition(winner.rank)
        : layer.field === 'name' ? winner.candidateName : (winner.teamName || winner.teamCode);
      return renderTextLayer(layer, value, x, y, w, h);
    }).join('');
  }).join('') : '';
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}"><rect width="100%" height="100%" fill="${background}"/>${config.backgroundImage && isPosterImage(config.backgroundImage) ? `<image width="100%" height="100%" href="${config.backgroundImage}" opacity="${Math.max(0, Math.min(1, config.backgroundOpacity ?? 1))}" preserveAspectRatio="xMidYMid slice"/>` : ''}${decoration}${layers}${winnerLayers}</svg>`;
}
export function posterSvgDataUrl(result: CompetitionResult, theme: PublicThemeSettings, config?: PosterConfig) {
  return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(renderPosterSvg(result, theme, config))}`;
}

