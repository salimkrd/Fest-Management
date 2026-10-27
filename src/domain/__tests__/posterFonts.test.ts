import { describe, expect, it } from 'vitest';
import {
  isPosterFont,
  POSTER_FONT_GROUPS,
  POSTER_FONT_NAMES,
  posterFontCssFamily,
} from '../posterFonts';
import { createPosterPreset, validatePosterConfig } from '../poster';

describe('Media Studio poster font library', () => {
  it('includes the requested font families grouped for the editor', () => {
    const groups = new Map(POSTER_FONT_GROUPS.map(group => [group.category, group.fonts.map(font => font.name)]));
    expect(groups.get('Sans-Serif')).toContain('Plus Jakarta Sans');
    expect(groups.get('Display / Headlines')).toContain('Big Shoulders Display');
    expect(groups.get('Special / Fun')).toContain('Press Start 2P');
    expect(groups.get('Script / Handwriting')).toContain('Great Vibes');
    expect(groups.get('Monospace')).toContain('JetBrains Mono');
    expect(groups.get('Malayalam')).toContain('Noto Sans Malayalam');
    expect(groups.get('Special / Fun')).toContain('Comfortaa');
    expect(POSTER_FONT_NAMES.length).toBeGreaterThan(100);
  });

  it('supports the new font names and preserves the older font values', () => {
    expect(isPosterFont('Dancing Script')).toBe(true);
    expect(isPosterFont('Noto Sans Malayalam')).toBe(true);
    expect(isPosterFont('sans')).toBe(true);
    expect(isPosterFont('serif')).toBe(true);
    expect(isPosterFont('mono')).toBe(true);
    expect(isPosterFont('url(https://example.com/font.css)')).toBe(false);
    expect(posterFontCssFamily('Dancing Script')).toBe('"Dancing Script", cursive');
    expect(posterFontCssFamily('sans')).toBe('Arial, sans-serif');
  });

  it('validates and keeps a named font in a saved poster configuration', () => {
    const preset = createPosterPreset();
    const config = {
      ...preset,
      elements: (preset.elements ?? []).map(element => element.id === 'announcement'
        ? { ...element, fontFamily: 'Bebas Neue' }
        : element),
    };
    expect(validatePosterConfig(config).elements?.find(element => element.id === 'announcement')?.fontFamily)
      .toBe('Bebas Neue');
  });

  it('rejects untrusted font-family values', () => {
    const preset = createPosterPreset();
    const config = {
      ...preset,
      elements: (preset.elements ?? []).map(element => element.id === 'announcement'
        ? { ...element, fontFamily: '"); @import url(https://example.com/evil.css)' }
        : element),
    };
    expect(() => validatePosterConfig(config)).toThrow('Invalid layer typography.');
  });
});
