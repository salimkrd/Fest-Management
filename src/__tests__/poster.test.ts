import { describe, expect, it } from 'vitest';
import {
  createPosterPreset,
  createTextElement,
  isPosterImage,
  normalizePosterConfig,
  posterDimensions,
  posterSvgDataUrl,
  renderPosterSvg,
  resolvePosterField,
  validatePosterConfig,
} from '@/domain/poster';
import type { CompetitionResult, PosterConfig, PosterElement, PosterField, PublicThemeSettings, ResultRank } from '@/types/fest';

const theme: PublicThemeSettings = {
  festivalName: 'Inspira Arts Festival', institutionName: 'Festival College', tagline: 'Celebrate talent',
  year: '2026', primaryColor: '#142C50', secondaryColor: '#FFFFFF', accentColor: '#EACB85',
  headingFont: 'Arial', bodyFont: 'Arial', fontFamily: 'Arial', backgroundStyle: 'clean-white',
  cardStyle: 'bordered', heroBannerText: 'Official results',
};

function winner(overrides: Partial<ResultRank> = {}): ResultRank {
  return {
    rank: 1, registrationId: 'registration-1', bib: '101', candidateName: 'Ameen Farhan',
    teamId: 'team-1', teamCode: 'BLU', teamName: 'Blue House', teamColor: '#2563EB',
    score: 95, grade: 'A+', officialPoints: 11, totalEarnedPoints: 11, ...overrides,
  };
}

function result(ranks: ResultRank[] = [winner()]): CompetitionResult {
  return {
    id: 'result-1', competitionId: 'competition-1', competitionCode: 'ELO-SR',
    competitionName: 'English Elocution', categoryName: 'Senior', type: 'SOLO', stageName: 'Stage 1',
    marksStatus: 'COMPLETE', resultStatus: 'PUBLISHED', posterReleased: true, ranks,
  };
}

function withElements(...elements: PosterElement[]): PosterConfig {
  return { ...createPosterPreset(), decoration: 'minimal', elements };
}

function textLayer(field: PosterField = 'text', text = ''): PosterElement {
  return { ...createTextElement('content', field, text), x: 0, y: 0, width: 100, height: 40 };
}

