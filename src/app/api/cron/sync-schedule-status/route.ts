import { timingSafeEqual } from 'crypto';
import { NextRequest, NextResponse } from 'next/server';
import { CompetitionScheduleService } from '@/services/competitionScheduleService';

export const dynamic = 'force-dynamic';

async function handleCron(req: NextRequest) {
  const expectedSecret = process.env.CRON_SECRET || '';
  const authorization = req.headers.get('authorization') || '';
  const suppliedSecret = authorization.startsWith('Bearer ') ? authorization.slice(7).trim() : '';

  if (
    !expectedSecret ||
    !suppliedSecret ||
    expectedSecret.length !== suppliedSecret.length ||
    !timingSafeEqual(Buffer.from(expectedSecret), Buffer.from(suppliedSecret))
  ) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const result = await CompetitionScheduleService.activateDueSlots();
    return NextResponse.json({ success: true, ...result }, { status: 200 });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Schedule synchronization failed.';
    console.error('[Schedule Cron] Synchronization failed:', message);
    return NextResponse.json({ error: 'Schedule synchronization failed.' }, { status: 500 });
  }
}

// Vercel Cron sends GET requests; the shared handler only accepts the secret bearer token.
export async function GET(req: NextRequest) {
  return handleCron(req);
}
