import { NextRequest, NextResponse } from 'next/server';
import { TeamService } from '@/services/teamService';

/**
 * Public & Authenticated Team Contingent Metadata Endpoint
 * Allows resolving public team information (name, code, color, status, zone, portalAccess)
 * without requiring administrator credentials.
 */
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    if (!id || id.trim() === '') {
      return NextResponse.json(
        { error: 'Validation Error: Team ID is required.' },
        { status: 400 }
      );
    }

    const team = await TeamService.getTeam(id.trim());
    if (!team) {
      return NextResponse.json(
        { error: `Team contingent "${id}" not found.` },
        { status: 404 }
      );
    }

    // Return safe public metadata
    return NextResponse.json({
      success: true,
      team: {
        id: team.id,
        name: team.name,
        code: team.code,
        color: team.color || '#2563EB',
        zone: team.zone || '',
        status: team.status || 'ACTIVE',
        portalAccess: team.portalAccess !== false && team.status !== 'DISABLED',
        managerName: team.managerName || '',
        managerEmail: team.managerEmail || ''
      }
    }, { status: 200 });
  } catch (err: any) {
    return NextResponse.json(
      { error: err.message || 'Internal Server Error' },
      { status: 500 }
    );
  }
}
