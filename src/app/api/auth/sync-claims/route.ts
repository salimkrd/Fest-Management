import { NextRequest, NextResponse } from 'next/server';
import { getAdminAuth, getAdminDb } from '@/lib/firebase/admin';

/**
 * Reconciles Firebase Auth Custom Claims with the authoritative Firestore /users/{uid} document.
 * Safely resolves role mismatch for existing Chief Administrator or Team Managers
 * without creating any new admin or modifying accounts arbitrarily.
 */
export async function POST(req: NextRequest) {
  try {
    const authHeader = req.headers.get('authorization') || '';
    const idToken = authHeader.startsWith('Bearer ') ? authHeader.slice(7).trim() : '';

    if (!idToken) {
      return NextResponse.json({ error: 'Unauthorized: Missing authentication token.' }, { status: 401 });
    }

    const adminAuth = getAdminAuth();
    const adminDb = getAdminDb();

    if (!adminAuth || !adminDb) {
      return NextResponse.json({ error: 'Authentication service unavailable.' }, { status: 503 });
    }

    // Verify cryptographic token from authenticated user
    const decoded = await adminAuth.verifyIdToken(idToken, true);
    const uid = decoded.uid;

    // Retrieve authoritative profile from Firestore
    const userDocSnap = await adminDb.collection('users').doc(uid).get();
    if (!userDocSnap.exists) {
      return NextResponse.json({ error: 'Authoritative user profile does not exist.' }, { status: 404 });
    }

    const userData = userDocSnap.data();
    if (userData?.disabled === true || userData?.status !== 'ACTIVE') {
      return NextResponse.json({ error: 'Account is inactive or disabled by fest administration.' }, { status: 403 });
    }

    const targetRole = userData.role;
    const targetTeamId = userData.teamId;

    if (!targetRole || !['ADMIN', 'TEAM_MANAGER', 'GREEN_ROOM_STAFF', 'JUDGE', 'PUBLIC'].includes(targetRole)) {
      return NextResponse.json({ error: 'Invalid authoritative role specification.' }, { status: 400 });
    }

    // Check if claims already match exactly
    const currentRole = decoded.role;
    const currentTeamId = decoded.teamId;

    if (currentRole === targetRole && (targetRole !== 'TEAM_MANAGER' || currentTeamId === targetTeamId)) {
      return NextResponse.json({
        synchronized: false,
        message: 'Custom claims already match authoritative profile.',
        role: targetRole,
        teamId: targetTeamId
      }, { status: 200 });
    }

    // Synchronize custom user claims to match authoritative profile
    const updatedClaims: Record<string, unknown> = {
      role: targetRole
    };
    if (targetRole === 'TEAM_MANAGER' && targetTeamId) {
      updatedClaims.teamId = targetTeamId;
    }

    await adminAuth.setCustomUserClaims(uid, updatedClaims);

    return NextResponse.json({
      synchronized: true,
      message: `Successfully synchronized claims with authoritative role "${targetRole}".`,
      role: targetRole,
      teamId: targetTeamId
    }, { status: 200 });
  } catch (err: any) {
    console.error('[API sync-claims] Error reconciling claims:', err);
    return NextResponse.json({ error: err.message || 'Claims reconciliation failed.' }, { status: 500 });
  }
}
