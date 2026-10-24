/**
 * Category Management End-to-End API and Realtime Sync Test Suite
 *
 * Verifies:
 * 1. POST /api/admin/categories - Secure creation, validation, duplicate prevention, and authorization
 * 2. PATCH / PUT /api/admin/categories/[id] - Secure update, validation, code conflict checking, and authorization
 * 3. GET /api/admin/categories and [id] - Listing and single category retrieval
 * 4. DELETE /api/admin/categories/[id] - Dependency checking and cascading protection
 * 5. Firestore Security Rules - Permits Admin with authoritative record even if `disabled` field is omitted (reproducing production scenario)
 * 6. Realtime Cross-Device Synchronization - Firestore onSnapshot subscriber receives updates immediately
 */

import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { NextRequest } from 'next/server';
import { initializeApp, deleteApp, FirebaseApp } from 'firebase/app';
import {
  getAuth as getClientAuth,
  connectAuthEmulator,
  signInWithEmailAndPassword,
  signOut,
  Auth as ClientAuth
} from 'firebase/auth';
import {
  getFirestore as getClientFirestore,
  connectFirestoreEmulator,
  collection,
  onSnapshot,
  doc,
  setDoc,
  getDoc,
  deleteDoc,
  Firestore as ClientFirestore
} from 'firebase/firestore';
import { getAdminDb, getAdminAuth } from '@/lib/firebase/admin';
import { POST as createCategoryHandler, GET as listCategoriesHandler } from '@/app/api/admin/categories/route';
import {
  GET as getCategoryHandler,
  PATCH as patchCategoryHandler,
  PUT as putCategoryHandler,
  DELETE as deleteCategoryHandler
} from '@/app/api/admin/categories/[id]/route';

