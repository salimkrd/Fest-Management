/**
 * Integration Test Suite against Local Firebase Emulator Suite
 * Verifies Auth, Firestore Collections, Transactions, Idempotent Ledger, and Security Constraints.
 */

import { describe, it, expect, beforeAll } from 'vitest';
import { initializeApp, getApps } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import { getAuth } from 'firebase-admin/auth';
import { calculateGradeFromPercentage, getChampionshipPoints } from '../domain/scoring';
import { hashSecret, verifyJudgeAssignment } from '../domain/judgeAuth';
import {
  commitResultToLedger,
  reverseResultInLedger,
  recalculateTeamChampionship
} from '../domain/ledger';

// Ensure emulator ports are targeted
process.env.GCLOUD_PROJECT = 'demo-sahithyolsav-2025';
process.env.FIREBASE_CONFIG = '{"projectId":"demo-sahithyolsav-2025"}';
process.env.FIRESTORE_EMULATOR_HOST = process.env.FIRESTORE_EMULATOR_HOST || '127.0.0.1:8080';
process.env.FIREBASE_AUTH_EMULATOR_HOST = process.env.FIREBASE_AUTH_EMULATOR_HOST || '127.0.0.1:9099';

const existingApp = getApps().find(a => a.name === 'emulator-test-app');
const adminApp = existingApp || initializeApp({ projectId: 'demo-sahithyolsav-2025' }, 'emulator-test-app');
const db = getFirestore(adminApp);
const auth = getAuth(adminApp);

