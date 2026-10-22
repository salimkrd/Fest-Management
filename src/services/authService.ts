/**
 * Server-Side Authentication & Authorization Service
 * 
 * Enforces:
 * 1. Cryptographic token verification (Firebase Auth ID Token with revocation check).
 * 2. Multi-layer RBAC (Custom claims + Firestore server record verification).
 * 3. Prevention of privilege escalation (Only verified Admins can provision roles).
 * 4. Prevention of cross-team access (Team Managers restricted strictly to assigned teamId).
 * 5. Scope-restricted judging authorization (Judges restricted to assigned competitionId).
 * 6. Secure initial Admin bootstrap procedure (Single-use bootstrap lock).
 */

import * as fs from 'fs';
import { randomUUID } from 'crypto';
import { getAdminAuth, getAdminDb } from '@/lib/firebase/admin';
import { FirestoreUser, UserRole } from '@/types/firestore';
import { verifyJudgeAssignment } from '@/domain/judgeAuth';

export interface VerifiedUserContext {
  uid: string;
  email: string;
  role: UserRole;
  teamId?: string;
  assignmentId?: string;
}

export class AuthService {
  /**
   * Cryptographically verifies a client Firebase ID Token and checks role in Firestore.
   * Double-checks custom claims against authoritative Firestore users collection.
   */
  static async verifySession(idToken: string): Promise<VerifiedUserContext> {
    if (!idToken || typeof idToken !== 'string') {
      throw new Error('Unauthorized: Missing or invalid authentication token.');
    }

    const auth = getAdminAuth();
    const db = getAdminDb();

    if (!auth) {
      throw new Error('Authentication Service Unavailable: Firebase Admin Auth not initialized.');
    }

    // 1. Verify token signature and check for revocation
    let decoded;
    try {
      decoded = await auth.verifyIdToken(idToken, true);
    } catch (tokenErr: any) {
      throw new Error(`Unauthorized: Invalid or malformed authentication token (${tokenErr.code || tokenErr.message}).`);
    }

    const tokenRole = (decoded.role as UserRole) || 'PUBLIC';
    const tokenTeamId = (decoded.teamId as string) || undefined;
    const tokenAssignmentId = (decoded.assignmentId as string) || undefined;

    // 2. Cross-verify with authoritative Firestore user document if database is available
    if (db) {
      const userDoc = await db.collection('users').doc(decoded.uid).get();
      if (!userDoc.exists) {
        throw new Error(`Unauthorized: User "${decoded.uid}" does not have an authoritative record in Firestore.`);
      }
      const userData = userDoc.data() as FirestoreUser;

      // Disabled user rejection
      if (userData.disabled || userData.status === 'DISABLED') {
        throw new Error(`Unauthorized: User account "${decoded.uid}" has been disabled by fest administration.`);
      }

      // Strict role matching: Ensure token claims match authoritative record
      if (userData.role && tokenRole !== 'PUBLIC' && userData.role !== tokenRole) {
        throw new Error(
          `Security Violation: Token role "${tokenRole}" does not match authoritative record "${userData.role}".`
        );
      }

      // Strict team matching: Ensure token team assignment matches authoritative record
      if (userData.role === 'TEAM_MANAGER') {
        if (!userData.teamId) {
          throw new Error(
            `Security Violation: Team Manager account "${decoded.uid}" is missing mandatory team assignment.`
          );
        }
        if (tokenTeamId && userData.teamId !== tokenTeamId) {
          throw new Error(
            `Security Violation: Token team assignment "${tokenTeamId}" does not match authoritative assignment "${userData.teamId}".`
          );
        }
      }

      return {
        uid: decoded.uid,
        email: decoded.email || userData.email || '',
        role: userData.role || tokenRole,
        teamId: userData.teamId || tokenTeamId,
        assignmentId: userData.assignmentId || tokenAssignmentId
      };
    }

    return {
      uid: decoded.uid,
      email: decoded.email || '',
      role: tokenRole,
      teamId: tokenTeamId,
      assignmentId: tokenAssignmentId
    };
  }

  /**
   * Asserts caller possesses verified ADMIN role. Throws Unauthorized if not.
   */
  static async assertAdmin(idToken: string): Promise<VerifiedUserContext> {
    const user = await this.verifySession(idToken);
    if (user.role !== 'ADMIN') {
      throw new Error(`Unauthorized: Operation requires ADMIN role. Current role: ${user.role}`);
    }
    return user;
  }

