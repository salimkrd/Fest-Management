/**
 * Green Room Management System - Emulator Integration Test Suite
 * 
 * Verifies against Local Firebase Emulator Suite:
 * 1. QR Payload Generation & Robust Scannability.
 * 2. Automatic & Manual Code Letter Assignment (A..Z, AA..ZZ) with Firestore Transactions.
 * 3. Idempotency: Repeated scans return existing code assignment without duplicating or throwing.
 * 4. Eligibility Enforcement: Only APPROVED registrations can be checked into the Green Room.
 * 5. Group Competition Support: Single Code Letter per group registration.
 * 6. Safe Code Reassignment & Mandatory Audit Logging.
 * 7. Scoped GREEN_ROOM_STAFF Provisioning & Role Permissions.
 * 8. Anonymous Judge Marking: Judges score by Code Letter; server securely resolves to registrationId.
 * 9. Zero personal identity leakage to judge login API.
 */

import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { initializeApp, getApps, deleteApp } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import { getAuth } from 'firebase-admin/auth';
import { initializeApp as initClientApp, deleteApp as deleteClientApp, FirebaseApp } from 'firebase/app';
import {
  getAuth as getClientAuth,
  connectAuthEmulator,
  signInWithEmailAndPassword,
  signOut,
  Auth as ClientAuth
} from 'firebase/auth';
import { GreenRoomService } from '@/services/greenRoomService';
import { AuthService } from '@/services/authService';
import { JudgeService } from '@/services/judgeService';
import {
  indexToCodeLetter,
  codeLetterToIndex,
  getNextAvailableCodeLetter,
  encodeParticipantQrPayload,
  parseParticipantQrPayload,
  generateQrVerificationToken,
  verifyQrVerificationToken
} from '@/domain/greenRoom';
import { POST as judgeLoginHandler } from '@/app/api/judge/login/route';
import { DELETE as deleteCompetitionHandler } from '@/app/api/admin/competitions/[id]/route';
import { POST as syncClaimsHandler } from '@/app/api/auth/sync-claims/route';
import { POST as provisionStaffHandler } from '@/app/api/admin/green-room/provision-staff/route';
import { GET as qrIssuanceHandler } from '@/app/api/participants/[id]/qr/route';
import { QrSignerService } from '@/services/qrSignerService';
import { NextRequest } from 'next/server';