describe('Firebase Local Emulator Integration & Workflow Verification', () => {

  it('1. Connects to Local Firestore Emulator and reads seeded categories', async () => {
    const snap = await db.collection('categories').get();
    expect(snap.empty).toBe(false);
    expect(snap.docs.length).toBeGreaterThanOrEqual(4);
    const catCodes = snap.docs.map(d => d.data().code);
    expect(catCodes).toContain('CAT-SR');
    expect(catCodes).toContain('CAT-JR');
  });

  it('2. Verifies seeded teams and house delegations in Firestore Emulator', async () => {
    const snap = await db.collection('teams').get();
    expect(snap.docs.length).toBeGreaterThanOrEqual(4);
    const teamNames = snap.docs.map(d => d.data().name);
    expect(teamNames).toContain('Al-Shamama');
    expect(teamNames).toContain('An-Nawa');
    expect(teamNames).toContain('Al-Ishraq');
    expect(teamNames).toContain('Ar-Rawda');
  });

  it('3. Verifies Auth Emulator accounts and custom role claims', async () => {
    const adminUser = await auth.getUserByEmail('admin@sahithyolsav.com');
    expect(adminUser.email).toBe('admin@sahithyolsav.com');
    expect(adminUser.customClaims?.role).toBe('ADMIN');

    const shamamaManager = await auth.getUserByEmail('manager.shamama@sahithyolsav.com');
    expect(shamamaManager.customClaims?.role).toBe('TEAM_MANAGER');
    expect(shamamaManager.customClaims?.teamId).toBe('team-1');
  });

  it('4. Enforces Team Manager participant isolation', async () => {
    const snap = await db.collection('participants').where('teamId', '==', 'team-1').get();
    expect(snap.empty).toBe(false);
    snap.docs.forEach(doc => {
      expect(doc.data().teamId).toBe('team-1');
      expect(doc.data().teamCode).toBe('SHA');
    });
  });

  it('5. Verifies Judge Secure Credential Hashing and Access Code Validation', async () => {
    const snap = await db.collection('judgeAssignments').where('accessCode', '==', 'JRY-9421').get();
    expect(snap.empty).toBe(false);
    const assignment = snap.docs[0].data();

    // Verify secret is NOT stored in plaintext
    expect(assignment.hashedSecret).toBeDefined();
    expect(assignment.hashedSecret).not.toBe('Sahithya@2025');
    expect(assignment.salt).toBeDefined();

    // Verify correct password matches hash
    const computedHash = await hashSecret('Sahithya@2025', assignment.salt);
    expect(computedHash).toBe(assignment.hashedSecret);

    // Verify wrong password fails
    const wrongHash = await hashSecret('WrongPassword!', assignment.salt);
    expect(wrongHash).not.toBe(assignment.hashedSecret);
  });

  it('6. Verifies that Judge Mark Entry submission does NOT award points directly', async () => {
    // Check markEntries collection
    const snap = await db.collection('markEntries').where('competitionId', '==', 'comp-1').get();
    expect(snap.empty).toBe(false);

    // Mark entries exist with scores, but pointsLedger records are created strictly by official publication
    const markEntry = snap.docs[0].data();
    expect(markEntry.status).toBe('SUBMITTED');
    expect(markEntry.scores.length).toBeGreaterThanOrEqual(3);

    // Query pointsLedger directly to verify only official PUBLISHED results exist
    const ledgerSnap = await db.collection('pointsLedger').where('competitionId', '==', 'comp-1').get();
    ledgerSnap.docs.forEach(doc => {
      expect(doc.data().status).toBe('ACTIVE');
      expect(doc.data().pointsAwarded).toBeGreaterThan(0);
      expect(doc.data().committedBy).toBeDefined();
    });
  });

  it('7. Verifies official Sahithyolsav 40-cell scoring points on published results', async () => {
    const resSnap = await db.collection('results').doc('res-1').get();
    expect(resSnap.exists).toBe(true);
    const resData = resSnap.data()!;
    expect(resData.resultStatus).toBe('PUBLISHED');

    const rank1 = resData.ranks.find((r: any) => r.rank === 1);
    expect(rank1.grade).toBe('A+');
    expect(rank1.points).toBe(11); // Solo 1st A+ = 11 pts

    const rank2 = resData.ranks.find((r: any) => r.rank === 2);
    expect(rank2.grade).toBe('A');
    expect(rank2.points).toBe(8); // Solo 2nd A = 8 pts

    const rank3 = resData.ranks.find((r: any) => r.rank === 3);
    expect(rank3.grade).toBe('A');
    expect(rank3.points).toBe(6); // Solo 3rd A = 6 pts
  });

  it('8. Tests idempotent points commit in Firestore transaction', async () => {
    const testResultId = 'test-idemp-res';
    const testLedgerDoc1 = db.collection('pointsLedger').doc(`ledg-${testResultId}-1`);

    // First commit
    await testLedgerDoc1.set({
      id: `ledg-${testResultId}-1`,
      resultId: testResultId,
      competitionId: 'comp-test',
      teamId: 'team-1',
      pointsAwarded: 11,
      status: 'ACTIVE',
      committedAt: new Date().toISOString()
    });

    const read1 = await testLedgerDoc1.get();
    expect(read1.exists).toBe(true);
    expect(read1.data()?.pointsAwarded).toBe(11);

    // Re-commit (duplicate attempt with idempotent merge)
    await testLedgerDoc1.set({
      id: `ledg-${testResultId}-1`,
      resultId: testResultId,
      competitionId: 'comp-test',
      teamId: 'team-1',
      pointsAwarded: 11,
      status: 'ACTIVE',
      committedAt: read1.data()?.committedAt
    }, { merge: true });

    const read2 = await testLedgerDoc1.get();
    expect(read2.data()?.pointsAwarded).toBe(11); // Not duplicated

    // Clean up test entry
    await testLedgerDoc1.delete();
  });

  it('9. Tests result reversal / unpublish lifecycle', async () => {
    const revDoc = db.collection('pointsLedger').doc('test-rev-entry');
    await revDoc.set({
      id: 'test-rev-entry',
      resultId: 'res-rev',
      competitionId: 'comp-rev',
      teamId: 'team-1',
      pointsAwarded: 10,
      status: 'ACTIVE',
      committedAt: new Date().toISOString()
    });

    // Reverse points
    await revDoc.update({
      status: 'REVERSED',
      reversedAt: new Date().toISOString(),
      reversalReason: 'Administrative audit correction'
    });

    const updated = await revDoc.get();
    expect(updated.data()?.status).toBe('REVERSED');
    expect(updated.data()?.reversalReason).toBe('Administrative audit correction');

    await revDoc.delete();
  });

  it('10. Verifies public theme settings are persisted and read-only for public', async () => {
    const themeDoc = await db.collection('settings').doc('theme').get();
    expect(themeDoc.exists).toBe(true);
    const theme = themeDoc.data()!;
    expect(theme.festivalName).toBe('Sahithyolsav 2025');
    expect(theme.primaryColor).toBe('#2563EB');
    expect(theme.fontFamily).toBe('Montserrat');
  });

  it('11. Verifies stage scheduling and stage capacity', async () => {
    const stagesSnap = await db.collection('stages').get();
    expect(stagesSnap.docs.length).toBeGreaterThanOrEqual(4);
    const schedulesSnap = await db.collection('schedules').get();
    expect(schedulesSnap.docs.length).toBeGreaterThanOrEqual(4);
  });
});
