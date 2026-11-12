import { NextRequest, NextResponse } from 'next/server';
import { TeamService } from '@/services/teamService';
import { handleApiError } from '@/lib/apiErrorHelper';

function extractToken(req: NextRequest, body?: unknown): string {
  const authHeader = req.headers.get('authorization');
  if (authHeader && authHeader.startsWith('Bearer ')) {
    return authHeader.slice(7).trim();
  }
  if (body && typeof body === 'object' && 'adminIdToken' in body) {
    const adminIdToken = (body as { adminIdToken?: unknown }).adminIdToken;
    if (typeof adminIdToken === 'string') {
      return adminIdToken.trim();
    }
  }
  return '';
}

import { getTrustedAppUrl } from '@/lib/trustedUrl';

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = await req.json();
    const adminIdToken = extractToken(req, body);

    if (!adminIdToken) {
      return NextResponse.json(
        { error: 'Unauthorized: Missing administrator authentication token.' },
        { status: 401 }
      );
    }

    if (!body.newManagerEmail) {
      return NextResponse.json(
        { error: 'Validation Error: newManagerEmail is required.' },
        { status: 400 }
      );
    }

    const result = await TeamService.replaceTeamManager(adminIdToken, id, {
      newManagerEmail: body.newManagerEmail,
      newManagerName: body.newManagerName,
      newManagerPhone: body.newManagerPhone,
      appUrl: getTrustedAppUrl(req)
    });

    return NextResponse.json({
      success: true,
      team: result.team,
      newManagerUid: result.newManagerUid,
      invitation: result.invitation
    }, { status: 200 });
  } catch (err: unknown) {
    return handleApiError(err);
  }
}
