import { NextRequest, NextResponse } from 'next/server';
import { JudgeService } from '@/services/judgeService';
import { syncWorkloadIdentityToken } from '@/lib/firebase/admin';
import { handleApiError } from '@/lib/apiErrorHelper';

/**
 * Admin-only read endpoint for one judge's anonymous Code Letter scorecard.
 * The service verifies Admin identity and refuses unverified roster mappings.
 */
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ assignmentId: string }> }
) {
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

    const { assignmentId } = await params;
    const scorecard = await JudgeService.getAdminScorecard(assignmentId, adminIdToken);
    return NextResponse.json({ success: true, scorecard }, {
      status: 200,
      headers: { 'Cache-Control': 'no-store, private' }
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Internal Server Error';
    if (message.includes('Unverified Mapping Error')) {
      return NextResponse.json({ error: message }, { status: 409, headers: { 'Cache-Control': 'no-store' } });
    }
    if (message.includes('Not Found')) {
      return NextResponse.json({ error: message }, { status: 404, headers: { 'Cache-Control': 'no-store' } });
    }
    if (message.includes('Validation Error') || message.includes('Scorecard Data Error')) {
      return NextResponse.json({ error: message }, { status: 400, headers: { 'Cache-Control': 'no-store' } });
    }
    return handleApiError(error);
  }
}
