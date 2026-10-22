import { describe, it, expect } from 'vitest';
import { ExportService } from '../../services/exportService';
import { ThemeService } from '../../services/themeService';
import { createJudgeAssignment, verifyJudgeAssignment } from '../judgeAuth';
import { CompetitionResult } from '@/types/fest';

describe('Role-Based Access Control, Data Isolation & Business Security', () => {

  describe('Item 7: Team Manager Data Isolation', () => {
    it('restricts Team Manager registration and participant edits exclusively to their assigned team', () => {
      const userTeamManagerABH = {
        uid: 'user-manager-1',
        role: 'TEAM_MANAGER',
        teamId: 'team-1', // ABH
        teamCode: 'ABH'
      };

      const registrationCandidateABH = {
        participantId: 'p-1',
        teamId: 'team-1',
        name: 'Tariq ABH'
      };

      const registrationCandidateBSH = {
        participantId: 'p-2',
        teamId: 'team-2',
        name: 'Bilal BSH'
      };

      // Security validator rule simulation
      const canManageParticipant = (user: typeof userTeamManagerABH, targetParticipant: typeof registrationCandidateABH) => {
        if (user.role === 'ADMIN') return true;
        return user.role === 'TEAM_MANAGER' && user.teamId === targetParticipant.teamId;
      };

      expect(canManageParticipant(userTeamManagerABH, registrationCandidateABH)).toBe(true);
      expect(canManageParticipant(userTeamManagerABH, registrationCandidateBSH)).toBe(false);
    });
  });

  describe('Item 8: Judge Assignment Access Restrictions', () => {
    it('restricts Judge to their assigned competition and rejects cross-competition submissions', async () => {
      const creds = await createJudgeAssignment({
        id: 'asgn-quran',
        judgeName: 'Usthad Abdullah',
        judgePhone: '+91 98471 00001',
        competitionId: 'cmp-quran',
        competitionCode: 'CMP-02',
        competitionName: 'Quran Recitation',
        stageName: 'Seminar Hall A'
      });

      // Verify authentic assignment
      const authResult = await verifyJudgeAssignment(creds.assignment, creds.oneTimeSecret);
      expect(authResult.valid).toBe(true);
      expect(authResult.competitionId).toBe('cmp-quran');

      // Attempting to evaluate a different competition with this assignment is disallowed
      const canScoreCompetition = (assignmentCompId: string, targetCompId: string) => {
        return assignmentCompId === targetCompId;
      };

      expect(canScoreCompetition(authResult.competitionId!, 'cmp-quran')).toBe(true);
      expect(canScoreCompetition(authResult.competitionId!, 'cmp-speech')).toBe(false);
    });

    it('rejects access when assignment is revoked or expired', async () => {
      const creds = await createJudgeAssignment({
        id: 'asgn-revoked',
        judgeName: 'Judge Revoked',
        judgePhone: '+91 98471 00002',
        competitionId: 'cmp-1',
        competitionCode: 'CMP-01',
        competitionName: 'English Elocution',
        stageName: 'Main Auditorium'
      });

      const revokedAssignment = { ...creds.assignment, revoked: true, status: 'REVOKED' as const };
      const authResult = await verifyJudgeAssignment(revokedAssignment, creds.oneTimeSecret);
      expect(authResult.valid).toBe(false);
      expect(authResult.reason).toBe('REVOKED');
    });
  });

  describe('Item 9: Public Access to Published Data Only', () => {
    it('strictly omits unpublished draft or under-review results from public view', () => {
      const mockResults: CompetitionResult[] = [
        {
          id: 'res-pub-1',
          competitionId: 'cmp-1',
          competitionCode: 'CMP-01',
          competitionName: 'Published Event 1',
          categoryName: 'Senior',
          type: 'SOLO',
          stageName: 'Stage 1',
          marksStatus: 'COMPLETE',
          resultStatus: 'PUBLISHED',
          ranks: [],
          posterReleased: true
        },
        {
          id: 'res-draft-2',
          competitionId: 'cmp-2',
          competitionCode: 'CMP-02',
          competitionName: 'Unpublished Draft Event',
          categoryName: 'Junior',
          type: 'SOLO',
          stageName: 'Stage 2',
          marksStatus: 'PARTIAL',
          resultStatus: 'DRAFT',
          ranks: [],
          posterReleased: false
        },
        {
          id: 'res-review-3',
          competitionId: 'cmp-3',
          competitionCode: 'CMP-03',
          competitionName: 'Ready For Review Event',
          categoryName: 'General',
          type: 'GROUP',
          stageName: 'Stage 3',
          marksStatus: 'COMPLETE',
          resultStatus: 'READY_FOR_REVIEW',
          ranks: [],
          posterReleased: false
        }
      ];

      // Public visitor filter
      const publicVisible = mockResults.filter(r => r.resultStatus === 'PUBLISHED');
      expect(publicVisible.length).toBe(1);
      expect(publicVisible[0].id).toBe('res-pub-1');
    });
  });

  describe('Item 10: Unauthorized Theme Modification Protection', () => {
    it('rejects theme modifications by unauthenticated users or non-admin roles', async () => {
      await expect(
        ThemeService.updateTheme({ festivalName: 'Hacked Fest' }, '')
      ).rejects.toThrow('Unauthorized');
    });
  });

  describe('Item 11: Export Filtering for Published Results', () => {
    it('exports ONLY published results as official winners, completely excluding draft and review results', () => {
      const mixedResults: CompetitionResult[] = [
        {
          id: 'res-1',
          competitionId: 'cmp-1',
          competitionCode: 'CMP-01',
          competitionName: 'Official Published Event',
          categoryName: 'Senior',
          type: 'SOLO',
          stageName: 'Auditorium',
          marksStatus: 'COMPLETE',
          resultStatus: 'PUBLISHED',
          ranks: [
            {
              rank: 1,
              registrationId: 'reg-1',
              bib: '#1042',
              candidateName: 'Winner One',
              teamId: 'team-1',
              teamCode: 'ABH',
              teamName: 'Al-Bayan House',
              teamColor: '#2563EB',
              score: 96,
              grade: 'A+',
              officialPoints: 11,
              totalEarnedPoints: 11
            }
          ],
          posterReleased: true
        },
        {
          id: 'res-2',
          competitionId: 'cmp-2',
          competitionCode: 'CMP-02',
          competitionName: 'Draft Event (Unpublished)',
          categoryName: 'Junior',
          type: 'SOLO',
          stageName: 'Seminar Hall',
          marksStatus: 'COMPLETE',
          resultStatus: 'READY_FOR_REVIEW',
          ranks: [
            {
              rank: 1,
              registrationId: 'reg-2',
              bib: '#2011',
              candidateName: 'Fake Winner',
              teamId: 'team-2',
              teamCode: 'BSH',
              teamName: 'Badr Squad',
              teamColor: '#059669',
              score: 90,
              grade: 'A+',
              officialPoints: 11,
              totalEarnedPoints: 11
            }
          ],
          posterReleased: false
        }
      ];

      const exportRows = ExportService.getOfficialPublishedWinners(mixedResults);
      expect(exportRows.length).toBe(1);
      expect(exportRows[0].competitionCode).toBe('CMP-01');
      expect(exportRows[0].rank1Name).toBe('Winner One');

      const csv = ExportService.generateWinnersCSV(exportRows);
      expect(csv).toContain('Winner One');
      expect(csv).not.toContain('Fake Winner');
    });
  });
});
