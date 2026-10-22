/**
 * Firebase Admin SDK Initialization (Trusted Server Operations)
 * Used exclusively inside Server Actions, Route Handlers, and Cloud Functions.
 * 
 * Never exposed to the browser.
 * Relies on FIREBASE_ADMIN_PROJECT_ID, FIREBASE_ADMIN_CLIENT_EMAIL, FIREBASE_ADMIN_PRIVATE_KEY
 * or GOOGLE_APPLICATION_CREDENTIALS.
 */

import { initializeApp, getApps, cert, applicationDefault, App } from 'firebase-admin/app';
import { getFirestore, Firestore } from 'firebase-admin/firestore';
import { getAuth, Auth } from 'firebase-admin/auth';
import { getStorage, Storage } from 'firebase-admin/storage';

let adminApp: App | null = null;

export function getAdminApp(): App | null {
  const apps = getApps();
  const defaultApp = apps.find(a => a.name === '[DEFAULT]') || null;
  if (defaultApp) {
    return defaultApp;
  }

  const isTestEnvironment = process.env.NODE_ENV === 'test' || Boolean(process.env.VITEST);
  const projectId = process.env.FIREBASE_ADMIN_PROJECT_ID || process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID;

  // STRICT RECURRENCE PREVENTION & FAIL-CLOSED SAFETY GUARD:
  // Automated test execution must NEVER connect to the production project (inspirath-d6778).
  // All automated test runs must target the local Firebase Emulator or a designated non-production project.
  if (isTestEnvironment && projectId === 'inspirath-d6778' && !process.env.ALLOW_PROD_TEST_READONLY) {
    throw new Error(
      `[FAIL-CLOSED SAFETY] Automated tests are strictly prohibited from connecting to production project "inspirath-d6778". ` +
      `Tests must use the local Firebase Emulator (demo-sahithyolsav-2025) or an explicitly designated non-production environment.`
    );
  }

  // 1. Emulator vs Live Project Isolation (PRIORITIZED FIRST)
  // When emulator is configured, NEVER fall back to live production credentials.
  const isEmulator = Boolean(
    process.env.FIRESTORE_EMULATOR_HOST ||
    process.env.FIREBASE_AUTH_EMULATOR_HOST ||
    process.env.NEXT_PUBLIC_USE_FIREBASE_EMULATOR === 'true'
  );

  if (isEmulator) {
    try {
      adminApp = initializeApp({
        projectId: (projectId && projectId !== 'inspirath-d6778') ? projectId : 'demo-sahithyolsav-2025'
      });
      return adminApp;
    } catch (err) {
      return null;
    }
  }

  // If in test environment and emulator is NOT active, FAIL CLOSED if credentials exist or return null
  if (isTestEnvironment && !process.env.ALLOW_PROD_TEST_READONLY) {
    if (process.env.GOOGLE_APPLICATION_CREDENTIALS || process.env.FIREBASE_ADMIN_SERVICE_ACCOUNT_JSON || process.env.FIREBASE_ADMIN_CLIENT_EMAIL) {
      throw new Error(
        `[FAIL-CLOSED SAFETY] Test execution cannot fall back to live production credentials when emulator is not active.`
      );
    }
    return null;
  }

  // 2. Check for GOOGLE_APPLICATION_CREDENTIALS (Preferred secure local credential-file mechanism for live production)
  if (process.env.GOOGLE_APPLICATION_CREDENTIALS) {
    try {
      adminApp = initializeApp({
        credential: applicationDefault(),
        projectId: projectId || 'inspirath-d6778',
        storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET
      });
      return adminApp;
    } catch (err) {
      console.error('[Firebase Admin] Error initializing with GOOGLE_APPLICATION_CREDENTIALS:', err);
    }
  }

  // 3. Check for service account JSON string (Optimized for Vercel / Cloud serverless deployment)
  if (process.env.FIREBASE_ADMIN_SERVICE_ACCOUNT_JSON) {
    try {
      const sa = JSON.parse(process.env.FIREBASE_ADMIN_SERVICE_ACCOUNT_JSON);
      adminApp = initializeApp({
        credential: cert(sa),
        projectId: sa.project_id || projectId || 'inspirath-d6778',
        storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET
      });
      return adminApp;
    } catch (err) {
      console.error('[Firebase Admin] Error initializing with FIREBASE_ADMIN_SERVICE_ACCOUNT_JSON:', err);
    }
  }

  // 4. Check for discrete environment variables (Alternative cert credential mechanism)
  const clientEmail = process.env.FIREBASE_ADMIN_CLIENT_EMAIL;
  let privateKey = process.env.FIREBASE_ADMIN_PRIVATE_KEY;

  if (privateKey) {
    privateKey = privateKey.replace(/\\n/g, '\n');
  }

  if (projectId && clientEmail && privateKey) {
    try {
      adminApp = initializeApp({
        credential: cert({
          projectId,
          clientEmail,
          privateKey
        }),
        storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET
      });
      return adminApp;
    } catch (err) {
      console.error('[Firebase Admin] Error initializing with service account cert:', err);
    }
  }

  // In live production mode, strictly require certified service account credentials
  console.warn(
    `[Firebase Admin] Live Firebase credentials not configured for project "${projectId}". Server-side operations require service account credentials.`
  );
  return null;
}

export function getAdminDb(): Firestore | null {
  const app = getAdminApp();
  if (!app) return null;
  const db = getFirestore(app);
  try {
    db.settings({ ignoreUndefinedProperties: true });
  } catch {
    // Ignore error if settings have already been locked/initialized
  }
  return db;
}

export function getAdminAuth(): Auth | null {
  const app = getAdminApp();
  return app ? getAuth(app) : null;
}

export function getAdminStorage(): Storage | null {
  const app = getAdminApp();
  return app ? getStorage(app) : null;
}
