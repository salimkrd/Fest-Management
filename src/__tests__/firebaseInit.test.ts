/**
 * Phase 3 Step 1: Firebase Web SDK Initialization & Profile Isolation Verification
 * 
 * Verifies:
 * 1. Live profile (.env.local.live) contains all 6 required Web SDK variables for inspirath-d6778.
 * 2. Exact production Storage Bucket suffix ("inspirath-d6778.firebasestorage.app") is configured.
 * 3. Real Firebase Web SDK initializes successfully in-memory with Auth, Firestore, and Storage.
 * 4. Emulator profile (.env.local.emulator) preserves demo-sahithyolsav-2025 with emulator ports.
 * 5. Emulator isolation: Emulators are bypassed in live profile, and Admin SDK rejects uncredentialed live requests.
 * 
 * Zero network writes, zero data modifications, and zero live user mutations.
 */

import { describe, it, expect, afterAll } from 'vitest';
import fs from 'fs';
import path from 'path';
import { initializeApp, deleteApp, FirebaseApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';
import { getStorage } from 'firebase/storage';
import { getAdminApp } from '@/lib/firebase/admin';

function parseEnv(filePath: string): Record<string, string> {
  const result: Record<string, string> = {};
  if (fs.existsSync(filePath)) {
    const raw = fs.readFileSync(filePath, 'utf8');
    raw.split(/\r?\n/).forEach(line => {
      const trimmed = line.trim();
      if (trimmed && !trimmed.startsWith('#')) {
        const eq = trimmed.indexOf('=');
        if (eq !== -1) {
          const key = trimmed.slice(0, eq).trim();
          let val = trimmed.slice(eq + 1).trim();
          if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
            val = val.slice(1, -1);
          }
          result[key] = val;
        }
      }
    });
  }
  return result;
}

