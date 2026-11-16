/**
 * Server-Side Unified Staff Authentication & Verification Service
 * 
 * Verifies staff sessions with fail-closed cryptographic enforcement:
 * 1. Cryptographic token verification (Firebase Auth ID Token with revocation check).
 * 2. Exact role agreement between Firebase Custom Claims and Firestore /users/{uid}.
 * 3. Authoritative account status verification (status === ACTIVE, disabled !== true).
 * 4. Automatic safe synchronization of custom claims when mismatch is detected.
 * 5. Strict role gating:
 *    - ADMIN -> /admin
 *    - GREEN_ROOM_STAFF -> /admin/green-room
 *    - TEAM_MANAGER -> /team (verified against public /teams/{teamId} AND private /teams/{teamId}/private/managerInfo)
 *    - JUDGE -> REJECTED (must use dedicated juror PIN portal)
 *    - PUBLIC / PARTICIPANT / unknown -> REJECTED
 */

import { getAdminAuth, getAdminDb, syncWorkloadIdentityToken } from '@/lib/firebase/admin';
import { FirestoreUser, FirestoreTeam, FirestoreTeamPrivate } from '@/types/firestore';
import { Team } from '@/types/fest';

export type StaffRole = 'ADMIN' | 'TEAM_MANAGER' | 'GREEN_ROOM_STAFF';

export type UnifiedStaffAuthResult =
  | {
      status: 'SUCCESS';
      role: StaffRole;
      redirectUrl: '/admin' | '/team' | '/admin/green-room';
      team?: Team;
      uid: string;
      email: string;
    }
  | {
      status: 'NEEDS_REFRESH';
      message: string;
    };

export class UnifiedAuthError extends Error {
  constructor(message: string, public statusCode: number = 403) {
    super(message);
    this.name = 'UnifiedAuthError';
  }
}

