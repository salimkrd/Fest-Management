import { NextRequest, NextResponse } from 'next/server';
import { GreenRoomService } from '@/services/greenRoomService';
import { handleApiError } from '@/lib/apiErrorHelper';

function extractToken(req: NextRequest, body?: any): string {
  const authorization = req.headers.get('authorization') || '';
  if (authorization.startsWith('Bearer ')) {
    return authorization.slice(7).trim();
  }
  if (body?.idToken && typeof body.idToken === 'string') {
    return body.idToken.trim();
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

    const { competitionId, participantIdentifier, manualCodeLetter, notes } = body;
    if (!competitionId || !participantIdentifier) {
      return NextResponse.json(
        { error: 'Validation Error: competitionId and participantIdentifier are required.' },
        { status: 400 }
      );
    }

    const result = await GreenRoomService.checkInContestant({
      competitionId,
      participantIdentifier,
      manualCodeLetter,
      notes,
      operatorIdToken: idToken
    });

    return NextResponse.json(result, { status: 200 });
  } catch (error: any) {
    if (error?.message?.includes('Eligibility Error')) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }
    if (error?.message?.includes('Conflict Error')) {
      return NextResponse.json({ error: error.message }, { status: 409 });
    }
    return handleApiError(error);
  }
}
