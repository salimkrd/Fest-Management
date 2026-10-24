/**
 * Green Room Management Service
 * 
 * Features:
 * 1. Transactional Code Letter Assignment (A..Z, AA..ZZ) per competition.
 * 2. Idempotent check-ins: repeated scans return existing code assignment.
 * 3. Group competition support: one code letter per group registration.
 * 4. Safe reassignment rules with mandatory reasoning and audit trail.
 * 5. Contestant status transitions (CHECKED_IN, ON_STAGE, COMPLETED, ABSENT).
 * 6. Strict RBAC (Admin & Green Room Staff only).
 */

import { randomUUID } from 'crypto';
import { getAdminDb } from '@/lib/firebase/admin';
import { AuthService } from './authService';
import {
  indexToCodeLetter,
  codeLetterToIndex,
  isValidCodeLetter,
  getNextAvailableCodeLetter,
  parseParticipantQrPayload
} from '@/domain/greenRoom';
import { QrSignerService } from './qrSignerService';
import { GreenRoomAssignment, GreenRoomContestantStatus } from '@/types/fest';
import { FirestoreGreenRoomAssignment, FirestoreAuditLog } from '@/types/firestore';

export interface CheckInContestantParams {
  competitionId: string;
  participantIdentifier: string; // QR raw string, participantId, bib, chestNumber, or registrationId/code
  checkInMethod?: 'QR_SCAN' | 'MANUAL_LOOKUP';
  manualCodeLetter?: string;
  notes?: string;
  operatorIdToken: string;
}

export interface CheckInResult {
  success: boolean;
  assignment: FirestoreGreenRoomAssignment;
  isExisting: boolean;
  checkInMethod: 'QR_SCAN' | 'MANUAL_LOOKUP';
  qrVerified: boolean;
  message: string;
}

export interface ReassignCodeParams {
  competitionId: string;
  registrationId: string;
  newCodeLetter: string;
  reason: string;
  operatorIdToken: string;
}

export interface UpdateStatusParams {
  competitionId: string;
  registrationId: string;
  status: GreenRoomContestantStatus;
  operatorIdToken: string;
}

