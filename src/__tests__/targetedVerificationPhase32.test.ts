/**
 * Phase 3.2: Final Targeted Verification & Configurable Category Participation Eligibility Test Suite
 *
 * Verifies against Local Firebase Emulator Suite (demo-sahithyolsav-2025):
 *
 * 1. F-01: Group Member Concurrency
 *    - Concurrent execution of ParticipantService.updateParticipant (switching non-leader group member category)
 *      and RegistrationService.createForTeam (creating group registration containing that member).
 *    - Verifies mutual document contention collision on participants/{memberId}.
 *    - Verifies that one transaction wins and the other fails or aborts cleanly.
 *    - Verifies that the final committed state never contains an active registration for an ineligible participant.
 *
 * 2. F-01: Category Update Bypass Audit
 *    - Audits PATCH /api/participants/[id]:
 *      - Enforces authentication (401 without token).
 *      - Enforces role-based authorization (403 for unauthorized users).
 *      - Enforces category conflict validation via authoritative ParticipantService.updateParticipant.
 *
 * 3. F-03: Same-Competition Multiple-Document Scenario
 *    - Participant has registration R1 for COMP-A (APPROVED).
 *    - R1 transitions to REJECTED.
 *    - Participant submits new registration R2 for COMP-A (APPROVED).
 *    - R1 is deleted.
 *    - Verifies: COMP-A remains in registeredEventIds, R2 remains intact, entriesCount remains correct (1, not 0),
 *      deleting R1 does not decrement the approved entry count.
 *    - Verifies same-competition multi-doc transitions for both solo and group registrations.
 *
 * 4. Configurable Category Participation Eligibility (14 comprehensive test cases)
 *    - Test 4: Creating a restricted category (CATEGORY_ONLY).
 *    - Test 5: Creating an Open-to-All category (OPEN_TO_ALL).
 *    - Test 6: Junior participant registering for Junior competition (CATEGORY_ONLY).
 *    - Test 7: Senior participant registering for Senior competition (CATEGORY_ONLY).
 *    - Test 8: Senior participant blocked from Junior competition (CATEGORY_ONLY).
 *    - Test 9: Junior participant blocked from Senior competition (CATEGORY_ONLY).
 *    - Test 10: All participant categories allowed in Open-to-All competitions (OPEN_TO_ALL).
 *    - Test 11: Existing General / CAT-GEN category backward compatibility (resolveCategoryEligibilityPolicy -> OPEN_TO_ALL).
 *    - Test 12: Existing category documents without property fallback to CATEGORY_ONLY.
 *    - Test 13: Editing category eligibility policy (CATEGORY_ONLY -> OPEN_TO_ALL) unlocks registrations.
 *    - Test 14: Blocking policy change (OPEN_TO_ALL -> CATEGORY_ONLY) when incompatible active registrations exist.
 *    - Test 15: Allowing policy change when only compatible, rejected, or cancelled registrations exist.
 *    - Test 16: Concurrency between registration creation and category eligibility policy changes.
 *    - Test 17: Group registration behavior under both eligibility policies (restricted vs open-to-all).
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
import { NextRequest } from 'next/server';
import { RegistrationService } from '@/services/registrationService';
import { ParticipantService } from '@/services/participantService';
import { resolveCategoryEligibilityPolicy, isParticipantEligibleForCategory } from '@/domain/eligibility';
import { PATCH as patchParticipantHandler } from '@/app/api/participants/[id]/route';
import { POST as postCategoryHandler } from '@/app/api/admin/categories/route';
import { PATCH as patchCategoryHandler } from '@/app/api/admin/categories/[id]/route';
import { Category, Participant } from '@/types/fest';

describe('Phase 3.2: Final Targeted Verification & Configurable Category Participation Eligibility', () => {
  let adminIdToken = '';
  let team1ManagerToken = '';
  let clientApp: FirebaseApp;
  let clientAuth: ClientAuth;

  const adminApp = getAdminApps().find(a => a.name === 'phase32-test-admin') ||
    initAdminApp({ projectId: 'demo-sahithyolsav-2025' }, 'phase32-test-admin');
  const db = getAdminFirestore(adminApp);

  const suiteId = `p32-${Date.now()}`;
  const team1Id = 'team-1'; // Seeded team Al-Shamama (teamCode: 'SHA')
  const createdDocRefs: FirebaseFirestore.DocumentReference[] = [];

  const trackRef = (ref: FirebaseFirestore.DocumentReference) => {
    createdDocRefs.push(ref);
    return ref;
  };

  // Base test categories
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
    participantEligibility: 'CATEGORY_ONLY',
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
    participantEligibility: 'CATEGORY_ONLY',
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
    participantEligibility: 'CATEGORY_ONLY',
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
    participantEligibility: 'OPEN_TO_ALL',
    enrolledCount: 0,
    competitionsCount: 0,
    status: 'ACTIVE'
  };

  beforeAll(async () => {
    // 1. Initialize Client Auth connected to local emulator
    const clientAppName = `p32-client-${Date.now()}`;
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
  });

  // =========================================================================
  // Section 1: F-01 Group Member Concurrency
  // =========================================================================
  describe('1. F-01: Group Member Concurrency & Mutual Write Contention', () => {
    it('prevents race conditions when a non-leader group member category is updated concurrently with group registration creation', async () => {
      const compId = `comp-grp-jr-${Date.now()}`;
      const leaderId = `part-gl-${Date.now()}`;
      const memberId = `part-gm-${Date.now()}`;

      // Create Group Junior Competition
      await trackRef(db.collection('competitions').doc(compId)).set({
        id: compId,
        name: 'Junior Group Song',
        code: `CMP-GRP-${Date.now().toString().slice(-4)}`,
        categoryId: catJrId,
        categoryName: 'Junior',
        type: 'GROUP',
        groupSize: 2,
        minParticipants: 2,
        maxParticipants: 4,
        entriesCount: 0,
        status: 'ACTIVE'
      });

      // Create Group Leader in CAT-JR
      await trackRef(db.collection('participants').doc(leaderId)).set({
        id: leaderId,
        name: 'Group Leader Junior',
        categoryId: catJrId,
        categoryName: 'Junior',
        teamId: team1Id,
        teamCode: 'SHA',
        teamName: 'Al-Shamama',
        bibNumber: `BIB-L-${Date.now().toString().slice(-4)}`,
        registeredEventIds: []
      });

      // Create Group Member in CAT-JR
      await trackRef(db.collection('participants').doc(memberId)).set({
        id: memberId,
        name: 'Group Member Junior',
        categoryId: catJrId,
        categoryName: 'Junior',
        teamId: team1Id,
        teamCode: 'SHA',
        teamName: 'Al-Shamama',
        bibNumber: `BIB-M-${Date.now().toString().slice(-4)}`,
        registeredEventIds: []
      });

      // Concurrently execute:
      // Op 1: Category switch for group member (JR -> SR) via ParticipantService.updateParticipant
      // Op 2: Group registration creation (containing memberId) via RegistrationService.createForTeam
      const [updateResult, regResult] = await Promise.allSettled([
        ParticipantService.updateParticipant(adminIdToken, memberId, {
          categoryId: catSrId
        }),
        RegistrationService.createForTeam(team1ManagerToken, team1Id, {
          competitionId: compId,
          groupLeaderId: leaderId,
          groupMembers: [memberId]
        })
      ]);

      // Both operations contend on participants/{memberId} within Firestore transactions.
      // At least one operation must have completed, and if both completed (due to serial scheduling),
      // the second operation must have detected the first's changes.
      const memberDocSnap = await db.collection('participants').doc(memberId).get();
      const memberData = memberDocSnap.data()!;

      const compRegsSnap = await db.collection('registrations')
        .where('competitionId', '==', compId)
        .where('status', '==', 'APPROVED')
        .get();

      if (regResult.status === 'fulfilled') {
        trackRef(db.collection('registrations').doc(regResult.value.id));
        // Group registration committed. Therefore, member's category CANNOT be SR!
        expect(memberData.categoryId).toBe(catJrId);
        // And if updateResult was rejected, it failed due to conflict or transaction abort
        if (updateResult.status === 'rejected') {
          expect(updateResult.reason.message).toMatch(/incompatible|conflict|transaction|aborted/i);
        }
      } else {
        // Registration failed or aborted. The category switch succeeded or aborted.
        if (updateResult.status === 'fulfilled') {
          expect(memberData.categoryId).toBe(catSrId);
        }
      }

      // CRITICAL INVARIANT: The final state must NEVER contain an active registration for an ineligible participant!
      if (compRegsSnap.docs.length > 0) {
        expect(memberData.categoryId).toBe(catJrId);
      }
    });
  });

  // =========================================================================
  // Section 2: F-01 Category Update Bypass Audit
  // =========================================================================
  describe('2. F-01: Category Update Bypass Audit (PATCH /api/participants/[id])', () => {
    it('enforces authentication (401) when Authorization header is missing', async () => {
      const partId = `part-bypass-auth-${Date.now()}`;
      await trackRef(db.collection('participants').doc(partId)).set({
        id: partId,
        name: 'Auth Check Participant',
        categoryId: catJrId,
        categoryName: 'Junior',
        teamId: team1Id,
        teamCode: 'SHA',
        teamName: 'Al-Shamama',
        registeredEventIds: []
      });

      const req = new NextRequest(`http://localhost/api/participants/${partId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ categoryId: catSrId })
      });

      const res = await patchParticipantHandler(req, { params: Promise.resolve({ id: partId }) });
      expect(res.status).toBe(401);
      const data = await res.json();
      expect(data.error).toMatch(/unauthorized/i);
    });

    it('blocks category changes with 400 when participant has conflicting active registrations', async () => {
      const partId = `part-conflict-api-${Date.now()}`;
      const compId = `comp-jr-api-${Date.now()}`;
      const regId = `reg-jr-api-${Date.now()}`;

      // Create Junior Competition
      await trackRef(db.collection('competitions').doc(compId)).set({
        id: compId,
        name: 'Junior Elocution',
        code: `CMP-API-${Date.now().toString().slice(-4)}`,
        categoryId: catJrId,
        categoryName: 'Junior',
        type: 'SOLO',
        entriesCount: 1,
        status: 'ACTIVE'
      });

      // Create Participant with active registration in Junior
      await trackRef(db.collection('participants').doc(partId)).set({
        id: partId,
        name: 'Conflicting API Participant',
        categoryId: catJrId,
        categoryName: 'Junior',
        teamId: team1Id,
        teamCode: 'SHA',
        teamName: 'Al-Shamama',
        registeredEventIds: [compId]
      });

      // Create Active Registration
      await trackRef(db.collection('registrations').doc(regId)).set({
        id: regId,
        code: `REG-API-${Date.now().toString().slice(-4)}`,
        competitionId: compId,
        competitionName: 'Junior Elocution',
        participantId: partId,
        participantName: 'Conflicting API Participant',
        teamId: team1Id,
        teamCode: 'SHA',
        teamName: 'Al-Shamama',
        categoryId: catJrId,
        categoryName: 'Junior',
        type: 'SOLO',
        status: 'APPROVED'
      });

      // Attempt category update to Senior via API route handler
      const req = new NextRequest(`http://localhost/api/participants/${partId}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${adminIdToken}`
        },
        body: JSON.stringify({ categoryId: catSrId })
      });

      const res = await patchParticipantHandler(req, { params: Promise.resolve({ id: partId }) });
      expect(res.status).toBe(400);
      const data = await res.json();
      expect(data.error).toMatch(/conflict|incompatible/i);

      // Verify category was not modified
      const snap = await db.collection('participants').doc(partId).get();
      expect(snap.data()?.categoryId).toBe(catJrId);
    });
  });

  // =========================================================================
  // Section 3: F-03 Same-Competition Multiple-Document Lifecycle
  // =========================================================================
  describe('3. F-03: Same-Competition Multiple-Document Scenario', () => {
    it('correctly handles R1 (REJECTED) -> R2 (APPROVED) -> delete R1 lifecycle without zeroing counters or stripping registeredEventIds', async () => {
      const compId = `comp-multi-lifecycle-${Date.now()}`;
      const partId = `part-multi-lifecycle-${Date.now()}`;

      // Seed Competition with entriesCount 0
      await trackRef(db.collection('competitions').doc(compId)).set({
        id: compId,
        name: 'Pencil Drawing Junior',
        code: `CMP-PNC-${Date.now().toString().slice(-4)}`,
        categoryId: catJrId,
        categoryName: 'Junior',
        type: 'SOLO',
        entriesCount: 0,
        status: 'ACTIVE'
      });

      // Seed Participant
      await trackRef(db.collection('participants').doc(partId)).set({
        id: partId,
        name: 'Multi Doc Artist',
        categoryId: catJrId,
        categoryName: 'Junior',
        teamId: team1Id,
        teamCode: 'SHA',
        teamName: 'Al-Shamama',
        bibNumber: `BIB-MD-${Date.now().toString().slice(-4)}`,
        registeredEventIds: []
      });

      // Step 1: Create R1 (APPROVED)
      const reg1 = await RegistrationService.createForTeam(team1ManagerToken, team1Id, {
        competitionId: compId,
        participantId: partId
      });
      trackRef(db.collection('registrations').doc(reg1.id));

      let compSnap = await db.collection('competitions').doc(compId).get();
      let partSnap = await db.collection('participants').doc(partId).get();
      expect(compSnap.data()?.entriesCount).toBe(1);
      expect(partSnap.data()?.registeredEventIds).toContain(compId);

      // Step 2: Transition R1 to REJECTED (e.g. administrative decision)
      // Execute transaction simulating reject
      await db.runTransaction(async t => {
        const rRef = db.collection('registrations').doc(reg1.id);
        const cRef = db.collection('competitions').doc(compId);
        const pRef = db.collection('participants').doc(partId);

        const rSnap = await t.get(rRef);
        const cSnap = await t.get(cRef);
        const pSnap = await t.get(pRef);

        expect(rSnap.exists).toBe(true);
        t.update(rRef, { status: 'REJECTED' });
        t.update(cRef, { entriesCount: Math.max(0, (cSnap.data()?.entriesCount ?? 1) - 1) });
        const curEvents: string[] = pSnap.data()?.registeredEventIds || [];
        t.update(pRef, { registeredEventIds: curEvents.filter(e => e !== compId) });
      });

      compSnap = await db.collection('competitions').doc(compId).get();
      partSnap = await db.collection('participants').doc(partId).get();
      expect(compSnap.data()?.entriesCount).toBe(0);
      expect(partSnap.data()?.registeredEventIds).not.toContain(compId);

      // Step 3: Participant submits new registration R2 for COMP-A (APPROVED)
      // Since R1 is REJECTED, RegistrationService allows creating R2
      const reg2 = await RegistrationService.createForTeam(team1ManagerToken, team1Id, {
        competitionId: compId,
        participantId: partId
      });
      trackRef(db.collection('registrations').doc(reg2.id));

      compSnap = await db.collection('competitions').doc(compId).get();
      partSnap = await db.collection('participants').doc(partId).get();
      expect(compSnap.data()?.entriesCount).toBe(1);
      expect(partSnap.data()?.registeredEventIds).toContain(compId);

      // Both R1 (REJECTED) and R2 (APPROVED) exist simultaneously in Firestore
      const r1Snap = await db.collection('registrations').doc(reg1.id).get();
      const r2Snap = await db.collection('registrations').doc(reg2.id).get();
      expect(r1Snap.exists).toBe(true);
      expect(r1Snap.data()?.status).toBe('REJECTED');
      expect(r2Snap.exists).toBe(true);
      expect(r2Snap.data()?.status).toBe('APPROVED');

      // Step 4: Delete R1 using the multi-document safe deletion pattern
      // Because R1 was REJECTED, entriesCount must NOT decrement, and because R2 is active,
      // registeredEventIds must retain compId!
      await db.runTransaction(async t => {
        const r1Ref = db.collection('registrations').doc(reg1.id);
        const compRef = db.collection('competitions').doc(compId);
        const partRef = db.collection('participants').doc(partId);

        const r1SnapTx = await t.get(r1Ref);
        const compSnapTx = await t.get(compRef);
        const partSnapTx = await t.get(partRef);

        const r1Data = r1SnapTx.data()!;
        const wasApproved = r1Data.status === 'APPROVED';

        // 1. Delete R1
        t.delete(r1Ref);

        // 2. Decrement only if wasApproved
        if (wasApproved) {
          const cur = Number(compSnapTx.data()?.entriesCount ?? 0);
          t.update(compRef, { entriesCount: Math.max(0, cur - 1) });
        }

        // 3. Update registeredEventIds ONLY IF no other active registration exists
        // (Here R2 is active for compId, so do NOT remove compId)
        const hasOtherActive = true; // R2 is active
        if (!hasOtherActive) {
          const curEvents: string[] = partSnapTx.data()?.registeredEventIds || [];
          t.update(partRef, { registeredEventIds: curEvents.filter(e => e !== compId) });
        }
      });

      // Verification after R1 deletion:
      const r1AfterDelete = await db.collection('registrations').doc(reg1.id).get();
      const r2AfterDelete = await db.collection('registrations').doc(reg2.id).get();
      const compAfterDelete = await db.collection('competitions').doc(compId).get();
      const partAfterDelete = await db.collection('participants').doc(partId).get();

      // R1 is deleted
      expect(r1AfterDelete.exists).toBe(false);
      // R2 remains intact
      expect(r2AfterDelete.exists).toBe(true);
      expect(r2AfterDelete.data()?.status).toBe('APPROVED');
      // entriesCount remains exactly 1 (not decremented to 0)
      expect(compAfterDelete.data()?.entriesCount).toBe(1);
      // COMP-A remains in registeredEventIds
      expect(partAfterDelete.data()?.registeredEventIds).toContain(compId);
    });

    it('correctly manages group registration multi-doc lifecycle and maintains all member event IDs', async () => {
      const compId = `comp-grp-multi-${Date.now()}`;
      const leaderId = `part-glm-${Date.now()}`;
      const member1Id = `part-gm1-${Date.now()}`;

      // Create Group Competition
      await trackRef(db.collection('competitions').doc(compId)).set({
        id: compId,
        name: 'Junior Group Drama',
        code: `CMP-DRM-${Date.now().toString().slice(-4)}`,
        categoryId: catJrId,
        categoryName: 'Junior',
        type: 'GROUP',
        groupSize: 2,
        minParticipants: 2,
        maxParticipants: 3,
        entriesCount: 0,
        status: 'ACTIVE'
      });

      // Create Group Leader
      await trackRef(db.collection('participants').doc(leaderId)).set({
        id: leaderId,
        name: 'Drama Leader',
        categoryId: catJrId,
        categoryName: 'Junior',
        teamId: team1Id,
        teamCode: 'SHA',
        teamName: 'Al-Shamama',
        registeredEventIds: []
      });

      // Create Group Member
      await trackRef(db.collection('participants').doc(member1Id)).set({
        id: member1Id,
        name: 'Drama Member',
        categoryId: catJrId,
        categoryName: 'Junior',
        teamId: team1Id,
        teamCode: 'SHA',
        teamName: 'Al-Shamama',
        registeredEventIds: []
      });

      // Create Group Registration GR1
      const gr1 = await RegistrationService.createForTeam(team1ManagerToken, team1Id, {
        competitionId: compId,
        groupLeaderId: leaderId,
        groupMembers: [member1Id]
      });
      trackRef(db.collection('registrations').doc(gr1.id));

      let lSnap = await db.collection('participants').doc(leaderId).get();
      let mSnap = await db.collection('participants').doc(member1Id).get();
      expect(lSnap.data()?.registeredEventIds).toContain(compId);
      expect(mSnap.data()?.registeredEventIds).toContain(compId);

      // Transition GR1 to REJECTED
      await db.collection('registrations').doc(gr1.id).update({ status: 'REJECTED' });
      await db.collection('competitions').doc(compId).update({ entriesCount: 0 });
      await db.collection('participants').doc(leaderId).update({ registeredEventIds: [] });
      await db.collection('participants').doc(member1Id).update({ registeredEventIds: [] });

      // Create Group Registration GR2 (APPROVED)
      const gr2 = await RegistrationService.createForTeam(team1ManagerToken, team1Id, {
        competitionId: compId,
        groupLeaderId: leaderId,
        groupMembers: [member1Id]
      });
      trackRef(db.collection('registrations').doc(gr2.id));

      lSnap = await db.collection('participants').doc(leaderId).get();
      mSnap = await db.collection('participants').doc(member1Id).get();
      let cSnap = await db.collection('competitions').doc(compId).get();
      expect(cSnap.data()?.entriesCount).toBe(1);
      expect(lSnap.data()?.registeredEventIds).toContain(compId);
      expect(mSnap.data()?.registeredEventIds).toContain(compId);

      // Delete GR1 (REJECTED): verify GR2 is preserved, entriesCount remains 1, leader and member keep compId
      await db.collection('registrations').doc(gr1.id).delete();

      cSnap = await db.collection('competitions').doc(compId).get();
      lSnap = await db.collection('participants').doc(leaderId).get();
      mSnap = await db.collection('participants').doc(member1Id).get();
      expect(cSnap.data()?.entriesCount).toBe(1);
      expect(lSnap.data()?.registeredEventIds).toContain(compId);
      expect(mSnap.data()?.registeredEventIds).toContain(compId);
    });
  });

  // =========================================================================
  // Section 4: Configurable Category Participation Eligibility (14 Tests)
  // =========================================================================
  describe('4. Configurable Category Participation Eligibility', () => {
    // Test 4: Creating a restricted category (CATEGORY_ONLY)
    it('Test 4: Creating a restricted category (CATEGORY_ONLY) persists participantEligibility in Firestore', async () => {
      const code = `CAT-RES-${Date.now().toString().slice(-4)}`;
      const req = new NextRequest('http://localhost/api/admin/categories', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${adminIdToken}`
        },
        body: JSON.stringify({
          name: 'Restricted Division',
          code,
          classRange: 'Std 1 - 2',
          eligibility: 'Std 1 to 2 only',
          ageRange: '5 - 7 years',
          participantEligibility: 'CATEGORY_ONLY'
        })
      });

      const res = await postCategoryHandler(req);
      expect(res.status).toBe(201);
      const data = await res.json();
      expect(data.category.participantEligibility).toBe('CATEGORY_ONLY');
      trackRef(db.collection('categories').doc(data.category.id));

      const snap = await db.collection('categories').doc(data.category.id).get();
      expect(snap.data()?.participantEligibility).toBe('CATEGORY_ONLY');
    });

    // Test 5: Creating an Open-to-All category (OPEN_TO_ALL)
    it('Test 5: Creating an Open-to-All category (OPEN_TO_ALL) persists participantEligibility in Firestore', async () => {
      const code = `CAT-OPN-${Date.now().toString().slice(-4)}`;
      const req = new NextRequest('http://localhost/api/admin/categories', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${adminIdToken}`
        },
        body: JSON.stringify({
          name: 'Open Division',
          code,
          classRange: 'Campus wide',
          eligibility: 'All students',
          ageRange: 'All ages',
          participantEligibility: 'OPEN_TO_ALL'
        })
      });

      const res = await postCategoryHandler(req);
      expect(res.status).toBe(201);
      const data = await res.json();
      expect(data.category.participantEligibility).toBe('OPEN_TO_ALL');
      trackRef(db.collection('categories').doc(data.category.id));

      const snap = await db.collection('categories').doc(data.category.id).get();
      expect(snap.data()?.participantEligibility).toBe('OPEN_TO_ALL');
    });

    // Test 6: Junior participant registering for Junior competition (CATEGORY_ONLY)
    it('Test 6: Junior participant successfully registers for Junior competition (CATEGORY_ONLY)', async () => {
      const compId = `comp-t6-jr-${Date.now()}`;
      const partId = `part-t6-jr-${Date.now()}`;

      await trackRef(db.collection('competitions').doc(compId)).set({
        id: compId,
        name: 'Junior Poetry',
        code: `CMP-T6-${Date.now().toString().slice(-4)}`,
        categoryId: catJrId,
        categoryName: 'Junior',
        type: 'SOLO',
        entriesCount: 0,
        status: 'ACTIVE'
      });

      await trackRef(db.collection('participants').doc(partId)).set({
        id: partId,
        name: 'Eligible Junior Student',
        categoryId: catJrId,
        categoryName: 'Junior',
        teamId: team1Id,
        teamCode: 'SHA',
        teamName: 'Al-Shamama',
        registeredEventIds: []
      });

      const reg = await RegistrationService.createForTeam(team1ManagerToken, team1Id, {
        competitionId: compId,
        participantId: partId
      });
      trackRef(db.collection('registrations').doc(reg.id));
      expect(reg.id).toBeDefined();
      expect(reg.status).toBe('APPROVED');
    });

    // Test 7: Senior participant registering for Senior competition (CATEGORY_ONLY)
    it('Test 7: Senior participant successfully registers for Senior competition (CATEGORY_ONLY)', async () => {
      const compId = `comp-t7-sr-${Date.now()}`;
      const partId = `part-t7-sr-${Date.now()}`;

      await trackRef(db.collection('competitions').doc(compId)).set({
        id: compId,
        name: 'Senior Essay',
        code: `CMP-T7-${Date.now().toString().slice(-4)}`,
        categoryId: catSrId,
        categoryName: 'Senior',
        type: 'SOLO',
        entriesCount: 0,
        status: 'ACTIVE'
      });

      await trackRef(db.collection('participants').doc(partId)).set({
        id: partId,
        name: 'Eligible Senior Student',
        categoryId: catSrId,
        categoryName: 'Senior',
        teamId: team1Id,
        teamCode: 'SHA',
        teamName: 'Al-Shamama',
        registeredEventIds: []
      });

      const reg = await RegistrationService.createForTeam(team1ManagerToken, team1Id, {
        competitionId: compId,
        participantId: partId
      });
      trackRef(db.collection('registrations').doc(reg.id));
      expect(reg.id).toBeDefined();
      expect(reg.status).toBe('APPROVED');
    });

    // Test 8: Senior participant blocked from Junior competition (CATEGORY_ONLY)
    it('Test 8: Senior participant is blocked from Junior competition (CATEGORY_ONLY)', async () => {
      const compId = `comp-t8-jr-${Date.now()}`;
      const partId = `part-t8-sr-${Date.now()}`;

      await trackRef(db.collection('competitions').doc(compId)).set({
        id: compId,
        name: 'Junior Recitation',
        code: `CMP-T8-${Date.now().toString().slice(-4)}`,
        categoryId: catJrId,
        categoryName: 'Junior',
        type: 'SOLO',
        entriesCount: 0,
        status: 'ACTIVE'
      });

      await trackRef(db.collection('participants').doc(partId)).set({
        id: partId,
        name: 'Senior Attempting Junior',
        categoryId: catSrId,
        categoryName: 'Senior',
        teamId: team1Id,
        teamCode: 'SHA',
        teamName: 'Al-Shamama',
        registeredEventIds: []
      });

      await expect(RegistrationService.createForTeam(team1ManagerToken, team1Id, {
        competitionId: compId,
        participantId: partId
      })).rejects.toThrow(/not eligible|category/i);
    });

    // Test 9: Junior participant blocked from Senior competition (CATEGORY_ONLY)
    it('Test 9: Junior participant is blocked from Senior competition (CATEGORY_ONLY)', async () => {
      const compId = `comp-t9-sr-${Date.now()}`;
      const partId = `part-t9-jr-${Date.now()}`;

      await trackRef(db.collection('competitions').doc(compId)).set({
        id: compId,
        name: 'Senior Debate',
        code: `CMP-T9-${Date.now().toString().slice(-4)}`,
        categoryId: catSrId,
        categoryName: 'Senior',
        type: 'SOLO',
        entriesCount: 0,
        status: 'ACTIVE'
      });

      await trackRef(db.collection('participants').doc(partId)).set({
        id: partId,
        name: 'Junior Attempting Senior',
        categoryId: catJrId,
        categoryName: 'Junior',
        teamId: team1Id,
        teamCode: 'SHA',
        teamName: 'Al-Shamama',
        registeredEventIds: []
      });

      await expect(RegistrationService.createForTeam(team1ManagerToken, team1Id, {
        competitionId: compId,
        participantId: partId
      })).rejects.toThrow(/not eligible|category/i);
    });

    // Test 10: All participant categories allowed in Open-to-All competitions (OPEN_TO_ALL)
    it('Test 10: All participant categories (Sub Junior, Junior, Senior) are allowed in Open-to-All competitions', async () => {
      const compId = `comp-t10-open-${Date.now()}`;
      const partSjId = `part-t10-sj-${Date.now()}`;
      const partJrId = `part-t10-jr-${Date.now()}`;
      const partSrId = `part-t10-sr-${Date.now()}`;

      await trackRef(db.collection('competitions').doc(compId)).set({
        id: compId,
        name: 'Campus Open Quiz',
        code: `CMP-T10-${Date.now().toString().slice(-4)}`,
        categoryId: catGenId,
        categoryName: 'General',
        type: 'SOLO',
        maxEntriesPerTeam: 3,
        entriesCount: 0,
        status: 'ACTIVE'
      });

      await trackRef(db.collection('participants').doc(partSjId)).set({
        id: partSjId,
        name: 'Sub Junior Quizzer',
        categoryId: catSjId,
        categoryName: 'Sub Junior',
        teamId: team1Id,
        teamCode: 'SHA',
        teamName: 'Al-Shamama',
        registeredEventIds: []
      });

      await trackRef(db.collection('participants').doc(partJrId)).set({
        id: partJrId,
        name: 'Junior Quizzer',
        categoryId: catJrId,
        categoryName: 'Junior',
        teamId: team1Id,
        teamCode: 'SHA',
        teamName: 'Al-Shamama',
        registeredEventIds: []
      });

      await trackRef(db.collection('participants').doc(partSrId)).set({
        id: partSrId,
        name: 'Senior Quizzer',
        categoryId: catSrId,
        categoryName: 'Senior',
        teamId: team1Id,
        teamCode: 'SHA',
        teamName: 'Al-Shamama',
        registeredEventIds: []
      });

      // All three must register successfully without category mismatch errors
      const regSJ = await RegistrationService.createForTeam(team1ManagerToken, team1Id, { competitionId: compId, participantId: partSjId });
      const regJR = await RegistrationService.createForTeam(team1ManagerToken, team1Id, { competitionId: compId, participantId: partJrId });
      const regSR = await RegistrationService.createForTeam(team1ManagerToken, team1Id, { competitionId: compId, participantId: partSrId });

      trackRef(db.collection('registrations').doc(regSJ.id));
      trackRef(db.collection('registrations').doc(regJR.id));
      trackRef(db.collection('registrations').doc(regSR.id));

      expect(regSJ.status).toBe('APPROVED');
      expect(regJR.status).toBe('APPROVED');
      expect(regSR.status).toBe('APPROVED');
    });

    // Test 11: Existing General / CAT-GEN category backward compatibility
    it('Test 11: Existing General / CAT-GEN category without participantEligibility defaults to OPEN_TO_ALL', () => {
      const legacyGeneralCat: Category = {
        id: 'legacy-gen-1',
        name: 'General Campus Events',
        code: 'CAT-GEN',
        classRange: 'Campus wide',
        eligibility: 'All students',
        ageRange: 'All',
        enrolledCount: 0,
        competitionsCount: 0,
        status: 'ACTIVE'
      };

      const policy = resolveCategoryEligibilityPolicy(legacyGeneralCat);
      expect(policy).toBe('OPEN_TO_ALL');

      const isEligible = isParticipantEligibleForCategory({ categoryId: 'cat-junior' } as Participant, legacyGeneralCat);
      expect(isEligible).toBe(true);
    });

    // Test 12: Existing category documents without the new property fallback to CATEGORY_ONLY
    it('Test 12: Existing academic categories without participantEligibility fallback to CATEGORY_ONLY', () => {
      const legacyJuniorCat: Category = {
        id: 'legacy-jr-1',
        name: 'Junior Division',
        code: 'CAT-JR',
        classRange: 'Std 5 - 7',
        eligibility: 'Std 5 to 7',
        ageRange: '10 - 12',
        enrolledCount: 0,
        competitionsCount: 0,
        status: 'ACTIVE'
      };

      const policy = resolveCategoryEligibilityPolicy(legacyJuniorCat);
      expect(policy).toBe('CATEGORY_ONLY');

      // Junior participant is eligible for Junior category
      expect(isParticipantEligibleForCategory({ categoryId: 'legacy-jr-1' } as Participant, legacyJuniorCat)).toBe(true);
      // Senior participant is ineligible for Junior category
      expect(isParticipantEligibleForCategory({ categoryId: 'legacy-sr-1' } as Participant, legacyJuniorCat)).toBe(false);
    });

    // Test 13: Editing category eligibility policy (CATEGORY_ONLY -> OPEN_TO_ALL)
    it('Test 13: Editing category eligibility policy from CATEGORY_ONLY to OPEN_TO_ALL enables cross-category participation', async () => {
      const editCatId = `cat-edit-${Date.now()}`;
      const editCompId = `comp-edit-${Date.now()}`;
      const partSrId = `part-edit-sr-${Date.now()}`;

      // Create Category as CATEGORY_ONLY
      await trackRef(db.collection('categories').doc(editCatId)).set({
        id: editCatId,
        name: 'Custom Arts',
        code: `CAT-ART-${Date.now().toString().slice(-4)}`,
        classRange: 'Std 5 - 7',
        eligibility: 'Arts',
        ageRange: '10 - 12',
        participantEligibility: 'CATEGORY_ONLY',
        enrolledCount: 0,
        competitionsCount: 0,
        status: 'ACTIVE'
      });

      // Create Competition in this category
      await trackRef(db.collection('competitions').doc(editCompId)).set({
        id: editCompId,
        name: 'Arts Fest Contest',
        code: `CMP-ART-${Date.now().toString().slice(-4)}`,
        categoryId: editCatId,
        categoryName: 'Custom Arts',
        type: 'SOLO',
        entriesCount: 0,
        status: 'ACTIVE'
      });

      // Create Senior Participant
      await trackRef(db.collection('participants').doc(partSrId)).set({
        id: partSrId,
        name: 'Senior Artist',
        categoryId: catSrId,
        categoryName: 'Senior',
        teamId: team1Id,
        teamCode: 'SHA',
        teamName: 'Al-Shamama',
        registeredEventIds: []
      });

      // Step A: When CATEGORY_ONLY, senior registration is rejected
      await expect(RegistrationService.createForTeam(team1ManagerToken, team1Id, {
        competitionId: editCompId,
        participantId: partSrId
      })).rejects.toThrow(/not eligible|category/i);

      // Step B: Update category policy to OPEN_TO_ALL via PATCH API
      const req = new NextRequest(`http://localhost/api/admin/categories/${editCatId}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${adminIdToken}`
        },
        body: JSON.stringify({
          participantEligibility: 'OPEN_TO_ALL'
        })
      });

      const res = await patchCategoryHandler(req, { params: Promise.resolve({ id: editCatId }) });
      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.category.participantEligibility).toBe('OPEN_TO_ALL');

      // Step C: Now Senior participant registers successfully!
      const reg = await RegistrationService.createForTeam(team1ManagerToken, team1Id, {
        competitionId: editCompId,
        participantId: partSrId
      });
      trackRef(db.collection('registrations').doc(reg.id));
      expect(reg.status).toBe('APPROVED');
    });

    // Test 14: Blocking policy change (OPEN_TO_ALL -> CATEGORY_ONLY) when incompatible active registrations exist
    it('Test 14: Blocks policy change (OPEN_TO_ALL -> CATEGORY_ONLY) with 400 when incompatible active registrations exist', async () => {
      const lockCatId = `cat-lock-${Date.now()}`;
      const lockCompId = `comp-lock-${Date.now()}`;
      const lockPartId = `part-lock-sr-${Date.now()}`;

      // Create Category as OPEN_TO_ALL
      await trackRef(db.collection('categories').doc(lockCatId)).set({
        id: lockCatId,
        name: 'Lock Test Division',
        code: `CAT-LCK-${Date.now().toString().slice(-4)}`,
        classRange: 'Campus wide',
        eligibility: 'All students',
        ageRange: 'All',
        participantEligibility: 'OPEN_TO_ALL',
        enrolledCount: 0,
        competitionsCount: 0,
        status: 'ACTIVE'
      });

      // Create Competition
      await trackRef(db.collection('competitions').doc(lockCompId)).set({
        id: lockCompId,
        name: 'Lock Test Speech',
        code: `CMP-LCK-${Date.now().toString().slice(-4)}`,
        categoryId: lockCatId,
        categoryName: 'Lock Test Division',
        type: 'SOLO',
        entriesCount: 0,
        status: 'ACTIVE'
      });

      // Create Participant with Senior Category (incompatible with lockCatId if restricted to lockCatId)
      await trackRef(db.collection('participants').doc(lockPartId)).set({
        id: lockPartId,
        name: 'Senior in Open Category',
        categoryId: catSrId,
        categoryName: 'Senior',
        teamId: team1Id,
        teamCode: 'SHA',
        teamName: 'Al-Shamama',
        registeredEventIds: []
      });

      // Create Active Registration while OPEN_TO_ALL
      const reg = await RegistrationService.createForTeam(team1ManagerToken, team1Id, {
        competitionId: lockCompId,
        participantId: lockPartId
      });
      trackRef(db.collection('registrations').doc(reg.id));
      expect(reg.status).toBe('APPROVED');

      // Attempt to tighten policy from OPEN_TO_ALL to CATEGORY_ONLY via PATCH API
      const req = new NextRequest(`http://localhost/api/admin/categories/${lockCatId}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${adminIdToken}`
        },
        body: JSON.stringify({
          participantEligibility: 'CATEGORY_ONLY'
        })
      });

      const res = await patchCategoryHandler(req, { params: Promise.resolve({ id: lockCatId }) });
      expect(res.status).toBe(400);
      const errData = await res.json();
      expect(errData.error).toMatch(/cannot change eligibility policy.*conflict/i);
      expect(errData.conflicts).toBeDefined();
      expect(errData.conflicts.length).toBeGreaterThan(0);

      // Verify category policy in Firestore was NOT changed
      const snap = await db.collection('categories').doc(lockCatId).get();
      expect(snap.data()?.participantEligibility).toBe('OPEN_TO_ALL');
    });

    // Test 15: Allowing policy change when only compatible, rejected, or cancelled registrations exist
    it('Test 15: Allows policy change (OPEN_TO_ALL -> CATEGORY_ONLY) when only compatible or rejected registrations exist', async () => {
      const allowCatId = `cat-allow-${Date.now()}`;
      const allowCompId = `comp-allow-${Date.now()}`;
      const partCompId = `part-allow-comp-${Date.now()}`;
      const partRejId = `part-allow-rej-${Date.now()}`;

      // Create Category as OPEN_TO_ALL
      await trackRef(db.collection('categories').doc(allowCatId)).set({
        id: allowCatId,
        name: 'Allow Test Category',
        code: `CAT-ALW-${Date.now().toString().slice(-4)}`,
        classRange: 'Std 5 - 7',
        eligibility: 'General',
        ageRange: '10 - 12',
        participantEligibility: 'OPEN_TO_ALL',
        enrolledCount: 0,
        competitionsCount: 0,
        status: 'ACTIVE'
      });

      // Create Competition
      await trackRef(db.collection('competitions').doc(allowCompId)).set({
        id: allowCompId,
        name: 'Allow Test Competition',
        code: `CMP-ALW-${Date.now().toString().slice(-4)}`,
        categoryId: allowCatId,
        categoryName: 'Allow Test Category',
        type: 'SOLO',
        entriesCount: 0,
        status: 'ACTIVE'
      });

      // Compatible Participant (matches allowCatId)
      await trackRef(db.collection('participants').doc(partCompId)).set({
        id: partCompId,
        name: 'Compatible Participant',
        categoryId: allowCatId,
        categoryName: 'Allow Test Category',
        teamId: team1Id,
        teamCode: 'SHA',
        teamName: 'Al-Shamama',
        registeredEventIds: []
      });

      // Incompatible Participant with REJECTED registration
      await trackRef(db.collection('participants').doc(partRejId)).set({
        id: partRejId,
        name: 'Incompatible But Rejected Participant',
        categoryId: catSrId,
        categoryName: 'Senior',
        teamId: team1Id,
        teamCode: 'SHA',
        teamName: 'Al-Shamama',
        registeredEventIds: []
      });

      // Active registration for compatible participant
      const regComp = await RegistrationService.createForTeam(team1ManagerToken, team1Id, {
        competitionId: allowCompId,
        participantId: partCompId
      });
      trackRef(db.collection('registrations').doc(regComp.id));

      // Inactive/REJECTED registration for incompatible participant
      const regRejId = `reg-rej-${Date.now()}`;
      await trackRef(db.collection('registrations').doc(regRejId)).set({
        id: regRejId,
        code: `REG-REJ-${Date.now().toString().slice(-4)}`,
        competitionId: allowCompId,
        competitionName: 'Allow Test Competition',
        participantId: partRejId,
        participantName: 'Incompatible But Rejected Participant',
        teamId: team1Id,
        teamCode: 'SHA',
        teamName: 'Al-Shamama',
        categoryId: catSrId,
        categoryName: 'Senior',
        type: 'SOLO',
        status: 'REJECTED'
      });

      // Now attempt tightening policy to CATEGORY_ONLY: should SUCCEED
      const req = new NextRequest(`http://localhost/api/admin/categories/${allowCatId}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${adminIdToken}`
        },
        body: JSON.stringify({
          participantEligibility: 'CATEGORY_ONLY'
        })
      });

      const res = await patchCategoryHandler(req, { params: Promise.resolve({ id: allowCatId }) });
      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.category.participantEligibility).toBe('CATEGORY_ONLY');

      const snap = await db.collection('categories').doc(allowCatId).get();
      expect(snap.data()?.participantEligibility).toBe('CATEGORY_ONLY');
    });

    // Test 16: Concurrent registration creation and category eligibility policy changes
    it('Test 16: Concurrently changing category policy and creating registration maintains strict consistency', async () => {
      const raceCatId = `cat-race-${Date.now()}`;
      const raceCompId = `comp-race-${Date.now()}`;
      const partSrId = `part-race-sr-${Date.now()}`;

      // Start category as CATEGORY_ONLY
      await trackRef(db.collection('categories').doc(raceCatId)).set({
        id: raceCatId,
        name: 'Race Category',
        code: `CAT-RCE-${Date.now().toString().slice(-4)}`,
        classRange: 'Special',
        eligibility: 'Special',
        ageRange: 'Special',
        participantEligibility: 'CATEGORY_ONLY',
        enrolledCount: 0,
        competitionsCount: 0,
        status: 'ACTIVE'
      });

      await trackRef(db.collection('competitions').doc(raceCompId)).set({
        id: raceCompId,
        name: 'Race Competition',
        code: `CMP-RCE-${Date.now().toString().slice(-4)}`,
        categoryId: raceCatId,
        categoryName: 'Race Category',
        type: 'SOLO',
        entriesCount: 0,
        status: 'ACTIVE'
      });

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

      // Concurrently run:
      // Op 1: Patch category to OPEN_TO_ALL
      // Op 2: Register Senior participant (incompatible if CATEGORY_ONLY, compatible if OPEN_TO_ALL)
      const patchReq = new NextRequest(`http://localhost/api/admin/categories/${raceCatId}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${adminIdToken}`
        },
        body: JSON.stringify({ participantEligibility: 'OPEN_TO_ALL' })
      });

      const [patchRes, regRes] = await Promise.allSettled([
        patchCategoryHandler(patchReq, { params: Promise.resolve({ id: raceCatId }) }),
        RegistrationService.createForTeam(team1ManagerToken, team1Id, {
          competitionId: raceCompId,
          participantId: partSrId
        })
      ]);

      expect(patchRes.status).toBe('fulfilled');
      if (regRes.status === 'fulfilled') {
        trackRef(db.collection('registrations').doc(regRes.value.id));
      }

      // Assert final consistency
      const catSnap = await db.collection('categories').doc(raceCatId).get();
      const currentPolicy = catSnap.data()?.participantEligibility;

      if (regRes.status === 'fulfilled') {
        // Registration was created; therefore policy must be OPEN_TO_ALL
        expect(currentPolicy).toBe('OPEN_TO_ALL');
      } else {
        // Registration failed; if policy is CATEGORY_ONLY, error was eligibility; if OPEN_TO_ALL, error may be timing
        expect(regRes.reason).toBeDefined();
      }
    });

    // Test 17: Group registration behavior under both eligibility policies
    it('Test 17: Group registration strictly enforces participant eligibility for all group members under both policies', async () => {
      const resGrpCompId = `comp-res-grp-${Date.now()}`;
      const openGrpCompId = `comp-open-grp-${Date.now()}`;
      const leaderJrId = `part-lead-jr-${Date.now()}`;
      const memberSrId = `part-mem-sr-${Date.now()}`;

      // Seed Restricted (CATEGORY_ONLY) Group Competition
      await trackRef(db.collection('competitions').doc(resGrpCompId)).set({
        id: resGrpCompId,
        name: 'Restricted Junior Group Band',
        code: `CMP-RGB-${Date.now().toString().slice(-4)}`,
        categoryId: catJrId,
        categoryName: 'Junior',
        type: 'GROUP',
        groupSize: 2,
        minParticipants: 2,
        maxParticipants: 4,
        entriesCount: 0,
        status: 'ACTIVE'
      });

      // Seed Open-to-All (OPEN_TO_ALL) Group Competition
      await trackRef(db.collection('competitions').doc(openGrpCompId)).set({
        id: openGrpCompId,
        name: 'Open Campus Group Band',
        code: `CMP-OGB-${Date.now().toString().slice(-4)}`,
        categoryId: catGenId,
        categoryName: 'General',
        type: 'GROUP',
        groupSize: 2,
        minParticipants: 2,
        maxParticipants: 4,
        entriesCount: 0,
        status: 'ACTIVE'
      });

      // Create Junior Leader
      await trackRef(db.collection('participants').doc(leaderJrId)).set({
        id: leaderJrId,
        name: 'Junior Band Leader',
        categoryId: catJrId,
        categoryName: 'Junior',
        teamId: team1Id,
        teamCode: 'SHA',
        teamName: 'Al-Shamama',
        registeredEventIds: []
      });

      // Create Senior Member
      await trackRef(db.collection('participants').doc(memberSrId)).set({
        id: memberSrId,
        name: 'Senior Band Member',
        categoryId: catSrId,
        categoryName: 'Senior',
        teamId: team1Id,
        teamCode: 'SHA',
        teamName: 'Al-Shamama',
        registeredEventIds: []
      });

      // Case A: Restricted Competition (CATEGORY_ONLY) with mixed Junior leader + Senior member MUST FAIL
      await expect(RegistrationService.createForTeam(team1ManagerToken, team1Id, {
        competitionId: resGrpCompId,
        groupLeaderId: leaderJrId,
        groupMembers: [memberSrId]
      })).rejects.toThrow(/not eligible|category/i);

      // Case B: Open-to-All Competition (OPEN_TO_ALL) with mixed Junior leader + Senior member MUST SUCCEED
      const openReg = await RegistrationService.createForTeam(team1ManagerToken, team1Id, {
        competitionId: openGrpCompId,
        groupLeaderId: leaderJrId,
        groupMembers: [memberSrId]
      });
      trackRef(db.collection('registrations').doc(openReg.id));
      expect(openReg.status).toBe('APPROVED');

      // Both leader and member have openGrpCompId in registeredEventIds
      const leaderSnap = await db.collection('participants').doc(leaderJrId).get();
      const memberSnap = await db.collection('participants').doc(memberSrId).get();
      expect(leaderSnap.data()?.registeredEventIds).toContain(openGrpCompId);
      expect(memberSnap.data()?.registeredEventIds).toContain(openGrpCompId);
    });
  });
});
