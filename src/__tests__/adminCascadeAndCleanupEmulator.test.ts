/**
 * Firebase Emulator Integration Test Suite
 * 
 * Verifies production safety enhancements:
 * 1. Authorization guardrails (401/403) on admin endpoints.
 * 2. Category dependency protection: rejects deletion when dependent competitions or participants exist.
 * 3. Competition cascade deletion: child-first batch execution, score recalculation, and multi-competition isolation.
 * 4. Failed deletes handling (404 on missing, no partial corruption).
 * 5. Admin-authorized dry-run inspection vs confirmed orphan cleanup.
 */

import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest';
import { initializeApp, deleteApp, FirebaseApp } from 'firebase/app';
import {
  getAuth as getClientAuth,
  connectAuthEmulator,
  signInWithEmailAndPassword,
  signOut,
  Auth as ClientAuth
} from 'firebase/auth';
import { NextRequest } from 'next/server';
import { getAdminDb } from '@/lib/firebase/admin';
import { DELETE as deleteCompetitionHandler } from '@/app/api/admin/competitions/[id]/route';
import { DELETE as deleteCategoryHandler } from '@/app/api/admin/categories/[id]/route';
import { POST as cleanupOrphanedHandler } from '@/app/api/admin/judge-assignments/cleanup-orphaned/route';
import { PointsLedgerService } from '@/services/pointsLedgerService';
import { PointsLedgerEntry } from '@/domain/ledger';

