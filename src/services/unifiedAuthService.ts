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
 *    - TEAM_MANAGER -> /team (verified against assigned teamId, active status, portalAccess !== false)
 *    - GREEN_ROOM_STAFF -> /admin/green-room
 *    - JUDGE -> REJECTED (must use dedicated juror PIN portal)
 *    - PUBLIC / PARTICIPANT / unknown -> REJECTED
 */

import { getAdminAuth, getAdminDb, syncWorkloadIdentityToken } from '@/lib/firebase/admin';
import { FirestoreUser } from '@/types/firestore';
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
   * checks authoritative user profile & team status, and returns verified routing context.
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

    // 2. Authoritative profile lookup from Firestore
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

      // Authoritative Team Contingent verification
      let teamDocSnap;
      try {
        teamDocSnap = await adminDb.collection('teams').doc(assignedTeamId).get();
      } catch (teamFsErr) {
        console.error('[UnifiedAuthService] Firestore team lookup failed:', teamFsErr);
        throw new UnifiedAuthError('Database lookup failed. Unable to verify team status.', 503);
      }

      if (!teamDocSnap.exists) {
        throw new UnifiedAuthError(`Access denied: Assigned team contingent record not found (${assignedTeamId}).`, 403);
      }

      const teamData = teamDocSnap.data() as Partial<Team> | undefined;
      if (!teamData) {
        throw new UnifiedAuthError('Access denied: Team contingent record is corrupt or empty.', 403);
      }

      if (teamData.status === 'DISABLED') {
        throw new UnifiedAuthError('Access denied: Team contingent is currently disabled by fest administration.', 403);
      }

      if (teamData.portalAccess === false) {
        throw new UnifiedAuthError('Access denied: Team contingent portal access has been disabled.', 403);
      }

      const verifiedTeam: Team = {
        id: teamDocSnap.id,
        name: teamData.name || 'Delegation Team',
        code: teamData.code || 'TM',
        color: teamData.color || '#2563EB',
        managerName: teamData.managerName || '',
        managerEmail: teamData.managerEmail || userData.email || decoded.email || '',
        managerPhone: teamData.managerPhone || '',
        managerUid: uid,
        zone: teamData.zone || '',
        contestantsCount: teamData.contestantsCount || 0,
        eventsCount: teamData.eventsCount || 0,
        totalPoints: teamData.totalPoints || 0,
        soloPoints: teamData.soloPoints || 0,
        groupPoints: teamData.groupPoints || 0,
        rank: teamData.rank || 1,
        firstCount: teamData.firstCount || 0,
        secondCount: teamData.secondCount || 0,
        thirdCount: teamData.thirdCount || 0,
        portalAccess: true,
        status: teamData.status || 'ACTIVE'
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
