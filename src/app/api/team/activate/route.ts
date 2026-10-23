import { NextRequest, NextResponse } from 'next/server';
import { TeamService } from '@/services/teamService';

/**
 * Public Team Manager Account Activation Endpoint
 * Allows a newly appointed Team Manager to verify their WhatsApp invitation code,
 * securely set their password, and activate their portal account.
 */
export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}));

    // Mode 1: Code Verification / Preview
    if (body.action === 'VERIFY') {
      const { code, email, teamId } = body;
      if (!code) {
        return NextResponse.json(
          { error: 'Validation Error: Invitation code is required.' },
          { status: 400 }
        );
      }
      const verified = await TeamService.verifyInvitationCode(code, email, teamId);
      return NextResponse.json({ success: true, ...verified }, { status: 200 });
    }

    // Mode 2: Code Redemption & Password Setting
    const { code, email, newPassword, teamId } = body;

    if (!code || !newPassword) {
      return NextResponse.json(
        { error: 'Validation Error: Both invitation code and new password are required.' },
        { status: 400 }
      );
    }

    if (newPassword.length < 6) {
      return NextResponse.json(
        { error: 'Validation Error: Password must be at least 6 characters in length.' },
        { status: 400 }
      );
    }

    const result = await TeamService.activateManager({
      code,
      email,
      newPassword,
      teamId
    });

    return NextResponse.json(result, { status: 200 });
  } catch (err: any) {
    const message = err.message || 'Internal Server Error';
    const isVal = message.toLowerCase().includes('validation error');
    const isSecurity = message.toLowerCase().includes('security violation');
    const status = isSecurity ? 403 : isVal ? 400 : 500;
    return NextResponse.json({ error: message }, { status });
  }
}
