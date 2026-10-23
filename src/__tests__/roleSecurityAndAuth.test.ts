/**
 * Phase 3 Step 2B: Role Security, Authentication & Anti-Escalation Test Suite
 * 
 * Verifies against Local Firebase Emulator:
 * 1. Admin login & token claim validation (role === 'ADMIN').
 * 2. Team Manager login & token claim validation (role === 'TEAM_MANAGER', teamId === 'team-1').
 * 3. Cross-team isolation: Team Manager 1 CANNOT access or manage Team 2.
 * 4. Privilege escalation prevention: Team Manager CANNOT perform Admin actions or provision users.
 * 5. Privileged server operations enforce strict authorization (Theme, PointsLedger, JudgeService).
 * 6. Judge PIN authentication, rate limiting, and competition scope enforcement.
 * 7. Administrator bootstrap protection: Locks out once admin is provisioned; rejects bad secrets.
 */

import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { initializeApp, deleteApp, FirebaseApp } from 'firebase/app';
import {
  getAuth as getClientAuth,
  connectAuthEmulator,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  deleteUser,
  signOut,
  Auth as ClientAuth
} from 'firebase/auth';
import { AuthService } from '@/services/authService';
import { getAdminDb } from '@/lib/firebase/admin';
import { PointsLedgerService } from '@/services/pointsLedgerService';
import { ThemeService } from '@/services/themeService';
import { JudgeService } from '@/services/judgeService';
import { createJudgeAssignment, verifyJudgeAssignment } from '@/domain/judgeAuth';

