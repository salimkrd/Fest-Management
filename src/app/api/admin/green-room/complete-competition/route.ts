import { NextRequest, NextResponse } from 'next/server';
import { AuthService } from '@/services/authService';
import { CompetitionScheduleService } from '@/services/competitionScheduleService';
import { handleApiError } from '@/lib/apiErrorHelper';

export const runtime = 'nodejs';

export async function POST(req: NextRequest) {
  try {
    const authorization = req.headers.get('authorization') || '';
    const idToken = authorization.startsWith('Bearer ') ? authorization.slice(7).trim() : '';
    if (!idToken) {
      return NextResponse.json({ error: 'Unauthorized: Missing authentication token.' }, { status: 401 });
    }

    const operator = await AuthService.assertAdminOrGreenRoom(idToken);
    const body = await req.json().catch(() => ({}));
    const competitionId = typeof body.competitionId === 'string' ? body.competitionId.trim() : '';
    if (!competitionId) {
      return NextResponse.json({ error: 'Validation Error: competitionId is required.' }, { status: 400 });
    }

    const result = await CompetitionScheduleService.completeCompetition(competitionId, operator);
    return NextResponse.json({ success: true, ...result }, { status: 200 });
  } catch (error: unknown) {
    return handleApiError(error);
  }
}