describe('Admin Category API, Security Rules, & Realtime Synchronization', () => {
  let clientApp: FirebaseApp;
  let clientAuth: ClientAuth;
  let clientDb: ClientFirestore;
  let adminIdToken: string;
  let teamManagerToken: string;
  const db = getAdminDb()!;

  beforeAll(async () => {
    // 1. Initialize client app connected to Auth and Firestore Emulators
    const appName = `cat-test-app-${Date.now()}`;
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

    // 2. Obtain real Admin ID token
    const adminCred = await signInWithEmailAndPassword(
      clientAuth,
      'admin@sahithyolsav.com',
      'AdminPassword123!'
    );
    adminIdToken = await adminCred.user.getIdToken();
    await signOut(clientAuth);

    // 3. Obtain real Team Manager ID token (non-admin)
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

  describe('1. Category Creation (POST /api/admin/categories)', () => {
    it('rejects category creation without authorization header (401)', async () => {
      const req = new NextRequest('http://localhost/api/admin/categories', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: 'Test Cat', code: 'TC-1' })
      });

      const res = await createCategoryHandler(req);
      expect(res.status).toBe(401);
      const data = await res.json();
      expect(data.error).toContain('Unauthorized');
    });

    it('rejects category creation with non-admin token (403)', async () => {
      const req = new NextRequest('http://localhost/api/admin/categories', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${teamManagerToken}`
        },
        body: JSON.stringify({ name: 'Test Cat', code: 'TC-2' })
      });

      const res = await createCategoryHandler(req);
      expect(res.status).toBe(403);
      const data = await res.json();
      expect(data.error).toMatch(/ADMIN|Administrator/i);
    });

    it('rejects category creation with missing name or code (400)', async () => {
      const req1 = new NextRequest('http://localhost/api/admin/categories', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${adminIdToken}`
        },
        body: JSON.stringify({ name: '', code: 'TC-3' })
      });

      const res1 = await createCategoryHandler(req1);
      expect(res1.status).toBe(400);
      const data1 = await res1.json();
      expect(data1.error).toContain('title is required');

      const req2 = new NextRequest('http://localhost/api/admin/categories', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${adminIdToken}`
        },
        body: JSON.stringify({ name: 'Valid Name', code: '' })
      });

      const res2 = await createCategoryHandler(req2);
      expect(res2.status).toBe(400);
      const data2 = await res2.json();
      expect(data2.error).toContain('code is required');
    });

    it('successfully creates category with Admin token and returns 201', async () => {
      const uniqueCode = `CAT-TEST-${Date.now()}`;
      const req = new NextRequest('http://localhost/api/admin/categories', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${adminIdToken}`
        },
        body: JSON.stringify({
          name: 'Kiddies Division',
          code: uniqueCode,
          ageRange: '4 - 6 Years',
          classRange: 'KG to Std 1',
          eligibility: 'Pre-primary students',
          status: 'ACTIVE'
        })
      });

      const res = await createCategoryHandler(req);
      expect(res.status).toBe(201);
      const data = await res.json();
      expect(data.success).toBe(true);
      expect(data.category).toBeDefined();
      expect(data.category.name).toBe('Kiddies Division');
      expect(data.category.code).toBe(uniqueCode);
      expect(data.category.status).toBe('ACTIVE');
      expect(data.category.id).toMatch(/^cat-/);

      // Verify persisted in Firestore
      const docSnap = await db.collection('categories').doc(data.category.id).get();
      expect(docSnap.exists).toBe(true);
      expect(docSnap.data()?.name).toBe('Kiddies Division');

      // Cleanup
      await db.collection('categories').doc(data.category.id).delete();
    });

    it('rejects duplicate category code (400)', async () => {
      const code = `DUP-${Date.now()}`;
      const catRef = db.collection('categories').doc(`cat-dup-${Date.now()}`);
      await catRef.set({
        id: catRef.id,
        name: 'Existing Tier',
        code,
        status: 'ACTIVE'
      });

      try {
        const req = new NextRequest('http://localhost/api/admin/categories', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${adminIdToken}`
          },
          body: JSON.stringify({
            name: 'Another Tier',
            code,
            status: 'ACTIVE'
          })
        });

        const res = await createCategoryHandler(req);
        expect(res.status).toBe(400);
        const data = await res.json();
        expect(data.error).toContain('already exists');
      } finally {
        await catRef.delete();
      }
    });
  });

  describe('2. Category Updating (PATCH / PUT /api/admin/categories/[id])', () => {
    let testCatId: string;

    beforeAll(async () => {
      testCatId = `cat-update-test-${Date.now()}`;
      await db.collection('categories').doc(testCatId).set({
        id: testCatId,
        name: 'Initial Name',
        code: `INIT-${Date.now()}`,
        ageRange: '10 - 12 Years',
        classRange: 'Std 5 - 7',
        eligibility: 'General students',
        status: 'ACTIVE',
        enrolledCount: 0,
        competitionsCount: 0,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      });
    });

    afterAll(async () => {
      await db.collection('categories').doc(testCatId).delete().catch(() => {});
    });

    it('rejects update without authorization header (401)', async () => {
      const req = new NextRequest(`http://localhost/api/admin/categories/${testCatId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: 'Hacked' })
      });

      const res = await patchCategoryHandler(req, { params: Promise.resolve({ id: testCatId }) });
      expect(res.status).toBe(401);
    });

    it('rejects update with non-admin manager token (403)', async () => {
      const req = new NextRequest(`http://localhost/api/admin/categories/${testCatId}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${teamManagerToken}`
        },
        body: JSON.stringify({ name: 'Hacked' })
      });

      const res = await patchCategoryHandler(req, { params: Promise.resolve({ id: testCatId }) });
      expect(res.status).toBe(403);
    });

    it('returns 404 when updating non-existent category', async () => {
      const req = new NextRequest('http://localhost/api/admin/categories/non-existent-cat', {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${adminIdToken}`
        },
        body: JSON.stringify({ name: 'New Name' })
      });

      const res = await patchCategoryHandler(req, { params: Promise.resolve({ id: 'non-existent-cat' }) });
      expect(res.status).toBe(404);
    });

    it('successfully updates category with Admin token via PATCH and PUT (200)', async () => {
      const newName = `Updated Division ${Date.now()}`;
      const reqPatch = new NextRequest(`http://localhost/api/admin/categories/${testCatId}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${adminIdToken}`
        },
        body: JSON.stringify({
          name: newName,
          status: 'INACTIVE',
          ageRange: '11 - 13 Years'
        })
      });

      const resPatch = await patchCategoryHandler(reqPatch, { params: Promise.resolve({ id: testCatId }) });
      expect(resPatch.status).toBe(200);
      const dataPatch = await resPatch.json();
      expect(dataPatch.success).toBe(true);
      expect(dataPatch.category.name).toBe(newName);
      expect(dataPatch.category.status).toBe('INACTIVE');
      expect(dataPatch.category.ageRange).toBe('11 - 13 Years');

      // Verify Firestore state
      const snap = await db.collection('categories').doc(testCatId).get();
      expect(snap.data()?.name).toBe(newName);
      expect(snap.data()?.status).toBe('INACTIVE');

      // Also test PUT
      const reqPut = new NextRequest(`http://localhost/api/admin/categories/${testCatId}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${adminIdToken}`
        },
        body: JSON.stringify({
          status: 'ACTIVE'
        })
      });
      const resPut = await putCategoryHandler(reqPut, { params: Promise.resolve({ id: testCatId }) });
      expect(resPut.status).toBe(200);
      const dataPut = await resPut.json();
      expect(dataPut.category.status).toBe('ACTIVE');
    });

    it('rejects conflicting code update when code belongs to another category (400)', async () => {
      const otherCatId = `other-cat-${Date.now()}`;
      const otherCode = `OTHER-${Date.now()}`;
      await db.collection('categories').doc(otherCatId).set({
        id: otherCatId,
        name: 'Other Cat',
        code: otherCode,
        status: 'ACTIVE'
      });

      try {
        const req = new NextRequest(`http://localhost/api/admin/categories/${testCatId}`, {
          method: 'PATCH',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${adminIdToken}`
          },
          body: JSON.stringify({ code: otherCode })
        });

        const res = await patchCategoryHandler(req, { params: Promise.resolve({ id: testCatId }) });
        expect(res.status).toBe(400);
        const data = await res.json();
        expect(data.error).toContain('already taken');
      } finally {
        await db.collection('categories').doc(otherCatId).delete();
      }
    });
  });

  describe('3. Category Listing & Retrieval (GET /api/admin/categories)', () => {
    it('rejects unauthenticated listing (401)', async () => {
      const req = new NextRequest('http://localhost/api/admin/categories', { method: 'GET' });
      const res = await listCategoriesHandler(req);
      expect(res.status).toBe(401);
    });

    it('returns categories list to authenticated admin (200)', async () => {
      const req = new NextRequest('http://localhost/api/admin/categories', {
        method: 'GET',
        headers: { Authorization: `Bearer ${adminIdToken}` }
      });
      const res = await listCategoriesHandler(req);
      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.success).toBe(true);
      expect(Array.isArray(data.categories)).toBe(true);
    });

    it('returns individual category by ID (200)', async () => {
      const req = new NextRequest('http://localhost/api/admin/categories/cat-1', {
        method: 'GET',
        headers: { Authorization: `Bearer ${adminIdToken}` }
      });
      const res = await getCategoryHandler(req, { params: Promise.resolve({ id: 'cat-1' }) });
      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.success).toBe(true);
      expect(data.category.id).toBe('cat-1');
    });
  });

  describe('4. Category Deletion & Dependency Protection', () => {
    it('prevents deletion of category when dependent competitions exist (400)', async () => {
      const depCatId = `cat-dep-comp-${Date.now()}`;
      const compId = `comp-dep-${Date.now()}`;

      await db.collection('categories').doc(depCatId).set({
        id: depCatId,
        name: 'Dependent Comp Cat',
        code: `DCC-${Date.now()}`,
        status: 'ACTIVE'
      });
      await db.collection('competitions').doc(compId).set({
        id: compId,
        name: 'Dependent Comp',
        categoryId: depCatId,
        code: `CMP-DEP-${Date.now()}`,
        status: 'PUBLISHED'
      });

      try {
        const req = new NextRequest(`http://localhost/api/admin/categories/${depCatId}`, {
          method: 'DELETE',
          headers: { Authorization: `Bearer ${adminIdToken}` }
        });
        const res = await deleteCategoryHandler(req, { params: Promise.resolve({ id: depCatId }) });
        expect(res.status).toBe(400);
        const data = await res.json();
        expect(data.error).toContain('active competition(s) are assigned');

        // Confirm not deleted
        const check = await db.collection('categories').doc(depCatId).get();
        expect(check.exists).toBe(true);
      } finally {
        await db.collection('competitions').doc(compId).delete();
        await db.collection('categories').doc(depCatId).delete();
      }
    });

    it('successfully deletes category with zero dependencies (200)', async () => {
      const emptyCatId = `cat-empty-${Date.now()}`;
      await db.collection('categories').doc(emptyCatId).set({
        id: emptyCatId,
        name: 'Empty Category',
        code: `EMP-${Date.now()}`,
        status: 'ACTIVE'
      });

      const req = new NextRequest(`http://localhost/api/admin/categories/${emptyCatId}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${adminIdToken}` }
      });
      const res = await deleteCategoryHandler(req, { params: Promise.resolve({ id: emptyCatId }) });
      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.success).toBe(true);
      expect(data.deletedCategoryId).toBe(emptyCatId);

      // Verify permanently deleted from Firestore
      const check = await db.collection('categories').doc(emptyCatId).get();
      expect(check.exists).toBe(false);
    });
  });

  describe('5. Firestore Security Rules with Omitted `disabled` Field', () => {
    it('allows Admin to write when authoritative users/{uid} record has NO `disabled` field', async () => {
      const adminAuth = getAdminAuth()!;
      const specialAdminUid = `admin-no-disabled-${Date.now()}`;
      const specialAdminEmail = `special.admin.${Date.now()}@example.com`;

      // 1. Create auth user with role: 'ADMIN' claim
      await adminAuth.createUser({
        uid: specialAdminUid,
        email: specialAdminEmail,
        password: 'AdminPassword123!'
      });
      await adminAuth.setCustomUserClaims(specialAdminUid, { role: 'ADMIN' });

      // 2. Create authoritative Firestore document WITHOUT the `disabled` field (matching production state)
      await db.collection('users').doc(specialAdminUid).set({
        id: specialAdminUid,
        email: specialAdminEmail,
        displayName: 'Special Administrator',
        role: 'ADMIN',
        status: 'ACTIVE',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
        // NOTE: disabled is intentionally NOT included!
      });

      try {
        // 3. Sign in via client SDK
        await signInWithEmailAndPassword(
          clientAuth,
          specialAdminEmail,
          'AdminPassword123!'
        );

        // 4. Client SDK direct write to categories collection
        const testDirectCatId = `cat-direct-rule-${Date.now()}`;
        const catRef = doc(clientDb, 'categories', testDirectCatId);

        // This would fail with evaluation error on line 23 if disabled check were not guarded!
        await expect(
          setDoc(catRef, {
            id: testDirectCatId,
            name: 'Direct Write Category',
            code: `DIR-${Date.now()}`,
            status: 'ACTIVE'
          })
        ).resolves.not.toThrow();

        // Cleanup created doc
        await deleteDoc(catRef);
      } finally {
        await signOut(clientAuth).catch(() => {});
        await adminAuth.deleteUser(specialAdminUid).catch(() => {});
        await db.collection('users').doc(specialAdminUid).delete().catch(() => {});
      }
    });
  });

  describe('6. Realtime Cross-Device Synchronization', () => {
    it('broadcasts category creation and updates in real time to onSnapshot subscribers', async () => {
      const realtimeCatId = `cat-rt-${Date.now()}`;
      const code = `RT-${Date.now()}`;

      let snapshotReceived: any = null;
      let snapshotCount = 0;

      // Subscribe to categories collection via client Firestore (simulating another tab/device)
      const catColRef = collection(clientDb, 'categories');
      const unsubscribe = onSnapshot(catColRef, (snap) => {
        const found = snap.docs.find(d => d.id === realtimeCatId);
        if (found) {
          snapshotReceived = found.data();
          snapshotCount++;
        }
      });

      try {
        // 1. Admin creates category via Admin API route
        const reqCreate = new NextRequest('http://localhost/api/admin/categories', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${adminIdToken}`
          },
          body: JSON.stringify({
            id: realtimeCatId,
            name: 'Realtime Category',
            code,
            ageRange: '10 - 15 Years',
            status: 'ACTIVE'
          })
        });

        const resCreate = await createCategoryHandler(reqCreate);
        expect(resCreate.status).toBe(201);

        // Wait for real-time propagation to client listener
        await new Promise(resolve => setTimeout(resolve, 800));

        expect(snapshotReceived).toBeDefined();
        expect(snapshotReceived?.name).toBe('Realtime Category');
        expect(snapshotReceived?.code).toBe(code);

        // 2. Admin updates category via Admin API route
        const reqUpdate = new NextRequest(`http://localhost/api/admin/categories/${realtimeCatId}`, {
          method: 'PATCH',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${adminIdToken}`
          },
          body: JSON.stringify({
            name: 'Realtime Category Updated',
            status: 'INACTIVE'
          })
        });

        const resUpdate = await patchCategoryHandler(reqUpdate, { params: Promise.resolve({ id: realtimeCatId }) });
        expect(resUpdate.status).toBe(200);

        // Wait for real-time propagation of update
        await new Promise(resolve => setTimeout(resolve, 800));

        expect(snapshotReceived?.name).toBe('Realtime Category Updated');
        expect(snapshotReceived?.status).toBe('INACTIVE');
        expect(snapshotCount).toBeGreaterThanOrEqual(2);
      } finally {
        unsubscribe();
        await db.collection('categories').doc(realtimeCatId).delete().catch(() => {});
      }
    });
  });
});
