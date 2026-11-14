import { NextRequest, NextResponse } from 'next/server';
import { AuthService } from '@/services/authService';
import { CompetitionScheduleService } from '@/services/competitionScheduleService';
import { handleApiError } from '@/lib/apiErrorHelper';

export async function POST(req: NextRequest) {
  try {
    const authorization = req.headers.get('authorization') || '';
    const idToken = authorization.startsWith('Bearer ') ? authorization.slice(7).trim() : '';
    if (!idToken) {
      return NextResponse.json({ error: 'Unauthorized: Missing authentication token.' }, { status: 401 });
    }

    await AuthService.assertAdminOrGreenRoom(idToken);
    const result = await CompetitionScheduleService.activateDueSlots();
    return NextResponse.json({ success: true, ...result }, { status: 200 });
  } catch (error: unknown) {
    return handleApiError(error);
  }
}
