import { NextRequest, NextResponse } from 'next/server';
import { UnifiedAuthService, UnifiedAuthError } from '@/services/unifiedAuthService';

export async function POST(req: NextRequest) {
  try {
    const authHeader = req.headers.get('authorization') || '';
    const idToken = authHeader.startsWith('Bearer ') ? authHeader.slice(7).trim() : '';

    if (!idToken) {
      return NextResponse.json(
        { error: 'Unauthorized: Missing authentication token.' },
        { status: 401 }
      );
    }

    const result = await UnifiedAuthService.verifyStaffLogin(idToken);

    if (result.status === 'NEEDS_REFRESH') {
      return NextResponse.json(
        {
          needsTokenRefresh: true,
          message: result.message
        },
        { status: 200 }
      );
    }

    // Success: return minimal role, redirectUrl, and team info if TEAM_MANAGER
    return NextResponse.json(
      {
        success: true,
        role: result.role,
        redirectUrl: result.redirectUrl,
        team: result.team
      },
      { status: 200 }
    );
  } catch (err: unknown) {
    if (err instanceof UnifiedAuthError) {
      return NextResponse.json(
        { error: err.message },
        { status: err.statusCode }
      );
    }

    console.error('[API staff-login] Unexpected error:', err);
    return NextResponse.json(
      { error: 'Authentication verification failed. Please try again.' },
      { status: 500 }
    );
  }
}
