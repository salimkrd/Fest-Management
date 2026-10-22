/**
 * Firestore Security Rules Unit & Integration Tests
 * Uses authenticated Firebase Client SDK instances to verify Security Rules enforcement.
 * Admin SDK bypasses rules; these tests verify that client-level rules correctly enforce RBAC.
 */

import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { initializeApp, deleteApp, FirebaseApp } from 'firebase/app';
import {
  getAuth,
  connectAuthEmulator,
  signInWithEmailAndPassword,
  signInWithCustomToken,
  signOut,
  Auth
} from 'firebase/auth';
import {
  getFirestore,
  connectFirestoreEmulator,
  doc,
  getDoc,
  setDoc,
  updateDoc,
  collection,
  getDocs,
  Firestore
} from 'firebase/firestore';
import { getAdminDb, getAdminAuth } from '@/lib/firebase/admin';
import { JudgeService } from '@/services/judgeService';
import { hashSecret } from '@/domain/judgeAuth';

describe('Firestore Security Rules Enforcement via Client SDK', () => {
  let clientApp: FirebaseApp;
  let clientAuth: Auth;
  let clientDb: Firestore;

  beforeAll(async () => {
    // Unique app name to avoid collisions
    const appName = `sec-rules-test-${Date.now()}`;
    clientApp = initializeApp(
      {
        apiKey: 'demo-api-key',
        projectId: 'demo-sahithyolsav-2025',
        authDomain: 'demo-sahithyolsav-2025.firebaseapp.com'
      },
      appName
    );

    clientAuth = getAuth(clientApp);
    clientDb = getFirestore(clientApp);

    connectAuthEmulator(clientAuth, 'http://127.0.0.1:9099', { disableWarnings: true });
    connectFirestoreEmulator(clientDb, '127.0.0.1', 8080);
  });

  afterAll(async () => {
    if (clientAuth) {
      await signOut(clientAuth).catch(() => {});
    }
    if (clientApp) {
      await deleteApp(clientApp).catch(() => {});
    }
  });

  it('1. Public unauthenticated user CAN read categories', async () => {
    await signOut(clientAuth).catch(() => {});
    const catSnap = await getDoc(doc(clientDb, 'categories', 'cat-1'));
    expect(catSnap.exists()).toBe(true);
  });

  it('2. Public unauthenticated user CANNOT create or update categories', async () => {
    await signOut(clientAuth).catch(() => {});
    await expect(
      setDoc(doc(clientDb, 'categories', 'cat-unauth'), {
        id: 'cat-unauth',
        name: 'Hacked Category',
        status: 'ACTIVE'
      })
    ).rejects.toThrow();
  });

  it('3. Authenticated Admin CAN update categories', async () => {
    await signInWithEmailAndPassword(clientAuth, 'admin@sahithyolsav.com', 'AdminPassword123!');
    const catRef = doc(clientDb, 'categories', 'cat-1');
    await updateDoc(catRef, { status: 'ACTIVE' });
    const updated = await getDoc(catRef);
    expect(updated.exists()).toBe(true);
    expect(updated.data()?.status).toBe('ACTIVE');
  });

  it('4. Team Manager CAN create a participant for their own assigned team', async () => {
    // Sign in as Shamama manager (team-1)
    await signInWithEmailAndPassword(clientAuth, 'manager.shamama@sahithyolsav.com', 'TeamPassword123!');
    const partId = `part-shamama-test-${Date.now()}`;
    const partRef = doc(clientDb, 'participants', partId);

    await setDoc(partRef, {
      id: partId,
      name: 'Shamama Contestant',
      teamId: 'team-1',
      teamName: 'Al-Shamama',
      teamCode: 'SHA',
      categoryId: 'cat-3',
      categoryName: 'Senior',
      registeredEventIds: []
    });

    const readSnap = await getDoc(partRef);
    expect(readSnap.exists()).toBe(true);
    expect(readSnap.data()?.teamId).toBe('team-1');
  });

  it('5. Team Manager CANNOT create a participant for another team (Cross-Team Violation Rejected)', async () => {
    // Still signed in as Shamama manager (team-1)
    const partId = `part-cross-team-${Date.now()}`;
    const partRef = doc(clientDb, 'participants', partId);

    // Attempt to create contestant for An-Nawa (team-2)
    await expect(
      setDoc(partRef, {
        id: partId,
        name: 'Unauthorized Cross-Team Contestant',
        teamId: 'team-2',
        teamName: 'An-Nawa',
        teamCode: 'NAW',
        categoryId: 'cat-3',
        registeredEventIds: []
      })
    ).rejects.toThrow();
  });

  it('6. Client direct write to results collection is strictly rejected (allow write: if false)', async () => {
    // Even an authenticated client cannot write directly to results; results require server-side publication
    await signInWithEmailAndPassword(clientAuth, 'admin@sahithyolsav.com', 'AdminPassword123!');
    const resRef = doc(clientDb, 'results', 'unauthorized-direct-result');
    await expect(
      setDoc(resRef, {
        id: 'unauthorized-direct-result',
        resultStatus: 'PUBLISHED',
        competitionName: 'Bypassed Result'
      })
    ).rejects.toThrow();
  });

  it('7. Client direct write to pointsLedger is strictly rejected (allow write: if false)', async () => {
    const ledgerRef = doc(clientDb, 'pointsLedger', 'unauthorized-direct-ledger');
    await expect(
      setDoc(ledgerRef, {
        id: 'unauthorized-direct-ledger',
        pointsAwarded: 100,
        status: 'COMMITTED'
      })
    ).rejects.toThrow();
  });

  it('8. Client direct write to leaderboard is strictly rejected (allow write: if false)', async () => {
    const leaderRef = doc(clientDb, 'leaderboard', 'team-1');
    await expect(
      updateDoc(leaderRef, {
        totalPoints: 9999
      })
    ).rejects.toThrow();
  });

  it('9. Public visitor CANNOT modify public theme settings', async () => {
    await signOut(clientAuth).catch(() => {});
    const themeRef = doc(clientDb, 'settings', 'theme');
    await expect(
      updateDoc(themeRef, {
        primaryColor: '#FF0000'
      })
    ).rejects.toThrow();
  });

  it('10. Client direct write to markEntries without judge assignment token is strictly rejected', async () => {
    // Unauthenticated or non-judge client cannot forge markEntries
    await signOut(clientAuth).catch(() => {});
    const entryRef = doc(clientDb, 'markEntries', 'unauthorized-mark-entry');
    await expect(
      setDoc(entryRef, {
        id: 'unauthorized-mark-entry',
        assignmentId: 'fake-asgn',
        competitionId: 'cmp-1',
        scores: { 'reg-1': 100 }
      })
    ).rejects.toThrow();
  });

  it('11. Team Manager cannot forge or write to markEntries collection', async () => {
    await signInWithEmailAndPassword(clientAuth, 'manager.shamama@sahithyolsav.com', 'TeamPassword123!');
    const entryRef = doc(clientDb, 'markEntries', 'tm-forged-mark');
    await expect(
      setDoc(entryRef, {
        id: 'tm-forged-mark',
        assignmentId: 'fake-asgn',
        competitionId: 'cmp-1',
        scores: { 'reg-1': 100 }
      })
    ).rejects.toThrow();
  });

  it('12. Direct client write to markEntries is strictly prohibited (allow write: if false), while active judge CAN read', async () => {
    const adminDb = getAdminDb()!;
    const adminAuth = getAdminAuth()!;
    
    // Seed active assignment
    await adminDb.collection('judgeAssignments').doc('asgn-active-test').set({
      id: 'asgn-active-test',
      competitionId: 'cmp-1',
      revoked: false,
      status: 'ACTIVE',
      expiresAtMs: Date.now() + 3600000
    });

    const activeToken = await adminAuth.createCustomToken('judge-active-uid', {
      role: 'JUDGE',
      assignmentId: 'asgn-active-test',
      competitionId: 'cmp-1'
    });

    await signInWithCustomToken(clientAuth, activeToken);
    const entryRef = doc(clientDb, 'markEntries', 'mark-active-draft');

    // Direct client write is strictly rejected by rules (allow write: if false)
    await expect(
      setDoc(entryRef, {
        id: 'mark-active-draft',
        assignmentId: 'asgn-active-test',
        competitionId: 'cmp-1',
        status: 'DRAFT',
        scores: { 'reg-1': 25 }
      })
    ).rejects.toThrow();

    // Active judge CAN read their assigned scorecard once created via authorized server operation
    await adminDb.collection('markEntries').doc('mark-active-draft').set({
      id: 'mark-active-draft',
      assignmentId: 'asgn-active-test',
      competitionId: 'cmp-1',
      status: 'DRAFT',
      scores: { 'reg-1': 25 }
    });

    const snap = await getDoc(entryRef);
    expect(snap.exists()).toBe(true);
    expect(snap.data()?.status).toBe('DRAFT');
  });

  it('13. Judge CANNOT create mark entry for a different competition (Cross-Competition Scope Enforcement)', async () => {
    // Already signed in with asgn-active-test (bound to cmp-1)
    const entryRef = doc(clientDb, 'markEntries', 'mark-cross-comp');
    await expect(
      setDoc(entryRef, {
        id: 'mark-cross-comp',
        assignmentId: 'asgn-active-test',
        competitionId: 'cmp-2', // Cross-competition violation!
        status: 'DRAFT',
        scores: { 'reg-1': 25 }
      })
    ).rejects.toThrow();
  });

  it('14. Judge with REVOKED assignment CANNOT create or update mark entry (Revocation Check)', async () => {
    const adminDb = getAdminDb()!;
    const adminAuth = getAdminAuth()!;

    await adminDb.collection('judgeAssignments').doc('asgn-revoked-test').set({
      id: 'asgn-revoked-test',
      competitionId: 'cmp-1',
      revoked: true,
      status: 'REVOKED',
      expiresAtMs: Date.now() + 3600000
    });

    const revokedToken = await adminAuth.createCustomToken('judge-revoked-uid', {
      role: 'JUDGE',
      assignmentId: 'asgn-revoked-test',
      competitionId: 'cmp-1'
    });

    await signInWithCustomToken(clientAuth, revokedToken);
    const entryRef = doc(clientDb, 'markEntries', 'mark-revoked-attempt');
    await expect(
      setDoc(entryRef, {
        id: 'mark-revoked-attempt',
        assignmentId: 'asgn-revoked-test',
        competitionId: 'cmp-1',
        status: 'DRAFT',
        scores: { 'reg-1': 25 }
      })
    ).rejects.toThrow();
  });

  it('15. Judge with EXPIRED assignment CANNOT create or update mark entry (Expiration Check)', async () => {
    const adminDb = getAdminDb()!;
    const adminAuth = getAdminAuth()!;

    await adminDb.collection('judgeAssignments').doc('asgn-expired-test').set({
      id: 'asgn-expired-test',
      competitionId: 'cmp-1',
      revoked: false,
      status: 'ACTIVE',
      expiresAtMs: Date.now() - 60000 // Expired 1 minute ago
    });

    const expiredToken = await adminAuth.createCustomToken('judge-expired-uid', {
      role: 'JUDGE',
      assignmentId: 'asgn-expired-test',
      competitionId: 'cmp-1'
    });

    await signInWithCustomToken(clientAuth, expiredToken);
    const entryRef = doc(clientDb, 'markEntries', 'mark-expired-attempt');
    await expect(
      setDoc(entryRef, {
        id: 'mark-expired-attempt',
        assignmentId: 'asgn-expired-test',
        competitionId: 'cmp-1',
        status: 'DRAFT',
        scores: { 'reg-1': 25 }
      })
    ).rejects.toThrow();
  });

  it('16. Judge CANNOT create or update mark entry after assignment is marked SUBMITTED (Finalized Assignment)', async () => {
    const adminDb = getAdminDb()!;
    const adminAuth = getAdminAuth()!;

    await adminDb.collection('judgeAssignments').doc('asgn-submitted-test').set({
      id: 'asgn-submitted-test',
      competitionId: 'cmp-1',
      revoked: false,
      status: 'SUBMITTED',
      expiresAtMs: Date.now() + 3600000
    });

    const submittedToken = await adminAuth.createCustomToken('judge-submitted-uid', {
      role: 'JUDGE',
      assignmentId: 'asgn-submitted-test',
      competitionId: 'cmp-1'
    });

    await signInWithCustomToken(clientAuth, submittedToken);
    const entryRef = doc(clientDb, 'markEntries', 'mark-submitted-attempt');
    await expect(
      setDoc(entryRef, {
        id: 'mark-submitted-attempt',
        assignmentId: 'asgn-submitted-test',
        competitionId: 'cmp-1',
        status: 'DRAFT',
        scores: { 'reg-1': 25 }
      })
    ).rejects.toThrow();
  });

  it('17. Judge with STALE / mismatched assignment claims CANNOT update another judge mark entry', async () => {
    const adminDb = getAdminDb()!;
    const adminAuth = getAdminAuth()!;

    await adminDb.collection('judgeAssignments').doc('asgn-stale-test').set({
      id: 'asgn-stale-test',
      competitionId: 'cmp-1',
      revoked: false,
      status: 'ACTIVE',
      expiresAtMs: Date.now() + 3600000
    });

    const staleToken = await adminAuth.createCustomToken('judge-stale-uid', {
      role: 'JUDGE',
      assignmentId: 'asgn-stale-test',
      competitionId: 'cmp-1'
    });

    await signInWithCustomToken(clientAuth, staleToken);
    // Attempt to update mark-active-draft owned by asgn-active-test
    const entryRef = doc(clientDb, 'markEntries', 'mark-active-draft');
    await expect(
      updateDoc(entryRef, {
        scores: { 'reg-1': 99 }
      })
    ).rejects.toThrow();
  });

  it('18. Submission Immutability: Judge CANNOT modify a scorecard once marked SUBMITTED or finalized', async () => {
    const adminDb = getAdminDb()!;
    const adminAuth = getAdminAuth()!;

    // Seed finalized scorecard owned by asgn-active-test
    await adminDb.collection('markEntries').doc('mark-immutable-final').set({
      id: 'mark-immutable-final',
      assignmentId: 'asgn-active-test',
      competitionId: 'cmp-1',
      status: 'SUBMITTED',
      submitted: true,
      isFinal: true,
      scores: { 'reg-1': 25 }
    });

    const activeToken = await adminAuth.createCustomToken('judge-active-uid', {
      role: 'JUDGE',
      assignmentId: 'asgn-active-test',
      competitionId: 'cmp-1'
    });

    await signInWithCustomToken(clientAuth, activeToken);
    const entryRef = doc(clientDb, 'markEntries', 'mark-immutable-final');
    await expect(
      updateDoc(entryRef, {
        scores: { 'reg-1': 30 }
      })
    ).rejects.toThrow();
  });

  it('19. Submission Immutability: Judge CANNOT alter competitionId or assignmentId during draft updates', async () => {
    const adminAuth = getAdminAuth()!;
    const activeToken = await adminAuth.createCustomToken('judge-active-uid', {
      role: 'JUDGE',
      assignmentId: 'asgn-active-test',
      competitionId: 'cmp-1'
    });

    await signInWithCustomToken(clientAuth, activeToken);
    const entryRef = doc(clientDb, 'markEntries', 'mark-active-draft');
    await expect(
      updateDoc(entryRef, {
        competitionId: 'cmp-tampered'
      })
    ).rejects.toThrow();
  });

  it('20. Missing or null assignment expiration is strictly rejected (Fail-Closed Expiration Policy)', async () => {
    const adminDb = getAdminDb()!;
    const adminAuth = getAdminAuth()!;

    // Assignment without expiresAtMs
    await adminDb.collection('judgeAssignments').doc('asgn-missing-exp-test').set({
      id: 'asgn-missing-exp-test',
      competitionId: 'cmp-1',
      revoked: false,
      status: 'ACTIVE'
      // expiresAtMs is intentionally omitted
    });

    const tokenMissing = await adminAuth.createCustomToken('judge-missing-exp-uid', {
      role: 'JUDGE',
      assignmentId: 'asgn-missing-exp-test',
      competitionId: 'cmp-1'
    });

    await signInWithCustomToken(clientAuth, tokenMissing);
    const entryRef = doc(clientDb, 'markEntries', 'mark-missing-exp-attempt');
    await expect(
      setDoc(entryRef, {
        id: 'mark-missing-exp-attempt',
        assignmentId: 'asgn-missing-exp-test',
        competitionId: 'cmp-1',
        status: 'DRAFT',
        scores: { 'reg-1': 25 }
      })
    ).rejects.toThrow();

    // Assignment with null expiresAtMs
    await adminDb.collection('judgeAssignments').doc('asgn-null-exp-test').set({
      id: 'asgn-null-exp-test',
      competitionId: 'cmp-1',
      revoked: false,
      status: 'ACTIVE',
      expiresAtMs: null
    });

    const tokenNull = await adminAuth.createCustomToken('judge-null-exp-uid', {
      role: 'JUDGE',
      assignmentId: 'asgn-null-exp-test',
      competitionId: 'cmp-1'
    });

    await signInWithCustomToken(clientAuth, tokenNull);
    const entryRefNull = doc(clientDb, 'markEntries', 'mark-null-exp-attempt');
    await expect(
      setDoc(entryRefNull, {
        id: 'mark-null-exp-attempt',
        assignmentId: 'asgn-null-exp-test',
        competitionId: 'cmp-1',
        status: 'DRAFT',
        scores: { 'reg-1': 25 }
      })
    ).rejects.toThrow();
  });

  it('21. Revoked Judge attempting to read scorecards is strictly rejected (Read Defense)', async () => {
    const adminDb = getAdminDb()!;
    const adminAuth = getAdminAuth()!;

    // Seed mark entry for revoked assignment
    await adminDb.collection('markEntries').doc('mark-revoked-read-target').set({
      id: 'mark-revoked-read-target',
      assignmentId: 'asgn-revoked-test',
      competitionId: 'cmp-1',
      status: 'DRAFT',
      scores: { 'reg-1': 25 }
    });

    const revokedToken = await adminAuth.createCustomToken('judge-revoked-read-uid', {
      role: 'JUDGE',
      assignmentId: 'asgn-revoked-test',
      competitionId: 'cmp-1'
    });

    await signInWithCustomToken(clientAuth, revokedToken);
    const entryRef = doc(clientDb, 'markEntries', 'mark-revoked-read-target');
    await expect(getDoc(entryRef)).rejects.toThrow();
  });

  it('22. Expired Judge attempting to read scorecards is strictly rejected (Read Defense)', async () => {
    const adminDb = getAdminDb()!;
    const adminAuth = getAdminAuth()!;

    // Seed mark entry for expired assignment
    await adminDb.collection('markEntries').doc('mark-expired-read-target').set({
      id: 'mark-expired-read-target',
      assignmentId: 'asgn-expired-test',
      competitionId: 'cmp-1',
      status: 'DRAFT',
      scores: { 'reg-1': 25 }
    });

    const expiredToken = await adminAuth.createCustomToken('judge-expired-read-uid', {
      role: 'JUDGE',
      assignmentId: 'asgn-expired-test',
      competitionId: 'cmp-1'
    });

    await signInWithCustomToken(clientAuth, expiredToken);
    const entryRef = doc(clientDb, 'markEntries', 'mark-expired-read-target');
    await expect(getDoc(entryRef)).rejects.toThrow();
  });

  it('23. Finalized / Submitted Judge attempting to read raw scorecards is strictly rejected', async () => {
    const adminDb = getAdminDb()!;
    const adminAuth = getAdminAuth()!;

    // Seed mark entry for submitted assignment
    await adminDb.collection('markEntries').doc('mark-submitted-read-target').set({
      id: 'mark-submitted-read-target',
      assignmentId: 'asgn-submitted-test',
      competitionId: 'cmp-1',
      status: 'SUBMITTED',
      submitted: true,
      isFinal: true,
      scores: { 'reg-1': 25 }
    });

    const submittedToken = await adminAuth.createCustomToken('judge-submitted-read-uid', {
      role: 'JUDGE',
      assignmentId: 'asgn-submitted-test',
      competitionId: 'cmp-1'
    });

    await signInWithCustomToken(clientAuth, submittedToken);
    const entryRef = doc(clientDb, 'markEntries', 'mark-submitted-read-target');
    await expect(getDoc(entryRef)).rejects.toThrow();
  });

  it('24. Server-controlled field and status injection is strictly rejected', async () => {
    const adminAuth = getAdminAuth()!;
    const activeToken = await adminAuth.createCustomToken('judge-active-uid', {
      role: 'JUDGE',
      assignmentId: 'asgn-active-test',
      competitionId: 'cmp-1'
    });

    await signInWithCustomToken(clientAuth, activeToken);

    // Injection 1: pointsAwarded
    await expect(
      setDoc(doc(clientDb, 'markEntries', 'mark-injected-pts'), {
        id: 'mark-injected-pts',
        assignmentId: 'asgn-active-test',
        competitionId: 'cmp-1',
        status: 'DRAFT',
        pointsAwarded: 100,
        scores: { 'reg-1': 25 }
      })
    ).rejects.toThrow();

    // Injection 2: grade
    await expect(
      setDoc(doc(clientDb, 'markEntries', 'mark-injected-grade'), {
        id: 'mark-injected-grade',
        assignmentId: 'asgn-active-test',
        competitionId: 'cmp-1',
        status: 'DRAFT',
        grade: 'A+',
        scores: { 'reg-1': 25 }
      })
    ).rejects.toThrow();

    // Injection 3: verificationHash
    await expect(
      setDoc(doc(clientDb, 'markEntries', 'mark-injected-hash'), {
        id: 'mark-injected-hash',
        assignmentId: 'asgn-active-test',
        competitionId: 'cmp-1',
        status: 'DRAFT',
        verificationHash: 'SHA256:fakehash',
        scores: { 'reg-1': 25 }
      })
    ).rejects.toThrow();

    // Injection 4: Client attempting status SUBMITTED directly
    await expect(
      setDoc(doc(clientDb, 'markEntries', 'mark-injected-status'), {
        id: 'mark-injected-status',
        assignmentId: 'asgn-active-test',
        competitionId: 'cmp-1',
        status: 'SUBMITTED',
        scores: { 'reg-1': 25 }
      })
    ).rejects.toThrow();

    // Injection 5: Arbitrary untrusted attribute
    await expect(
      setDoc(doc(clientDb, 'markEntries', 'mark-injected-arbitrary'), {
        id: 'mark-injected-arbitrary',
        assignmentId: 'asgn-active-test',
        competitionId: 'cmp-1',
        status: 'DRAFT',
        hackedField: 'injection-attack',
        scores: { 'reg-1': 25 }
      })
    ).rejects.toThrow();
  });

  it('25. Negative and excessive score values are strictly rejected', async () => {
    const adminAuth = getAdminAuth()!;
    const activeToken = await adminAuth.createCustomToken('judge-active-uid', {
      role: 'JUDGE',
      assignmentId: 'asgn-active-test',
      competitionId: 'cmp-1'
    });

    await signInWithCustomToken(clientAuth, activeToken);

    // Negative numeric score
    await expect(
      setDoc(doc(clientDb, 'markEntries', 'mark-negative-score'), {
        id: 'mark-negative-score',
        assignmentId: 'asgn-active-test',
        competitionId: 'cmp-1',
        status: 'DRAFT',
        scores: { 'reg-1': -10 }
      })
    ).rejects.toThrow();

    // Excessive numeric score (>100)
    await expect(
      setDoc(doc(clientDb, 'markEntries', 'mark-excessive-score'), {
        id: 'mark-excessive-score',
        assignmentId: 'asgn-active-test',
        competitionId: 'cmp-1',
        status: 'DRAFT',
        scores: { 'reg-1': 150 }
      })
    ).rejects.toThrow();

    // Negative criteria score inside criteria map
    await expect(
      setDoc(doc(clientDb, 'markEntries', 'mark-negative-crit'), {
        id: 'mark-negative-crit',
        assignmentId: 'asgn-active-test',
        competitionId: 'cmp-1',
        status: 'DRAFT',
        scores: { 'reg-1': { pitch: -5, rhythm: 40 } }
      })
    ).rejects.toThrow();

    // Excessive criteria score (>100)
    await expect(
      setDoc(doc(clientDb, 'markEntries', 'mark-excessive-crit'), {
        id: 'mark-excessive-crit',
        assignmentId: 'asgn-active-test',
        competitionId: 'cmp-1',
        status: 'DRAFT',
        scores: { 'reg-1': { pitch: 105, rhythm: 40 } }
      })
    ).rejects.toThrow();
  });

  it('26. Unauthorized competition association is strictly rejected', async () => {
    const adminAuth = getAdminAuth()!;
    const activeToken = await adminAuth.createCustomToken('judge-active-uid', {
      role: 'JUDGE',
      assignmentId: 'asgn-active-test',
      competitionId: 'cmp-1'
    });

    await signInWithCustomToken(clientAuth, activeToken);

    await expect(
      setDoc(doc(clientDb, 'markEntries', 'mark-invalid-comp-assoc'), {
        id: 'mark-invalid-comp-assoc',
        assignmentId: 'asgn-active-test',
        competitionId: 'cmp-99-unauthorized',
        status: 'DRAFT',
        scores: { 'reg-1': 50 }
      })
    ).rejects.toThrow();
  });

  it('27. Non-map scores (string, boolean, array, null) are strictly rejected', async () => {
    const adminAuth = getAdminAuth()!;
    const activeToken = await adminAuth.createCustomToken('judge-active-uid', {
      role: 'JUDGE',
      assignmentId: 'asgn-active-test',
      competitionId: 'cmp-1'
    });

    await signInWithCustomToken(clientAuth, activeToken);

    // String scores
    await expect(
      setDoc(doc(clientDb, 'markEntries', 'mark-nonmap-str'), {
        id: 'mark-nonmap-str',
        assignmentId: 'asgn-active-test',
        competitionId: 'cmp-1',
        status: 'DRAFT',
        scores: 'not-a-map'
      })
    ).rejects.toThrow();

    // Boolean scores
    await expect(
      setDoc(doc(clientDb, 'markEntries', 'mark-nonmap-bool'), {
        id: 'mark-nonmap-bool',
        assignmentId: 'asgn-active-test',
        competitionId: 'cmp-1',
        status: 'DRAFT',
        scores: true
      })
    ).rejects.toThrow();

    // Array scores
    await expect(
      setDoc(doc(clientDb, 'markEntries', 'mark-nonmap-array'), {
        id: 'mark-nonmap-array',
        assignmentId: 'asgn-active-test',
        competitionId: 'cmp-1',
        status: 'DRAFT',
        scores: [85, 90]
      })
    ).rejects.toThrow();

    // Null scores
    await expect(
      setDoc(doc(clientDb, 'markEntries', 'mark-nonmap-null'), {
        id: 'mark-nonmap-null',
        assignmentId: 'asgn-active-test',
        competitionId: 'cmp-1',
        status: 'DRAFT',
        scores: null
      })
    ).rejects.toThrow();
  });

  it('28. Non-numeric score values within score map are strictly rejected', async () => {
    const adminAuth = getAdminAuth()!;
    const activeToken = await adminAuth.createCustomToken('judge-active-uid', {
      role: 'JUDGE',
      assignmentId: 'asgn-active-test',
      competitionId: 'cmp-1'
    });

    await signInWithCustomToken(clientAuth, activeToken);

    // String score value
    await expect(
      setDoc(doc(clientDb, 'markEntries', 'mark-val-string'), {
        id: 'mark-val-string',
        assignmentId: 'asgn-active-test',
        competitionId: 'cmp-1',
        status: 'DRAFT',
        scores: { 'reg-1': '95' }
      })
    ).rejects.toThrow();

    // Boolean score value
    await expect(
      setDoc(doc(clientDb, 'markEntries', 'mark-val-bool'), {
        id: 'mark-val-bool',
        assignmentId: 'asgn-active-test',
        competitionId: 'cmp-1',
        status: 'DRAFT',
        scores: { 'reg-1': true }
      })
    ).rejects.toThrow();

    // Non-numeric criteria score within criteria map
    await expect(
      setDoc(doc(clientDb, 'markEntries', 'mark-val-crit-string'), {
        id: 'mark-val-crit-string',
        assignmentId: 'asgn-active-test',
        competitionId: 'cmp-1',
        status: 'DRAFT',
        scores: { 'reg-1': { pitch: '80', timing: 90 } }
      })
    ).rejects.toThrow();
  });

  it('29. Missing or empty score maps are strictly rejected', async () => {
    const adminAuth = getAdminAuth()!;
    const activeToken = await adminAuth.createCustomToken('judge-active-uid', {
      role: 'JUDGE',
      assignmentId: 'asgn-active-test',
      competitionId: 'cmp-1'
    });

    await signInWithCustomToken(clientAuth, activeToken);

    // Empty scores map
    await expect(
      setDoc(doc(clientDb, 'markEntries', 'mark-empty-scores'), {
        id: 'mark-empty-scores',
        assignmentId: 'asgn-active-test',
        competitionId: 'cmp-1',
        status: 'DRAFT',
        scores: {}
      })
    ).rejects.toThrow();

    // Missing scores field entirely
    await expect(
      setDoc(doc(clientDb, 'markEntries', 'mark-missing-scores'), {
        id: 'mark-missing-scores',
        assignmentId: 'asgn-active-test',
        competitionId: 'cmp-1',
        status: 'DRAFT'
      })
    ).rejects.toThrow();
  });

  it('30. Direct client draft write is strictly rejected, while JudgeService.saveDraftMarks() succeeds', async () => {
    const adminAuth = getAdminAuth()!;
    const activeToken = await adminAuth.createCustomToken('judge-active-uid', {
      role: 'JUDGE',
      assignmentId: 'asgn-active-test',
      competitionId: 'cmp-1'
    });

    await signInWithCustomToken(clientAuth, activeToken);

    // 1. Direct client write is rejected by rules
    const dynamicDraftRef = doc(clientDb, 'markEntries', 'mark-dynamic-valid');
    await expect(
      setDoc(dynamicDraftRef, {
        id: 'mark-dynamic-valid',
        assignmentId: 'asgn-active-test',
        competitionId: 'cmp-1',
        status: 'DRAFT',
        scores: { 'reg-01': 88 },
        remarks: 'Preliminary draft scoring'
      })
    ).rejects.toThrow();

    // 2. Authorized server-side JudgeService.saveDraftMarks succeeds
    const pin = '9911';
    const salt = 'salt-draft-test';
    const hashedSecret = await hashSecret(pin, salt);
    const adminDb = getAdminDb()!;

    await adminDb.collection('judgeAssignments').doc('asgn-draft-service-test').set({
      id: 'asgn-draft-service-test',
      competitionId: 'comp-1',
      status: 'ACTIVE',
      revoked: false,
      salt,
      hashedSecret,
      secretHash: hashedSecret,
      expiresAtMs: Date.now() + 3600000,
      expiresAt: new Date(Date.now() + 3600000).toISOString()
    });

    const draftResult = await JudgeService.saveDraftMarks({
      assignmentId: 'asgn-draft-service-test',
      competitionId: 'comp-1',
      secret: pin,
      scores: { 'reg-01': 88 },
      remarks: 'Saved draft'
    });

    expect(draftResult.success).toBe(true);
    expect(draftResult.markEntryId).toBe('me-asgn-draft-service-test');

    const draftDoc = await adminDb.collection('markEntries').doc(draftResult.markEntryId).get();
    expect(draftDoc.exists).toBe(true);
    expect(draftDoc.data()?.status).toBe('DRAFT');
    expect(draftDoc.data()?.submitted).toBe(false);
  });

  it('31. Authorized server-side Judge submission & immutability verification via JudgeService.submitMarks()', async () => {
    const adminDb = getAdminDb()!;
    const adminAuth = getAdminAuth()!;

    // Create a dedicated active assignment for testing server-side submission
    const asgnId = 'asgn-submit-service-test';
    const compId = 'cmp-service-test';
    const pin = '8822';
    const salt = 'salt-service-8822';
    const hashedSecret = await hashSecret(pin, salt);

    await adminDb.collection('registrations').doc('reg-service-1').set({
      id: 'reg-service-1',
      competitionId: compId,
      bib: 'bib-service-1',
      status: 'APPROVED'
    });

    await adminDb.collection('registrations').doc('reg-service-2').set({
      id: 'reg-service-2',
      competitionId: compId,
      bib: 'bib-service-2',
      status: 'APPROVED'
    });

    await adminDb.collection('judgeAssignments').doc(asgnId).set({
      id: asgnId,
      competitionId: compId,
      competitionName: 'Test Competition',
      judgeName: 'Judge Test',
      status: 'ACTIVE',
      revoked: false,
      salt,
      hashedSecret,
      secretHash: hashedSecret,
      expiresAtMs: Date.now() + 7 * 24 * 3600 * 1000,
      expiresAt: new Date(Date.now() + 7 * 24 * 3600 * 1000).toISOString()
    });

    // Submit marks via server-authoritative JudgeService
    const submitResult = await JudgeService.submitMarks({
      assignmentId: asgnId,
      competitionId: compId,
      secret: pin,
      scores: {
        'bib-service-1': 94,
        'bib-service-2': { content: 45, delivery: 45 }
      }
    });

    expect(submitResult.success).toBe(true);
    expect(submitResult.verificationHash).toMatch(/^SHA256:/);
    expect(submitResult.markEntryId).toBe(`me-${asgnId}`);

    // Verify markEntry in Firestore has been sealed
    const markSnap = await adminDb.collection('markEntries').doc(submitResult.markEntryId).get();
    expect(markSnap.exists).toBe(true);
    const markData = markSnap.data();
    expect(markData?.status).toBe('SUBMITTED');
    expect(markData?.submitted).toBe(true);
    expect(markData?.isFinal).toBe(true);
    expect(markData?.verificationHash).toBe(submitResult.verificationHash);

    // Verify assignment has also transitioned to SUBMITTED
    const asgSnap = await adminDb.collection('judgeAssignments').doc(asgnId).get();
    expect(asgSnap.data()?.status).toBe('SUBMITTED');

    // Security Check: Now client SDK attempts to update the sealed scorecard
    const token = await adminAuth.createCustomToken('judge-submit-client-uid', {
      role: 'JUDGE',
      assignmentId: asgnId,
      competitionId: compId
    });
    await signInWithCustomToken(clientAuth, token);

    const clientDocRef = doc(clientDb, 'markEntries', submitResult.markEntryId);
    await expect(
      updateDoc(clientDocRef, {
        scores: { 'bib-service-1': 99 }
      })
    ).rejects.toThrow();
  });

  it('32. Arbitrary or invented participant IDs are strictly rejected by JudgeService', async () => {
    const adminDb = getAdminDb()!;
    const asgnId = 'asgn-unreg-test';
    const compId = 'comp-1'; // comp-1 has real registrations (reg-01, reg-02, reg-03, reg-04)
    const pin = '4455';
    const salt = 'salt-unreg-4455';
    const hashedSecret = await hashSecret(pin, salt);

    await adminDb.collection('judgeAssignments').doc(asgnId).set({
      id: asgnId,
      competitionId: compId,
      status: 'ACTIVE',
      revoked: false,
      salt,
      hashedSecret,
      secretHash: hashedSecret,
      expiresAtMs: Date.now() + 3600000,
      expiresAt: new Date(Date.now() + 3600000).toISOString()
    });

    // Attempting to submit for an arbitrary unassigned participant ID
    await expect(
      JudgeService.submitMarks({
        assignmentId: asgnId,
        competitionId: compId,
        secret: pin,
        scores: {
          'fake-invented-participant-999': 95
        }
      })
    ).rejects.toThrow(/not assigned to an eligible registration/i);
  });

  it('33. Criteria marks exceeding specific competition rubric limits are strictly rejected by JudgeService', async () => {
    const adminDb = getAdminDb()!;
    const compId = 'comp-rubric-strict';
    const asgnId = 'asgn-rubric-test';
    const pin = '7711';
    const salt = 'salt-rubric-7711';
    const hashedSecret = await hashSecret(pin, salt);

    // Seed competition with specific rubric criteria
    await adminDb.collection('competitions').doc(compId).set({
      id: compId,
      name: 'Rubric Test Competition',
      maxMarks: 50,
      criteria: [
        { id: 'cr-subject', name: 'Subject Mastery', maxMarks: 30 },
        { id: 'cr-delivery', name: 'Delivery', maxMarks: 20 }
      ]
    });

    // Seed valid registration
    await adminDb.collection('registrations').doc('reg-rubric-01').set({
      id: 'reg-rubric-01',
      competitionId: compId,
      participantId: 'part-rubric-01',
      bib: 'BIB-R01',
      status: 'APPROVED'
    });

    await adminDb.collection('judgeAssignments').doc(asgnId).set({
      id: asgnId,
      competitionId: compId,
      status: 'ACTIVE',
      revoked: false,
      salt,
      hashedSecret,
      secretHash: hashedSecret,
      expiresAtMs: Date.now() + 3600000,
      expiresAt: new Date(Date.now() + 3600000).toISOString()
    });

    // Criterion 'cr-subject' maxMarks is 30. Score of 35 must be strictly rejected!
    await expect(
      JudgeService.submitMarks({
        assignmentId: asgnId,
        competitionId: compId,
        secret: pin,
        scores: {
          'reg-rubric-01': {
            'cr-subject': 35, // Exceeds rubric limit of 30!
            'cr-delivery': 15
          }
        }
      })
    ).rejects.toThrow(/exceeds specific rubric limit/i);
  });

  it('34. Seeded assignments verification (future valid asg-02 read access vs expired lockout asg-expired-demo)', async () => {
    const adminDb = getAdminDb()!;
    const adminAuth = getAdminAuth()!;

    // Ensure asg-02 and asg-expired-demo exist with precise timestamps
    await adminDb.collection('judgeAssignments').doc('asg-02').set({
      id: 'asg-02',
      competitionId: 'comp-2',
      status: 'ACTIVE',
      revoked: false,
      expiresAtMs: Date.now() + 7 * 24 * 3600 * 1000,
      expiresAt: new Date(Date.now() + 7 * 24 * 3600 * 1000).toISOString()
    }, { merge: true });

    await adminDb.collection('judgeAssignments').doc('asg-expired-demo').set({
      id: 'asg-expired-demo',
      competitionId: 'comp-3',
      status: 'ACTIVE',
      revoked: false,
      expiresAtMs: Date.now() - 3600 * 1000,
      expiresAt: new Date(Date.now() - 3600 * 1000).toISOString()
    }, { merge: true });

    // Seed scorecards via admin for read testing
    await adminDb.collection('markEntries').doc('me-asg-02').set({
      id: 'me-asg-02',
      assignmentId: 'asg-02',
      competitionId: 'comp-2',
      status: 'DRAFT',
      scores: { 'reg-05': 85 }
    });

    await adminDb.collection('markEntries').doc('me-asg-expired').set({
      id: 'me-asg-expired',
      assignmentId: 'asg-expired-demo',
      competitionId: 'comp-3',
      status: 'DRAFT',
      scores: { 'reg-06': 80 }
    });

    // 1. Active Judge asg-02 (comp-2) can READ their scorecard
    const validFutureToken = await adminAuth.createCustomToken('judge-asg-02-uid', {
      role: 'JUDGE',
      assignmentId: 'asg-02',
      competitionId: 'comp-2'
    });
    await signInWithCustomToken(clientAuth, validFutureToken);

    const validReadRef = doc(clientDb, 'markEntries', 'me-asg-02');
    const validSnap = await getDoc(validReadRef);
    expect(validSnap.exists()).toBe(true);

    // Direct write attempt from active judge is still rejected (allow write: if false)
    await expect(
      setDoc(validReadRef, { scores: { 'reg-05': 99 } })
    ).rejects.toThrow();

    // 2. Expired assignment asg-expired-demo (comp-3) CANNOT read
    const expiredSeedToken = await adminAuth.createCustomToken('judge-expired-seed-uid', {
      role: 'JUDGE',
      assignmentId: 'asg-expired-demo',
      competitionId: 'comp-3'
    });
    await signInWithCustomToken(clientAuth, expiredSeedToken);

    const expiredReadRef = doc(clientDb, 'markEntries', 'me-asg-expired');
    await expect(getDoc(expiredReadRef)).rejects.toThrow();
  });

  it('35. Competition with zero registrations fails closed for both saveDraftMarks and submitMarks', async () => {
    const adminDb = getAdminDb()!;
    const emptyCompId = 'comp-zero-registrations';
    const asgnId = 'asgn-zero-reg-test';
    const pin = '1234';
    const salt = 'salt-zero-1234';
    const hashedSecret = await hashSecret(pin, salt);

    await adminDb.collection('competitions').doc(emptyCompId).set({
      id: emptyCompId,
      name: 'Empty Competition',
      maxMarks: 100
    });

    await adminDb.collection('judgeAssignments').doc(asgnId).set({
      id: asgnId,
      competitionId: emptyCompId,
      status: 'ACTIVE',
      revoked: false,
      salt,
      hashedSecret,
      secretHash: hashedSecret,
      expiresAtMs: Date.now() + 3600000,
      expiresAt: new Date(Date.now() + 3600000).toISOString()
    });

    // Draft save fails closed
    await expect(
      JudgeService.saveDraftMarks({
        assignmentId: asgnId,
        competitionId: emptyCompId,
        secret: pin,
        scores: { 'any-key': 90 }
      })
    ).rejects.toThrow(/zero registrations/i);

    // Submission fails closed
    await expect(
      JudgeService.submitMarks({
        assignmentId: asgnId,
        competitionId: emptyCompId,
        secret: pin,
        scores: { 'any-key': 90 }
      })
    ).rejects.toThrow(/zero registrations/i);
  });

  it('36. Cancelled, withdrawn, or rejected registrations are strictly rejected by JudgeService', async () => {
    const adminDb = getAdminDb()!;
    const compId = 'comp-ineligible-test';
    const asgnId = 'asgn-ineligible-test';
    const pin = '5678';
    const salt = 'salt-ineligible-5678';
    const hashedSecret = await hashSecret(pin, salt);

    await adminDb.collection('competitions').doc(compId).set({
      id: compId,
      name: 'Ineligible Test Competition',
      maxMarks: 100
    });

    // Seed registrations with missing, null, empty, PENDING, CANCELLED, WITHDRAWN, and APPROVED statuses
    await adminDb.collection('registrations').doc('reg-missing-status').set({
      id: 'reg-missing-status',
      competitionId: compId,
      participantId: 'part-missing-1',
      bib: 'BIB-MISSING'
      // status field completely missing/undefined
    });

    await adminDb.collection('registrations').doc('reg-null-status').set({
      id: 'reg-null-status',
      competitionId: compId,
      participantId: 'part-null-1',
      bib: 'BIB-NULL',
      status: null
    });

    await adminDb.collection('registrations').doc('reg-empty-status').set({
      id: 'reg-empty-status',
      competitionId: compId,
      participantId: 'part-empty-1',
      bib: 'BIB-EMPTY',
      status: '   '
    });

    await adminDb.collection('registrations').doc('reg-pending-status').set({
      id: 'reg-pending-status',
      competitionId: compId,
      participantId: 'part-pending-1',
      bib: 'BIB-PENDING',
      status: 'PENDING'
    });

    await adminDb.collection('registrations').doc('reg-cancelled-status').set({
      id: 'reg-cancelled-status',
      competitionId: compId,
      participantId: 'part-cancelled-1',
      bib: 'BIB-CANCELLED',
      status: 'CANCELLED'
    });

    await adminDb.collection('registrations').doc('reg-withdrawn-status').set({
      id: 'reg-withdrawn-status',
      competitionId: compId,
      participantId: 'part-withdrawn-1',
      bib: 'BIB-WITHDRAWN',
      status: 'WITHDRAWN'
    });

    await adminDb.collection('registrations').doc('reg-approved-1').set({
      id: 'reg-approved-1',
      competitionId: compId,
      participantId: 'part-approved-1',
      bib: 'BIB-APPROVED',
      status: 'APPROVED'
    });

    await adminDb.collection('judgeAssignments').doc(asgnId).set({
      id: asgnId,
      competitionId: compId,
      status: 'ACTIVE',
      revoked: false,
      salt,
      hashedSecret,
      secretHash: hashedSecret,
      expiresAtMs: Date.now() + 3600000,
      expiresAt: new Date(Date.now() + 3600000).toISOString()
    });

    // 1. Missing status must be strictly rejected (fail closed)
    await expect(
      JudgeService.submitMarks({
        assignmentId: asgnId,
        competitionId: compId,
        secret: pin,
        scores: { 'reg-missing-status': 85 }
      })
    ).rejects.toThrow(/ineligible registration \(status: MISSING\)/i);

    // 2. Null status must be strictly rejected
    await expect(
      JudgeService.submitMarks({
        assignmentId: asgnId,
        competitionId: compId,
        secret: pin,
        scores: { 'reg-null-status': 85 }
      })
    ).rejects.toThrow(/ineligible registration \(status: NULL\)/i);

    // 3. Empty/whitespace status must be strictly rejected
    await expect(
      JudgeService.submitMarks({
        assignmentId: asgnId,
        competitionId: compId,
        secret: pin,
        scores: { 'reg-empty-status': 85 }
      })
    ).rejects.toThrow(/ineligible registration \(status: EMPTY\)/i);

    // 4. PENDING status must be strictly rejected
    await expect(
      JudgeService.submitMarks({
        assignmentId: asgnId,
        competitionId: compId,
        secret: pin,
        scores: { 'reg-pending-status': 85 }
      })
    ).rejects.toThrow(/ineligible registration \(status: PENDING\)/i);

    // 5. CANCELLED status must be strictly rejected
    await expect(
      JudgeService.submitMarks({
        assignmentId: asgnId,
        competitionId: compId,
        secret: pin,
        scores: { 'reg-cancelled-status': 85 }
      })
    ).rejects.toThrow(/ineligible registration \(status: CANCELLED\)/i);

    // 6. WITHDRAWN status must be strictly rejected
    await expect(
      JudgeService.submitMarks({
        assignmentId: asgnId,
        competitionId: compId,
        secret: pin,
        scores: { 'reg-withdrawn-status': 85 }
      })
    ).rejects.toThrow(/ineligible registration \(status: WITHDRAWN\)/i);

    // 7. Legitimate APPROVED registration succeeds
    const approvedDraft = await JudgeService.saveDraftMarks({
      assignmentId: asgnId,
      competitionId: compId,
      secret: pin,
      scores: { 'BIB-APPROVED': 92 }
    });
    expect(approvedDraft.success).toBe(true);

    // 8. Competition with registrations where NONE are APPROVED fails closed
    const pendingOnlyCompId = 'comp-pending-only';
    const pendingOnlyAsgnId = 'asgn-pending-only';
    await adminDb.collection('competitions').doc(pendingOnlyCompId).set({
      id: pendingOnlyCompId,
      name: 'Pending Only Competition',
      maxMarks: 100
    });
    await adminDb.collection('registrations').doc('reg-only-pending').set({
      id: 'reg-only-pending',
      competitionId: pendingOnlyCompId,
      status: 'PENDING'
    });
    await adminDb.collection('judgeAssignments').doc(pendingOnlyAsgnId).set({
      id: pendingOnlyAsgnId,
      competitionId: pendingOnlyCompId,
      status: 'ACTIVE',
      revoked: false,
      salt,
      hashedSecret,
      secretHash: hashedSecret,
      expiresAtMs: Date.now() + 3600000,
      expiresAt: new Date(Date.now() + 3600000).toISOString()
    });

    await expect(
      JudgeService.submitMarks({
        assignmentId: pendingOnlyAsgnId,
        competitionId: pendingOnlyCompId,
        secret: pin,
        scores: { 'reg-only-pending': 75 }
      })
    ).rejects.toThrow(/zero eligible approved registrations/i);
  });

  it('37. Duplicate or ambiguous registration scoring in a single scorecard is strictly rejected', async () => {
    const adminDb = getAdminDb()!;
    const compId = 'comp-dupe-test';
    const asgnId = 'asgn-dupe-test';
    const pin = '9900';
    const salt = 'salt-dupe-9900';
    const hashedSecret = await hashSecret(pin, salt);

    await adminDb.collection('competitions').doc(compId).set({
      id: compId,
      name: 'Dupe Test Competition',
      maxMarks: 100
    });

    // Seed registration with multiple aliases (id: 'reg-dupe-1', participantId: 'part-dupe-1', bib: 'BIB-DUPE-1')
    await adminDb.collection('registrations').doc('reg-dupe-1').set({
      id: 'reg-dupe-1',
      competitionId: compId,
      participantId: 'part-dupe-1',
      bib: 'BIB-DUPE-1',
      status: 'APPROVED'
    });

    await adminDb.collection('judgeAssignments').doc(asgnId).set({
      id: asgnId,
      competitionId: compId,
      status: 'ACTIVE',
      revoked: false,
      salt,
      hashedSecret,
      secretHash: hashedSecret,
      expiresAtMs: Date.now() + 3600000,
      expiresAt: new Date(Date.now() + 3600000).toISOString()
    });

    // Attempting to score the same participant twice via two different aliases ('reg-dupe-1' and 'BIB-DUPE-1')
    await expect(
      JudgeService.submitMarks({
        assignmentId: asgnId,
        competitionId: compId,
        secret: pin,
        scores: {
          'reg-dupe-1': 85,
          'BIB-DUPE-1': 90
        }
      })
    ).rejects.toThrow(/duplicate score entry/i);
  });

  it('38. Server API endpoint POST /api/judge/marks authenticates Judge, validates scope, and enforces JudgeService invariants', async () => {
    const { POST: marksApiHandler } = await import('@/app/api/judge/marks/route');
    const { NextRequest } = await import('next/server');

    // 1. Missing fields -> 400 Bad Request
    const badReq = new NextRequest('http://localhost:3000/api/judge/marks', {
      method: 'POST',
      body: JSON.stringify({ action: 'SUBMIT' })
    });
    const badRes = await marksApiHandler(badReq);
    expect(badRes.status).toBe(400);

    // 2. Invalid secret / unauthorized -> 401 Unauthorized
    const unauthReq = new NextRequest('http://localhost:3000/api/judge/marks', {
      method: 'POST',
      body: JSON.stringify({
        action: 'SUBMIT',
        assignmentId: 'asgn-submit-service-test',
        competitionId: 'cmp-service-test',
        secret: 'WRONG-PIN',
        scores: { 'reg-service-1': 90 }
      })
    });
    const unauthRes = await marksApiHandler(unauthReq);
    expect(unauthRes.status).toBe(401);

    // 3. Valid draft request -> 200 OK
    const validDraftReq = new NextRequest('http://localhost:3000/api/judge/marks', {
      method: 'POST',
      body: JSON.stringify({
        action: 'DRAFT',
        assignmentId: 'asgn-draft-service-test',
        competitionId: 'comp-1',
        secret: '9911',
        scores: { 'reg-01': 92 },
        remarks: 'API draft test'
      })
    });
    const validDraftRes = await marksApiHandler(validDraftReq);
    expect(validDraftRes.status).toBe(200);
    const draftData = await validDraftRes.json();
    expect(draftData.success).toBe(true);
  });
});


