import { NextRequest, NextResponse } from 'next/server';
import { getParticipantSession } from '@/services/participantPortalAuth';

export async function GET(req: NextRequest) {
  try {
    const session = await getParticipantSession(req);
    if (!session) return NextResponse.json({ error: 'Authentication required.' }, { status: 401, headers: { 'Cache-Control': 'no-store' } });

    const { id, data, db } = session;
    // Full roster, unpublished marks, other participants, phone and DOB are never
    // disclosed. Registrations are queried only by the authenticated participant.
    const [solo, leader, legacy] = await Promise.all([
      db.collection('registrations').where('participantId', '==', id).get(),
      db.collection('registrations').where('groupLeaderId', '==', id).get(),
      db.collection('registrations').where('groupMembers', 'array-contains', id).get()
    ]);
    const registrationDocs = new Map<string, FirebaseFirestore.QueryDocumentSnapshot>();
    [...solo.docs, ...leader.docs, ...legacy.docs].forEach(doc => registrationDocs.set(doc.id, doc));
    const registrations = Array.from(registrationDocs.values()).filter(doc => {
      const reg = doc.data();
      return reg.status !== 'REJECTED' && (reg.type === 'SOLO' ? reg.participantId === id :
        reg.groupLeaderId === id || (Array.isArray(reg.groupMembers) && reg.groupMembers.includes(id)));
    });

    const competitionIds = [...new Set(registrations.map(doc => doc.data().competitionId).filter((val): val is string => typeof val === 'string' && !!val))];
    const details = await Promise.all(competitionIds.map(async compId => {
      const [competition, results] = await Promise.all([
        db.collection('competitions').doc(compId).get(),
        db.collection('results').where('competitionId', '==', compId).get()
      ]);
      const published = results.docs.find(doc => doc.data().resultStatus === 'PUBLISHED');
      return [compId, { competition: competition.data() || {}, result: published?.data() }] as const;
    }));
    const detailsMap = new Map(details);
    const events = registrations.map(doc => {
      const reg = doc.data();
      const values = detailsMap.get(reg.competitionId);
      const contest = values?.competition || {};
      const published = values?.result;
      const rank = published?.ranks?.find((row: { registrationId?: string }) => row.registrationId === doc.id);
      const soloResult = reg.type === 'SOLO' && rank;
      return {
        registrationId: doc.id,
        name: contest.name || reg.competitionName || '',
        code: contest.code || '',
        type: reg.type === 'GROUP' ? 'GROUP' : 'SOLO',
        mode: contest.performanceMode || null,
        date: contest.date || '',
        timeSlot: contest.timeSlot || '',
        stageName: contest.stageName || '',
        registrationStatus: reg.status,
        groupName: reg.type === 'GROUP' ? reg.participantName : undefined,
        published: !!rank,
        score: rank && Number.isFinite(rank.score) ? rank.score : null,
        grade: rank?.grade || null,
        position: rank?.rank ?? null,
        // Only individual SOLO results contribute to the participant's points.
        individualPoints: soloResult ? Number(rank.officialPoints ?? rank.totalEarnedPoints ?? (rank as any).points ?? 0) : 0,
        groupTeamPoints: reg.type === 'GROUP' && rank ? Number(rank.officialPoints ?? rank.totalEarnedPoints ?? (rank as any).points ?? 0) : 0
      };
    });
    events.sort((a, b) => a.date.localeCompare(b.date) || a.name.localeCompare(b.name));
    const individualPoints = events.reduce((sum, event) => sum + (event.published ? event.individualPoints : 0), 0);
    const profile = {
      id,
      bib: data.bib || '',
      name: data.name || '',
      teamId: data.teamId || '',
      teamName: data.teamName || '',
      teamCode: data.teamCode || '',
      categoryName: data.categoryName || '',
      categoryId: data.categoryId || '',
      classGrade: data.classGrade || '',
      photoUrl: data.photoUrl || '',
      idStatus: data.idStatus || 'GENERATED',
      email: data.email || '',
      phone: data.phone || '',
      remarks: data.remarks || ''
    };
    return NextResponse.json({
      profile, events,
      summary: {
        competitions: events.length,
        soloEvents: events.filter(x => x.type === 'SOLO').length,
        groupEvents: events.filter(x => x.type === 'GROUP').length,
        individualPoints
      }
    }, { headers: { 'Cache-Control': 'no-store' } });
  } catch (err) {
    console.error('[ParticipantPortal] Dashboard error:', err instanceof Error ? err.message : 'unknown');
    return NextResponse.json({ error: 'Could not load the participant dashboard.' }, { status: 503 });
  }
}
