/**
 * Phase 3.3: Firestore Security Rules & Category Policy Concurrency Verification Suite
 *
 * Verifies against Local Firebase Emulator Suite (demo-sahithyolsav-2025):
 *
 * 1. Task A: Correct Firestore Participant Security Rule
 *    - Admin Client SDK cannot change participant categoryId directly (rejected).
 *    - Team Manager Client SDK cannot change participant categoryId directly (rejected).
 *    - Admin Client SDK can update other permitted participant fields (name, bib, phone).
 *    - Team Manager can update their own team participant's permitted fields.
 *    - Team Manager cannot update participants from another team.
 *    - Authorized Server API (PATCH /api/participants/[id]) CAN update categoryId via Admin SDK.
 *    - Unauthorized Server API requests remain strictly blocked (401/403).
 *
 * 2. Task B: Category Policy Concurrency & Mutual Write Contention
 *    - Registration transactions read authoritative competition category from Firestore.
 *    - Category policy updates are executed inside a Firestore transaction.
 *    - Registration and category policy updates share mutual document write contention on categories/{id}.
 *    - A concurrent registration cannot succeed under an outdated OPEN_TO_ALL policy after CATEGORY_ONLY commits.
 *    - A concurrent policy tightening cannot commit if an active incompatible registration is created.
 *    - Group registration enforces the exact same mutual contention for all group members.
 *
 * 3. Additional Backward Compatibility Check:
 *    - resolveCategoryEligibilityPolicy() preserves known General / CAT-GEN legacy categories.
 *    - Strictly prevents unrelated category names (e.g. "General Science", "Generation Z", "Campus Debate")
 *      from accidentally receiving OPEN_TO_ALL.
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
import {
  getFirestore as getClientFirestore,
  connectFirestoreEmulator,
  doc,
  getDoc,
  updateDoc,
  Firestore as ClientFirestore
} from 'firebase/firestore';
import { NextRequest } from 'next/server';
import { RegistrationService } from '@/services/registrationService';
import { resolveCategoryEligibilityPolicy } from '@/domain/eligibility';
import { PATCH as patchParticipantHandler } from '@/app/api/participants/[id]/route';
import { PATCH as patchCategoryHandler } from '@/app/api/admin/categories/[id]/route';
import { Category } from '@/types/fest';

describe('Phase 3.3: Firestore Security Rules & Category Policy Concurrency', () => {
  let adminIdToken = '';
  let team1ManagerToken = '';
  let clientApp: FirebaseApp;
  let clientAuth: ClientAuth;
  let clientDb: ClientFirestore;

  const adminApp = getAdminApps().find(a => a.name === 'phase33-test-admin') ||
    initAdminApp({ projectId: 'demo-sahithyolsav-2025' }, 'phase33-test-admin');
  const db = getAdminFirestore(adminApp);

  const suiteId = `p33-${Date.now()}`;
  const team1Id = 'team-1'; // Al-Shamama (teamCode: 'SHA')
  const team2Id = 'team-2'; // An-Nawa (teamCode: 'NAW')
  const createdDocRefs: FirebaseFirestore.DocumentReference[] = [];

  const trackRef = (ref: FirebaseFirestore.DocumentReference) => {
    createdDocRefs.push(ref);
    return ref;
  };

  const catJrId = `cat-jr-${suiteId}`;
  const catSrId = `cat-sr-${suiteId}`;

  beforeAll(async () => {
    // 1. Initialize Client App connected to emulators
    const clientAppName = `p33-client-${Date.now()}`;
    clientApp = initClientApp(
      {
        apiKey: 'demo-api-key',
        projectId: 'demo-sahithyolsav-2025',
        authDomain: 'demo-sahithyolsav-2025.firebaseapp.com'
      },
      clientAppName
    );
    clientAuth = getClientAuth(clientApp);
    clientDb = getClientFirestore(clientApp);
    connectAuthEmulator(clientAuth, 'http://127.0.0.1:9099', { disableWarnings: true });
    connectFirestoreEmulator(clientDb, '127.0.0.1', 8080);

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

    // 3. Seed test categories
    await trackRef(db.collection('categories').doc(catJrId)).set({
      id: catJrId,
      name: 'Junior',
      code: 'CAT-JR',
      participantEligibility: 'CATEGORY_ONLY',
      status: 'ACTIVE'
    });
    await trackRef(db.collection('categories').doc(catSrId)).set({
      id: catSrId,
      name: 'Senior',
      code: 'CAT-SR',
      participantEligibility: 'CATEGORY_ONLY',
      status: 'ACTIVE'
    });
  });

  afterAll(async () => {
    if (clientApp) {
      await deleteClientApp(clientApp).catch(() => {});
    }

    // Clean up created test documents
    for (const ref of createdDocRefs) {
      await ref.delete().catch(() => {});
    }
  });

  // =========================================================================
  // Section 1: Task A - Firestore Participant Security Rule Enforcement
  // =========================================================================
  describe('Task A: Firestore Participant Security Rule Enforcement', () => {
    it('blocks Admin Client SDK from directly changing participant categoryId', async () => {
      const partId = `part-admin-cat-block-${Date.now()}`;
      await trackRef(db.collection('participants').doc(partId)).set({
        id: partId,
        name: 'Direct Category Change Test',
        categoryId: catJrId,
        categoryName: 'Junior',
        teamId: team1Id,
        teamCode: 'SHA',
        teamName: 'Al-Shamama',
        registeredEventIds: []
      });

      // Sign in as Admin on client SDK
      await signInWithEmailAndPassword(clientAuth, 'admin@sahithyolsav.com', 'AdminPassword123!');
      const partDocRef = doc(clientDb, 'participants', partId);

      // Attempt direct client SDK update to categoryId: MUST BE REJECTED
      await expect(
        updateDoc(partDocRef, { categoryId: catSrId })
      ).rejects.toThrow();

      // Verify categoryId remained unchanged in Firestore
      const snap = await db.collection('participants').doc(partId).get();
      expect(snap.data()?.categoryId).toBe(catJrId);
      await signOut(clientAuth);
    });

    it('blocks Team Manager Client SDK from directly changing participant categoryId', async () => {
      const partId = `part-tm-cat-block-${Date.now()}`;
      await trackRef(db.collection('participants').doc(partId)).set({
        id: partId,
        name: 'TM Direct Category Change Test',
        categoryId: catJrId,
        categoryName: 'Junior',
        teamId: team1Id,
        teamCode: 'SHA',
        teamName: 'Al-Shamama',
        registeredEventIds: []
      });

      // Sign in as Team Manager 1 on client SDK
      await signInWithEmailAndPassword(clientAuth, 'manager.shamama@sahithyolsav.com', 'TeamPassword123!');
      const partDocRef = doc(clientDb, 'participants', partId);

      // Attempt direct client SDK update to categoryId: MUST BE REJECTED
      await expect(
        updateDoc(partDocRef, { categoryId: catSrId })
      ).rejects.toThrow();

      // Verify categoryId remained unchanged in Firestore
      const snap = await db.collection('participants').doc(partId).get();
      expect(snap.data()?.categoryId).toBe(catJrId);
      await signOut(clientAuth);
    });

    it('allows Admin Client SDK to update other permitted participant fields', async () => {
      const partId = `part-admin-field-allow-${Date.now()}`;
      await trackRef(db.collection('participants').doc(partId)).set({
        id: partId,
        name: 'Original Student Name',
        categoryId: catJrId,
        categoryName: 'Junior',
        teamId: team1Id,
        teamCode: 'SHA',
        teamName: 'Al-Shamama',
        registeredEventIds: []
      });

      // Sign in as Admin on client SDK
      await signInWithEmailAndPassword(clientAuth, 'admin@sahithyolsav.com', 'AdminPassword123!');
      const partDocRef = doc(clientDb, 'participants', partId);

      // Admin updates name while preserving categoryId: MUST SUCCEED
      await updateDoc(partDocRef, { name: 'Admin Updated Student Name' });

      const snap = await getDoc(partDocRef);
      expect(snap.exists()).toBe(true);
      expect(snap.data()?.name).toBe('Admin Updated Student Name');
      expect(snap.data()?.categoryId).toBe(catJrId);
      await signOut(clientAuth);
    });

    it('allows Team Manager Client SDK to update their own team participant permitted fields', async () => {
      const partId = `part-tm-field-allow-${Date.now()}`;
      await trackRef(db.collection('participants').doc(partId)).set({
        id: partId,
        name: 'Manager Original Name',
        categoryId: catJrId,
        categoryName: 'Junior',
        teamId: team1Id,
        teamCode: 'SHA',
        teamName: 'Al-Shamama',
        registeredEventIds: []
      });

      // Sign in as Team Manager 1 on client SDK
      await signInWithEmailAndPassword(clientAuth, 'manager.shamama@sahithyolsav.com', 'TeamPassword123!');
      const partDocRef = doc(clientDb, 'participants', partId);

      // Team Manager updates name for their own team participant: MUST SUCCEED
      await updateDoc(partDocRef, { name: 'Manager Updated Name' });

      const snap = await getDoc(partDocRef);
      expect(snap.exists()).toBe(true);
      expect(snap.data()?.name).toBe('Manager Updated Name');
      expect(snap.data()?.categoryId).toBe(catJrId);
      await signOut(clientAuth);
    });

    it('blocks Team Manager Client SDK from updating participants belonging to another team', async () => {
      const partId = `part-cross-team-block-${Date.now()}`;
      await trackRef(db.collection('participants').doc(partId)).set({
        id: partId,
        name: 'Team 2 Student',
        categoryId: catJrId,
        categoryName: 'Junior',
        teamId: team2Id, // Team 2 (An-Nawa)
        teamCode: 'NAW',
        teamName: 'An-Nawa',
        registeredEventIds: []
      });

      // Sign in as Team Manager 1 (Al-Shamama) on client SDK
      await signInWithEmailAndPassword(clientAuth, 'manager.shamama@sahithyolsav.com', 'TeamPassword123!');
      const partDocRef = doc(clientDb, 'participants', partId);

      // Attempt to update participant from Team 2: MUST BE REJECTED
      await expect(
        updateDoc(partDocRef, { name: 'Hacked Cross-Team Name' })
      ).rejects.toThrow();
      await signOut(clientAuth);
    });

    it('allows authorized Server API (PATCH /api/participants/[id]) to update categoryId with Admin SDK', async () => {
      const partId = `part-server-api-allow-${Date.now()}`;
      await trackRef(db.collection('participants').doc(partId)).set({
        id: partId,
        name: 'Server API Transition Contestant',
        categoryId: catJrId,
        categoryName: 'Junior',
        teamId: team1Id,
        teamCode: 'SHA',
        teamName: 'Al-Shamama',
        registeredEventIds: []
      });

      // Call server API handler with Admin ID Token
      const req = new NextRequest(`http://localhost/api/participants/${partId}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${adminIdToken}`
        },
        body: JSON.stringify({ categoryId: catSrId })
      });

      const res = await patchParticipantHandler(req, { params: Promise.resolve({ id: partId }) });
      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.participant.categoryId).toBe(catSrId);

      // Verify categoryId was updated in Firestore
      const snap = await db.collection('participants').doc(partId).get();
      expect(snap.data()?.categoryId).toBe(catSrId);
    });

    it('blocks unauthorized requests to PATCH /api/participants/[id]', async () => {
      const partId = `part-unauth-api-${Date.now()}`;
      await trackRef(db.collection('participants').doc(partId)).set({
        id: partId,
        name: 'Unauthorized Test Participant',
        categoryId: catJrId,
        categoryName: 'Junior',
        teamId: team1Id,
        teamCode: 'SHA',
        teamName: 'Al-Shamama',
        registeredEventIds: []
      });

      // Missing token returns 401
      const reqNoAuth = new NextRequest(`http://localhost/api/participants/${partId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ categoryId: catSrId })
      });
      const resNoAuth = await patchParticipantHandler(reqNoAuth, { params: Promise.resolve({ id: partId }) });
      expect(resNoAuth.status).toBe(401);

      // Cross-team manager token returns 403
      // Create participant for team-2 and attempt update with team-1 manager token
      const partTeam2Id = `part-t2-unauth-${Date.now()}`;
      await trackRef(db.collection('participants').doc(partTeam2Id)).set({
        id: partTeam2Id,
        name: 'Team 2 Contestant',
        categoryId: catJrId,
        categoryName: 'Junior',
        teamId: team2Id,
        teamCode: 'NAW',
        teamName: 'An-Nawa',
        registeredEventIds: []
      });

      const reqCross = new NextRequest(`http://localhost/api/participants/${partTeam2Id}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${team1ManagerToken}`
        },
        body: JSON.stringify({ name: 'Manager Cross Update' })
      });
      const resCross = await patchParticipantHandler(reqCross, { params: Promise.resolve({ id: partTeam2Id }) });
      expect(resCross.status).toBe(403);
    });
  });

  // =========================================================================
  // Section 2: Task B - Category Policy Concurrency Verification
  // =========================================================================
  describe('Task B: Category Policy Concurrency & Mutual Write Contention', () => {
    it('prevents an invalid state when registration creation and category policy tightening run concurrently', async () => {
      const raceCatId = `cat-race-b-${Date.now()}`;
      const compId = `comp-race-b-${Date.now()}`;
      const partSrId = `part-sr-race-b-${Date.now()}`;

      // 1. Seed Category initialized with OPEN_TO_ALL
      await trackRef(db.collection('categories').doc(raceCatId)).set({
        id: raceCatId,
        name: 'Race Concurrency Division',
        code: `CAT-RCB-${Date.now().toString().slice(-4)}`,
        participantEligibility: 'OPEN_TO_ALL',
        status: 'ACTIVE'
      });

      // 2. Seed Competition in this category
      await trackRef(db.collection('competitions').doc(compId)).set({
        id: compId,
        name: 'Open Debate Contest',
        code: `CMP-RACE-${Date.now().toString().slice(-4)}`,
        categoryId: raceCatId,
        categoryName: 'Race Concurrency Division',
        type: 'SOLO',
        entriesCount: 0,
        status: 'ACTIVE'
      });

      // 3. Seed Participant in Senior category (catSrId)
      await trackRef(db.collection('participants').doc(partSrId)).set({
        id: partSrId,
        name: 'Senior Racer',
        categoryId: catSrId,
        categoryName: 'Senior',
        teamId: team1Id,
        teamCode: 'SHA',
        teamName: 'Al-Shamama',
        registeredEventIds: []
      });

      // 4. Concurrently execute:
      // Op A: Category policy update from OPEN_TO_ALL to CATEGORY_ONLY via PATCH API (in Firestore transaction)
      // Op B: Registration creation for Senior participant via RegistrationService (in Firestore transaction)
      const patchReq = new NextRequest(`http://localhost/api/admin/categories/${raceCatId}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${adminIdToken}`
        },
        body: JSON.stringify({ participantEligibility: 'CATEGORY_ONLY' })
      });

      const [patchSettled, regSettled] = await Promise.allSettled([
        patchCategoryHandler(patchReq, { params: Promise.resolve({ id: raceCatId }) }),
        RegistrationService.createForTeam(team1ManagerToken, team1Id, {
          competitionId: compId,
          participantId: partSrId
        })
      ]);

      if (regSettled.status === 'fulfilled') {
        trackRef(db.collection('registrations').doc(regSettled.value.id));
      }

      // 5. Inspect authoritative committed Firestore state
      const finalCatSnap = await db.collection('categories').doc(raceCatId).get();
      const finalPolicy = finalCatSnap.data()?.participantEligibility;

      const activeRegsSnap = await db.collection('registrations')
        .where('competitionId', '==', compId)
        .where('status', '==', 'APPROVED')
        .get();

      // INVARIANT: An invalid state can NEVER commit!
      // If the category policy is CATEGORY_ONLY, there CANNOT be an active registration for the Senior participant!
      if (finalPolicy === 'CATEGORY_ONLY') {
        expect(activeRegsSnap.docs.length).toBe(0);
      }

      // Conversely, if the registration was committed, the category policy tightening MUST have failed/aborted!
      if (activeRegsSnap.docs.length > 0) {
        expect(finalPolicy).toBe('OPEN_TO_ALL');
        if (patchSettled.status === 'fulfilled') {
          const patchData = await patchSettled.value.json();
          // The PATCH response must reflect that it was rejected or returned 400 conflict
          if (patchSettled.value.status === 400) {
            expect(patchData.error).toMatch(/conflict|incompatible/i);
          }
        }
      }
    });

    it('enforces group registration concurrency protection across all group members', async () => {
      const grpCatId = `cat-grp-race-${Date.now()}`;
      const compId = `comp-grp-race-${Date.now()}`;
      const leaderJrId = `part-lead-r-${Date.now()}`;
      const memberSrId = `part-mem-r-${Date.now()}`;

      // Category initialized with OPEN_TO_ALL
      await trackRef(db.collection('categories').doc(grpCatId)).set({
        id: grpCatId,
        name: 'Open Group Drama Division',
        code: `CAT-OGD-${Date.now().toString().slice(-4)}`,
        participantEligibility: 'OPEN_TO_ALL',
        status: 'ACTIVE'
      });

      // Group Competition
      await trackRef(db.collection('competitions').doc(compId)).set({
        id: compId,
        name: 'Group Drama Open',
        code: `CMP-GDO-${Date.now().toString().slice(-4)}`,
        categoryId: grpCatId,
        categoryName: 'Open Group Drama Division',
        type: 'GROUP',
        groupSize: 2,
        minParticipants: 2,
        maxParticipants: 3,
        entriesCount: 0,
        status: 'ACTIVE'
      });

      // Leader (Junior)
      await trackRef(db.collection('participants').doc(leaderJrId)).set({
        id: leaderJrId,
        name: 'Drama Leader',
        categoryId: catJrId,
        categoryName: 'Junior',
        teamId: team1Id,
        teamCode: 'SHA',
        teamName: 'Al-Shamama',
        registeredEventIds: []
      });

      // Member (Senior)
      await trackRef(db.collection('participants').doc(memberSrId)).set({
        id: memberSrId,
        name: 'Drama Member Senior',
        categoryId: catSrId,
        categoryName: 'Senior',
        teamId: team1Id,
        teamCode: 'SHA',
        teamName: 'Al-Shamama',
        registeredEventIds: []
      });

      // Concurrently run policy tightening vs group registration creation
      const patchReq = new NextRequest(`http://localhost/api/admin/categories/${grpCatId}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${adminIdToken}`
        },
        body: JSON.stringify({ participantEligibility: 'CATEGORY_ONLY' })
      });

      const [patchRes, regRes] = await Promise.allSettled([
        patchCategoryHandler(patchReq, { params: Promise.resolve({ id: grpCatId }) }),
        RegistrationService.createForTeam(team1ManagerToken, team1Id, {
          competitionId: compId,
          groupLeaderId: leaderJrId,
          groupMembers: [memberSrId]
        })
      ]);

      if (regRes.status === 'fulfilled') {
        trackRef(db.collection('registrations').doc(regRes.value.id));
      }
      if (patchRes.status === 'fulfilled') {
        expect([200, 400]).toContain(patchRes.value.status);
      }

      // Assert mutual contention prevented invalid state
      const finalCatSnap = await db.collection('categories').doc(grpCatId).get();
      const finalPolicy = finalCatSnap.data()?.participantEligibility;

      const activeRegsSnap = await db.collection('registrations')
        .where('competitionId', '==', compId)
        .where('status', '==', 'APPROVED')
        .get();

      if (finalPolicy === 'CATEGORY_ONLY') {
        expect(activeRegsSnap.docs.length).toBe(0);
      }
      if (activeRegsSnap.docs.length > 0) {
        expect(finalPolicy).toBe('OPEN_TO_ALL');
      }
    });
  });

  // =========================================================================
  // Section 3: Backward Compatibility Heuristic Verification
  // =========================================================================
  describe('Section 3: Backward Compatibility Heuristic Verification', () => {
    it('strictly preserves known General / CAT-GEN legacy categories', () => {
      const knownGeneralCases: Category[] = [
        { id: 'cat-4', name: 'General', code: 'CAT-GEN', classRange: 'Campus Wide', eligibility: '', ageRange: '', enrolledCount: 0, competitionsCount: 0, status: 'ACTIVE' },
        { id: 'cat-gen', name: 'General', code: 'GEN', classRange: 'Campus Wide', eligibility: '', ageRange: '', enrolledCount: 0, competitionsCount: 0, status: 'ACTIVE' },
        { id: 'cat-legacy-1', name: 'General', code: 'OTHER', classRange: '', eligibility: '', ageRange: '', enrolledCount: 0, competitionsCount: 0, status: 'ACTIVE' },
        { id: 'cat-legacy-2', name: 'General Category', code: '', classRange: '', eligibility: '', ageRange: '', enrolledCount: 0, competitionsCount: 0, status: 'ACTIVE' },
        { id: 'cat-legacy-3', name: 'Campus Wide', code: '', classRange: '', eligibility: '', ageRange: '', enrolledCount: 0, competitionsCount: 0, status: 'ACTIVE' },
        { id: 'cat-legacy-4', name: 'campus-wide', code: '', classRange: '', eligibility: '', ageRange: '', enrolledCount: 0, competitionsCount: 0, status: 'ACTIVE' }
      ];

      for (const cat of knownGeneralCases) {
        expect(resolveCategoryEligibilityPolicy(cat)).toBe('OPEN_TO_ALL');
      }
    });

    it('strictly prevents unrelated category names from accidentally receiving OPEN_TO_ALL', () => {
      const nonGeneralCases: Category[] = [
        { id: 'cat-sci-1', name: 'General Science - Junior', code: 'CAT-SCI', classRange: 'Std 5 - 7', eligibility: '', ageRange: '', enrolledCount: 0, competitionsCount: 0, status: 'ACTIVE' },
        { id: 'cat-genz-1', name: 'Generation Z Eloquence', code: 'CAT-GENZ', classRange: 'Std 8 - 10', eligibility: '', ageRange: '', enrolledCount: 0, competitionsCount: 0, status: 'ACTIVE' },
        { id: 'cat-deb-1', name: 'Campus Debate - Senior', code: 'CAT-DEB', classRange: 'Std 11 - 12', eligibility: '', ageRange: '', enrolledCount: 0, competitionsCount: 0, status: 'ACTIVE' },
        { id: 'cat-sub-1', name: 'Sub Junior General Knowledge', code: 'CAT-GK', classRange: 'Std 1 - 4', eligibility: '', ageRange: '', enrolledCount: 0, competitionsCount: 0, status: 'ACTIVE' },
        { id: 'cat-jr-1', name: 'Junior Division', code: 'CAT-JR', eligibility: 'All students in Std 5-7', classRange: 'Std 5 - 7', ageRange: '', enrolledCount: 0, competitionsCount: 0, status: 'ACTIVE' }
      ];

      for (const cat of nonGeneralCases) {
        expect(resolveCategoryEligibilityPolicy(cat)).toBe('CATEGORY_ONLY');
      }
    });
  });
});
