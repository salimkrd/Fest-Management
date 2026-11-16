import { describe, it, expect, beforeEach, vi } from 'vitest';
import { NextRequest } from 'next/server';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import nextConfig from '../../next.config';
import { UNIFIED_STAFF_LOGIN_ROUTE, buildStaffLoginUrl } from '@/lib/authRoutes';
import { UnifiedAuthService } from '@/services/unifiedAuthService';
import { POST as staffLoginApi } from '@/app/api/auth/staff-login/route';
import { AuthService } from '@/services/authService';

const source = (relPath: string) => readFileSync(resolve(process.cwd(), relPath), 'utf8');

// In-memory mock database and mock auth for high-speed, isolated unit verification
const store = new Map<string, Record<string, unknown>>();
const mockCustomClaims = new Map<string, Record<string, unknown>>();
let throwOnPrivateDoc = false;
let throwOnPublicTeamDoc = false;

const createDocRef = (docPath: string, docId: string) => ({
  id: docId,
  get: async () => {
    if (throwOnPrivateDoc && docPath.includes('private/managerInfo')) {
      throw new Error('Simulated Firestore private manager lookup failure');
    }
    if (throwOnPublicTeamDoc && docPath.startsWith('teams/') && !docPath.includes('private')) {
      throw new Error('Simulated Firestore public team lookup failure');
    }
    const data = store.get(docPath);
    return {
      id: docId,
      exists: !!data,
      data: () => data,
    };
  },
  set: async (val: Record<string, unknown>) => {
    store.set(docPath, val);
  },
  collection: (subCol: string) => ({
    doc: (subDocId: string) => createDocRef(`${docPath}/${subCol}/${subDocId}`, subDocId),
  }),
});

const mockAdminDb = {
  collection: (col: string) => ({
    doc: (docId: string) => createDocRef(`${col}/${docId}`, docId),
  }),
};

const mockAdminAuth = {
  verifyIdToken: vi.fn(async (token: string) => {
    if (token === 'invalid-token' || token === 'expired-token') {
      throw new Error('Firebase ID token has expired or is invalid.');
    }
    const decoded = JSON.parse(token);
    const existingClaims = mockCustomClaims.get(decoded.uid) || {};
    return {
      uid: decoded.uid,
      email: decoded.email || 'user@fest.org',
      role: existingClaims.role || decoded.role || 'PUBLIC',
      teamId: existingClaims.teamId || decoded.teamId,
      ...decoded,
      ...existingClaims,
    };
  }),
  setCustomUserClaims: vi.fn(async (uid: string, claims: Record<string, unknown>) => {
    mockCustomClaims.set(uid, claims);
  }),
};

vi.mock('@/lib/firebase/admin', () => ({
  getAdminAuth: () => mockAdminAuth,
  getAdminDb: () => mockAdminDb,
  syncWorkloadIdentityToken: vi.fn().mockResolvedValue(null),
}));

