/**
 * Server-Side Dynamic Team Management & Secure Manual WhatsApp Onboarding Service
 * Single-Fest Architecture: "Sahithyolsav 2025" / Inspirath Fest Management
 * 
 * Enforces:
 * 1. Dynamic team creation without hardcoded team rosters or fixed team counts.
 * 2. Automatic provisioning of exactly one Team Manager Auth account per team.
 * 3. Secure manual WhatsApp invitation generation (cryptographic SHA-256 hash stored, plaintext code never persisted).
 * 4. Zero exposure of raw invitation codes, passwords, or Firebase action codes in public Firestore or wa.me URLs.
 * 5. Strict lifecycle: PENDING -> READY_TO_SEND -> MANUALLY_SENT -> ACTIVATED (with EXPIRED & REVOKED handling).
 * 6. Public teams collection contains ONLY safe public metadata (/teams/{teamId}).
 * 7. Private Admin-only subcollection (/teams/{teamId}/private/managerInfo) for manager identity and onboarding state.
 * 8. Stale-session lockout, token revocation, and account demotion upon manager replacement.
 * 9. Comprehensive audit logging for all administrative actions without logging secrets.
 */

import { randomUUID } from 'crypto';
import * as crypto from 'crypto';
import { getAdminAuth, getAdminDb } from '@/lib/firebase/admin';
import { FirestoreTeam, FirestoreTeamPrivate, CombinedTeam, FirestoreUser, InvitationStatus, ProvisioningStatus } from '@/types/firestore';
import { AuthService } from './authService';
import { InvitationService, GenerateInvitationResult } from './invitationService';

export interface CreateTeamParams {
  name: string;
  code?: string;
  color?: string;
  zone?: string;
  managerEmail?: string;
  managerName?: string;
  managerPhone?: string; // WhatsApp Number
  appUrl?: string;
}

export interface ReplaceManagerParams {
  newManagerEmail: string;
  newManagerName?: string;
  newManagerPhone?: string; // WhatsApp Number
  appUrl?: string;
}

export interface CreateTeamResult {
  team: CombinedTeam;
  managerUid?: string;
  invitation?: {
    code: string;
    message: string;
    whatsappUrl: string;
    expiresAt: string;
  };
}

export interface GenerateInvitationResponse {
  success: boolean;
  invitationCode: string;
  message: string;
  whatsappUrl: string;
  expiresAt: string;
  teamName: string;
  managerEmail: string;
  managerPhone: string;
}

export class TeamService {
  /**
   * Helper to generate a clean, URL-safe 3-letter code from a team name if not provided.
   */
  static generateTeamCode(name: string): string {
    const words = name.trim().split(/\s+/).filter(Boolean);
    if (words.length >= 3) {
      return (words[0][0] + words[1][0] + words[2][0]).toUpperCase();
    }
    const clean = name.replace(/[^a-zA-Z0-9]/g, '').toUpperCase();
    if (clean.length >= 3) {
      return clean.slice(0, 3);
    }
    return (clean + 'TM').slice(0, 3);
  }

