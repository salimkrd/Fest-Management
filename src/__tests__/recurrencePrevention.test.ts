/**
 * Phase 3 Step 5: Recurrence Prevention & Fail-Closed Security Test Suite
 * 
 * Verifies:
 * 1. Automated tests strictly fail closed if they attempt to connect to inspirath-d6778.
 * 2. Test execution cannot fall back to production through application default credentials,
 *    environment variables, or missing emulator connections.
 * 3. All tests must use the local Firebase Emulator or an explicitly designated non-production project.
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { getAdminApp } from '@/lib/firebase/admin';
import { getApps, deleteApp } from 'firebase-admin/app';

describe('Phase 3 Step 5: Recurrence Prevention & Fail-Closed Safeguards', () => {
  const originalEnv = { ...process.env };

  beforeEach(async () => {
    const apps = getApps();
    for (const app of apps) {
      await deleteApp(app).catch(() => {});
    }
  });

  afterEach(async () => {
    const apps = getApps();
    for (const app of apps) {
      await deleteApp(app).catch(() => {});
    }
    process.env = { ...originalEnv };
  });

  it('1. Fails closed with error if test attempts to initialize Admin SDK targeting inspirath-d6778', () => {
    (process.env as any).NODE_ENV = 'test';
    process.env.FIREBASE_ADMIN_PROJECT_ID = 'inspirath-d6778';
    delete process.env.ALLOW_PROD_TEST_READONLY;

    expect(() => {
      getAdminApp();
    }).toThrow(/\[FAIL-CLOSED SAFETY\] Automated tests are strictly prohibited from connecting to production project "inspirath-d6778"/i);
  });

  it('2. Fails closed if test execution tries to fall back to live credentials when emulator is missing', () => {
    (process.env as any).NODE_ENV = 'test';
    process.env.FIREBASE_ADMIN_PROJECT_ID = 'demo-sahithyolsav-2025';
    delete process.env.FIRESTORE_EMULATOR_HOST;
    delete process.env.FIREBASE_AUTH_EMULATOR_HOST;
    process.env.NEXT_PUBLIC_USE_FIREBASE_EMULATOR = 'false';
    delete process.env.ALLOW_PROD_TEST_READONLY;

    // Simulate an attempt to use ADC or service account
    process.env.GOOGLE_APPLICATION_CREDENTIALS = 'C:/fake/creds.json';

    expect(() => {
      getAdminApp();
    }).toThrow(/\[FAIL-CLOSED SAFETY\] Test execution cannot fall back to live production credentials when emulator is not active/i);
  });

  it('3. Ensures emulator is prioritized first and never uses live credentials when emulator is enabled', () => {
    (process.env as any).NODE_ENV = 'test';
    process.env.FIREBASE_ADMIN_PROJECT_ID = 'demo-sahithyolsav-2025';
    process.env.FIRESTORE_EMULATOR_HOST = '127.0.0.1:8080';
    process.env.FIREBASE_AUTH_EMULATOR_HOST = '127.0.0.1:9099';
    process.env.NEXT_PUBLIC_USE_FIREBASE_EMULATOR = 'true';

    // Even if live credentials exist in env, emulator config intercepts and isolates to demo project
    process.env.GOOGLE_APPLICATION_CREDENTIALS = 'C:/fake/creds.json';

    const app = getAdminApp();
    expect(app).toBeDefined();
    expect(app?.options.projectId).toBe('demo-sahithyolsav-2025');
  });

  it('4. Confirms setupEnv defaults all test execution to demo project and clears live credentials', () => {
    expect(process.env.FIREBASE_ADMIN_PROJECT_ID).toBe('demo-sahithyolsav-2025');
    expect(process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID).toBe('demo-sahithyolsav-2025');
    expect(process.env.NEXT_PUBLIC_USE_FIREBASE_EMULATOR).toBe('true');
    expect(process.env.GOOGLE_APPLICATION_CREDENTIALS).toBeUndefined();
    expect(process.env.FIREBASE_ADMIN_SERVICE_ACCOUNT_JSON).toBeUndefined();
    expect(process.env.FIREBASE_ADMIN_CLIENT_EMAIL).toBeUndefined();
    expect(process.env.FIREBASE_ADMIN_PRIVATE_KEY).toBeUndefined();
  });
});
