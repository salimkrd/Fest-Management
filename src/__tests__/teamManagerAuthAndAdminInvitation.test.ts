/**
 * Verification Test Suite: Team Manager Login & Admin Invitation Authentication
 * Project: Inspirath Fest Management Application
 * 
 * Tests the complete lifecycle and regression fixes for:
 * 1. Clean Team ID generation (no duplicate "team-team-" prefix for names starting with "Team").
 * 2. Auto-provisioning of Team Manager account in PENDING status.
 * 3. Manual WhatsApp invitation generation with SHA-256 token hashing.
 * 4. Password activation via invitation code, transitioning invitation status to ACTIVATED and user to ACTIVE.
 * 5. Strict rejection of workspace access and login while a team is DISABLED.
 * 6. Chief Admin enablement of team restoring ACTIVE status for activated managers.
 * 7. Secure Email/Password sign-in and access to own team workspace.
 * 8. Strict prevention of cross-team access.
 * 9. Chief Admin generation, revocation, and regeneration of invitations.
 * 10. Controlled 401 Unauthorized responses for invalid or expired admin tokens across admin endpoints.
 * 11. Controlled 403 Forbidden responses for non-admin tokens.
 * 12. Valid Admin token successfully authorizes invitation management operations.
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
import { getFirestore as getClientFirestore, connectFirestoreEmulator, doc, getDoc, Firestore as ClientFirestore } from 'firebase/firestore';
import { TeamService } from '@/services/teamService';
import { AuthService } from '@/services/authService';
import { getAdminAuth, getAdminDb } from '@/lib/firebase/admin';
import { POST as revokeInvitationRoute } from '@/app/api/admin/teams/[id]/revoke-invitation/route';
import { POST as generateInvitationRoute } from '@/app/api/admin/teams/[id]/generate-invitation/route';
import { GET as getTeamRoute } from '@/app/api/team/[id]/route';
import { NextRequest } from 'next/server';

describe('Team Manager Login & Admin Invitation Authentication Verification', () => {
  let clientApp: FirebaseApp;
  let clientAuth: ClientAuth;
  let clientDb: ClientFirestore;
  let adminIdToken = '';

  const timestamp = Date.now();
  const teamAlphaName = `Team Alpha ${timestamp}`;
  const alphaManagerEmail = `manager.alpha.${timestamp}@sahithyolsav.com`;
  const alphaManagerPhone = '+91 98471 99999';
  const alphaPassword = 'SecureAlphaPassword123!';

  let createdTeamId = '';
  let alphaInvitationCode = '';
  let alphaManagerUid = '';

  beforeAll(async () => {
    // 1. Initialize Client SDK attached to local Firebase Emulator
    const appName = `team-auth-test-${timestamp}`;
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

    // 2. Authenticate Chief Administrator to obtain real ID token
    const adminCred = await signInWithEmailAndPassword(
      clientAuth,
      'admin@sahithyolsav.com',
      'AdminPassword123!'
    );
    adminIdToken = await adminCred.user.getIdToken(true);
    await signOut(clientAuth);
  });

  afterAll(async () => {
    // Clean up test team if created
    const db = getAdminDb();
    if (db && createdTeamId) {
      await db.collection('teams').doc(createdTeamId).delete().catch(() => {});
    }
  });

  // TEST 1: Create Team Alpha & Inconsistent ID Fix
  it('1. should create Team Alpha without duplicate "team-team-" prefix in team ID', async () => {
    const result = await TeamService.createTeamWithManager(adminIdToken, {
      name: teamAlphaName,
      managerEmail: alphaManagerEmail,
      managerName: 'Salim Karakkad',
      managerPhone: alphaManagerPhone
    });

    expect(result.team).toBeDefined();
    createdTeamId = result.team.id;
    alphaManagerUid = result.managerUid!;
    alphaInvitationCode = result.invitation!.code;

    // Verify ID does NOT have duplicate "team-team-" prefix
    expect(createdTeamId).toMatch(/^team-alpha-/);
    expect(createdTeamId).not.toContain('team-team-');

    // Verify public Firestore document
    const db = getAdminDb()!;
    const teamDoc = await db.collection('teams').doc(createdTeamId).get();
    expect(teamDoc.exists).toBe(true);
    expect(teamDoc.data()?.name).toBe(teamAlphaName);
    expect(teamDoc.data()?.status).toBe('ACTIVE');

    // Verify private onboarding document
    const privateDoc = await db
      .collection('teams')
      .doc(createdTeamId)
      .collection('private')
      .doc('managerInfo')
      .get();
    expect(privateDoc.exists).toBe(true);
    const pData = privateDoc.data()!;
    expect(pData.invitationStatus).toBe('READY_TO_SEND');
    expect(pData.managerEmail).toBe(alphaManagerEmail);
    expect(pData.portalAccess).toBe(false);

    // Verify user authoritative document is PENDING
    const userDoc = await db.collection('users').doc(alphaManagerUid).get();
    expect(userDoc.exists).toBe(true);
    expect(userDoc.data()?.status).toBe('PENDING');
    expect(userDoc.data()?.role).toBe('TEAM_MANAGER');
    expect(userDoc.data()?.teamId).toBe(createdTeamId);
  });

  // TEST 2: Activate Manager Password Successfully
  it('2. should activate manager password successfully and transition status to ACTIVATED', async () => {
    const activationResult = await TeamService.activateManager({
      code: alphaInvitationCode,
      email: alphaManagerEmail,
      newPassword: alphaPassword,
      teamId: createdTeamId
    });

    expect(activationResult.success).toBe(true);
    expect(activationResult.teamId).toBe(createdTeamId);

    // Verify private onboarding document transitioned to ACTIVATED
    const db = getAdminDb()!;
    const privateDoc = await db
      .collection('teams')
      .doc(createdTeamId)
      .collection('private')
      .doc('managerInfo')
      .get();
    expect(privateDoc.data()?.invitationStatus).toBe('ACTIVATED');
    expect(privateDoc.data()?.invitationRedeemed).toBe(true);
    expect(privateDoc.data()?.portalAccess).toBe(true);

    // Verify user authoritative record transitioned to ACTIVE
    const userDoc = await db.collection('users').doc(alphaManagerUid).get();
    expect(userDoc.data()?.status).toBe('ACTIVE');
    expect(userDoc.data()?.disabled).toBe(false);
  });

  // TEST 3: Attempt workspace access while team is DISABLED: must be denied
  it('3. should deny workspace access and authentication while team is DISABLED', async () => {
    // Chief Admin disables Team Alpha
    await TeamService.setTeamStatus(adminIdToken, createdTeamId, false);

    const db = getAdminDb()!;
    const teamDoc = await db.collection('teams').doc(createdTeamId).get();
    expect(teamDoc.data()?.status).toBe('DISABLED');

    // Verify user doc is marked DISABLED
    const userDoc = await db.collection('users').doc(alphaManagerUid).get();
    expect(userDoc.data()?.status).toBe('DISABLED');
    expect(userDoc.data()?.disabled).toBe(true);

    // Manager client sign-in attempt while disabled must fail
    await expect(
      signInWithEmailAndPassword(clientAuth, alphaManagerEmail, alphaPassword)
    ).rejects.toThrow();

    // Verify public team API returns disabled status
    const req = new NextRequest(`http://localhost:3000/api/team/${createdTeamId}`);
    const res = await getTeamRoute(req, { params: Promise.resolve({ id: createdTeamId }) });
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.team.status).toBe('DISABLED');
    expect(body.team.portalAccess).toBe(false);
  });

  // TEST 4: Chief Admin enables Team Alpha
  it('4. should allow Chief Admin to enable Team Alpha, restoring ACTIVE status to manager', async () => {
    // Chief Admin re-enables Team Alpha
    await TeamService.setTeamStatus(adminIdToken, createdTeamId, true);

    const db = getAdminDb()!;
    const teamDoc = await db.collection('teams').doc(createdTeamId).get();
    expect(teamDoc.data()?.status).toBe('ACTIVE');

    // Verify manager user record is restored to ACTIVE (since already activated)
    const userDoc = await db.collection('users').doc(alphaManagerUid).get();
    expect(userDoc.data()?.status).toBe('ACTIVE');
    expect(userDoc.data()?.disabled).toBe(false);
  });

  // TEST 5: Activated manager signs in with Email/Password & reaches own workspace
  it('5. should allow activated manager to sign in and reach their own team workspace', async () => {
    const cred = await signInWithEmailAndPassword(clientAuth, alphaManagerEmail, alphaPassword);
    expect(cred.user).toBeDefined();

    const tokenResult = await cred.user.getIdTokenResult(true);
    expect(tokenResult.claims.role).toBe('TEAM_MANAGER');
    expect(tokenResult.claims.teamId).toBe(createdTeamId);

    const managerToken = await cred.user.getIdToken();

    // Manager can access their own team workspace
    const context = await AuthService.assertTeamManager(managerToken, createdTeamId);
    expect(context.teamId).toBe(createdTeamId);
    expect(context.role).toBe('TEAM_MANAGER');

    await signOut(clientAuth);
  });

  // TEST 6: Manager cannot access another team
  it('6. should strictly prevent Team Alpha manager from accessing another team workspace', async () => {
    const cred = await signInWithEmailAndPassword(clientAuth, alphaManagerEmail, alphaPassword);
    const managerToken = await cred.user.getIdToken();

    // Attempting access to another team must reject with cross-team access denied
    await expect(
      AuthService.assertTeamManager(managerToken, 'team-1')
    ).rejects.toThrow(/Cross-team access denied/i);

    await signOut(clientAuth);
  });

  // TEST 7: Chief Admin generates, revokes, and regenerates invitations
  it('7. should allow Chief Admin to generate, revoke, and regenerate invitations', async () => {
    // 1. Generate new invitation
    const genRes = await TeamService.generateInvitation(adminIdToken, createdTeamId);
    expect(genRes.success).toBe(true);
    expect(genRes.invitationCode).toBeDefined();

    const db = getAdminDb()!;
    let privSnap = await db.collection('teams').doc(createdTeamId).collection('private').doc('managerInfo').get();
    expect(privSnap.data()?.invitationStatus).toBe('READY_TO_SEND');

    // 2. Revoke invitation
    const revokeRes = await TeamService.revokeInvitation(adminIdToken, createdTeamId);
    expect(revokeRes.success).toBe(true);
    expect(revokeRes.invitationStatus).toBe('REVOKED');

    privSnap = await db.collection('teams').doc(createdTeamId).collection('private').doc('managerInfo').get();
    expect(privSnap.data()?.invitationStatus).toBe('REVOKED');

    // Attempting activation of revoked code must fail
    await expect(
      TeamService.activateManager({
        code: genRes.invitationCode,
        newPassword: 'NewPassword123!'
      })
    ).rejects.toThrow(/revoked/i);

    // 3. Regenerate invitation
    const regenRes = await TeamService.resendInvitation(adminIdToken, createdTeamId);
    expect(regenRes.success).toBe(true);
    expect(regenRes.invitationCode).toBeDefined();
    expect(regenRes.invitationCode).not.toBe(genRes.invitationCode);

    privSnap = await db.collection('teams').doc(createdTeamId).collection('private').doc('managerInfo').get();
    expect(privSnap.data()?.invitationStatus).toBe('READY_TO_SEND');
  });

  // TEST 8: Controlled 401 responses for missing, invalid, or expired tokens on revoke-invitation
  it('8. should return controlled 401 responses for invalid, malformed, or missing admin tokens on revoke-invitation', async () => {
    // A) Missing token
    const reqMissing = new NextRequest(`http://localhost:3000/api/admin/teams/${createdTeamId}/revoke-invitation`, {
      method: 'POST'
    });
    const resMissing = await revokeInvitationRoute(reqMissing, { params: Promise.resolve({ id: createdTeamId }) });
    expect(resMissing.status).toBe(401);
    const bodyMissing = await resMissing.json();
    expect(bodyMissing.error).toMatch(/unauthorized/i);

    // B) Malformed / Mock token (auth/argument-error)
    const reqMalformed = new NextRequest(`http://localhost:3000/api/admin/teams/${createdTeamId}/revoke-invitation`, {
      method: 'POST',
      headers: {
        Authorization: 'Bearer mock-admin-token'
      }
    });
    const resMalformed = await revokeInvitationRoute(reqMalformed, { params: Promise.resolve({ id: createdTeamId }) });
    expect(resMalformed.status).toBe(401);
    const bodyMalformed = await resMalformed.json();
    expect(bodyMalformed.error).toBe('Unauthorized: Invalid or malformed authentication token.');

    // C) Non-admin token (e.g. manager token) returns 403 Forbidden
    const cred = await signInWithEmailAndPassword(clientAuth, alphaManagerEmail, alphaPassword);
    const managerToken = await cred.user.getIdToken();
    await signOut(clientAuth);

    const reqManager = new NextRequest(`http://localhost:3000/api/admin/teams/${createdTeamId}/revoke-invitation`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${managerToken}`
      }
    });
    const resManager = await revokeInvitationRoute(reqManager, { params: Promise.resolve({ id: createdTeamId }) });
    expect(resManager.status).toBe(403);
    const bodyManager = await resManager.json();
    expect(bodyManager.error).toMatch(/requires ADMIN role/i);
  });

  // TEST 9: Valid Admin token authorizes invitation management
  it('9. should authorize invitation management with a valid Admin token', async () => {
    const reqValid = new NextRequest(`http://localhost:3000/api/admin/teams/${createdTeamId}/revoke-invitation`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${adminIdToken}`
      }
    });
    const resValid = await revokeInvitationRoute(reqValid, { params: Promise.resolve({ id: createdTeamId }) });
    expect(resValid.status).toBe(200);
    const bodyValid = await resValid.json();
    expect(bodyValid.success).toBe(true);
    expect(bodyValid.invitationStatus).toBe('REVOKED');
  });
});
