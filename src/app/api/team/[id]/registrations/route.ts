import { NextRequest, NextResponse } from 'next/server';
import { RegistrationService } from '@/services/registrationService';
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
      return NextResponse.json({ error: 'Unauthorized: Sign in before registering for a competition.' }, { status: 401 });
    }

    const { id: teamId } = await params;
    const registration = await RegistrationService.createForTeam(idToken, teamId, await req.json());
    return NextResponse.json({ success: true, registration }, { status: 201 });
  } catch (error) {
    return handleApiError(error);
  }
}
