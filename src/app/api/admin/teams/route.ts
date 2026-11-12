import { NextRequest, NextResponse } from 'next/server';
import { TeamService } from '@/services/teamService';
import { handleApiError } from '@/lib/apiErrorHelper';

function extractToken(req: NextRequest, body?: unknown): string {
  const authHeader = req.headers.get('authorization');
  if (authHeader && authHeader.startsWith('Bearer ')) {
    return authHeader.slice(7).trim();
  }
  if (body && typeof body === 'object' && 'adminIdToken' in body) {
    const adminIdToken = (body as { adminIdToken?: unknown }).adminIdToken;
    if (typeof adminIdToken === 'string') {
      return adminIdToken.trim();
    }
  }
  return '';
}

export async function GET(req: NextRequest) {
  try {
    const adminIdToken = extractToken(req);
    if (!adminIdToken) {
      return NextResponse.json(
        { error: 'Unauthorized: Missing administrator authentication token.' },
        { status: 401 }
      );
    }
    const teams = await TeamService.listTeams(adminIdToken);
    return NextResponse.json({ teams }, { status: 200 });
  } catch (err: unknown) {
    return handleApiError(err);
  }
}

import { getTrustedAppUrl } from '@/lib/trustedUrl';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const adminIdToken = extractToken(req, body);

    if (!adminIdToken) {
      return NextResponse.json(
        { error: 'Unauthorized: Missing administrator authentication token.' },
        { status: 401 }
      );
    }

    const result = await TeamService.createTeamWithManager(adminIdToken, {
      name: body.name,
      code: body.code,
      color: body.color,
      zone: body.zone,
      managerEmail: body.managerEmail,
      managerName: body.managerName,
      managerPhone: body.managerPhone,
      appUrl: getTrustedAppUrl(req)
    });

    return NextResponse.json({
      success: true,
      team: result.team,
      managerUid: result.managerUid,
      invitation: result.invitation
    }, { status: 201 });
  } catch (err: unknown) {
    return handleApiError(err);
  }
}
