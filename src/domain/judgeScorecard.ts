import { buildGreenRoomRosterSnapshot, GreenRoomRosterDocument } from '@/domain/greenRoomRoster';
import { codeLetterToIndex, isValidCodeLetter } from '@/domain/greenRoom';

export interface AdminJudgeScorecardCriterion {
  id: string;
  name: string;
  maxMarks: number;
}

export interface AdminJudgeScorecardRow {
  codeLetter: string;
  codeIndex: number;
  criterionMarks: Record<string, number | null>;
  totalMarks: number | null;
}

export interface AdminJudgeScorecard {
  assignmentId: string;
  competitionId: string;
  judgeName: string;
  competitionName: string;
  competitionCode: string;
  assignmentStatus: string;
  markStatus: 'NOT_STARTED' | 'DRAFT' | 'SUBMITTED' | 'NO_SCORECARD';
  submittedAt?: string;
  criteria: AdminJudgeScorecardCriterion[];
  maximumMarks: number;
  rows: AdminJudgeScorecardRow[];
}

type UnknownRecord = Record<string, unknown>;

function asRecord(value: unknown): UnknownRecord {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? value as UnknownRecord
    : {};
}

function resolveCriteria(competition: UnknownRecord): AdminJudgeScorecardCriterion[] {
  const raw = Array.isArray(competition.criteria) ? competition.criteria : [];
  return raw.map((item, index) => {
    const criterion = asRecord(item);
    const id = String(criterion.id || 'criterion-' + (index + 1)).trim();
    const name = String(criterion.name || 'Criterion ' + (index + 1)).trim();
    const maxMarks = Number(criterion.maxMarks);
    if (!id || !Number.isFinite(maxMarks) || maxMarks < 0) {
      throw new Error('Scorecard Data Error: The competition rubric contains an invalid criterion.');
    }
    return { id, name, maxMarks };
  });
}

function archivedCodeMap(markData: UnknownRecord): Array<{
  registrationId: string;
  codeLetter: string;
  codeIndex: number;
}> {
  const mapping = markData.codeRegistrationSnapshot;
  const anonymousRoster = markData.anonymousRoster;
  if (!Array.isArray(mapping) || !Array.isArray(anonymousRoster) || mapping.length !== anonymousRoster.length) {
    throw new Error(
      'Unverified Mapping Error: This submitted scorecard does not contain a complete archived Code Letter mapping. Marks are hidden to prevent showing them under the wrong contestant code.'
    );
  }

  const rosterByCode = new Map<string, number>();
  for (const item of anonymousRoster) {
    const record = asRecord(item);
    const codeLetter = String(record.codeLetter || '').trim().toUpperCase();
    const codeIndex = Number(record.codeIndex);
    if (!isValidCodeLetter(codeLetter) || codeLetterToIndex(codeLetter) !== codeIndex || rosterByCode.has(codeLetter)) {
      throw new Error('Unverified Mapping Error: The archived anonymous roster is invalid or contains duplicate Code Letters.');
    }
    rosterByCode.set(codeLetter, codeIndex);
  }

  const registrationIds = new Set<string>();
  const codeLetters = new Set<string>();
  const resolved = mapping.map(item => {
    const record = asRecord(item);
    const registrationId = String(record.registrationId || '').trim();
    const codeLetter = String(record.codeLetter || '').trim().toUpperCase();
    const codeIndex = Number(record.codeIndex);
    if (
      !registrationId ||
      !isValidCodeLetter(codeLetter) ||
      codeLetterToIndex(codeLetter) !== codeIndex ||
      registrationIds.has(registrationId) ||
      codeLetters.has(codeLetter) ||
      rosterByCode.get(codeLetter) !== codeIndex
    ) {
      throw new Error('Unverified Mapping Error: The archived Code Letter-to-registration mapping is inconsistent.');
    }
    registrationIds.add(registrationId);
    codeLetters.add(codeLetter);
    return { registrationId, codeLetter, codeIndex };
  });

  if (rosterByCode.size !== codeLetters.size) {
    throw new Error('Unverified Mapping Error: The archived roster and registration mapping do not contain the same Code Letters.');
  }

  return resolved.sort((a, b) => a.codeIndex - b.codeIndex);
}

function draftCodeMap(
  markData: UnknownRecord,
  competitionId: string,
  greenRoomDocuments: GreenRoomRosterDocument[]
): Array<{ registrationId: string; codeLetter: string; codeIndex: number }> {
  const version = String(markData.rosterVersion || '');
  if (!/^[a-f0-9]{64}$/.test(version)) {
    throw new Error('Unverified Mapping Error: This draft has no valid Green Room roster version. Its Code Letter mapping cannot be safely verified.');
  }

  let roster: ReturnType<typeof buildGreenRoomRosterSnapshot>;
  try {
    roster = buildGreenRoomRosterSnapshot(competitionId, greenRoomDocuments);
  } catch (error: unknown) {
    const detail = error instanceof Error ? error.message : 'The live roster is invalid.';
    throw new Error('Unverified Mapping Error: The current Green Room Code Letter map could not be verified. ' + detail);
  }
  if (roster.version !== version) {
    throw new Error('Unverified Mapping Error: The Green Room roster changed after this draft was saved. Refreshing or reconciling the draft is required before Code Letter marks can be displayed.');
  }

  return roster.entries.map(entry => ({
    registrationId: entry.registrationId,
    codeLetter: entry.codeLetter,
    codeIndex: entry.codeIndex
  }));
}

