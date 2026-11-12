import { NextRequest, NextResponse } from 'next/server';
import { ParticipantService } from '@/services/participantService';
import { handleApiError } from '@/lib/apiErrorHelper';

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const authorization = req.headers.get('authorization') || '';
    const idToken = authorization.startsWith('Bearer ')
      ? authorization.slice(7).trim()
      : '';
    if (!idToken) {
      return NextResponse.json(
        { error: 'Unauthorized: Sign in before updating a participant.' },
        { status: 401 }
      );
    }

    const { id } = await params;
    const body = await req.json();
    const participant = await ParticipantService.updateParticipant(idToken, id, body);
    return NextResponse.json({ success: true, participant }, { status: 200 });
  } catch (error) {
    return handleApiError(error);
  }
}

export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  return PATCH(req, { params });
}

