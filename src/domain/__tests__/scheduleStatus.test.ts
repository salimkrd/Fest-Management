import { describe, expect, it } from 'vitest';
import {
  getScheduleStartTimestamp,
  parseScheduleTimeMinutes,
  resolveCompetitionScheduleStatus,
  shouldScheduleBecomeLive
} from '../scheduleStatus';

describe('competition schedule lifecycle', () => {
  it('parses 24-hour and 12-hour timetable times', () => {
    expect(parseScheduleTimeMinutes('00:15')).toBe(15);
    expect(parseScheduleTimeMinutes('13:45')).toBe(825);
    expect(parseScheduleTimeMinutes('12:00 AM')).toBe(0);
    expect(parseScheduleTimeMinutes('12:00 PM')).toBe(720);
    expect(parseScheduleTimeMinutes('09:30 AM')).toBe(570);
    expect(parseScheduleTimeMinutes('09:30 PM')).toBe(1290);
  });

  it('rejects malformed times and impossible calendar dates', () => {
    expect(parseScheduleTimeMinutes('25:00')).toBeNull();
    expect(parseScheduleTimeMinutes('13:00 PM')).toBeNull();
    expect(parseScheduleTimeMinutes('09:75')).toBeNull();
    expect(getScheduleStartTimestamp('2026-02-30', '09:00 AM')).toBeNull();
    expect(getScheduleStartTimestamp('not-a-date', '09:00 AM')).toBeNull();
  });

  it('interprets a festival schedule as Asia/Kolkata time regardless of server timezone', () => {
    const timestamp = getScheduleStartTimestamp('2026-11-17', '09:00 AM');
    expect(timestamp).toBe(Date.UTC(2026, 10, 17, 3, 30));
  });

  it('activates only scheduled slots once their start time has arrived', () => {
    const start = getScheduleStartTimestamp('2026-11-17', '09:00 AM')!;
    const slot = { date: '2026-11-17', startTime: '09:00 AM', status: 'SCHEDULED' };
    expect(shouldScheduleBecomeLive(slot, start - 1)).toBe(false);
    expect(shouldScheduleBecomeLive(slot, start)).toBe(true);
    expect(shouldScheduleBecomeLive({ ...slot, status: 'LIVE' }, start + 1000)).toBe(false);
    expect(shouldScheduleBecomeLive({ ...slot, status: 'COMPLETED' }, start + 1000)).toBe(false);
  });

  it('keeps competition status live while any slot is live and completes only when all slots are complete', () => {
    expect(resolveCompetitionScheduleStatus(['SCHEDULED', 'SCHEDULED'])).toBe('SCHEDULED');
    expect(resolveCompetitionScheduleStatus(['LIVE', 'COMPLETED'])).toBe('LIVE');
    expect(resolveCompetitionScheduleStatus(['COMPLETED', 'COMPLETED'])).toBe('COMPLETED');
    expect(resolveCompetitionScheduleStatus([])).toBe('SCHEDULED');
  });
});
