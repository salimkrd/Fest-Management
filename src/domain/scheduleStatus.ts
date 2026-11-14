export type CompetitionScheduleStatus = 'SCHEDULED' | 'LIVE' | 'COMPLETED';

export interface ScheduleTimeFields {
  date: string;
  startTime: string;
  status: string;
}

/** Parse a stored timetable time into minutes after midnight. */
export function parseScheduleTimeMinutes(value: string): number | null {
  const match = String(value || '').trim().match(/^(\d{1,2}):(\d{2})\s*(AM|PM)?$/i);
  if (!match) return null;

  const rawHours = Number(match[1]);
  const minutes = Number(match[2]);
  if (!Number.isInteger(minutes) || minutes < 0 || minutes > 59) return null;

  if (match[3]) {
    if (rawHours < 1 || rawHours > 12) return null;
    let hours = rawHours % 12;
    if (match[3].toUpperCase() === 'PM') hours += 12;
    return hours * 60 + minutes;
  }

  if (rawHours < 0 || rawHours > 23) return null;
  return rawHours * 60 + minutes;
}

/**
 * Convert a festival-local date/time into an epoch timestamp.
 * Festival schedules use Asia/Kolkata (UTC+05:30), independent of the
 * serverless function's configured timezone.
 */
export function getScheduleStartTimestamp(date: string, startTime: string): number | null {
  const dateMatch = String(date || '').trim().match(/^(\d{4})-(\d{2})-(\d{2})$/);
  const minutesAfterMidnight = parseScheduleTimeMinutes(startTime);
  if (!dateMatch || minutesAfterMidnight === null) return null;

  const year = Number(dateMatch[1]);
  const month = Number(dateMatch[2]);
  const day = Number(dateMatch[3]);
  const dateCheck = new Date(Date.UTC(year, month - 1, day));
  if (
    year < 1000 ||
    dateCheck.getUTCFullYear() !== year ||
    dateCheck.getUTCMonth() !== month - 1 ||
    dateCheck.getUTCDate() !== day
  ) return null;

  const localMidnightAsUtc = Date.UTC(year, month - 1, day);
  return localMidnightAsUtc + minutesAfterMidnight * 60_000 - 330 * 60_000;
}

export function getKolkataDateInput(now: Date = new Date()): string {
  const parts = new Intl.DateTimeFormat('en-GB', {
    timeZone: 'Asia/Kolkata',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit'
  }).formatToParts(now);
  const values = Object.fromEntries(parts.map(part => [part.type, part.value]));
  return `${values.year}-${values.month}-${values.day}`;
}

export function shouldScheduleBecomeLive(slot: ScheduleTimeFields, nowMs: number): boolean {
  if (slot.status !== 'SCHEDULED') return false;
  const startAt = getScheduleStartTimestamp(slot.date, slot.startTime);
  return startAt !== null && startAt <= nowMs;
}

export function resolveCompetitionScheduleStatus(statuses: string[]): CompetitionScheduleStatus {
  if (statuses.length > 0 && statuses.every(status => status === 'COMPLETED')) return 'COMPLETED';
  if (statuses.some(status => status === 'LIVE')) return 'LIVE';
  return 'SCHEDULED';
}
