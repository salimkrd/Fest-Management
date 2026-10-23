import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import Module from 'module';
import { initializeApp, deleteApp, FirebaseApp } from 'firebase/app';
import {
  getAuth as getClientAuth,
  connectAuthEmulator,
  signInWithEmailAndPassword,
  signOut,
  Auth as ClientAuth
} from 'firebase/auth';
import { getAdminAuth, getAdminDb } from '@/lib/firebase/admin';
import { AuthService } from '@/services/authService';

describe('Firebase Admin SDK CommonJS / ESM Runtime Compatibility', () => {
  let clientApp: FirebaseApp;
  let clientAuth: ClientAuth;
  let adminIdToken = '';

  beforeAll(async () => {
    const appName = `compat-test-client-${Date.now()}`;
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

    const adminCred = await signInWithEmailAndPassword(
      clientAuth,
      'admin@sahithyolsav.com',
      'AdminPassword123!'
    );
    adminIdToken = await adminCred.user.getIdToken();
    await signOut(clientAuth);
  });

  afterAll(async () => {
    if (clientApp) {
      await deleteApp(clientApp).catch(() => {});
    }
  });

  it('1. Loads firebase-admin/auth in a simulated runtime lacking require(ESM) support', () => {
    const origRequire = (Module.prototype as any).require;
    let intercepted = false;

    // Simulate strict CommonJS-only runtime: throw ERR_REQUIRE_ESM if any ESM bundle is required
    (Module.prototype as any).require = function (id: string) {
      if (id.includes('dist/webapi') || (id.includes('jose') && id.endsWith('.mjs'))) {
        const err: any = new Error(`ERR_REQUIRE_ESM: require() of ES Module ${id} is not supported.`);
        err.code = 'ERR_REQUIRE_ESM';
        throw err;
      }
      return origRequire.apply(this, arguments);
    };

    try {
      // Must require cleanly without throwing ERR_REQUIRE_ESM
      const adminAuth = require('firebase-admin/auth');
      expect(adminAuth).toBeDefined();
      expect(typeof adminAuth.getAuth).toBe('function');
      intercepted = true;
    } finally {
      (Module.prototype as any).require = origRequire;
    }

    expect(intercepted).toBe(true);
  });

  it('2. Confirms getAuth and getFirestore initialize and connect cleanly', () => {
    const auth = getAdminAuth();
    const db = getAdminDb();

    expect(auth).not.toBeNull();
    expect(db).not.toBeNull();
  });

  it('3. Confirms verifyIdToken and revocation check succeed against local emulator', async () => {
    const auth = getAdminAuth();
    expect(auth).not.toBeNull();
    if (!auth) return;

    const decoded = await auth.verifyIdToken(adminIdToken, true);
    expect(decoded.uid).toBeDefined();
    expect(decoded.email).toBe('admin@sahithyolsav.com');
    expect(decoded.role).toBe('ADMIN');
  });

  it('4. Confirms custom user claims assignment, reading, and token revocation', async () => {
    const auth = getAdminAuth();
    expect(auth).not.toBeNull();
    if (!auth) return;

    const testEmail = `compat-test-${Date.now()}@sahithyolsav.com`;
    const user = await auth.createUser({
      email: testEmail,
      password: 'TestPassword123!',
      displayName: 'Compatibility Test User'
    });

    try {
      // Set custom claims
      await auth.setCustomUserClaims(user.uid, {
        role: 'TEAM_MANAGER',
        teamId: 'team-1'
      });

      // Verify custom claims persisted
      const refreshedUser = await auth.getUser(user.uid);
      expect(refreshedUser.customClaims?.role).toBe('TEAM_MANAGER');
      expect(refreshedUser.customClaims?.teamId).toBe('team-1');

      // Verify revocation
      await auth.revokeRefreshTokens(user.uid);
      const revokedUser = await auth.getUser(user.uid);
      expect(revokedUser.tokensValidAfterTime).toBeDefined();
    } finally {
      await auth.deleteUser(user.uid).catch(() => {});
    }
  });

  it('5. Confirms Team Manager provisioning via AuthService remains functional', async () => {
    const testEmail = `manager.compat-${Date.now()}@sahithyolsav.com`;

    const provisionResult = await AuthService.provisionTeamManager(adminIdToken, {
      email: testEmail,
      password: 'ManagerPassword123!',
      displayName: 'Compatibility Manager',
      teamId: 'team-1'
    });

    expect(provisionResult.uid).toBeDefined();
    expect(provisionResult.email).toBe(testEmail);
    expect(provisionResult.teamId).toBe('team-1');

    // Clean up
    const auth = getAdminAuth();
    const db = getAdminDb();
    if (auth && provisionResult.uid) {
      await auth.deleteUser(provisionResult.uid).catch(() => {});
    }
    if (db && provisionResult.uid) {
      await db.collection('users').doc(provisionResult.uid).delete().catch(() => {});
    }
  });
});
