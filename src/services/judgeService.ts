/**
 * Judge Service
 * Manages judge assignments, cryptographic password verification, and session token generation.
 */

import { createHash, randomUUID } from 'crypto';
import { getAdminDb } from '@/lib/firebase/admin';
import {
  createJudgeAssignment,
  verifyJudgeAssignment,
  JudgeAssignmentRecord,
  GeneratedCredentials,
  VerificationResult
} from '@/domain/judgeAuth';
import { AuthService } from './authService';
import { calculateGrade, getChampionshipPoints } from '@/domain/scoring';
import {
  buildGreenRoomRosterSnapshot,
  assertGreenRoomEntryMatchesRegistration,
  GreenRoomRosterEntry
} from '@/domain/greenRoomRoster';

export class JudgeService {
  /**
   * Admin operation: Issues a new assignment for a judge.
   * Stores ONLY the salt and SHA-256 hash in Firestore. Never stores plaintext secret.
   */
  static async issueAssignment(params: {
    judgeName: string;
    judgePhone: string;
    competitionId: string;
    competitionCode: string;
    competitionName: string;
    categoryName?: string;
    type?: 'SOLO' | 'GROUP';
    stageName: string;
    durationHours?: number;
    baseUrl?: string;
    adminIdToken: string;
  }): Promise<GeneratedCredentials> {
    if (!params.adminIdToken || typeof params.adminIdToken !== 'string') {
      throw new Error('Unauthorized: Admin ID token is required to issue judge assignments.');
    }
    await AuthService.assertAdmin(params.adminIdToken);

    const db = getAdminDb();
    const docId = `asgn-${randomUUID()}`;

    const creds = await createJudgeAssignment({
      id: docId,
      judgeName: params.judgeName,
      judgePhone: params.judgePhone,
      competitionId: params.competitionId,
      competitionCode: params.competitionCode,
      competitionName: params.competitionName,
      categoryName: params.categoryName,
      type: params.type,
      stageName: params.stageName,
      durationHours: params.durationHours,
      baseUrl: params.baseUrl
    });

    if (db) {
      await db.collection('judgeAssignments').doc(docId).set(creds.assignment);
    }

    return creds;
  }

  /**
   * Server-side authentication: Verifies a judge's access code and one-time secret.
   */
  static async authenticateJudge(accessCode: string, secret: string): Promise<VerificationResult> {
    const db = getAdminDb();
    if (!db) {
      return { valid: false, reason: 'NOT_FOUND' };
    }

    const snap = await db.collection('judgeAssignments')
      .where('accessCode', '==', accessCode.trim().toUpperCase())
      .limit(1)
      .get();

    if (snap.empty) {
      return { valid: false, reason: 'NOT_FOUND' };
    }

    const assignment = snap.docs[0].data() as JudgeAssignmentRecord;
    return verifyJudgeAssignment(assignment, secret);
  }

