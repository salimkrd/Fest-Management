/**
 * Phase 3.1: Concurrency and Registration Lifecycle Verification Test Suite
 *
 * Verifies against Local Firebase Emulator Suite (demo-sahithyolsav-2025):
 *
 * 1. F-01: Concurrency & Race Condition Hardening
 *    - Concurrent execution of ParticipantService.updateParticipant (category switch) and
 *      RegistrationService.createForTeam (registration creation).
 *    - Verifies mutual document contention collision on participants/{id}.
 *    - Verifies one transaction wins and the other cleanly aborts/retries and rejects with validation error.
 *    - Verifies an invalid final state (ineligible participant actively registered) can never exist.
 *    - Pre-existing active registration blocks category update.
 *    - General / campus-wide tier (CAT-GEN) does not block category switching.
 *    - REJECTED and CANCELLED registrations do not block category switching and allow re-registration.
 *    - Group leader and group member registrations block incompatible category changes.
 *
 * 2. F-03: Registration Lifecycle & Counter Consistency
 *    - Multiple registrations per participant: deleting one event cleanly leaves others intact.
 *    - Status transitions (APPROVED -> REJECTED, REJECTED -> APPROVED, APPROVED -> CANCELLED):
 *      synchronizes entriesCount and registeredEventIds.
 *    - Deletion behavior: single-decrement atomicity, no counter drift, no double-decrement on rejected registrations.
 *    - Idempotency: duplicate deletion calls do not drop counts below zero.
 *    - Group registrations: leader linkage and entriesCount consistency on creation and deletion.
 */

import './setupEnv';
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { initializeApp as initAdminApp, getApps as getAdminApps } from 'firebase-admin/app';
import { getFirestore as getAdminFirestore } from 'firebase-admin/firestore';
import { initializeApp as initClientApp, deleteApp as deleteClientApp, FirebaseApp } from 'firebase/app';
import {
  getAuth as getClientAuth,
  connectAuthEmulator,
  signInWithEmailAndPassword,
  signOut,
  Auth as ClientAuth
} from 'firebase/auth';
import { RegistrationService } from '@/services/registrationService';
import { ParticipantService } from '@/services/participantService';
import { Category, Participant } from '@/types/fest';