// Read only the generated text nodes, so assertions verify content rather than layout serialization.
function renderedText(svg: string): string[] {
  return [...svg.matchAll(/<tspan\b[^>]*>([\s\S]*?)<\/tspan>/g)].map(match => match[1]
    .replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'").replace(/&amp;/g, '&'));
}

const pixelPng = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jRZkAAAAASUVORK5CYII=';

describe('Poster configuration validation', () => {
  it.each(['laureate', 'editorial', 'celebration'] as const)('accepts the complete %s preset', preset => {
    const config = createPosterPreset(preset);
    expect(validatePosterConfig(config)).toEqual(config);
  });

  it.each([null, undefined, false, 'poster', [], 10])('rejects a non-object configuration: %j', input => {
    expect(() => validatePosterConfig(input)).toThrow(/configuration/i);
  });

  it.each([
    'https://example.com/background.png',
    'http://127.0.0.1/private.jpg',
    'javascript:alert(1)',
    'data:image/svg+xml;base64,PHN2Zy8+',
    'data:image/svg+xml,<svg onload="alert(1)"/>',
    'data:text/html;base64,PGgxPkhlbGxvPC9oMT4=',
    'data:image/png;base64,abc" onload="alert(1)',
  ])('rejects unsafe image sources for backgrounds and image layers: %s', source => {
    expect(isPosterImage(source)).toBe(false);
    expect(() => validatePosterConfig({ ...createPosterPreset(), backgroundImage: source })).toThrow(/image/i);
    const imageLayer = { ...textLayer(), type: 'image' as const, image: source };
    expect(() => validatePosterConfig(withElements(imageLayer))).toThrow(/image/i);
  });

  it('keeps uploaded raster images self-contained in validated previews', () => {
    const config = validatePosterConfig({
      ...withElements({ ...textLayer(), type: 'image', image: pixelPng }),
      backgroundImage: pixelPng, backgroundOpacity: 0.5,
    });
    const svg = renderPosterSvg(result(), theme, config);
    expect(isPosterImage(pixelPng)).toBe(true);
    expect(svg.match(/<image\b/g)).toHaveLength(2);
    expect(svg).toContain(`href="${pixelPng}"`);
    expect(svg).toContain('opacity="0.5"');
  });

  it('rejects duplicate layer IDs, even when their fields differ', () => {
    expect(() => validatePosterConfig(withElements(textLayer('festivalName'), textLayer('rank1.name'))))
      .toThrow(/duplicate/i);
  });

  it.each(['x', 'y', 'width', 'height', 'fontSize'] as const)('rejects NaN and infinity for %s', key => {
    for (const value of [NaN, Infinity, -Infinity]) {
      expect(() => validatePosterConfig(withElements({ ...textLayer(), [key]: value })))
        .toThrow(/position|size/i);
    }
  });

  it.each([
    { x: -1 }, { y: -1 }, { width: 0 }, { height: 0 }, { width: 101 }, { height: 101 },
    { x: 90, width: 20 }, { y: 90, height: 20 }, { fontSize: 181 }, { fontSize: 7 },
  ])('rejects invalid geometry or layers outside the canvas: %j', patch => {
    expect(() => validatePosterConfig(withElements({ ...textLayer(), ...patch })))
      .toThrow(/position|size|canvas/i);
  });

  it('rejects unsupported bindings instead of reading arbitrary result properties', () => {
    expect(() => validatePosterConfig({
      ...createPosterPreset(), elements: [{ ...textLayer(), field: 'ranks.0.registrationId' }],
    })).toThrow(/field/i);
  });

  it('rejects more than 30 layers', () => {
    const layers = Array.from({ length: 31 }, (_, index) => ({ ...textLayer(), id: `layer-${index}` }));
    expect(() => validatePosterConfig(withElements(...layers))).toThrow(/30 layers/i);
  });

  it('rejects oversized individual images and oversized combined uploads', () => {
    const oversizedImage = `data:image/png;base64,${'A'.repeat(600000)}`;
    expect(isPosterImage(oversizedImage)).toBe(false);
    expect(() => validatePosterConfig({ ...createPosterPreset(), backgroundImage: oversizedImage })).toThrow(/image/i);
    const largeImage = `data:image/png;base64,${'A'.repeat(360000)}`;
    expect(() => validatePosterConfig({
      ...withElements({ ...textLayer(), type: 'image', image: largeImage }), backgroundImage: largeImage,
    })).toThrow(/too large/i);
  });

  it.each([NaN, Infinity, -0.1, 1.1])('rejects invalid background opacity: %s', opacity => {
    expect(() => validatePosterConfig({ ...createPosterPreset(), backgroundOpacity: opacity })).toThrow(/opacity/i);
  });

  it('rejects oversized custom text and unsafe typography', () => {
    expect(() => validatePosterConfig(withElements(textLayer('text', 'A'.repeat(501))))).toThrow(/text/i);
    expect(() => validatePosterConfig(withElements({ ...textLayer(), color: 'url(https://example.com/image)' })))
      .toThrow(/typography/i);
    expect(() => validatePosterConfig({
      ...createPosterPreset(), elements: [{ ...textLayer(), fontWeight: '800" onload="alert(1)' }],
    })).toThrow(/typography/i);
  });
});

describe('Poster result bindings and shared rendering', () => {
  it('includes every tied winner and keeps corresponding team, grade and score order', () => {
    const tied = result([
      winner({ candidateName: 'Ameen', teamName: 'Blue House', score: 95, grade: 'A+' }),
      winner({ registrationId: 'registration-2', candidateName: 'Bilal', teamName: 'Gold House', score: 95, grade: 'A' }),
      winner({ registrationId: 'registration-3', rank: 3, candidateName: 'Farhan', teamName: 'Green House', score: 88 }),
    ]);
    expect(resolvePosterField(textLayer('rank1.name'), tied, theme)).toBe('Ameen\nBilal');
    expect(resolvePosterField(textLayer('rank1.team'), tied, theme)).toBe('Blue House\nGold House');
    expect(resolvePosterField(textLayer('rank1.grade'), tied, theme)).toBe('Grade A+\nGrade A');
    expect(resolvePosterField(textLayer('rank1.score'), tied, theme)).toBe('95 marks\n95 marks');
    const names = renderedText(renderPosterSvg(tied, theme, withElements(textLayer('rank1.name'))));
    expect(names).toEqual(['Ameen', 'Bilal']);
  });

  it('leaves missing ranks empty without shifting another winner into the gap', () => {
    const sparse = result([
      winner({ rank: null, candidateName: 'Unranked participant' }),
      winner({ rank: 3, candidateName: 'Actual third place' }),
    ]);
    for (const field of ['rank1.name', 'rank2.name', 'rank2.team', 'rank2.grade', 'rank2.score'] as const) {
      expect(resolvePosterField(textLayer(field, 'Do not substitute this'), sparse, theme)).toBe('');
    }
    const svg = renderPosterSvg(sparse, theme, withElements(textLayer('rank2.name')));
    expect(renderedText(svg).join('')).toBe('');
    expect(svg).not.toContain('Unranked participant');
    expect(svg).not.toContain('Actual third place');
    expect(resolvePosterField(textLayer('rank3.name'), sparse, theme)).toBe('Actual third place');
  });

  it('handles no winners, missing team names and no-grade values without inventing data', () => {
    expect(resolvePosterField(textLayer('rank1.name'), result([]), theme)).toBe('');
    const noGrade = result([winner({ teamName: '', teamCode: 'RED', grade: 'NO_GRADE' })]);
    expect(resolvePosterField(textLayer('rank1.team'), noGrade, theme)).toBe('RED');
    expect(resolvePosterField(textLayer('rank1.grade'), noGrade, theme)).toBe('');
  });

  it('uses festival-name-only font for the branded poster layer', () => {
    const branded = renderPosterSvg(result(), { ...theme, festivalNameFont: 'Cinzel' },
      withElements(textLayer('festivalName'), textLayer('competitionName')));
    expect(branded).toContain('font-family="Cinzel, serif"');
    expect(branded).toContain('font-family="Arial, sans-serif"');
  });

  it.each(['text', 'festivalName', 'competitionName', 'rank1.name'] as const)('escapes markup from %s without losing the displayed text', field => {
    const content = '<script>"&\'</script>';
    const sample = { ...result([winner({ candidateName: content })]), competitionName: content };
    const svg = renderPosterSvg(sample, { ...theme, festivalName: content }, withElements(textLayer(field, content)));
    expect(svg).toContain('&lt;script&gt;&quot;&amp;&apos;&lt;/script&gt;');
    expect(svg).not.toContain('<script>');
    expect(renderedText(svg).join('')).toBe(content);
  });

  it('wraps and scales a long unbroken name while retaining every character', () => {
    const name = 'VeryLongParticipantName'.repeat(12);
    const config = withElements({ ...textLayer('rank1.name'), x: 10, y: 20, width: 80, height: 60, fontSize: 100 });
    const svg = renderPosterSvg(result([winner({ candidateName: name })]), theme, config);
    expect(renderedText(svg).length).toBeGreaterThan(1);
    expect(renderedText(svg).join('')).toBe(name);
    const fontSize = Number(svg.match(/font-size="([\d.]+)"/)?.[1]);
    expect(fontSize).toBeGreaterThanOrEqual(8);
    expect(fontSize).toBeLessThan(100);
    expect(svg).not.toMatch(/NaN|Infinity|undefined/);
  });

  it('preserves Malayalam names through SVG rendering and data URL encoding', () => {
    const name = 'മുഹമ്മദ് അമീൻ';
    const sample = result([winner({ candidateName: name })]);
    const config = withElements(textLayer('rank1.name'));
    const svg = renderPosterSvg(sample, theme, config);
    expect(renderedText(svg).join(' ')).toBe(name);
    expect(svg).not.toContain('\uFFFD');
    const url = posterSvgDataUrl(sample, theme, config);
    expect(url).toMatch(/^data:image\/svg\+xml;charset=utf-8,/);
    expect(decodeURIComponent(url.slice(url.indexOf(',') + 1))).toBe(svg);
  });

  it.each([
    ['1:1', 1080], ['4:5', 1350], ['9:16', 1920],
  ] as const)('renders the %s ratio at full export dimensions', (aspectRatio, height) => {
    const config = validatePosterConfig({ ...createPosterPreset(), aspectRatio });
    expect(posterDimensions(aspectRatio)).toEqual({ width: 1080, height });
    expect(renderPosterSvg(result(), theme, config)).toContain(`width="1080" height="${height}" viewBox="0 0 1080 ${height}"`);
  });
});

describe('Legacy poster compatibility', () => {
  it('upgrades saved palette and title settings into populated editable layers', () => {
    const legacy: PosterConfig = {
      aspectRatio: '1:1', colorPreset: 'crimson', fontFamily: 'Arial', fontSize: 'large',
      fontWeight: '800', customTitle: 'Congratulations, champions!',
    };
    const normalized = normalizePosterConfig(legacy);
    expect(normalized.version).toBe(2);
    expect(normalized.aspectRatio).toBe('1:1');
    expect(normalized.backgroundColor).toBe('#571E32');
    expect(normalized.accentColor).toBe('#F9D59B');
    expect(normalized.elements?.find(element => element.id === 'announcement')?.text).toBe(legacy.customTitle);
    expect(normalized.elements?.some(element => element.field === 'rank1.name')).toBe(true);
    expect(renderedText(renderPosterSvg(result(), theme, legacy)).join(' ')).toContain(legacy.customTitle);
    expect(legacy).not.toHaveProperty('elements');
  });

  it('provides a usable template when no saved configuration exists', () => {
    const normalized = normalizePosterConfig();
    expect(normalized.elements?.length).toBeGreaterThan(0);
    expect(validatePosterConfig(normalized)).toEqual(normalized);
    expect(renderedText(renderPosterSvg(result(), theme)).join(' ')).toContain('Ameen Farhan');
  });

  it('retains explicitly saved custom layers instead of restoring removed preset fields', () => {
    const config = withElements({ ...textLayer('rank1.name'), color: '#123456', x: 10, width: 80 });
    const normalized = normalizePosterConfig(config);
    expect(normalized.elements).toEqual(config.elements);
    expect(normalized.elements).toHaveLength(1);
    expect(normalizePosterConfig({ ...config, elements: [] }).elements).toEqual([]);
  });
});
