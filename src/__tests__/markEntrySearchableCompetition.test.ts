import { describe, expect, it } from 'vitest';
import { filterCompetitions } from '../app/admin/mark-entry/CompetitionSearchSelect';
import type { Competition } from '@/types/fest';

type SearchableCompetition = Pick<Competition, 'id' | 'name' | 'code' | 'categoryName'>;

const competitions: SearchableCompetition[] = [
  { id: '1', name: "Tahaddil Qira'ah", code: 'CMP-01', categoryName: 'SECONDARY ZONE' },
  { id: '2', name: 'Arabic Speech', code: 'CMP-02', categoryName: 'HIGHER SECONDARY' },
  { id: '3', name: 'English Essay', code: 'CMP-03', categoryName: 'JUNIOR ZONE' }
];

describe('Mark Entry Assign Judge competition search', () => {
  it('returns every competition when the search is empty', () => {
    expect(filterCompetitions(competitions, '')).toEqual(competitions);
  });

  it('matches competition names without case sensitivity', () => {
    expect(filterCompetitions(competitions, "TAHADDIL")).toEqual([competitions[0]]);
  });

  it('matches competition codes', () => {
    expect(filterCompetitions(competitions, 'cmp-02')).toEqual([competitions[1]]);
  });

  it('matches category names and ignores surrounding whitespace', () => {
    expect(filterCompetitions(competitions, '  higher secondary  ')).toEqual([competitions[1]]);
  });

  it('returns an empty list when no competition matches', () => {
    expect(filterCompetitions(competitions, 'not-found')).toEqual([]);
  });
});
