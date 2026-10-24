/**
 * Storage Security Rules Unit & Integration Tests
 * Verifies RBAC, Firestore-authoritative ownership, metadata spoofing prevention,
 * and privacy protection on Cloud Storage against Firebase Storage Emulator.
 */

import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { initializeApp, deleteApp, FirebaseApp } from 'firebase/app';
import {
  getAuth,
  connectAuthEmulator,
  signInWithEmailAndPassword,
  signOut,
  Auth
} from 'firebase/auth';
import {
  getFirestore,
  connectFirestoreEmulator,
  doc,
  setDoc,
  deleteDoc,
  Firestore
} from 'firebase/firestore';
import {
  getStorage,
  connectStorageEmulator,
  ref,
  uploadBytes,
  getBytes,
  deleteObject,
  FirebaseStorage
} from 'firebase/storage';
import { getAdminDb } from '@/lib/firebase/admin';

describe('Storage Security Rules - Authoritative Ownership & Privacy Enforcement', () => {
  let clientApp: FirebaseApp;
  let clientAuth: Auth;
  let clientDb: Firestore;
  let clientStorage: FirebaseStorage;

  const testPartTeam1 = `part-sec-storage-tm1-${Date.now()}`;
  const testPartTeam2 = `part-sec-storage-tm2-${Date.now()}`;
  const nonExistentPart = `part-ghost-${Date.now()}`;

  // Small dummy image payload (JPEG magic bytes)
  const dummyImageBytes = new Uint8Array([0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10, 0x4a, 0x46, 0x49, 0x46]);
  const dummyTextBytes = new TextEncoder().encode('Hello world this is not an image');

  beforeAll(async () => {
    // Isolated client app instance for storage tests
    const appName = `storage-sec-test-${Date.now()}`;
    clientApp = initializeApp(
      {
        apiKey: 'demo-api-key',
        projectId: 'demo-sahithyolsav-2025',
        authDomain: 'demo-sahithyolsav-2025.firebaseapp.com',
        storageBucket: 'demo-sahithyolsav-2025.appspot.com'
      },
      appName
    );

    clientAuth = getAuth(clientApp);
    clientDb = getFirestore(clientApp);
    clientStorage = getStorage(clientApp);

    connectAuthEmulator(clientAuth, 'http://127.0.0.1:9099', { disableWarnings: true });
    connectFirestoreEmulator(clientDb, '127.0.0.1', 8080);
    connectStorageEmulator(clientStorage, '127.0.0.1', 9199);

    // Seed authoritative participant records in Firestore via Admin SDK
    const adminDb = getAdminDb()!;
    await adminDb.collection('participants').doc(testPartTeam1).set({
      id: testPartTeam1,
      name: 'Team 1 Authorized Participant',
      teamId: 'team-1',
      teamName: 'Al-Shamama',
      teamCode: 'SHA',
      categoryId: 'cat-3',
      registeredEventIds: []
    });

    await adminDb.collection('participants').doc(testPartTeam2).set({
      id: testPartTeam2,
      name: 'Team 2 Authorized Participant',
      teamId: 'team-2',
      teamName: 'An-Nawa',
      teamCode: 'NAW',
      categoryId: 'cat-3',
      registeredEventIds: []
    });
  }, 120000);

  afterAll(async () => {
    const adminDb = getAdminDb();
    if (adminDb) {
      await adminDb.collection('participants').doc(testPartTeam1).delete().catch(() => {});
      await adminDb.collection('participants').doc(testPartTeam2).delete().catch(() => {});
    }
    if (clientAuth) {
      await signOut(clientAuth).catch(() => {});
    }
    if (clientApp) {
      await deleteApp(clientApp).catch(() => {});
    }
  });

  // =========================================================================
  // 1. PUBLIC / UNAUTHENTICATED PRIVACY PROTECTION
  // =========================================================================
  describe('1. Unauthorized Public Reads & Writes', () => {
    it('1.1 Unauthenticated public user CANNOT upload participant photos', async () => {
      await signOut(clientAuth).catch(() => {});
      const storageRef = ref(clientStorage, `participants/${testPartTeam1}/profile.jpg`);

      await expect(
        uploadBytes(storageRef, dummyImageBytes, { contentType: 'image/jpeg' })
      ).rejects.toThrow();
    });

    it('1.2 Unauthenticated public user CANNOT read participant photos', async () => {
      await signOut(clientAuth).catch(() => {});
      const storageRef = ref(clientStorage, `participants/${testPartTeam1}/profile.jpg`);

      await expect(getBytes(storageRef)).rejects.toThrow();
    });

    it('1.3 Unauthenticated public user CANNOT read nested team participant photos', async () => {
      await signOut(clientAuth).catch(() => {});
      const storageRef = ref(clientStorage, `teams/team-1/participants/${testPartTeam1}/profile.jpg`);

      await expect(getBytes(storageRef)).rejects.toThrow();
    });
  });

  // =========================================================================
  // 2. LEGITIMATE TEAM MANAGER UPLOADS & READS
  // =========================================================================
  describe('2. Legitimate Team Manager Authorized Access', () => {
    it('2.1 Legitimate Team Manager 1 CAN upload photo for Team 1 participant', async () => {
      // manager.shamama belongs to team-1
      await signInWithEmailAndPassword(clientAuth, 'manager.shamama@sahithyolsav.com', 'TeamPassword123!');
      const storageRef = ref(clientStorage, `participants/${testPartTeam1}/profile.jpg`);

      const uploadResult = await uploadBytes(storageRef, dummyImageBytes, {
        contentType: 'image/jpeg'
      });
      expect(uploadResult.ref.fullPath).toBe(`participants/${testPartTeam1}/profile.jpg`);
    });

    it('2.2 Legitimate Team Manager 1 CAN read photo for Team 1 participant', async () => {
      await signInWithEmailAndPassword(clientAuth, 'manager.shamama@sahithyolsav.com', 'TeamPassword123!');
      const storageRef = ref(clientStorage, `participants/${testPartTeam1}/profile.jpg`);

      const bytes = await getBytes(storageRef);
      expect(bytes.byteLength).toBe(dummyImageBytes.byteLength);
    });

    it('2.3 Legitimate Team Manager 1 CAN upload and read to nested team path', async () => {
      await signInWithEmailAndPassword(clientAuth, 'manager.shamama@sahithyolsav.com', 'TeamPassword123!');
      const storageRef = ref(clientStorage, `teams/team-1/participants/${testPartTeam1}/profile.jpg`);

      const uploadResult = await uploadBytes(storageRef, dummyImageBytes, {
        contentType: 'image/jpeg'
      });
      expect(uploadResult.ref.fullPath).toBe(`teams/team-1/participants/${testPartTeam1}/profile.jpg`);

      const downloaded = await getBytes(storageRef);
      expect(downloaded.byteLength).toBe(dummyImageBytes.byteLength);
    });
  });

  // =========================================================================
  // 3. CROSS-TEAM UPLOAD & READ ENFORCEMENT
  // =========================================================================
  describe('3. Cross-Team Violations Rejected', () => {
    it('3.1 Team Manager 2 CANNOT upload photo for Team 1 participant', async () => {
      // manager.nawa belongs to team-2
      await signInWithEmailAndPassword(clientAuth, 'manager.nawa@sahithyolsav.com', 'TeamPassword123!');
      const storageRef = ref(clientStorage, `participants/${testPartTeam1}/hacked.jpg`);

      await expect(
        uploadBytes(storageRef, dummyImageBytes, { contentType: 'image/jpeg' })
      ).rejects.toThrow();
    });

    it('3.2 Team Manager 2 CANNOT read private photo of Team 1 participant', async () => {
      await signInWithEmailAndPassword(clientAuth, 'manager.nawa@sahithyolsav.com', 'TeamPassword123!');
      const storageRef = ref(clientStorage, `participants/${testPartTeam1}/profile.jpg`);

      await expect(getBytes(storageRef)).rejects.toThrow();
    });

    it('3.3 Team Manager 2 CANNOT upload photo for Team 1 participant via nested path', async () => {
      await signInWithEmailAndPassword(clientAuth, 'manager.nawa@sahithyolsav.com', 'TeamPassword123!');
      
      // Attempting to write under team-1 path
      const storageRef1 = ref(clientStorage, `teams/team-1/participants/${testPartTeam1}/hacked.jpg`);
      await expect(
        uploadBytes(storageRef1, dummyImageBytes, { contentType: 'image/jpeg' })
      ).rejects.toThrow();

      // Attempting to write Team 1 participant under team-2 path
      const storageRef2 = ref(clientStorage, `teams/team-2/participants/${testPartTeam1}/hacked.jpg`);
      await expect(
        uploadBytes(storageRef2, dummyImageBytes, { contentType: 'image/jpeg' })
      ).rejects.toThrow();
    });

    it('3.4 Team Manager CANNOT upload photo for non-existent participant in Firestore', async () => {
      await signInWithEmailAndPassword(clientAuth, 'manager.shamama@sahithyolsav.com', 'TeamPassword123!');
      const storageRef = ref(clientStorage, `participants/${nonExistentPart}/profile.jpg`);

      await expect(
        uploadBytes(storageRef, dummyImageBytes, { contentType: 'image/jpeg' })
      ).rejects.toThrow();
    });
  });

  // =========================================================================
  // 4. METADATA SPOOFING REJECTION
  // =========================================================================
  describe('4. Metadata Spoofing Rejection', () => {
    it('4.1 Team Manager 2 spoofing metadata.teamId="team-2" on Team 1 participant is REJECTED', async () => {
      // Attacker claims teamId: 'team-2' in metadata, but Firestore participant belongs to team-1
      await signInWithEmailAndPassword(clientAuth, 'manager.nawa@sahithyolsav.com', 'TeamPassword123!');
      const storageRef = ref(clientStorage, `participants/${testPartTeam1}/spoofed.jpg`);

      await expect(
        uploadBytes(storageRef, dummyImageBytes, {
          contentType: 'image/jpeg',
          customMetadata: { teamId: 'team-2' }
        })
      ).rejects.toThrow();
    });

    it('4.2 Team Manager 2 spoofing metadata.teamId="team-1" on Team 1 participant is REJECTED', async () => {
      // Attacker claims teamId: 'team-1' in metadata, but attacker token is team-2
      await signInWithEmailAndPassword(clientAuth, 'manager.nawa@sahithyolsav.com', 'TeamPassword123!');
      const storageRef = ref(clientStorage, `participants/${testPartTeam1}/spoofed2.jpg`);

      await expect(
        uploadBytes(storageRef, dummyImageBytes, {
          contentType: 'image/jpeg',
          customMetadata: { teamId: 'team-1' }
        })
      ).rejects.toThrow();
    });

    it('4.3 Team Manager 1 attempting to set spoofed metadata.teamId="team-2" is REJECTED', async () => {
      // Manager 1 sets metadata.teamId to team-2
      await signInWithEmailAndPassword(clientAuth, 'manager.shamama@sahithyolsav.com', 'TeamPassword123!');
      const storageRef = ref(clientStorage, `participants/${testPartTeam1}/mismatched-meta.jpg`);

      await expect(
        uploadBytes(storageRef, dummyImageBytes, {
          contentType: 'image/jpeg',
          customMetadata: { teamId: 'team-2' }
        })
      ).rejects.toThrow();
    });
  });

  // =========================================================================
  // 5. FILE TYPE & SIZE VALIDATION
  // =========================================================================
  describe('5. Content Type and Size Validation', () => {
    it('5.1 Non-image file upload is REJECTED', async () => {
      await signInWithEmailAndPassword(clientAuth, 'manager.shamama@sahithyolsav.com', 'TeamPassword123!');
      const storageRef = ref(clientStorage, `participants/${testPartTeam1}/malicious.sh`);

      await expect(
        uploadBytes(storageRef, dummyTextBytes, { contentType: 'text/plain' })
      ).rejects.toThrow();
    });
  });

  // =========================================================================
  // 6. ADMIN AUTHORIZED ACCESS
  // =========================================================================
  describe('6. Admin Full Management Access', () => {
    it('6.1 Admin CAN read participant photo across any team', async () => {
      await signInWithEmailAndPassword(clientAuth, 'admin@sahithyolsav.com', 'AdminPassword123!');
      const storageRef = ref(clientStorage, `participants/${testPartTeam1}/profile.jpg`);

      const bytes = await getBytes(storageRef);
      expect(bytes.byteLength).toBe(dummyImageBytes.byteLength);
    });

    it('6.2 Admin CAN upload participant photo for any participant', async () => {
      await signInWithEmailAndPassword(clientAuth, 'admin@sahithyolsav.com', 'AdminPassword123!');
      const storageRef = ref(clientStorage, `participants/${testPartTeam2}/admin-upload.jpg`);

      const res = await uploadBytes(storageRef, dummyImageBytes, {
        contentType: 'image/jpeg'
      });
      expect(res.ref.fullPath).toBe(`participants/${testPartTeam2}/admin-upload.jpg`);
    });

    it('6.3 Admin CAN delete participant photo', async () => {
      await signInWithEmailAndPassword(clientAuth, 'admin@sahithyolsav.com', 'AdminPassword123!');
      const storageRef = ref(clientStorage, `participants/${testPartTeam2}/admin-upload.jpg`);

      await expect(deleteObject(storageRef)).resolves.not.toThrow();
    });
  });

  // =========================================================================
  // 7. DELETION PERMISSIONS
  // =========================================================================
  describe('7. Authorized vs Cross-Team Deletions', () => {
    it('7.1 Team Manager 2 CANNOT delete photo belonging to Team 1 participant', async () => {
      await signInWithEmailAndPassword(clientAuth, 'manager.nawa@sahithyolsav.com', 'TeamPassword123!');
      const storageRef = ref(clientStorage, `participants/${testPartTeam1}/profile.jpg`);

      await expect(deleteObject(storageRef)).rejects.toThrow();
    });

    it('7.2 Team Manager 1 CAN delete photo belonging to Team 1 participant', async () => {
      await signInWithEmailAndPassword(clientAuth, 'manager.shamama@sahithyolsav.com', 'TeamPassword123!');
      const storageRef = ref(clientStorage, `participants/${testPartTeam1}/profile.jpg`);

      await expect(deleteObject(storageRef)).resolves.not.toThrow();
    });
  });
});