describe('Unified Staff Login System', () => {
  beforeEach(() => {
    store.clear();
    mockCustomClaims.clear();
    throwOnPrivateDoc = false;
    throwOnPublicTeamDoc = false;
    vi.clearAllMocks();
  });

  describe('1. Successful Role-Based Authentication & Redirection', () => {
    it('authenticates ADMIN and routes to /admin', async () => {
      const uid = 'admin-uid-1';
      store.set(`users/${uid}`, {
        uid,
        email: 'chief.admin@fest.org',
        role: 'ADMIN',
        status: 'ACTIVE',
        disabled: false,
      });
      mockCustomClaims.set(uid, { role: 'ADMIN' });

      const token = JSON.stringify({ uid, email: 'chief.admin@fest.org', role: 'ADMIN' });
      const result = await UnifiedAuthService.verifyStaffLogin(token);

      expect(result.status).toBe('SUCCESS');
      if (result.status === 'SUCCESS') {
        expect(result.role).toBe('ADMIN');
        expect(result.redirectUrl).toBe('/admin');
        expect(result.email).toBe('chief.admin@fest.org');
        expect(result.team).toBeUndefined();
      }
    });

    it('authenticates GREEN_ROOM_STAFF and routes to /admin/green-room', async () => {
      const uid = 'green-room-uid-1';
      store.set(`users/${uid}`, {
        uid,
        email: 'staff.greenroom@fest.org',
        role: 'GREEN_ROOM_STAFF',
        status: 'ACTIVE',
        disabled: false,
      });
      mockCustomClaims.set(uid, { role: 'GREEN_ROOM_STAFF' });

      const token = JSON.stringify({ uid, email: 'staff.greenroom@fest.org', role: 'GREEN_ROOM_STAFF' });
      const result = await UnifiedAuthService.verifyStaffLogin(token);

      expect(result.status).toBe('SUCCESS');
      if (result.status === 'SUCCESS') {
        expect(result.role).toBe('GREEN_ROOM_STAFF');
        expect(result.redirectUrl).toBe('/admin/green-room');
        expect(result.team).toBeUndefined();
      }
    });

    it('authenticates TEAM_MANAGER verifying BOTH public team and private managerInfo documents', async () => {
      const uid = 'manager-uid-1';
      const teamId = 'team-alpha';

      // 1. Authoritative user record
      store.set(`users/${uid}`, {
        uid,
        email: 'manager.alpha@fest.org',
        role: 'TEAM_MANAGER',
        teamId,
        status: 'ACTIVE',
        disabled: false,
      });

      // 2. Public team record (/teams/{teamId})
      store.set(`teams/${teamId}`, {
        id: teamId,
        name: 'House Alpha',
        code: 'HA',
        color: '#DC2626',
        zone: 'Zone 1',
        status: 'ACTIVE',
      });

      // 3. Private manager record (/teams/{teamId}/private/managerInfo)
      store.set(`teams/${teamId}/private/managerInfo`, {
        teamId,
        managerUid: uid,
        managerName: 'Alpha Manager',
        managerEmail: 'manager.alpha@fest.org',
        managerPhone: '+919876543210',
        portalAccess: true,
        provisioningStatus: 'PROVISIONED',
        invitationStatus: 'ACTIVATED',
      });

      mockCustomClaims.set(uid, { role: 'TEAM_MANAGER', teamId });

      const token = JSON.stringify({ uid, email: 'manager.alpha@fest.org', role: 'TEAM_MANAGER', teamId });
      const result = await UnifiedAuthService.verifyStaffLogin(token);

      expect(result.status).toBe('SUCCESS');
      if (result.status === 'SUCCESS') {
        expect(result.role).toBe('TEAM_MANAGER');
        expect(result.redirectUrl).toBe('/team');
        expect(result.team).toBeDefined();
        expect(result.team?.id).toBe(teamId);
        expect(result.team?.name).toBe('House Alpha');
        expect(result.team?.managerUid).toBe(uid);
        expect(result.team?.portalAccess).toBe(true);
        expect(result.team?.status).toBe('ACTIVE');
        expect(result.team?.managerName).toBe('Alpha Manager');
        expect(result.team?.managerEmail).toBe('manager.alpha@fest.org');
      }
    });

    it('automatically synchronizes custom claims when token is missing role and requests client refresh', async () => {
      const uid = 'manager-uid-synctest';
      const teamId = 'team-beta';

      store.set(`users/${uid}`, {
        uid,
        email: 'manager.beta@fest.org',
        role: 'TEAM_MANAGER',
        teamId,
        status: 'ACTIVE',
        disabled: false,
      });

      // Token has no custom claims yet
      const token = JSON.stringify({ uid, email: 'manager.beta@fest.org' });
      const result = await UnifiedAuthService.verifyStaffLogin(token);

      expect(result.status).toBe('NEEDS_REFRESH');
      expect(mockAdminAuth.setCustomUserClaims).toHaveBeenCalledWith(uid, {
        role: 'TEAM_MANAGER',
        teamId,
      });
    });
  });

  describe('2. Unauthorized Access & Security Boundary Checks', () => {
    it('strictly forbids JUDGE accounts from authenticating through staff login', async () => {
      const uid = 'judge-uid-1';
      store.set(`users/${uid}`, {
        uid,
        email: 'juror@fest.org',
        role: 'JUDGE',
        status: 'ACTIVE',
        disabled: false,
      });
      mockCustomClaims.set(uid, { role: 'JUDGE' });

      const token = JSON.stringify({ uid, role: 'JUDGE' });
      await expect(UnifiedAuthService.verifyStaffLogin(token)).rejects.toThrow(
        /Judges must sign in using their Juror Access Code/i
      );
    });

    it('strictly rejects PUBLIC and PARTICIPANT roles', async () => {
      const uid = 'public-user-1';
      store.set(`users/${uid}`, {
        uid,
        email: 'public@fest.org',
        role: 'PUBLIC',
        status: 'ACTIVE',
      });
      mockCustomClaims.set(uid, { role: 'PUBLIC' });

      const token = JSON.stringify({ uid, role: 'PUBLIC' });
      await expect(UnifiedAuthService.verifyStaffLogin(token)).rejects.toThrow(
        /does not possess staff/i
      );
    });

    it('rejects disabled accounts', async () => {
      const uid = 'disabled-admin';
      store.set(`users/${uid}`, {
        uid,
        role: 'ADMIN',
        status: 'ACTIVE',
        disabled: true,
      });
      mockCustomClaims.set(uid, { role: 'ADMIN' });

      const token = JSON.stringify({ uid, role: 'ADMIN' });
      await expect(UnifiedAuthService.verifyStaffLogin(token)).rejects.toThrow(/disabled/i);
    });

    it('rejects inactive or pending accounts', async () => {
      const uid = 'pending-manager';
      store.set(`users/${uid}`, {
        uid,
        role: 'TEAM_MANAGER',
        teamId: 'team-1',
        status: 'PENDING',
        disabled: false,
      });
      mockCustomClaims.set(uid, { role: 'TEAM_MANAGER', teamId: 'team-1' });

      const token = JSON.stringify({ uid, role: 'TEAM_MANAGER', teamId: 'team-1' });
      await expect(UnifiedAuthService.verifyStaffLogin(token)).rejects.toThrow(/pending activation/i);
    });

    it('rejects accounts with missing authoritative Firestore records', async () => {
      const uid = 'ghost-user';
      mockCustomClaims.set(uid, { role: 'ADMIN' });

      const token = JSON.stringify({ uid, role: 'ADMIN' });
      await expect(UnifiedAuthService.verifyStaffLogin(token)).rejects.toThrow(
        /Authoritative user profile not found/i
      );
    });

    it('rejects TEAM_MANAGER accounts with missing teamId in Firestore', async () => {
      const uid = 'manager-no-team';
      store.set(`users/${uid}`, {
        uid,
        role: 'TEAM_MANAGER',
        status: 'ACTIVE',
        disabled: false,
      });
      mockCustomClaims.set(uid, { role: 'TEAM_MANAGER' });

      const token = JSON.stringify({ uid, role: 'TEAM_MANAGER' });
      await expect(UnifiedAuthService.verifyStaffLogin(token)).rejects.toThrow(
        /missing mandatory team assignment/i
      );
    });

    it('fails closed when token verification throws (expired/malformed token)', async () => {
      await expect(UnifiedAuthService.verifyStaffLogin('invalid-token')).rejects.toThrow(
        /Invalid or expired authentication session/i
      );
    });

    it('fails closed when token is empty or missing', async () => {
      await expect(UnifiedAuthService.verifyStaffLogin('')).rejects.toThrow(
        /Missing or invalid authentication token/i
      );
    });
  });

  describe('3. Team Manager Private Record & Dual-Document Security Gating', () => {
    const uid = 'manager-audit-uid';
    const teamId = 'team-audit-1';

    const setupBaseTeamManager = () => {
      store.set(`users/${uid}`, {
        uid,
        email: 'manager.audit@fest.org',
        role: 'TEAM_MANAGER',
        teamId,
        status: 'ACTIVE',
        disabled: false,
      });
      mockCustomClaims.set(uid, { role: 'TEAM_MANAGER', teamId });
    };

    it('fails closed when public team record does not exist in Firestore', async () => {
      setupBaseTeamManager();
      // Neither public nor private document exists
      const token = JSON.stringify({ uid, role: 'TEAM_MANAGER', teamId });
      await expect(UnifiedAuthService.verifyStaffLogin(token)).rejects.toThrow(
        /Assigned team contingent record not found/i
      );
    });

    it('fails closed when public team status is DISABLED', async () => {
      setupBaseTeamManager();
      store.set(`teams/${teamId}`, {
        name: 'Audit House',
        status: 'DISABLED',
      });
      store.set(`teams/${teamId}/private/managerInfo`, {
        teamId,
        managerUid: uid,
        portalAccess: true,
      });

      const token = JSON.stringify({ uid, role: 'TEAM_MANAGER', teamId });
      await expect(UnifiedAuthService.verifyStaffLogin(token)).rejects.toThrow(
        /Team contingent is not currently active/i
      );
    });

    it('fails closed when public team status is missing or anything other than ACTIVE', async () => {
      setupBaseTeamManager();
      // Status is PENDING instead of ACTIVE
      store.set(`teams/${teamId}`, {
        name: 'Audit House',
        status: 'PENDING',
      });
      store.set(`teams/${teamId}/private/managerInfo`, {
        teamId,
        managerUid: uid,
        portalAccess: true,
      });

      const token = JSON.stringify({ uid, role: 'TEAM_MANAGER', teamId });
      await expect(UnifiedAuthService.verifyStaffLogin(token)).rejects.toThrow(
        /Team contingent is not currently active/i
      );

      // Status completely missing
      store.set(`teams/${teamId}`, {
        name: 'Audit House',
      });
      await expect(UnifiedAuthService.verifyStaffLogin(token)).rejects.toThrow(
        /Team contingent is not currently active/i
      );
    });

    it('fails closed when private managerInfo document is completely missing', async () => {
      setupBaseTeamManager();
      store.set(`teams/${teamId}`, {
        name: 'Audit House',
        status: 'ACTIVE',
      });
      // Do NOT set teams/{teamId}/private/managerInfo

      const token = JSON.stringify({ uid, role: 'TEAM_MANAGER', teamId });
      await expect(UnifiedAuthService.verifyStaffLogin(token)).rejects.toThrow(
        /Authoritative team manager onboarding record not found/i
      );
    });

    it('fails closed when private managerInfo is missing managerUid', async () => {
      setupBaseTeamManager();
      store.set(`teams/${teamId}`, {
        name: 'Audit House',
        status: 'ACTIVE',
      });
      store.set(`teams/${teamId}/private/managerInfo`, {
        teamId,
        // managerUid omitted
        portalAccess: true,
      });

      const token = JSON.stringify({ uid, role: 'TEAM_MANAGER', teamId });
      await expect(UnifiedAuthService.verifyStaffLogin(token)).rejects.toThrow(
        /You are not the officially assigned manager/i
      );
    });

    it('fails closed when managerUid belongs to another user (replaced/previous manager lockout)', async () => {
      setupBaseTeamManager();
      store.set(`teams/${teamId}`, {
        name: 'Audit House',
        status: 'ACTIVE',
      });
      // A replaced manager: private record points to 'outgoing-manager-uid' instead of 'manager-audit-uid'
      store.set(`teams/${teamId}/private/managerInfo`, {
        teamId,
        managerUid: 'different-manager-uid',
        portalAccess: true,
      });

      const token = JSON.stringify({ uid, role: 'TEAM_MANAGER', teamId });
      await expect(UnifiedAuthService.verifyStaffLogin(token)).rejects.toThrow(
        /You are not the officially assigned manager/i
      );
    });

    it('fails closed when private managerInfo teamId mismatches assigned teamId', async () => {
      setupBaseTeamManager();
      store.set(`teams/${teamId}`, {
        name: 'Audit House',
        status: 'ACTIVE',
      });
      store.set(`teams/${teamId}/private/managerInfo`, {
        teamId: 'wrong-team-id',
        managerUid: uid,
        portalAccess: true,
      });

      const token = JSON.stringify({ uid, role: 'TEAM_MANAGER', teamId });
      await expect(UnifiedAuthService.verifyStaffLogin(token)).rejects.toThrow(
        /Private manager record team assignment mismatch/i
      );
    });

    it('fails closed when private managerInfo portalAccess is false', async () => {
      setupBaseTeamManager();
      store.set(`teams/${teamId}`, {
        name: 'Audit House',
        status: 'ACTIVE',
      });
      store.set(`teams/${teamId}/private/managerInfo`, {
        teamId,
        managerUid: uid,
        portalAccess: false,
      });

      const token = JSON.stringify({ uid, role: 'TEAM_MANAGER', teamId });
      await expect(UnifiedAuthService.verifyStaffLogin(token)).rejects.toThrow(
        /portal access has been disabled/i
      );
    });

    it('fails closed when private managerInfo portalAccess is missing/undefined', async () => {
      setupBaseTeamManager();
      store.set(`teams/${teamId}`, {
        name: 'Audit House',
        status: 'ACTIVE',
      });
      store.set(`teams/${teamId}/private/managerInfo`, {
        teamId,
        managerUid: uid,
        // portalAccess omitted
      });

      const token = JSON.stringify({ uid, role: 'TEAM_MANAGER', teamId });
      await expect(UnifiedAuthService.verifyStaffLogin(token)).rejects.toThrow(
        /portal access has been disabled/i
      );
    });

    it('fails closed when private Firestore lookup throws a system or network error', async () => {
      setupBaseTeamManager();
      store.set(`teams/${teamId}`, {
        name: 'Audit House',
        status: 'ACTIVE',
      });
      throwOnPrivateDoc = true;

      const token = JSON.stringify({ uid, role: 'TEAM_MANAGER', teamId });
      await expect(UnifiedAuthService.verifyStaffLogin(token)).rejects.toThrow(
        /Unable to verify private manager authorization/i
      );
    });

    it('fails closed when public team Firestore lookup throws a system or network error', async () => {
      setupBaseTeamManager();
      throwOnPublicTeamDoc = true;

      const token = JSON.stringify({ uid, role: 'TEAM_MANAGER', teamId });
      await expect(UnifiedAuthService.verifyStaffLogin(token)).rejects.toThrow(
        /Unable to verify team status/i
      );
    });
  });

  describe('4. Staff Login API Endpoint (/api/auth/staff-login)', () => {
    it('returns 401 when Authorization header is missing', async () => {
      const req = new NextRequest('http://localhost:3000/api/auth/staff-login', {
        method: 'POST',
      });
      const res = await staffLoginApi(req);
      expect(res.status).toBe(401);
      const data = await res.json();
      expect(data.error).toMatch(/Missing authentication token/i);
    });

    it('returns 200 with role and redirectUrl upon valid admin verification', async () => {
      const uid = 'api-admin-uid';
      store.set(`users/${uid}`, {
        uid,
        email: 'admin@fest.org',
        role: 'ADMIN',
        status: 'ACTIVE',
        disabled: false,
      });
      mockCustomClaims.set(uid, { role: 'ADMIN' });

      const token = JSON.stringify({ uid, role: 'ADMIN' });
      const req = new NextRequest('http://localhost:3000/api/auth/staff-login', {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
      });
      const res = await staffLoginApi(req);
      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.success).toBe(true);
      expect(data.role).toBe('ADMIN');
      expect(data.redirectUrl).toBe('/admin');
    });

    it('returns 403 when a non-staff user attempts to access staff login API', async () => {
      const uid = 'api-judge-uid';
      store.set(`users/${uid}`, {
        uid,
        role: 'JUDGE',
        status: 'ACTIVE',
      });
      mockCustomClaims.set(uid, { role: 'JUDGE' });

      const token = JSON.stringify({ uid, role: 'JUDGE' });
      const req = new NextRequest('http://localhost:3000/api/auth/staff-login', {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
      });
      const res = await staffLoginApi(req);
      expect(res.status).toBe(403);
      const data = await res.json();
      expect(data.error).toMatch(/Judges must sign in using their Juror Access Code/i);
    });
  });

  describe('5. Legacy Route Retirement & Safe Redirections', () => {
    it('configures next.config.ts to redirect /admin/login to unified staff login', async () => {
      const redirects = await nextConfig.redirects?.();
      expect(redirects).toContainEqual({
        source: '/admin/login',
        destination: UNIFIED_STAFF_LOGIN_ROUTE,
        permanent: false,
      });
    });

    it('configures next.config.ts to redirect /team/login to unified staff login', async () => {
      const redirects = await nextConfig.redirects?.();
      expect(redirects).toContainEqual({
        source: '/team/login',
        destination: UNIFIED_STAFF_LOGIN_ROUTE,
        permanent: false,
      });
    });

    it('configures next.config.ts to redirect /management to unified staff login', async () => {
      const redirects = await nextConfig.redirects?.();
      expect(redirects).toContainEqual({
        source: '/management',
        destination: UNIFIED_STAFF_LOGIN_ROUTE,
        permanent: false,
      });
    });

    it('buildStaffLoginUrl helper correctly preserves query parameters', () => {
      const urlWithParams = buildStaffLoginUrl({
        email: 'manager@fest.org',
        onboarding: 'complete',
      });
      expect(urlWithParams).toBe(
        `${UNIFIED_STAFF_LOGIN_ROUTE}?email=manager%40fest.org&onboarding=complete`
      );

      const urlWithDisabled = buildStaffLoginUrl({ error: 'disabled' });
      expect(urlWithDisabled).toBe(`${UNIFIED_STAFF_LOGIN_ROUTE}?error=disabled`);

      const plainUrl = buildStaffLoginUrl();
      expect(plainUrl).toBe(UNIFIED_STAFF_LOGIN_ROUTE);
    });

    it('verifies that retired page components invoke server redirect with preserved parameters', () => {
      const adminLoginSource = source('src/app/admin/login/page.tsx');
      expect(adminLoginSource).toContain('redirect(');
      expect(adminLoginSource).toContain('buildStaffLoginUrl');
      expect(adminLoginSource).not.toContain('<form');

      const teamLoginSource = source('src/app/team/login/page.tsx');
      expect(teamLoginSource).toContain('redirect(');
      expect(teamLoginSource).toContain('buildStaffLoginUrl');
      expect(teamLoginSource).not.toContain('<form');

      const managementSource = source('src/app/management/page.tsx');
      expect(managementSource).toContain('redirect(');
      expect(managementSource).toContain('buildStaffLoginUrl');
      expect(managementSource).not.toContain('Management System');
    });

    it('confirms the unified staff login page has noindex/nofollow metadata and is in robots.txt', () => {
      const layoutSource = source(`src/app/x/${UNIFIED_STAFF_LOGIN_ROUTE.split('/')[2]}/layout.tsx`);
      expect(layoutSource).toContain('index: false');
      expect(layoutSource).toContain('follow: false');

      const robotsSource = source('src/app/robots.ts');
      expect(robotsSource).toContain("'/x/'");
    });
  });

  describe('6. Design System & UI Architecture Compliance', () => {
    it('uses the public Ruby/Crimson/Gold/Espresso/Ivory palette in staff-login.css', () => {
      const styles = source(`src/app/x/${UNIFIED_STAFF_LOGIN_ROUTE.split('/')[2]}/staff-login.css`);
      expect(styles).toContain('#4A0A1C'); // Ruby
      expect(styles).toContain('#86152C'); // Mid Ruby
      expect(styles).toContain('#BA1912'); // Crimson
      expect(styles).toContain('#FDBF0F'); // Gold
      expect(styles).toContain('#FFF8EE'); // Ivory
      expect(styles).toContain('#1B090B'); // Espresso
      expect(styles).toContain("font-family: 'Sora', sans-serif");
      expect(styles).toContain('.staff-login');
    });

    it('renders Email, Password with Show/Hide toggle, submit button with loading state, and no role buttons', () => {
      const pageSource = source(`src/app/x/${UNIFIED_STAFF_LOGIN_ROUTE.split('/')[2]}/page.tsx`);
      expect(pageSource).toContain('id="staff-email"');
      expect(pageSource).toContain('id="staff-password"');
      expect(pageSource).toContain('showPassword');
      expect(pageSource).toContain('setShowPassword');
      expect(pageSource).toContain('staff-login__toggle-pw');
      expect(pageSource).toContain('Verifying Credentials');
      expect(pageSource).toContain('role="alert"');

      // Crucial: no Admin or Team Manager selection buttons
      expect(pageSource).not.toContain('Admin Login');
      expect(pageSource).not.toContain('Team Manager Login');
      expect(pageSource).not.toContain('Select Role');
    });

    it('provides mobile-responsive breakpoint rules in CSS', () => {
      const styles = source(`src/app/x/${UNIFIED_STAFF_LOGIN_ROUTE.split('/')[2]}/staff-login.css`);
      expect(styles).toContain('@media (max-width: 960px)');
      expect(styles).toContain('@media (max-width: 640px)');
      expect(styles).toContain('@media (prefers-reduced-motion: reduce)');
    });
  });

  describe('7. Regression & Cross-System Protection', () => {
    it('preserves dedicated Judge login route and juror credential architecture', () => {
      const judgePageSource = source('src/app/judge/login/page.tsx');
      expect(judgePageSource).toContain('Juror Access Code');
      expect(judgePageSource).toContain('PIN');
      expect(judgePageSource).toContain('/api/judge/login');
    });

    it('preserves dedicated Participant login route and Bib+DOB architecture', () => {
      const participantPageSource = source('src/app/participant/login/page.tsx');
      expect(participantPageSource).toContain('bib');
      expect(participantPageSource).toContain('dob');
      expect(participantPageSource).toContain('/api/participant/login');
    });

    it('enforces AdminLayout redirects to UNIFIED_STAFF_LOGIN_ROUTE on unauthorized or sign-out', () => {
      const adminLayoutSource = source('src/components/layout/AdminLayout.tsx');
      expect(adminLayoutSource).toContain('UNIFIED_STAFF_LOGIN_ROUTE');
      expect(adminLayoutSource).not.toContain("'/admin/login'");
    });

    it('enforces TeamLayout redirects to UNIFIED_STAFF_LOGIN_ROUTE on unauthorized or sign-out', () => {
      const teamLayoutSource = source('src/components/layout/TeamLayout.tsx');
      expect(teamLayoutSource).toContain('UNIFIED_STAFF_LOGIN_ROUTE');
      expect(teamLayoutSource).not.toContain("'/team/login'");
    });

    it('enforces team isolation via AuthService.assertTeamManager', async () => {
      const uid = 'manager-iso-1';
      store.set(`users/${uid}`, {
        uid,
        role: 'TEAM_MANAGER',
        teamId: 'team-a',
        status: 'ACTIVE',
        disabled: false,
      });
      mockCustomClaims.set(uid, { role: 'TEAM_MANAGER', teamId: 'team-a' });

      const token = JSON.stringify({ uid, role: 'TEAM_MANAGER', teamId: 'team-a' });

      // Authorized for team-a
      const verified = await AuthService.assertTeamManager(token, 'team-a');
      expect(verified.teamId).toBe('team-a');

      // Unauthorized for team-b (cross-team access denied)
      await expect(AuthService.assertTeamManager(token, 'team-b')).rejects.toThrow(
        /Cross-team access denied/i
      );
    });

    it('enforces privilege escalation prevention via AuthService.assertAdmin', async () => {
      const uid = 'manager-iso-2';
      store.set(`users/${uid}`, {
        uid,
        role: 'TEAM_MANAGER',
        teamId: 'team-a',
        status: 'ACTIVE',
        disabled: false,
      });
      mockCustomClaims.set(uid, { role: 'TEAM_MANAGER', teamId: 'team-a' });

      const token = JSON.stringify({ uid, role: 'TEAM_MANAGER', teamId: 'team-a' });

      // TEAM_MANAGER cannot pass assertAdmin
      await expect(AuthService.assertAdmin(token)).rejects.toThrow(
        /Operation requires ADMIN role/i
      );
    });
  });
});
