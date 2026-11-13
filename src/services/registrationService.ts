import { randomUUID } from 'crypto';
import { AuthService } from '@/services/authService';
import { getAdminDb } from '@/lib/firebase/admin';
import { isParticipantEligibleForCategory } from '@/domain/eligibility';
import { Category, Participant } from '@/types/fest';
import { FirestoreRegistration } from '@/types/firestore';

interface CreateRegistrationInput {
  competitionId: string;
  participantId?: string;
  participantName?: string;
  groupMembers?: string[]; // Read-only legacy compatibility
  groupLeaderId?: string;
}

export class RegistrationService {
  static async createForTeam(
    idToken: string,
    teamId: string,
    input: CreateRegistrationInput
  ): Promise<FirestoreRegistration> {
    await AuthService.assertTeamManager(idToken, teamId);

    const db = getAdminDb();
    if (!db) throw new Error('Database Unavailable: Cannot register for a competition.');
    if (!teamId || !input.competitionId) {
      throw new Error('Validation Error: Team and competition are required.');
    }

    const teamRef = db.collection('teams').doc(teamId);
    const competitionRef = db.collection('competitions').doc(input.competitionId);
    const counterRef = db.collection('systemCounters').doc('registrationCode');
    const registrationId = `reg-${randomUUID()}`;
    const registrationRef = db.collection('registrations').doc(registrationId);

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
      const groupLeaderId = isGroup ? input.groupLeaderId : undefined;
      if (isGroup && (!Number.isInteger(competition.groupSize) || competition.groupSize < 2)) {
        throw new Error('Validation Error: Set a valid Members Per Group value (minimum 2) in the competition first.');
      }
      if (isGroup && !groupLeaderId) {
        throw new Error('Validation Error: Select a registered team member as the group leader.');
      }
      if (!isGroup && !input.participantId) {
        throw new Error('Validation Error: A participant is required for an individual competition.');
      }

      const groupMemberIds = isGroup
        ? Array.from(new Set([
            groupLeaderId!,
            ...(Array.isArray(input.groupMembers) ? input.groupMembers : [])
          ].filter((id): id is string => Boolean(id) && typeof id === 'string')))
        : [];
      const participantIds = isGroup ? groupMemberIds : [input.participantId!];

      const participantSnapshots = await Promise.all(
        participantIds.map(id => transaction.get(db.collection('participants').doc(id)))
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
      const maximumEntries = Number(competition.maxEntriesPerTeam) || 1;
      if (!isGroup && activeTeamEntries.length >= maximumEntries) {
        throw new Error(`Validation Error: Team has reached the ${maximumEntries}-entry limit for this competition.`);
      }
      if (!isGroup && activeTeamEntries.some(doc => doc.data().participantId === input.participantId)) {
        throw new Error('Validation Error: This participant is already registered for the competition.');
      }
      if (isGroup && activeTeamEntries.some(doc => {
        const d = doc.data();
        const existingMembers = Array.isArray(d.groupMembers)
          ? d.groupMembers
          : [d.groupLeaderId].filter(Boolean);
        return participantIds.some(pId => pId === d.groupLeaderId || existingMembers.includes(pId));
      })) {
        throw new Error('Validation Error: One or more selected participants are already registered for a group in this competition.');
      }

      let lastCodeNumber = Number(counterSnapshot.data()?.value);
      if (!Number.isInteger(lastCodeNumber) || lastCodeNumber < 8820) {
        const allRegistrations = await transaction.get(db.collection('registrations'));
        lastCodeNumber = allRegistrations.docs.reduce((maximum, doc) => {
          const match = /^REG-(\d+)$/.exec(String(doc.data().code || ''));
          return match ? Math.max(maximum, Number(match[1])) : maximum;
        }, 8820);
      }

      const leader = participants.find(p => p.id === groupLeaderId) || participants[0];
      const registration: FirestoreRegistration = {
        id: registrationId,
        code: `REG-${lastCodeNumber + 1}`,
        participantId: isGroup ? undefined : leader.id,
        participantName: isGroup ? `${leader.name} & Team` : leader.name,
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
          : leader.bib,
        status: 'APPROVED',
        groupLeaderId: isGroup ? groupLeaderId : undefined,
        groupSize: isGroup ? competition.groupSize : undefined,
        groupMembers: isGroup ? participantIds : undefined,
        registeredAt: new Date().toISOString()
      };
      const now = new Date().toISOString();
      transaction.set(counterRef, { value: lastCodeNumber + 1, updatedAt: now }, { merge: true });
      transaction.create(registrationRef, registration);
      transaction.set(competitionRef, {
        entriesCount: Number(competition.entriesCount || 0) + 1
      }, { merge: true });

      // Touch category document in transaction to ensure mutual write contention with concurrent category policy updates
      transaction.update(db.collection('categories').doc(competition.categoryId), {
        updatedAt: now
      });

      // Update registeredEventIds and timestamp for ALL registered participants (leader + members)
      // for atomic concurrency conflict detection
      for (const p of participants) {
        const currentEvents: string[] = Array.isArray(p.registeredEventIds)
          ? p.registeredEventIds
          : [];
        const updatedEvents = Array.from(new Set([...currentEvents, input.competitionId]));
        transaction.update(db.collection('participants').doc(p.id), {
          registeredEventIds: updatedEvents,
          updatedAt: now
        });
      }

      return registration;
    });
  }
}
