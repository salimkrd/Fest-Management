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

    const { competitionId, participantIdentifier, manualCodeLetter, notes, checkInMethod } = body;
    if (!competitionId || !participantIdentifier) {
      return NextResponse.json(
        { error: 'Validation Error: competitionId and participantIdentifier are required.' },
        { status: 400 }
      );
    }

    const result = await GreenRoomService.checkInContestant({
      competitionId,
      participantIdentifier,
      checkInMethod,
      manualCodeLetter,
      notes,
      operatorIdToken: idToken
    });

    return NextResponse.json(result, { status: 200 });
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : '';
    if (msg.includes('Eligibility Error')) {
      return NextResponse.json({ error: msg }, { status: 400 });
    }
    if (msg.includes('Conflict Error')) {
      return NextResponse.json({ error: msg }, { status: 409 });
    }
    return handleApiError(error);
  }
}
