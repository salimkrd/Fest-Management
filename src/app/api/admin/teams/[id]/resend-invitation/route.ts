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
    const body = await req.json().catch(() => ({}));
    const adminIdToken = extractToken(req, body);

    if (!adminIdToken) {
      return NextResponse.json(
        { error: 'Unauthorized: Missing administrator authentication token.' },
        { status: 401 }
      );
    }

    const result = await TeamService.resendInvitation(adminIdToken, id, getTrustedAppUrl(req));
    return NextResponse.json({
      success: true,
      invitationCode: result.invitationCode,
      message: result.message,
      whatsappUrl: result.whatsappUrl,
      expiresAt: result.expiresAt,
      teamName: result.teamName,
      managerEmail: result.managerEmail,
      managerPhone: result.managerPhone
    }, { status: 200 });
  } catch (err: unknown) {
    return handleApiError(err);
  }
}