describe('Admin Cascade Deletion & Orphan Cleanup Emulator Integration', () => {
  let clientApp: FirebaseApp;
  let clientAuth: ClientAuth;
  let adminIdToken = '';
  let teamManagerToken = '';

  const db = getAdminDb();

  beforeAll(async () => {
    // 1. Initialize client app connected to Auth Emulator
    const appName = `cascade-test-app-${Date.now()}`;
    clientApp = initializeApp(
      {
        apiKey: 'demo-api-key',
        projectId: 'demo-sahithyolsav-2025',
        authDomain: 'demo-sahithyolsav-2025.firebaseapp.com'
      },
      appName
    );

    clientAuth = getClientAuth(clientApp);
    connectAuthEmulator(clientAuth, 'http://127.0.0.1:9099', { disableWarnings: true });

    // 2. Obtain real Admin ID token
    const adminCred = await signInWithEmailAndPassword(
      clientAuth,
      'admin@sahithyolsav.com',
      'AdminPassword123!'
    );
    adminIdToken = await adminCred.user.getIdToken();
    await signOut(clientAuth);

    // 3. Obtain real Team Manager ID token (non-admin)
    const tmCred = await signInWithEmailAndPassword(
      clientAuth,
      'manager.shamama@sahithyolsav.com',
      'TeamPassword123!'
    );
    teamManagerToken = await tmCred.user.getIdToken();
    await signOut(clientAuth);
  });

  afterAll(async () => {
    if (clientApp) {
      await deleteApp(clientApp).catch(() => {});
    }
  });

  describe('1. Endpoint Authorization Guardrails', () => {
    it('rejects DELETE /api/admin/competitions/[id] without authorization header (401)', async () => {
      const req = new NextRequest('http://localhost/api/admin/competitions/cmp-test', {
        method: 'DELETE'
      });
      const res = await deleteCompetitionHandler(req, { params: Promise.resolve({ id: 'cmp-test' }) });
      expect(res.status).toBe(401);
      const data = await res.json();
      expect(data.error).toContain('Unauthorized');
    });

    it('rejects DELETE /api/admin/competitions/[id] with non-admin manager token (403)', async () => {
      const req = new NextRequest('http://localhost/api/admin/competitions/cmp-test', {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${teamManagerToken}` }
      });
      const res = await deleteCompetitionHandler(req, { params: Promise.resolve({ id: 'cmp-test' }) });
      expect(res.status).toBe(403);
      const data = await res.json();
      expect(data.error).toMatch(/ADMIN|Administrator/i);
    });

    it('rejects DELETE /api/admin/categories/[id] without authorization header (401)', async () => {
      const req = new NextRequest('http://localhost/api/admin/categories/cat-test', {
        method: 'DELETE'
      });
      const res = await deleteCategoryHandler(req, { params: Promise.resolve({ id: 'cat-test' }) });
      expect(res.status).toBe(401);
      const data = await res.json();
      expect(data.error).toContain('Unauthorized');
    });

    it('rejects DELETE /api/admin/categories/[id] with non-admin manager token (403)', async () => {
      const req = new NextRequest('http://localhost/api/admin/categories/cat-test', {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${teamManagerToken}` }
      });
      const res = await deleteCategoryHandler(req, { params: Promise.resolve({ id: 'cat-test' }) });
      expect(res.status).toBe(403);
      const data = await res.json();
      expect(data.error).toMatch(/ADMIN|Administrator/i);
    });

    it('rejects POST /api/admin/judge-assignments/cleanup-orphaned without authorization header (401)', async () => {
      const req = new NextRequest('http://localhost/api/admin/judge-assignments/cleanup-orphaned', {
        method: 'POST'
      });
      const res = await cleanupOrphanedHandler(req);
      expect(res.status).toBe(401);
      const data = await res.json();
      expect(data.error).toContain('Unauthorized');
    });

    it('rejects POST /api/admin/judge-assignments/cleanup-orphaned with non-admin manager token (403)', async () => {
      const req = new NextRequest('http://localhost/api/admin/judge-assignments/cleanup-orphaned', {
        method: 'POST',
        headers: { Authorization: `Bearer ${teamManagerToken}` }
      });
      const res = await cleanupOrphanedHandler(req);
      expect(res.status).toBe(403);
      const data = await res.json();
      expect(data.error).toMatch(/ADMIN|Administrator/i);
    });
  });

  describe('2. Category Dependency Protection & Failed Deletes', () => {
    it('returns 404 when attempting to delete non-existent category', async () => {
      const req = new NextRequest('http://localhost/api/admin/categories/non-existent-cat-999', {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${adminIdToken}` }
      });
      const res = await deleteCategoryHandler(req, { params: Promise.resolve({ id: 'non-existent-cat-999' }) });
      expect(res.status).toBe(404);
      const data = await res.json();
      expect(data.error).toContain('not found');
    });

    it('prevents deletion of category with dependent competitions (400 Bad Request)', async () => {
      if (!db) throw new Error('Firestore DB unavailable');

      const catId = 'cat-dep-comp-test';
      const compId = 'cmp-dep-comp-test';

      // Seed category and dependent competition
      await db.collection('categories').doc(catId).set({
        id: catId,
        name: 'Dependent Category',
        code: 'CAT-DEP',
        status: 'ACTIVE'
      });
      await db.collection('competitions').doc(compId).set({
        id: compId,
        categoryId: catId,
        name: 'Dependent Competition',
        code: 'CMP-DEP'
      });

      const req = new NextRequest(`http://localhost/api/admin/categories/${catId}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${adminIdToken}` }
      });
      const res = await deleteCategoryHandler(req, { params: Promise.resolve({ id: catId }) });
      expect(res.status).toBe(400);
      const data = await res.json();
      expect(data.error).toMatch(/active competition/i);
      expect(data.dependentCompetitionsCount).toBe(1);

      // Verify category was NOT deleted from Firestore
      const catCheck = await db.collection('categories').doc(catId).get();
      expect(catCheck.exists).toBe(true);

      // Cleanup test documents
      await db.collection('competitions').doc(compId).delete();
      await db.collection('categories').doc(catId).delete();
    });

    it('prevents deletion of category with enrolled participants (400 Bad Request)', async () => {
      if (!db) throw new Error('Firestore DB unavailable');

      const catId = 'cat-dep-part-test';
      const partId = 'part-dep-test';

      // Seed category and participant
      await db.collection('categories').doc(catId).set({
        id: catId,
        name: 'Participant Dep Category',
        code: 'CAT-PDEP',
        status: 'ACTIVE'
      });
      await db.collection('participants').doc(partId).set({
        id: partId,
        categoryId: catId,
        name: 'Enrolled Student',
        teamId: 'team-1'
      });

      const req = new NextRequest(`http://localhost/api/admin/categories/${catId}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${adminIdToken}` }
      });
      const res = await deleteCategoryHandler(req, { params: Promise.resolve({ id: catId }) });
      expect(res.status).toBe(400);
      const data = await res.json();
      expect(data.error).toMatch(/participant/i);
      expect(data.dependentParticipantsCount).toBe(1);

      // Verify category still exists
      const catCheck = await db.collection('categories').doc(catId).get();
      expect(catCheck.exists).toBe(true);

      // Cleanup test documents
      await db.collection('participants').doc(partId).delete();
      await db.collection('categories').doc(catId).delete();
    });

    it('successfully deletes category with zero dependencies', async () => {
      if (!db) throw new Error('Firestore DB unavailable');

      const catId = 'cat-empty-safe-test';
      await db.collection('categories').doc(catId).set({
        id: catId,
        name: 'Empty Category',
        code: 'CAT-EMPTY',
        status: 'ACTIVE'
      });

      const req = new NextRequest(`http://localhost/api/admin/categories/${catId}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${adminIdToken}` }
      });
      const res = await deleteCategoryHandler(req, { params: Promise.resolve({ id: catId }) });
      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.success).toBe(true);

      // Verify category is permanently deleted
      const catCheck = await db.collection('categories').doc(catId).get();
      expect(catCheck.exists).toBe(false);
    });
  });

  describe('3. Competition Cascade Deletion, Multi-Competition Isolation & Score Recalculation', () => {
    it('returns 404 when attempting to delete non-existent competition', async () => {
      const req = new NextRequest('http://localhost/api/admin/competitions/non-existent-comp-888', {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${adminIdToken}` }
      });
      const res = await deleteCompetitionHandler(req, { params: Promise.resolve({ id: 'non-existent-comp-888' }) });
      expect(res.status).toBe(404);
      const data = await res.json();
      expect(data.error).toContain('not found');
    });

    it('deletes child data first, recalculates leaderboard, and preserves isolated competitions', async () => {
      if (!db) throw new Error('Firestore DB unavailable');

      const compAId = 'cmp-cascade-alpha';
      const compBId = 'cmp-cascade-beta';
      const team1Id = 'team-cascade-1';
      const team2Id = 'team-cascade-2';

      // Clean up any stale records from previous aborted runs
      const oldPts1 = await db.collection('pointsLedger').where('teamId', '==', team1Id).get();
      for (const d of oldPts1.docs) await d.ref.delete();
      const oldPts2 = await db.collection('pointsLedger').where('teamId', '==', team2Id).get();
      for (const d of oldPts2.docs) await d.ref.delete();

      // 1. Seed base teams in Firestore
      await db.collection('teams').doc(team1Id).set({
        id: team1Id,
        name: 'Team Alpha',
        code: 'TMA',
        color: '#2563EB',
        totalPoints: 0,
        soloPoints: 0,
        groupPoints: 0,
        firstCount: 0,
        secondCount: 0,
        thirdCount: 0,
        rank: 1
      });

      await db.collection('teams').doc(team2Id).set({
        id: team2Id,
        name: 'Team Beta',
        code: 'TMB',
        color: '#059669',
        totalPoints: 0,
        soloPoints: 0,
        groupPoints: 0,
        firstCount: 0,
        secondCount: 0,
        thirdCount: 0,
        rank: 2
      });

      // 2. Seed Competition A and its related records
      await db.collection('competitions').doc(compAId).set({
        id: compAId,
        name: 'Competition Alpha',
        code: 'CMP-A',
        type: 'SOLO'
      });
      await db.collection('judgeAssignments').doc(`asgn-${compAId}`).set({
        id: `asgn-${compAId}`,
        competitionId: compAId,
        judgeName: 'Judge Alpha'
      });
      await db.collection('markEntries').doc(`mark-${compAId}`).set({
        id: `mark-${compAId}`,
        competitionId: compAId,
        status: 'SUBMITTED'
      });
      await db.collection('registrations').doc(`reg-${compAId}`).set({
        id: `reg-${compAId}`,
        competitionId: compAId,
        candidateName: 'Candidate Alpha'
      });
      await db.collection('schedules').doc(`sched-${compAId}`).set({
        id: `sched-${compAId}`,
        competitionId: compAId
      });
      await db.collection('results').doc(`res-${compAId}`).set({
        id: `res-${compAId}`,
        competitionId: compAId,
        competitionName: 'Competition Alpha',
        status: 'PUBLISHED'
      });
      const pointsEntryA: PointsLedgerEntry = {
        id: `points-${compAId}-1`,
        resultId: `res-${compAId}`,
        competitionId: compAId,
        competitionCode: 'CMP-A',
        competitionName: 'Competition Alpha',
        competitionType: 'SOLO',
        teamId: team1Id,
        teamCode: 'TMA',
        teamName: 'Team Alpha',
        registrationId: `reg-${compAId}`,
        candidateName: 'Candidate Alpha',
        bib: '101',
        score: 95,
        rank: 1,
        grade: 'A',
        points: 10,
        status: 'COMMITTED',
        publishedAt: new Date().toISOString()
      };
      await db.collection('pointsLedger').doc(pointsEntryA.id).set(pointsEntryA);

      // 3. Seed Competition B (Isolated sibling competition) and its related records
      await db.collection('competitions').doc(compBId).set({
        id: compBId,
        name: 'Competition Beta',
        code: 'CMP-B',
        type: 'SOLO'
      });
      await db.collection('judgeAssignments').doc(`asgn-${compBId}`).set({
        id: `asgn-${compBId}`,
        competitionId: compBId,
        judgeName: 'Judge Beta'
      });
      await db.collection('markEntries').doc(`mark-${compBId}`).set({
        id: `mark-${compBId}`,
        competitionId: compBId,
        status: 'SUBMITTED'
      });
      await db.collection('registrations').doc(`reg-${compBId}`).set({
        id: `reg-${compBId}`,
        competitionId: compBId,
        candidateName: 'Candidate Beta'
      });
      await db.collection('schedules').doc(`sched-${compBId}`).set({
        id: `sched-${compBId}`,
        competitionId: compBId
      });
      await db.collection('results').doc(`res-${compBId}`).set({
        id: `res-${compBId}`,
        competitionId: compBId,
        competitionName: 'Competition Beta',
        status: 'PUBLISHED'
      });
      const pointsEntryB: PointsLedgerEntry = {
        id: `points-${compBId}-1`,
        resultId: `res-${compBId}`,
        competitionId: compBId,
        competitionCode: 'CMP-B',
        competitionName: 'Competition Beta',
        competitionType: 'SOLO',
        teamId: team2Id,
        teamCode: 'TMB',
        teamName: 'Team Beta',
        registrationId: `reg-${compBId}`,
        candidateName: 'Candidate Beta',
        bib: '201',
        score: 90,
        rank: 1,
        grade: 'A',
        points: 15,
        status: 'COMMITTED',
        publishedAt: new Date().toISOString()
      };
      await db.collection('pointsLedger').doc(pointsEntryB.id).set(pointsEntryB);

      // 4. Initial championship sync
      await PointsLedgerService.syncLeaderboardFromLedger();

      // Verify initial points: Team 1 has 10 points, Team 2 has 15 points
      const team1Pre = await db.collection('teams').doc(team1Id).get();
      const team2Pre = await db.collection('teams').doc(team2Id).get();
      expect(team1Pre.data()?.totalPoints).toBe(10);
      expect(team2Pre.data()?.totalPoints).toBe(15);

      // 5. Execute Cascade Deletion on Competition A via Admin API
      const req = new NextRequest(`http://localhost/api/admin/competitions/${compAId}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${adminIdToken}` }
      });
      const res = await deleteCompetitionHandler(req, { params: Promise.resolve({ id: compAId }) });
      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.success).toBe(true);
      expect(data.deletedCompetitionId).toBe(compAId);
      expect(data.recalculatedLeaderboard).toBe(true);

      // 6. Verify Competition A and all its child documents are deleted
      const compACheck = await db.collection('competitions').doc(compAId).get();
      expect(compACheck.exists).toBe(false);

      const asgnACheck = await db.collection('judgeAssignments').doc(`asgn-${compAId}`).get();
      expect(asgnACheck.exists).toBe(false);

      const markACheck = await db.collection('markEntries').doc(`mark-${compAId}`).get();
      expect(markACheck.exists).toBe(false);

      const regACheck = await db.collection('registrations').doc(`reg-${compAId}`).get();
      expect(regACheck.exists).toBe(false);

      const schedACheck = await db.collection('schedules').doc(`sched-${compAId}`).get();
      expect(schedACheck.exists).toBe(false);

      const resACheck = await db.collection('results').doc(`res-${compAId}`).get();
      expect(resACheck.exists).toBe(false);

      const pointsACheck = await db.collection('pointsLedger').doc(pointsEntryA.id).get();
      expect(pointsACheck.exists).toBe(false);

      // 7. Verify Score Recalculation: Team 1 points from Competition A are removed
      const team1Post = await db.collection('teams').doc(team1Id).get();
      expect(team1Post.data()?.totalPoints).toBe(0);

      // 8. Verify Multi-Competition Isolation: Competition B and its records are 100% UNTOUCHED
      const compBCheck = await db.collection('competitions').doc(compBId).get();
      expect(compBCheck.exists).toBe(true);

      const asgnBCheck = await db.collection('judgeAssignments').doc(`asgn-${compBId}`).get();
      expect(asgnBCheck.exists).toBe(true);

      const markBCheck = await db.collection('markEntries').doc(`mark-${compBId}`).get();
      expect(markBCheck.exists).toBe(true);

      const regBCheck = await db.collection('registrations').doc(`reg-${compBId}`).get();
      expect(regBCheck.exists).toBe(true);

      const schedBCheck = await db.collection('schedules').doc(`sched-${compBId}`).get();
      expect(schedBCheck.exists).toBe(true);

      const resBCheck = await db.collection('results').doc(`res-${compBId}`).get();
      expect(resBCheck.exists).toBe(true);

      const pointsBCheck = await db.collection('pointsLedger').doc(pointsEntryB.id).get();
      expect(pointsBCheck.exists).toBe(true);

      const team2Post = await db.collection('teams').doc(team2Id).get();
      expect(team2Post.data()?.totalPoints).toBe(15);

      // Fast cleanup of test records in a single batch
      const cleanupBatch = db.batch();
      cleanupBatch.delete(db.collection('competitions').doc(compBId));
      cleanupBatch.delete(db.collection('judgeAssignments').doc(`asgn-${compBId}`));
      cleanupBatch.delete(db.collection('markEntries').doc(`mark-${compBId}`));
      cleanupBatch.delete(db.collection('registrations').doc(`reg-${compBId}`));
      cleanupBatch.delete(db.collection('schedules').doc(`sched-${compBId}`));
      cleanupBatch.delete(db.collection('results').doc(`res-${compBId}`));
      cleanupBatch.delete(db.collection('pointsLedger').doc(pointsEntryB.id));
      cleanupBatch.delete(db.collection('teams').doc(team1Id));
      cleanupBatch.delete(db.collection('teams').doc(team2Id));
      await cleanupBatch.commit();
    }, 120000);

    it('handles injected recalculation failure: preserves parent competition on failure and restores leaderboard on retry', async () => {
      if (!db) throw new Error('Firestore DB unavailable');

      const failCompId = 'cmp-fail-recalc';
      const failPointsId = `points-${failCompId}-1`;

      // 1. Seed dedicated team for this test
      await db.collection('teams').doc('team-recalc-1').set({
        id: 'team-recalc-1',
        name: 'Team Recalc',
        code: 'TRC',
        color: '#2563EB',
        totalPoints: 0,
        soloPoints: 0,
        groupPoints: 0,
        firstCount: 0,
        secondCount: 0,
        thirdCount: 0,
        rank: 1
      });

      // 2. Seed competition, child result, and committed points
      await db.collection('competitions').doc(failCompId).set({
        id: failCompId,
        name: 'Recalc Failure Test Competition',
        code: 'CMP-RFAIL',
        type: 'SOLO',
        status: 'PUBLISHED'
      });
      await db.collection('results').doc(`res-${failCompId}`).set({
        id: `res-${failCompId}`,
        competitionId: failCompId,
        status: 'PUBLISHED'
      });
      const pointsEntry: PointsLedgerEntry = {
        id: failPointsId,
        resultId: `res-${failCompId}`,
        competitionId: failCompId,
        competitionCode: 'CMP-RFAIL',
        competitionName: 'Recalc Failure Test Competition',
        competitionType: 'SOLO',
        teamId: 'team-recalc-1',
        teamCode: 'TRC',
        teamName: 'Team Recalc',
        registrationId: `reg-${failCompId}`,
        candidateName: 'Candidate Recalc',
        bib: '301',
        score: 98,
        rank: 1,
        grade: 'A',
        points: 25,
        status: 'COMMITTED',
        publishedAt: new Date().toISOString()
      };
      await db.collection('pointsLedger').doc(pointsEntry.id).set(pointsEntry);

      // 3. Sync leaderboard initially so team-recalc-1 reflects the 25 points
      await PointsLedgerService.syncLeaderboardFromLedger();
      const teamBefore = await db.collection('teams').doc('team-recalc-1').get();
      expect(teamBefore.data()?.totalPoints).toBe(25);

      // 4. Inject a failure into PointsLedgerService.syncLeaderboardFromLedger on Attempt 1
      const syncSpy = vi.spyOn(PointsLedgerService, 'syncLeaderboardFromLedger')
        .mockRejectedValueOnce(new Error('Simulated transient error during championship recalculation'));

      const req1 = new NextRequest(`http://localhost/api/admin/competitions/${failCompId}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${adminIdToken}` }
      });
      const res1 = await deleteCompetitionHandler(req1, { params: Promise.resolve({ id: failCompId }) });
      expect(res1.status).toBeGreaterThanOrEqual(400);

      // 5. Verify Failure-Safety:
      // - The child points were deleted in attempt 1
      const pointsCheck = await db.collection('pointsLedger').doc(failPointsId).get();
      expect(pointsCheck.exists).toBe(false);
      // - BUT the parent competition document was NOT deleted!
      const parentCompCheck = await db.collection('competitions').doc(failCompId).get();
      expect(parentCompCheck.exists).toBe(true);

      // 6. Attempt 2 (Retry): Re-attempt deletion now that the transient failure is resolved
      syncSpy.mockRestore();
      const req2 = new NextRequest(`http://localhost/api/admin/competitions/${failCompId}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${adminIdToken}` }
      });
      const res2 = await deleteCompetitionHandler(req2, { params: Promise.resolve({ id: failCompId }) });
      expect(res2.status).toBe(200);
      const data2 = await res2.json();
      expect(data2.success).toBe(true);
      expect(data2.deletedCompetitionId).toBe(failCompId);

      // 7. Verify Idempotent Recovery:
      // - Leaderboard was recalculated on retry: team-recalc-1 points reduced to 0!
      const teamAfter = await db.collection('teams').doc('team-recalc-1').get();
      expect(teamAfter.data()?.totalPoints).toBe(0);
      // - Parent competition document is now safely deleted
      const parentAfter = await db.collection('competitions').doc(failCompId).get();
      expect(parentAfter.exists).toBe(false);

      // Cleanup
      await db.collection('teams').doc('team-recalc-1').delete();
    }, 120000);

    it('handles injected batch deletion failure: preserves parent competition on failure and cleans up on retry', async () => {
      if (!db) throw new Error('Firestore DB unavailable');

      const failBatchCompId = 'cmp-fail-batch';

      // 1. Seed competition and judge assignment
      await db.collection('competitions').doc(failBatchCompId).set({
        id: failBatchCompId,
        name: 'Batch Failure Test Competition',
        code: 'CMP-BFAIL',
        type: 'SOLO'
      });
      await db.collection('judgeAssignments').doc(`asgn-${failBatchCompId}`).set({
        id: `asgn-${failBatchCompId}`,
        competitionId: failBatchCompId,
        judgeName: 'Judge Batch Fail'
      });

      // 2. Inject failure on first batch commit
      const originalBatch = db.batch.bind(db);
      let batchCommitCalls = 0;
      const batchSpy = vi.spyOn(db, 'batch').mockImplementation(() => {
        const b = originalBatch();
        return {
          ...b,
          commit: async () => {
            batchCommitCalls++;
            if (batchCommitCalls === 1) {
              throw new Error('Simulated Firestore batch commit failure');
            }
            return b.commit();
          }
        } as any;
      });

      // Attempt 1: Should fail during batch commit
      const req1 = new NextRequest(`http://localhost/api/admin/competitions/${failBatchCompId}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${adminIdToken}` }
      });
      const res1 = await deleteCompetitionHandler(req1, { params: Promise.resolve({ id: failBatchCompId }) });
      expect(res1.status).toBeGreaterThanOrEqual(400);

      // Verify Failure-Safety: Parent competition document was NOT deleted!
      const compDocAttempt1 = await db.collection('competitions').doc(failBatchCompId).get();
      expect(compDocAttempt1.exists).toBe(true);

      // Attempt 2 (Retry): Restore batch and retry deletion
      batchSpy.mockRestore();
      const req2 = new NextRequest(`http://localhost/api/admin/competitions/${failBatchCompId}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${adminIdToken}` }
      });
      const res2 = await deleteCompetitionHandler(req2, { params: Promise.resolve({ id: failBatchCompId }) });
      expect(res2.status).toBe(200);

      // Verify both parent and child are now deleted
      const compDocFinal = await db.collection('competitions').doc(failBatchCompId).get();
      expect(compDocFinal.exists).toBe(false);
      const asgnDocFinal = await db.collection('judgeAssignments').doc(`asgn-${failBatchCompId}`).get();
      expect(asgnDocFinal.exists).toBe(false);
    }, 120000);
  });

  describe('4. Admin-Authorized Dry-Run vs Confirmed Orphan Cleanup', () => {
    it('dry-run previews orphaned records without modifying any records in Firestore', async () => {
      if (!db) throw new Error('Firestore DB unavailable');

      const orphanCompId = 'cmp-fake-deleted-123';
      const orphanAsgnId = 'asgn-orphan-dry-1';
      const orphanMarkId = 'mark-orphan-dry-1';

      // Seed orphaned records referencing a non-existent competition
      await db.collection('judgeAssignments').doc(orphanAsgnId).set({
        id: orphanAsgnId,
        competitionId: orphanCompId,
        judgeName: 'Orphan Judge'
      });
      await db.collection('markEntries').doc(orphanMarkId).set({
        id: orphanMarkId,
        competitionId: orphanCompId,
        status: 'SUBMITTED'
      });

      // 1. Dry-Run request
      const dryReq = new NextRequest('http://localhost/api/admin/judge-assignments/cleanup-orphaned', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${adminIdToken}`
        },
        body: JSON.stringify({ dryRun: true })
      });

      const dryRes = await cleanupOrphanedHandler(dryReq);
      expect(dryRes.status).toBe(200);
      const dryData = await dryRes.json();
      expect(dryData.success).toBe(true);
      expect(dryData.dryRun).toBe(true);
      expect(dryData.requiresConfirmation).toBe(true);
      expect(dryData.totalOrphaned).toBeGreaterThanOrEqual(2);
      expect(dryData.orphanedJudgeAssignmentsCount).toBeGreaterThanOrEqual(1);
      expect(dryData.orphanedMarkEntriesCount).toBeGreaterThanOrEqual(1);

      // Crucially verify documents STILL exist in Firestore!
      const asgnStillExists = await db.collection('judgeAssignments').doc(orphanAsgnId).get();
      const markStillExists = await db.collection('markEntries').doc(orphanMarkId).get();
      expect(asgnStillExists.exists).toBe(true);
      expect(markStillExists.exists).toBe(true);

      // 2. Confirmed cleanup request
      const confirmReq = new NextRequest('http://localhost/api/admin/judge-assignments/cleanup-orphaned', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${adminIdToken}`
        },
        body: JSON.stringify({ confirm: true })
      });

      const confirmRes = await cleanupOrphanedHandler(confirmReq);
      expect(confirmRes.status).toBe(200);
      const confirmData = await confirmRes.json();
      expect(confirmData.success).toBe(true);
      expect(confirmData.confirmed).toBe(true);
      expect(confirmData.dryRun).toBe(false);
      expect(confirmData.removedJudgeAssignments).toBeGreaterThanOrEqual(1);
      expect(confirmData.removedMarkEntries).toBeGreaterThanOrEqual(1);

      // Verify documents are now permanently removed from Firestore!
      const asgnDeleted = await db.collection('judgeAssignments').doc(orphanAsgnId).get();
      const markDeleted = await db.collection('markEntries').doc(orphanMarkId).get();
      expect(asgnDeleted.exists).toBe(false);
      expect(markDeleted.exists).toBe(false);
    });
  });
});
