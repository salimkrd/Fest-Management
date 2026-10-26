import type { PublicThemeSettings } from '@/types/fest';

const DAY_MS = 86400000;
export type FestivalPhase = 'UNCONFIGURED' | 'UPCOMING' | 'LIVE' | 'COMPLETED';
export type FestivalStatus = {
  phase: FestivalPhase;
  label: string;
  day?: number;
  totalDays?: number;
};

function dayNumber(value: string): number | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return null;
  const time = Date.parse(value + 'T00:00:00Z');
  if (!Number.isFinite(time) || new Date(time).toISOString().slice(0, 10) !== value) return null;
  return Math.round(time / DAY_MS);
}

/** Festival dates are calendar dates, not UTC timestamps. */
export function validateFestivalDates(start: string, end: string): void {
  const a = dayNumber(start);
  const b = dayNumber(end);
  if (a === null || b === null) throw new Error('Enter valid start and end dates.');
  if (a > b) throw new Error('End Date must be on or after Start Date.');
}

export function indiaCalendarDate(date: Date = new Date()): string {
  const parts = new Intl.DateTimeFormat('en-GB', {
    timeZone: 'Asia/Kolkata', year: 'numeric', month: '2-digit', day: '2-digit'
  }).formatToParts(date);
  const year = parts.find(part => part.type === 'year')?.value;
  const month = parts.find(part => part.type === 'month')?.value;
  const day = parts.find(part => part.type === 'day')?.value;
  return year + '-' + month + '-' + day;
}

export function getFestivalStatus(
  dates: Pick<PublicThemeSettings, 'festivalStartDate' | 'festivalEndDate'>,
  today: string = indiaCalendarDate()
): FestivalStatus {
  const a = dayNumber(dates.festivalStartDate || '');
  const b = dayNumber(dates.festivalEndDate || '');
  const now = dayNumber(today);
  if (a == null || b == null || now == null || a > b) return { phase: 'UNCONFIGURED', label: 'DATES NOT SET' };
  const totalDays = b - a + 1;
  if (now < a) return { phase: 'UPCOMING', label: 'UPCOMING', totalDays };
  if (now > b) return { phase: 'COMPLETED', label: 'COMPLETED', totalDays };
  const day = now - a + 1;
  return { phase: 'LIVE', day, totalDays, label: 'LIVE · Day ' + day + ' of ' + totalDays };
}

export function normalizeFestivalSettings(form: {
  festivalName: string; institutionName: string; logoUrl: string;
  festivalStartDate: string; festivalEndDate: string;
}): { festivalName: string; institutionName: string; logoUrl: string; festivalStartDate: string; festivalEndDate: string; year: string } {
  const festivalName = form.festivalName.trim();
  const institutionName = form.institutionName.trim();
  const logoUrl = form.logoUrl.trim();
  if (!festivalName || festivalName.length > 100) throw new Error('Festival Name is required (maximum 100 characters).');
  if (!institutionName || institutionName.length > 150) throw new Error('Institution Name is required (maximum 150 characters).');
  if (logoUrl) {
    let url: URL;
    try { url = new URL(logoUrl); } catch { throw new Error('Enter a valid direct image URL for the festival logo.'); }
    if (url.protocol !== 'https:' || url.username || url.password ||
        logoUrl.length > 2048 || /(?:chatgpt\.com|chat\.openai\.com)$/i.test(url.hostname) && url.pathname.startsWith('/c/')) {
      throw new Error('Use a public direct image URL, not a ChatGPT conversation link.');
    }
  }
  validateFestivalDates(form.festivalStartDate, form.festivalEndDate);
  return {
    festivalName, institutionName, logoUrl,
    festivalStartDate: form.festivalStartDate,
    festivalEndDate: form.festivalEndDate,
    year: form.festivalStartDate.slice(0, 4)
  };
}
