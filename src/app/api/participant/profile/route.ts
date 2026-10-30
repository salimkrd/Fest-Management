import { NextRequest, NextResponse } from 'next/server';
import { getParticipantSession } from '@/services/participantPortalAuth';

const EDITABLE_FIELDS = ['name', 'classGrade', 'email', 'phone', 'photoUrl', 'remarks'] as const;
type EditableField = typeof EDITABLE_FIELDS[number];

function cleanText(value: unknown, maxLength: number): string | null {
  if (typeof value !== 'string') return null;
  const clean = value.trim();
  return clean.length <= maxLength ? clean : null;
}

export async function PATCH(req: NextRequest) {
  try {
    const origin = req.headers.get('origin');
    if (origin && origin !== req.nextUrl.origin) {
      return NextResponse.json({ error: 'Invalid request origin.' }, { status: 403 });
    }

    const session = await getParticipantSession(req);
    if (!session) {
      return NextResponse.json({ error: 'Authentication required.' }, {
        status: 401, headers: { 'Cache-Control': 'no-store' }
      });
    }

    const body = await req.json().catch(() => null);
    if (!body || typeof body !== 'object' || Array.isArray(body)) {
      return NextResponse.json({ error: 'Invalid profile data.' }, { status: 400 });
    }

    // Explicit allowlist: ignore/reject every field outside the six participant-editable fields.
    const suppliedKeys = Object.keys(body);
    if (suppliedKeys.some(key => !EDITABLE_FIELDS.includes(key as EditableField))) {
      return NextResponse.json({ error: 'One or more fields cannot be edited.' }, { status: 400 });
    }

    const limits: Record<EditableField, number> = {
      name: 120, classGrade: 40, email: 254, phone: 25, photoUrl: 2048, remarks: 1000
    };
    const updates: Partial<Record<EditableField, string>> = {};
    for (const field of EDITABLE_FIELDS) {
      if (!(field in body)) continue;
      const value = cleanText(body[field], limits[field]);
      if (value === null) {
        return NextResponse.json({ error: `Invalid ${field} value.` }, { status: 400 });
      }
      updates[field] = value;
    }

    if (!Object.keys(updates).length) {
      return NextResponse.json({ error: 'No profile changes were supplied.' }, { status: 400 });
    }
    if ('name' in updates && !updates.name) {
      return NextResponse.json({ error: 'Full Student Name is required.' }, { status: 400 });
    }
    if (updates.email && !/^[^\\s@]+@[^\\s@]+\\.[^\\s@]+$/.test(updates.email)) {
      return NextResponse.json({ error: 'Enter a valid email address.' }, { status: 400 });
    }
    if (updates.photoUrl) {
      try {
        const url = new URL(updates.photoUrl);
        if (url.protocol !== 'https:' && url.protocol !== 'http:') throw new Error('Invalid protocol');
      } catch {
        return NextResponse.json({ error: 'Participant Photo URL must be a valid HTTP or HTTPS URL.' }, { status: 400 });
      }
    }

    await session.db.collection('participants').doc(session.id).update({
      ...updates,
      profileUpdatedAt: new Date().toISOString(),
      profileUpdatedBy: 'PARTICIPANT'
    });

    return NextResponse.json({ success: true }, { headers: { 'Cache-Control': 'no-store' } });
  } catch (err) {
    console.error('[ParticipantPortal] Profile update error:', err instanceof Error ? err.message : 'unknown');
    return NextResponse.json({ error: 'Could not update your profile right now.' }, { status: 503 });
  }
}