describe('Phase 3 Step 1: Firebase Web SDK & Environment Profile Verification', () => {
  let liveTestApp: FirebaseApp | null = null;

  afterAll(async () => {
    if (liveTestApp) {
      await deleteApp(liveTestApp).catch(() => {});
    }
  });

  const liveEnvPath = path.resolve(process.cwd(), '.env.local.live');
  const emulatorEnvPath = path.resolve(process.cwd(), '.env.local.emulator');
  const activeEnvPath = path.resolve(process.cwd(), '.env.local');

  it('1. Confirms real Firebase Web SDK configuration in .env.local.live for inspirath-d6778', () => {
    expect(fs.existsSync(liveEnvPath)).toBe(true);
    const liveEnv = parseEnv(liveEnvPath);

    expect(liveEnv.NEXT_PUBLIC_FIREBASE_PROJECT_ID).toBe('inspirath-d6778');
    expect(liveEnv.NEXT_PUBLIC_FIREBASE_API_KEY).toMatch(/^AIza[0-9A-Za-z-_]{35}$/);
    expect(liveEnv.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN).toBe('inspirath-d6778.firebaseapp.com');
    expect(liveEnv.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID).toBe('297712280214');
    expect(liveEnv.NEXT_PUBLIC_FIREBASE_APP_ID).toBe('1:297712280214:web:54180b538bc05f0f4b18b7');
    expect(liveEnv.NEXT_PUBLIC_FIREBASE_MEASUREMENT_ID).toBe('G-0VXGT2ZM6V');
  });

  it('2. Verifies the production Storage bucket is configured with exact .firebasestorage.app suffix', () => {
    const liveEnv = parseEnv(liveEnvPath);
    // Must NOT assume .appspot.com
    expect(liveEnv.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET).toBe('inspirath-d6778.firebasestorage.app');
    expect(liveEnv.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET.endsWith('.firebasestorage.app')).toBe(true);
  });

  it('3. Confirms real Firebase Web SDK initializes correctly in-memory for inspirath-d6778', () => {
    const liveEnv = parseEnv(liveEnvPath);
    const uniqueAppName = `verify-live-sdk-${Date.now()}`;

    liveTestApp = initializeApp(
      {
        apiKey: liveEnv.NEXT_PUBLIC_FIREBASE_API_KEY,
        authDomain: liveEnv.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
        projectId: liveEnv.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
        storageBucket: liveEnv.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
        messagingSenderId: liveEnv.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
        appId: liveEnv.NEXT_PUBLIC_FIREBASE_APP_ID
      },
      uniqueAppName
    );

    expect(liveTestApp).toBeDefined();
    expect(liveTestApp.name).toBe(uniqueAppName);
    expect(liveTestApp.options.projectId).toBe('inspirath-d6778');
    expect(liveTestApp.options.storageBucket).toBe('inspirath-d6778.firebasestorage.app');

    // Verify sub-services attach correctly
    const auth = getAuth(liveTestApp);
    expect(auth).toBeDefined();
    expect(auth.app.name).toBe(uniqueAppName);

    const db = getFirestore(liveTestApp);
    expect(db).toBeDefined();
    expect(db.app.name).toBe(uniqueAppName);

    const storage = getStorage(liveTestApp);
    expect(storage).toBeDefined();
    expect(storage.app.name).toBe(uniqueAppName);
  });

  it('4. Confirms emulator profile in .env.local.emulator preserves demo-sahithyolsav-2025', () => {
    expect(fs.existsSync(emulatorEnvPath)).toBe(true);
    const emuEnv = parseEnv(emulatorEnvPath);

    expect(emuEnv.NEXT_PUBLIC_FIREBASE_PROJECT_ID).toBe('demo-sahithyolsav-2025');
    expect(emuEnv.NEXT_PUBLIC_USE_FIREBASE_EMULATOR).toBe('true');
    expect(emuEnv.NEXT_PUBLIC_FIRESTORE_EMULATOR_HOST).toBe('127.0.0.1:8080');
    expect(emuEnv.NEXT_PUBLIC_FIREBASE_AUTH_EMULATOR_HOST).toBe('127.0.0.1:9099');
    expect(emuEnv.NEXT_PUBLIC_FIREBASE_STORAGE_EMULATOR_HOST).toBe('127.0.0.1:9199');
    expect(emuEnv.FIREBASE_ADMIN_PROJECT_ID).toBe('demo-sahithyolsav-2025');
  });

  it('5. Confirms emulator connections are explicitly disabled in the live profile', () => {
    const liveEnv = parseEnv(liveEnvPath);
    expect(liveEnv.NEXT_PUBLIC_USE_FIREBASE_EMULATOR).toBe('false');
  });

  it('6. Verifies Admin SDK Safeguard: Missing production credentials block unauthenticated cloud writes', () => {
    // When emulator flags are cleared and no service account credentials exist,
    // getAdminApp() must return null and log a warning rather than making unauthenticated calls.
    const originalHost = process.env.FIRESTORE_EMULATOR_HOST;
    const originalEmuFlag = process.env.NEXT_PUBLIC_USE_FIREBASE_EMULATOR;
    delete process.env.FIRESTORE_EMULATOR_HOST;
    delete process.env.FIREBASE_AUTH_EMULATOR_HOST;
    process.env.NEXT_PUBLIC_USE_FIREBASE_EMULATOR = 'false';

    try {
      const app = getAdminApp();
      expect(app).toBeNull();
    } finally {
      if (originalHost) process.env.FIRESTORE_EMULATOR_HOST = originalHost;
      if (originalEmuFlag) process.env.NEXT_PUBLIC_USE_FIREBASE_EMULATOR = originalEmuFlag;
    }
  });

  it('7. Verifies active profile file exists and is valid', () => {
    expect(fs.existsSync(activeEnvPath)).toBe(true);
    const activeEnv = parseEnv(activeEnvPath);
    expect(['inspirath-d6778', 'demo-sahithyolsav-2025']).toContain(activeEnv.NEXT_PUBLIC_FIREBASE_PROJECT_ID);
  });
});