  /**
   * Validates that all score keys belong to actual registered participants for this competition,
   * and that all criteria scores adhere to the competition-specific judging rubric and maxMarks limits.
   */
  /**
   * Validates that all score keys belong to actual eligible registered participants for this competition,
   * detects ambiguous aliases, ensures each eligible registration is scored at most once,
   * and enforces competition-specific judging rubric and maxMarks limits.
   */
  private static async validateScoresPayload(
    db: FirebaseFirestore.Firestore,
    competitionId: string,
    scores: Record<string, Record<string, number> | number>,
    expectedRosterVersion: string
  ): Promise<{
    resolvedRegistrations: Map<string, string>;
    rosterEntries: GreenRoomRosterEntry[];
    rosterVersion: string;
  }> {
    if (!scores || typeof scores !== 'object' || Array.isArray(scores) || Object.keys(scores).length === 0) {
      throw new Error('Validation Error: At least one participant score must be provided.');
    }
    if (!/^[a-f0-9]{64}$/.test(expectedRosterVersion || '')) {
      throw new Error('Stale Mapping Error: The judging screen has no valid Green Room roster version. Refresh the judge session.');
    }

    const [compDoc, regsSnap, grSnap] = await Promise.all([
      db.collection('competitions').doc(competitionId).get(),
      db.collection('registrations').where('competitionId', '==', competitionId).get(),
      db.collection('greenRoomAssignments').where('competitionId', '==', competitionId).get()
    ]);

    if (!compDoc.exists) {
      throw new Error(`Validation Error: Competition "${competitionId}" no longer exists.`);
    }
    if (regsSnap.empty) {
      throw new Error(`Validation Error: Competition "${competitionId}" has zero registrations. Scoring cannot proceed.`);
    }
    const compData = compDoc.data() || {};
    const criteriaList = (compData.criteria as Array<{ id: string; name: string; maxMarks: number }>) || [];
    const compMaxMarks = Number(compData.maxMarks) ||
      (criteriaList.length > 0 ? criteriaList.reduce((acc, criterion) => acc + (criterion.maxMarks || 0), 0) : 100);

    const approvedRegistrationIds = new Set(
      regsSnap.docs
        .filter(doc => String(doc.data().status || '').trim().toUpperCase() === 'APPROVED')
        .map(doc => doc.id)
    );

    const ineligibleKeys = new Map<string, string>();
    const directContestantIdentifiers = new Set<string>();
    regsSnap.docs.forEach(doc => {
      const data = doc.data();
      const regId = doc.id.trim();
      directContestantIdentifiers.add(regId);
      if (data.participantId) directContestantIdentifiers.add(String(data.participantId).trim());
      if (data.bib) {
        directContestantIdentifiers.add(String(data.bib).trim());
        directContestantIdentifiers.add(String(data.bib).trim().toUpperCase());
      }
      if (data.chestNumber) {
        directContestantIdentifiers.add(String(data.chestNumber).trim());
        directContestantIdentifiers.add(String(data.chestNumber).trim().toUpperCase());
      }
      if (data.code) {
        directContestantIdentifiers.add(String(data.code).trim());
        directContestantIdentifiers.add(String(data.code).trim().toUpperCase());
      }
      if (!approvedRegistrationIds.has(doc.id)) {
        const rawStatus = data.status;
        const displayStatus = typeof rawStatus === 'string' && rawStatus.trim()
          ? rawStatus.trim().toUpperCase()
          : rawStatus === null ? 'NULL' : rawStatus === undefined ? 'MISSING' : 'EMPTY';
        const reason = `ineligible registration (status: ${displayStatus})`;
        ineligibleKeys.set(doc.id, reason);
        if (data.participantId) ineligibleKeys.set(String(data.participantId), reason);
        if (data.bib) ineligibleKeys.set(String(data.bib), reason);
        if (data.chestNumber) ineligibleKeys.set(String(data.chestNumber), reason);
        if (data.code) ineligibleKeys.set(String(data.code), reason);
      }
    });

    const normalizedScoreKeys = new Map<string, string>();
    for (const scoreKey of Object.keys(scores)) {
      const cleanKey = scoreKey.trim();
      const cleanUpperKey = cleanKey.toUpperCase();
      if (ineligibleKeys.has(scoreKey) || ineligibleKeys.has(cleanKey)) {
        throw new Error(
          `Validation Error: Participant or registration "${scoreKey}" is an ${ineligibleKeys.get(scoreKey) || ineligibleKeys.get(cleanKey)}. Only APPROVED registrations can be scored.`
        );
      }
      if (directContestantIdentifiers.has(cleanKey) || directContestantIdentifiers.has(cleanUpperKey)) {
        throw new Error(
          `Validation Error: Identifier "${scoreKey}" is a direct contestant identifier (participant ID, registration ID, bib, or chest number) and is strictly rejected. It is not a valid assigned Green Room Code Letter. Judges must submit scores using ONLY assigned Green Room Code Letters.`
        );
      }
      if (!cleanUpperKey) {
        throw new Error('Validation Error: Empty Code Letter score keys are not allowed.');
      }
      if (normalizedScoreKeys.has(cleanUpperKey)) {
        throw new Error(
          `Validation Error: Duplicate Code Letter key "${cleanUpperKey}" was supplied more than once.`
        );
      }
      normalizedScoreKeys.set(cleanUpperKey, scoreKey);
    }

    if (approvedRegistrationIds.size === 0) {
      throw new Error(
        `Validation Error: Competition "${competitionId}" has zero eligible approved registrations. Scoring cannot proceed.`
      );
    }
    if (grSnap.empty) {
      throw new Error(
        `Validation Error: No contestants have checked in to the Green Room for competition "${competitionId}". No Code Letter is assigned to an eligible registration, so scoring cannot proceed.`
      );
    }

    // Validate the entire Code Letter <-> registration roster before resolving
    // any mark. Duplicate, stale, malformed, or ineligible assignments block
    // the complete scorecard rather than allowing a partial mapping.
    const roster = buildGreenRoomRosterSnapshot(
      competitionId,
      grSnap.docs.map(doc => ({ id: doc.id, data: doc.data() as Record<string, unknown> }))
    );
    if (roster.version !== expectedRosterVersion) {
      throw new Error(
        'Stale Mapping Error: The Green Room Code Letter roster changed after this judge opened the scorecard. No marks were saved. Refresh the roster and verify every Code Letter again.'
      );
    }
    const registrationById = new Map(
      regsSnap.docs.map(doc => [doc.id, { ...doc.data(), id: doc.id } as Record<string, unknown>])
    );
    for (const entry of roster.entries) {
      if (!approvedRegistrationIds.has(entry.registrationId)) {
        throw new Error(
          `Roster Integrity Error: Code Letter "${entry.codeLetter}" points to a registration that is not currently approved. Judging has been blocked.`
        );
      }
      const liveRegistration = registrationById.get(entry.registrationId);
      if (!liveRegistration) {
        throw new Error('Roster Integrity Error: A Code Letter has no live registration identity record.');
      }
      assertGreenRoomEntryMatchesRegistration(entry, liveRegistration);
    }

    // The submitted scorecard must cover the exact roster shown to the judge.
    // Missing or unexpected codes are never silently omitted from a final mark set.
    const missingCodes = roster.entries
      .map(entry => entry.codeLetter)
      .filter(codeLetter => !normalizedScoreKeys.has(codeLetter));
    const unexpectedCodes = Array.from(normalizedScoreKeys.keys())
      .filter(codeLetter => !roster.codeToRegistration.has(codeLetter));
    if (unexpectedCodes.length > 0) {
      throw new Error(
        `Validation Error: Code Letter "${unexpectedCodes[0]}" is not a valid assigned Green Room Code Letter in the current roster.`
      );
    }
    if (missingCodes.length > 0 || normalizedScoreKeys.size !== roster.entries.length) {
      throw new Error(
        `Validation Error: Marks are required for every checked-in Code Letter. Missing: ${missingCodes.join(', ') || 'roster count mismatch'}.`
      );
    }

    const scoredRegistrationIds = new Set<string>();
    const resolvedRegistrations = new Map<string, string>();

    for (const [cleanUpperKey, originalScoreKey] of normalizedScoreKeys.entries()) {
      const resolvedRegId = roster.codeToRegistration.get(cleanUpperKey);
      if (!resolvedRegId) {
        throw new Error(
          `Validation Error: Code Letter "${cleanUpperKey}" is not a valid assigned Green Room code for competition "${competitionId}".`
        );
      }
      if (!approvedRegistrationIds.has(resolvedRegId)) {
        throw new Error(
          `Validation Error: Code Letter "${cleanUpperKey}" is not assigned to an approved registration.`
        );
      }
      if (scoredRegistrationIds.has(resolvedRegId)) {
        throw new Error(
          `Validation Error: More than one Code Letter resolves to the same registration for "${originalScoreKey}".`
        );
      }
      scoredRegistrationIds.add(resolvedRegId);
      resolvedRegistrations.set(originalScoreKey, resolvedRegId);

      const scoreVal = scores[originalScoreKey];
      if (typeof scoreVal === 'number') {
        if (!Number.isInteger(scoreVal) || scoreVal < 0 || scoreVal > 100) {
          throw new Error(
            `Validation Error: Total mark for Code Letter "${cleanUpperKey}" (${scoreVal}) must be a whole number from 0 to 100.`
          );
        }
      } else if (typeof scoreVal === 'object' && scoreVal !== null && !Array.isArray(scoreVal)) {
        // Backward compatibility for scorecards created by the previous criterion-wise UI.
        const critEntries = Object.entries(scoreVal);
        if (critEntries.length === 0) {
          throw new Error(`Validation Error: Criteria marks for Code Letter "${cleanUpperKey}" cannot be empty.`);
        }

        let participantTotal = 0;
        const seenCriterionIds = new Set<string>();
        for (const [critKey, critMark] of critEntries) {
          if (typeof critMark !== 'number' || !Number.isFinite(critMark) || critMark < 0) {
            throw new Error(`Validation Error: Criterion "${critKey}" score for Code "${cleanUpperKey}" must be a non-negative number.`);
          }
          if (criteriaList.length > 0) {
            const rubricCriterion = criteriaList.find(
              criterion => criterion.id === critKey || criterion.name.toLowerCase() === critKey.toLowerCase()
            );
            if (!rubricCriterion) {
              throw new Error(`Validation Error: Criterion "${critKey}" is not part of the competition rubric.`);
            }
            seenCriterionIds.add(rubricCriterion.id);
            if (critMark > rubricCriterion.maxMarks) {
              throw new Error(
                `Validation Error: Criterion "${critKey}" score (${critMark}) exceeds its maximum of ${rubricCriterion.maxMarks}.`
              );
            }
          } else if (critMark > 100) {
            throw new Error(`Validation Error: Criterion "${critKey}" must be between 0 and 100.`);
          }
          participantTotal += critMark;
        }

        if (criteriaList.length > 0) {
          const missingCriteria = criteriaList.filter(criterion => !seenCriterionIds.has(criterion.id));
          if (missingCriteria.length > 0) {
            throw new Error(
              `Validation Error: Code "${cleanUpperKey}" is missing criterion marks: ${missingCriteria.map(criterion => criterion.name || criterion.id).join(', ')}.`
            );
          }
        }
        if (participantTotal > compMaxMarks) {
          throw new Error(
            `Validation Error: Criteria total for Code "${cleanUpperKey}" exceeds the competition maximum.`
          );
        }
      } else {
        throw new Error(
          `Validation Error: Invalid score format for Code Letter "${cleanUpperKey}".`
        );
      }
    }

    return {
      resolvedRegistrations,
      rosterEntries: roster.entries,
      rosterVersion: roster.version
    };
  }