  /**
   * Generates a unique, URL-safe team ID.
   */
  static generateTeamId(name: string): string {
    let slug = name
      .toLowerCase()
      .trim()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '');
    if (slug.startsWith('team-')) {
      slug = slug.substring(5);
    } else if (slug === 'team') {
      slug = '';
    }
    const shortId = randomUUID().split('-')[0];
    return `team-${slug || 'contingent'}-${shortId}`;
  }

  /**
   * Creates a new team and automatically provisions its assigned Team Manager account.
   * Can ONLY be executed by a verified ADMIN.
   * 
   * Strict Security Invariants:
   * - Public teams collection stores ONLY safe public metadata (id, name, code, color, zone, status).
   * - Private manager metadata and onboarding state are stored in /teams/{teamId}/private/managerInfo.
   * - Manager is kept in PENDING activation status.
   * - Temporary random passwords are never exposed, stored, or logged.
   * - A one-time WhatsApp invitation code is generated, hashed with SHA-256 (only hash stored).
   * - Plaintext invitation code and formatted WhatsApp message are returned once to the Admin.
   */
  static async createTeamWithManager(
    adminIdToken: string,
    params: CreateTeamParams
  ): Promise<CreateTeamResult> {
    // 1. Authorize: Caller MUST possess verified ADMIN role
    const adminUser = await AuthService.assertAdmin(adminIdToken);

    const auth = getAdminAuth();
    const db = getAdminDb();

    if (!auth || !db) {
      throw new Error('Service Unavailable: Firebase Admin SDK not initialized.');
    }

    if (!params.name || params.name.trim() === '') {
      throw new Error('Validation Error: Team Name is required.');
    }

    const teamName = params.name.trim();
    const teamCode = (params.code?.trim() || this.generateTeamCode(teamName)).toUpperCase();
    const teamId = this.generateTeamId(teamName);
    const now = new Date().toISOString();

    // 2. Validate Duplicate Team Name
    const existingNameSnap = await db.collection('teams').where('name', '==', teamName).limit(1).get();
    if (!existingNameSnap.empty) {
      throw new Error(`Validation Error: A team named "${teamName}" already exists.`);
    }

    const rawEmail = params.managerEmail?.trim()?.toLowerCase();
    const rawPhone = params.managerPhone?.trim() || '';

    // 3. If Manager Email is NOT provided, create team in AWAITING_MANAGER status
    if (!rawEmail) {
      const publicTeam: FirestoreTeam = {
        id: teamId,
        name: teamName,
        code: teamCode,
        color: params.color || '#2563EB',
        zone: params.zone?.trim() || 'Campus Center',
        status: 'ACTIVE',
        createdAt: now,
        updatedAt: now
      };

      const privateManager: FirestoreTeamPrivate = {
        teamId,
        managerName: params.managerName?.trim() || '',
        managerEmail: '',
        managerPhone: rawPhone,
        portalAccess: false,
        provisioningStatus: 'AWAITING_MANAGER',
        invitationStatus: 'PENDING',
        createdAt: now,
        updatedAt: now
      };

      await db.collection('teams').doc(teamId).set(publicTeam);
      await db.collection('teams').doc(teamId).collection('private').doc('managerInfo').set(privateManager);

      await db.collection('auditLogs').add({
        action: 'TEAM_CREATED_WITHOUT_MANAGER',
        teamId,
        teamName,
        performedBy: adminUser.email,
        performedByUid: adminUser.uid,
        timestamp: now
      });

      return {
        team: {
          ...publicTeam,
          ...privateManager
        }
      };
    }

    // 4. Validate Manager Email uniqueness across all existing teams
    // RULE: ONE TEAM = ONE ACTIVE TEAM MANAGER LOGIN
    const duplicateUserSnap = await db
      .collection('users')
      .where('email', '==', rawEmail)
      .limit(1)
      .get();

    if (!duplicateUserSnap.empty) {
      const existingUser = duplicateUserSnap.docs[0].data() as FirestoreUser;
      if (existingUser.role === 'ADMIN') {
        throw new Error(
          `Security Violation: User "${rawEmail}" is an Administrator and cannot be assigned as a Team Manager.`
        );
      }
      if (existingUser.role === 'TEAM_MANAGER' && existingUser.teamId && existingUser.teamId !== teamId) {
        throw new Error(
          `Validation Error: Manager email "${rawEmail}" is already assigned to team "${existingUser.teamId}". A manager can only be assigned to one team.`
        );
      }
    }

    // Double check private managerInfo records to guarantee strict uniqueness
    const dupPrivateSnap = await db
      .collectionGroup('private')
      .where('managerEmail', '==', rawEmail)
      .limit(1)
      .get()
      .catch(() => ({ empty: true, docs: [] as any[] }));

    if (!dupPrivateSnap.empty && dupPrivateSnap.docs[0].data().teamId !== teamId) {
      const existingPrivate = dupPrivateSnap.docs[0].data() as FirestoreTeamPrivate;
      throw new Error(
        `Validation Error: Manager email "${rawEmail}" is already assigned to team "${existingPrivate.teamId}". A manager can only be assigned to one team.`
      );
    }

    // 5. Provision Firebase Authentication Identity
    let managerUid = '';
    let isNewlyCreatedAuth = false;

    try {
      try {
        const existingAuth = await auth.getUserByEmail(rawEmail);
        managerUid = existingAuth.uid;

        // Prevent hijacking or demoting an Administrator
        if (existingAuth.customClaims?.role === 'ADMIN') {
          throw new Error(
            `Security Violation: User "${rawEmail}" is an Administrator and cannot be assigned as a Team Manager.`
          );
        }

        // Prevent assigning a user who is already managing another active team
        const existingUserDoc = await db.collection('users').doc(managerUid).get();
        if (existingUserDoc.exists) {
          const userData = existingUserDoc.data() as FirestoreUser;
          if (userData.role === 'TEAM_MANAGER' && userData.teamId && userData.teamId !== teamId) {
            throw new Error(
              `Validation Error: User "${rawEmail}" is already assigned to another team in Firestore.`
            );
          }
        }
      } catch (checkErr: any) {
        if (checkErr.code === 'auth/user-not-found') {
          // Cryptographically unguessable temporary password (NEVER exposed, stored, or logged)
          const randomSecret = crypto.randomBytes(24).toString('base64url');
          const newAuth = await auth.createUser({
            email: rawEmail,
            password: randomSecret,
            displayName: params.managerName?.trim() || `${teamName} Manager`,
            disabled: false
          });
          managerUid = newAuth.uid;
          isNewlyCreatedAuth = true;
        } else {
          throw checkErr;
        }
      }

      // 6. Assign Custom Claims: Strictly bind role to TEAM_MANAGER and teamId
      await auth.setCustomUserClaims(managerUid, {
        role: 'TEAM_MANAGER',
        teamId: teamId
      });

      // 7. Write authoritative Firestore users/{uid} document with status: 'PENDING'
      // PENDING managers are strictly prohibited by Firestore rules from accessing team data
      const userDoc: FirestoreUser = {
        id: managerUid,
        email: rawEmail,
        displayName: params.managerName?.trim() || `${teamName} Manager`,
        role: 'TEAM_MANAGER',
        teamId: teamId,
        status: 'PENDING',
        disabled: false,
        createdAt: now,
        updatedAt: now
      };
      await db.collection('users').doc(managerUid).set(userDoc);

      // 8. Generate One-Time Manual WhatsApp Invitation Package
      const invitationPackage = InvitationService.createInvitationPackage({
        teamName,
        managerEmail: rawEmail,
        managerPhone: rawPhone,
        appUrl: params.appUrl,
        teamId
      });

      // 9. Write Public Firestore teams/{teamId} document (SAFE PUBLIC METADATA ONLY)
      const publicTeam: FirestoreTeam = {
        id: teamId,
        name: teamName,
        code: teamCode,
        color: params.color || '#2563EB',
        zone: params.zone?.trim() || 'Campus Center',
        status: 'ACTIVE',
        createdAt: now,
        updatedAt: now
      };
      await db.collection('teams').doc(teamId).set(publicTeam);

      // 10. Write Private Admin-Only Firestore document (/teams/{teamId}/private/managerInfo)
      // RAW INVITATION CODE IS NEVER STORED IN FIRESTORE — ONLY SHA-256 HASH
      const privateManager: FirestoreTeamPrivate = {
        teamId,
        managerUid,
        managerName: params.managerName?.trim() || `${teamName} Manager`,
        managerEmail: rawEmail,
        managerPhone: rawPhone,
        portalAccess: false,
        provisioningStatus: 'PROVISIONED',
        invitationStatus: 'READY_TO_SEND',
        invitationTokenHash: invitationPackage.tokenHash,
        invitationExpiresAt: invitationPackage.expiresAt,
        invitationCreatedAt: now,
        invitationRedeemed: false,
        createdAt: now,
        updatedAt: now
      };
      await db.collection('teams').doc(teamId).collection('private').doc('managerInfo').set(privateManager);

      // 11. Write Audit Log (NEVER logs raw invitation code)
      await db.collection('auditLogs').add({
        action: 'TEAM_MANAGER_PROVISIONED',
        teamId,
        teamName,
        managerUid,
        managerEmail: rawEmail,
        invitationStatus: 'READY_TO_SEND',
        performedBy: adminUser.email,
        performedByUid: adminUser.uid,
        timestamp: now
      });

      const combinedTeam: CombinedTeam = {
        ...publicTeam,
        ...privateManager
      };

      return {
        team: combinedTeam,
        managerUid,
        invitation: {
          code: invitationPackage.code, // Returned once to the Admin
          message: invitationPackage.message,
          whatsappUrl: invitationPackage.whatsappUrl,
          expiresAt: invitationPackage.expiresAt
        }
      };
    } catch (err) {
      // Partial failure rollback: remove newly provisioned Auth identity if Firestore write failed
      if (isNewlyCreatedAuth && managerUid) {
        try {
          await auth.deleteUser(managerUid);
          await db.collection('users').doc(managerUid).delete().catch(() => {});
        } catch (cleanupErr) {
          console.error(`[TeamService] Failed to rollback orphaned auth user ${managerUid}:`, cleanupErr);
        }
      }
      throw err;
    }
  }

  /**
   * Generates or regenerates a fresh, one-time manual WhatsApp invitation code for a team.
   * Can ONLY be called by a verified Admin.
   * Invalidates any previously active invitation token hash.
   */
  static async generateInvitation(
    adminIdToken: string,
    teamId: string,
    appUrl?: string
  ): Promise<GenerateInvitationResponse> {
    const adminUser = await AuthService.assertAdmin(adminIdToken);

    const db = getAdminDb();
    if (!db) {
      throw new Error('Service Unavailable: Firebase Admin SDK not initialized.');
    }

    const teamRef = db.collection('teams').doc(teamId);
    const snap = await teamRef.get();
    if (!snap.exists) {
      throw new Error(`Validation Error: Team "${teamId}" does not exist.`);
    }

    const publicTeam = snap.data() as FirestoreTeam;
    const privateRef = teamRef.collection('private').doc('managerInfo');
    const privateSnap = await privateRef.get();

    if (!privateSnap.exists) {
      throw new Error(`Validation Error: Team "${publicTeam.name}" has no manager record configured.`);
    }

    const privateData = privateSnap.data() as FirestoreTeamPrivate;
    if (!privateData.managerEmail) {
      throw new Error(`Validation Error: Team "${publicTeam.name}" has no manager email configured.`);
    }

    const now = new Date().toISOString();
    const invitationPackage = InvitationService.createInvitationPackage({
      teamName: publicTeam.name,
      managerEmail: privateData.managerEmail,
      managerPhone: privateData.managerPhone || '',
      appUrl,
      teamId
    });

    await privateRef.update({
      invitationStatus: 'READY_TO_SEND',
      invitationTokenHash: invitationPackage.tokenHash,
      invitationExpiresAt: invitationPackage.expiresAt,
      invitationCreatedAt: now,
      invitationRedeemed: false,
      updatedAt: now
    });

    await db.collection('auditLogs').add({
      action: 'TEAM_MANAGER_INVITATION_GENERATED',
      teamId,
      teamName: publicTeam.name,
      managerEmail: privateData.managerEmail,
      invitationStatus: 'READY_TO_SEND',
      performedBy: adminUser.email,
      performedByUid: adminUser.uid,
      timestamp: now
    });

    return {
      success: true,
      invitationCode: invitationPackage.code,
      message: invitationPackage.message,
      whatsappUrl: invitationPackage.whatsappUrl,
      expiresAt: invitationPackage.expiresAt,
      teamName: publicTeam.name,
      managerEmail: privateData.managerEmail,
      managerPhone: privateData.managerPhone || ''
    };
  }

  /**
   * Confirms manual dispatch of the WhatsApp invitation by the Chief Administrator.
   * Transitions status from READY_TO_SEND to MANUALLY_SENT.
   * Does NOT represent automated delivery confirmation.
   */
  static async markInvitationSent(
    adminIdToken: string,
    teamId: string
  ): Promise<{ success: boolean; invitationStatus: InvitationStatus }> {
    const adminUser = await AuthService.assertAdmin(adminIdToken);

    const db = getAdminDb();
    if (!db) {
      throw new Error('Service Unavailable: Firebase Admin SDK not initialized.');
    }

    const teamRef = db.collection('teams').doc(teamId);
    const snap = await teamRef.get();
    if (!snap.exists) {
      throw new Error(`Validation Error: Team "${teamId}" does not exist.`);
    }

    const publicTeam = snap.data() as FirestoreTeam;
    const privateRef = teamRef.collection('private').doc('managerInfo');
    const privateSnap = await privateRef.get();

    if (!privateSnap.exists) {
      throw new Error(`Validation Error: Team "${publicTeam.name}" has no manager record configured.`);
    }

    const now = new Date().toISOString();
    await privateRef.update({
      invitationStatus: 'MANUALLY_SENT',
      invitationSentAt: now,
      updatedAt: now
    });

    await db.collection('auditLogs').add({
      action: 'TEAM_MANAGER_INVITATION_MARKED_SENT',
      teamId,
      teamName: publicTeam.name,
      performedBy: adminUser.email,
      performedByUid: adminUser.uid,
      timestamp: now
    });

    return {
      success: true,
      invitationStatus: 'MANUALLY_SENT'
    };
  }

  /**
   * Revokes an active invitation code, preventing any redemption attempts.
   */
  static async revokeInvitation(
    adminIdToken: string,
    teamId: string
  ): Promise<{ success: boolean; invitationStatus: InvitationStatus }> {
    const adminUser = await AuthService.assertAdmin(adminIdToken);

    const db = getAdminDb();
    if (!db) {
      throw new Error('Service Unavailable: Firebase Admin SDK not initialized.');
    }

    const teamRef = db.collection('teams').doc(teamId);
    const snap = await teamRef.get();
    if (!snap.exists) {
      throw new Error(`Validation Error: Team "${teamId}" does not exist.`);
    }

    const publicTeam = snap.data() as FirestoreTeam;
    const privateRef = teamRef.collection('private').doc('managerInfo');
    const privateSnap = await privateRef.get();

    if (!privateSnap.exists) {
      throw new Error(`Validation Error: Team "${publicTeam.name}" has no manager record configured.`);
    }

    const now = new Date().toISOString();
    await privateRef.update({
      invitationStatus: 'REVOKED',
      invitationRevokedAt: now,
      updatedAt: now
    });

    await db.collection('auditLogs').add({
      action: 'TEAM_MANAGER_INVITATION_REVOKED',
      teamId,
      teamName: publicTeam.name,
      performedBy: adminUser.email,
      performedByUid: adminUser.uid,
      timestamp: now
    });

    return {
      success: true,
      invitationStatus: 'REVOKED'
    };
  }

  /**
   * Resend / regenerate alias.
   */
  static async resendInvitation(
    adminIdToken: string,
    teamId: string,
    appUrl?: string
  ): Promise<GenerateInvitationResponse> {
    return this.generateInvitation(adminIdToken, teamId, appUrl);
  }

  /**
   * Previews and verifies an invitation code without consuming or redeeming it.
   * Used by public /team/activate page for real-time validation.
   */
  static async verifyInvitationCode(
    code: string,
    email?: string,
    teamId?: string
  ): Promise<{
    valid: boolean;
    teamName: string;
    managerEmail: string;
    teamId: string;
    expiresAt: string;
  }> {
    if (!code || code.trim() === '') {
      throw new Error('Validation Error: Invitation code is required.');
    }

    const db = getAdminDb();
    if (!db) {
      throw new Error('Service Unavailable: Firebase Admin SDK not initialized.');
    }

    const normalizedCode = InvitationService.normalizeInvitationCode(code);
    const tokenHash = InvitationService.hashInvitationCode(normalizedCode);

    let privateDoc: FirebaseFirestore.DocumentSnapshot | null = null;

    // Fast path: direct team lookup if teamId provided
    if (teamId) {
      const ref = db.collection('teams').doc(teamId).collection('private').doc('managerInfo');
      const snap = await ref.get();
      if (snap.exists && (snap.data() as FirestoreTeamPrivate).invitationTokenHash === tokenHash) {
        privateDoc = snap;
      }
    }

    // Secondary path: attempt collectionGroup query with resilient catch
    if (!privateDoc) {
      try {
        const querySnap = await db
          .collectionGroup('private')
          .where('invitationTokenHash', '==', tokenHash)
          .limit(1)
          .get();

        if (!querySnap.empty) {
          privateDoc = querySnap.docs[0];
        }
      } catch (cgErr: any) {
        console.warn('[TeamService] collectionGroup query unindexed or failed, falling back to direct team scan:', cgErr.message);
      }
    }

    // Direct team subcollection scan fallback (guarantees success even without collection group index)
    if (!privateDoc) {
      const teamsSnap = await db.collection('teams').get();
      for (const tDoc of teamsSnap.docs) {
        const pRef = tDoc.ref.collection('private').doc('managerInfo');
        const pSnap = await pRef.get();
        if (pSnap.exists) {
          const pData = pSnap.data() as FirestoreTeamPrivate;
          if (pData.invitationTokenHash === tokenHash) {
            privateDoc = pSnap;
            break;
          }
        }
      }
    }

    if (!privateDoc || !privateDoc.exists) {
      throw new Error('Validation Error: Invalid or unrecognized invitation code.');
    }

    const privateData = privateDoc.data() as FirestoreTeamPrivate;

    // Check account-specific lockout
    if (privateData.lockedUntil && new Date() < new Date(privateData.lockedUntil)) {
      throw new Error('Security Violation: Account activation is temporarily locked due to repeated failed attempts. Please try again later.');
    }

    if (email && email.trim() !== '') {
      if (privateData.managerEmail?.toLowerCase() !== email.trim().toLowerCase()) {
        throw new Error('Validation Error: The provided email does not match the registered team manager for this invitation.');
      }
    }

    if (privateData.invitationStatus === 'REVOKED') {
      throw new Error('Validation Error: This invitation code has been revoked by an administrator.');
    }

    if (privateData.invitationRedeemed || privateData.invitationStatus === 'ACTIVATED') {
      throw new Error('Validation Error: This invitation code has already been redeemed.');
    }

    if (privateData.invitationExpiresAt && new Date() > new Date(privateData.invitationExpiresAt)) {
      throw new Error('Validation Error: This invitation code has expired. Please contact your Chief Administrator.');
    }

    const teamSnap = await db.collection('teams').doc(privateData.teamId).get();
    const publicTeam = teamSnap.data() as FirestoreTeam;

    if (publicTeam.status === 'DISABLED') {
      throw new Error('Security Violation: The delegation contingent for this invitation is currently disabled.');
    }

    return {
      valid: true,
      teamName: publicTeam?.name || 'Delegation Team',
      managerEmail: privateData.managerEmail || '',
      teamId: privateData.teamId,
      expiresAt: privateData.invitationExpiresAt || ''
    };
  }

  /**
   * Redeems an invitation code, sets the manager's password, and activates their portal account.
   * 
   * Strict Security Invariants:
   * 1. Concurrency protection & atomic single-use redemption via Firestore transaction.
   * 2. Expiration and revocation strictly verified server-side.
   * 3. Account-specific rate limiting & lockout after repeated failed attempts.
   * 4. Safe recovery from partial activation failures (releasing lock on auth failure).
   * 5. Firebase password set securely via Firebase Admin SDK without modifying claims or verified state.
   * 6. Promotes user doc in /users/{uid} to status: 'ACTIVE' only after successful activation.
   * 7. Audit log recorded without exposing secrets.
   */
  static async activateManager(params: {
    code: string;
    email?: string;
    newPassword: string;
    teamId?: string;
  }): Promise<{
    success: boolean;
    message: string;
    teamId: string;
    managerEmail: string;
  }> {
    if (!params.code || params.code.trim() === '') {
      throw new Error('Validation Error: Invitation code is required.');
    }

    if (!params.newPassword || params.newPassword.length < 6) {
      throw new Error('Validation Error: Password must be at least 6 characters in length.');
    }

    const db = getAdminDb();
    const auth = getAdminAuth();

    if (!db || !auth) {
      throw new Error('Service Unavailable: Firebase Admin SDK not initialized.');
    }

    const normalizedCode = InvitationService.normalizeInvitationCode(params.code);
    const tokenHash = InvitationService.hashInvitationCode(normalizedCode);

    let privateDocRef: FirebaseFirestore.DocumentReference | null = null;
    let targetTeamId: string | null = params.teamId || null;

    if (targetTeamId) {
      const ref = db.collection('teams').doc(targetTeamId).collection('private').doc('managerInfo');
      const snap = await ref.get();
      if (snap.exists) {
        const data = snap.data() as FirestoreTeamPrivate;
        if (data.invitationTokenHash === tokenHash) {
          privateDocRef = ref;
        }
      }
    }

    if (!privateDocRef) {
      try {
        const querySnap = await db
          .collectionGroup('private')
          .where('invitationTokenHash', '==', tokenHash)
          .limit(1)
          .get();

        if (!querySnap.empty) {
          privateDocRef = querySnap.docs[0].ref;
          targetTeamId = (querySnap.docs[0].data() as FirestoreTeamPrivate).teamId;
        }
      } catch (cgErr: any) {
        console.warn('[TeamService] collectionGroup query unindexed or failed, falling back to direct team scan:', cgErr.message);
      }
    }

    // Direct team subcollection scan fallback (guarantees success even without collection group index)
    if (!privateDocRef) {
      const teamsSnap = await db.collection('teams').get();
      for (const tDoc of teamsSnap.docs) {
        const pRef = tDoc.ref.collection('private').doc('managerInfo');
        const pSnap = await pRef.get();
        if (pSnap.exists) {
          const pData = pSnap.data() as FirestoreTeamPrivate;
          if (pData.invitationTokenHash === tokenHash) {
            privateDocRef = pRef;
            targetTeamId = pData.teamId || tDoc.id;
            break;
          }
        }
      }
    }

    if (!privateDocRef) {
      throw new Error('Validation Error: Invalid or unrecognized invitation code.');
    }

    const now = new Date().toISOString();

    // PHASE 1: Atomic Concurrency Lock, Expiration, Single-Use, and Account-Specific Rate Limiting
    let reservation: {
      managerUid: string;
      managerEmail: string;
      teamId: string;
    };

    try {
      reservation = await db.runTransaction(async (transaction) => {
        const snap = await transaction.get(privateDocRef!);
        if (!snap.exists) {
          throw new Error('Validation Error: Invitation record not found.');
        }

        const data = snap.data() as FirestoreTeamPrivate;

        // Rate limiting: check if account is locked out
        if (data.lockedUntil && new Date() < new Date(data.lockedUntil)) {
          throw new Error('Security Violation: Account activation is temporarily locked due to repeated failed attempts. Please try again later.');
        }

        // Check Revocation
        if (data.invitationStatus === 'REVOKED') {
          throw new Error('Validation Error: This invitation code has been revoked by an administrator.');
        }

        // Check Single-Use Redemption
        if (data.invitationRedeemed || data.invitationStatus === 'ACTIVATED') {
          throw new Error('Validation Error: This invitation code has already been redeemed and cannot be reused.');
        }

        // Concurrency protection: check if another worker is currently processing this token
        if (data.activationInProgress) {
          const lastAttempt = data.activationAttemptAt ? new Date(data.activationAttemptAt).getTime() : 0;
          // Protect for 30s window against concurrent requests
          if (Date.now() - lastAttempt < 30000) {
            throw new Error('Validation Error: This invitation code is currently being processed. Please wait a moment.');
          }
        }

        // Check Expiration
        if (data.invitationExpiresAt && new Date() > new Date(data.invitationExpiresAt)) {
          transaction.update(privateDocRef!, {
            invitationStatus: 'EXPIRED',
            updatedAt: now
          });
          throw new Error('Validation Error: This invitation code has expired. Please contact your Chief Administrator for a new invitation.');
        }

        // Check Email match (if provided)
        if (params.email && params.email.trim() !== '') {
          if (data.managerEmail?.toLowerCase() !== params.email.trim().toLowerCase()) {
            throw new Error('Validation Error: The provided email does not match the registered team manager for this invitation.');
          }
        }

        // Check TeamId match (if provided)
        if (params.teamId && data.teamId !== params.teamId) {
          throw new Error('Security Violation: Invitation token is not valid for the requested team.');
        }

        if (!data.managerUid) {
          throw new Error('Internal Server Error: No manager identity is associated with this team.');
        }

        // Atomically claim activation in-progress lock
        transaction.update(privateDocRef!, {
          activationInProgress: true,
          activationAttemptAt: now,
          updatedAt: now
        });

        return {
          managerUid: data.managerUid,
          managerEmail: data.managerEmail!,
          teamId: data.teamId
        };
      });
    } catch (phase1Err: any) {
      if (phase1Err.message?.includes('does not match the registered team manager')) {
        try {
          const freshSnap = await privateDocRef.get();
          if (freshSnap.exists) {
            const freshData = freshSnap.data() as FirestoreTeamPrivate;
            const attempts = (freshData.failedActivationAttempts || 0) + 1;
            const updatePayload: any = {
              failedActivationAttempts: attempts,
              updatedAt: new Date().toISOString()
            };
            if (attempts >= 5) {
              updatePayload.lockedUntil = new Date(Date.now() + 15 * 60 * 1000).toISOString();
            }
            await privateDocRef.update(updatePayload);
          }
        } catch (updateErr) {
          console.error('[DEBUG RATELIMIT UPDATE ERR]:', updateErr);
        }
      }
      throw phase1Err;
    }

    // Verify team is active and exists
    const teamSnap = await db.collection('teams').doc(reservation.teamId).get();
    if (!teamSnap.exists) {
      await privateDocRef.update({ activationInProgress: false, updatedAt: new Date().toISOString() });
      throw new Error('Validation Error: The delegation team no longer exists.');
    }
    const publicTeam = teamSnap.data() as FirestoreTeam;
    if (publicTeam.status === 'DISABLED') {
      await privateDocRef.update({ activationInProgress: false, updatedAt: new Date().toISOString() });
      throw new Error('Security Violation: The delegation contingent for this invitation is currently disabled.');
    }

    // PHASE 2: Firebase Auth Password Setting with Safe Failure Recovery
    try {
      await auth.updateUser(reservation.managerUid, {
        password: params.newPassword,
        disabled: false
      });
    } catch (authErr: any) {
      // Safe recovery from partial failure: release concurrency lock so the manager can safely retry
      await privateDocRef.update({
        activationInProgress: false,
        lastActivationError: authErr.message || 'Auth update failed',
        updatedAt: new Date().toISOString()
      });
      throw new Error(`Authentication Error: Failed to set password. ${authErr.message || 'Please choose a stronger password and retry.'}`);
    }

    // Optional: Generate Firebase password reset link satisfying requirement
    try {
      const appUrl = process.env.NEXT_PUBLIC_APP_URL || process.env.APP_URL || 'http://localhost:3000';
      await auth.generatePasswordResetLink(reservation.managerEmail, {
        url: `${appUrl}/team/login?onboarding=complete`,
        handleCodeInApp: false
      });
    } catch {
      // In emulator or offline, continue
    }

    // PHASE 3: Atomic Finalization & Promotion to ACTIVE
    await db.runTransaction(async (transaction) => {
      transaction.update(privateDocRef!, {
        invitationStatus: 'ACTIVATED',
        invitationRedeemed: true,
        invitationRedeemedAt: now,
        activationInProgress: false,
        failedActivationAttempts: 0,
        lockedUntil: null,
        portalAccess: true,
        updatedAt: now
      });

      const userRef = db.collection('users').doc(reservation.managerUid);
      transaction.update(userRef, {
        status: 'ACTIVE',
        disabled: false,
        updatedAt: now
      });
    });

    // Record audit log
    await db.collection('auditLogs').add({
      action: 'TEAM_MANAGER_ACTIVATED_VIA_WHATSAPP_CODE',
      teamId: reservation.teamId,
      teamName: publicTeam.name,
      managerUid: reservation.managerUid,
      managerEmail: reservation.managerEmail,
      timestamp: now
    });

    return {
      success: true,
      message: 'Account activated successfully! You may now sign in with your email and password.',
      teamId: reservation.teamId,
      managerEmail: reservation.managerEmail
    };
  }

  /**
   * Replaces an existing Team Manager with a new identity.
   * Revokes refresh tokens for the outgoing manager, demotes their account,
   * provisions the new manager in PENDING state, and generates a fresh manual WhatsApp invitation.
   */
  static async replaceTeamManager(
    adminIdToken: string,
    teamId: string,
    params: ReplaceManagerParams
  ): Promise<{
    team: CombinedTeam;
    newManagerUid: string;
    invitation: {
      code: string;
      message: string;
      whatsappUrl: string;
      expiresAt: string;
    };
  }> {
    const adminUser = await AuthService.assertAdmin(adminIdToken);

    const auth = getAdminAuth();
    const db = getAdminDb();

    if (!auth || !db) {
      throw new Error('Service Unavailable: Firebase Admin SDK not initialized.');
    }

    if (!params.newManagerEmail || params.newManagerEmail.trim() === '') {
      throw new Error('Validation Error: newManagerEmail is required.');
    }

    const teamRef = db.collection('teams').doc(teamId);
    const teamSnap = await teamRef.get();
    if (!teamSnap.exists) {
      throw new Error(`Validation Error: Team "${teamId}" does not exist.`);
    }

    const publicTeam = teamSnap.data() as FirestoreTeam;
    const privateRef = teamRef.collection('private').doc('managerInfo');
    const privateSnap = await privateRef.get();
    const currentPrivate = privateSnap.exists ? (privateSnap.data() as FirestoreTeamPrivate) : null;

    const newEmail = params.newManagerEmail.trim().toLowerCase();
    const newPhone = params.newManagerPhone?.trim() || currentPrivate?.managerPhone || '';

    // Validate email uniqueness across other teams
    const dupUserSnap = await db.collection('users').where('email', '==', newEmail).limit(1).get();
    if (!dupUserSnap.empty) {
      const existingUser = dupUserSnap.docs[0].data() as FirestoreUser;
      if (existingUser.role === 'ADMIN') {
        throw new Error(`Security Violation: User "${newEmail}" is an Administrator.`);
      }
      if (existingUser.role === 'TEAM_MANAGER' && existingUser.teamId && existingUser.teamId !== teamId) {
        throw new Error(`Validation Error: User "${newEmail}" is already assigned to team "${existingUser.teamId}".`);
      }
    }

    const now = new Date().toISOString();

    // 1. Revoke tokens and demote current manager (if exists)
    if (currentPrivate?.managerUid) {
      try {
        await auth.revokeRefreshTokens(currentPrivate.managerUid);
        await auth.setCustomUserClaims(currentPrivate.managerUid, {
          role: 'PUBLIC',
          teamId: null
        });
        await db.collection('users').doc(currentPrivate.managerUid).update({
          role: 'PUBLIC',
          teamId: null,
          disabled: true,
          status: 'DISABLED',
          updatedAt: now
        });
      } catch (revokeErr) {
        console.warn(`[TeamService] Warning revoking previous manager ${currentPrivate.managerUid}:`, revokeErr);
      }
    }

    // 2. Provision new Auth user
    let newManagerUid = '';
    let isNewlyCreatedAuth = false;

    try {
      try {
        const existingAuth = await auth.getUserByEmail(newEmail);
        newManagerUid = existingAuth.uid;

        if (existingAuth.customClaims?.role === 'ADMIN') {
          throw new Error(`Security Violation: User "${newEmail}" is an Administrator.`);
        }
      } catch (authLookupErr: any) {
        if (authLookupErr.code === 'auth/user-not-found') {
          const randomSecret = crypto.randomBytes(24).toString('base64url');
          const created = await auth.createUser({
            email: newEmail,
            password: randomSecret,
            displayName: params.newManagerName?.trim() || `${publicTeam.name} Manager`,
            disabled: false
          });
          newManagerUid = created.uid;
          isNewlyCreatedAuth = true;
        } else {
          throw authLookupErr;
        }
      }

      // 3. Assign Custom Claims
      await auth.setCustomUserClaims(newManagerUid, {
        role: 'TEAM_MANAGER',
        teamId
      });

      // 4. Write authoritative user document with status: 'PENDING'
      const userDoc: FirestoreUser = {
        id: newManagerUid,
        email: newEmail,
        displayName: params.newManagerName?.trim() || `${publicTeam.name} Manager`,
        role: 'TEAM_MANAGER',
        teamId,
        status: 'PENDING',
        disabled: false,
        createdAt: now,
        updatedAt: now
      };
      await db.collection('users').doc(newManagerUid).set(userDoc);

      // 5. Generate fresh WhatsApp invitation package
      const invitationPackage = InvitationService.createInvitationPackage({
        teamName: publicTeam.name,
        managerEmail: newEmail,
        managerPhone: newPhone,
        appUrl: params.appUrl,
        teamId
      });

      // 6. Update private managerInfo
      const updatedPrivate: FirestoreTeamPrivate = {
        teamId,
        managerUid: newManagerUid,
        managerName: params.newManagerName?.trim() || `${publicTeam.name} Manager`,
        managerEmail: newEmail,
        managerPhone: newPhone,
        portalAccess: false,
        provisioningStatus: 'PROVISIONED',
        invitationStatus: 'READY_TO_SEND',
        invitationTokenHash: invitationPackage.tokenHash,
        invitationExpiresAt: invitationPackage.expiresAt,
        invitationCreatedAt: now,
        invitationRedeemed: false,
        createdAt: currentPrivate?.createdAt || now,
        updatedAt: now
      };
      await privateRef.set(updatedPrivate);

      // Touch public team updatedAt
      await teamRef.update({ updatedAt: now });

      await db.collection('auditLogs').add({
        action: 'TEAM_MANAGER_REPLACED',
        teamId,
        teamName: publicTeam.name,
        previousManagerUid: currentPrivate?.managerUid || null,
        previousManagerEmail: currentPrivate?.managerEmail || null,
        newManagerUid,
        newManagerEmail: newEmail,
        invitationStatus: 'READY_TO_SEND',
        performedBy: adminUser.email,
        performedByUid: adminUser.uid,
        timestamp: now
      });

      return {
        team: {
          ...publicTeam,
          ...updatedPrivate,
          updatedAt: now
        },
        newManagerUid,
        invitation: {
          code: invitationPackage.code,
          message: invitationPackage.message,
          whatsappUrl: invitationPackage.whatsappUrl,
          expiresAt: invitationPackage.expiresAt
        }
      };
    } catch (err) {
      if (isNewlyCreatedAuth && newManagerUid) {
        await auth.deleteUser(newManagerUid).catch(() => {});
      }
      throw err;
    }
  }

  /**
   * Enables or disables a team contingent and updates the associated manager account accordingly.
   */
  static async setTeamStatus(
    adminIdToken: string,
    teamId: string,
    enabled: boolean
  ): Promise<CombinedTeam> {
    const adminUser = await AuthService.assertAdmin(adminIdToken);

    const auth = getAdminAuth();
    const db = getAdminDb();

    if (!auth || !db) {
      throw new Error('Service Unavailable: Firebase Admin SDK not initialized.');
    }

    const teamRef = db.collection('teams').doc(teamId);
    const snap = await teamRef.get();
    if (!snap.exists) {
      throw new Error(`Validation Error: Team "${teamId}" does not exist.`);
    }

    const publicTeam = snap.data() as FirestoreTeam;
    const privateRef = teamRef.collection('private').doc('managerInfo');
    const privateSnap = await privateRef.get();
    const privateData = privateSnap.exists ? (privateSnap.data() as FirestoreTeamPrivate) : null;

    const now = new Date().toISOString();
    const newStatus = enabled ? 'ACTIVE' : 'DISABLED';

    // 1. Update public team status
    await teamRef.update({
      status: newStatus,
      updatedAt: now
    });

    // 2. Update private manager info
    if (privateData) {
      await privateRef.update({
        portalAccess: enabled,
        updatedAt: now
      });

      // If manager exists, toggle Auth user status and revoke tokens
      if (privateData.managerUid) {
        try {
          await auth.updateUser(privateData.managerUid, { disabled: !enabled });
          if (!enabled) {
            await auth.revokeRefreshTokens(privateData.managerUid);
          }
          // Synchronize user status correctly:
          // If disabled: 'DISABLED'
          // If enabled: promote to 'ACTIVE' ONLY if invitation has been ACTIVATED; otherwise keep 'PENDING'
          const targetUserStatus = enabled
            ? (privateData.invitationStatus === 'ACTIVATED' ? 'ACTIVE' : 'PENDING')
            : 'DISABLED';

          await db.collection('users').doc(privateData.managerUid).update({
            status: targetUserStatus,
            disabled: !enabled,
            updatedAt: now
          });
        } catch (managerErr) {
          console.warn(`[TeamService] Warning updating manager status for ${privateData.managerUid}:`, managerErr);
        }
      }
    }

    await db.collection('auditLogs').add({
      action: enabled ? 'TEAM_ENABLED' : 'TEAM_DISABLED',
      teamId,
      teamName: publicTeam.name,
      performedBy: adminUser.email,
      performedByUid: adminUser.uid,
      timestamp: now
    });

    return {
      ...publicTeam,
      status: newStatus,
      portalAccess: enabled,
      managerUid: privateData?.managerUid,
      managerName: privateData?.managerName,
      managerEmail: privateData?.managerEmail,
      managerPhone: privateData?.managerPhone,
      invitationStatus: privateData?.invitationStatus,
      updatedAt: now
    };
  }

  /**
   * Updates basic team metadata (name, code, color, zone, managerName, managerPhone).
   */
  static async updateTeamInfo(
    adminIdToken: string,
    teamId: string,
    updates: Partial<Pick<CombinedTeam, 'name' | 'code' | 'color' | 'zone' | 'managerName' | 'managerPhone'>>
  ): Promise<CombinedTeam> {
    const adminUser = await AuthService.assertAdmin(adminIdToken);

    const db = getAdminDb();
    if (!db) {
      throw new Error('Service Unavailable: Firebase Admin SDK not initialized.');
    }

    const teamRef = db.collection('teams').doc(teamId);
    const snap = await teamRef.get();
    if (!snap.exists) {
      throw new Error(`Validation Error: Team "${teamId}" does not exist.`);
    }

    const currentPublic = snap.data() as FirestoreTeam;
    const privateRef = teamRef.collection('private').doc('managerInfo');
    const privateSnap = await privateRef.get();
    const currentPrivate = privateSnap.exists ? (privateSnap.data() as FirestoreTeamPrivate) : null;

    const now = new Date().toISOString();

    const updatedPublic: FirestoreTeam = {
      ...currentPublic,
      ...(updates.name ? { name: updates.name.trim() } : {}),
      ...(updates.code ? { code: updates.code.trim().toUpperCase() } : {}),
      ...(updates.color ? { color: updates.color } : {}),
      ...(updates.zone ? { zone: updates.zone.trim() } : {}),
      updatedAt: now
    };

    await teamRef.set(updatedPublic);

    if (currentPrivate && (updates.managerName || updates.managerPhone)) {
      const updatedPrivate: FirestoreTeamPrivate = {
        ...currentPrivate,
        ...(updates.managerName ? { managerName: updates.managerName.trim() } : {}),
        ...(updates.managerPhone ? { managerPhone: updates.managerPhone.trim() } : {}),
        updatedAt: now
      };
      await privateRef.set(updatedPrivate);
    }

    await db.collection('auditLogs').add({
      action: 'TEAM_UPDATED',
      teamId,
      teamName: updatedPublic.name,
      performedBy: adminUser.email,
      performedByUid: adminUser.uid,
      timestamp: now
    });

    return {
      ...updatedPublic,
      ...(currentPrivate || {}),
      updatedAt: now
    };
  }

  /**
   * Retrieves all teams from Firestore.
   * If adminIdToken is provided, merges private manager & onboarding details.
   */
  static async listTeams(adminIdToken?: string): Promise<CombinedTeam[]> {
    const db = getAdminDb();
    if (!db) return [];

    let isAdminCaller = false;
    if (adminIdToken) {
      try {
        await AuthService.assertAdmin(adminIdToken);
        isAdminCaller = true;
      } catch {
        isAdminCaller = false;
      }
    }

    const snap = await db.collection('teams').get();
    const teams: CombinedTeam[] = [];

    for (const doc of snap.docs) {
      const publicData = doc.data() as FirestoreTeam;
      let privateData: Partial<FirestoreTeamPrivate> = {};

      if (isAdminCaller) {
        try {
          const privSnap = await doc.ref.collection('private').doc('managerInfo').get();
          if (privSnap.exists) {
            privateData = privSnap.data() as FirestoreTeamPrivate;
          }
        } catch {}
      }

      teams.push({
        ...publicData,
        managerName: privateData.managerName || '',
        managerEmail: privateData.managerEmail || '',
        managerPhone: privateData.managerPhone || '',
        managerUid: privateData.managerUid,
        portalAccess: privateData.portalAccess !== false,
        provisioningStatus: privateData.provisioningStatus || (privateData.managerEmail ? 'PROVISIONED' : 'AWAITING_MANAGER'),
        invitationStatus: privateData.invitationStatus || 'PENDING',
        invitationExpiresAt: privateData.invitationExpiresAt,
        invitationSentAt: privateData.invitationSentAt
      });
    }

    return teams;
  }

  /**
   * Retrieves a single team by ID.
   */
  static async getTeam(teamId: string, adminIdToken?: string): Promise<CombinedTeam | null> {
    const db = getAdminDb();
    if (!db) return null;

    let isAdminCaller = false;
    if (adminIdToken) {
      try {
        await AuthService.assertAdmin(adminIdToken);
        isAdminCaller = true;
      } catch {
        isAdminCaller = false;
      }
    }

    const doc = await db.collection('teams').doc(teamId).get();
    if (!doc.exists) return null;

    const publicData = doc.data() as FirestoreTeam;
    let privateData: Partial<FirestoreTeamPrivate> = {};

    if (isAdminCaller) {
      try {
        const privSnap = await doc.ref.collection('private').doc('managerInfo').get();
        if (privSnap.exists) {
          privateData = privSnap.data() as FirestoreTeamPrivate;
        }
      } catch {}
    }

    return {
      ...publicData,
      managerName: privateData.managerName || '',
      managerEmail: privateData.managerEmail || '',
      managerPhone: privateData.managerPhone || '',
      managerUid: privateData.managerUid,
      portalAccess: privateData.portalAccess !== false,
      provisioningStatus: privateData.provisioningStatus || (privateData.managerEmail ? 'PROVISIONED' : 'AWAITING_MANAGER'),
      invitationStatus: privateData.invitationStatus || 'PENDING',
      invitationExpiresAt: privateData.invitationExpiresAt,
      invitationSentAt: privateData.invitationSentAt
    };
  }
}