  /**
   * Asserts caller is ADMIN or a TEAM_MANAGER assigned to targetTeamId.
   * Prevents cross-team tampering.
   */
  static async assertTeamManager(idToken: string, targetTeamId: string): Promise<VerifiedUserContext> {
    const user = await this.verifySession(idToken);

    if (user.role === 'ADMIN') {
      return user; // Admins have supervisory access to all teams
    }

    if (user.role === 'TEAM_MANAGER') {
      if (!user.teamId || user.teamId !== targetTeamId) {
        throw new Error(
          `Unauthorized: Cross-team access denied. You are assigned to team "${user.teamId || 'NONE'}", but requested access to team "${targetTeamId}".`
        );
      }
      const db = getAdminDb();
      if (db) {
        const teamDoc = await db.collection('teams').doc(targetTeamId).get();
        if (teamDoc.exists && teamDoc.data()?.status === 'DISABLED') {
          throw new Error('Unauthorized: Team contingent is currently disabled by fest administration.');
        }
      }
      return user;
    }

    throw new Error(`Unauthorized: Insufficient permissions for team management. Role: ${user.role}`);
  }

  /**
   * Asserts Judge assignment is valid, active, and assigned to the specified competition.
   * Prevents evaluating unassigned competitions.
   */
  static async assertJudgeAssignment(params: {
    assignmentId: string;
    targetCompetitionId: string;
    secret?: string;
  }): Promise<{ valid: boolean; assignmentId: string; competitionId: string }> {
    const db = getAdminDb();
    if (!db) {
      throw new Error('Database Unavailable: Cannot verify judge assignment.');
    }

    const docSnap = await db.collection('judgeAssignments').doc(params.assignmentId).get();
    if (!docSnap.exists) {
      throw new Error('Unauthorized: Judge assignment not found.');
    }

    const assignment = docSnap.data() as any;

    // Check revocation and expiration
    if (assignment.revoked || assignment.status === 'REVOKED') {
      throw new Error('Unauthorized: This judge assignment has been revoked by fest administration.');
    }

    if (assignment.expiresAt && new Date(assignment.expiresAt) < new Date()) {
      throw new Error('Unauthorized: This judge assignment link has expired.');
    }

    // Strict scope enforcement: Judge cannot access or score competitions outside their assignment
    if (assignment.competitionId !== params.targetCompetitionId) {
      throw new Error(
        `Unauthorized: Scope violation. This jury credential is valid for competition "${assignment.competitionId}", not "${params.targetCompetitionId}".`
      );
    }

    // Verify secret if provided
    if (params.secret) {
      const verifyResult = await verifyJudgeAssignment(assignment, params.secret);
      if (!verifyResult.valid) {
        throw new Error(`Unauthorized: Invalid judge authentication secret. Reason: ${verifyResult.reason}`);
      }
    }

    return {
      valid: true,
      assignmentId: assignment.id,
      competitionId: assignment.competitionId
    };
  }

  /**
   * Issues a Firebase-signed custom token for an authenticated Judge after validating their PIN/secret.
   * Enables the client-side Judge portal to sign in with Firebase Auth and securely interact
   * with Firestore markEntries according to Firestore Security Rules.
   */
  static async createJudgeSessionToken(params: {
    assignmentId: string;
    secret: string;
    targetCompetitionId: string;
  }): Promise<{ customToken: string; assignmentId: string; competitionId: string }> {
    // 1. Assert judge assignment is valid, unexpired, unrevoked, matching scope, and secret matches scrypt KDF
    await this.assertJudgeAssignment({
      assignmentId: params.assignmentId,
      targetCompetitionId: params.targetCompetitionId,
      secret: params.secret
    });

    const auth = getAdminAuth();
    if (!auth) {
      throw new Error('Service Unavailable: Firebase Admin Auth not initialized.');
    }

    // 2. Issue a Firebase-signed custom token with JUDGE role and bound assignmentId
    const judgeUid = `judge-${params.assignmentId}`;
    const customToken = await auth.createCustomToken(judgeUid, {
      role: 'JUDGE',
      assignmentId: params.assignmentId,
      competitionId: params.targetCompetitionId
    });

    return {
      customToken,
      assignmentId: params.assignmentId,
      competitionId: params.targetCompetitionId
    };
  }