  /**
   * Judge operation: Saves draft scores for registered participants in the assigned competition.
   * Enforces assignment scope, active status, unexpired window, and rubric validation.
   */
  static async saveDraftMarks(params: {
    assignmentId: string;
    competitionId: string;
    secret: string;
    rosterVersion: string;
    scores: Record<string, Record<string, number> | number>;
    remarks?: string;
  }): Promise<{
    success: boolean;
    markEntryId: string;
    updatedAt: string;
  }> {
    const db = getAdminDb();
    if (!db) {
      throw new Error('Database Unavailable: Cannot save draft marks.');
    }

    const docSnap = await db.collection('judgeAssignments').doc(params.assignmentId).get();
    if (!docSnap.exists) {
      throw new Error('Unauthorized: Judge assignment not found.');
    }

    const assignment = docSnap.data() as JudgeAssignmentRecord;

    if (assignment.competitionId !== params.competitionId) {
      throw new Error(
        `Unauthorized: Scope violation. Judge assignment is bound to competition "${assignment.competitionId}", cannot save marks for "${params.competitionId}".`
      );
    }

    if (assignment.revoked || assignment.status === 'REVOKED') {
      throw new Error('Unauthorized: Assignment has been revoked.');
    }

    if (assignment.status === 'SUBMITTED') {
      throw new Error('Unauthorized: Scorecard has already been finalized and submitted. Marks are immutable.');
    }

    if (assignment.expiresAt && new Date(assignment.expiresAt) < new Date()) {
      throw new Error('Unauthorized: Assignment has expired.');
    }

    const authResult = await verifyJudgeAssignment(assignment, params.secret);
    if (!authResult.valid) {
      throw new Error(`Unauthorized: Judge authentication failed (${authResult.reason}).`);
    }

    const { resolvedRegistrations, rosterVersion } = await this.validateScoresPayload(
      db,
      params.competitionId,
      params.scores,
      params.rosterVersion
    );
    const normalizedScores = Object.fromEntries(
      Object.entries(params.scores).map(([key, value]) => [resolvedRegistrations.get(key) || key, value])
    );

    const updatedAt = new Date().toISOString();
    const markEntryId = `me-${params.assignmentId}`;
    const lockRef = db.collection('competitionMarkingLocks').doc(params.competitionId);
    const markEntryRef = db.collection('markEntries').doc(markEntryId);
    const assignRef = db.collection('judgeAssignments').doc(params.assignmentId);
    const assignmentQuery = db.collection('greenRoomAssignments')
      .where('competitionId', '==', params.competitionId);
    const registrationQuery = db.collection('registrations')
      .where('competitionId', '==', params.competitionId);

    await db.runTransaction(async (transaction) => {
      const lockDoc = await transaction.get(lockRef);
      const currentAssignment = await transaction.get(assignRef);
      const currentRosterSnapshot = await transaction.get(assignmentQuery);
      const currentRegistrationsSnapshot = await transaction.get(registrationQuery);
      if (!currentAssignment.exists) {
        throw new Error('Unauthorized: Judge assignment not found.');
      }
      const currentAssignmentData = currentAssignment.data()!;
      if (
        currentAssignmentData.revoked ||
        currentAssignmentData.status === 'REVOKED' ||
        currentAssignmentData.competitionId !== params.competitionId
      ) {
        throw new Error('Unauthorized: Judge assignment has been revoked or its competition scope changed.');
      }
      if (currentAssignmentData.status === 'SUBMITTED') {
        throw new Error('Unauthorized: Scorecard has already been finalized and submitted. Marks are immutable.');
      }
      if (lockDoc.exists && lockDoc.data()?.reassignmentInProgress) {
        throw new Error('Lock Conflict: Code Letter reassignment is currently in progress for this competition. Please retry.');
      }

      const currentRoster = buildGreenRoomRosterSnapshot(
        params.competitionId,
        currentRosterSnapshot.docs.map(doc => ({ id: doc.id, data: doc.data() as Record<string, unknown> }))
      );
      if (currentRoster.version !== rosterVersion) {
        throw new Error(
          'Stale Mapping Error: The Green Room roster changed while marks were being saved. No marks were saved; refresh the judge session.'
        );
      }
      const approvedIds = new Set(
        currentRegistrationsSnapshot.docs
          .filter(doc => String(doc.data().status || '').trim().toUpperCase() === 'APPROVED')
          .map(doc => doc.id)
      );
      const currentRegistrationById = new Map(
        currentRegistrationsSnapshot.docs.map(doc => [doc.id, { ...doc.data(), id: doc.id } as Record<string, unknown>])
      );
      for (const entry of currentRoster.entries) {
        if (!approvedIds.has(entry.registrationId)) {
          throw new Error(
            `Roster Integrity Error: Code Letter "${entry.codeLetter}" no longer points to an approved registration. No marks were saved.`
          );
        }
        const liveRegistration = currentRegistrationById.get(entry.registrationId);
        if (!liveRegistration) {
          throw new Error('Roster Integrity Error: A Code Letter has no live registration identity record. No marks were saved.');
        }
        assertGreenRoomEntryMatchesRegistration(entry, liveRegistration);
      }

      transaction.set(lockRef, {
        competitionId: params.competitionId,
        locked: true,
        markingStarted: true,
        draftActive: true,
        lastDraftAt: updatedAt,
        lastMarkedBy: assignment.judgeName || params.assignmentId,
        updatedAt
      }, { merge: true });

      transaction.set(markEntryRef, {
        id: markEntryId,
        assignmentId: params.assignmentId,
        competitionId: params.competitionId,
        competitionName: assignment.competitionName || '',
        judgeName: assignment.judgeName || '',
        status: 'DRAFT',
        submitted: false,
        isFinal: false,
        scores: normalizedScores,
        rosterVersion,
        remarks: params.remarks || '',
        updatedAt
      });

      // Keep the Admin Mark Entry roster in step with judge draft saves.
      // The Admin UI subscribes to judgeAssignments, so update its status
      // atomically with the scorecard write.
      transaction.update(assignRef, {
        status: 'IN_PROGRESS',
        lastDraftAt: updatedAt
      });
    });

    return {
      success: true,
      markEntryId,
      updatedAt
    };
  }

