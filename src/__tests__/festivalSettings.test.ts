import { describe, expect, it } from 'vitest';
import { getFestivalStatus, indiaCalendarDate, normalizeFestivalSettings, validateFestivalDates } from '@/domain/festivalSettings';
import { FESTIVAL_NAME_FONTS, festivalNameFontFamily, isFestivalNameFont, festivalFontStylesheet } from '@/domain/festivalFonts';

const range = { festivalStartDate: '2026-10-16', festivalEndDate: '2026-10-18' };

describe('Chief Admin festival settings and live status', () => {
  it('handles full three-day schedule in Kerala calendar dates', () => {
    expect(getFestivalStatus(range, '2026-10-15').phase).toBe('UPCOMING');
    expect(getFestivalStatus(range, '2026-10-16').label).toBe('LIVE · Day 1 of 3');
    expect(getFestivalStatus(range, '2026-10-17').label).toBe('LIVE · Day 2 of 3');
    expect(getFestivalStatus(range, '2026-10-18').label).toBe('LIVE · Day 3 of 3');
    expect(getFestivalStatus(range, '2026-10-19').phase).toBe('COMPLETED');
    expect(getFestivalStatus({}, '2026-10-17').label).toBe('DATES NOT SET');
  });
  it('computes today in India rather than UTC', () => {
    expect(indiaCalendarDate(new Date('2026-10-16T20:00:00.000Z'))).toBe('2026-10-17');
  });
  it('rejects impossible and reversed dates', () => {
    expect(() => validateFestivalDates('2026-02-30','2026-03-02')).toThrow();
    expect(() => validateFestivalDates('2026-10-18','2026-10-16')).toThrow(/End Date/);
  });
  it('persists a whitelisted festival name font and supports searchable font options', () => {
    expect(FESTIVAL_NAME_FONTS.length).toBeGreaterThanOrEqual(12);
    expect(festivalNameFontFamily('Poppins')).toContain('Poppins');
    expect(festivalNameFontFamily('unknown')).toContain('Montserrat');
    expect(isFestivalNameFont('Bebas Neue')).toBe(true);
    expect(isFestivalNameFont('url(javascript:evil)')).toBe(false);
    expect(festivalFontStylesheet(['Poppins'])).toContain('fonts.googleapis.com');
    const input = { festivalName: 'INSPIRAATH 26', institutionName: 'Suffa',
      logoUrl: '', festivalStartDate: '2026-10-16', festivalEndDate: '2026-10-18', festivalNameFont: 'Poppins' };
    expect(normalizeFestivalSettings(input).festivalNameFont).toBe('Poppins');
    expect(() => normalizeFestivalSettings({ ...input, festivalNameFont: 'no such font' })).toThrow(/font/i);
  });
  it('preserves validated festival settings and derives festival year', () => {
    const normalized = normalizeFestivalSettings({
      festivalName: '  INSPIRAATH 26  ', institutionName: ' Suffa Campus Vavoor ',
      logoUrl: 'https://example.com/logo.png', festivalStartDate: '2026-10-16',
      festivalEndDate: '2026-10-18'
    });
    expect(normalized).toEqual({
      festivalName: 'INSPIRAATH 26', festivalNameFont: 'Montserrat', institutionName: 'Suffa Campus Vavoor',
      logoUrl: 'https://example.com/logo.png', festivalStartDate: '2026-10-16',
      festivalEndDate: '2026-10-18', year: '2026'
    });
    expect(() => normalizeFestivalSettings({ ...normalized, logoUrl: 'https://chatgpt.com/c/xyz' })).toThrow();
  });
});