describe('Green Room Management & Anonymous Judging Workflow', () => {
  let adminIdToken = '';
  let staffIdToken = '';
  let team1ManagerToken = '';
  let team2ManagerToken = '';
  let clientApp: FirebaseApp;
  let clientAuth: ClientAuth;

  const adminApp = getApps().find(a => a.name === 'green-room-test-admin') ||
    initializeApp({ projectId: 'demo-sahithyolsav-2025' }, 'green-room-test-admin');
  const db = getFirestore(adminApp);
  const adminAuth = getAuth(adminApp);

  const testCompId = 'cmp-green-room-test';
  const testGroupCompId = 'cmp-group-green-room-test';

  beforeAll(async () => {
    // 1. Initialize Client Auth connected to local emulator
    const clientAppName = `gr-client-test-${Date.now()}`;
    clientApp = initClientApp(
      {
        apiKey: 'demo-api-key',
        projectId: 'demo-sahithyolsav-2025',
        authDomain: 'demo-sahithyolsav-2025.firebaseapp.com'
      },
      clientAppName
    );
    clientAuth = getClientAuth(clientApp);
    connectAuthEmulator(clientAuth, 'http://127.0.0.1:9099', { disableWarnings: true });

    // 2. Obtain Admin and Team Manager ID Tokens
    const adminCred = await signInWithEmailAndPassword(
      clientAuth,
      'admin@sahithyolsav.com',
      'AdminPassword123!'
    );
    adminIdToken = await adminCred.user.getIdToken();
    await signOut(clientAuth);

    const tm1Cred = await signInWithEmailAndPassword(
      clientAuth,
      'manager.shamama@sahithyolsav.com',
      'TeamPassword123!'
    );
    team1ManagerToken = await tm1Cred.user.getIdToken();
    await signOut(clientAuth);

    const tm2Cred = await signInWithEmailAndPassword(
      clientAuth,
      'manager.nawa@sahithyolsav.com',
      'TeamPassword123!'
    );
    team2ManagerToken = await tm2Cred.user.getIdToken();
    await signOut(clientAuth);

    // 2b. Seed Authoritative Participant Documents for QR Issuance & Scans
    await db.collection('participants').doc('p-gr-101').set({
      id: 'p-gr-101',
      bib: '#101',
      chestNumber: '101',
      name: 'Fathima Zahra',
      teamId: 'team-1',
      teamCode: 'SHA',
      teamName: 'Al-Shamama',
      categoryId: 'cat-senior',
      createdAt: new Date().toISOString()
    });

    await db.collection('participants').doc('p-gr-102').set({
      id: 'p-gr-102',
      bib: '#102',
      chestNumber: '102',
      name: 'Ahmad Rayan',
      teamId: 'team-2',
      teamCode: 'NAW',
      teamName: 'An-Nawa',
      categoryId: 'cat-senior',
      createdAt: new Date().toISOString()
    });

    // 3. Seed Solo Competition
    await db.collection('competitions').doc(testCompId).set({
      id: testCompId,
      code: 'CMP-GR-01',
      name: 'Classical Vocal (Solo)',
      categoryId: 'cat-senior',
      categoryName: 'Senior',
      type: 'SOLO',
      stageId: 'stg-auditorium',
      stageName: 'Main Auditorium',
      status: 'SCHEDULED',
      date: '2025-11-15',
      timeSlot: '09:00 AM - 11:00 AM',
      durationMinutes: 120,
      maxEntriesPerTeam: 2,
      criteria: [
        { id: 'cr-pitch', name: 'Pitch & Rhythm', maxMarks: 40 },
        { id: 'cr-expression', name: 'Expression & Delivery', maxMarks: 35 },
        { id: 'cr-diction', name: 'Diction & Clarity', maxMarks: 25 }
      ],
      createdAt: new Date().toISOString()
    });

    // 4. Seed Solo Registrations (2 APPROVED, 1 PENDING)
    await db.collection('registrations').doc('reg-gr-solo-01').set({
      id: 'reg-gr-solo-01',
      code: 'REG-GR-101',
      participantId: 'p-gr-101',
      participantName: 'Fathima Zahra',
      teamId: 'team-1',
      teamCode: 'ABH',
      teamName: 'Al-Shamama',
      categoryId: 'cat-senior',
      categoryName: 'Senior',
      competitionId: testCompId,
      competitionName: 'Classical Vocal (Solo)',
      type: 'SOLO',
      chestNumber: '101',
      status: 'APPROVED',
      registeredAt: new Date().toISOString()
    });

    await db.collection('registrations').doc('reg-gr-solo-02').set({
      id: 'reg-gr-solo-02',
      code: 'REG-GR-102',
      participantId: 'p-gr-102',
      participantName: 'Ahmad Rayan',
      teamId: 'team-2',
      teamCode: 'BSH',
      teamName: 'An-Nawa',
      categoryId: 'cat-senior',
      categoryName: 'Senior',
      competitionId: testCompId,
      competitionName: 'Classical Vocal (Solo)',
      type: 'SOLO',
      chestNumber: '102',
      status: 'APPROVED',
      registeredAt: new Date().toISOString()
    });

    await db.collection('registrations').doc('reg-gr-solo-unapproved').set({
      id: 'reg-gr-solo-unapproved',
      code: 'REG-GR-103',
      participantId: 'p-gr-103',
      participantName: 'Unapproved Student',
      teamId: 'team-3',
      teamCode: 'KAH',
      teamName: 'Al-Ishraq',
      categoryId: 'cat-senior',
      categoryName: 'Senior',
      competitionId: testCompId,
      competitionName: 'Classical Vocal (Solo)',
      type: 'SOLO',
      chestNumber: '103',
      status: 'PENDING',
      registeredAt: new Date().toISOString()
    });

    // 5. Seed Group Competition & Registration
    await db.collection('competitions').doc(testGroupCompId).set({
      id: testGroupCompId,
      code: 'CMP-GR-GRP',
      name: 'Qawwali Ensemble (Group)',
      categoryId: 'cat-senior',
      categoryName: 'Senior',
      type: 'GROUP',
      stageId: 'stg-open',
      stageName: 'Open Air Theatre',
      status: 'SCHEDULED',
      durationMinutes: 90,
      maxEntriesPerTeam: 1,
      criteria: [
        { id: 'cr-harmony', name: 'Harmony & Ensemble Sync', maxMarks: 50 },
        { id: 'cr-performance', name: 'Stage Presence', maxMarks: 50 }
      ],
      createdAt: new Date().toISOString()
    });

    await db.collection('registrations').doc('reg-gr-group-01').set({
      id: 'reg-gr-group-01',
      code: 'REG-GRP-01',
      participantName: 'Al-Shamama Qawwali Troupe',
      teamId: 'team-1',
      teamCode: 'ABH',
      teamName: 'Al-Shamama',
      categoryId: 'cat-senior',
      categoryName: 'Senior',
      competitionId: testGroupCompId,
      competitionName: 'Qawwali Ensemble (Group)',
      type: 'GROUP',
      chestNumber: 'GRP-10',
      groupMembers: ['p-member-1', 'p-member-2', 'p-member-3'],
      status: 'APPROVED',
      registeredAt: new Date().toISOString()
    });

    // 6. Clean any existing green room assignments, mark entries, and counters for test competitions
    const existingSnap = await db.collection('greenRoomAssignments')
      .where('competitionId', 'in', [testCompId, testGroupCompId])
      .get();
    const existingMarks = await db.collection('markEntries')
      .where('competitionId', 'in', [testCompId, testGroupCompId])
      .get();
    const existingJudges = await db.collection('judgeAssignments')
      .where('competitionId', 'in', [testCompId, testGroupCompId])
      .get();

    const batch = db.batch();
    existingSnap.docs.forEach(doc => batch.delete(doc.ref));
    existingMarks.docs.forEach(doc => batch.delete(doc.ref));
    existingJudges.docs.forEach(doc => batch.delete(doc.ref));
    await batch.commit();

    await db.collection('greenRoomCounters').doc(testCompId).delete().catch(() => {});
    await db.collection('greenRoomCounters').doc(testGroupCompId).delete().catch(() => {});
    await db.collection('competitionMarkingLocks').doc(testCompId).delete().catch(() => {});
    await db.collection('competitionMarkingLocks').doc(testGroupCompId).delete().catch(() => {});
    await db.collection('results').doc(`res-${testCompId}`).delete().catch(() => {});
    await db.collection('results').doc(`res-${testGroupCompId}`).delete().catch(() => {});
  });

  afterAll(async () => {
    await db.collection('participants').doc('p-gr-101').delete().catch(() => {});
    await db.collection('participants').doc('p-gr-102').delete().catch(() => {});
    if (clientApp) {
      await deleteClientApp(clientApp).catch(() => {});
    }
  });

  describe('1. QR Payload Generation, Verification & Tamper Resistance', () => {
    it('generates an opaque JSON QR payload with HMAC token and zero leaked names or teams', () => {
      const { token } = QrSignerService.signParticipantQr('p-gr-101', '#101');
      const payload = encodeParticipantQrPayload({
        id: 'p-gr-101',
        bib: '#101',
        token
      });

      const parsed = parseParticipantQrPayload(payload);
      expect(parsed.isValid).toBe(true);
      expect(parsed.format).toBe('JSON_PAYLOAD');
      expect(parsed.participantId).toBe('p-gr-101');
      expect(parsed.bib).toBe('#101');
      expect(typeof parsed.token).toBe('string');
      expect(parsed.token!.length).toBe(64);

      // Verify privacy: raw JSON must not have name or team
      const rawJson = JSON.parse(payload);
      expect(rawJson.name).toBeUndefined();
      expect(rawJson.teamCode).toBeUndefined();
    });

    it('rejects check-in when a QR payload token is forged or tampered with', async () => {
      const tamperedPayload = JSON.stringify({
        app: 'INSPIRATH',
        type: 'PARTICIPANT_ID',
        id: 'p-gr-101',
        bib: '#101',
        token: 'forged_fake_token_000000000000000000000000000000000000000000000000',
        version: 3
      });

      await expect(
        GreenRoomService.checkInContestant({
          competitionId: testCompId,
          participantIdentifier: tamperedPayload,
          operatorIdToken: adminIdToken
        })
      ).rejects.toThrow(/Invalid or tampered QR verification token/);
    });

    it('strictly rejects QR tokens forged using publicly known / client keys or pepper', async () => {
      // Attacker attempts to forge token using publicly guessed pepper from client-side code
      const guessedSecret = 'INSPIRATH_GREEN_ROOM_SECURE_PEPPER_2025';
      const forgedToken = generateQrVerificationToken('p-gr-101', '#101', guessedSecret);
      const forgedPayload = JSON.stringify({
        app: 'INSPIRATH',
        type: 'PARTICIPANT_ID',
        id: 'p-gr-101',
        bib: '#101',
        token: forgedToken,
        version: 3
      });

      await expect(
        GreenRoomService.checkInContestant({
          competitionId: testCompId,
          participantIdentifier: forgedPayload,
          operatorIdToken: adminIdToken
        })
      ).rejects.toThrow(/Invalid or tampered QR verification token/);
    });

    it('accepts legitimate server-signed QR tokens for check-in verification', () => {
      const { token } = QrSignerService.signParticipantQr('p-gr-101', '#101');
      const validPayload = JSON.stringify({
        app: 'INSPIRATH',
        type: 'PARTICIPANT_ID',
        id: 'p-gr-101',
        bib: '#101',
        token,
        version: 3
      });

      const parsed = parseParticipantQrPayload(validPayload);
      expect(parsed.isValid).toBe(true);
      expect(parsed.token).toBe(token);
      expect(QrSignerService.verifyParticipantQrToken('p-gr-101', '#101', token)).toBe(true);
    });

    it('gracefully parses manual string fallbacks', () => {
      const uriResult = parseParticipantQrPayload('INSPIRATH:PARTICIPANT:p-gr-102:#102');
      expect(uriResult.isValid).toBe(true);
      expect(uriResult.format).toBe('URI_STRING');
      expect(uriResult.participantId).toBe('p-gr-102');

      const plainResult = parseParticipantQrPayload('#101');
      expect(plainResult.isValid).toBe(true);
      expect(plainResult.bib).toBe('#101');
    });

    describe('Server-Only Cryptographic QR Issuance API (/api/participants/[id]/qr)', () => {
      it('rejects unauthenticated requests (401)', async () => {
        const req = new NextRequest('http://localhost:3000/api/participants/p-gr-101/qr', {
          method: 'GET'
        });
        const res = await qrIssuanceHandler(req, { params: Promise.resolve({ id: 'p-gr-101' }) });
        expect(res.status).toBe(401);
        const data = await res.json();
        expect(data.error).toMatch(/Authentication token is required/i);
      });

      it('rejects cross-team Team Manager requesting QR for participant of another team (403)', async () => {
        // Team 2 Manager requests QR for p-gr-101 belonging to Team 1
        const req = new NextRequest('http://localhost:3000/api/participants/p-gr-101/qr', {
          method: 'GET',
          headers: { authorization: `Bearer ${team2ManagerToken}` }
        });
        const res = await qrIssuanceHandler(req, { params: Promise.resolve({ id: 'p-gr-101' }) });
        expect(res.status).toBe(403);
        const data = await res.json();
        expect(data.error).toMatch(/Cross-team access denied/i);
      });

      it('allows authorized Team Manager to generate server-signed QR code for their own participant (200)', async () => {
        // Team 1 Manager requests QR for p-gr-101 belonging to Team 1
        const req = new NextRequest('http://localhost:3000/api/participants/p-gr-101/qr', {
          method: 'GET',
          headers: { authorization: `Bearer ${team1ManagerToken}` }
        });
        const res = await qrIssuanceHandler(req, { params: Promise.resolve({ id: 'p-gr-101' }) });
        expect(res.status).toBe(200);
        const data = await res.json();
        expect(data.success).toBe(true);
        expect(data.participantId).toBe('p-gr-101');
        expect(data.bib).toBe('#101');
        expect(typeof data.token).toBe('string');
        expect(data.token.length).toBe(64);
        expect(data.qrPayload).toBeDefined();

        // Verify the issued token validates against server signer
        expect(QrSignerService.verifyParticipantQrToken(data.participantId, data.bib, data.token)).toBe(true);
      });

      it('allows Chief Admin to generate server-signed QR code for any participant (200)', async () => {
        const req = new NextRequest('http://localhost:3000/api/participants/p-gr-102/qr', {
          method: 'GET',
          headers: { authorization: `Bearer ${adminIdToken}` }
        });
        const res = await qrIssuanceHandler(req, { params: Promise.resolve({ id: 'p-gr-102' }) });
        expect(res.status).toBe(200);
        const data = await res.json();
        expect(data.success).toBe(true);
        expect(data.participantId).toBe('p-gr-102');
        expect(QrSignerService.verifyParticipantQrToken(data.participantId, data.bib, data.token)).toBe(true);
      });
    });
  });

  describe('2. GREEN_ROOM_STAFF Role Provisioning, Sync & RBAC', () => {
    it('allows Chief Admin to provision a new Green Room Staff account', async () => {
      const staffEmail = `greenroom.staff.${Date.now()}@sahithyolsav.com`;
      const result = await AuthService.provisionGreenRoomStaff(adminIdToken, {
        email: staffEmail,
        password: 'StaffPassword123!',
        displayName: 'Backstage Officer 1'
      });

      expect(result.uid).toBeDefined();
      expect(result.email).toBe(staffEmail);

      // Verify custom claims and Firestore document
      const userRecord = await adminAuth.getUser(result.uid);
      expect(userRecord.customClaims?.role).toBe('GREEN_ROOM_STAFF');

      const userDoc = await db.collection('users').doc(result.uid).get();
      expect(userDoc.data()?.role).toBe('GREEN_ROOM_STAFF');
      expect(userDoc.data()?.status).toBe('ACTIVE');

      // Authenticate as Staff to acquire real staff token
      const staffCred = await signInWithEmailAndPassword(clientAuth, staffEmail, 'StaffPassword123!');
      staffIdToken = await staffCred.user.getIdToken();
      await signOut(clientAuth);

      // Verify session via AuthService
      const session = await AuthService.verifySession(staffIdToken);
      expect(session.role).toBe('GREEN_ROOM_STAFF');
      await expect(AuthService.assertAdminOrGreenRoom(staffIdToken)).resolves.toBeDefined();
    });

    it('rejects provisioning when email already belongs to an existing account (Conflict Error)', async () => {
      // Attempting to provision using existing Chief Admin email
      await expect(
        AuthService.provisionGreenRoomStaff(adminIdToken, {
          email: 'admin@sahithyolsav.com',
          password: 'NewPassword123!',
          displayName: 'Duplicate Admin'
        })
      ).rejects.toThrow(/Conflict Error: An account with email.*already exists/i);

      // Also verify via HTTP POST endpoint
      const req = new NextRequest('http://localhost:3000/api/admin/green-room/provision-staff', {
        method: 'POST',
        headers: { authorization: `Bearer ${adminIdToken}` },
        body: JSON.stringify({
          email: 'admin@sahithyolsav.com',
          password: 'NewPassword123!',
          displayName: 'Duplicate Admin'
        })
      });
      const res = await provisionStaffHandler(req);
      expect(res.status).toBe(409);
      const data = await res.json();
      expect(data.error).toMatch(/already exists/i);
    });

    it('synchronizes custom claims for GREEN_ROOM_STAFF via POST /api/auth/sync-claims', async () => {
      const req = new NextRequest('http://localhost:3000/api/auth/sync-claims', {
        method: 'POST',
        headers: { authorization: `Bearer ${staffIdToken}` }
      });
      const res = await syncClaimsHandler(req);
      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.role).toBe('GREEN_ROOM_STAFF');
    });

    it('denies non-admin accounts from provisioning Green Room Staff', async () => {
      await expect(
        AuthService.provisionGreenRoomStaff(staffIdToken, {
          email: 'unauthorized@sahithyolsav.com',
          password: 'Password123!',
          displayName: 'Unauthorized'
        })
      ).rejects.toThrow(/Operation requires ADMIN role/);
    });

    it('denies Green Room Staff from executing Admin-only operations (e.g. deleting competitions)', async () => {
      const req = new NextRequest(`http://localhost:3000/api/admin/competitions/${testCompId}`, {
        method: 'DELETE',
        headers: { authorization: `Bearer ${staffIdToken}` }
      });
      const res = await deleteCompetitionHandler(req, { params: Promise.resolve({ id: testCompId }) });
      expect(res.status).toBe(403);
    });
  });

  describe('3. Transactional Code Letter Assignment & Idempotency', () => {
    it('assigns Code Letter A to the first approved participant', async () => {
      const res = await GreenRoomService.checkInContestant({
        competitionId: testCompId,
        participantIdentifier: '101', // Chest number
        operatorIdToken: staffIdToken
      });

      expect(res.success).toBe(true);
      expect(res.isExisting).toBe(false);
      expect(res.assignment.codeLetter).toBe('A');
      expect(res.assignment.codeIndex).toBe(0);
      expect(res.assignment.status).toBe('CHECKED_IN');
      expect(res.assignment.participantName).toBe('Fathima Zahra');
    });

    it('assigns Code Letter B sequentially to the second approved participant', async () => {
      const res = await GreenRoomService.checkInContestant({
        competitionId: testCompId,
        participantIdentifier: 'p-gr-102', // Participant ID
        operatorIdToken: staffIdToken
      });

      expect(res.success).toBe(true);
      expect(res.isExisting).toBe(false);
      expect(res.assignment.codeLetter).toBe('B');
      expect(res.assignment.codeIndex).toBe(1);
    });

    it('IDEMPOTENCY: Repeated scan of the same participant returns existing Code Letter A without duplication', async () => {
      const repeatedRes = await GreenRoomService.checkInContestant({
        competitionId: testCompId,
        participantIdentifier: '101', // Scan again
        operatorIdToken: staffIdToken
      });

      expect(repeatedRes.success).toBe(true);
      expect(repeatedRes.isExisting).toBe(true);
      expect(repeatedRes.assignment.codeLetter).toBe('A');
      expect(repeatedRes.message).toMatch(/already checked in/i);

      // Verify counter in Firestore still contains only 2 assigned codes
      const counterSnap = await db.collection('greenRoomCounters').doc(testCompId).get();
      expect(counterSnap.data()?.assignedCodes).toEqual(['A', 'B']);
    });

    it('rejects check-in for an unapproved (PENDING) registration', async () => {
      await expect(
        GreenRoomService.checkInContestant({
          competitionId: testCompId,
          participantIdentifier: '103', // PENDING registration
          operatorIdToken: staffIdToken
        })
      ).rejects.toThrow(/Only APPROVED registrations can be checked into the Green Room/);
    });

    it('rejects check-in for a contestant not registered for this competition', async () => {
      await expect(
        GreenRoomService.checkInContestant({
          competitionId: testCompId,
          participantIdentifier: 'non-existent-contestant-999',
          operatorIdToken: staffIdToken
        })
      ).rejects.toThrow(/Eligibility Error/);
    });
  });

  describe('4. Group Competition Support', () => {
    it('assigns ONE Code Letter to the group registration when a group member is scanned', async () => {
      const res = await GreenRoomService.checkInContestant({
        competitionId: testGroupCompId,
        participantIdentifier: 'p-member-2', // Group member ID
        operatorIdToken: staffIdToken
      });

      expect(res.success).toBe(true);
      expect(res.assignment.type).toBe('GROUP');
      expect(res.assignment.codeLetter).toBe('A');
      expect(res.assignment.participantName).toBe('Al-Shamama Qawwali Troupe');

      // Scanning another group member of the same troupe returns the identical Code Letter A
      const secondMemberScan = await GreenRoomService.checkInContestant({
        competitionId: testGroupCompId,
        participantIdentifier: 'p-member-3',
        operatorIdToken: staffIdToken
      });

      expect(secondMemberScan.isExisting).toBe(true);
      expect(secondMemberScan.assignment.codeLetter).toBe('A');
    });
  });

  describe('5. Safe Code Reassignment & Audit Trail', () => {
    it('reassigns Code Letter with mandatory reason and writes permanent audit log', async () => {
      const updated = await GreenRoomService.reassignCodeLetter({
        competitionId: testCompId,
        registrationId: 'reg-gr-solo-01',
        newCodeLetter: 'C',
        reason: 'Misplaced entry slip reported backstage',
        operatorIdToken: staffIdToken
      });

      expect(updated.codeLetter).toBe('C');
      expect(updated.reassignedFrom).toBe('A');
      expect(updated.reassignmentReason).toBe('Misplaced entry slip reported backstage');

      // Verify audit log exists in auditLogs collection
      const auditSnap = await db.collection('auditLogs')
        .where('action', '==', 'GREEN_ROOM_CODE_REASSIGNED')
        .where('targetDocId', '==', `${testCompId}_reg-gr-solo-01`)
        .get();

      expect(auditSnap.empty).toBe(false);
      const audit = auditSnap.docs[0].data();
      expect(audit.details.oldCode).toBe('A');
      expect(audit.details.newCode).toBe('C');
    });

    it('rejects reassignment to an already occupied Code Letter (Conflict Error)', async () => {
      await expect(
        GreenRoomService.reassignCodeLetter({
          competitionId: testCompId,
          registrationId: 'reg-gr-solo-01',
          newCodeLetter: 'B', // Already assigned to reg-gr-solo-02
          reason: 'Attempted duplicate swap',
          operatorIdToken: staffIdToken
        })
      ).rejects.toThrow(/already in use/i);
    });
  });

  describe('6. Anonymous Judge Login & Marking Security Resolution', () => {
    let judgeAccessCode = 'JRY-GR-TEST';
    let judgeSecret = 'jury1234';
    let assignmentId = 'asgn-gr-test';

    beforeAll(async () => {
      const salt = 'random_salt_gr_test';
      const { hashSecret } = await import('@/domain/judgeAuth');
      const secretHash = await hashSecret(judgeSecret, salt);
      const now = new Date();

      await db.collection('judgeAssignments').doc(assignmentId).set({
        id: assignmentId,
        judgeName: 'Dr. Music Adjudicator',
        judgePhone: '+91 99999 00000',
        competitionId: testCompId,
        competitionCode: 'CMP-GR-01',
        competitionName: 'Classical Vocal (Solo)',
        categoryName: 'Senior',
        type: 'SOLO',
        stageName: 'Main Auditorium',
        accessCode: judgeAccessCode,
        secretHash,
        salt,
        issuedAt: now.toISOString(),
        expiresAt: new Date(now.getTime() + 24 * 3600 * 1000).toISOString(),
        revoked: false,
        status: 'ACTIVE'
      });
    });

    it('POST /api/judge/login returns ONLY anonymous Code Letters (ZERO names, teams, or chest numbers)', async () => {
      const req = new NextRequest('http://localhost:3000/api/judge/login', {
        method: 'POST',
        body: JSON.stringify({
          accessCode: judgeAccessCode,
          competitionId: testCompId,
          secret: judgeSecret
        })
      });

      const res = await judgeLoginHandler(req);
      expect(res.status).toBe(200);
      const data = await res.json();

      expect(data.success).toBe(true);
      expect(data.contestants).toBeDefined();
      expect(data.contestants.length).toBeGreaterThanOrEqual(2);

      // Verify zero personal identity leakage in contestants array
      data.contestants.forEach((c: any) => {
        expect(c.codeLetter).toBeDefined();
        expect(c.participantName).toBeUndefined();
        expect(c.name).toBeUndefined();
        expect(c.teamName).toBeUndefined();
        expect(c.teamCode).toBeUndefined();
        expect(c.chestNumber).toBeUndefined();
        expect(c.bib).toBeUndefined();
        expect(c.photoUrl).toBeUndefined();
      });
    });

    it('rejects participant IDs as score submission keys', async () => {
      await expect(
        JudgeService.submitMarks({
          assignmentId,
          competitionId: testCompId,
          secret: judgeSecret,
          scores: {
            'p-gr-101': { 'cr-pitch': 30, 'cr-expression': 30, 'cr-diction': 20 }
          }
        })
      ).rejects.toThrow(/direct contestant identifier.*strictly rejected/i);
    });

    it('rejects registration IDs as score submission keys', async () => {
      await expect(
        JudgeService.submitMarks({
          assignmentId,
          competitionId: testCompId,
          secret: judgeSecret,
          scores: {
            'reg-gr-solo-01': { 'cr-pitch': 30, 'cr-expression': 30, 'cr-diction': 20 }
          }
        })
      ).rejects.toThrow(/direct contestant identifier.*strictly rejected/i);
    });

    it('rejects bib numbers as score submission keys', async () => {
      await expect(
        JudgeService.submitMarks({
          assignmentId,
          competitionId: testCompId,
          secret: judgeSecret,
          scores: {
            '#101': { 'cr-pitch': 30, 'cr-expression': 30, 'cr-diction': 20 }
          }
        })
      ).rejects.toThrow(/not a valid assigned Green Room Code Letter/i);
    });

    it('rejects chest numbers as score submission keys', async () => {
      await expect(
        JudgeService.submitMarks({
          assignmentId,
          competitionId: testCompId,
          secret: judgeSecret,
          scores: {
            '101': { 'cr-pitch': 30, 'cr-expression': 30, 'cr-diction': 20 }
          }
        })
      ).rejects.toThrow(/direct contestant identifier.*strictly rejected/i);
    });

    it('rejects unassigned Code Letters as score submission keys', async () => {
      await expect(
        JudgeService.submitMarks({
          assignmentId,
          competitionId: testCompId,
          secret: judgeSecret,
          scores: {
            'Z': { 'cr-pitch': 30, 'cr-expression': 30, 'cr-diction': 20 }
          }
        })
      ).rejects.toThrow(/not a valid assigned Green Room Code Letter/i);
    });

    it('rejects invalid score keys in draft mark saves as well', async () => {
      await expect(
        JudgeService.saveDraftMarks({
          assignmentId,
          competitionId: testCompId,
          secret: judgeSecret,
          scores: {
            'p-gr-101': { 'cr-pitch': 30 }
          }
        })
      ).rejects.toThrow(/direct contestant identifier.*strictly rejected/i);
    });

    it('Judge submits scores using anonymous Code Letters; server resolves accurately to registrationId', async () => {
      // Judge evaluates Code Letter B (Ahmad Rayan) and Code Letter C (Fathima Zahra)
      const judgeScores = {
        'B': {
          'cr-pitch': 38,
          'cr-expression': 32,
          'cr-diction': 24
        }, // Total 94
        'C': {
          'cr-pitch': 32,
          'cr-expression': 30,
          'cr-diction': 20
        } // Total 82
      };

      const result = await JudgeService.submitMarks({
        assignmentId,
        competitionId: testCompId,
        secret: judgeSecret,
        scores: judgeScores
      });

      expect(result.success).toBe(true);
      expect(result.marksRecorded).toBe(2);
      expect(result.verificationHash).toMatch(/^SHA256:/);

      // Verify the persisted markEntry has normalized registration IDs (NOT raw code letters)
      const markSnap = await db.collection('markEntries').doc(`me-${assignmentId}`).get();
      const markData = markSnap.data();
      expect(markData?.status).toBe('SUBMITTED');
      expect(markData?.scores['reg-gr-solo-02']).toBeDefined(); // Code B resolved to reg-gr-solo-02
      expect(markData?.scores['reg-gr-solo-01']).toBeDefined(); // Code C resolved to reg-gr-solo-01

      // Verify official result calculation in results collection
      const resSnap = await db.collection('results').doc(`res-${testCompId}`).get();
      expect(resSnap.exists).toBe(true);
      const resData = resSnap.data();
      expect(resData?.resultStatus).toBe('READY_FOR_REVIEW');

      // Rank 1: Ahmad Rayan (Score 94, Grade A+)
      expect(resData?.ranks[0].candidateName).toBe('Ahmad Rayan');
      expect(resData?.ranks[0].score).toBe(94);
      expect(resData?.ranks[0].grade).toBe('A+');
      expect(resData?.ranks[0].rank).toBe(1);

      // Rank 2: Fathima Zahra (Score 82, Grade A)
      expect(resData?.ranks[1].candidateName).toBe('Fathima Zahra');
      expect(resData?.ranks[1].score).toBe(82);
      expect(resData?.ranks[1].grade).toBe('A');
      expect(resData?.ranks[1].rank).toBe(2);
    });
  });

  describe('7. Code Reassignment Lock Protection & Concurrency Safeguards', () => {
    it('strictly locks Code Letter reassignment once judge marks or results exist (Lock Error)', async () => {
      // testCompId now has submitted marks and official results generated in previous test
      await expect(
        GreenRoomService.reassignCodeLetter({
          competitionId: testCompId,
          registrationId: 'reg-gr-solo-01',
          newCodeLetter: 'D',
          reason: 'Attempted reassignment after judging completed',
          operatorIdToken: staffIdToken
        })
      ).rejects.toThrow(/Lock Error: Code Letter reassignment is locked/i);
    });

    it('returns HTTP 423 Locked when reassignment is attempted via API on an evaluated competition', async () => {
      const { POST: reassignHandler } = await import('@/app/api/admin/green-room/reassign/route');
      const req = new NextRequest('http://localhost:3000/api/admin/green-room/reassign', {
        method: 'POST',
        headers: { authorization: `Bearer ${staffIdToken}` },
        body: JSON.stringify({
          competitionId: testCompId,
          registrationId: 'reg-gr-solo-01',
          newCodeLetter: 'D',
          reason: 'Late swap attempt'
        })
      });

      const res = await reassignHandler(req);
      expect(res.status).toBe(423);
      const data = await res.json();
      expect(data.error).toMatch(/Lock Error/i);
    });

    it('draft mark saves atomically set competition-level marking lock and block subsequent reassignment', async () => {
      const draftCompId = 'cmp-draft-lock-test';
      const draftAsgnId = 'asgn-draft-lock-test';
      const draftSecret = 'draft1234';

      await db.collection('competitions').doc(draftCompId).set({
        id: draftCompId,
        code: 'CMP-DRAFT',
        name: 'Draft Marking Lock Test Stage',
        categoryId: 'cat-senior',
        categoryName: 'Senior',
        type: 'SOLO',
        criteria: [{ id: 'cr-draft-1', name: 'Technique', maxMarks: 50 }],
        createdAt: new Date().toISOString()
      });

      await db.collection('registrations').doc('reg-draft-01').set({
        id: 'reg-draft-01',
        competitionId: draftCompId,
        participantId: 'p-draft-01',
        participantName: 'Draft Contestant 1',
        status: 'APPROVED',
        chestNumber: 'DRF-1',
        registeredAt: new Date().toISOString()
      });

      // Check contestant into Green Room (assigned Code A)
      await GreenRoomService.checkInContestant({
        competitionId: draftCompId,
        participantIdentifier: 'DRF-1',
        operatorIdToken: staffIdToken
      });

      const { hashSecret } = await import('@/domain/judgeAuth');
      const secretHash = await hashSecret(draftSecret, 'salt_draft');
      await db.collection('judgeAssignments').doc(draftAsgnId).set({
        id: draftAsgnId,
        judgeName: 'Draft Juror',
        competitionId: draftCompId,
        accessCode: 'JRY-DRAFT-TEST',
        secretHash,
        salt: 'salt_draft',
        status: 'ACTIVE'
      });

      // Judge saves draft marks for Code A
      const draftResult = await JudgeService.saveDraftMarks({
        assignmentId: draftAsgnId,
        competitionId: draftCompId,
        secret: draftSecret,
        scores: { 'A': { 'cr-draft-1': 45 } }
      });
      expect(draftResult.success).toBe(true);

      // Verify competition-level marking lock document is atomically written
      const lockDoc = await db.collection('competitionMarkingLocks').doc(draftCompId).get();
      expect(lockDoc.exists).toBe(true);
      expect(lockDoc.data()?.locked).toBe(true);
      expect(lockDoc.data()?.markingStarted).toBe(true);

      // Now GreenRoomService.reassignCodeLetter must be strictly rejected
      await expect(
        GreenRoomService.reassignCodeLetter({
          competitionId: draftCompId,
          registrationId: 'reg-draft-01',
          newCodeLetter: 'E',
          reason: 'Attempted reassignment after draft marked',
          operatorIdToken: staffIdToken
        })
      ).rejects.toThrow(/Lock Error: Code Letter reassignment is locked/i);
    });

    it('concurrent race protection: judge scoring is blocked while Code Letter reassignment is in progress', async () => {
      const concCompId = 'cmp-conc-race-test';
      const concAsgnId = 'asgn-conc-race-test';
      const concSecret = 'race1234';

      await db.collection('competitions').doc(concCompId).set({
        id: concCompId,
        code: 'CMP-RACE',
        name: 'Race Protection Test Stage',
        categoryId: 'cat-senior',
        categoryName: 'Senior',
        type: 'SOLO',
        criteria: [{ id: 'cr-race-1', name: 'Form', maxMarks: 50 }],
        createdAt: new Date().toISOString()
      });

      await db.collection('registrations').doc('reg-race-01').set({
        id: 'reg-race-01',
        competitionId: concCompId,
        participantId: 'p-race-01',
        participantName: 'Race Contestant 1',
        status: 'APPROVED',
        chestNumber: 'RC-1',
        registeredAt: new Date().toISOString()
      });

      await GreenRoomService.checkInContestant({
        competitionId: concCompId,
        participantIdentifier: 'RC-1',
        operatorIdToken: staffIdToken
      });

      const { hashSecret } = await import('@/domain/judgeAuth');
      const secretHash = await hashSecret(concSecret, 'salt_race');
      await db.collection('judgeAssignments').doc(concAsgnId).set({
        id: concAsgnId,
        judgeName: 'Race Juror',
        competitionId: concCompId,
        accessCode: 'JRY-RACE-TEST',
        secretHash,
        salt: 'salt_race',
        status: 'ACTIVE'
      });

      // Simulate atomic lock state where reassignment is currently in progress
      await db.collection('competitionMarkingLocks').doc(concCompId).set({
        competitionId: concCompId,
        locked: false,
        markingStarted: false,
        reassignmentInProgress: true,
        updatedAt: new Date().toISOString()
      });

      // Attempting to save draft marks while reassignment is in progress throws Lock Error
      await expect(
        JudgeService.saveDraftMarks({
          assignmentId: concAsgnId,
          competitionId: concCompId,
          secret: concSecret,
          scores: { 'A': { 'cr-race-1': 40 } }
        })
      ).rejects.toThrow(/Lock Conflict: Code Letter reassignment is currently in progress/i);

      // Attempting to submit marks while reassignment is in progress throws Lock Error
      await expect(
        JudgeService.submitMarks({
          assignmentId: concAsgnId,
          competitionId: concCompId,
          secret: concSecret,
          scores: { 'A': { 'cr-race-1': 40 } }
        })
      ).rejects.toThrow(/Lock Conflict: Code Letter reassignment is currently in progress/i);

      // Settle reassignment
      await db.collection('competitionMarkingLocks').doc(concCompId).update({
        reassignmentInProgress: false
      });

      // Judge can now proceed safely
      const finalRes = await JudgeService.submitMarks({
        assignmentId: concAsgnId,
        competitionId: concCompId,
        secret: concSecret,
        scores: { 'A': { 'cr-race-1': 42 } }
      });
      expect(finalRes.success).toBe(true);
    });
  });

  describe('8. Absent Green Room Assignments & Strict Judge PIN Verification', () => {
    const emptyCompId = 'cmp-gr-empty-test';
    const emptyJudgeCode = 'JRY-EMPTY-TEST';
    const emptySecret = 'pass5678';
    const emptyAsgnId = 'asgn-gr-empty-test';

    beforeAll(async () => {
      await db.collection('competitions').doc(emptyCompId).set({
        id: emptyCompId,
        code: 'CMP-EMPTY',
        name: 'Empty Stage Competition',
        categoryId: 'cat-senior',
        categoryName: 'Senior',
        type: 'SOLO',
        criteria: [{ id: 'cr-1', name: 'General', maxMarks: 100 }],
        createdAt: new Date().toISOString()
      });

      // Seed unapproved and approved registrations without checking them into Green Room
      await db.collection('registrations').doc('reg-empty-01').set({
        id: 'reg-empty-01',
        competitionId: emptyCompId,
        participantName: 'Unchecked Participant',
        status: 'APPROVED'
      });

      const { hashSecret } = await import('@/domain/judgeAuth');
      const secretHash = await hashSecret(emptySecret, 'salt_empty');
      await db.collection('judgeAssignments').doc(emptyAsgnId).set({
        id: emptyAsgnId,
        judgeName: 'Juror Empty',
        competitionId: emptyCompId,
        accessCode: emptyJudgeCode,
        secretHash,
        salt: 'salt_empty',
        status: 'ACTIVE'
      });
    });

    it('rejects Judge login without secret when credentials exist (401)', async () => {
      const req = new NextRequest('http://localhost:3000/api/judge/login', {
        method: 'POST',
        body: JSON.stringify({
          accessCode: emptyJudgeCode,
          competitionId: emptyCompId
          // secret omitted
        })
      });

      const res = await judgeLoginHandler(req);
      expect(res.status).toBe(401);
      const data = await res.json();
      expect(data.error).toMatch(/Juror PIN or Secret is required/i);
    });

    it('rejects Judge login with wrong secret (401)', async () => {
      const req = new NextRequest('http://localhost:3000/api/judge/login', {
        method: 'POST',
        body: JSON.stringify({
          accessCode: emptyJudgeCode,
          competitionId: emptyCompId,
          secret: 'wrong-secret'
        })
      });

      const res = await judgeLoginHandler(req);
      expect(res.status).toBe(401);
    });

    it('returns empty contestants array when no Green Room check-ins exist (ZERO fallback codes)', async () => {
      const req = new NextRequest('http://localhost:3000/api/judge/login', {
        method: 'POST',
        body: JSON.stringify({
          accessCode: emptyJudgeCode,
          competitionId: emptyCompId,
          secret: emptySecret
        })
      });

      const res = await judgeLoginHandler(req);
      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.contestants).toEqual([]);
    });

    it('rejects Judge scoring when contestant Code Letter has not been checked in to Green Room', async () => {
      await expect(
        JudgeService.submitMarks({
          assignmentId: emptyAsgnId,
          competitionId: emptyCompId,
          secret: emptySecret,
          scores: { 'A': { 'cr-1': 85 } }
        })
      ).rejects.toThrow(/Validation Error.*(No contestants have checked in|"A")/i);
    });
  });

  describe('9. High-Concurrency Transactional Check-ins', () => {
    const concurrentCompId = 'cmp-gr-concurrent-test';

    beforeAll(async () => {
      await db.collection('competitions').doc(concurrentCompId).set({
        id: concurrentCompId,
        code: 'CMP-CONC',
        name: 'Concurrent Stage Check-in Test',
        categoryId: 'cat-senior',
        categoryName: 'Senior',
        type: 'SOLO',
        criteria: [{ id: 'cr-1', name: 'General', maxMarks: 100 }],
        createdAt: new Date().toISOString()
      });

      // Seed 4 approved registrations
      for (let i = 1; i <= 4; i++) {
        await db.collection('registrations').doc(`reg-conc-${i}`).set({
          id: `reg-conc-${i}`,
          competitionId: concurrentCompId,
          participantId: `part-conc-${i}`,
          chestNumber: `CONC-${i}`,
          status: 'APPROVED',
          registeredAt: new Date().toISOString()
        });
      }
    });

    it('allocates distinct, non-colliding Code Letters under concurrent load', async () => {
      const checkInPromises = [1, 2, 3, 4].map(i =>
        GreenRoomService.checkInContestant({
          competitionId: concurrentCompId,
          participantIdentifier: `CONC-${i}`,
          operatorIdToken: staffIdToken
        })
      );

      const results = await Promise.all(checkInPromises);
      const assignedCodes = results.map(r => r.assignment.codeLetter);

      // Verify all 4 succeeded
      results.forEach(r => expect(r.success).toBe(true));

      // Verify 4 unique code letters were assigned without collision
      const uniqueCodes = new Set(assignedCodes);
      expect(uniqueCodes.size).toBe(4);
      expect(uniqueCodes).toEqual(new Set(['A', 'B', 'C', 'D']));

      // Verify counter document matches exactly
      const counterSnap = await db.collection('greenRoomCounters').doc(concurrentCompId).get();
      expect(counterSnap.data()?.totalCheckedIn).toBe(4);
      expect(counterSnap.data()?.assignedCodes).toHaveLength(4);
    });
  });

  describe('10. Competition Cascade Deletion of Green Room Records', () => {
    const cascadeCompId = 'cmp-gr-cascade-test';

    beforeAll(async () => {
      await db.collection('competitions').doc(cascadeCompId).set({
        id: cascadeCompId,
        code: 'CMP-CASCADE',
        name: 'Cascade Deletion Target',
        categoryId: 'cat-senior',
        categoryName: 'Senior',
        type: 'SOLO',
        createdAt: new Date().toISOString()
      });

      await db.collection('registrations').doc('reg-cascade-01').set({
        id: 'reg-cascade-01',
        competitionId: cascadeCompId,
        participantId: 'part-cascade-01',
        chestNumber: 'CAS-01',
        status: 'APPROVED'
      });

      // Check contestant into Green Room
      await GreenRoomService.checkInContestant({
        competitionId: cascadeCompId,
        participantIdentifier: 'CAS-01',
        operatorIdToken: adminIdToken
      });

      // Verify assignment and counter exist prior to deletion
      const asgnSnap = await db.collection('greenRoomAssignments')
        .where('competitionId', '==', cascadeCompId)
        .get();
      expect(asgnSnap.empty).toBe(false);

      const counterSnap = await db.collection('greenRoomCounters').doc(cascadeCompId).get();
      expect(counterSnap.exists).toBe(true);

      // Seed marking lock to verify cascade deletion
      await db.collection('competitionMarkingLocks').doc(cascadeCompId).set({
        competitionId: cascadeCompId,
        locked: false,
        markingStarted: false,
        updatedAt: new Date().toISOString()
      });
    });

    it('deletes Green Room assignments and counters for target competition without affecting other competitions', async () => {
      // Ensure group competition records still exist
      const groupBeforeSnap = await db.collection('greenRoomAssignments')
        .where('competitionId', '==', testGroupCompId)
        .get();
      expect(groupBeforeSnap.empty).toBe(false);

      // Delete cascadeCompId via DELETE /api/admin/competitions/[id]
      const req = new NextRequest(`http://localhost:3000/api/admin/competitions/${cascadeCompId}`, {
        method: 'DELETE',
        headers: { authorization: `Bearer ${adminIdToken}` }
      });

      const res = await deleteCompetitionHandler(req, { params: Promise.resolve({ id: cascadeCompId }) });
      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.success).toBe(true);
      expect(data.cascadeDeleted.greenRoomAssignments).toBeGreaterThanOrEqual(1);
      expect(data.cascadeDeleted.greenRoomCounters).toBe(1);
      expect(data.cascadeDeleted.competitionMarkingLocks).toBe(1);

      // Verify target competition Green Room records are wiped
      const targetAsgnSnap = await db.collection('greenRoomAssignments')
        .where('competitionId', '==', cascadeCompId)
        .get();
      expect(targetAsgnSnap.empty).toBe(true);

      const targetCounterSnap = await db.collection('greenRoomCounters').doc(cascadeCompId).get();
      expect(targetCounterSnap.exists).toBe(false);

      const targetLockSnap = await db.collection('competitionMarkingLocks').doc(cascadeCompId).get();
      expect(targetLockSnap.exists).toBe(false);

      // Verify isolated competition records are preserved
      const groupAfterSnap = await db.collection('greenRoomAssignments')
        .where('competitionId', '==', testGroupCompId)
        .get();
      expect(groupAfterSnap.empty).toBe(false);

      const groupCounterSnap = await db.collection('greenRoomCounters').doc(testGroupCompId).get();
      expect(groupCounterSnap.exists).toBe(true);
    });
  });
});