/**
 * Builds an Admin-only, read-only scorecard view. Registration IDs and participant
 * identities are used only to resolve the verified anonymous Code Letter mapping;
 * neither is returned to the caller.
 */
export function buildAdminJudgeScorecard(params: {
  assignment: UnknownRecord;
  markData?: UnknownRecord | null;
  competition: UnknownRecord;
  greenRoomDocuments?: GreenRoomRosterDocument[];
}): AdminJudgeScorecard {
  const assignment = params.assignment;
  const competition = params.competition;
  const assignmentId = String(assignment.id || '').trim();
  const competitionId = String(assignment.competitionId || '').trim();
  if (!assignmentId || !competitionId || String(competition.id || '').trim() !== competitionId) {
    throw new Error('Scorecard Data Error: The judge assignment and competition do not match.');
  }

  const criteria = resolveCriteria(competition);
  const markData = params.markData ? asRecord(params.markData) : null;
  const rawScoresForScale = asRecord(markData?.scores);
  const containsVerifiedHundredPointTotals =
    typeof markData?.rosterVersion === 'string' &&
    Object.values(rawScoresForScale).some(value => typeof value === 'number');
  const declaredMax = Number(competition.maxMarks);
  const maximumMarks = containsVerifiedHundredPointTotals
    ? 100
    : Number.isFinite(declaredMax) && declaredMax > 0
      ? declaredMax
      : criteria.reduce((total, criterion) => total + criterion.maxMarks, 0) || 100;
  const base: AdminJudgeScorecard = {
    assignmentId,
    competitionId,
    judgeName: String(assignment.judgeName || ''),
    competitionName: String(competition.name || assignment.competitionName || ''),
    competitionCode: String(competition.code || assignment.competitionCode || ''),
    assignmentStatus: String(assignment.status || 'NOT_STARTED').toUpperCase(),
    markStatus: 'NOT_STARTED',
    ...(typeof markData?.submittedAt === 'string' ? { submittedAt: markData.submittedAt } : {}),
    criteria,
    maximumMarks,
    rows: []
  };

  if (!markData) {
    base.markStatus = base.assignmentStatus === 'NOT_STARTED' ? 'NOT_STARTED' : 'NO_SCORECARD';
    return base;
  }

  const markStatus = String(markData.status || '').trim().toUpperCase();
  if (markStatus !== 'DRAFT' && markStatus !== 'SUBMITTED') {
    throw new Error('Scorecard Data Error: The stored judge scorecard has an unsupported status.');
  }
  if (String(markData.assignmentId || assignmentId) !== assignmentId ||
      String(markData.competitionId || '') !== competitionId) {
    throw new Error('Scorecard Data Error: The scorecard does not belong to this judge assignment and competition.');
  }

  const codes = markStatus === 'SUBMITTED'
    ? archivedCodeMap(markData)
    : draftCodeMap(markData, competitionId, params.greenRoomDocuments || []);

  const rawScores = asRecord(markData.scores);
  const scoreKeys = Object.keys(rawScores);
  const codeByRegistration = new Map(codes.map(item => [item.registrationId, item]));
  if (scoreKeys.some(key => !codeByRegistration.has(key))) {
    throw new Error('Unverified Mapping Error: One or more saved marks do not resolve to this scorecard’s verified Code Letter roster.');
  }

  const criterionLookup = new Map<string, AdminJudgeScorecardCriterion>();
  criteria.forEach(criterion => {
    criterionLookup.set(criterion.id.trim().toLowerCase(), criterion);
    criterionLookup.set(criterion.name.trim().toLowerCase(), criterion);
  });

  const rows = codes.map(code => {
    const value = rawScores[code.registrationId];
    const criterionMarks: Record<string, number | null> = {};
    let totalMarks: number | null = null;

    if (typeof value === 'number') {
      if (!Number.isFinite(value) || value < 0) {
        throw new Error('Scorecard Data Error: Code ' + code.codeLetter + ' contains an invalid total mark.');
      }
      totalMarks = value;
    } else if (value && typeof value === 'object' && !Array.isArray(value)) {
      let total = 0;
      for (const [rawCriterion, rawMark] of Object.entries(value as UnknownRecord)) {
        const criterion = criterionLookup.get(rawCriterion.trim().toLowerCase());
        const mark = Number(rawMark);
        if (!criterion || !Number.isFinite(mark) || mark < 0 || mark > criterion.maxMarks) {
          throw new Error('Scorecard Data Error: Code ' + code.codeLetter + ' contains an invalid or unknown criterion mark.');
        }
        if (criterionMarks[criterion.id] !== undefined) {
          throw new Error('Scorecard Data Error: Code ' + code.codeLetter + ' contains duplicate marks for ' + criterion.name + '.');
        }
        criterionMarks[criterion.id] = mark;
        total += mark;
      }
      criteria.forEach(criterion => {
        if (criterionMarks[criterion.id] === undefined) criterionMarks[criterion.id] = null;
      });
      totalMarks = Object.keys(value).length > 0 ? total : null;
    } else if (value !== undefined && value !== null) {
      throw new Error('Scorecard Data Error: Code ' + code.codeLetter + ' contains an unsupported score format.');
    } else {
      criteria.forEach(criterion => { criterionMarks[criterion.id] = null; });
    }

    return {
      codeLetter: code.codeLetter,
      codeIndex: code.codeIndex,
      criterionMarks,
      totalMarks
    };
  });

  return {
    ...base,
    markStatus,
    ...(typeof markData.submittedAt === 'string' ? { submittedAt: markData.submittedAt } : {}),
    rows
  };
}
