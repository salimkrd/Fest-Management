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
  groupLeaderId?: string;
  groupLeaderIds?: string[];
  groupMembers?: string[]; // Read-only legacy compatibility; new entries use one leader per group
}

export class RegistrationService {
  static async createForTeam(
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

      // A bulk submit creates one independent registration document per contestant/group.
      // This preserves the existing result, green-room, chest-number and scoring model.
      const selectedIds = Array.from(new Set(
        isGroup
          ? (input.groupLeaderIds?.length ? input.groupLeaderIds : [input.groupLeaderId || ''])
          : (input.participantIds?.length ? input.participantIds : [input.participantId || ''])
      ).filter(Boolean));
      if (selectedIds.length === 0) {
        throw new Error(isGroup
          ? 'Validation Error: Select at least one group leader.'
          : 'Validation Error: Select at least one participant.');
      }
      if (isGroup && (!Number.isInteger(competition.groupSize) || competition.groupSize < 2)) {
        throw new Error('Validation Error: Set a valid Members Per Group value (minimum 2) in the competition first.');
      }

      const participantSnapshots = await Promise.all(
        selectedIds.map(id => transaction.get(db.collection('participants').doc(id)))
      );
      const selectedParticipants = participantSnapshots.map(snapshot => {
        if (!snapshot.exists) throw new Error('Validation Error: A selected participant does not exist.');
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
      if (!isGroup) {
        const maximumEntries = Number(competition.maxEntriesPerTeam) || 1;
        if (activeTeamEntries.length + selectedParticipants.length > maximumEntries) {
          throw new Error(`Validation Error: This selection would exceed the team limit of ${maximumEntries} entries for this competition.`);
        }
        const existingParticipantIds = new Set(activeTeamEntries.map(doc => doc.data().participantId).filter(Boolean));
        const duplicate = selectedParticipants.find(participant => existingParticipantIds.has(participant.id));
        if (duplicate) {
          throw new Error(`Validation Error: ${duplicate.name} is already registered for this competition.`);
        }
      } else {
        const existingGroupParticipantIds = new Set(activeTeamEntries.flatMap(doc => {
          const data = doc.data();
          return [
            data.groupLeaderId,
            ...(Array.isArray(data.groupMembers) ? data.groupMembers : [])
          ].filter((id): id is string => typeof id === 'string' && id.length > 0);
        }));
        const duplicate = selectedParticipants.find(participant => existingGroupParticipantIds.has(participant.id));
        if (duplicate) {
          throw new Error(`Validation Error: ${duplicate.name} is already assigned to a group in this competition.`);
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
      const registrations = selectedParticipants.map((participant, index): FirestoreRegistration => {
        const registrationId = `reg-${randomUUID()}`;
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
          // New group entry represents one group. Do not store the full team roster here.
          groupMembers: isGroup ? [participant.id] : undefined,
          registeredAt: now
        };
      });

      transaction.set(counterRef, { value: lastCodeNumber + registrations.length, updatedAt: now }, { merge: true });
      registrations.forEach(registration => {
        transaction.create(db.collection('registrations').doc(registration.id), registration);
      });
      transaction.set(competitionRef, {
        entriesCount: Number(competition.entriesCount || 0) + registrations.length
      }, { merge: true });
      transaction.update(db.collection('categories').doc(competition.categoryId), { updatedAt: now });

      for (const participant of selectedParticipants) {
        const currentEvents: string[] = Array.isArray(participant.registeredEventIds)
          ? participant.registeredEventIds
          : [];
        transaction.update(db.collection('participants').doc(participant.id), {
          registeredEventIds: Array.from(new Set([...currentEvents, input.competitionId])),
          updatedAt: now
        });
      }

      return registrations;
    });
  }
}
