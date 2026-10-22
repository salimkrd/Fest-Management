import { NextRequest, NextResponse } from 'next/server';
import { TeamService } from '@/services/teamService';
import { handleApiError } from '@/lib/apiErrorHelper';

function extractToken(req: NextRequest, body?: any): string {
  const authHeader = req.headers.get('authorization');
  if (authHeader && authHeader.startsWith('Bearer ')) {
    return authHeader.slice(7).trim();
  }
  if (body?.adminIdToken && typeof body.adminIdToken === 'string') {
    return body.adminIdToken.trim();
  }
  return '';
}

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const adminIdToken = extractToken(req);

    if (!adminIdToken) {
      return NextResponse.json(
        { error: 'Unauthorized: Missing administrator authentication token.' },
        { status: 401 }
      );
    }

    const team = await TeamService.getTeam(id, adminIdToken);
    if (!team) {
      return NextResponse.json({ error: 'Team not found' }, { status: 404 });
    }
    return NextResponse.json({ team }, { status: 200 });
  } catch (err: any) {
    return handleApiError(err);
  }
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = await req.json();
    const adminIdToken = extractToken(req, body);

    if (!adminIdToken) {
      return NextResponse.json(
        { error: 'Unauthorized: Missing administrator authentication token.' },
        { status: 401 }
      );
    }

    if (body.action === 'SET_STATUS') {
      const updated = await TeamService.setTeamStatus(adminIdToken, id, Boolean(body.enabled));
      return NextResponse.json({ success: true, team: updated }, { status: 200 });
    }

    const updated = await TeamService.updateTeamInfo(adminIdToken, id, body);
    return NextResponse.json({ success: true, team: updated }, { status: 200 });
  } catch (err: any) {
    return handleApiError(err);
  }
}
