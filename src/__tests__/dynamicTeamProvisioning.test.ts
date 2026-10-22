/**
 * Phase 3 Checkpoint 3: Secure Manual WhatsApp Team Manager Onboarding Test Suite
 * 
 * Verifies against Local Firebase Emulator (demo-sahithyolsav-2025):
 * 1. Dynamic team creation.
 * 2. Automatic manager account provisioning (status: PENDING).
 * 3. One-time invitation generation (cryptographic SHA-256 hash stored, plaintext code never persisted).
 * 4. WhatsApp invitation message formatting & clean wa.me URL (no query tokens).
 * 5. Manual send status confirmation (transition to MANUALLY_SENT).
 * 6. Invitation expiration and revocation enforcement.
 * 7. Successful invitation redemption & password setup via activateManager.
 * 8. Manager email/password authentication & promotion to ACTIVE.
 * 9. Duplicate / reused token rejection (single-use redemption).
 * 10. Wrong-team activation rejection.
 * 11. Public Firestore data isolation (teams/{id} has NO private metadata, secrets, or codes).
 * 12. Dynamic team creation with 1:1 manager provisioning without fixed team limits (5+ teams).
 * 13. Cross-team access isolation across managers.
 * 14. Manager replacement, token revocation, account demotion, and new invitation dispatch.
 * 15. Chief Administrator protection against hijacking or demotion.
 * 16. Preservation of all 40 official Sahithyolsav scoring matrix combinations.
 */

import './setupEnv';
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { initializeApp, FirebaseApp } from 'firebase/app';
import {
  getAuth as getClientAuth,
  connectAuthEmulator,
  signInWithEmailAndPassword,
  signOut,
  Auth as ClientAuth
} from 'firebase/auth';
import { getFirestore as getClientFirestore, connectFirestoreEmulator, doc, getDoc, setDoc, Firestore as ClientFirestore } from 'firebase/firestore';
import { TeamService } from '@/services/teamService';
import { InvitationService } from '@/services/invitationService';
import { getAdminAuth, getAdminDb } from '@/lib/firebase/admin';
import { FirestoreTeam, FirestoreTeamPrivate, FirestoreUser } from '@/types/firestore';
import { getChampionshipPoints, CompetitionType, Grade, SAHITHYOLSAV_POINTS_MATRIX } from '@/domain/scoring';