  /**
   * Secure Admin Bootstrap Procedure
   * Can ONLY be run when zero administrators exist in the database.
   * Protected by atomic Firestore transaction to prevent race conditions during concurrent bootstrap attempts.
   * Features lock ownership verification, partial Auth-account rollback, and permanent lock commitment.
   */
  static async bootstrapInitialAdmin(params: {
    email: string;
    password: string;
    displayName: string;
    bootstrapSecret: string;
  }): Promise<{ uid: string; email: string }> {
    const auth = getAdminAuth();
    const db = getAdminDb();

    if (!auth || !db) {
      throw new Error('Service Unavailable: Firebase Admin SDK not initialized.');
    }

    let expectedSecret = process.env.ADMIN_BOOTSTRAP_SECRET;
    if (!expectedSecret || expectedSecret.trim() === '') {
      // Secure local credentials location outside repository and cloud sync
      const secureSecretPath = 'C:/Users/Admin/.credentials/admin_bootstrap_secret.key';
      if (fs.existsSync(secureSecretPath)) {
        expectedSecret = fs.readFileSync(secureSecretPath, 'utf8').trim();
      }
    }

    if (!expectedSecret || expectedSecret.trim() === '') {
      throw new Error(
        'Security Error: ADMIN_BOOTSTRAP_SECRET is not configured and secure key file was not found in C:/Users/Admin/.credentials/admin_bootstrap_secret.key.'
      );
    }
    if (params.bootstrapSecret !== expectedSecret) {
      throw new Error('Unauthorized: Invalid bootstrap secret key.');
    }

    // 1. Check if any admin already exists in the users collection
    const existingAdmins = await db.collection('users').where('role', '==', 'ADMIN').limit(1).get();
    if (!existingAdmins.empty) {
      throw new Error('Security Lock: Initial administrator already provisioned. Bootstrap is locked.');
    }

    // 2. Atomic transaction ensures mutual exclusion against concurrent bootstrap executions
    const lockRef = db.collection('settings').doc('bootstrapLock');
    const lockToken = randomUUID();
    let lockAcquired = false;
    let authUserCreated = false;
    let uid = '';

    try {
      await db.runTransaction(async (transaction) => {
        const lockDoc = await transaction.get(lockRef);
        if (lockDoc.exists && lockDoc.data()?.isLocked && lockDoc.data()?.status === 'COMMITTED') {
          throw new Error('Security Lock: Initial administrator already provisioned. Bootstrap is locked.');
        }

        // If another process has a PENDING lock acquired recently, prevent concurrent race
        if (lockDoc.exists && lockDoc.data()?.status === 'PENDING') {
          const lockedAt = new Date(lockDoc.data()?.lockedAt || 0).getTime();
          const elapsed = Date.now() - lockedAt;
          if (elapsed < 60000) {
            throw new Error('Security Lock: Another administrative bootstrap process is currently in progress.');
          }
        }

        transaction.set(lockRef, {
          isLocked: true,
          lockToken,
          status: 'PENDING',
          lockedAt: new Date().toISOString(),
          initiatedBy: params.email
        });
      });
      lockAcquired = true;

      try {
        const userRecord = await auth.createUser({
          email: params.email,
          password: params.password,
          displayName: params.displayName
        });
        uid = userRecord.uid;
        authUserCreated = true;
      } catch (err: any) {
        if (err.code === 'auth/email-already-exists') {
          const existing = await auth.getUserByEmail(params.email);
          uid = existing.uid;
        } else {
          throw err;
        }
      }

      // Set custom role claim
      await auth.setCustomUserClaims(uid, { role: 'ADMIN' });

      // Store in users collection
      const now = new Date().toISOString();
      const userDoc: FirestoreUser = {
        id: uid,
        email: params.email,
        displayName: params.displayName,
        role: 'ADMIN',
        status: 'ACTIVE',
        createdAt: now,
        updatedAt: now
      };

      await db.collection('users').doc(uid).set(userDoc);

      // Permanently commit the lock with ownership verification
      await db.runTransaction(async (transaction) => {
        const currentLock = await transaction.get(lockRef);
        if (currentLock.exists && currentLock.data()?.lockToken === lockToken) {
          transaction.update(lockRef, {
            status: 'COMMITTED',
            adminUid: uid,
            committedAt: new Date().toISOString()
          });
        }
      });

      console.log(`[AuthService] Successfully bootstrapped initial Chief Admin: ${params.email} (${uid})`);
      return { uid, email: params.email };
    } catch (err: any) {
      // Failure Recovery with Ownership Verification:
      if (lockAcquired) {
        // Rollback partial Auth user if created in this failed run
        if (authUserCreated && uid) {
          try {
            await auth.deleteUser(uid);
            console.warn(`[AuthService] Rolled back partial Auth user (${uid}) due to provisioning failure.`);
          } catch (deleteAuthErr) {
            console.error('[AuthService] Failed to rollback partial Auth user:', deleteAuthErr);
          }
        }

        // Release lock ONLY if this process owns the lockToken and status is still PENDING
        try {
          await db.runTransaction(async (transaction) => {
            const currentLock = await transaction.get(lockRef);
            if (currentLock.exists && currentLock.data()?.lockToken === lockToken && currentLock.data()?.status === 'PENDING') {
              transaction.delete(lockRef);
              console.warn('[AuthService] Released pending bootstrap lock owned by this process.');
            }
          });
        } catch (releaseErr) {
          console.error('[AuthService] Failed to release bootstrap lock:', releaseErr);
        }
      }
      throw err;
    }
  }

