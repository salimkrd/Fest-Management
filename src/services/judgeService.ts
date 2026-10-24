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
    scores: Record<string, Record<string, number> | number>
  ): Promise<{ resolvedRegistrations: Map<string, string> }> {
    if (!scores || typeof scores !== 'object' || Object.keys(scores).length === 0) {
      throw new Error('Validation Error: At least one participant score must be provided.');
    }

    // 1. Fetch competition document to inspect specific judging rubric & maxMarks
    const compDoc = await db.collection('competitions').doc(competitionId).get();
    const compData = compDoc.exists ? compDoc.data() : null;
    const criteriaList = (compData?.criteria as Array<{ id: string; name: string; maxMarks: number }>) || [];
    const compMaxMarks = compData?.maxMarks || (criteriaList.length > 0 ? criteriaList.reduce((acc, c) => acc + (c.maxMarks || 0), 0) : 100);

    // 2. Fetch ALL registrations for this competition
    const regsSnap = await db.collection('registrations')
      .where('competitionId', '==', competitionId)
      .get();

    // Invariant 1: Fail closed if the competition has zero registrations in Firestore
    if (regsSnap.empty) {
      throw new Error(
        `Validation Error: Competition "${competitionId}" has zero registrations. Scoring cannot proceed.`
      );
    }

    // Invariant 2 & 3: Filter for ELIGIBLE registrations only (strictly status === 'APPROVED')
    // Fail-closed: missing, null, empty, PENDING, CANCELLED, WITHDRAWN, or REJECTED registrations are strictly ineligible.
    const isExplicitlyApproved = (rawStatus: any): boolean => {
      return typeof rawStatus === 'string' && rawStatus.trim().toUpperCase() === 'APPROVED';
    };

    const eligibleRegs = regsSnap.docs.filter(doc => {
      return isExplicitlyApproved(doc.data().status);
    });

    if (eligibleRegs.length === 0) {
      throw new Error(
        `Validation Error: Competition "${competitionId}" has zero eligible approved registrations. Scoring cannot proceed.`
      );
    }

    // Invariant 4: Detect direct contestant identifiers and map ineligible keys
    const ineligibleKeys = new Map<string, string>(); // key -> ineligible reason
    const directContestantIdentifiers = new Set<string>();
    const eligibleRegIds = new Set<string>(eligibleRegs.map(doc => doc.id));

    // Collect all ineligible keys and direct contestant identifiers
    regsSnap.docs.forEach(doc => {
      const data = doc.data();
      const rawStatus = data.status;
      const regId = doc.id.trim();

      directContestantIdentifiers.add(regId);
      if (data.participantId) directContestantIdentifiers.add(data.participantId.toString().trim());
      if (data.bib) {
        directContestantIdentifiers.add(data.bib.toString().trim());
        directContestantIdentifiers.add(data.bib.toString().trim().toUpperCase());
      }
      if (data.chestNumber) {
        directContestantIdentifiers.add(data.chestNumber.toString().trim());
        directContestantIdentifiers.add(data.chestNumber.toString().trim().toUpperCase());
      }
      if (data.code) {
        directContestantIdentifiers.add(data.code.toString().trim());
        directContestantIdentifiers.add(data.code.toString().trim().toUpperCase());
      }

      if (!isExplicitlyApproved(rawStatus)) {
        const displayStatus = (typeof rawStatus === 'string' && rawStatus.trim() !== '')
          ? rawStatus.trim().toUpperCase()
          : (rawStatus === null ? 'NULL' : rawStatus === undefined ? 'MISSING' : 'EMPTY');
        const reason = `ineligible registration (status: ${displayStatus})`;
        ineligibleKeys.set(doc.id, reason);
        if (data.participantId) ineligibleKeys.set(data.participantId, reason);
        if (data.bib) ineligibleKeys.set(data.bib, reason);
        if (data.chestNumber) ineligibleKeys.set(data.chestNumber, reason);
        if (data.code) ineligibleKeys.set(data.code, reason);
      }
    });

    // Invariant 4B: Prioritize rejecting ineligible registrations and direct contestant identifiers
    for (const [scoreKey] of Object.entries(scores)) {
      if (ineligibleKeys.has(scoreKey)) {
        throw new Error(
          `Validation Error: Participant or registration "${scoreKey}" is an ${ineligibleKeys.get(scoreKey)}. Only APPROVED registrations can be scored.`
        );
      }

      const cleanKey = scoreKey.trim();
      const cleanUpperKey = cleanKey.toUpperCase();
      if (directContestantIdentifiers.has(cleanKey) || directContestantIdentifiers.has(cleanUpperKey)) {
        throw new Error(
          `Validation Error: Identifier "${scoreKey}" is a direct contestant identifier (participant ID, registration ID, bib, or chest number). Direct contestant identifiers are strictly rejected. Judges must submit scores using ONLY assigned Green Room Code Letters (e.g. "A", "B", "C").`
        );
      }
    }

    // Invariant 4C: Query Green Room assignments to map anonymous Code Letters (A..Z, AA..ZZ)
    // Judges are strictly required to score ONLY by actual assigned Code Letters.
    const grSnap = await db.collection('greenRoomAssignments')
      .where('competitionId', '==', competitionId)
      .get();

    if (grSnap.empty) {
      throw new Error(
        `Validation Error: No contestants have checked in to the Green Room for competition "${competitionId}". Scoring cannot proceed until contestants are checked in.`
      );
    }

    const assignedCodeToRegId = new Map<string, string>();
    grSnap.docs.forEach(grDoc => {
      const grData = grDoc.data();
      if (grData.codeLetter && grData.registrationId) {
        const cleanCode = grData.codeLetter.trim().toUpperCase();
        assignedCodeToRegId.set(cleanCode, grData.registrationId);
      }
    });

    // Invariant 5: Verify every score key corresponds to an eligible registration via assigned Code Letter,
    // and no registration is scored multiple times under different aliases.
    const scoredRegistrationIds = new Set<string>();
    const resolvedRegistrations = new Map<string, string>(); // scoreKey -> regId

    for (const [scoreKey, scoreVal] of Object.entries(scores)) {
      const cleanKey = scoreKey.trim();
      const cleanUpperKey = cleanKey.toUpperCase();

      // 3. Verify key is an actual Code Letter assigned in greenRoomAssignments for this competition
      const resolvedRegId = assignedCodeToRegId.get(cleanUpperKey);
      if (!resolvedRegId) {
        throw new Error(
          `Validation Error: Identifier "${scoreKey}" is not a valid assigned Green Room Code Letter (not assigned to an eligible registration) for competition "${competitionId}". Judges must score ONLY actual Code Letters assigned to checked-in contestants.`
        );
      }

      // 4. Verify resolved registration is approved
      if (!eligibleRegIds.has(resolvedRegId)) {
        throw new Error(
          `Validation Error: Contestant with Code Letter "${cleanUpperKey}" is not assigned to an eligible APPROVED registration for competition "${competitionId}".`
        );
      }

      // 5. Check duplicate scoring: ensuring every score key resolves to exactly one distinct eligible registration
      if (scoredRegistrationIds.has(resolvedRegId)) {
        throw new Error(
          `Validation Error: Duplicate score entry detected. Score key "${scoreKey}" resolves to registration "${resolvedRegId}", which has already been scored in this scorecard.`
        );
      }
      scoredRegistrationIds.add(resolvedRegId);
      resolvedRegistrations.set(scoreKey, resolvedRegId);

      // Validate numeric score values and criteria against competition rubric
      if (typeof scoreVal === 'number') {
        if (isNaN(scoreVal) || scoreVal < 0 || scoreVal > compMaxMarks) {
          throw new Error(
            `Validation Error: Score for participant "${scoreKey}" (${scoreVal}) exceeds permitted competition limit [0 to ${compMaxMarks}].`
          );
        }
      } else if (typeof scoreVal === 'object' && scoreVal !== null) {
        const critEntries = Object.entries(scoreVal);
        if (critEntries.length === 0) {
          throw new Error(`Validation Error: Criteria marks for participant "${scoreKey}" cannot be empty.`);
        }

        let participantTotal = 0;
        for (const [critKey, critMark] of critEntries) {
          if (typeof critMark !== 'number' || isNaN(critMark) || critMark < 0) {
            throw new Error(`Validation Error: Criterion "${critKey}" score for participant "${scoreKey}" must be a non-negative number.`);
          }

          // Rubric limit check: cross-reference against specific criterion maxMarks
          if (criteriaList.length > 0) {
            const rubricCriterion = criteriaList.find(
              c => c.id === critKey || c.name.toLowerCase() === critKey.toLowerCase()
            );
            if (rubricCriterion && critMark > rubricCriterion.maxMarks) {
              throw new Error(
                `Validation Error: Criterion "${critKey}" score (${critMark}) for participant "${scoreKey}" exceeds specific rubric limit of ${rubricCriterion.maxMarks}.`
              );
            } else if (!rubricCriterion && critMark > 100) {
              throw new Error(`Validation Error: Criterion "${critKey}" score for participant "${scoreKey}" must be between 0 and 100.`);
            }
          } else {
            if (critMark > 100) {
              throw new Error(`Validation Error: Criterion "${critKey}" score for participant "${scoreKey}" must be between 0 and 100.`);
            }
          }
          participantTotal += critMark;
        }

        if (participantTotal > compMaxMarks) {
          throw new Error(
            `Validation Error: Sum of criteria marks (${participantTotal}) for participant "${scoreKey}" exceeds competition total maximum of ${compMaxMarks}.`
          );
        }
      } else {
        throw new Error(`Validation Error: Invalid score data type for participant "${scoreKey}". Must be numeric or criteria map.`);
      }
    }

    return { resolvedRegistrations };
  }

  /**
   * Judge operation: Saves draft scores for registered participants in the assigned competition.
   * Enforces assignment scope, active status, unexpired window, and rubric validation.
   */
  static async saveDraftMarks(params: {
    assignmentId: string;
    competitionId: string;
    secret: string;
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

    const { resolvedRegistrations } = await this.validateScoresPayload(db, params.competitionId, params.scores);
    const normalizedScores = Object.fromEntries(
      Object.entries(params.scores).map(([key, value]) => [resolvedRegistrations.get(key) || key, value])
    );

    const updatedAt = new Date().toISOString();
    const markEntryId = `me-${params.assignmentId}`;
    const lockRef = db.collection('competitionMarkingLocks').doc(params.competitionId);
    const markEntryRef = db.collection('markEntries').doc(markEntryId);

    await db.runTransaction(async (transaction) => {
      const lockDoc = await transaction.get(lockRef);
      if (lockDoc.exists && lockDoc.data()?.reassignmentInProgress) {
        throw new Error('Lock Conflict: Code Letter reassignment is currently in progress for this competition. Please retry.');
      }

      // Concurrency check: Ensure Code Letter-to-registration mapping has not changed or become stale
      for (const [codeLetterKey, expectedRegId] of resolvedRegistrations.entries()) {
        const cleanCode = codeLetterKey.trim().toUpperCase();
        const asgnRef = db.collection('greenRoomAssignments').doc(`${params.competitionId}_${expectedRegId}`);
        const asgnDoc = await transaction.get(asgnRef);

        if (!asgnDoc.exists) {
          throw new Error(
            `Stale Mapping Error: Contestant registration "${expectedRegId}" is no longer checked in for competition "${params.competitionId}". The contestant roster was updated backstage. Please refresh your contestant roster and re-verify your scores before submitting.`
          );
        }

        const currentCode = (asgnDoc.data()?.codeLetter || '').trim().toUpperCase();
        if (currentCode !== cleanCode) {
          throw new Error(
            `Stale Mapping Error: Code Letter "${cleanCode}" is no longer mapped to registration "${expectedRegId}" (currently mapped to "${currentCode}"). The contestant roster was updated backstage. Please refresh your contestant roster and re-verify your scores before submitting.`
          );
        }
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
        remarks: params.remarks || '',
        updatedAt
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
    const [competitionSnapshot, assignmentSnapshot, registrationSnapshot] = await Promise.all([
      db.collection('competitions').doc(competitionId).get(),
      db.collection('judgeAssignments').where('competitionId', '==', competitionId).get(),
      db.collection('registrations').where('competitionId', '==', competitionId).get()
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

    const criteria = Array.isArray(competition.criteria) ? competition.criteria : [];
    const maxMarks = Number(competition.maxMarks) ||
      (criteria.length
        ? criteria.reduce((total: number, criterion: { maxMarks?: number }) => total + Number(criterion.maxMarks || 0), 0)
        : 100);
    if (maxMarks <= 0) {
      throw new Error(`Validation Error: Competition "${competitionId}" has an invalid maximum mark value.`);
    }

    const totalsByRegistration = new Map<string, number[]>();
    submittedMarks.forEach(mark => {
      Object.entries(mark!.scores as Record<string, Record<string, number> | number>).forEach(([registrationId, value]) => {
        const total = typeof value === 'number'
          ? value
          : Object.values(value).reduce((sum, score) => sum + score, 0);
        const totals = totalsByRegistration.get(registrationId) || [];
        totals.push(total);
        totalsByRegistration.set(registrationId, totals);
      });
    });

    const registrations = registrationSnapshot.docs.filter(doc => doc.data().status === 'APPROVED');
    const evaluated = registrations.flatMap(doc => {
      const totals = totalsByRegistration.get(doc.id);
      if (!totals?.length) return [];
      const registration = doc.data();
      const score = Number((totals.reduce((sum, value) => sum + value, 0) / totals.length).toFixed(2));
      return [{
        registrationId: doc.id,
        bib: registration.chestNumber || '',
        candidateName: registration.participantName || '',
        teamId: registration.teamId || '',
        teamCode: registration.teamCode || '',
        teamName: registration.teamName || '',
        teamColor: '#2563EB',
        score,
        grade: calculateGrade(score, maxMarks)
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

    const { resolvedRegistrations } = await this.validateScoresPayload(db, params.competitionId, params.scores);
    const normalizedScores = Object.fromEntries(
      Object.entries(params.scores).map(([key, value]) => [resolvedRegistrations.get(key)!, value])
    );

    const submittedAt = new Date().toISOString();
    const hashPayload = `${params.assignmentId}:${params.competitionId}:${submittedAt}:${JSON.stringify(normalizedScores)}`;
    const verificationHash = 'SHA256:' + createHash('sha256').update(hashPayload).digest('hex');
    const markEntryId = `me-${params.assignmentId}`;

    const lockRef = db.collection('competitionMarkingLocks').doc(params.competitionId);
    const markEntryRef = db.collection('markEntries').doc(markEntryId);
    const assignRef = db.collection('judgeAssignments').doc(params.assignmentId);

    // Atomically persist finalized scorecard, update assignment status, and lock reassignment
    await db.runTransaction(async (transaction) => {
      const lockDoc = await transaction.get(lockRef);
      if (lockDoc.exists && lockDoc.data()?.reassignmentInProgress) {
        throw new Error('Lock Conflict: Code Letter reassignment is currently in progress for this competition. Please retry.');
      }

      const assignDoc = await transaction.get(assignRef);
      if (assignDoc.exists && assignDoc.data()?.status === 'SUBMITTED') {
        throw new Error('Unauthorized: Scorecard has already been finalized and submitted. Marks are immutable.');
      }

      // Concurrency check: Ensure Code Letter-to-registration mapping has not changed or become stale
      for (const [codeLetterKey, expectedRegId] of resolvedRegistrations.entries()) {
        const cleanCode = codeLetterKey.trim().toUpperCase();
        const asgnRef = db.collection('greenRoomAssignments').doc(`${params.competitionId}_${expectedRegId}`);
        const asgnDoc = await transaction.get(asgnRef);

        if (!asgnDoc.exists) {
          throw new Error(
            `Stale Mapping Error: Contestant registration "${expectedRegId}" is no longer checked in for competition "${params.competitionId}". The contestant roster was updated backstage. Please refresh your contestant roster and re-verify your scores before submitting.`
          );
        }

        const currentCode = (asgnDoc.data()?.codeLetter || '').trim().toUpperCase();
        if (currentCode !== cleanCode) {
          throw new Error(
            `Stale Mapping Error: Code Letter "${cleanCode}" is no longer mapped to registration "${expectedRegId}" (currently mapped to "${currentCode}"). The contestant roster was updated backstage. Please refresh your contestant roster and re-verify your scores before submitting.`
          );
        }
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
