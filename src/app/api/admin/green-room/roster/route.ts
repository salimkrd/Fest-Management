import { NextRequest, NextResponse } from 'next/server';
import { GreenRoomService } from '@/services/greenRoomService';
import { handleApiError } from '@/lib/apiErrorHelper';

function extractToken(req: NextRequest): string {
  const authorization = req.headers.get('authorization') || '';
  if (authorization.startsWith('Bearer ')) {
    return authorization.slice(7).trim();
  }
  return '';
}

export async function GET(req: NextRequest) {
  try {
    const idToken = extractToken(req);
    if (!idToken) {
      return NextResponse.json(
        { error: 'Unauthorized: Missing authentication token.' },
        { status: 401 }
      );
    }

    const { searchParams } = new URL(req.url);
    const competitionId = searchParams.get('competitionId');

    if (!competitionId) {
      return NextResponse.json(
        { error: 'Validation Error: competitionId parameter is required.' },
        { status: 400 }
      );
    }

    const roster = await GreenRoomService.getCompetitionRoster(competitionId, idToken);
    return NextResponse.json({ success: true, roster }, { status: 200 });
  } catch (error: any) {
    return handleApiError(error);
  }
}
