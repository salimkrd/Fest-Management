import type { ResultRank } from '@/types/fest';

export interface RegistrationIdentityRecord {
  id: string;
  competitionId: string;
  status?: string;
  participantId?: string;
  groupLeaderId?: string;
  groupMembers?: string[];
  chestNumber?: string;
  participantName?: string;
  teamId?: string;
  teamCode?: string;
  teamName?: string;
}

export interface ResultRankRecovery {
  ranks: ResultRank[];
  remappedRegistrations: Array<{ fromRegistrationId: string; toRegistrationId: string }>;
  duplicateRowsRemoved: number;
}

function normalize(value: unknown): string {
  return String(value ?? '').trim().toLocaleLowerCase().replace(/\\s+/g, ' ');
}

function isApproved(record: RegistrationIdentityRecord): boolean {
  return normalize(record.status) === 'approved';
}

function identityMatches(
  source: RegistrationIdentityRecord | undefined,
  target: RegistrationIdentityRecord,
  rank: ResultRank
): boolean {
  if (source) {
    if (source.teamId && target.teamId && source.teamId !== target.teamId) return false;

    if (source.groupLeaderId || target.groupLeaderId) {
      return Boolean(source.groupLeaderId && target.groupLeaderId &&
        source.groupLeaderId === target.groupLeaderId);
    }

    if (source.participantId || target.participantId) {
      return Boolean(source.participantId && target.participantId &&
        source.participantId === target.participantId);
    }

    const sourceMembers = Array.isArray(source.groupMembers)
      ? [...source.groupMembers].filter(Boolean).sort()
      : [];
    const targetMembers = Array.isArray(target.groupMembers)
      ? [...target.groupMembers].filter(Boolean).sort()
      : [];
    if (sourceMembers.length || targetMembers.length) {
      return sourceMembers.length > 0 &&
        sourceMembers.length === targetMembers.length &&
        sourceMembers.every((id, index) => id === targetMembers[index]);
    }
  }

  // Legacy/deleted registration recovery is permitted only on a strong
  // three-part identity match: team, chest number and contestant/troupe name.
  return Boolean(
    rank.teamId &&
    target.teamId === rank.teamId &&
    normalize(rank.bib) &&
    normalize(target.chestNumber) === normalize(rank.bib) &&
    normalize(target.participantName) === normalize(rank.candidateName)
  );
}

function sameRankOutcome(left: ResultRank, right: ResultRank): boolean {
  return left.score === right.score &&
    left.rank === right.rank &&
    left.teamId === right.teamId;
}

/**
 * Reconciles stale result rows created against a duplicate competition or
 * duplicate registration. A row is remapped only to one unambiguous APPROVED
 * registration in the intended competition. Conflicting duplicates fail closed.
 */
export function recoverResultRankIntegrity(params: {
  competitionId: string;
  ranks: ResultRank[];
  sourceRegistrations: Array<RegistrationIdentityRecord | undefined>;
  targetRegistrations: RegistrationIdentityRecord[];
  duplicateCompetitionIds: ReadonlySet<string>;
}): ResultRankRecovery {
  const remappedRegistrations: ResultRankRecovery['remappedRegistrations'] = [];
  const recovered: ResultRank[] = [];

  params.ranks.forEach((rank, index) => {
    const source = params.sourceRegistrations[index];
    const sourceIsValid = Boolean(
      source &&
      source.competitionId === params.competitionId &&
      isApproved(source)
    );

    let target: RegistrationIdentityRecord | undefined;
    if (sourceIsValid) {
      target = source;
    } else {
      const mayRecoverAcrossCompetition = Boolean(
        source &&
        source.competitionId !== params.competitionId &&
        params.duplicateCompetitionIds.has(source.competitionId)
      );
      const candidates = params.targetRegistrations.filter(candidate =>
        isApproved(candidate) &&
        candidate.competitionId === params.competitionId &&
        identityMatches(source, candidate, rank)
      );

      // A foreign registration can only be reconciled when its source
      // competition has already been verified as an exact duplicate.
      if (source && source.competitionId !== params.competitionId && !mayRecoverAcrossCompetition) {
        throw new Error(
          `Validation Error: Registration "${source.id}" belongs to a different competition and the source competition is not an exact duplicate. No result data was changed.`
        );
      }

      if (candidates.length !== 1) {
        if (candidates.length > 1) {
          throw new Error(
            `Validation Error: Duplicate registration "${rank.registrationId}" matches multiple approved entries in this competition. Resolve the registration records before confirming results.`
          );
        }
        const state = source ? String(source.status || 'UNKNOWN').toUpperCase() : 'MISSING';
        throw new Error(
          `Validation Error: Registration "${rank.registrationId}" is ${state} or belongs to another competition. No unique approved replacement was found for "${rank.candidateName}" (${rank.bib}). No result data was changed.`
        );
      }
      target = candidates[0];
      remappedRegistrations.push({
        fromRegistrationId: rank.registrationId,
        toRegistrationId: target.id
      });
    }

    recovered.push({
      ...rank,
      registrationId: target.id,
      bib: target.chestNumber || rank.bib,
      candidateName: target.participantName || rank.candidateName,
      teamId: target.teamId || rank.teamId,
      teamCode: target.teamCode || rank.teamCode,
      teamName: target.teamName || rank.teamName
    });
  });

  const byRegistration = new Map<string, ResultRank>();
  let duplicateRowsRemoved = 0;
  for (const rank of recovered) {
    const existing = byRegistration.get(rank.registrationId);
    if (!existing) {
      byRegistration.set(rank.registrationId, rank);
      continue;
    }
    if (!sameRankOutcome(existing, rank)) {
      throw new Error(
        `Validation Error: Registration "${rank.registrationId}" has conflicting duplicate result rows (different marks, grade or position). No result data was changed.`
      );
    }
    duplicateRowsRemoved += 1;
  }

  return {
    ranks: Array.from(byRegistration.values()),
    remappedRegistrations,
    duplicateRowsRemoved
  };
}