  private static async updateResultForCompetition(
    db: FirebaseFirestore.Firestore,
    competitionId: string
  ): Promise<void> {
    const [competitionSnapshot, assignmentSnapshot, registrationSnapshot, greenRoomSnapshot] = await Promise.all([
      db.collection('competitions').doc(competitionId).get(),
      db.collection('judgeAssignments').where('competitionId', '==', competitionId).get(),
      db.collection('registrations').where('competitionId', '==', competitionId).get(),
      db.collection('greenRoomAssignments').where('competitionId', '==', competitionId).get()
    ]);

    if (!competitionSnapshot.exists) return;
    const competition = competitionSnapshot.data()!;
    const assignments = assignmentSnapshot.docs.filter(doc => {
      const data = doc.data();
      return !data.revoked && data.status !== 'REVOKED' && data.status !== 'EXPIRED';
    });
    if (assignments.length === 0 || assignments.some(doc => doc.data().status !== 'SUBMITTED')) return;

    const submittedMarks = await Promise.all(assignments.map(async assignment => {
      const markSnapshot = await db.collection('markEntries').doc(`me-${assignment.id}`).get();
      return markSnapshot.exists ? markSnapshot.data() : null;
    }));
    if (submittedMarks.some(mark => !mark || mark.status !== 'SUBMITTED')) return;

    // Defense in depth: before generating official ranks, verify that every
    // archived judge scorecard still belongs to this competition's canonical
    // Green Room roster. New scorecards must match the exact session fingerprint
    // and full roster; legacy scorecards may be partial, but every scored
    // registration must still be present in the canonical roster.
    const finalRoster = buildGreenRoomRosterSnapshot(
      competitionId,
      greenRoomSnapshot.docs.map(doc => ({ id: doc.id, data: doc.data() as Record<string, unknown> }))
    );
    const approvedRegistrationIds = new Set(
      registrationSnapshot.docs
        .filter(doc => String(doc.data().status || '').trim().toUpperCase() === 'APPROVED')
        .map(doc => doc.id)
    );
    const finalRegistrationById = new Map(
      registrationSnapshot.docs.map(doc => [doc.id, { ...doc.data(), id: doc.id } as Record<string, unknown>])
    );
    for (const entry of finalRoster.entries) {
      if (!approvedRegistrationIds.has(entry.registrationId)) {
        throw new Error(
          `Roster Integrity Error: Final result generation blocked because Code Letter "${entry.codeLetter}" no longer points to an approved registration.`
        );
      }
      const liveRegistration = finalRegistrationById.get(entry.registrationId);
      if (!liveRegistration) {
        throw new Error('Roster Integrity Error: Final result generation blocked because a Code Letter has no live registration identity record.');
      }
      assertGreenRoomEntryMatchesRegistration(entry, liveRegistration);
    }
    const expectedRegistrationIds = finalRoster.entries
      .map(entry => entry.registrationId)
      .sort();
    for (const mark of submittedMarks) {
      const markData = mark as Record<string, unknown>;
      const scoreMap = markData.scores && typeof markData.scores === 'object'
        ? markData.scores as Record<string, unknown>
        : {};
      const submittedRegistrationIds = Object.keys(scoreMap).sort();
      if (submittedRegistrationIds.some(id => !finalRoster.registrationToCode.has(id))) {
        throw new Error(
          'Roster Integrity Error: Final result generation blocked because a submitted score points to a registration outside the current Green Room roster.'
        );
      }

      if (typeof markData.rosterVersion === 'string') {
        if (markData.rosterVersion !== finalRoster.version) {
          throw new Error(
            'Stale Mapping Error: Final result generation blocked because a judge scorecard was recorded against a different Green Room roster version.'
          );
        }
        if (JSON.stringify(submittedRegistrationIds) !== JSON.stringify(expectedRegistrationIds)) {
          throw new Error(
            'Roster Integrity Error: Final result generation blocked because a new-format judge scorecard does not cover the exact Green Room roster.'
          );
        }

        const archivedRoster = Array.isArray(markData.anonymousRoster)
          ? markData.anonymousRoster
              .filter((item): item is Record<string, unknown> => Boolean(item && typeof item === 'object'))
              .map(item => ({
                codeLetter: String(item.codeLetter || '').trim().toUpperCase(),
                codeIndex: Number(item.codeIndex)
              }))
              .sort((a, b) => a.codeIndex - b.codeIndex)
          : [];
        const currentAnonymousRoster = finalRoster.entries.map(({ codeLetter, codeIndex }) => ({ codeLetter, codeIndex }));
        if (JSON.stringify(archivedRoster) !== JSON.stringify(currentAnonymousRoster)) {
          throw new Error(
            'Roster Integrity Error: Final result generation blocked because the archived anonymous roster does not match the official Green Room mapping.'
          );
        }

        const archivedMapping = Array.isArray(markData.codeRegistrationSnapshot)
          ? markData.codeRegistrationSnapshot
              .filter((item): item is Record<string, unknown> => Boolean(item && typeof item === 'object'))
              .map(item => ({
                registrationId: String(item.registrationId || ''),
                codeLetter: String(item.codeLetter || '').trim().toUpperCase(),
                codeIndex: Number(item.codeIndex)
              }))
              .sort((a, b) => a.codeIndex - b.codeIndex)
          : [];
        const currentMapping = finalRoster.entries.map(({ registrationId, codeLetter, codeIndex }) => ({
          registrationId,
          codeLetter,
          codeIndex
        }));
        if (JSON.stringify(archivedMapping) !== JSON.stringify(currentMapping)) {
          throw new Error(
            'Roster Integrity Error: Final result generation blocked because the archived Code Letter-to-registration mapping does not match the official Green Room mapping.'
          );
        }
      }
    }

    const criteria = Array.isArray(competition.criteria) ? competition.criteria : [];
    const maxMarks = Number(competition.maxMarks) ||
      (criteria.length
        ? criteria.reduce((total: number, criterion: { maxMarks?: number }) => total + Number(criterion.maxMarks || 0), 0)
        : 100);
    if (maxMarks <= 0) {
      throw new Error(`Validation Error: Competition "${competitionId}" has an invalid maximum mark value.`);
    }

    // Keep each judge's submitted scorecard immutable in markEntries. The published
    // candidate score is calculated by averaging each rubric criterion across all
    // submitted judges, then summing those criterion averages.
    const criterionDefinitions = criteria as Array<{ id: string; name?: string; maxMarks?: number }>;
    const criterionLookup = new Map<string, string>();
    criterionDefinitions.forEach(criterion => {
      criterionLookup.set(String(criterion.id).trim().toLowerCase(), criterion.id);
      if (criterion.name) criterionLookup.set(criterion.name.trim().toLowerCase(), criterion.id);
    });

    const criterionMarksByRegistration = new Map<string, Map<string, number[]>>();
    const criterionScorecardTotalsByRegistration = new Map<string, number[]>();
    const legacyTotalsByRegistration = new Map<string, number[]>();

    submittedMarks.forEach(mark => {
      const markData = mark as Record<string, unknown>;
      const scorecard = markData.scores as Record<string, Record<string, number> | number>;
      const hasVerifiedHundredPointSnapshot = typeof markData.rosterVersion === 'string';
      Object.entries(scorecard).forEach(([registrationId, value]) => {
        if (typeof value === 'number') {
          if (!Number.isFinite(value) || value < 0 || value > (hasVerifiedHundredPointSnapshot ? 100 : maxMarks)) {
            throw new Error(
              `Validation Error: Stored total mark for registration "${registrationId}" is outside the allowed competition range.`
            );
          }
          const totals = legacyTotalsByRegistration.get(registrationId) || [];
          // The new roster-version scorecards are explicitly out of 100.
          // Older numeric scorecards used the competition's historical maximum.
          totals.push(hasVerifiedHundredPointSnapshot ? value : Number(((value / maxMarks) * 100).toFixed(2)));
          legacyTotalsByRegistration.set(registrationId, totals);
          return;
        }

        const byCriterion = criterionMarksByRegistration.get(registrationId) || new Map<string, number[]>();
        let scorecardTotal = 0;
        Object.entries(value).forEach(([criterionKey, rawScore]) => {
          const criterionId = criterionLookup.get(criterionKey.trim().toLowerCase());
          if (!criterionId) {
            throw new Error(`Validation Error: Unknown criterion "${criterionKey}" found in a submitted scorecard for registration "${registrationId}".`);
          }
          const markValue = Number(rawScore);
          if (!Number.isFinite(markValue)) {
            throw new Error(`Validation Error: Invalid mark for criterion "${criterionKey}" in scorecard for registration "${registrationId}".`);
          }
          scorecardTotal += markValue;
          const values = byCriterion.get(criterionId) || [];
          values.push(markValue);
          byCriterion.set(criterionId, values);
        });
        criterionMarksByRegistration.set(registrationId, byCriterion);

        const scorecardTotals = criterionScorecardTotalsByRegistration.get(registrationId) || [];
        // Older criterion-wise judge scorecards are converted to the new /100 scale.
        scorecardTotals.push(Number(((scorecardTotal / maxMarks) * 100).toFixed(2)));
        criterionScorecardTotalsByRegistration.set(registrationId, scorecardTotals);
      });
    });

    const registrations = registrationSnapshot.docs.filter(doc =>
      String(doc.data().status || '').trim().toUpperCase() === 'APPROVED'
    );
    const evaluated = registrations.flatMap(doc => {
      const criterionMap = criterionMarksByRegistration.get(doc.id);
      const criterionScorecardTotals = criterionScorecardTotalsByRegistration.get(doc.id) || [];
      const legacyTotals = legacyTotalsByRegistration.get(doc.id) || [];

      let score: number;
      if (legacyTotals.length > 0 && criterionScorecardTotals.length > 0) {
        // New total-mark scorecards can coexist with earlier criterion-wise submissions.
        // Averaging each judge's total is equivalent to summing criterion averages for
        // complete rubrics, while keeping older drafts/submissions compatible.
        const allJudgeTotals = [...legacyTotals, ...criterionScorecardTotals];
        score = Number((allJudgeTotals.reduce((sum, value) => sum + value, 0) / allJudgeTotals.length).toFixed(2));
      } else if (criterionMap && criterionMap.size > 0) {
        // Preserve criterion-wise averaging, then normalize the result to marks out of 100.
        const criterionAverages = criterionDefinitions.map(criterion => {
          const marks = criterionMap.get(criterion.id) || [];
          return marks.length ? marks.reduce((sum, mark) => sum + mark, 0) / marks.length : 0;
        });
        const criterionTotal = criterionAverages.reduce((sum, average) => sum + average, 0);
        score = Number(((criterionTotal / maxMarks) * 100).toFixed(2));
      } else {
        if (legacyTotals.length === 0) return [];
        score = Number((legacyTotals.reduce((sum, value) => sum + value, 0) / legacyTotals.length).toFixed(2));
      }

      const registration = doc.data();
      return [{
        registrationId: doc.id,
        bib: registration.chestNumber || '',
        candidateName: registration.participantName || '',
        teamId: registration.teamId || '',
        teamCode: registration.teamCode || '',
        teamName: registration.teamName || '',
        teamColor: '#2563EB',
        score,
        grade: calculateGrade(score, 100)
      }];
    }).sort((a, b) => b.score - a.score);

    let previousScore: number | undefined;
    let previousRank: 1 | 2 | 3 | null = null;
    const ranks = evaluated.map((entry, index) => {
      const rank: 1 | 2 | 3 | null = entry.score === previousScore
        ? previousRank
        : index < 3 ? (index + 1) as 1 | 2 | 3 : null;
      previousScore = entry.score;
      previousRank = rank;
      return {
        ...entry,
        rank,
        officialPoints: getChampionshipPoints(competition.type, entry.grade, rank),
        totalEarnedPoints: getChampionshipPoints(competition.type, entry.grade, rank)
      };
    });

    const resultId = `res-${competitionId}`;
    const resultRef = db.collection('results').doc(resultId);
    const existingResult = await resultRef.get();
    if (existingResult.exists && ['PUBLISHED', 'READY_TO_PUBLISH'].includes(existingResult.data()?.resultStatus)) {
      return;
    }

    await resultRef.set({
      id: resultId,
      competitionId,
      competitionCode: competition.code || '',
      competitionName: competition.name || '',
      categoryName: competition.categoryName || '',
      type: competition.type || 'SOLO',
      stageName: competition.stageName || 'Main Stage',
      marksStatus: 'COMPLETE',
      resultStatus: 'READY_FOR_REVIEW',
      ranks,
      posterReleased: false,
      updatedAt: new Date().toISOString()
    }, { merge: true });
  }