export class UnifiedAuthService {
  /**
   * Cryptographically verifies staff session token, syncs claims if needed,
   * checks authoritative user profile, public team status, and private manager record,
   * returning verified routing context.
   */
  static async verifyStaffLogin(idToken: string): Promise<UnifiedStaffAuthResult> {
    if (!idToken || typeof idToken !== 'string') {
      throw new UnifiedAuthError('Missing or invalid authentication token.', 401);
    }

    await syncWorkloadIdentityToken().catch((err) => {
      console.warn('[UnifiedAuthService] syncWorkloadIdentityToken warning:', err);
    });

    const adminAuth = getAdminAuth();
    const adminDb = getAdminDb();

    if (!adminAuth || !adminDb) {
      throw new UnifiedAuthError('Authentication service is currently unavailable. Please verify configuration.', 503);
    }

    // 1. Verify token cryptographically with revocation check
    let decoded;
    try {
      decoded = await adminAuth.verifyIdToken(idToken, true);
    } catch (tokenErr: unknown) {
      console.warn('[UnifiedAuthService] Token verification failed:', tokenErr);
      throw new UnifiedAuthError('Invalid or expired authentication session. Please sign in again.', 401);
    }

    const uid = decoded.uid;

    // 2. Authoritative profile lookup from Firestore (/users/{uid})
    let userDocSnap;
    try {
      userDocSnap = await adminDb.collection('users').doc(uid).get();
    } catch (fsErr) {
      console.error('[UnifiedAuthService] Firestore user lookup failed:', fsErr);
      throw new UnifiedAuthError('Database lookup failed. Unable to verify authoritative profile.', 503);
    }

    if (!userDocSnap.exists) {
      throw new UnifiedAuthError('Access denied: Authoritative user profile not found.', 403);
    }

    const userData = userDocSnap.data() as FirestoreUser | undefined;
    if (!userData) {
      throw new UnifiedAuthError('Access denied: User profile data is corrupt or empty.', 403);
    }

    // 3. Status and disabled checks
    if (userData.disabled === true || userData.status === 'DISABLED') {
      throw new UnifiedAuthError('Access denied: Account has been disabled by fest administration.', 403);
    }

    if (userData.status !== 'ACTIVE') {
      throw new UnifiedAuthError('Access denied: Account is pending activation or inactive.', 403);
    }

    // 4. Role restrictions: JUDGE is forbidden from staff email/password login
    if (userData.role === 'JUDGE') {
      throw new UnifiedAuthError('Access denied: Judges must sign in using their Juror Access Code at the Judge Portal.', 403);
    }

    if (userData.role !== 'ADMIN' && userData.role !== 'TEAM_MANAGER' && userData.role !== 'GREEN_ROOM_STAFF') {
      throw new UnifiedAuthError('Access denied: Account does not possess staff or administrative privileges.', 403);
    }

    const authoritativeRole = userData.role as StaffRole;

    // 5. Check if token claims match the authoritative profile
    const tokenRole = decoded.role;
    const tokenTeamId = decoded.teamId as string | undefined;

    const claimsMatch =
      tokenRole === authoritativeRole &&
      (authoritativeRole !== 'TEAM_MANAGER' || tokenTeamId === userData.teamId);

    if (!claimsMatch) {
      // Safely synchronize custom claims with the authoritative profile
      const newClaims: Record<string, unknown> = {
        role: authoritativeRole
      };
      if (authoritativeRole === 'TEAM_MANAGER' && userData.teamId) {
        newClaims.teamId = userData.teamId;
      }

      await adminAuth.setCustomUserClaims(uid, newClaims);

      return {
        status: 'NEEDS_REFRESH',
        message: 'Security credentials synchronized. Refreshing authentication session...'
      };
    }

    // Exact agreement between token claim and authoritative role is required
    if (tokenRole !== authoritativeRole) {
      throw new UnifiedAuthError('Security violation: Token role does not match authoritative role.', 403);
    }

    // 6. Role-specific validation & routing
    if (authoritativeRole === 'ADMIN') {
      return {
        status: 'SUCCESS',
        role: 'ADMIN',
        redirectUrl: '/admin',
        uid,
        email: decoded.email || userData.email || ''
      };
    }

    if (authoritativeRole === 'GREEN_ROOM_STAFF') {
      return {
        status: 'SUCCESS',
        role: 'GREEN_ROOM_STAFF',
        redirectUrl: '/admin/green-room',
        uid,
        email: decoded.email || userData.email || ''
      };
    }

    if (authoritativeRole === 'TEAM_MANAGER') {
      const assignedTeamId = userData.teamId;
      if (!assignedTeamId) {
        throw new UnifiedAuthError('Security violation: Team Manager account is missing mandatory team assignment.', 403);
      }

      if (tokenTeamId !== assignedTeamId) {
        throw new UnifiedAuthError('Security violation: Token team assignment does not match authoritative profile.', 403);
      }

      // Step A: Authoritative Public Team Record verification (/teams/{teamId})
      let publicTeamDocSnap;
      try {
        publicTeamDocSnap = await adminDb.collection('teams').doc(assignedTeamId).get();
      } catch (teamFsErr) {
        console.error('[UnifiedAuthService] Firestore public team lookup failed:', teamFsErr);
        throw new UnifiedAuthError('Database lookup failed. Unable to verify team status.', 503);
      }

      if (!publicTeamDocSnap.exists) {
        throw new UnifiedAuthError(`Access denied: Assigned team contingent record not found (${assignedTeamId}).`, 403);
      }

      const publicTeamData = publicTeamDocSnap.data() as Partial<FirestoreTeam> | undefined;
      if (!publicTeamData) {
        throw new UnifiedAuthError('Access denied: Team contingent record is corrupt or empty.', 403);
      }

      // Public team status must equal exactly 'ACTIVE' (fail-closed if missing, disabled, or anything else)
      if (publicTeamData.status !== 'ACTIVE') {
        throw new UnifiedAuthError('Access denied: Team contingent is not currently active.', 403);
      }

      // Step B: Authoritative Private Team Manager verification (/teams/{teamId}/private/managerInfo)
      let privateDocSnap;
      try {
        privateDocSnap = await adminDb
          .collection('teams')
          .doc(assignedTeamId)
          .collection('private')
          .doc('managerInfo')
          .get();
      } catch (privFsErr) {
        console.error('[UnifiedAuthService] Firestore private manager lookup failed:', privFsErr);
        throw new UnifiedAuthError('Database lookup failed. Unable to verify private manager authorization.', 503);
      }

      if (!privateDocSnap.exists) {
        throw new UnifiedAuthError('Access denied: Authoritative team manager onboarding record not found.', 403);
      }

      const privateManagerData = privateDocSnap.data() as Partial<FirestoreTeamPrivate> | undefined;
      if (!privateManagerData) {
        throw new UnifiedAuthError('Access denied: Team manager private record is corrupt or empty.', 403);
      }

      // Private teamId must match assignedTeamId exactly
      if (privateManagerData.teamId !== assignedTeamId) {
        throw new UnifiedAuthError('Security violation: Private manager record team assignment mismatch.', 403);
      }

      // Private managerUid must match authenticated Firebase UID exactly
      if (!privateManagerData.managerUid || privateManagerData.managerUid !== uid) {
        throw new UnifiedAuthError(
          'Security violation: You are not the officially assigned manager in the authoritative team record.',
          403
        );
      }

      // Private portalAccess must equal exactly true
      if (privateManagerData.portalAccess !== true) {
        throw new UnifiedAuthError('Access denied: Team contingent portal access has been disabled.', 403);
      }

      // Step C: Build verified Team Manager context exclusively from authoritative data
      const verifiedTeam: Team = {
        id: publicTeamDocSnap.id,
        name: publicTeamData.name || 'Delegation Team',
        code: publicTeamData.code || 'TM',
        color: publicTeamData.color || '#2563EB',
        managerName: privateManagerData.managerName || '',
        managerEmail: privateManagerData.managerEmail || userData.email || decoded.email || '',
        managerPhone: privateManagerData.managerPhone || '',
        managerUid: privateManagerData.managerUid,
        zone: publicTeamData.zone || '',
        contestantsCount: 0,
        eventsCount: 0,
        totalPoints: 0,
        soloPoints: 0,
        groupPoints: 0,
        rank: 1,
        firstCount: 0,
        secondCount: 0,
        thirdCount: 0,
        portalAccess: privateManagerData.portalAccess,
        status: publicTeamData.status,
        provisioningStatus: privateManagerData.provisioningStatus,
        invitationStatus: privateManagerData.invitationStatus,
        invitationExpiresAt: privateManagerData.invitationExpiresAt
      };

      return {
        status: 'SUCCESS',
        role: 'TEAM_MANAGER',
        redirectUrl: '/team',
        team: verifiedTeam,
        uid,
        email: decoded.email || userData.email || ''
      };
    }

    throw new UnifiedAuthError('Access denied: Unauthorized role.', 403);
  }
}
