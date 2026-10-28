import { NextRequest, NextResponse } from 'next/server';
import { getAdminDb } from '@/lib/firebase/admin';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

function safePublicPhotoUrl(value: unknown): string | null {
  if (typeof value !== 'string' || !value.trim()) return null;
  try {
    const url = new URL(value.trim());
    if (url.protocol !== 'https:' || url.username || url.password) return null;
    return url.toString();
  } catch {
    return null;
  }
}

/**
 * Return only photo URLs for ranked entries of a published result.
 * Public visitors never receive participant records, names, contact details, or DOB.
 */
export async function GET(
  _request: NextRequest,
  context: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await context.params;
    if (!id || id.length > 180) {
      return NextResponse.json({ error: 'Invalid result ID.' }, { status: 400 });
    }

    const db = getAdminDb();
    if (!db) {
      return NextResponse.json({ error: 'Database service unavailable.' }, { status: 503 });
    }

    const resultSnapshot = await db.collection('results').doc(id).get();
    if (!resultSnapshot.exists || resultSnapshot.data()?.resultStatus !== 'PUBLISHED') {
      return NextResponse.json({ error: 'Published result not found.' }, { status: 404 });
    }

    const ranks = Array.isArray(resultSnapshot.data()?.ranks)
      ? resultSnapshot.data()!.ranks as Array<Record<string, unknown>>
      : [];
    const eligibleRanks = ranks.filter(rank =>
      [1, 2, 3].includes(Number(rank.rank)) &&
      typeof rank.registrationId === 'string' &&
      rank.registrationId.length > 0
    );

    const photoEntries = await Promise.all(eligibleRanks.map(async rank => {
      const registrationId = rank.registrationId as string;
      const registrationSnapshot = await db.collection('registrations').doc(registrationId).get();
      if (!registrationSnapshot.exists) return null;
      const registration = registrationSnapshot.data()!;
      let participantSnapshot = null;

      const linkedParticipantId = typeof registration.participantId === 'string'
        ? registration.participantId
        : typeof registration.groupLeaderId === 'string'
          ? registration.groupLeaderId
          : '';
      if (linkedParticipantId) {
        participantSnapshot = await db.collection('participants').doc(linkedParticipantId).get();
      }

      // Older imports may not have participantId on the registration. In that case
      // use the registered bib and team only, and return no photo if the match is ambiguous.
      if (!participantSnapshot?.exists) {
        const bib = String(registration.chestNumber || rank.bib || '').trim();
        if (bib) {
          const matchingParticipants = await db.collection('participants').where('bib', '==', bib).get();
          const candidates = matchingParticipants.docs.filter(doc =>
            (!rank.teamId || doc.data().teamId === rank.teamId) &&
            (!registration.participantName || String(doc.data().name || '').trim().toLowerCase() === String(registration.participantName).trim().toLowerCase())
          );
          if (candidates.length === 1) participantSnapshot = candidates[0];
        }
      }

      if (!participantSnapshot?.exists) return null;
      const photoUrl = safePublicPhotoUrl(participantSnapshot.data()?.photoUrl);
      return photoUrl ? [registrationId, photoUrl] as const : null;
    }));

    const photos = Object.fromEntries(
      photoEntries.filter((entry): entry is readonly [string, string] => entry !== null)
    );
    return NextResponse.json({ photos }, {
      headers: {
        'Cache-Control': 'public, max-age=30, s-maxage=30, stale-while-revalidate=60',
        'Vary': 'Accept-Encoding',
      },
    });
  } catch {
    return NextResponse.json({ error: 'Unable to load published winner photos.' }, { status: 500 });
  }
}
