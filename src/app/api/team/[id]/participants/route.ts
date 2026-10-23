import { NextRequest, NextResponse } from 'next/server';
import { ParticipantService } from '@/services/participantService';
import { handleApiError } from '@/lib/apiErrorHelper';

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const authorization = req.headers.get('authorization') || '';
    const idToken = authorization.startsWith('Bearer ')
      ? authorization.slice(7).trim()
      : '';
    if (!idToken) {
      return NextResponse.json({ error: 'Unauthorized: Sign in before registering a participant.' }, { status: 401 });
    }

    const { id: teamId } = await params;
    const body = await req.json();
    const participant = await ParticipantService.createForTeam(idToken, teamId, body);
    return NextResponse.json({ success: true, participant }, { status: 201 });
  } catch (error) {
    return handleApiError(error);
  }
}
