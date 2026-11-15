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
import { getRandomAvailableCodeLetter } from './greenRoomCodeAllocator';
import { getAdminDb } from '@/lib/firebase/admin';
import { AuthService } from './authService';
import {
  codeLetterToIndex,
  isValidCodeLetter,
  parseParticipantQrPayload
} from '@/domain/greenRoom';
import { QrSignerService } from './qrSignerService';
import { GreenRoomContestantStatus } from '@/types/fest';
import { FirestoreGreenRoomAssignment, FirestoreAuditLog } from '@/types/firestore';
import { buildGreenRoomRosterSnapshot } from '@/domain/greenRoomRoster';

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

    const candidateIdentifiers = Array.from(new Set([
      parsedQr.participantId,
      parsedQr.bib,
      participantIdentifier.trim(),
      participantIdentifier.trim().toUpperCase()
    ].filter((value): value is string => typeof value === 'string' && value.trim().length > 0)));

    // 3. Find matching registration for this competition
    const regsSnap = await db.collection('registrations')
      .where('competitionId', '==', competitionId)
      .get();

    if (regsSnap.empty) {
      throw new Error(`Validation Error: No registrations found for competition "${compData.name}".`);
    }

    const matchingRegDocs = regsSnap.docs.filter(doc => {
      const data = doc.data();
      const cleanChest = String(data.chestNumber || '').trim().toUpperCase();
      const cleanBib = String(data.bib || '').trim().toUpperCase();
      const cleanPartId = String(data.participantId || '').trim();
      const cleanCode = String(data.code || '').trim().toUpperCase();
      const cleanDocId = doc.id.trim();

      // Check group members if applicable. A scan must resolve to one
      // registration only; never pick the first match from an ambiguous roster.
      const groupMembers = Array.isArray(data.groupMembers)
        ? data.groupMembers.map((member: unknown) => String(member).trim())
        : [];
      const inGroup = candidateIdentifiers.some(cid => groupMembers.includes(cid));

      return (
        candidateIdentifiers.includes(cleanDocId) ||
        candidateIdentifiers.includes(cleanPartId) ||
        candidateIdentifiers.includes(cleanBib) ||
        candidateIdentifiers.includes(cleanChest) ||
        candidateIdentifiers.includes(cleanCode) ||
        inGroup
      );
    });

    if (matchingRegDocs.length > 1) {
      throw new Error(
        `Validation Error: Identifier "${participantIdentifier}" matches more than one registration in this competition. Check-in has been blocked to prevent assigning a Code Letter to the wrong contestant.`
      );
    }

    const matchingRegDoc = matchingRegDocs[0];

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
    const lockRef = db.collection('competitionMarkingLocks').doc(competitionId);
    const assignmentQuery = db.collection('greenRoomAssignments')
      .where('competitionId', '==', competitionId);
    const registrationQuery = db.collection('registrations')
      .where('competitionId', '==', competitionId);
    const auditLogRef = db.collection('auditLogs').doc(`audit-${randomUUID()}`);

    let assignedCode = '';
    let isExisting = false;
    let finalAssignment: FirestoreGreenRoomAssignment | null = null;

    await db.runTransaction(async (transaction) => {
      // All roster/counter/lock reads occur before writes so Firestore can
      // serialize check-in against judge marking and Code Letter reassignment.
      const existingDoc = await transaction.get(assignmentRef);
      const lockDoc = await transaction.get(lockRef);
      const counterDoc = await transaction.get(counterRef);
      const assignmentSnapshot = await transaction.get(assignmentQuery);
      const registrationSnapshot = await transaction.get(registrationQuery);

      const roster = buildGreenRoomRosterSnapshot(
        competitionId,
        assignmentSnapshot.docs.map(doc => ({ id: doc.id, data: doc.data() as Record<string, unknown> }))
      );
      const approvedRegistrationIds = new Set(
        registrationSnapshot.docs
          .filter(doc => String(doc.data().status || '').trim().toUpperCase() === 'APPROVED')
          .map(doc => doc.id)
      );

      for (const entry of roster.entries) {
        if (!approvedRegistrationIds.has(entry.registrationId)) {
          throw new Error(
            `Roster Integrity Error: Code Letter "${entry.codeLetter}" points to a registration that is no longer approved.`
          );
        }
      }

      const currentRegistration = registrationSnapshot.docs.find(doc => doc.id === registrationId);
      if (
        !currentRegistration ||
        String(currentRegistration.data().status || '').trim().toUpperCase() !== 'APPROVED'
      ) {
        throw new Error('Eligibility Error: Registration is no longer approved for this competition. Refresh the Green Room roster.');
      }

      const lockData = lockDoc.exists ? lockDoc.data() || {} : {};
      const assignedCodes = roster.entries.map(entry => entry.codeLetter);
      const eligibleCount = approvedRegistrationIds.size;

      if (existingDoc.exists) {
        const existing = existingDoc.data() as FirestoreGreenRoomAssignment;
        const mapped = roster.registrationToCode.get(registrationId);
        if (!mapped || mapped.codeLetter !== String(existing.codeLetter || '').trim().toUpperCase()) {
          throw new Error('Roster Integrity Error: Existing check-in record does not match the canonical Green Room roster.');
        }

        isExisting = true;
        finalAssignment = existing;
        assignedCode = mapped.codeLetter;

        // Repair a stale counter from the authoritative assignment documents.
        const sortedCodes = [...assignedCodes].sort((a, b) => codeLetterToIndex(a) - codeLetterToIndex(b));
        const counterCodes = Array.isArray(counterDoc.data()?.assignedCodes)
          ? (counterDoc.data()!.assignedCodes as string[]).map(code => String(code).trim().toUpperCase())
          : [];
        if (JSON.stringify(counterCodes) !== JSON.stringify(sortedCodes)) {
          transaction.set(counterRef, {
            competitionId,
            assignedCodes: sortedCodes,
            totalCheckedIn: sortedCodes.length,
            lastAssignedCode: sortedCodes[sortedCodes.length - 1] || '',
            updatedAt: new Date().toISOString()
          }, { merge: true });
        }
        return;
      }

      if (lockData.locked || lockData.markingStarted || lockData.finalized || lockData.reassignmentInProgress) {
        throw new Error(
          'Lock Error: Green Room check-in is locked because judge marking has started. New contestants cannot be added after the judging roster is frozen.'
        );
      }

      if (roster.entries.length >= eligibleCount) {
        throw new Error('Conflict Error: Every approved registration already has a Green Room Code Letter.');
      }

      // Determine Code Letter from the authoritative assignment documents, not
      // the denormalized counter, which may be stale or incomplete.
      if (manualCodeLetter) {
        const cleanManual = manualCodeLetter.trim().toUpperCase();
        if (!isValidCodeLetter(cleanManual)) {
          throw new Error(`Validation Error: Invalid manual Code Letter "${manualCodeLetter}". Must be A-Z or AA-ZZ.`);
        }
        if (codeLetterToIndex(cleanManual) >= eligibleCount) {
          throw new Error(`Validation Error: Code Letter "${cleanManual}" is outside the A..N range for ${eligibleCount} approved entries.`);
        }
        if (roster.codeToRegistration.has(cleanManual)) {
          throw new Error(
            `Conflict Error: Code Letter "${cleanManual}" has already been assigned in competition "${compData.name}". Choose another code or use automatic assignment.`
          );
        }
        assignedCode = cleanManual;
      } else {
        assignedCode = getRandomAvailableCodeLetter(assignedCodes, eligibleCount);
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

      // Write 2: Reconcile the counter from the authoritative roster.
      const updatedCodes = [...assignedCodes, assignedCode]
        .sort((a, b) => codeLetterToIndex(a) - codeLetterToIndex(b));
      transaction.set(counterRef, {
        competitionId,
        assignedCodes: updatedCodes,
        totalCheckedIn: updatedCodes.length,
        lastAssignedCode: assignedCode,
        updatedAt: now
      }, { merge: true });

      // Update the same lock document used by judge saves and reassignments.
      // This makes roster changes serialize against the first mark save.
      transaction.set(lockRef, {
        competitionId,
        rosterRevision: Number(lockData.rosterRevision || 0) + 1,
        rosterUpdatedAt: now,
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
    const assignmentQuery = db.collection('greenRoomAssignments')
      .where('competitionId', '==', competitionId);
    const registrationQuery = db.collection('registrations')
      .where('competitionId', '==', competitionId);

    let updatedAssignment: FirestoreGreenRoomAssignment | null = null;

    await db.runTransaction(async (transaction) => {
      // All reads happen before writes. The shared lock serializes this update
      // with judge score saves and new Green Room check-ins.
      const lockDoc = await transaction.get(lockRef);
      const assignmentDoc = await transaction.get(assignmentRef);
      const counterDoc = await transaction.get(counterRef);
      const assignmentSnapshot = await transaction.get(assignmentQuery);
      const registrationSnapshot = await transaction.get(registrationQuery);

      const lockData = lockDoc.exists ? lockDoc.data() || {} : {};
      if (lockData.locked || lockData.markingStarted || lockData.finalized || lockData.reassignmentInProgress) {
        throw new Error(
          'Lock Error: Code Letter reassignment is locked. Judge marking has started or the Green Room roster has been frozen.'
        );
      }

      if (!assignmentDoc.exists) {
        throw new Error(`Not Found: No Green Room assignment found for registration "${registrationId}".`);
      }

      const roster = buildGreenRoomRosterSnapshot(
        competitionId,
        assignmentSnapshot.docs.map(doc => ({ id: doc.id, data: doc.data() as Record<string, unknown> }))
      );
      const currentData = assignmentDoc.data() as FirestoreGreenRoomAssignment;
      const currentEntry = roster.registrationToCode.get(registrationId);
      if (
        !currentEntry ||
        currentEntry.codeLetter !== String(currentData.codeLetter || '').trim().toUpperCase()
      ) {
        throw new Error('Roster Integrity Error: Target registration does not match its canonical Green Room assignment.');
      }

      const approvedRegistrationIds = new Set(
        registrationSnapshot.docs
          .filter(doc => String(doc.data().status || '').trim().toUpperCase() === 'APPROVED')
          .map(doc => doc.id)
      );
      if (!approvedRegistrationIds.has(registrationId)) {
        throw new Error('Eligibility Error: Only an approved registration can keep a Green Room Code Letter.');
      }
      for (const entry of roster.entries) {
        if (!approvedRegistrationIds.has(entry.registrationId)) {
          throw new Error(
            `Roster Integrity Error: Code Letter "${entry.codeLetter}" points to a registration that is no longer approved.`
          );
        }
      }

      const eligibleCount = approvedRegistrationIds.size;
      if (codeLetterToIndex(cleanNewCode) >= eligibleCount) {
        throw new Error(`Validation Error: Code Letter "${cleanNewCode}" is outside the A..N range for ${eligibleCount} approved entries.`);
      }

      const oldCode = currentEntry.codeLetter;
      if (oldCode === cleanNewCode) {
        throw new Error(`Validation Error: Contestant is already assigned Code Letter "${cleanNewCode}".`);
      }

      const occupiedByOther = roster.codeToRegistration.get(cleanNewCode);
      if (occupiedByOther && occupiedByOther !== registrationId) {
        throw new Error(`Conflict Error: Code Letter "${cleanNewCode}" is already in use by another contestant.`);
      }

      const now = new Date().toISOString();
      const newIndex = codeLetterToIndex(cleanNewCode);

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

      const updatedCodes = roster.entries
        .filter(entry => entry.registrationId !== registrationId)
        .map(entry => entry.codeLetter)
        .concat(cleanNewCode)
        .sort((a, b) => codeLetterToIndex(a) - codeLetterToIndex(b));

      transaction.set(counterRef, {
        competitionId,
        assignedCodes: updatedCodes,
        totalCheckedIn: updatedCodes.length,
        lastAssignedCode: cleanNewCode,
        updatedAt: now
      }, { merge: true });

      // Increment the same versioned lock read by the Judge save transaction.
      transaction.set(lockRef, {
        competitionId,
        rosterRevision: Number(lockData.rosterRevision || 0) + 1,
        rosterUpdatedAt: now,
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

    const roster = buildGreenRoomRosterSnapshot(
      competitionId,
      snap.docs.map(doc => ({ id: doc.id, data: doc.data() as Record<string, unknown> }))
    );
    const assignments = roster.entries.map(entry => {
      const matchingDoc = snap.docs.find(doc => doc.id === `${competitionId}_${entry.registrationId}`);
      if (!matchingDoc) {
        throw new Error('Roster Integrity Error: A Green Room assignment could not be resolved to its canonical document.');
      }
      return matchingDoc.data() as FirestoreGreenRoomAssignment;
    });
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

    const roster = buildGreenRoomRosterSnapshot(
      competitionId,
      snap.docs.map(doc => ({ id: doc.id, data: doc.data() as Record<string, unknown> }))
    );
    return roster.codeToRegistration;
  }
}