  /**
   * Provision a new Team Manager account.
   * Can ONLY be called by a verified administrator.
   */
  static async provisionTeamManager(
    adminIdToken: string,
    params: {
      email: string;
      password: string;
      displayName: string;
      teamId: string;
    }
  ): Promise<{ uid: string; email: string; teamId: string }> {
    // 1. Strict authorization: Caller MUST be verified ADMIN
    await this.assertAdmin(adminIdToken);

    const auth = getAdminAuth();
    const db = getAdminDb();

    if (!auth || !db) {
      throw new Error('Service Unavailable: Firebase Admin SDK not initialized.');
    }

    if (!params.teamId) {
      throw new Error('Validation Error: teamId is mandatory for Team Manager accounts.');
    }

    // Verify team exists in teams collection
    const teamDoc = await db.collection('teams').doc(params.teamId).get();
    if (!teamDoc.exists) {
      throw new Error(`Validation Error: Team "${params.teamId}" does not exist.`);
    }

    // Create or retrieve auth user
    let uid = '';
    try {
      const userRecord = await auth.createUser({
        email: params.email,
        password: params.password,
        displayName: params.displayName
      });
      uid = userRecord.uid;
    } catch (err: any) {
      if (err.code === 'auth/email-already-exists') {
        const existing = await auth.getUserByEmail(params.email);
        uid = existing.uid;
      } else {
        throw err;
      }
    }

    // Set custom role claim strictly binding user to their teamId
    await auth.setCustomUserClaims(uid, {
      role: 'TEAM_MANAGER',
      teamId: params.teamId
    });

    // Write to Firestore users collection
    const now = new Date().toISOString();
    const userDoc: FirestoreUser = {
      id: uid,
      email: params.email,
      displayName: params.displayName,
      role: 'TEAM_MANAGER',
      teamId: params.teamId,
      createdAt: now,
      updatedAt: now
    };

    await db.collection('users').doc(uid).set(userDoc);
    console.log(`[AuthService] Provisioned Team Manager for ${params.teamId}: ${params.email} (${uid})`);

    return { uid, email: params.email, teamId: params.teamId };
  }

  /**
   * Updates an existing user's role.
   * Can ONLY be called by a verified administrator.
   * Prevents self-escalation or unauthorized privilege grants.
   */
  static async updateUserRole(
    adminIdToken: string,
    params: {
      targetUid: string;
      newRole: UserRole;
      newTeamId?: string;
    }
  ): Promise<boolean> {
    const adminUser = await this.assertAdmin(adminIdToken);

    // Prevent Admin from accidentally demoting themselves if they are the only admin
    if (adminUser.uid === params.targetUid && params.newRole !== 'ADMIN') {
      throw new Error('Security Violation: Administrators cannot demote their own account.');
    }

    const auth = getAdminAuth();
    const db = getAdminDb();

    if (!auth || !db) {
      throw new Error('Service Unavailable: Firebase Admin SDK not initialized.');
    }

    // Set custom claims
    await auth.setCustomUserClaims(params.targetUid, {
      role: params.newRole,
      teamId: params.newRole === 'TEAM_MANAGER' ? params.newTeamId : null
    });

    // Update Firestore users document
    await db.collection('users').doc(params.targetUid).set(
      {
        role: params.newRole,
        teamId: params.newRole === 'TEAM_MANAGER' ? params.newTeamId : null,
        updatedAt: new Date().toISOString()
      },
      { merge: true }
    );

    return true;
  }
}
