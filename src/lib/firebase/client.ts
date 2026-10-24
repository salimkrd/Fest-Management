/**
 * Firebase Client SDK Initialization
 * Handles Auth, Firestore, and Storage with graceful unconfigured fallback.
 */

import { initializeApp, getApps, getApp, FirebaseApp } from 'firebase/app';
import { getAuth, connectAuthEmulator, Auth } from 'firebase/auth';
import { getFirestore, connectFirestoreEmulator, Firestore } from 'firebase/firestore';
import { getStorage, connectStorageEmulator, FirebaseStorage } from 'firebase/storage';
import { getFirebaseConfig, isFirebaseConfigured } from './config';

let app: FirebaseApp | null = null;
let auth: Auth | null = null;
let db: Firestore | null = null;
let storage: FirebaseStorage | null = null;

const isProduction = process.env.NODE_ENV === 'production' || process.env.VERCEL === '1';
const isEmulatorEnabled = !isProduction && process.env.NEXT_PUBLIC_USE_FIREBASE_EMULATOR === 'true';
const isTestEnv = process.env.NODE_ENV === 'test' || Boolean(process.env.VITEST);

if (typeof window !== 'undefined' || isFirebaseConfigured()) {
  try {
    const config = getFirebaseConfig();

    // FAIL-CLOSED SAFETY: Client SDK in automated test runners must never connect to live production inspirath-d6778
    if (isTestEnv && config.projectId === 'inspirath-d6778' && !isEmulatorEnabled && !process.env.ALLOW_PROD_TEST_READONLY) {
      throw new Error(
        `[FAIL-CLOSED SAFETY] Automated tests cannot initialize client SDK against production project "inspirath-d6778" without local emulators.`
      );
    }

    if (config.apiKey && config.projectId) {
      app = getApps().length === 0 ? initializeApp(config) : getApp();
      auth = getAuth(app);
      db = getFirestore(app);
      storage = getStorage(app);

      const globalAny = globalThis as unknown as { _firebaseEmulatorsConnected?: boolean };
      if (isEmulatorEnabled && !globalAny._firebaseEmulatorsConnected) {
        try {
          const authHost = process.env.NEXT_PUBLIC_FIREBASE_AUTH_EMULATOR_HOST || '127.0.0.1:9099';
          const [firestoreHost, firestorePort] = (process.env.NEXT_PUBLIC_FIRESTORE_EMULATOR_HOST || '127.0.0.1:8080').split(':');
          const [storageHost, storagePort] = (process.env.NEXT_PUBLIC_FIREBASE_STORAGE_EMULATOR_HOST || '127.0.0.1:9199').split(':');

          if (auth) connectAuthEmulator(auth, `http://${authHost}`, { disableWarnings: true });
          if (db) connectFirestoreEmulator(db, firestoreHost, parseInt(firestorePort, 10));
          if (storage) connectStorageEmulator(storage, storageHost, parseInt(storagePort, 10));

          globalAny._firebaseEmulatorsConnected = true;
          console.log('[Firebase Client] Successfully connected to Local Firebase Emulators');
        } catch (emulatorErr) {
          console.warn('[Firebase Client] Emulator connection warning:', emulatorErr);
        }
      }
    }
  } catch (err) {
    if (isTestEnv) {
      throw err;
    }
    console.warn('[Firebase] Client initialization error:', err);
  }
}

export { app, auth, db, storage };
