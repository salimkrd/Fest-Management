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
      const categorySnapshot = await transaction.get(db.collection('categories').doc(competition.categoryId));
      if (!categorySnapshot.exists || categorySnapshot.data()?.status === 'INACTIVE') {
        throw new Error('Validation Error: The competition category is not active.');
      }
      const category = { id: categorySnapshot.id, ...categorySnapshot.data() } as Category;

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

      const participantIds = [isGroup ? groupLeaderId! : input.participantId!];
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
        if (!isParticipantEligibleForCategory(participant, category, [category])) {
          throw new Error(`Validation Error: Participant "${participant.name}" is not eligible for ${category.name}.`);
        }
        return participant;
      });

      const currentTeamEntries = existingRegistrations.docs.filter(doc => doc.data().teamId === teamId);
      const maximumEntries = Number(competition.maxEntriesPerTeam) || 1;
      if (!isGroup && currentTeamEntries.length >= maximumEntries) {
        throw new Error(`Validation Error: Team has reached the ${maximumEntries}-entry limit for this competition.`);
      }
      if (!isGroup && currentTeamEntries.some(doc => doc.data().participantId === input.participantId)) {
        throw new Error('Validation Error: This participant is already registered for the competition.');
      }
      if (isGroup && currentTeamEntries.some(doc =>
        doc.data().groupLeaderId === groupLeaderId ||
        (Array.isArray(doc.data().groupMembers) && doc.data().groupMembers.includes(groupLeaderId))
      )) {
        throw new Error('Validation Error: This leader is already registered for a group in this competition.');
      }

      let lastCodeNumber = Number(counterSnapshot.data()?.value);
      if (!Number.isInteger(lastCodeNumber) || lastCodeNumber < 8820) {
        const allRegistrations = await transaction.get(db.collection('registrations'));
        lastCodeNumber = allRegistrations.docs.reduce((maximum, doc) => {
          const match = /^REG-(\d+)$/.exec(String(doc.data().code || ''));
          return match ? Math.max(maximum, Number(match[1])) : maximum;
        }, 8820);
      }

      const participant = participants[0];
      const registration: FirestoreRegistration = {
        id: registrationId,
        code: `REG-${lastCodeNumber + 1}`,
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
        groupLeaderId: isGroup ? groupLeaderId : undefined,
        groupMembers: isGroup ? [groupLeaderId!] : undefined,
        registeredAt: new Date().toISOString()
      };
      const now = new Date().toISOString();
      transaction.set(counterRef, { value: lastCodeNumber + 1, updatedAt: now }, { merge: true });
      transaction.create(registrationRef, registration);
      transaction.set(competitionRef, {
        entriesCount: Number(competition.entriesCount || 0) + 1
      }, { merge: true });
      return registration;
    });
  }
}