export class GreenRoomService {
  /**
   * Checks in a contestant or group into the Green Room for a given competition.
   * Atomic, idempotent, and enforces strict eligibility.
   */
  static async checkInContestant(params: CheckInContestantParams): Promise<CheckInResult> {
    const operator = await AuthService.assertAdminOrGreenRoom(params.operatorIdToken);
    const db = getAdminDb();
    if (!db) {
      throw new Error('Database Unavailable: Cannot process Green Room check-in.');
    }

    const { competitionId, participantIdentifier, manualCodeLetter, notes } = params;
    if (!competitionId || !participantIdentifier) {
      throw new Error('Validation Error: competitionId and participantIdentifier are required.');
    }

    // 1. Fetch competition document
    const compDoc = await db.collection('competitions').doc(competitionId).get();
    if (!compDoc.exists) {
      throw new Error(`Validation Error: Competition "${competitionId}" not found.`);
    }
    const compData = compDoc.data()!;

    // 2. Parse identifier and strictly separate QR_SCAN vs MANUAL_LOOKUP
    const parsedQr = parseParticipantQrPayload(participantIdentifier);
    const requestedMethod = params.checkInMethod;

    let resolvedMethod: 'QR_SCAN' | 'MANUAL_LOOKUP';
    let qrVerified = false;

    if (requestedMethod === 'QR_SCAN') {
      if (parsedQr.format !== 'JSON_PAYLOAD' || !parsedQr.token) {
        throw new Error(
          'Validation Error: QR_SCAN requires an authentic server-signed QR payload. Plain identifiers and manual searches must use MANUAL_LOOKUP.'
        );
      }
      if (!QrSignerService.verifyParticipantQrToken(parsedQr.participantId || '', parsedQr.bib || '', parsedQr.token)) {
        throw new Error('Validation Error: Invalid or tampered QR verification token. Participant credentials could not be authenticated.');
      }
      resolvedMethod = 'QR_SCAN';
      qrVerified = true;
    } else if (requestedMethod === 'MANUAL_LOOKUP') {
      // Manual lookup must remain authenticated and audited (Auth check operator assertAdminOrGreenRoom already passed)
      resolvedMethod = 'MANUAL_LOOKUP';
      qrVerified = false;
    } else {
      // Inferred fallback if not explicitly provided
      if (parsedQr.format === 'JSON_PAYLOAD' && parsedQr.token) {
        if (!QrSignerService.verifyParticipantQrToken(parsedQr.participantId || '', parsedQr.bib || '', parsedQr.token)) {
          throw new Error('Validation Error: Invalid or tampered QR verification token. Participant credentials could not be authenticated.');
        }
        resolvedMethod = 'QR_SCAN';
        qrVerified = true;
      } else {
        resolvedMethod = 'MANUAL_LOOKUP';
        qrVerified = false;
      }
    }

    const candidateIdentifiers = [
      parsedQr.participantId,
      parsedQr.bib,
      participantIdentifier.trim(),
      participantIdentifier.trim().toUpperCase()
    ].filter(Boolean) as string[];

    // 3. Find matching registration for this competition
    const regsSnap = await db.collection('registrations')
      .where('competitionId', '==', competitionId)
      .get();

    if (regsSnap.empty) {
      throw new Error(`Validation Error: No registrations found for competition "${compData.name}".`);
    }

    let matchingRegDoc = regsSnap.docs.find(doc => {
      const data = doc.data();
      const cleanChest = (data.chestNumber || '').toString().trim().toUpperCase();
      const cleanBib = (data.bib || '').toString().trim().toUpperCase();
      const cleanPartId = (data.participantId || '').toString().trim();
      const cleanCode = (data.code || '').toString().trim().toUpperCase();
      const cleanDocId = doc.id.trim();

      // Check group members if applicable
      const inGroup = Array.isArray(data.groupMembers) && candidateIdentifiers.some(cid =>
        data.groupMembers.includes(cid)
      );

      return (
        candidateIdentifiers.includes(cleanDocId) ||
        candidateIdentifiers.includes(cleanPartId) ||
        candidateIdentifiers.includes(cleanBib) ||
        candidateIdentifiers.includes(cleanChest) ||
        candidateIdentifiers.includes(cleanCode) ||
        inGroup
      );
    });

    if (!matchingRegDoc) {
      // Check if participant is registered for a DIFFERENT competition to give a helpful diagnostic
      const allRegsSnap = await db.collection('registrations').limit(100).get();
      const otherReg = allRegsSnap.docs.find(doc => {
        const data = doc.data();
        return candidateIdentifiers.some(cid =>
          doc.id === cid || data.participantId === cid || data.bib === cid || data.chestNumber === cid
        );
      });

      if (otherReg) {
        throw new Error(
          `Eligibility Error: Contestant is registered for "${otherReg.data().competitionName || 'another competition'}", not "${compData.name}".`
        );
      }

      throw new Error(
        `Eligibility Error: Contestant identifier "${participantIdentifier}" is not registered for competition "${compData.name}".`
      );
    }

    const regData = matchingRegDoc.data();
    const registrationId = matchingRegDoc.id;

    // 4. Invariant: Only APPROVED registrations are eligible for Green Room check-in
    const regStatus = (regData.status || '').toString().trim().toUpperCase();
    if (regStatus !== 'APPROVED') {
      throw new Error(
        `Eligibility Error: Registration "${regData.code || registrationId}" has status "${regStatus || 'PENDING'}". Only APPROVED registrations can be checked into the Green Room.`
      );
    }

    // 5. Transactional Code Letter Assignment
    const assignmentDocId = `${competitionId}_${registrationId}`;
    const assignmentRef = db.collection('greenRoomAssignments').doc(assignmentDocId);
    const counterRef = db.collection('greenRoomCounters').doc(competitionId);
    const auditLogRef = db.collection('auditLogs').doc(`audit-${randomUUID()}`);

    let assignedCode = '';
    let isExisting = false;
    let finalAssignment: FirestoreGreenRoomAssignment | null = null;

    await db.runTransaction(async (transaction) => {
      // Read 1: Check existing assignment
      const existingDoc = await transaction.get(assignmentRef);
      if (existingDoc.exists) {
        isExisting = true;
        finalAssignment = existingDoc.data() as FirestoreGreenRoomAssignment;
        assignedCode = finalAssignment.codeLetter;
        return;
      }

      // Read 2: Counter / assigned codes set for this competition
      const counterDoc = await transaction.get(counterRef);
      const assignedCodes: string[] = counterDoc.exists ? (counterDoc.data()?.assignedCodes || []) : [];

      // Determine Code Letter
      if (manualCodeLetter) {
        const cleanManual = manualCodeLetter.trim().toUpperCase();
        if (!isValidCodeLetter(cleanManual)) {
          throw new Error(`Validation Error: Invalid manual Code Letter "${manualCodeLetter}". Must be A-Z or AA-ZZ.`);
        }
        if (assignedCodes.includes(cleanManual)) {
          throw new Error(
            `Conflict Error: Code Letter "${cleanManual}" has already been assigned in competition "${compData.name}". Choose another code or use automatic assignment.`
          );
        }
        assignedCode = cleanManual;
      } else {
        assignedCode = getNextAvailableCodeLetter(assignedCodes);
      }

      const codeIndex = codeLetterToIndex(assignedCode);
      const now = new Date().toISOString();

      finalAssignment = {
        id: assignmentDocId,
        competitionId,
        competitionCode: compData.code || '',
        competitionName: compData.name || '',
        categoryId: compData.categoryId || '',
        categoryName: compData.categoryName || '',
        stageId: compData.stageId || '',
        stageName: compData.stageName || '',
        registrationId,
        registrationCode: regData.code || '',
        participantId: regData.participantId || undefined,
        participantName: regData.participantName || 'Contestant',
        teamId: regData.teamId || '',
        teamCode: regData.teamCode || '',
        teamName: regData.teamName || '',
        chestNumber: regData.chestNumber || '',
        type: compData.type || regData.type || 'SOLO',
        groupMembers: regData.groupMembers || undefined,
        codeLetter: assignedCode,
        codeIndex,
        status: 'CHECKED_IN',
        checkedInAt: now,
        checkedInBy: operator.uid,
        checkedInByRole: operator.role as 'ADMIN' | 'GREEN_ROOM_STAFF',
        notes: notes || '',
        checkInMethod: resolvedMethod,
        qrVerified,
        createdAt: now,
        updatedAt: now
      };

      // Write 1: Green Room Assignment
      transaction.set(assignmentRef, finalAssignment);

      // Write 2: Counter update
      const updatedCodes = [...assignedCodes, assignedCode];
      transaction.set(counterRef, {
        competitionId,
        assignedCodes: updatedCodes,
        totalCheckedIn: updatedCodes.length,
        lastAssignedCode: assignedCode,
        updatedAt: now
      }, { merge: true });

      // Write 3: Append Audit Log with distinct action and method metadata
      const auditAction = resolvedMethod === 'QR_SCAN' ? 'GREEN_ROOM_QR_CHECK_IN' : 'GREEN_ROOM_MANUAL_CHECK_IN';
      const auditEntry: FirestoreAuditLog = {
        id: auditLogRef.id,
        action: auditAction,
        actorId: operator.uid,
        actorEmail: operator.email,
        actorRole: operator.role,
        targetCollection: 'greenRoomAssignments',
        targetDocId: assignmentDocId,
        details: {
          competitionId,
          registrationId,
          codeLetter: assignedCode,
          codeIndex,
          type: finalAssignment.type,
          isManual: Boolean(manualCodeLetter),
          checkInMethod: resolvedMethod,
          qrVerified
        },
        timestamp: now
      };
      transaction.set(auditLogRef, auditEntry);
    });

    const isQrVerified = (finalAssignment as FirestoreGreenRoomAssignment | null)?.qrVerified ?? qrVerified;
    const resolvedCheckInMethod = (finalAssignment as FirestoreGreenRoomAssignment | null)?.checkInMethod ?? resolvedMethod;

    return {
      success: true,
      assignment: finalAssignment!,
      isExisting,
      checkInMethod: resolvedCheckInMethod,
      qrVerified: isQrVerified,
      message: isExisting
        ? `Contestant already checked in. Existing Code Letter: ${assignedCode}`
        : `Successfully assigned Code Letter ${assignedCode} to contestant.`
    };
  }