  /**
   * Judge operation: Submits scores for registered participants in the assigned competition.
   * Verifies assignment scope and secret before atomically sealing markEntry with SHA-256 verification hash.
   */
  static async submitMarks(params: {
    assignmentId: string;
    competitionId: string;
    secret: string;
    rosterVersion: string;
    scores: Record<string, Record<string, number> | number>;
  }): Promise<{
    success: boolean;
    marksRecorded: number;
    verificationHash: string;
    submittedAt: string;
    markEntryId: string;
  }> {
    const db = getAdminDb();
    if (!db) {
      throw new Error('Database Unavailable: Cannot submit marks.');
    }

    const docSnap = await db.collection('judgeAssignments').doc(params.assignmentId).get();
    if (!docSnap.exists) {
      throw new Error('Unauthorized: Judge assignment not found.');
    }

    const assignment = docSnap.data() as JudgeAssignmentRecord;

    if (assignment.competitionId !== params.competitionId) {
      throw new Error(
        `Unauthorized: Scope violation. Judge assignment is bound to competition "${assignment.competitionId}", cannot submit marks for "${params.competitionId}".`
      );
    }

    if (assignment.revoked || assignment.status === 'REVOKED') {
      throw new Error('Unauthorized: Assignment has been revoked.');
    }

    if (assignment.status === 'SUBMITTED') {
      throw new Error('Unauthorized: Scorecard has already been finalized and submitted. Marks are immutable.');
    }

    if (assignment.expiresAt && new Date(assignment.expiresAt) < new Date()) {
      throw new Error('Unauthorized: Assignment has expired.');
    }

    const authResult = await verifyJudgeAssignment(assignment, params.secret);
    if (!authResult.valid) {
      throw new Error(`Unauthorized: Judge authentication failed (${authResult.reason}).`);
    }

    const { resolvedRegistrations, rosterEntries, rosterVersion } = await this.validateScoresPayload(
      db,
      params.competitionId,
      params.scores,
      params.rosterVersion
    );
    const normalizedScores = Object.fromEntries(
      Object.entries(params.scores).map(([key, value]) => [resolvedRegistrations.get(key)!, value])
    );

    // Freeze both the anonymous roster and the internal Code Letter-to-registration
    // mapping into the immutable, server-only receipt. Only anonymousRoster is
    // returned to the judge; codeRegistrationSnapshot remains private to Admin SDK.
    const anonymousRoster = rosterEntries.map(({ codeLetter, codeIndex }) => ({ codeLetter, codeIndex }));
    const codeRegistrationSnapshot = rosterEntries.map(({ registrationId, codeLetter, codeIndex }) => ({
      registrationId,
      codeLetter,
      codeIndex
    }));

    const submittedAt = new Date().toISOString();
    const hashPayload = `${params.assignmentId}:${params.competitionId}:${rosterVersion}:${submittedAt}:${JSON.stringify(normalizedScores)}:${JSON.stringify(codeRegistrationSnapshot)}`;
    const verificationHash = 'SHA256:' + createHash('sha256').update(hashPayload).digest('hex');
    const markEntryId = `me-${params.assignmentId}`;

    const lockRef = db.collection('competitionMarkingLocks').doc(params.competitionId);
    const markEntryRef = db.collection('markEntries').doc(markEntryId);
    const assignRef = db.collection('judgeAssignments').doc(params.assignmentId);
    const assignmentQuery = db.collection('greenRoomAssignments')
      .where('competitionId', '==', params.competitionId);
    const registrationQuery = db.collection('registrations')
      .where('competitionId', '==', params.competitionId);

    // Atomically persist the scorecard only if the complete mapping still
    // matches the exact roster the judge saw when the session loaded.
    await db.runTransaction(async (transaction) => {
      const lockDoc = await transaction.get(lockRef);
      const currentRosterSnapshot = await transaction.get(assignmentQuery);
      const currentRegistrationsSnapshot = await transaction.get(registrationQuery);
      if (lockDoc.exists && lockDoc.data()?.reassignmentInProgress) {
        throw new Error('Lock Conflict: Code Letter reassignment is currently in progress for this competition. Please retry.');
      }

      const assignDoc = await transaction.get(assignRef);
      if (!assignDoc.exists || assignDoc.data()?.competitionId !== params.competitionId) {
        throw new Error('Unauthorized: Judge assignment could not be verified for this competition.');
      }
      if (assignDoc.data()?.status === 'SUBMITTED') {
        throw new Error('Unauthorized: Scorecard has already been finalized and submitted. Marks are immutable.');
      }

      const currentRoster = buildGreenRoomRosterSnapshot(
        params.competitionId,
        currentRosterSnapshot.docs.map(doc => ({ id: doc.id, data: doc.data() as Record<string, unknown> }))
      );
      if (currentRoster.version !== rosterVersion) {
        throw new Error(
          'Stale Mapping Error: The Green Room roster changed while the scorecard was being finalized. Nothing was submitted; refresh the judge session.'
        );
      }
      const approvedIds = new Set(
        currentRegistrationsSnapshot.docs
          .filter(doc => String(doc.data().status || '').trim().toUpperCase() === 'APPROVED')
          .map(doc => doc.id)
      );
      const currentRegistrationById = new Map(
        currentRegistrationsSnapshot.docs.map(doc => [doc.id, { ...doc.data(), id: doc.id } as Record<string, unknown>])
      );
      for (const entry of currentRoster.entries) {
        if (!approvedIds.has(entry.registrationId)) {
          throw new Error(
            `Roster Integrity Error: Code Letter "${entry.codeLetter}" no longer points to an approved registration. Submission was blocked.`
          );
        }
        const liveRegistration = currentRegistrationById.get(entry.registrationId);
        if (!liveRegistration) {
          throw new Error('Roster Integrity Error: A Code Letter has no live registration identity record. Submission was blocked.');
        }
        assertGreenRoomEntryMatchesRegistration(entry, liveRegistration);
      }

      transaction.set(lockRef, {
        competitionId: params.competitionId,
        locked: true,
        markingStarted: true,
        finalized: true,
        lastSubmissionAt: submittedAt,
        lastMarkedBy: assignment.judgeName || params.assignmentId,
        updatedAt: submittedAt
      }, { merge: true });

      transaction.set(markEntryRef, {
        id: markEntryId,
        assignmentId: params.assignmentId,
        competitionId: params.competitionId,
        competitionName: assignment.competitionName || '',
        judgeName: assignment.judgeName || '',
        status: 'SUBMITTED',
        submitted: true,
        isFinal: true,
        scores: normalizedScores,
        anonymousRoster,
        codeRegistrationSnapshot,
        rosterVersion,
        submittedAt,
        verificationHash
      });

      transaction.update(assignRef, {
        status: 'SUBMITTED',
        submittedAt,
        verificationHash
      });
    });

    await this.updateResultForCompetition(db, params.competitionId);

    return {
      success: true,
      marksRecorded: Object.keys(normalizedScores).length,
      verificationHash,
      submittedAt,
      markEntryId
    };
  }

  /**
   * Admin operation: Revokes a judge assignment immediately.
   * Cryptographically verifies Admin ID token before permitting revocation.
   */
  static async revokeAssignment(assignmentId: string, adminIdToken: string): Promise<boolean> {
    if (!adminIdToken || typeof adminIdToken !== 'string') {
      throw new Error('Unauthorized: Admin ID token is required to revoke judge assignments.');
    }
    await AuthService.assertAdmin(adminIdToken);

    const db = getAdminDb();
    if (!db) return true;

    await db.collection('judgeAssignments').doc(assignmentId).update({
      revoked: true,
      status: 'REVOKED'
    });

    return true;
  }
}
