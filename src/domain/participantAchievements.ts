import type { CompetitionResult, Participant, Registration } from '@/types/fest';

export interface ParticipantAchievementEvent {
  resultId: string;
  competitionName: string;
  competitionCode: string;
  categoryName: string;
  rank: 1 | 2 | 3;
  type: 'SOLO' | 'GROUP';
}

export interface ParticipantAchievement {
  participant: Participant;
  firstCount: number;
  secondCount: number;
  thirdCount: number;
  totalAwards: number;
  events: ParticipantAchievementEvent[];
}

function normalizeBib(value: string | undefined): string {
  return (value || '').trim().replace(/^#/, '').toUpperCase();
}

function normalizeName(value: string | undefined): string {
  return (value || '').trim().replace(/\s*&\s*team$/i, '').replace(/\s+/g, ' ').toLocaleLowerCase();
}

function belongsToRankedTeam(participant: Participant, rank: CompetitionResult['ranks'][number]): boolean {
  if (rank.teamId && participant.teamId) return participant.teamId === rank.teamId;
  if (rank.teamCode && participant.teamCode) {
    return participant.teamCode.trim().toUpperCase() === rank.teamCode.trim().toUpperCase();
  }
  return true;
}

/**
 * Derives medal counts solely from published results. New group registrations
 * store the group leader only; legacy group member IDs are credited when present.
 */
export function buildParticipantAchievements(
  participants: Participant[],
  registrations: Registration[],
  results: CompetitionResult[]
): ParticipantAchievement[] {
  const entries = new Map<string, ParticipantAchievement>();
  const participantById = new Map(participants.map(participant => [participant.id, participant]));
  const registrationById = new Map(registrations.map(registration => [registration.id, registration]));
  const countedAwards = new Set<string>();

  participants.forEach(participant => entries.set(participant.id, {
    participant, firstCount: 0, secondCount: 0, thirdCount: 0, totalAwards: 0, events: []
  }));

  const resolveRecipients = (
    rank: CompetitionResult['ranks'][number],
    registration: Registration | undefined
  ): string[] => {
    if (registration) {
      const linkedIds = Array.from(new Set([
        registration.participantId,
        registration.groupLeaderId,
        ...(registration.type === 'GROUP' && Array.isArray(registration.groupMembers) ? registration.groupMembers : [])
      ].filter((id): id is string => typeof id === 'string' && id.length > 0)));
      const validIds = linkedIds.filter(id => {
        const participant = participantById.get(id);
        return participant !== undefined && belongsToRankedTeam(participant, rank);
      });
      if (validIds.length > 0) return validIds;
    }

    const expectedBib = normalizeBib(rank.bib);
    const byBib = participants.filter(participant =>
      expectedBib !== '' && normalizeBib(participant.bib) === expectedBib && belongsToRankedTeam(participant, rank)
    );
    if (byBib.length === 1) return [byBib[0].id];
    if (byBib.length > 1) {
      const name = normalizeName(rank.candidateName);
      const exact = byBib.filter(participant => normalizeName(participant.name) === name);
      if (exact.length === 1) return [exact[0].id];
    }

    // Group bibs are registration-specific; use an exact same-team name only.
    const name = normalizeName(rank.candidateName);
    if (!name) return [];
    const byName = participants.filter(participant =>
      normalizeName(participant.name) === name && belongsToRankedTeam(participant, rank)
    );
    return byName.length === 1 ? [byName[0].id] : [];
  };

  results.forEach(result => {
    if (result.resultStatus !== 'PUBLISHED') return;
    result.ranks.forEach(rank => {
      const position = rank.rank;
      if (position !== 1 && position !== 2 && position !== 3) return;
      const recipients = resolveRecipients(rank, registrationById.get(rank.registrationId));
      recipients.forEach(participantId => {
        const entry = entries.get(participantId);
        if (!entry) return;
        const key = [result.id, rank.registrationId, position, participantId].join(':');
        if (countedAwards.has(key)) return;
        countedAwards.add(key);

        if (position === 1) entry.firstCount += 1;
        if (position === 2) entry.secondCount += 1;
        if (position === 3) entry.thirdCount += 1;
        entry.totalAwards += 1;
        entry.events.push({
          resultId: result.id,
          competitionName: result.competitionName,
          competitionCode: result.competitionCode,
          categoryName: result.categoryName,
          rank: position,
          type: result.type
        });
      });
    });
  });

  return Array.from(entries.values());
}
