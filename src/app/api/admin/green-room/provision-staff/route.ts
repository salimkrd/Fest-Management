import { NextRequest, NextResponse } from 'next/server';
import { AuthService } from '@/services/authService';
import { handleApiError } from '@/lib/apiErrorHelper';

function extractToken(req: NextRequest, body?: any): string {
  const authorization = req.headers.get('authorization') || '';
  if (authorization.startsWith('Bearer ')) {
    return authorization.slice(7).trim();
  }
  if (body?.adminIdToken && typeof body.adminIdToken === 'string') {
    return body.adminIdToken.trim();
  }
  return '';
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}));
    const adminIdToken = extractToken(req, body);

    if (!adminIdToken) {
      return NextResponse.json(
        { error: 'Unauthorized: Missing administrator authentication token.' },
        { status: 401 }
      );
    }

    const { email, password, displayName } = body;
    if (!email || !password || !displayName) {
      return NextResponse.json(
        { error: 'Validation Error: email, password, and displayName are required.' },
        { status: 400 }
      );
    }

    const user = await AuthService.provisionGreenRoomStaff(adminIdToken, {
      email,
      password,
      displayName
    });

    return NextResponse.json(
      { success: true, message: `Green Room Staff ${email} provisioned successfully.`, user },
      { status: 201 }
    );
  } catch (error: any) {
    if (error?.message?.includes('Conflict Error')) {
      return NextResponse.json({ error: error.message }, { status: 409 });
    }
    return handleApiError(error);
  }
}
