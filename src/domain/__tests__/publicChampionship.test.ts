import { describe, expect, it } from 'vitest';
import type { CompetitionResult, ResultRank, Team } from '@/types/fest';
import {
  buildDivisionTeamStandings,
  getChampionshipDivision,
  getPublishedOfficialPoints
} from '../publicChampionship';

const makeTeam = (id: string, code: string): Team => ({
  id,
  code,
  name: `Team ${code}`,
  color: '#86152C',
  managerName: '',
  managerEmail: '',
  managerPhone: '',
  zone: '',
  contestantsCount: 0,
  eventsCount: 0,
  totalPoints: 999,
  soloPoints: 999,
  groupPoints: 999,
  rank: 1,
  firstCount: 0,
  secondCount: 0,
  thirdCount: 0,
  portalAccess: true
});

const makeRank = (
  team: Team,
  rank: 1 | 2 | 3 | null,
  points: number | undefined,
  legacyPoints?: number
): ResultRank => ({
  rank,
  registrationId: `reg-${team.id}-${rank}`,
  bib: '#101',
  candidateName: 'Participant',
  teamId: team.id,
  teamCode: team.code,
  teamName: team.name,
  teamColor: team.color,
  score: 90,
  grade: 'A',
  officialPoints: points as number,
  totalEarnedPoints: legacyPoints as number
});

const makeResult = (
  id: string,
  categoryName: string,
  type: 'SOLO' | 'GROUP',
  ranks: ResultRank[],
  resultStatus: CompetitionResult['resultStatus'] = 'PUBLISHED'
): CompetitionResult => ({
  id,
  competitionId: `comp-${id}`,
  competitionCode: id,
  competitionName: id,
  categoryName,
  type,
  stageName: 'Main Stage',
  marksStatus: 'COMPLETE',
  resultStatus,
  publishedDate: '2026-11-16',
  ranks,
  posterReleased: false
});

describe('Public championship division standings', () => {
  const senior = makeTeam('team-senior', 'SEN');
  const general = makeTeam('team-general', 'GEN');

  it('normalizes the three official division names and the legacy Junior label', () => {
    expect(getChampionshipDivision('Senior Division')).toBe('SENIOR');
    expect(getChampionshipDivision('GENERAL')).toBe('GENERAL');
    expect(getChampionshipDivision('Sub-Junior')).toBe('SUB_JUNIOR');
    expect(getChampionshipDivision('Junior')).toBe('SUB_JUNIOR');
    expect(getChampionshipDivision('Other')).toBeNull();
  });

  it('uses only published results from the selected division', () => {
    const results = [
      makeResult('senior-published', 'Senior', 'SOLO', [makeRank(senior, 1, 11)]),
      makeResult('general-published', 'General', 'GROUP', [makeRank(general, 1, 23)]),
      makeResult('senior-unpublished', 'Senior', 'SOLO', [makeRank(general, 1, 100)], 'READY_FOR_REVIEW')
    ];

    const standings = buildDivisionTeamStandings([senior, general], results, 'SENIOR');

    expect(standings).toHaveLength(1);
    expect(standings[0].id).toBe(senior.id);
    expect(standings[0].totalPoints).toBe(11);
    expect(standings[0].soloPoints).toBe(11);
    expect(standings[0].groupPoints).toBe(0);
  });

  it('aggregates persisted individual and group points per team for the selected division', () => {
    const results = [
      makeResult('senior-solo', 'Senior', 'SOLO', [
        makeRank(senior, 1, 11),
        makeRank(general, 2, 8)
      ]),
      makeResult('senior-group', 'Senior', 'GROUP', [
        makeRank(senior, 3, 16)
      ])
    ];

    const standings = buildDivisionTeamStandings([senior, general], results, 'SENIOR');

    expect(standings[0]).toMatchObject({
      id: senior.id,
      totalPoints: 27,
      soloPoints: 11,
      groupPoints: 16,
      firstCount: 0,
      thirdCount: 1,
      pointsComplete: true
    });
    expect(standings[1]).toMatchObject({
      id: general.id,
      totalPoints: 8,
      soloPoints: 8,
      groupPoints: 0,
      secondCount: 1
    });
  });

  it('reads the persisted legacy points alias when officialPoints is absent', () => {
    expect(getPublishedOfficialPoints({
      officialPoints: undefined as unknown as number,
      totalEarnedPoints: 9
    })).toBe(9);
  });

  it('flags missing point records instead of synthesizing 10, 5, or 3 points from rank', () => {
    const results = [
      makeResult('senior-missing', 'Senior', 'SOLO', [
        makeRank(senior, 1, undefined),
        makeRank(general, 2, undefined)
      ])
    ];

    const standings = buildDivisionTeamStandings([senior, general], results, 'SENIOR');

    expect(standings).toHaveLength(2);
    expect(standings.every(team => !team.pointsComplete)).toBe(true);
    expect(standings.map(team => team.totalPoints)).toEqual([0, 0]);
    expect(standings.map(team => team.missingPointEntries)).toEqual([1, 1]);
  });

  it('ignores result rows with ambiguous team-code-only identity', () => {
    const duplicateCodeTeam = makeTeam('team-duplicate', senior.code);
    const result = makeResult('senior-ambiguous', 'Senior', 'SOLO', [{
      ...makeRank(senior, 1, 11),
      teamId: '',
      teamCode: senior.code
    }]);

    expect(buildDivisionTeamStandings([senior, duplicateCodeTeam], [result], 'SENIOR')).toEqual([]);
  });
});