  /**
   * Safely reassigns a Code Letter to a contestant with mandatory reason and audit trail.
   */
  static async reassignCodeLetter(params: ReassignCodeParams): Promise<FirestoreGreenRoomAssignment> {
    const operator = await AuthService.assertAdminOrGreenRoom(params.operatorIdToken);
    const db = getAdminDb();
    if (!db) {
      throw new Error('Database Unavailable: Cannot reassign Code Letter.');
    }

    const { competitionId, registrationId, newCodeLetter, reason } = params;
    if (!competitionId || !registrationId || !newCodeLetter || !reason || reason.trim().length < 5) {
      throw new Error('Validation Error: competitionId, registrationId, newCodeLetter, and reason (min 5 chars) are required.');
    }

    const cleanNewCode = newCodeLetter.trim().toUpperCase();
    if (!isValidCodeLetter(cleanNewCode)) {
      throw new Error(`Validation Error: Invalid Code Letter "${newCodeLetter}". Must be A-Z or AA-ZZ.`);
    }

    // Invariant: Lock Code Letter reassignment once judge draft marking begins, marks are submitted, or results are finalized.
    // 1. Check if official results exist or have been published
    const resDoc = await db.collection('results').doc(`res-${competitionId}`).get();
    if (resDoc.exists) {
      const resData = resDoc.data();
      if (['PUBLISHED', 'READY_TO_PUBLISH', 'SEALED'].includes(resData?.resultStatus) || resData?.published === true) {
        throw new Error(
          `Lock Error: Code Letter reassignment is locked. Official results have already been finalized or published for this competition.`
        );
      }
    }

    // 2. Check if draft mark entries or submitted scorecards exist with marks
    const markEntriesSnap = await db.collection('markEntries')
      .where('competitionId', '==', competitionId)
      .get();
    const hasActiveMarks = markEntriesSnap.docs.some(doc => {
      const data = doc.data();
      return (
        data.status === 'SUBMITTED' ||
        data.submitted === true ||
        (data.scores && Object.keys(data.scores).length > 0)
      );
    });

    if (hasActiveMarks) {
      throw new Error(
        `Lock Error: Code Letter reassignment is locked. Judge draft marking has begun or scorecards have been submitted for this competition. Reassigning Code Letters during or after evaluation is prohibited to prevent score misattribution.`
      );
    }

    // 3. Check if any judge assignment has status SUBMITTED
    const judgeAssignSnap = await db.collection('judgeAssignments')
      .where('competitionId', '==', competitionId)
      .where('status', '==', 'SUBMITTED')
      .limit(1)
      .get();

    if (!judgeAssignSnap.empty) {
      throw new Error(
        `Lock Error: Code Letter reassignment is locked. A juror has already submitted official marks for this competition.`
      );
    }

    // 4. Check if competition is marked COMPLETED
    const compDoc = await db.collection('competitions').doc(competitionId).get();
    if (compDoc.exists && compDoc.data()?.status === 'COMPLETED') {
      throw new Error(
        `Lock Error: Code Letter reassignment is locked. Competition status is marked as COMPLETED.`
      );
    }

    const assignmentDocId = `${competitionId}_${registrationId}`;
    const assignmentRef = db.collection('greenRoomAssignments').doc(assignmentDocId);
    const counterRef = db.collection('greenRoomCounters').doc(competitionId);
    const auditLogRef = db.collection('auditLogs').doc(`audit-${randomUUID()}`);
    const lockRef = db.collection('competitionMarkingLocks').doc(competitionId);

    let updatedAssignment: FirestoreGreenRoomAssignment | null = null;

    await db.runTransaction(async (transaction) => {
      // 1. Transactionally verify shared competition marking lock
      const lockDoc = await transaction.get(lockRef);
      if (lockDoc.exists) {
        const lockData = lockDoc.data();
        if (lockData?.locked || lockData?.markingStarted || lockData?.finalized) {
          throw new Error(
            `Lock Error: Code Letter reassignment is locked. Judge draft marking has begun or scorecards have been submitted for this competition. Reassigning Code Letters during or after evaluation is prohibited to prevent score misattribution.`
          );
        }
      }

      const assignmentDoc = await transaction.get(assignmentRef);
      if (!assignmentDoc.exists) {
        throw new Error(`Not Found: No Green Room assignment found for registration "${registrationId}".`);
      }

      const currentData = assignmentDoc.data() as FirestoreGreenRoomAssignment;
      const oldCode = currentData.codeLetter;
      if (oldCode === cleanNewCode) {
        throw new Error(`Validation Error: Contestant is already assigned Code Letter "${cleanNewCode}".`);
      }

      const counterDoc = await transaction.get(counterRef);
      const assignedCodes: string[] = counterDoc.exists ? (counterDoc.data()?.assignedCodes || []) : [];

      // Check if new code is already assigned to someone else
      if (assignedCodes.includes(cleanNewCode)) {
        throw new Error(`Conflict Error: Code Letter "${cleanNewCode}" is already in use by another contestant.`);
      }

      const now = new Date().toISOString();
      const newIndex = codeLetterToIndex(cleanNewCode);

      // Set lock flag indicating reassignment transaction is committing
      transaction.set(lockRef, {
        competitionId,
        reassignmentInProgress: true,
        updatedAt: now
      }, { merge: true });

      updatedAssignment = {
        ...currentData,
        codeLetter: cleanNewCode,
        codeIndex: newIndex,
        reassignedFrom: oldCode,
        reassignedAt: now,
        reassignmentReason: reason.trim(),
        updatedAt: now
      };

      transaction.set(assignmentRef, updatedAssignment);

      // Update counter assignedCodes: replace oldCode with cleanNewCode
      const filteredCodes = assignedCodes.filter(c => c !== oldCode);
      filteredCodes.push(cleanNewCode);

      transaction.set(counterRef, {
        competitionId,
        assignedCodes: filteredCodes,
        lastAssignedCode: cleanNewCode,
        updatedAt: now
      }, { merge: true });

      // Append Audit Log
      const auditEntry: FirestoreAuditLog = {
        id: auditLogRef.id,
        action: 'GREEN_ROOM_CODE_REASSIGNED',
        actorId: operator.uid,
        actorEmail: operator.email,
        actorRole: operator.role,
        targetCollection: 'greenRoomAssignments',
        targetDocId: assignmentDocId,
        details: {
          competitionId,
          registrationId,
          oldCode,
          newCode: cleanNewCode,
          reason: reason.trim()
        },
        timestamp: now
      };
      transaction.set(auditLogRef, auditEntry);

      // Release reassignmentInProgress flag
      transaction.set(lockRef, {
        competitionId,
        reassignmentInProgress: false,
        updatedAt: now
      }, { merge: true });
    });

    return updatedAssignment!;
  }

