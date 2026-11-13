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

    const result = await TeamService.markInvitationSent(adminIdToken, id);
    return NextResponse.json(result, { status: 200 });
  } catch (err: unknown) {
    return handleApiError(err);
  }
}
