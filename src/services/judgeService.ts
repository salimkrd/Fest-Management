/**
 * Judge Service
 * Manages judge assignments, cryptographic password verification, and session token generation.
 */

import { createHash } from 'crypto';
import { getAdminDb } from '@/lib/firebase/admin';
import {
  createJudgeAssignment,
  verifyJudgeAssignment,
  JudgeAssignmentRecord,
  GeneratedCredentials,
  VerificationResult
} from '@/domain/judgeAuth';
import { AuthService } from './authService';

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
    const docId = `asgn-${Date.now()}-${Math.floor(Math.random() * 1000)}`;

    const creds = await createJudgeAssignment({
      id: docId,
      judgeName: params.judgeName,
      judgePhone: params.judgePhone,
      competitionId: params.competitionId,
      competitionCode: params.competitionCode,
      competitionName: params.competitionName,
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

    // Invariant 4: Detect ambiguous registration aliases and map each alias to its registration document ID
    const aliasToRegId = new Map<string, string>();
    const ineligibleKeys = new Map<string, string>(); // key -> ineligible reason

    // Collect all ineligible keys to give precise rejection reasons
    regsSnap.docs.forEach(doc => {
      const data = doc.data();
      const rawStatus = data.status;
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

    // Map eligible aliases and detect conflicts
    eligibleRegs.forEach(doc => {
      const data = doc.data();
      const regId = doc.id;

      const aliases = [regId, data.participantId, data.bib, data.chestNumber, data.code].filter(Boolean) as string[];
      for (const alias of aliases) {
        if (aliasToRegId.has(alias) && aliasToRegId.get(alias) !== regId) {
          // Ambiguous alias: two different registrations share the same identifier string!
          throw new Error(
            `Validation Error: Ambiguous registration alias detected. Identifier "${alias}" resolves to multiple registrations ("${aliasToRegId.get(alias)}" and "${regId}").`
          );
        }
        aliasToRegId.set(alias, regId);
      }
    });

    // Invariant 5: Verify every score key corresponds to an eligible registration,
    // and no registration is scored multiple times under different aliases.
    const scoredRegistrationIds = new Set<string>();
    const resolvedRegistrations = new Map<string, string>(); // scoreKey -> regId

    for (const [scoreKey, scoreVal] of Object.entries(scores)) {
      // Check if this key corresponds to an ineligible registration (e.g. CANCELLED, PENDING, REJECTED)
      if (ineligibleKeys.has(scoreKey)) {
        throw new Error(
          `Validation Error: Participant or registration "${scoreKey}" is an ${ineligibleKeys.get(scoreKey)}. Only APPROVED registrations can be scored.`
        );
      }

      // Check if key resolves to an eligible registration
      const resolvedRegId = aliasToRegId.get(scoreKey);
      if (!resolvedRegId) {
        throw new Error(
          `Validation Error: Participant or registration "${scoreKey}" is not assigned to an eligible registration for competition "${competitionId}". Arbitrary participant entries are strictly rejected.`
        );
      }

      // Check duplicate scoring: ensuring every score key resolves to exactly one distinct eligible registration
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

    await this.validateScoresPayload(db, params.competitionId, params.scores);

    const updatedAt = new Date().toISOString();
    const markEntryId = `me-${params.assignmentId}`;

    await db.collection('markEntries').doc(markEntryId).set({
      id: markEntryId,
      assignmentId: params.assignmentId,
      competitionId: params.competitionId,
      competitionName: assignment.competitionName || '',
      judgeName: assignment.judgeName || '',
      status: 'DRAFT',
      submitted: false,
      isFinal: false,
      scores: params.scores,
      remarks: params.remarks || '',
      updatedAt
    });

    return {
      success: true,
      markEntryId,
      updatedAt
    };
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

    await this.validateScoresPayload(db, params.competitionId, params.scores);

    const submittedAt = new Date().toISOString();
    const hashPayload = `${params.assignmentId}:${params.competitionId}:${submittedAt}:${JSON.stringify(params.scores)}`;
    const verificationHash = 'SHA256:' + createHash('sha256').update(hashPayload).digest('hex');
    const markEntryId = `me-${params.assignmentId}`;

    // Atomically persist finalized scorecard and update assignment status
    const batch = db.batch();

    batch.set(db.collection('markEntries').doc(markEntryId), {
      id: markEntryId,
      assignmentId: params.assignmentId,
      competitionId: params.competitionId,
      competitionName: assignment.competitionName || '',
      judgeName: assignment.judgeName || '',
      status: 'SUBMITTED',
      submitted: true,
      isFinal: true,
      scores: params.scores,
      submittedAt,
      verificationHash
    });

    batch.update(db.collection('judgeAssignments').doc(params.assignmentId), {
      status: 'SUBMITTED',
      submittedAt,
      verificationHash
    });

    await batch.commit();

    return {
      success: true,
      marksRecorded: Object.keys(params.scores).length,
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
