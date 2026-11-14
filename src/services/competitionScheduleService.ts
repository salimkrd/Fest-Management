import { randomUUID } from 'crypto';
import { getAdminDb } from '@/lib/firebase/admin';
import type { VerifiedUserContext } from '@/services/authService';
import {
  resolveCompetitionScheduleStatus,
  shouldScheduleBecomeLive
} from '@/domain/scheduleStatus';

export class CompetitionScheduleService {
  /**
   * Idempotently promotes due schedule slots to LIVE using festival-local
   * Asia/Kolkata date/time. Completion is deliberately never inferred from endTime.
   */
  static async activateDueSlots(now: Date = new Date()): Promise<{
    checkedAt: string;
    activatedSlots: number;
    competitionsMarkedLive: number;
  }> {
    const db = getAdminDb();
    if (!db) throw new Error('Database Unavailable: Cannot synchronize competition schedules.');

    const nowMs = now.getTime();
    const nowIso = now.toISOString();
    const dueSnapshot = await db.collection('schedules').where('status', '==', 'SCHEDULED').get();
    const dueCompetitionIds = new Set<string>();

    for (const slotDoc of dueSnapshot.docs) {
      const slot = slotDoc.data();
      if (slot.competitionId && shouldScheduleBecomeLive({
        date: String(slot.date || ''),
        startTime: String(slot.startTime || ''),
        status: String(slot.status || '')
      }, nowMs)) {
        dueCompetitionIds.add(String(slot.competitionId));
      }
    }

    let activatedSlots = 0;
    let competitionsMarkedLive = 0;

    for (const competitionId of dueCompetitionIds) {
      const result = await db.runTransaction(async transaction => {
        const competitionRef = db.collection('competitions').doc(competitionId);
        const slotsQuery = db.collection('schedules').where('competitionId', '==', competitionId);
        const [competitionSnapshot, slotsSnapshot] = await Promise.all([
          transaction.get(competitionRef),
          transaction.get(slotsQuery)
        ]);

        if (!competitionSnapshot.exists) return { activated: 0, markedLive: false };
        const competition = competitionSnapshot.data() || {};
        if (competition.scheduleStatus === 'COMPLETED') return { activated: 0, markedLive: false };

        let activated = 0;
        const projectedStatuses: string[] = [];
        for (const slotDoc of slotsSnapshot.docs) {
          const slot = slotDoc.data();
          if (shouldScheduleBecomeLive({
            date: String(slot.date || ''),
            startTime: String(slot.startTime || ''),
            status: String(slot.status || '')
          }, nowMs)) {
            transaction.update(slotDoc.ref, { status: 'LIVE', updatedAt: nowIso });
            projectedStatuses.push('LIVE');
            activated += 1;
          } else {
            projectedStatuses.push(String(slot.status || 'SCHEDULED'));
          }
        }

        const nextStatus = resolveCompetitionScheduleStatus(projectedStatuses);
        const markedLive = nextStatus === 'LIVE' && competition.scheduleStatus !== 'LIVE';
        if (nextStatus !== competition.scheduleStatus && nextStatus !== 'COMPLETED') {
          transaction.update(competitionRef, {
            scheduleStatus: nextStatus,
            ...(nextStatus === 'LIVE' && !competition.scheduleStartedAt ? { scheduleStartedAt: nowIso } : {}),
            updatedAt: nowIso
          });
        }

        return { activated, markedLive };
      });

      activatedSlots += result.activated;
      if (result.markedLive) competitionsMarkedLive += 1;
    }

    return { checkedAt: nowIso, activatedSlots, competitionsMarkedLive };
  }

  /**
   * A Green Room Admin/Staff member confirms the whole competition is over.
   * The operation updates all schedule slots and the parent competition atomically.
   */
  static async completeCompetition(competitionId: string, operator: VerifiedUserContext): Promise<{
    competitionId: string;
    scheduleStatus: 'COMPLETED';
    completedAt: string;
    completedSlots: number;
    alreadyCompleted: boolean;
  }> {
    if (!competitionId || typeof competitionId !== 'string') {
      throw new Error('Validation Error: competitionId is required.');
    }

    const db = getAdminDb();
    if (!db) throw new Error('Database Unavailable: Cannot complete the competition.');

    const now = new Date().toISOString();
    const result = await db.runTransaction(async transaction => {
      const competitionRef = db.collection('competitions').doc(competitionId);
      const slotsQuery = db.collection('schedules').where('competitionId', '==', competitionId);
      const [competitionSnapshot, slotsSnapshot] = await Promise.all([
        transaction.get(competitionRef),
        transaction.get(slotsQuery)
      ]);

      if (!competitionSnapshot.exists) {
        throw new Error(`Not Found: Competition "${competitionId}" does not exist.`);
      }
      if (slotsSnapshot.empty) {
        throw new Error('Validation Error: Add a schedule slot before confirming this competition as completed.');
      }

      const competition = competitionSnapshot.data() || {};
      const allCompleted = slotsSnapshot.docs.every(slotDoc => slotDoc.data().status === 'COMPLETED');
      if (competition.scheduleStatus === 'COMPLETED' && allCompleted) {
        return {
          completedSlots: slotsSnapshot.size,
          alreadyCompleted: true,
          completedAt: String(competition.scheduleCompletedAt || now)
        };
      }

      for (const slotDoc of slotsSnapshot.docs) {
        if (slotDoc.data().status !== 'COMPLETED') {
          transaction.update(slotDoc.ref, { status: 'COMPLETED', completedAt: now, updatedAt: now });
        }
      }

      transaction.update(competitionRef, {
        scheduleStatus: 'COMPLETED',
        scheduleCompletedAt: now,
        scheduleCompletedBy: operator.uid,
        updatedAt: now
      });

      const auditRef = db.collection('auditLogs').doc(randomUUID());
      transaction.set(auditRef, {
        action: 'COMPETITION_MARKED_COMPLETED',
        actorId: operator.uid,
        actorEmail: operator.email,
        actorRole: operator.role,
        targetCollection: 'competitions',
        targetDocId: competitionId,
        details: {
          competitionCode: competition.code || '',
          competitionName: competition.name || '',
          previousScheduleStatus: competition.scheduleStatus || 'SCHEDULED',
          completedSlots: slotsSnapshot.size
        },
        timestamp: now
      });

      return { completedSlots: slotsSnapshot.size, alreadyCompleted: false, completedAt: now };
    });

    return {
      competitionId,
      scheduleStatus: 'COMPLETED',
      completedAt: result.completedAt,
      completedSlots: result.completedSlots,
      alreadyCompleted: result.alreadyCompleted
    };
  }
}
