/**
 * Phase 3 Step 2A: Secure Firebase Admin SDK Connection Verification
 * 
 * Verifies:
 * 1. Secure credential storage outside workspace and cloud-synced folders.
 * 2. Admin SDK connects to inspirath-d6778 via GOOGLE_APPLICATION_CREDENTIALS / applicationDefault().
 * 3. Minimal read-only verification against Authentication and Firestore.
 * 4. Invalid or missing credentials fail securely.
 * 5. Privileged server endpoints enforce user authorization.
 * 
 * STRICT: Zero writes, zero users created, zero custom claims set, zero documents written.
 */

import { describe, it, expect, afterAll } from 'vitest';
import fs from 'fs';
import path from 'path';
import { initializeApp, deleteApp, applicationDefault, App } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';
import { getFirestore } from 'firebase-admin/firestore';
import { ThemeService } from '@/services/themeService';
import { PointsLedgerService } from '@/services/pointsLedgerService';
import { JudgeService } from '@/services/judgeService';
import { getAdminApp } from '@/lib/firebase/admin';

const SECURE_CREDS_PATH = 'C:/Users/Admin/.credentials/inspirath-d6778-firebase-adminsdk.json';

describe('Phase 3 Step 2A: Secure Firebase Admin SDK Connection', () => {
  it('1. Confirms service account credential file is stored outside workspace and cloud folders', () => {
    expect(fs.existsSync(SECURE_CREDS_PATH)).toBe(true);

    const credsAbsPath = path.resolve(SECURE_CREDS_PATH);
    const workspaceAbsPath = path.resolve(process.cwd());

    // Must be completely outside the project workspace
    expect(credsAbsPath.startsWith(workspaceAbsPath)).toBe(false);

    // Must not be inside OneDrive cloud-synced directory
    expect(credsAbsPath.toLowerCase().includes('onedrive')).toBe(false);

    // Validate metadata without exposing secrets
    const raw = fs.readFileSync(SECURE_CREDS_PATH, 'utf8');
    const parsed = JSON.parse(raw);
    expect(parsed.type).toBe('service_account');
    expect(parsed.project_id).toBe('inspirath-d6778');
    expect(parsed.client_email).toContain('inspirath-d6778.iam.gserviceaccount.com');
    expect(parsed.private_key).toBeDefined();
  });

  it('2. Initializes Firebase Admin SDK with project inspirath-d6778 via applicationDefault()', async () => {
    process.env.GOOGLE_APPLICATION_CREDENTIALS = SECURE_CREDS_PATH;
    const testAppName = `test-admin-step2a-${Date.now()}`;

    let app: App | null = null;
    try {
      app = initializeApp(
        {
          credential: applicationDefault(),
          projectId: 'inspirath-d6778'
        },
        testAppName
      );

      expect(app).toBeDefined();
      expect(app.name).toBe(testAppName);
      expect(app.options.projectId).toBe('inspirath-d6778');
    } finally {
      if (app) {
        await deleteApp(app).catch(() => {});
      }
    }
  });

  it('3. Performs minimal read-only check against Firebase Authentication', async () => {
    process.env.GOOGLE_APPLICATION_CREDENTIALS = SECURE_CREDS_PATH;
    const testAppName = `test-auth-step2a-${Date.now()}`;
    const app = initializeApp(
      {
        credential: applicationDefault(),
        projectId: 'inspirath-d6778'
      },
      testAppName
    );

    try {
      const auth = getAuth(app);
      // Read-only query: list up to 1 user without modifying state
      const userList = await auth.listUsers(1);
      expect(userList).toBeDefined();
      expect(Array.isArray(userList.users)).toBe(true);
    } finally {
      await deleteApp(app).catch(() => {});
    }
  });

  it('4. Performs minimal read-only check against Cloud Firestore', async () => {
    process.env.GOOGLE_APPLICATION_CREDENTIALS = SECURE_CREDS_PATH;
    const testAppName = `test-firestore-step2a-${Date.now()}`;
    const app = initializeApp(
      {
        credential: applicationDefault(),
        projectId: 'inspirath-d6778'
      },
      testAppName
    );

    try {
      const db = getFirestore(app);
      // Read-only query: list root collections without writing any document
      const collections = await db.listCollections();
      expect(collections).toBeDefined();
      expect(Array.isArray(collections)).toBe(true);
    } finally {
      await deleteApp(app).catch(() => {});
    }
  });

  it('5. Confirms invalid credential path fails securely with credential error', async () => {
    const invalidPath = 'C:/non-existent-directory/non-existent-key.json';
    process.env.GOOGLE_APPLICATION_CREDENTIALS = invalidPath;
    const originalAuthEmu = process.env.FIREBASE_AUTH_EMULATOR_HOST;
    delete process.env.FIREBASE_AUTH_EMULATOR_HOST;

    const testAppName = `test-invalid-creds-${Date.now()}`;

    let app: App | null = null;
    try {
      app = initializeApp(
        {
          credential: applicationDefault(),
          projectId: 'inspirath-d6778'
        },
        testAppName
      );

      const auth = getAuth(app);
      await expect(auth.listUsers(1)).rejects.toThrow();
    } finally {
      if (app) {
        await deleteApp(app).catch(() => {});
      }
      delete process.env.GOOGLE_APPLICATION_CREDENTIALS;
      if (originalAuthEmu) process.env.FIREBASE_AUTH_EMULATOR_HOST = originalAuthEmu;
    }
  });

  it('6. Confirms getAdminApp() returns null when credentials and emulator are missing', () => {
    const originalCreds = process.env.GOOGLE_APPLICATION_CREDENTIALS;
    const originalKey = process.env.FIREBASE_ADMIN_PRIVATE_KEY;
    const originalEmu = process.env.NEXT_PUBLIC_USE_FIREBASE_EMULATOR;
    const originalHost = process.env.FIRESTORE_EMULATOR_HOST;
    const originalAuthHost = process.env.FIREBASE_AUTH_EMULATOR_HOST;

    delete process.env.GOOGLE_APPLICATION_CREDENTIALS;
    delete process.env.FIREBASE_ADMIN_PRIVATE_KEY;
    delete process.env.FIRESTORE_EMULATOR_HOST;
    delete process.env.FIREBASE_AUTH_EMULATOR_HOST;
    process.env.NEXT_PUBLIC_USE_FIREBASE_EMULATOR = 'false';

    try {
      const app = getAdminApp();
      expect(app).toBeNull();
    } finally {
      if (originalCreds) process.env.GOOGLE_APPLICATION_CREDENTIALS = originalCreds;
      if (originalKey) process.env.FIREBASE_ADMIN_PRIVATE_KEY = originalKey;
      if (originalEmu) process.env.NEXT_PUBLIC_USE_FIREBASE_EMULATOR = originalEmu;
      if (originalHost) process.env.FIRESTORE_EMULATOR_HOST = originalHost;
      if (originalAuthHost) process.env.FIREBASE_AUTH_EMULATOR_HOST = originalAuthHost;
    }
  });

  it('7. Confirms privileged server endpoints enforce user authorization before performing operations', async () => {
    // 1. ThemeService requires adminUserId
    await expect(
      ThemeService.updateTheme({ festivalName: 'Unauthorized Name' }, '')
    ).rejects.toThrow(/Unauthorized/i);

    // 2. PointsLedgerService publishResultPoints requires adminIdToken
    await expect(
      PointsLedgerService.publishResultPoints({
        resultId: 'res-test',
        competition: { id: 'c1', code: 'C1', name: 'Test', type: 'SOLO' },
        ranks: [],
        adminIdToken: ''
      })
    ).rejects.toThrow(/Unauthorized/i);

    // 3. PointsLedgerService reverseResultPoints requires adminIdToken
    await expect(
      PointsLedgerService.reverseResultPoints('res-test', 'Audit reversal', '')
    ).rejects.toThrow(/Unauthorized/i);

    // 4. JudgeService fails closed if database is unavailable
    const fakeAuth = await JudgeService.authenticateJudge('invalid-code', 'invalid-secret');
    expect(fakeAuth.valid).toBe(false);
  });

  afterAll(() => {
    delete process.env.GOOGLE_APPLICATION_CREDENTIALS;
    delete process.env.FIREBASE_ADMIN_SERVICE_ACCOUNT_JSON;
    delete process.env.FIREBASE_ADMIN_CLIENT_EMAIL;
    delete process.env.FIREBASE_ADMIN_PRIVATE_KEY;
  });
});