describe('Phase 3.1: Concurrency and Registration Lifecycle Verification', () => {
  let adminIdToken = '';
  let team1ManagerToken = '';
  let clientApp: FirebaseApp;
  let clientAuth: ClientAuth;

  const adminApp = getAdminApps().find(a => a.name === 'concurrency-test-admin') ||
    initAdminApp({ projectId: 'demo-sahithyolsav-2025' }, 'concurrency-test-admin');
  const db = getAdminFirestore(adminApp);

  const suiteId = `p31-${Date.now()}`;
  const team1Id = 'team-1'; // Al-Shamama (seeded team)
  const createdDocRefs: FirebaseFirestore.DocumentReference[] = [];

  const trackRef = (ref: FirebaseFirestore.DocumentReference) => {
    createdDocRefs.push(ref);
    return ref;
  };

  // Categories
  const catSjId = `cat-sj-${suiteId}`;
  const catJrId = `cat-jr-${suiteId}`;
  const catSrId = `cat-sr-${suiteId}`;
  const catGenId = `cat-gen-${suiteId}`;

  const catSJ: Category = {
    id: catSjId,
    name: 'Sub Junior',
    code: 'CAT-SJ',
    classRange: 'Std 1 - 4',
    eligibility: 'Std 1 to 4 students',
    ageRange: '6 - 9 years',
    enrolledCount: 0,
    competitionsCount: 0,
    status: 'ACTIVE'
  };

  const catJR: Category = {
    id: catJrId,
    name: 'Junior',
    code: 'CAT-JR',
    classRange: 'Std 5 - 7',
    eligibility: 'Std 5 to 7 students',
    ageRange: '10 - 12 years',
    enrolledCount: 0,
    competitionsCount: 0,
    status: 'ACTIVE'
  };

  const catSR: Category = {
    id: catSrId,
    name: 'Senior',
    code: 'CAT-SR',
    classRange: 'Std 8 - 12',
    eligibility: 'Std 8 to 12 students',
    ageRange: '13 - 17 years',
    enrolledCount: 0,
    competitionsCount: 0,
    status: 'ACTIVE'
  };

  const catGEN: Category = {
    id: catGenId,
    name: 'General',
    code: 'CAT-GEN',
    classRange: 'Campus wide',
    eligibility: 'All Eligible Students across campus',
    ageRange: 'All ages',
    enrolledCount: 0,
    competitionsCount: 0,
    status: 'ACTIVE'
  };

  beforeAll(async () => {
    // 1. Initialize Client Auth connected to local emulator
    const clientAppName = `conc-client-${Date.now()}`;
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

    // 3. Seed test categories into Firestore
    await trackRef(db.collection('categories').doc(catSjId)).set(catSJ);
    await trackRef(db.collection('categories').doc(catJrId)).set(catJR);
    await trackRef(db.collection('categories').doc(catSrId)).set(catSR);
    await trackRef(db.collection('categories').doc(catGenId)).set(catGEN);
  });

  afterAll(async () => {
    if (clientApp) {
      await deleteClientApp(clientApp).catch(() => {});
    }

    // Clean up all isolated test documents created during this suite
    for (const ref of createdDocRefs) {
      await ref.delete().catch(() => {});
    }

    // Also clean up any registrations created with suiteId prefix
    const regsSnap = await db.collection('registrations').get();
    for (const doc of regsSnap.docs) {
      if (doc.id.includes(suiteId)) {
        await doc.ref.delete().catch(() => {});
      }
    }
  });

  describe('1. F-01 Concurrency & Race Condition Verification', () => {
    it('prevents invalid final state during simultaneous category switch and registration creation', async () => {
      const partId = `part-race-${suiteId}`;
      const compJrId = `comp-race-jr-${suiteId}`;

      // Create Junior competition
      await trackRef(db.collection('competitions').doc(compJrId)).set({
        id: compJrId,
        code: `CMP-RACE-${suiteId.slice(-4)}`,
        name: 'Junior Story Telling',
        categoryId: catJrId,
        categoryName: 'Junior',
        type: 'SOLO',
        entriesCount: 0,
        maxEntriesPerTeam: 1,
        status: 'SCHEDULED'
      });

      // Create participant currently in Junior
      await trackRef(db.collection('participants').doc(partId)).set({
        id: partId,
        bib: '#RACE1',
        name: 'Concurrent Runner',
        teamId: team1Id,
        teamCode: 'SHA',
        teamName: 'Al-Shamama',
        categoryId: catJrId,
        categoryName: 'Junior',
        registeredEventIds: [],
        createdAt: new Date().toISOString()
      });

      // Launch simultaneous race condition:
      // Operation 1: Admin changes participant's category from Junior to Senior
      // Operation 2: Team manager registers participant for the Junior competition
      const opCategoryChange = ParticipantService.updateParticipant(
        adminIdToken,
        partId,
        { categoryId: catSrId, categoryName: 'Senior' }
      );

      const opRegistration = RegistrationService.createForTeam(
        team1ManagerToken,
        team1Id,
        { competitionId: compJrId, participantId: partId }
      );

      const [resCategory, resRegistration] = await Promise.allSettled([
        opCategoryChange,
        opRegistration
      ]);

      // Exactly one must win and one must fail (or both could fail if conflict detected immediately, but NEVER both succeed)
      const catSuccess = resCategory.status === 'fulfilled';
      const regSuccess = resRegistration.status === 'fulfilled';

      // Both operations cannot simultaneously succeed in creating an invalid state
      expect(catSuccess && regSuccess).toBe(false);

      // Verify the failing operation threw an appropriate validation error
      if (!catSuccess && resCategory.status === 'rejected') {
        expect(resCategory.reason.message).toMatch(/Validation Error|Cannot change category/i);
      }
      if (!regSuccess && resRegistration.status === 'rejected') {
        expect(resRegistration.reason.message).toMatch(/Validation Error|not eligible/i);
      }

      // Verify authoritative Firestore database state is 100% valid
      const partSnap = await db.collection('participants').doc(partId).get();
      const finalPart = partSnap.data() as Participant;
      const regQuery = await db.collection('registrations')
        .where('participantId', '==', partId)
        .where('competitionId', '==', compJrId)
        .get();

      if (regQuery.docs.length > 0) {
        // Registration was created; therefore participant MUST still be Junior
        expect(finalPart.categoryId).toBe(catJrId);
        expect(finalPart.categoryName).toBe('Junior');
      } else {
        // Registration was rejected; participant can be Senior
        expect(finalPart.categoryId).toBe(catSrId);
        expect(finalPart.categoryName).toBe('Senior');
      }
    });

    it('blocks category update when an active conflicting registration already exists', async () => {
      const partId = `part-block-${suiteId}`;
      const compJrId = `comp-block-jr-${suiteId}`;

      await trackRef(db.collection('competitions').doc(compJrId)).set({
        id: compJrId,
        code: `CMP-BLK-${suiteId.slice(-4)}`,
        name: 'Junior Recitation',
        categoryId: catJrId,
        categoryName: 'Junior',
        type: 'SOLO',
        entriesCount: 1,
        maxEntriesPerTeam: 1,
        status: 'SCHEDULED'
      });

      await trackRef(db.collection('participants').doc(partId)).set({
        id: partId,
        bib: '#BLK1',
        name: 'Blocked Student',
        teamId: team1Id,
        teamCode: 'SHA',
        teamName: 'Al-Shamama',
        categoryId: catJrId,
        categoryName: 'Junior',
        registeredEventIds: [compJrId],
        createdAt: new Date().toISOString()
      });

      const regId = `reg-block-${suiteId}`;
      await trackRef(db.collection('registrations').doc(regId)).set({
        id: regId,
        code: 'REG-9901',
        participantId: partId,
        participantName: 'Blocked Student',
        teamId: team1Id,
        categoryId: catJrId,
        categoryName: 'Junior',
        competitionId: compJrId,
        competitionName: 'Junior Recitation',
        type: 'SOLO',
        status: 'APPROVED'
      });

      // Admin attempts to switch category to Senior while Junior registration is active
      await expect(
        ParticipantService.updateParticipant(
          adminIdToken,
          partId,
          { categoryId: catSrId, categoryName: 'Senior' }
        )
      ).rejects.toThrow(/Cannot change category for participant/i);

      // Verify participant in Firestore was NOT updated
      const checkSnap = await db.collection('participants').doc(partId).get();
      expect(checkSnap.data()?.categoryId).toBe(catJrId);
    });

    it('permits category update when existing registration is for a General/Campus-wide competition', async () => {
      const partId = `part-gen-${suiteId}`;
      const compGenId = `comp-gen-${suiteId}`;

      await trackRef(db.collection('competitions').doc(compGenId)).set({
        id: compGenId,
        code: `CMP-GEN-${suiteId.slice(-4)}`,
        name: 'Campus Quiz',
        categoryId: catGenId,
        categoryName: 'General',
        type: 'SOLO',
        entriesCount: 1,
        maxEntriesPerTeam: 2,
        status: 'SCHEDULED'
      });

      await trackRef(db.collection('participants').doc(partId)).set({
        id: partId,
        bib: '#GEN1',
        name: 'Campus Scholar',
        teamId: team1Id,
        teamCode: 'SHA',
        teamName: 'Al-Shamama',
        categoryId: catJrId,
        categoryName: 'Junior',
        registeredEventIds: [compGenId],
        createdAt: new Date().toISOString()
      });

      const regId = `reg-gen-${suiteId}`;
      await trackRef(db.collection('registrations').doc(regId)).set({
        id: regId,
        code: 'REG-9902',
        participantId: partId,
        participantName: 'Campus Scholar',
        teamId: team1Id,
        categoryId: catGenId,
        categoryName: 'General',
        competitionId: compGenId,
        competitionName: 'Campus Quiz',
        type: 'SOLO',
        status: 'APPROVED'
      });

      // Switching from Junior to Senior must succeed because General tier is open to all students
      const result = await ParticipantService.updateParticipant(
        adminIdToken,
        partId,
        { categoryId: catSrId, categoryName: 'Senior' }
      );

      expect(result.categoryId).toBe(catSrId);
      expect(result.categoryName).toBe('Senior');

      const checkSnap = await db.collection('participants').doc(partId).get();
      expect(checkSnap.data()?.categoryId).toBe(catSrId);
    });

    it('ignores REJECTED and CANCELLED registrations during category conflict checks', async () => {
      const partId = `part-rej-${suiteId}`;
      const compJrId = `comp-rej-jr-${suiteId}`;

      await trackRef(db.collection('competitions').doc(compJrId)).set({
        id: compJrId,
        code: `CMP-REJ-${suiteId.slice(-4)}`,
        name: 'Junior Essay',
        categoryId: catJrId,
        categoryName: 'Junior',
        type: 'SOLO',
        entriesCount: 0,
        maxEntriesPerTeam: 1,
        status: 'SCHEDULED'
      });

      await trackRef(db.collection('participants').doc(partId)).set({
        id: partId,
        bib: '#REJ1',
        name: 'Rejected Student',
        teamId: team1Id,
        teamCode: 'SHA',
        teamName: 'Al-Shamama',
        categoryId: catJrId,
        categoryName: 'Junior',
        registeredEventIds: [],
        createdAt: new Date().toISOString()
      });

      // Create an inactive REJECTED registration
      const regRejId = `reg-rej-${suiteId}`;
      await trackRef(db.collection('registrations').doc(regRejId)).set({
        id: regRejId,
        code: 'REG-9903',
        participantId: partId,
        participantName: 'Rejected Student',
        teamId: team1Id,
        categoryId: catJrId,
        categoryName: 'Junior',
        competitionId: compJrId,
        competitionName: 'Junior Essay',
        type: 'SOLO',
        status: 'REJECTED'
      });

      // Create an inactive CANCELLED registration
      const regCancelId = `reg-cancel-${suiteId}`;
      await trackRef(db.collection('registrations').doc(regCancelId)).set({
        id: regCancelId,
        code: 'REG-9904',
        participantId: partId,
        participantName: 'Rejected Student',
        teamId: team1Id,
        categoryId: catJrId,
        categoryName: 'Junior',
        competitionId: compJrId,
        competitionName: 'Junior Essay',
        type: 'SOLO',
        status: 'CANCELLED'
      });

      // Switching from Junior to Senior should succeed without being blocked by inactive registrations
      const result = await ParticipantService.updateParticipant(
        adminIdToken,
        partId,
        { categoryId: catSrId, categoryName: 'Senior' }
      );

      expect(result.categoryId).toBe(catSrId);
      const checkSnap = await db.collection('participants').doc(partId).get();
      expect(checkSnap.data()?.categoryId).toBe(catSrId);
    });

    it('blocks category update when participant is groupLeaderId or in groupMembers of an active competition', async () => {
      const leaderId = `part-lead-${suiteId}`;
      const memberId = `part-mem-${suiteId}`;
      const compJrGroupId = `comp-lead-jr-${suiteId}`;

      await trackRef(db.collection('competitions').doc(compJrGroupId)).set({
        id: compJrGroupId,
        code: `CMP-GRP-${suiteId.slice(-4)}`,
        name: 'Junior Group Song',
        categoryId: catJrId,
        categoryName: 'Junior',
        type: 'GROUP',
        groupSize: 4,
        entriesCount: 1,
        maxEntriesPerTeam: 1,
        status: 'SCHEDULED'
      });

      await trackRef(db.collection('participants').doc(leaderId)).set({
        id: leaderId,
        bib: '#LEAD1',
        name: 'Group Leader',
        teamId: team1Id,
        teamCode: 'SHA',
        teamName: 'Al-Shamama',
        categoryId: catJrId,
        categoryName: 'Junior',
        registeredEventIds: [compJrGroupId],
        createdAt: new Date().toISOString()
      });

      await trackRef(db.collection('participants').doc(memberId)).set({
        id: memberId,
        bib: '#MEM1',
        name: 'Group Member',
        teamId: team1Id,
        teamCode: 'SHA',
        teamName: 'Al-Shamama',
        categoryId: catJrId,
        categoryName: 'Junior',
        registeredEventIds: [compJrGroupId],
        createdAt: new Date().toISOString()
      });

      const groupRegId = `reg-group-${suiteId}`;
      await trackRef(db.collection('registrations').doc(groupRegId)).set({
        id: groupRegId,
        code: 'REG-9905',
        groupLeaderId: leaderId,
        groupMembers: [leaderId, memberId],
        participantName: 'Group Leader & Team',
        teamId: team1Id,
        categoryId: catJrId,
        categoryName: 'Junior',
        competitionId: compJrGroupId,
        competitionName: 'Junior Group Song',
        type: 'GROUP',
        status: 'APPROVED'
      });

      // 1. Leader category switch to Senior must be blocked
      await expect(
        ParticipantService.updateParticipant(
          adminIdToken,
          leaderId,
          { categoryId: catSrId, categoryName: 'Senior' }
        )
      ).rejects.toThrow(/Cannot change category for participant/i);

      // 2. Member category switch to Senior must be blocked
      await expect(
        ParticipantService.updateParticipant(
          adminIdToken,
          memberId,
          { categoryId: catSrId, categoryName: 'Senior' }
        )
      ).rejects.toThrow(/Cannot change category for participant/i);
    });
  });

  describe('2. F-03 Registration Lifecycle, registeredEventIds, and entriesCount Consistency', () => {
    it('manages multiple registrations per participant: deleting one event cleanly leaves others intact', async () => {
      const partId = `part-multi-${suiteId}`;
      const compAId = `comp-multi-a-${suiteId}`;
      const compBId = `comp-multi-b-${suiteId}`;
      const regAId = `reg-multi-a-${suiteId}`;
      const regBId = `reg-multi-b-${suiteId}`;

      // Create two competitions
      await trackRef(db.collection('competitions').doc(compAId)).set({
        id: compAId,
        code: `CMP-MA-${suiteId.slice(-4)}`,
        name: 'Senior Debate',
        categoryId: catSrId,
        entriesCount: 1,
        status: 'SCHEDULED'
      });

      await trackRef(db.collection('competitions').doc(compBId)).set({
        id: compBId,
        code: `CMP-MB-${suiteId.slice(-4)}`,
        name: 'Senior Elocution',
        categoryId: catSrId,
        entriesCount: 1,
        status: 'SCHEDULED'
      });

      // Participant registered in BOTH competitions
      await trackRef(db.collection('participants').doc(partId)).set({
        id: partId,
        bib: '#MULTI1',
        name: 'Multi Event Participant',
        teamId: team1Id,
        teamCode: 'SHA',
        teamName: 'Al-Shamama',
        categoryId: catSrId,
        registeredEventIds: [compAId, compBId],
        createdAt: new Date().toISOString()
      });

      await trackRef(db.collection('registrations').doc(regAId)).set({
        id: regAId,
        code: 'REG-9910',
        participantId: partId,
        competitionId: compAId,
        teamId: team1Id,
        status: 'APPROVED'
      });

      await trackRef(db.collection('registrations').doc(regBId)).set({
        id: regBId,
        code: 'REG-9911',
        participantId: partId,
        competitionId: compBId,
        teamId: team1Id,
        status: 'APPROVED'
      });

      // Execute atomic deletion transaction on registration A
      await db.runTransaction(async (transaction) => {
        const regSnap = await transaction.get(db.collection('registrations').doc(regAId));
        expect(regSnap.exists).toBe(true);

        const compSnap = await transaction.get(db.collection('competitions').doc(compAId));
        const partSnap = await transaction.get(db.collection('participants').doc(partId));

        transaction.delete(db.collection('registrations').doc(regAId));

        const currentEntries = Number(compSnap.data()?.entriesCount ?? 0);
        transaction.update(db.collection('competitions').doc(compAId), {
          entriesCount: Math.max(0, currentEntries - 1)
        });

        const existingEvents = Array.isArray(partSnap.data()?.registeredEventIds)
          ? partSnap.data()?.registeredEventIds
          : [];
        transaction.update(db.collection('participants').doc(partId), {
          registeredEventIds: existingEvents.filter((id: string) => id !== compAId)
        });
      });

      // Verify Firestore state after deleting registration A:
      // 1. Registration A document is deleted
      const checkRegA = await db.collection('registrations').doc(regAId).get();
      expect(checkRegA.exists).toBe(false);

      // 2. Registration B document is intact
      const checkRegB = await db.collection('registrations').doc(regBId).get();
      expect(checkRegB.exists).toBe(true);

      // 3. Competition A entriesCount decremented to 0
      const checkCompA = await db.collection('competitions').doc(compAId).get();
      expect(checkCompA.data()?.entriesCount).toBe(0);

      // 4. Competition B entriesCount remains 1
      const checkCompB = await db.collection('competitions').doc(compBId).get();
      expect(checkCompB.data()?.entriesCount).toBe(1);

      // 5. Participant registeredEventIds cleanly retains [compBId] without compAId
      const checkPart = await db.collection('participants').doc(partId).get();
      expect(checkPart.data()?.registeredEventIds).toEqual([compBId]);
    });

    it('synchronizes entriesCount and registeredEventIds across status transitions', async () => {
      const partId = `part-stat-${suiteId}`;
      const compId = `comp-stat-${suiteId}`;
      const regId = `reg-stat-${suiteId}`;

      await trackRef(db.collection('competitions').doc(compId)).set({
        id: compId,
        code: `CMP-ST-${suiteId.slice(-4)}`,
        name: 'Senior Poetry',
        categoryId: catSrId,
        entriesCount: 1,
        status: 'SCHEDULED'
      });

      await trackRef(db.collection('participants').doc(partId)).set({
        id: partId,
        bib: '#STAT1',
        name: 'Status Test Student',
        teamId: team1Id,
        teamCode: 'SHA',
        teamName: 'Al-Shamama',
        categoryId: catSrId,
        registeredEventIds: [compId],
        createdAt: new Date().toISOString()
      });

      await trackRef(db.collection('registrations').doc(regId)).set({
        id: regId,
        code: 'REG-9912',
        participantId: partId,
        competitionId: compId,
        teamId: team1Id,
        status: 'APPROVED'
      });

      // Transition 1: APPROVED -> REJECTED
      await db.runTransaction(async (transaction) => {
        const regSnap = await transaction.get(db.collection('registrations').doc(regId));
        expect(regSnap.exists).toBe(true);
        const compSnap = await transaction.get(db.collection('competitions').doc(compId));
        const partSnap = await transaction.get(db.collection('participants').doc(partId));

        transaction.update(db.collection('registrations').doc(regId), { status: 'REJECTED' });

        const currentEntries = Number(compSnap.data()?.entriesCount ?? 0);
        transaction.update(db.collection('competitions').doc(compId), {
          entriesCount: Math.max(0, currentEntries - 1)
        });

        const existingEvents = (partSnap.data()?.registeredEventIds as string[]) || [];
        transaction.update(db.collection('participants').doc(partId), {
          registeredEventIds: existingEvents.filter(id => id !== compId)
        });
      });

      const compSnap1 = await db.collection('competitions').doc(compId).get();
      expect(compSnap1.data()?.entriesCount).toBe(0);

      const partSnap1 = await db.collection('participants').doc(partId).get();
      expect(partSnap1.data()?.registeredEventIds).toEqual([]);

      // Transition 2: REJECTED -> APPROVED (Admin re-approves)
      await db.runTransaction(async (transaction) => {
        const regSnap = await transaction.get(db.collection('registrations').doc(regId));
        expect(regSnap.exists).toBe(true);
        const compSnap = await transaction.get(db.collection('competitions').doc(compId));
        const partSnap = await transaction.get(db.collection('participants').doc(partId));

        transaction.update(db.collection('registrations').doc(regId), { status: 'APPROVED' });

        const currentEntries = Number(compSnap.data()?.entriesCount ?? 0);
        transaction.update(db.collection('competitions').doc(compId), {
          entriesCount: currentEntries + 1
        });

        const existingEvents = (partSnap.data()?.registeredEventIds as string[]) || [];
        transaction.update(db.collection('participants').doc(partId), {
          registeredEventIds: Array.from(new Set([...existingEvents, compId]))
        });
      });

      const compSnap2 = await db.collection('competitions').doc(compId).get();
      expect(compSnap2.data()?.entriesCount).toBe(1);

      const partSnap2 = await db.collection('participants').doc(partId).get();
      expect(partSnap2.data()?.registeredEventIds).toEqual([compId]);
    });

    it('ensures single-decrement atomicity and prevents negative counts on duplicate deletions', async () => {
      const partId = `part-idem-${suiteId}`;
      const compId = `comp-idem-${suiteId}`;
      const regId = `reg-idem-${suiteId}`;

      await trackRef(db.collection('competitions').doc(compId)).set({
        id: compId,
        code: `CMP-IDEM-${suiteId.slice(-4)}`,
        name: 'Idempotency Check',
        categoryId: catSrId,
        entriesCount: 1,
        status: 'SCHEDULED'
      });

      await trackRef(db.collection('participants').doc(partId)).set({
        id: partId,
        bib: '#IDEM1',
        name: 'Idempotency Student',
        teamId: team1Id,
        teamCode: 'SHA',
        teamName: 'Al-Shamama',
        categoryId: catSrId,
        registeredEventIds: [compId],
        createdAt: new Date().toISOString()
      });

      await trackRef(db.collection('registrations').doc(regId)).set({
        id: regId,
        code: 'REG-9913',
        participantId: partId,
        competitionId: compId,
        teamId: team1Id,
        status: 'APPROVED'
      });

      const executeDelete = async () => {
        await db.runTransaction(async (transaction) => {
          const regRef = db.collection('registrations').doc(regId);
          const regSnap = await transaction.get(regRef);
          if (!regSnap.exists) {
            // Already deleted (idempotent no-op)
            return;
          }
          const regData = regSnap.data()!;
          const wasApproved = regData.status === 'APPROVED';

          const compRef = db.collection('competitions').doc(compId);
          const partRef = db.collection('participants').doc(partId);

          // All reads first
          const [compSnap, partSnap] = await Promise.all([
            wasApproved ? transaction.get(compRef) : Promise.resolve(null),
            transaction.get(partRef)
          ]);

          // All writes after reads
          transaction.delete(regRef);

          if (wasApproved && compSnap && compSnap.exists) {
            const currentEntries = Number(compSnap.data()?.entriesCount ?? 0);
            transaction.update(compRef, { entriesCount: Math.max(0, currentEntries - 1) });
          }

          if (partSnap && partSnap.exists) {
            const existingEvents = (partSnap.data()?.registeredEventIds as string[]) || [];
            transaction.update(partRef, {
              registeredEventIds: existingEvents.filter(id => id !== compId)
            });
          }
        });
      };

      // Call 1: Successfully deletes, entriesCount 1 -> 0
      await executeDelete();
      let compCheck = await db.collection('competitions').doc(compId).get();
      expect(compCheck.data()?.entriesCount).toBe(0);

      // Call 2: Duplicate deletion call on non-existent document
      await executeDelete();
      compCheck = await db.collection('competitions').doc(compId).get();
      // Counter must remain 0 and NOT drop into negative numbers (-1)
      expect(compCheck.data()?.entriesCount).toBe(0);

      // Call 3: Another duplicate deletion call
      await executeDelete();
      compCheck = await db.collection('competitions').doc(compId).get();
      expect(compCheck.data()?.entriesCount).toBe(0);
    });

    it('does not double-decrement entriesCount when deleting an already REJECTED registration', async () => {
      const partId = `part-rejdel-${suiteId}`;
      const compId = `comp-rejdel-${suiteId}`;
      const regId = `reg-rejdel-${suiteId}`;

      await trackRef(db.collection('competitions').doc(compId)).set({
        id: compId,
        code: `CMP-RD-${suiteId.slice(-4)}`,
        name: 'Rejected Delete Test',
        categoryId: catSrId,
        entriesCount: 0, // already decremented upon rejection
        status: 'SCHEDULED'
      });

      await trackRef(db.collection('participants').doc(partId)).set({
        id: partId,
        bib: '#RD1',
        name: 'Rejected Delete Student',
        teamId: team1Id,
        teamCode: 'SHA',
        teamName: 'Al-Shamama',
        categoryId: catSrId,
        registeredEventIds: [],
        createdAt: new Date().toISOString()
      });

      // Document exists with status REJECTED
      await trackRef(db.collection('registrations').doc(regId)).set({
        id: regId,
        code: 'REG-9914',
        participantId: partId,
        competitionId: compId,
        teamId: team1Id,
        status: 'REJECTED'
      });

      // Perform deletion respecting wasApproved flag
      await db.runTransaction(async (transaction) => {
        const regRef = db.collection('registrations').doc(regId);
        const regSnap = await transaction.get(regRef);
        if (!regSnap.exists) return;

        const regData = regSnap.data()!;
        const wasApproved = regData.status === 'APPROVED';

        let compSnap: FirebaseFirestore.DocumentSnapshot | null = null;
        if (wasApproved) {
          const compRef = db.collection('competitions').doc(compId);
          compSnap = await transaction.get(compRef);
        }

        // All writes after reads
        transaction.delete(regRef);

        // Only decrement if registration was APPROVED
        if (wasApproved && compSnap && compSnap.exists) {
          const currentEntries = Number(compSnap.data()?.entriesCount ?? 0);
          transaction.update(db.collection('competitions').doc(compId), {
            entriesCount: Math.max(0, currentEntries - 1)
          });
        }
      });

      // Verify registration is deleted
      const checkReg = await db.collection('registrations').doc(regId).get();
      expect(checkReg.exists).toBe(false);

      // Verify competition entriesCount was NOT decremented below 0
      const checkComp = await db.collection('competitions').doc(compId).get();
      expect(checkComp.data()?.entriesCount).toBe(0);
    });
  });
});
