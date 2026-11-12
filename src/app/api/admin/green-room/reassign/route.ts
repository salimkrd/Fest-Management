import { NextRequest, NextResponse } from 'next/server';
import { GreenRoomService } from '@/services/greenRoomService';
import { handleApiError } from '@/lib/apiErrorHelper';

function extractToken(req: NextRequest, body?: unknown): string {
  const authorization = req.headers.get('authorization') || '';
  if (authorization.startsWith('Bearer ')) {
    return authorization.slice(7).trim();
  }
  if (body && typeof body === 'object' && 'idToken' in body) {
    const idToken = (body as { idToken?: unknown }).idToken;
    if (typeof idToken === 'string') {
      return idToken.trim();
    }
  }
  return '';
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}));
    const idToken = extractToken(req, body);

    if (!idToken) {
      return NextResponse.json(
        { error: 'Unauthorized: Missing authentication token.' },
        { status: 401 }
      );
    }

    const { competitionId, registrationId, newCodeLetter, reason } = body;
    if (!competitionId || !registrationId || !newCodeLetter || !reason) {
      return NextResponse.json(
        { error: 'Validation Error: competitionId, registrationId, newCodeLetter, and reason are required.' },
        { status: 400 }
      );
    }

    const updated = await GreenRoomService.reassignCodeLetter({
      competitionId,
      registrationId,
      newCodeLetter,
      reason,
      operatorIdToken: idToken
    });

    return NextResponse.json({ success: true, assignment: updated }, { status: 200 });
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : '';
    if (msg.includes('Lock Error')) {
      return NextResponse.json({ error: msg }, { status: 423 });
    }
    if (msg.includes('Conflict Error')) {
      return NextResponse.json({ error: msg }, { status: 409 });
    }
    return handleApiError(error);
  }
}
