import { NextRequest, NextResponse } from 'next/server';
import { JudgeService } from '@/services/judgeService';
import { syncWorkloadIdentityToken } from '@/lib/firebase/admin';
import { handleApiError } from '@/lib/apiErrorHelper';

/**
 * Admin-only endpoint to revoke an unsubmitted judge assignment.
 * The service re-verifies the Admin identity and applies the change transactionally.
 */
export async function POST(req: NextRequest) {
  try {
    await syncWorkloadIdentityToken();

    const authorization = req.headers.get('authorization') || '';
    const adminIdToken = authorization.startsWith('Bearer ')
      ? authorization.slice(7).trim()
      : '';

    if (!adminIdToken) {
      return NextResponse.json(
        { error: 'Unauthorized: Missing administrator authentication token.' },
        { status: 401 }
      );
    }

    const body = await req.json().catch(() => ({}));
    const assignmentId = typeof body.assignmentId === 'string' ? body.assignmentId.trim() : '';

    if (!assignmentId) {
      return NextResponse.json(
        { error: 'Validation Error: assignmentId is required.' },
        { status: 400 }
      );
    }

    const result = await JudgeService.revokeAssignment(assignmentId, adminIdToken);

    return NextResponse.json({
      success: true,
      ...result
    }, { status: 200 });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Internal Server Error';
    if (message.includes('Conflict Error')) {
      return NextResponse.json({ error: message }, { status: 409 });
    }
    if (message.includes('Not Found')) {
      return NextResponse.json({ error: message }, { status: 404 });
    }
    if (message.includes('Validation Error')) {
      return NextResponse.json({ error: message }, { status: 400 });
    }
    return handleApiError(error);
  }
}