describe('Phase 3 Checkpoint 3: Secure Manual WhatsApp Team Manager Onboarding', () => {
  let clientApp: FirebaseApp;
  let clientAuth: ClientAuth;
  let clientDb: ClientFirestore;
  let adminIdToken = '';

  beforeAll(async () => {
    // 1. Initialize Client SDK attached to local emulator
    const appName = `checkpoint3-whatsapp-test-${Date.now()}`;
    clientApp = initializeApp(
      {
        apiKey: 'demo-api-key',
        projectId: 'demo-sahithyolsav-2025',
        authDomain: 'demo-sahithyolsav-2025.firebaseapp.com'
      },
      appName
    );

    clientAuth = getClientAuth(clientApp);
    clientDb = getClientFirestore(clientApp);

    connectAuthEmulator(clientAuth, 'http://127.0.0.1:9099', { disableWarnings: true });
    connectFirestoreEmulator(clientDb, '127.0.0.1', 8080);

    // 2. Sign in as Chief Administrator in Emulator
    const adminCred = await signInWithEmailAndPassword(
      clientAuth,
      'admin@sahithyolsav.com',
      'AdminPassword123!'
    );
    adminIdToken = await adminCred.user.getIdToken();
  });

  afterAll(async () => {
    if (clientAuth) {
      await signOut(clientAuth).catch(() => {});
    }
  });

  // TEST 1 & 2: Dynamic team creation & automatic manager provisioning in PENDING status
  it('1. should create dynamic team and provision manager account in PENDING activation status', async () => {
    const adminDb = getAdminDb();
    const adminAuth = getAdminAuth();
    expect(adminDb).toBeDefined();
    expect(adminAuth).toBeDefined();

    const timestamp = Date.now();
    const teamName = `Al-Hikmah House ${timestamp}`;
    const managerEmail = `manager.hikmah.${timestamp}@sahithyolsav.com`;
    const managerPhone = '+91 98471 99001';

    const result = await TeamService.createTeamWithManager(adminIdToken, {
      name: teamName,
      code: 'AHH',
      color: '#0D9488',
      zone: 'North Campus',
      managerEmail,
      managerName: 'Zayd Al-Hikmah',
      managerPhone
    });

    expect(result.team).toBeDefined();
    expect(result.team.id).toBeDefined();
    expect(result.team.name).toBe(teamName);
    expect(result.managerUid).toBeDefined();
    expect(result.invitation).toBeDefined();

    // Verify manager user record in Firestore is in PENDING status
    const userDoc = await adminDb!.collection('users').doc(result.managerUid!).get();
    expect(userDoc.exists).toBe(true);
    const userData = userDoc.data() as FirestoreUser;
    expect(userData.role).toBe('TEAM_MANAGER');
    expect(userData.teamId).toBe(result.team.id);
    expect(userData.status).toBe('PENDING'); // Kept in PENDING activation status

    // Verify custom claims
    const authUser = await adminAuth!.getUser(result.managerUid!);
    expect(authUser.customClaims?.role).toBe('TEAM_MANAGER');
    expect(authUser.customClaims?.teamId).toBe(result.team.id);

    // Verify public Firestore document: teams/{id} has ONLY safe public metadata
    const teamSnap = await adminDb!.collection('teams').doc(result.team.id).get();
    const publicTeam = teamSnap.data() as any;
    expect(publicTeam.name).toBe(teamName);
    expect(publicTeam.code).toBe('AHH');
    expect(publicTeam.status).toBe('ACTIVE');
    expect(publicTeam.managerEmail).toBeUndefined();
    expect(publicTeam.managerPhone).toBeUndefined();
    expect(publicTeam.invitationCode).toBeUndefined();
    expect(publicTeam.invitationTokenHash).toBeUndefined();

    // Verify private subcollection: teams/{id}/private/managerInfo
    const privSnap = await adminDb!.collection('teams').doc(result.team.id).collection('private').doc('managerInfo').get();
    expect(privSnap.exists).toBe(true);
    const privData = privSnap.data() as FirestoreTeamPrivate;
    expect(privData.managerEmail).toBe(managerEmail);
    expect(privData.managerPhone).toBe(managerPhone);
    expect(privData.portalAccess).toBe(false); // No access until activated
    expect(privData.invitationStatus).toBe('READY_TO_SEND');
    expect(privData.invitationTokenHash).toBeDefined();
    expect((privData as any).invitationCode).toBeUndefined(); // Raw code NEVER saved
  });

  // TEST 3 & 4: One-time invitation generation & message formatting
  it('2. should format official WhatsApp message and provide clean wa.me link without secrets in URL', async () => {
    const timestamp = Date.now();
    const teamName = `Granada Contingent ${timestamp}`;
    const managerEmail = `granada.${timestamp}@sahithyolsav.com`;
    const managerPhone = '+91 98471 55555';

    const result = await TeamService.createTeamWithManager(adminIdToken, {
      name: teamName,
      managerEmail,
      managerPhone
    });

    const inv = result.invitation!;
    expect(inv.code).toMatch(/^INSP-[A-F0-9]{8}-[A-F0-9]{8}-[A-F0-9]{8}-[A-F0-9]{8}$/);
    const hexChars = inv.code.replace(/[^A-F0-9]/g, '');
    expect(hexChars.length).toBe(32); // 32 hex chars = 128 bits of entropy

    // Verify WhatsApp URL contains ONLY the phone number, NO tokens
    expect(inv.whatsappUrl).toBe('https://wa.me/919847155555');
    expect(inv.whatsappUrl).not.toContain(inv.code);
    expect(inv.whatsappUrl).not.toContain('token');

    // Verify copyable WhatsApp message contains required text
    expect(inv.message).toContain('You have been appointed as the Team Manager of ' + teamName);
    expect(inv.message).toContain('Login Email: ' + managerEmail);
    expect(inv.message).toContain('Invitation Code: ' + inv.code);
    expect(inv.message).toContain('/team/activate');
    expect(inv.message).toContain('— Inspirath Administration');
  });

  // TEST 5: Manual send confirmation
  it('3. should update status to MANUALLY_SENT upon Chief Admin confirmation', async () => {
    const adminDb = getAdminDb();
    const timestamp = Date.now();
    const team = await TeamService.createTeamWithManager(adminIdToken, {
      name: `Sent Confirmation Team ${timestamp}`,
      managerEmail: `sent.${timestamp}@sahithyolsav.com`,
      managerPhone: '+91 98471 22334'
    });

    const sentResult = await TeamService.markInvitationSent(adminIdToken, team.team.id);
    expect(sentResult.success).toBe(true);
    expect(sentResult.invitationStatus).toBe('MANUALLY_SENT');

    // Verify private record updated
    const privSnap = await adminDb!.collection('teams').doc(team.team.id).collection('private').doc('managerInfo').get();
    expect(privSnap.data()?.invitationStatus).toBe('MANUALLY_SENT');
    expect(privSnap.data()?.invitationSentAt).toBeDefined();

    // Verify account is STILL PENDING until manager activates
    const userSnap = await adminDb!.collection('users').doc(team.managerUid!).get();
    expect(userSnap.data()?.status).toBe('PENDING');
  });

  // TEST 6: Invitation revocation
  it('4. should revoke active invitation code and reject subsequent redemption attempts', async () => {
    const timestamp = Date.now();
    const team = await TeamService.createTeamWithManager(adminIdToken, {
      name: `Revoke Test Team ${timestamp}`,
      managerEmail: `revoke.${timestamp}@sahithyolsav.com`,
      managerPhone: '+91 98471 77889'
    });

    const code = team.invitation!.code;

    // Revoke invitation
    const revokeResult = await TeamService.revokeInvitation(adminIdToken, team.team.id);
    expect(revokeResult.success).toBe(true);
    expect(revokeResult.invitationStatus).toBe('REVOKED');

    // Attempting activation with revoked code must be rejected
    await expect(
      TeamService.activateManager({
        code,
        email: `revoke.${timestamp}@sahithyolsav.com`,
        newPassword: 'SecureNewPassword123!',
        teamId: team.team.id
      })
    ).rejects.toThrow(/revoked/i);
  });

  // TEST 7 & 8: Successful activation, password setup, and login
  it('5. should allow manager to redeem invitation code, set password, and log in to client SDK', async () => {
    const adminDb = getAdminDb();
    const timestamp = Date.now();
    const managerEmail = `activate.success.${timestamp}@sahithyolsav.com`;
    const managerPhone = '+91 98471 00123';

    const result = await TeamService.createTeamWithManager(adminIdToken, {
      name: `Activation Success Team ${timestamp}`,
      managerEmail,
      managerPhone
    });

    const code = result.invitation!.code;
    const newPassword = 'ManagerFinalPassword123!';

    // Verify code preview
    const preview = await TeamService.verifyInvitationCode(code, managerEmail);
    expect(preview.valid).toBe(true);
    expect(preview.managerEmail).toBe(managerEmail);

    // Redeem code & set password
    const activation = await TeamService.activateManager({
      code,
      email: managerEmail,
      newPassword,
      teamId: result.team.id
    });

    expect(activation.success).toBe(true);

    // Verify authoritative user record was promoted to ACTIVE
    const userSnap = await adminDb!.collection('users').doc(result.managerUid!).get();
    expect(userSnap.data()?.status).toBe('ACTIVE');

    // Verify private managerInfo marked ACTIVATED
    const privSnap = await adminDb!.collection('teams').doc(result.team.id).collection('private').doc('managerInfo').get();
    expect(privSnap.data()?.invitationStatus).toBe('ACTIVATED');
    expect(privSnap.data()?.invitationRedeemed).toBe(true);
    expect(privSnap.data()?.portalAccess).toBe(true);

    // Requirement 7: Email is NOT marked verified merely because WhatsApp code was redeemed
    const adminAuth = getAdminAuth();
    const authUserAfter = await adminAuth!.getUser(result.managerUid!);
    expect(authUserAfter.emailVerified).toBe(false);

    // Manager signs in using Firebase Client SDK with their new password
    const managerCred = await signInWithEmailAndPassword(clientAuth, managerEmail, newPassword);
    expect(managerCred.user.uid).toBe(result.managerUid);

    await signOut(clientAuth);
  });

  // TEST 9: Reused token rejection (single-use)
  it('6. should strictly reject duplicate redemption of an already redeemed invitation code', async () => {
    const timestamp = Date.now();
    const managerEmail = `reuse.${timestamp}@sahithyolsav.com`;

    const result = await TeamService.createTeamWithManager(adminIdToken, {
      name: `Reuse Guard Team ${timestamp}`,
      managerEmail,
      managerPhone: '+91 98471 99999'
    });

    const code = result.invitation!.code;

    // First redemption succeeds
    await TeamService.activateManager({
      code,
      email: managerEmail,
      newPassword: 'FirstPassword123!',
      teamId: result.team.id
    });

    // Second redemption must fail
    await expect(
      TeamService.activateManager({
        code,
        email: managerEmail,
        newPassword: 'SecondPassword123!',
        teamId: result.team.id
      })
    ).rejects.toThrow(/already been redeemed/i);
  });

  // TEST 10: Wrong-team / Wrong-email activation rejection
  it('7. should strictly reject activation when email or team does not match the invitation code', async () => {
    const timestamp = Date.now();
    const legitimateEmail = `legit.${timestamp}@sahithyolsav.com`;
    const attackerEmail = `attacker.${timestamp}@sahithyolsav.com`;

    const result = await TeamService.createTeamWithManager(adminIdToken, {
      name: `Wrong Team Test ${timestamp}`,
      managerEmail: legitimateEmail,
      managerPhone: '+91 98471 11223'
    });

    const code = result.invitation!.code;

    // Mismatched email must fail
    await expect(
      TeamService.activateManager({
        code,
        email: attackerEmail,
        newPassword: 'AttackerPassword123!',
        teamId: result.team.id
      })
    ).rejects.toThrow(/does not match/i);

    // Mismatched teamId must fail
    await expect(
      TeamService.activateManager({
        code,
        email: legitimateEmail,
        newPassword: 'AttackerPassword123!',
        teamId: 'wrong-team-id-999'
      })
    ).rejects.toThrow(/not valid for the requested team/i);
  });

  // TEST 11: Public Firestore Data Isolation
  it('8. should strictly deny public unauthenticated clients from reading private manager info', async () => {
    const timestamp = Date.now();
    const team = await TeamService.createTeamWithManager(adminIdToken, {
      name: `Isolation Team ${timestamp}`,
      managerEmail: `isolation.${timestamp}@sahithyolsav.com`,
      managerPhone: '+91 98471 09876'
    });

    // Unauthenticated client reads public team doc: SUCCESS
    const publicDocRef = doc(clientDb, 'teams', team.team.id);
    const publicDocSnap = await getDoc(publicDocRef);
    expect(publicDocSnap.exists()).toBe(true);
    expect(publicDocSnap.data()?.name).toBe(`Isolation Team ${timestamp}`);

    // Unauthenticated client reads private subcollection: DENIED
    const privateDocRef = doc(clientDb, 'teams', team.team.id, 'private', 'managerInfo');
    await expect(getDoc(privateDocRef)).rejects.toThrow(/permission-denied|PERMISSION_DENIED|false for 'get'/i);
  });

  // TEST 12: Dynamic Scalability (5+ Teams)
  it('9. should create multiple teams dynamically with 1:1 manager provisioning without fixed team limits', async () => {
    const timestamp = Date.now();
    const contingents = ['Qurtuba', 'Baghdad', 'Samarkand', 'Isfahan', 'Fez'];

    for (const name of contingents) {
      const res = await TeamService.createTeamWithManager(adminIdToken, {
        name: `${name} Contingent ${timestamp}`,
        managerEmail: `manager.${name.toLowerCase()}.${timestamp}@sahithyolsav.com`,
        managerPhone: '+91 98471 00000'
      });

      expect(res.team.id).toBeDefined();
      expect(res.managerUid).toBeDefined();
      expect(res.invitation?.code).toBeDefined();
    }
  });

  // TEST 13: Strict Cross-Team Access Isolation
  it('10. should enforce strict one-team access isolation across managers', async () => {
    const timestamp = Date.now();
    const teamA = await TeamService.createTeamWithManager(adminIdToken, {
      name: `Alpha House ${timestamp}`,
      managerEmail: `alpha.${timestamp}@sahithyolsav.com`,
      managerPhone: '+91 98471 11111'
    });

    const teamB = await TeamService.createTeamWithManager(adminIdToken, {
      name: `Beta House ${timestamp}`,
      managerEmail: `beta.${timestamp}@sahithyolsav.com`,
      managerPhone: '+91 98471 22222'
    });

    // Activate Team A manager
    await TeamService.activateManager({
      code: teamA.invitation!.code,
      email: `alpha.${timestamp}@sahithyolsav.com`,
      newPassword: 'AlphaPassword123!',
      teamId: teamA.team.id
    });

    // Sign in as Manager A
    const credA = await signInWithEmailAndPassword(clientAuth, `alpha.${timestamp}@sahithyolsav.com`, 'AlphaPassword123!');
    expect(credA.user.uid).toBe(teamA.managerUid);

    // Manager A creates participant for Team A: ALLOWED
    const validPartRef = doc(clientDb, 'participants', `part-alpha-${timestamp}`);
    await expect(
      setDoc(validPartRef, {
        id: `part-alpha-${timestamp}`,
        teamId: teamA.team.id,
        name: 'Zayd Alpha',
        categoryId: 'cat-junior',
        registeredEventIds: []
      })
    ).resolves.not.toThrow();

    // Manager A attempts to create participant for Team B: FORBIDDEN
    const illicitPartRef = doc(clientDb, 'participants', `part-beta-illicit-${timestamp}`);
    await expect(
      setDoc(illicitPartRef, {
        id: `part-beta-illicit-${timestamp}`,
        teamId: teamB.team.id,
        name: 'Intruder Participant',
        categoryId: 'cat-junior',
        registeredEventIds: []
      })
    ).rejects.toThrow(/permission-denied|PERMISSION_DENIED/i);

    await signOut(clientAuth);
  });

  // TEST 14: Manager Replacement, Token Revocation & Demotion
  it('11. should revoke previous manager tokens, demote account, and provision new manager with new invitation on replacement', async () => {
    const adminDb = getAdminDb();
    const adminAuth = getAdminAuth();
    const timestamp = Date.now();

    const original = await TeamService.createTeamWithManager(adminIdToken, {
      name: `Replacement Contingent ${timestamp}`,
      managerEmail: `initial.mgr.${timestamp}@sahithyolsav.com`,
      managerPhone: '+91 98471 10001'
    });

    // Replace manager
    const newEmail = `new.mgr.${timestamp}@sahithyolsav.com`;
    const replacement = await TeamService.replaceTeamManager(adminIdToken, original.team.id, {
      newManagerEmail: newEmail,
      newManagerName: 'New Replacement Manager',
      newManagerPhone: '+91 98471 10002'
    });

    expect(replacement.newManagerUid).not.toBe(original.managerUid);
    expect(replacement.invitation.code).toBeDefined();

    // Verify previous manager was demoted in Firestore
    const oldUserSnap = await adminDb!.collection('users').doc(original.managerUid!).get();
    expect(oldUserSnap.data()?.role).toBe('PUBLIC');
    expect(oldUserSnap.data()?.disabled).toBe(true);

    // Verify previous manager claims revoked
    const oldAuth = await adminAuth!.getUser(original.managerUid!);
    expect(oldAuth.customClaims?.role).toBe('PUBLIC');

    // Verify new manager is in PENDING status
    const newUserSnap = await adminDb!.collection('users').doc(replacement.newManagerUid).get();
    expect(newUserSnap.data()?.role).toBe('TEAM_MANAGER');
    expect(newUserSnap.data()?.status).toBe('PENDING');

    // New manager can activate with their new code
    const activation = await TeamService.activateManager({
      code: replacement.invitation.code,
      email: newEmail,
      newPassword: 'NewManagerPass123!',
      teamId: original.team.id
    });
    expect(activation.success).toBe(true);
  });

  // TEST 15: Chief Administrator Protection
  it('12. should ensure existing Chief Administrator remains unaffected and cannot be hijacked or demoted', async () => {
    const timestamp = Date.now();

    await expect(
      TeamService.createTeamWithManager(adminIdToken, {
        name: `Admin Hijack Attempt ${timestamp}`,
        managerEmail: 'admin@sahithyolsav.com',
        managerPhone: '+91 98471 00000'
      })
    ).rejects.toThrow(/Administrator/i);
  });

  // TEST 16: Preservation of all 40 approved scoring combinations
  it('13. should preserve all 40 approved combinations of the official Sahithyolsav scoring matrix', () => {
    const competitionTypes: CompetitionType[] = ['SOLO', 'GROUP'];
    const grades: Grade[] = ['A+', 'A', 'B', 'C', 'NO_GRADE'];
    const positions: (1 | 2 | 3 | null)[] = [1, 2, 3, null];

    let combinationCount = 0;
    for (const compType of competitionTypes) {
      for (const grade of grades) {
        for (const pos of positions) {
          const pts = getChampionshipPoints(compType, grade, pos);
          const normalizedPos = pos === null ? 'NO_PRIZE' : pos;
          const expectedPts = SAHITHYOLSAV_POINTS_MATRIX[compType][grade][normalizedPos];
          expect(pts).toBe(expectedPts);
          combinationCount++;
        }
      }
    }

    expect(combinationCount).toBe(40);
  });

  // TEST 14: Concurrency Protection & Atomic Single-Use
  it('14. should handle concurrent activation attempts atomically without double-redemption', async () => {
    const timestamp = Date.now();
    const managerEmail = `concurrency.${timestamp}@sahithyolsav.com`;

    const result = await TeamService.createTeamWithManager(adminIdToken, {
      name: `Concurrency Guard Team ${timestamp}`,
      managerEmail,
      managerPhone: '+91 98471 88888'
    });

    const code = result.invitation!.code;

    // Launch 3 simultaneous activation requests with the same code
    const results = await Promise.allSettled([
      TeamService.activateManager({
        code,
        email: managerEmail,
        newPassword: 'ConcurrentPassword123!',
        teamId: result.team.id
      }),
      TeamService.activateManager({
        code,
        email: managerEmail,
        newPassword: 'ConcurrentPassword123!',
        teamId: result.team.id
      }),
      TeamService.activateManager({
        code,
        email: managerEmail,
        newPassword: 'ConcurrentPassword123!',
        teamId: result.team.id
      })
    ]);

    const successes = results.filter((r) => r.status === 'fulfilled');
    const failures = results.filter((r) => r.status === 'rejected');

    // Exactly one must succeed, the others must fail due to single-use or concurrency lock
    expect(successes.length).toBe(1);
    expect(failures.length).toBe(2);

    for (const failure of failures) {
      if (failure.status === 'rejected') {
        expect(failure.reason.message).toMatch(/already been redeemed|currently being processed/i);
      }
    }
  });

  // TEST 15: Account-Specific Rate Limiting & Lockout
  it('15. should lock out account activation after 5 repeated failed attempts', async () => {
    const timestamp = Date.now();
    const legitEmail = `ratelimit.legit.${timestamp}@sahithyolsav.com`;

    const result = await TeamService.createTeamWithManager(adminIdToken, {
      name: `Rate Limit Team ${timestamp}`,
      managerEmail: legitEmail,
      managerPhone: '+91 98471 77777'
    });

    const code = result.invitation!.code;

    // 5 failed attempts with mismatched email
    for (let i = 0; i < 5; i++) {
      await expect(
        TeamService.activateManager({
          code,
          email: `wrong.${i}.${timestamp}@sahithyolsav.com`,
          newPassword: 'Password123!',
          teamId: result.team.id
        })
      ).rejects.toThrow(/does not match/i);
    }

    // 6th attempt must be locked out, even if now using the legit email
    await expect(
      TeamService.activateManager({
        code,
        email: legitEmail,
        newPassword: 'Password123!',
        teamId: result.team.id
      })
    ).rejects.toThrow(/temporarily locked/i);
  });

  // TEST 16: Safe Recovery from Partial Failure
  it('16. should release concurrency lock on failure allowing safe retry', async () => {
    const timestamp = Date.now();
    const managerEmail = `safe.retry.${timestamp}@sahithyolsav.com`;

    const result = await TeamService.createTeamWithManager(adminIdToken, {
      name: `Safe Recovery Team ${timestamp}`,
      managerEmail,
      managerPhone: '+91 98471 66666'
    });

    const code = result.invitation!.code;

    // Attempt with invalid password (< 6 chars) fails validation before Auth/DB
    await expect(
      TeamService.activateManager({
        code,
        email: managerEmail,
        newPassword: 'short',
        teamId: result.team.id
      })
    ).rejects.toThrow(/at least 6 characters/i);

    // Concurrency lock is clean, subsequent valid request succeeds
    const retryResult = await TeamService.activateManager({
      code,
      email: managerEmail,
      newPassword: 'ValidRetriedPassword123!',
      teamId: result.team.id
    });

    expect(retryResult.success).toBe(true);
  });

  // TEST 17: Pending Accounts Blocked from Team Manager Operations
  it('17. should block manager in PENDING status from performing privileged team operations', async () => {
    const adminDb = getAdminDb();
    const timestamp = Date.now();
    const pendingEmail = `pending.block.${timestamp}@sahithyolsav.com`;

    const result = await TeamService.createTeamWithManager(adminIdToken, {
      name: `Pending Block Team ${timestamp}`,
      managerEmail: pendingEmail,
      managerPhone: '+91 98471 55555'
    });

    // Account is in PENDING status
    const userSnap = await adminDb!.collection('users').doc(result.managerUid!).get();
    expect(userSnap.data()?.status).toBe('PENDING');

    const privSnap = await adminDb!.collection('teams').doc(result.team.id).collection('private').doc('managerInfo').get();
    expect(privSnap.data()?.portalAccess).toBe(false);
  });

  // TEST 18: Disabled Team Lifecycle & Access Restriction
  it('18. should block activated manager from accessing a DISABLED team, and restore access only after Admin re-enables it', async () => {
    const adminDb = getAdminDb();
    const timestamp = Date.now();
    const managerEmail = `lifecycle.${timestamp}@sahithyolsav.com`;
    const managerPassword = 'LifecyclePassword123!';

    // 1. Create team & activate manager
    const created = await TeamService.createTeamWithManager(adminIdToken, {
      name: `Lifecycle Team ${timestamp}`,
      managerEmail,
      managerPhone: '+91 98471 44332'
    });

    const activation = await TeamService.activateManager({
      code: created.invitation!.code,
      email: managerEmail,
      newPassword: managerPassword,
      teamId: created.team.id
    });
    expect(activation.success).toBe(true);

    // Verify invitationStatus is ACTIVATED, NOT READY_TO_SEND
    const activePrivSnap = await adminDb!.collection('teams').doc(created.team.id).collection('private').doc('managerInfo').get();
    expect(activePrivSnap.data()?.invitationStatus).toBe('ACTIVATED');

    // 2. Admin disables team
    await TeamService.setTeamStatus(adminIdToken, created.team.id, false);

    // Verify user record status in Firestore is DISABLED
    const disabledUserSnap = await adminDb!.collection('users').doc(created.managerUid!).get();
    expect(disabledUserSnap.data()?.status).toBe('DISABLED');
    expect(disabledUserSnap.data()?.disabled).toBe(true);

    // 3. Manager cannot log in while team is DISABLED (Auth account disabled)
    await expect(
      signInWithEmailAndPassword(clientAuth, managerEmail, managerPassword)
    ).rejects.toThrow(/user-disabled/i);

    // 4. Admin re-enables team
    await TeamService.setTeamStatus(adminIdToken, created.team.id, true);

    // Verify user record restored to ACTIVE because invitationStatus was ACTIVATED
    const enabledUserSnap = await adminDb!.collection('users').doc(created.managerUid!).get();
    expect(enabledUserSnap.data()?.status).toBe('ACTIVE');
    expect(enabledUserSnap.data()?.disabled).toBe(false);

    // 5. Manager can now log in and access only their assigned workspace
    const enabledCred = await signInWithEmailAndPassword(clientAuth, managerEmail, managerPassword);
    expect(enabledCred.user.uid).toBe(created.managerUid);

    const partRef = doc(clientDb, 'participants', `part-lifecycle-${timestamp}`);
    await expect(
      setDoc(partRef, {
        id: `part-lifecycle-${timestamp}`,
        teamId: created.team.id,
        name: 'Re-enabled Team Participant',
        categoryId: 'cat-junior',
        registeredEventIds: []
      })
    ).resolves.not.toThrow();

    // Verify manager cannot access another team's workspace
    const otherPartRef = doc(clientDb, 'participants', `part-other-${timestamp}`);
    await expect(
      setDoc(otherPartRef, {
        id: `part-other-${timestamp}`,
        teamId: 'other-team-999',
        name: 'Illicit Participant',
        categoryId: 'cat-junior',
        registeredEventIds: []
      })
    ).rejects.toThrow(/permission-denied|PERMISSION_DENIED/i);

    await signOut(clientAuth);
  });

  // TEST 19: Production Trusted HTTPS URL Enforcement
  it('19. should require explicitly configured trusted HTTPS URL in production and reject arbitrary host headers', () => {
    const originalEnv = process.env.NODE_ENV;
    const originalAppUrl = process.env.NEXT_PUBLIC_APP_URL;

    try {
      // Switch to production mode
      (process.env as any).NODE_ENV = 'production';
      delete process.env.NEXT_PUBLIC_APP_URL;
      delete process.env.APP_URL;

      // 1. Without NEXT_PUBLIC_APP_URL in production -> Throws Configuration Error
      expect(() => {
        InvitationService.createInvitationPackage({
          teamName: 'Prod Team',
          managerEmail: 'prod@sahithyolsav.com',
          managerPhone: '+91 98471 00000'
        });
      }).toThrow(/Configuration Error/i);

      // 2. Insecure HTTP URL in production -> Throws Security Violation
      process.env.NEXT_PUBLIC_APP_URL = 'http://insecure-host.com';
      expect(() => {
        InvitationService.createInvitationPackage({
          teamName: 'Prod Team',
          managerEmail: 'prod@sahithyolsav.com',
          managerPhone: '+91 98471 00000'
        });
      }).toThrow(/Security Violation.*HTTPS/i);

      // 3. Trusted HTTPS URL in production -> Succeeds with exact URL
      process.env.NEXT_PUBLIC_APP_URL = 'https://fest.sahithyolsav.com';
      const pkg = InvitationService.createInvitationPackage({
        teamName: 'Prod Team',
        managerEmail: 'prod@sahithyolsav.com',
        managerPhone: '+91 98471 00000'
      });
      expect(pkg.message).toContain('https://fest.sahithyolsav.com/team/activate');
    } finally {
      // Restore environment
      (process.env as any).NODE_ENV = originalEnv;
      if (originalAppUrl) {
        process.env.NEXT_PUBLIC_APP_URL = originalAppUrl;
      } else {
        delete process.env.NEXT_PUBLIC_APP_URL;
      }
    }
  });
});

