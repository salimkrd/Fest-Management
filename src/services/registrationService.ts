import { randomUUID } from 'crypto';
import { AuthService } from '@/services/authService';
import { getAdminDb } from '@/lib/firebase/admin';
import { isParticipantEligibleForCategory } from '@/domain/eligibility';
import { Category, Participant } from '@/types/fest';
import { FirestoreRegistration } from '@/types/firestore';

interface CreateRegistrationInput {
  competitionId: string;
  participantId?: string;
  participantIds?: string[];
  participantName?: string;
  groupMembers?: string[]; // Read-only legacy compatibility
  groupLeaderId?: string;
  groupLeaderIds?: string[];
}

export class RegistrationService {
  /** Backwards-compatible single-entry API used by older callers. */
  static async createForTeam(
    idToken: string,
    teamId: string,
    input: CreateRegistrationInput
  ): Promise<FirestoreRegistration> {
    const registrations = await this.createManyForTeam(idToken, teamId, input);
    return registrations[0];
  }

  /**
   * Creates one independent registration document per selected contestant/group leader
   * in a single Firestore transaction. This preserves one chest number, Green Room
   * code letter, scorecard and result rank per entrant while allowing one bulk submit.
   */
  static async createManyForTeam(
    idToken: string,
    teamId: string,
    input: CreateRegistrationInput
  ): Promise<FirestoreRegistration[]> {
    await AuthService.assertTeamManager(idToken, teamId);

    const db = getAdminDb();
    if (!db) throw new Error('Database Unavailable: Cannot register for a competition.');
    if (!teamId || !input.competitionId) {
      throw new Error('Validation Error: Team and competition are required.');
    }

    const teamRef = db.collection('teams').doc(teamId);
    const competitionRef = db.collection('competitions').doc(input.competitionId);
    const counterRef = db.collection('systemCounters').doc('registrationCode');
    const selectedIds = Array.from(new Set(
      (input.groupLeaderIds?.length
        ? input.groupLeaderIds
        : input.participantIds?.length
          ? input.participantIds
          : [input.groupLeaderId || input.participantId || ''])
        .map(id => typeof id === 'string' ? id.trim() : '')
        .filter(Boolean)
    ));

    if (selectedIds.length === 0) {
      throw new Error('Validation Error: Select at least one contestant or group leader.');
    }
    if (selectedIds.length > 100) {
      throw new Error('Validation Error: You can submit up to 100 entries at a time.');
    }

    const registrationRefs = selectedIds.map(() =>
      db.collection('registrations').doc(`reg-${randomUUID()}`)
    );

    return db.runTransaction(async transaction => {
      const [teamSnapshot, competitionSnapshot, counterSnapshot, existingRegistrations] = await Promise.all([
        transaction.get(teamRef),
        transaction.get(competitionRef),
        transaction.get(counterRef),
        transaction.get(db.collection('registrations').where('competitionId', '==', input.competitionId))
      ]);
      if (!teamSnapshot.exists || teamSnapshot.data()?.status === 'DISABLED') {
        throw new Error('Validation Error: The assigned team is unavailable.');
      }
      if (!competitionSnapshot.exists) {
        throw new Error('Validation Error: The selected competition does not exist.');
      }

      const team = teamSnapshot.data()!;
      const competition = competitionSnapshot.data()!;
      const [categorySnapshot, categoriesSnapshot] = await Promise.all([
        transaction.get(db.collection('categories').doc(competition.categoryId)),
        transaction.get(db.collection('categories')),
      ]);
      if (!categorySnapshot.exists || categorySnapshot.data()?.status === 'INACTIVE') {
        throw new Error('Validation Error: The competition category is not active.');
      }
      const category = { id: categorySnapshot.id, ...categorySnapshot.data() } as Category;
      const allCategories = categoriesSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Category));

      const isGroup = competition.type === 'GROUP';
      if (isGroup && (!Number.isInteger(competition.groupSize) || competition.groupSize < 2)) {
        throw new Error('Validation Error: Set a valid Members Per Group value (minimum 2) in the competition first.');
      }
      if (!isGroup && input.groupLeaderIds?.length) {
        throw new Error('Validation Error: Group leaders can only be selected for group competitions.');
      }

      const participantSnapshots = await Promise.all(
        selectedIds.map(id => transaction.get(db.collection('participants').doc(id)))
      );
      const participants = participantSnapshots.map(snapshot => {
        if (!snapshot.exists) {
          throw new Error('Validation Error: A selected participant does not exist.');
        }
        const participant = { id: snapshot.id, ...snapshot.data() } as Participant;
        if (participant.teamId !== teamId) {
          throw new Error('Unauthorized: Participants must belong to the current team.');
        }
        if (!isParticipantEligibleForCategory(participant, category, allCategories)) {
          throw new Error(`Validation Error: Participant "${participant.name}" is not eligible for ${category.name}.`);
        }
        return participant;
      });

      const currentTeamEntries = existingRegistrations.docs.filter(doc => doc.data().teamId === teamId);
      const activeTeamEntries = currentTeamEntries.filter(
        doc => doc.data().status !== 'REJECTED' && doc.data().status !== 'CANCELLED'
      );
      const selectedSet = new Set(selectedIds);
      if (!isGroup) {
        const maximumEntries = Number(competition.maxEntriesPerTeam) || 1;
        if (activeTeamEntries.length + selectedIds.length > maximumEntries) {
          throw new Error(`Validation Error: This team can register ${maximumEntries} entr${maximumEntries === 1 ? 'y' : 'ies'} for this competition; ${activeTeamEntries.length} already registered.`);
        }
        const alreadyRegistered = activeTeamEntries
          .map(doc => doc.data().participantId)
          .filter((id): id is string => typeof id === 'string' && selectedSet.has(id));
        if (alreadyRegistered.length) {
          const names = participants.filter(p => alreadyRegistered.includes(p.id)).map(p => p.name).join(', ');
          throw new Error(`Validation Error: Already registered: ${names}.`);
        }
      } else {
        const existingLeaderIds = new Set<string>();
        for (const doc of activeTeamEntries) {
          const data = doc.data();
          if (data.groupLeaderId) existingLeaderIds.add(data.groupLeaderId);
          // Retain protection against overlap with legacy full-roster group records.
          if (Array.isArray(data.groupMembers)) {
            for (const memberId of data.groupMembers) {
              if (typeof memberId === 'string') existingLeaderIds.add(memberId);
            }
          }
        }
        const duplicates = participants.filter(p => existingLeaderIds.has(p.id));
        if (duplicates.length) {
          throw new Error(`Validation Error: Already registered as a group leader or legacy group member: ${duplicates.map(p => p.name).join(', ')}.`);
        }
      }

      let lastCodeNumber = Number(counterSnapshot.data()?.value);
      if (!Number.isInteger(lastCodeNumber) || lastCodeNumber < 8820) {
        const allRegistrations = await transaction.get(db.collection('registrations'));
        lastCodeNumber = allRegistrations.docs.reduce((maximum, doc) => {
          const match = /^REG-(\\d+)$/.exec(String(doc.data().code || ''));
          return match ? Math.max(maximum, Number(match[1])) : maximum;
        }, 8820);
      }

      const now = new Date().toISOString();
      const registrations: FirestoreRegistration[] = participants.map((participant, index) => {
        const registrationId = registrationRefs[index].id;
        return {
          id: registrationId,
          code: `REG-${lastCodeNumber + index + 1}`,
          participantId: isGroup ? undefined : participant.id,
          participantName: isGroup ? `${participant.name} & Team` : participant.name,
          teamId,
          teamCode: team.code || '',
          teamName: team.name || '',
          categoryId: competition.categoryId,
          categoryName: competition.categoryName || category.name,
          competitionId: input.competitionId,
          competitionName: competition.name || '',
          type: isGroup ? 'GROUP' : 'SOLO',
          chestNumber: isGroup
            ? `GRP-${team.code || teamId}-${registrationId.slice(-6)}`
            : participant.bib,
          status: 'APPROVED',
          groupLeaderId: isGroup ? participant.id : undefined,
          groupSize: isGroup ? competition.groupSize : undefined,
          // New records intentionally store only the group leader, never the full roster.
          groupMembers: undefined,
          registeredAt: now
        };
      });

      transaction.set(counterRef, { value: lastCodeNumber + registrations.length, updatedAt: now }, { merge: true });
      transaction.set(competitionRef, {
        entriesCount: Number(competition.entriesCount || 0) + registrations.length
      }, { merge: true });
      transaction.update(db.collection('categories').doc(competition.categoryId), { updatedAt: now });

      registrations.forEach((registration, index) => {
        transaction.create(registrationRefs[index], registration);
      });

      // Update each selected contestant's registered-event mirror in the same transaction.
      participants.forEach(participant => {
        const currentEvents: string[] = Array.isArray(participant.registeredEventIds)
          ? participant.registeredEventIds
          : [];
        transaction.update(db.collection('participants').doc(participant.id), {
          registeredEventIds: Array.from(new Set([...currentEvents, input.competitionId])),
          updatedAt: now
        });
      });

      return registrations;
    });
  }
}
