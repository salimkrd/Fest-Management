import type { Competition, CompetitionResult, Participant, Registration, CompetitionPerformanceMode } from '@/types/fest';

export interface TopScorerRow {
  participantId: string;
  name: string;
  bib: string;
  teamName: string;
  teamCode: string;
  categoryName: string;
  totalMarks: number;
  averagePercentage: number;
  competitionsCount: number;
  position: number;
}

/**
 * Individual-only award ranking, kept entirely separate from the team championship
 * points ledger. Each published solo score is normalized to /100 so that competitions
 * with different total marks remain comparable. Only explicitly classified events
 * qualify for these awards. Tied totals share the same position.
 */
export function calculateTopScorers(
  mode: CompetitionPerformanceMode,
  competitions: Competition[],
  results: CompetitionResult[],
  registrations: Registration[],
  participants: Participant[]
): TopScorerRow[] {
  const events = new Map(competitions.map(event => [event.id, event]));
  const entries = new Map(registrations.map(entry => [entry.id, entry]));
  const people = new Map(participants.map(participant => [participant.id, participant]));
  const totals = new Map<string, Omit<TopScorerRow, 'position'>>();
  const counted = new Set<string>();

  for (const result of results) {
    const competition = events.get(result.competitionId);
    if (result.resultStatus !== 'PUBLISHED' ||
        result.type !== 'SOLO' ||
        !competition ||
        competition.type !== 'SOLO' ||
        competition.performanceMode !== mode) continue;

    const configuredMaximum = competition.criteria?.reduce(
      (sum, criterion) => sum + Math.max(0, Number(criterion.maxMarks) || 0), 0
    ) || 0;
    const maxMarks = configuredMaximum > 0 ? configuredMaximum : 100;

    for (const rank of result.ranks) {
      const entry = entries.get(rank.registrationId);
      if (!entry || entry.type !== 'SOLO' || entry.status !== 'APPROVED' ||
          entry.competitionId !== competition.id || !entry.participantId) continue;
      const participant = people.get(entry.participantId);
      if (!participant || participant.teamId !== entry.teamId ||
          !Number.isFinite(rank.score) || rank.score < 0 || rank.score > maxMarks) continue;
      const id = result.id + ':' + entry.id;
      if (counted.has(id)) continue;
      counted.add(id);

      const previous = totals.get(participant.id);
      const normalizedScore = (rank.score / maxMarks) * 100;
      totals.set(participant.id, {
        participantId: participant.id,
        name: participant.name,
        bib: participant.bib,
        teamName: participant.teamName,
        teamCode: participant.teamCode,
        categoryName: participant.categoryName,
        totalMarks: (previous?.totalMarks || 0) + normalizedScore,
        averagePercentage: 0,
        competitionsCount: (previous?.competitionsCount || 0) + 1
      });
    }
  }

  const ordered = Array.from(totals.values()).map(row => ({
    ...row,
    totalMarks: Math.round(row.totalMarks * 100) / 100,
    averagePercentage: Math.round((row.totalMarks / row.competitionsCount) * 100) / 100
  })).sort((a, b) => b.totalMarks - a.totalMarks || a.name.localeCompare(b.name));

  let position = 1;
  return ordered.map((row, index) => {
    if (index > 0 && row.totalMarks !== ordered[index - 1].totalMarks) {
      position = index + 1;
    }
    return { ...row, position };
  });
}
