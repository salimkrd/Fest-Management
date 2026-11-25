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

export interface GreenRoomAssignmentIdentityRecord {
  id?: string;
  competitionId: string;
  registrationId: string;
  participantName?: string;
  participantNameSnapshot?: string;
  teamId?: string;
  teamCode?: string;
  teamName?: string;
  chestNumber?: string;
  codeLetter?: string;
}

export interface ResultRankRecovery {
  ranks: ResultRank[];
  remappedRegistrations: Array<{ fromRegistrationId: string; toRegistrationId: string }>;
  recoveredFromGreenRoomAssignments: Array<{
    registrationId: string;
    codeLetter: string;
    candidateName: string;
    bib: string;
  }>;
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

function assignmentMatchesRank(
  assignment: GreenRoomAssignmentIdentityRecord,
  competitionId: string,
  rank: ResultRank
): boolean {
  const snapshotName = assignment.participantNameSnapshot || assignment.participantName || '';
  const codeLetter = String(assignment.codeLetter || '').trim().toUpperCase();
  return assignment.competitionId === competitionId &&
    assignment.registrationId === rank.registrationId &&
    Boolean(codeLetter && /^[A-Z]{1,2}$/.test(codeLetter)) &&
    Boolean(rank.teamId && assignment.teamId && normalize(assignment.teamId) === normalize(rank.teamId)) &&
    Boolean(rank.bib && assignment.chestNumber && normalize(assignment.chestNumber) === normalize(rank.bib)) &&
    Boolean(rank.candidateName && snapshotName && normalize(snapshotName) === normalize(rank.candidateName)) &&
    (!rank.teamCode || !assignment.teamCode || normalize(assignment.teamCode) === normalize(rank.teamCode)) &&
    (!rank.teamName || !assignment.teamName || normalize(assignment.teamName) === normalize(rank.teamName));
}

function sameRankOutcome(left: ResultRank, right: ResultRank): boolean {
  return left.score === right.score &&
    left.rank === right.rank &&
    left.bib === right.bib &&
    left.candidateName === right.candidateName &&
    left.teamId === right.teamId &&
    left.teamCode === right.teamCode &&
    left.teamName === right.teamName;
}

/**
 * Reconciles stale result rows created against a duplicate competition or
 * duplicate registration. Deleted/non-approved registrations can be retained
 * only when an exact, same-competition Green Room assignment snapshot proves
 * the contestant's identity and Code Letter.
 */
export function recoverResultRankIntegrity(params: {
  competitionId: string;
  ranks: ResultRank[];
  sourceRegistrations: Array<RegistrationIdentityRecord | undefined>;
  targetRegistrations: RegistrationIdentityRecord[];
  duplicateCompetitionIds: ReadonlySet<string>;
  greenRoomAssignments?: GreenRoomAssignmentIdentityRecord[];
}): ResultRankRecovery {
  const remappedRegistrations: ResultRankRecovery['remappedRegistrations'] = [];
  const recoveredFromGreenRoomAssignments: ResultRankRecovery['recoveredFromGreenRoomAssignments'] = [];
  const recovered: ResultRank[] = [];
  const assignments = params.greenRoomAssignments || [];

  params.ranks.forEach((rank, index) => {
    const source = params.sourceRegistrations[index];
    let target: RegistrationIdentityRecord | undefined;
    let assignmentRecovery: GreenRoomAssignmentIdentityRecord | undefined;

    if (source && source.competitionId === params.competitionId && isApproved(source)) {
      target = source;
    } else {
      const sameRegistrationAssignments = assignments.filter(assignment =>
        assignment.competitionId === params.competitionId &&
        assignment.registrationId === rank.registrationId
      );
      if (sameRegistrationAssignments.length > 1) {
        throw new Error(
          `Validation Error: Multiple Green Room Code Letter records point to registration "${rank.registrationId}". Resolve the duplicate roster records before confirming results.`
        );
      }
      const archivedAssignment = sameRegistrationAssignments[0];
      const archivedAssignmentMatches = Boolean(
        archivedAssignment && assignmentMatchesRank(archivedAssignment, params.competitionId, rank)
      );

      const mayRecoverAcrossCompetition = Boolean(
        source &&
        source.competitionId !== params.competitionId &&
        params.duplicateCompetitionIds.has(source.competitionId)
      );
      const sourceIsForeignAndNotDuplicate = Boolean(
        source &&
        source.competitionId !== params.competitionId &&
        !mayRecoverAcrossCompetition
      );

      if (sourceIsForeignAndNotDuplicate) {
        if (!archivedAssignmentMatches || !archivedAssignment) {
          throw new Error(
            `Validation Error: Registration "${source!.id}" belongs to a different competition and the source competition is not an exact duplicate. No matching same-competition Green Room Code Letter snapshot was found. No result data was changed.`
          );
        }
        assignmentRecovery = archivedAssignment;
      } else {
        const candidates = params.targetRegistrations.filter(candidate =>
          isApproved(candidate) &&
          candidate.competitionId === params.competitionId &&
          identityMatches(source, candidate, rank)
        );

        if (candidates.length === 1) {
          target = candidates[0];
          if (target) {
            remappedRegistrations.push({
              fromRegistrationId: rank.registrationId,
              toRegistrationId: target.id
            });
          }
        } else if (archivedAssignmentMatches && archivedAssignment) {
          // Registration was deleted or is no longer approved after the
          // contestant received a Code Letter. Keep the original registration
          // ID referenced by immutable judge scorecards and result rows.
          assignmentRecovery = archivedAssignment;
        } else if (candidates.length > 1) {
          throw new Error(
            `Validation Error: Duplicate registration "${rank.registrationId}" matches multiple approved entries in this competition, and no unique Green Room snapshot can resolve it. Resolve the registration records before confirming results.`
          );
        } else {
          const state = source ? String(source.status || 'UNKNOWN').toUpperCase() : 'MISSING';
          throw new Error(
            `Validation Error: Registration "${rank.registrationId}" is ${state} or belongs to another competition. No unique approved replacement or matching same-competition Green Room Code Letter snapshot was found for "${rank.candidateName}" (${rank.bib}). No result data was changed.`
          );
        }
      }
    }

    if (assignmentRecovery) {
      const assignmentName = assignmentRecovery.participantNameSnapshot ||
        assignmentRecovery.participantName ||
        rank.candidateName;
      const codeLetter = String(assignmentRecovery.codeLetter || '').trim().toUpperCase();
      recovered.push({
        ...rank,
        // Preserve the ID that judge scorecards used. Do not fabricate a new
        // registration document or silently attach marks to another entrant.
        registrationId: rank.registrationId,
        bib: assignmentRecovery.chestNumber || rank.bib,
        candidateName: assignmentName,
        teamId: assignmentRecovery.teamId || rank.teamId,
        teamCode: assignmentRecovery.teamCode || rank.teamCode,
        teamName: assignmentRecovery.teamName || rank.teamName,
        codeLetter
      });
      recoveredFromGreenRoomAssignments.push({
        registrationId: rank.registrationId,
        codeLetter,
        candidateName: assignmentName,
        bib: assignmentRecovery.chestNumber || rank.bib
      });
      return;
    }

    if (!target) {
      throw new Error(
        `Validation Error: No approved registration could be resolved for "${rank.registrationId}". No result data was changed.`
      );
    }

    const matchingAssignment = assignments.find(assignment =>
      assignmentMatchesRank(assignment, params.competitionId, rank)
    );
    recovered.push({
      ...rank,
      registrationId: target.id,
      bib: target.chestNumber || rank.bib,
      candidateName: target.participantName || rank.candidateName,
      teamId: target.teamId || rank.teamId,
      teamCode: target.teamCode || rank.teamCode,
      teamName: target.teamName || rank.teamName,
      ...(matchingAssignment?.codeLetter ? {
        codeLetter: String(matchingAssignment.codeLetter).trim().toUpperCase()
      } : {})
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
        `Validation Error: Registration "${rank.registrationId}" has conflicting duplicate result rows (different marks, identity or position). No result data was changed.`
      );
    }
    duplicateRowsRemoved += 1;
  }

  return {
    ranks: Array.from(byRegistration.values()),
    remappedRegistrations,
    recoveredFromGreenRoomAssignments,
    duplicateRowsRemoved
  };
}