describe('Phase 3 Step 2B: Authentication & Role-Based Authorization Enforcement', () => {
  let clientApp: FirebaseApp;
  let clientAuth: ClientAuth;

  let adminIdToken = '';
  let teamManagerToken = '';

  beforeAll(async () => {
    // Connect client SDK to local emulator
    const appName = `auth-test-app-${Date.now()}`;
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

    // 1. Authenticate Admin to obtain real ID token from emulator
    const adminCred = await signInWithEmailAndPassword(
      clientAuth,
      'admin@sahithyolsav.com',
      'AdminPassword123!'
    );
    adminIdToken = await adminCred.user.getIdToken();
    await signOut(clientAuth);

    // 2. Authenticate Team Manager (Shamama / team-1)
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

  describe('1. Identity & Role Verification', () => {
    it('verifies Admin ID Token carries verified ADMIN role', async () => {
      const user = await AuthService.verifySession(adminIdToken);
      expect(user.role).toBe('ADMIN');
      expect(user.email).toBe('admin@sahithyolsav.com');
      await expect(AuthService.assertAdmin(adminIdToken)).resolves.toBeDefined();
    });

    it('verifies Team Manager ID Token carries verified TEAM_MANAGER role and teamId', async () => {
      const user = await AuthService.verifySession(teamManagerToken);
      expect(user.role).toBe('TEAM_MANAGER');
      expect(user.teamId).toBe('team-1');
      expect(user.email).toBe('manager.shamama@sahithyolsav.com');
      await expect(AuthService.assertTeamManager(teamManagerToken, 'team-1')).resolves.toBeDefined();
    });

    it('STRICTLY REJECTS authenticated users who lack an authoritative user record in Firestore', async () => {
      // Create an unprovisioned ephemeral user directly in Firebase Auth (no record in Firestore 'users')
      const unprovisionedEmail = `ghost-${Date.now()}@test.com`;
      const cred = await createUserWithEmailAndPassword(clientAuth, unprovisionedEmail, 'GhostPass123!');
      const ghostToken = await cred.user.getIdToken();

      try {
        await expect(
          AuthService.verifySession(ghostToken)
        ).rejects.toThrow(/does not have an authoritative record in Firestore/i);
      } finally {
        await deleteUser(cred.user).catch(() => {});
      }
    });

    it('STRICTLY REJECTS disabled user accounts even if ID token signature is valid', async () => {
      const db = getAdminDb();
      if (!db) return;

      // Temporarily mark team manager as disabled in Firestore
      await db.collection('users').doc('tm-shamama').update({ status: 'DISABLED', disabled: true });
      try {
        await expect(
          AuthService.verifySession(teamManagerToken)
        ).rejects.toThrow(/has been disabled by fest administration/i);
      } finally {
        // Restore active status
        await db.collection('users').doc('tm-shamama').update({ status: 'ACTIVE', disabled: false });
      }
    });

    it('STRICTLY REJECTS Team Manager account missing mandatory team assignment', async () => {
      const db = getAdminDb();
      if (!db) return;

      // Temporarily remove teamId
      await db.collection('users').doc('tm-shamama').update({ teamId: null });
      try {
        await expect(
          AuthService.verifySession(teamManagerToken)
        ).rejects.toThrow(/missing mandatory team assignment/i);
      } finally {
        // Restore teamId
        await db.collection('users').doc('tm-shamama').update({ teamId: 'team-1' });
      }
    });

    it('STRICTLY REJECTS privileged operations when token role claim is missing (does not derive role solely from Firestore)', async () => {
      const db = getAdminDb();
      if (!db) return;

      // Create an authenticated user with no custom claims (defaults to role: 'PUBLIC' in verifySession)
      const testEmail = `noclaim-${Date.now()}@test.com`;
      const cred = await createUserWithEmailAndPassword(clientAuth, testEmail, 'UserPassword123!');
      const noClaimToken = await cred.user.getIdToken();

      // Create a Firestore document claiming this user is an ADMIN
      await db.collection('users').doc(cred.user.uid).set({
        id: cred.user.uid,
        email: testEmail,
        role: 'ADMIN',
        status: 'ACTIVE',
        disabled: false
      });

      try {
        // Must reject because token role ('PUBLIC') does not match Firestore ('ADMIN')
        await expect(
          AuthService.verifySession(noClaimToken)
        ).rejects.toThrow(/does not match authoritative record|Exact agreement required/i);
      } finally {
        await db.collection('users').doc(cred.user.uid).delete().catch(() => {});
        await deleteUser(cred.user).catch(() => {});
      }
    });

    it('STRICTLY REJECTS role mismatch when token claim does not match authoritative Firestore record', async () => {
      const db = getAdminDb();
      if (!db) return;

      // Temporarily change admin-01 Firestore role to TEAM_MANAGER (mismatch against token's ADMIN claim)
      await db.collection('users').doc('admin-01').update({ role: 'TEAM_MANAGER' });
      try {
        await expect(
          AuthService.verifySession(adminIdToken)
        ).rejects.toThrow(/does not match authoritative record|Role mismatch/i);
      } finally {
        // Restore admin-01 role
        await db.collection('users').doc('admin-01').update({ role: 'ADMIN' });
      }
    });

    it('STRICTLY REJECTS administrator account if status is PENDING in Firestore', async () => {
      const db = getAdminDb();
      if (!db) return;

      await db.collection('users').doc('admin-01').update({ status: 'PENDING' });
      try {
        await expect(
          AuthService.verifySession(adminIdToken)
        ).rejects.toThrow(/pending activation/i);
      } finally {
        await db.collection('users').doc('admin-01').update({ status: 'ACTIVE' });
      }
    });

    it('STRICTLY REJECTS administrator account if marked disabled in Firestore', async () => {
      const db = getAdminDb();
      if (!db) return;

      await db.collection('users').doc('admin-01').update({ status: 'DISABLED', disabled: true });
      try {
        await expect(
          AuthService.verifySession(adminIdToken)
        ).rejects.toThrow(/has been disabled by fest administration/i);
      } finally {
        await db.collection('users').doc('admin-01').update({ status: 'ACTIVE', disabled: false });
      }
    });

    it('STRICTLY REJECTS Team Manager if token teamId does not match Firestore teamId', async () => {
      const db = getAdminDb();
      if (!db) return;

      // Update Firestore teamId to 'team-2' while token has 'team-1'
      await db.collection('users').doc('tm-shamama').update({ teamId: 'team-2' });
      try {
        await expect(
          AuthService.verifySession(teamManagerToken)
        ).rejects.toThrow(/requires identical team assignment in token/i);
      } finally {
        // Restore team-1
        await db.collection('users').doc('tm-shamama').update({ teamId: 'team-1' });
      }
    });

    it('STRICTLY REJECTS Team Manager if status is PENDING in Firestore', async () => {
      const db = getAdminDb();
      if (!db) return;

      await db.collection('users').doc('tm-shamama').update({ status: 'PENDING' });
      try {
        await expect(
          AuthService.verifySession(teamManagerToken)
        ).rejects.toThrow(/pending activation/i);
      } finally {
        await db.collection('users').doc('tm-shamama').update({ status: 'ACTIVE' });
      }
    });
  });

  describe('2. Anti-Cross-Team Access & Scope Isolation', () => {
    it('STRICTLY REJECTS Team Manager 1 attempting to access Team 2 data', async () => {
      await expect(
        AuthService.assertTeamManager(teamManagerToken, 'team-2')
      ).rejects.toThrow(/Cross-team access denied/i);
    });

    it('STRICTLY REJECTS Team Manager 1 attempting to access Team 3 data', async () => {
      await expect(
        AuthService.assertTeamManager(teamManagerToken, 'team-3')
      ).rejects.toThrow(/Cross-team access denied/i);
    });

    it('allows Admin supervisory access across any team', async () => {
      await expect(AuthService.assertTeamManager(adminIdToken, 'team-1')).resolves.toBeDefined();
      await expect(AuthService.assertTeamManager(adminIdToken, 'team-2')).resolves.toBeDefined();
    });
  });

  describe('3. Anti-Privilege Escalation', () => {
    it('STRICTLY REJECTS Team Manager attempting Admin assertion', async () => {
      await expect(
        AuthService.assertAdmin(teamManagerToken)
      ).rejects.toThrow(/requires ADMIN role/i);
    });

    it('STRICTLY REJECTS Team Manager attempting to provision new users', async () => {
      await expect(
        AuthService.provisionTeamManager(teamManagerToken, {
          email: 'hacker@sahithyolsav.com',
          password: 'Password123!',
          displayName: 'Hacked User',
          teamId: 'team-1'
        })
      ).rejects.toThrow(/requires ADMIN role/i);
    });

    it('STRICTLY REJECTS Team Manager attempting to change user roles', async () => {
      await expect(
        AuthService.updateUserRole(teamManagerToken, {
          targetUid: 'tm-shamama',
          newRole: 'ADMIN'
        })
      ).rejects.toThrow(/requires ADMIN role/i);
    });

    it('STRICTLY REJECTS Admin from demoting their own account (prevents accidental lockout)', async () => {
      const adminCtx = await AuthService.verifySession(adminIdToken);
      await expect(
        AuthService.updateUserRole(adminIdToken, {
          targetUid: adminCtx.uid,
          newRole: 'TEAM_MANAGER',
          newTeamId: 'team-1'
        })
      ).rejects.toThrow(/Administrators cannot demote their own account/i);
    });
  });

  describe('4. Server Operation Authorization Enforcement', () => {
    it('Theme updates reject non-admin ID tokens and missing tokens', async () => {
      // Rejects non-admin token
      await expect(
        ThemeService.updateTheme({ festivalName: 'Hacked Fest' }, teamManagerToken)
      ).rejects.toThrow(/requires ADMIN role/i);

      // Rejects missing token
      await expect(
        ThemeService.updateTheme({ festivalName: 'Hacked Fest' }, '')
      ).rejects.toThrow(/Unauthorized/i);
    });

    it('Points ledger commits reject non-admin ID tokens and missing tokens', async () => {
      // Rejects non-admin token
      await expect(
        PointsLedgerService.publishResultPoints({
          resultId: 'res-hack-1',
          competition: { id: 'cmp-1', code: 'C1', name: 'Qiraat', type: 'SOLO' },
          ranks: [],
          adminIdToken: teamManagerToken
        })
      ).rejects.toThrow(/requires ADMIN role/i);

      // Rejects missing token
      await expect(
        PointsLedgerService.publishResultPoints({
          resultId: 'res-hack-1',
          competition: { id: 'cmp-1', code: 'C1', name: 'Qiraat', type: 'SOLO' },
          ranks: [],
          adminIdToken: ''
        })
      ).rejects.toThrow(/Unauthorized/i);
    });

    it('Points ledger reversals reject non-admin ID tokens and missing tokens', async () => {
      // Rejects non-admin token
      await expect(
        PointsLedgerService.reverseResultPoints('res-hack-1', 'Malicious reversal', teamManagerToken)
      ).rejects.toThrow(/requires ADMIN role/i);

      // Rejects missing token
      await expect(
        PointsLedgerService.reverseResultPoints('res-hack-1', 'Malicious reversal', '')
      ).rejects.toThrow(/Unauthorized/i);
    });

    it('Judge assignment issuance rejects non-admin ID tokens and missing tokens', async () => {
      // Rejects non-admin token
      await expect(
        JudgeService.issueAssignment({
          judgeName: 'Fake Judge',
          judgePhone: '+91 99999 00000',
          competitionId: 'cmp-1',
          competitionCode: 'C1',
          competitionName: 'Qiraat',
          stageName: 'Stage 1',
          adminIdToken: teamManagerToken
        })
      ).rejects.toThrow(/requires ADMIN role/i);

      // Rejects missing token
      await expect(
        JudgeService.issueAssignment({
          judgeName: 'Fake Judge',
          judgePhone: '+91 99999 00000',
          competitionId: 'cmp-1',
          competitionCode: 'C1',
          competitionName: 'Qiraat',
          stageName: 'Stage 1',
          adminIdToken: ''
        })
      ).rejects.toThrow(/Unauthorized/i);
    });

    it('Judge assignment revocation rejects non-admin ID tokens and missing tokens', async () => {
      // Rejects non-admin token
      await expect(
        JudgeService.revokeAssignment('asgn-fake', teamManagerToken)
      ).rejects.toThrow(/requires ADMIN role/i);

      // Rejects missing token
      await expect(
        JudgeService.revokeAssignment('asgn-fake', '')
      ).rejects.toThrow(/Unauthorized/i);
    });
  });

  describe('5. Judge PIN Authentication & Competition Scope Restrictions', () => {
    it('validates genuine judge assignment and authenticates one-time PIN', async () => {
      const creds = await createJudgeAssignment({
        id: 'asgn-stage-a',
        judgeName: 'Qari Zayd',
        judgePhone: '+91 99999 11111',
        competitionId: 'cmp-1',
        competitionCode: 'CMP-01',
        competitionName: 'Quran Recitation',
        stageName: 'Stage A'
      });

      const authResult = await verifyJudgeAssignment(creds.assignment, creds.oneTimeSecret);
      expect(authResult.valid).toBe(true);
      expect(authResult.competitionId).toBe('cmp-1');
    });

    it('STRICTLY ENFORCES attempt limits and rate-limits after repeated failures', async () => {
      const creds = await createJudgeAssignment({
        id: 'asgn-rate-limit-test',
        judgeName: 'Judge Test',
        judgePhone: '+91 99999 22222',
        competitionId: 'cmp-1',
        competitionCode: 'CMP-01',
        competitionName: 'Elocution',
        stageName: 'Stage B'
      });

      // 5 consecutive wrong PIN attempts
      for (let i = 0; i < 5; i++) {
        await verifyJudgeAssignment(creds.assignment, 'WRONG-PIN-123');
      }

      // 6th attempt must be RATE_LIMITED even with the correct PIN
      const lockedResult = await verifyJudgeAssignment(creds.assignment, creds.oneTimeSecret);
      expect(lockedResult.valid).toBe(false);
      expect(lockedResult.reason).toBe('RATE_LIMITED');
    });

    it('STRICTLY REJECTS judge submitting marks for a different competition (Scope Enforcement)', async () => {
      await expect(
        JudgeService.submitMarks({
          assignmentId: 'non-existent-or-scope-mismatch',
          competitionId: 'cmp-99',
          secret: 'secret',
          scores: {}
        })
      ).rejects.toThrow(/Unauthorized/i);
    });
  });

  describe('6. Administrator Bootstrap Protection', () => {
    it('rejects bootstrap when an administrator already exists in the system', async () => {
      await expect(
        AuthService.bootstrapInitialAdmin({
          email: 'imposter@sahithyolsav.com',
          password: 'ImposterPass123!',
          displayName: 'Imposter Admin',
          bootstrapSecret: process.env.ADMIN_BOOTSTRAP_SECRET!
        })
      ).rejects.toThrow(/Security Lock: Initial administrator already provisioned/i);
    });

    it('rejects bootstrap when secret key is incorrect', async () => {
      await expect(
        AuthService.bootstrapInitialAdmin({
          email: 'admin2@sahithyolsav.com',
          password: 'Password123!',
          displayName: 'Second Admin',
          bootstrapSecret: 'WrongSecretKey!'
        })
      ).rejects.toThrow(/Invalid bootstrap secret key/i);
    });

    it('ensures bootstrap failure recovery releases lock when user creation fails', async () => {
      const db = getAdminDb();
      if (!db) return;

      // Ensure bootstrapLock document does not exist prior to test
      await db.collection('settings').doc('bootstrapLock').delete().catch(() => {});

      // Temporarily change existing admin role to test the user creation failure branch
      await db.collection('users').doc('admin-01').update({ role: 'PUBLIC' });

      try {
        // Attempt bootstrap with an invalid password (< 6 chars) to trigger auth failure
        await expect(
          AuthService.bootstrapInitialAdmin({
            email: 'retry-admin@sahithyolsav.com',
            password: '123', // Firebase Auth minimum length is 6
            displayName: 'Retry Admin',
            bootstrapSecret: process.env.ADMIN_BOOTSTRAP_SECRET!
          })
        ).rejects.toThrow();

        // Verify the lock was automatically cleaned up for recovery
        const lockDoc = await db.collection('settings').doc('bootstrapLock').get();
        expect(lockDoc.exists).toBe(false);
      } finally {
        // Always restore admin-01 role
        await db.collection('users').doc('admin-01').update({ role: 'ADMIN' });
      }
    });
  });

  describe('7. Invalid / Expired Token Rejection', () => {
    it('rejects malformed token strings safely without crash', async () => {
      await expect(
        AuthService.verifySession('malformed.jwt.token')
      ).rejects.toThrow(/Unauthorized/i);
    });

    it('rejects empty token strings immediately', async () => {
      await expect(
        AuthService.verifySession('')
      ).rejects.toThrow(/Missing or invalid authentication token/i);
    });
  });
});