  /**
   * Updates stage appearance status of a checked-in contestant.
   */
  static async updateContestantStatus(params: UpdateStatusParams): Promise<FirestoreGreenRoomAssignment> {
    const operator = await AuthService.assertAdminOrGreenRoom(params.operatorIdToken);
    const db = getAdminDb();
    if (!db) {
      throw new Error('Database Unavailable: Cannot update contestant status.');
    }

    const { competitionId, registrationId, status } = params;
    const assignmentDocId = `${competitionId}_${registrationId}`;
    const assignmentRef = db.collection('greenRoomAssignments').doc(assignmentDocId);

    const docSnap = await assignmentRef.get();
    if (!docSnap.exists) {
      throw new Error(`Not Found: Green Room assignment for registration "${registrationId}" does not exist.`);
    }

    const now = new Date().toISOString();
    await assignmentRef.update({
      status,
      updatedAt: now
    });

    const updated = (await assignmentRef.get()).data() as FirestoreGreenRoomAssignment;

    // Log status change
    await db.collection('auditLogs').add({
      action: 'GREEN_ROOM_STATUS_CHANGED',
      actorId: operator.uid,
      actorEmail: operator.email,
      actorRole: operator.role,
      targetCollection: 'greenRoomAssignments',
      targetDocId: assignmentDocId,
      details: {
        competitionId,
        registrationId,
        newStatus: status
      },
      timestamp: now
    });

    return updated;
  }

