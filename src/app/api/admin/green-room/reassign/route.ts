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
  } catch (error: any) {
    if (error?.message?.includes('Conflict Error')) {
      return NextResponse.json({ error: error.message }, { status: 409 });
    }
    return handleApiError(error);
  }
}