  /**
   * Fetches all Green Room assignments for a competition, ordered by Code Letter.
   * Access restricted to Admin & Green Room Staff.
   */
  static async getCompetitionRoster(
    competitionId: string,
    operatorIdToken: string
  ): Promise<FirestoreGreenRoomAssignment[]> {
    await AuthService.assertAdminOrGreenRoom(operatorIdToken);
    const db = getAdminDb();
    if (!db) return [];

    const snap = await db.collection('greenRoomAssignments')
      .where('competitionId', '==', competitionId)
      .get();

    const assignments = snap.docs.map(doc => doc.data() as FirestoreGreenRoomAssignment);
    // Sort by codeIndex (A..Z, AA..ZZ)
    assignments.sort((a, b) => (a.codeIndex ?? 0) - (b.codeIndex ?? 0));
    return assignments;
  }

  /**
   * Server helper for Judge scoring resolution:
   * Resolves anonymous Code Letters for a competition to actual registration IDs.
   * Does NOT return participant names or teams to maintain server-side isolation.
   */
  static async resolveCodeLettersToRegistrations(
    competitionId: string
  ): Promise<Map<string, string>> {
    const db = getAdminDb();
    if (!db) return new Map();

    const snap = await db.collection('greenRoomAssignments')
      .where('competitionId', '==', competitionId)
      .get();

    const mapping = new Map<string, string>(); // codeLetter -> registrationId
    snap.docs.forEach(doc => {
      const data = doc.data();
      if (data.codeLetter && data.registrationId) {
        mapping.set(data.codeLetter.trim().toUpperCase(), data.registrationId);
      }
    });

    return mapping;
  }
}
