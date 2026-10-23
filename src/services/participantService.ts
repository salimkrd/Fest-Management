import { randomUUID } from 'crypto';
import { AuthService } from '@/services/authService';
import { getAdminDb } from '@/lib/firebase/admin';
import { FirestoreParticipant } from '@/types/firestore';

export type NewParticipant = Pick<
  FirestoreParticipant,
  'name' | 'email' | 'phone' | 'categoryId' | 'categoryName' |
  'classGrade' | 'division' | 'dob' | 'photoUrl' | 'registeredEventIds'
> & { remarks?: string };

export class ParticipantService {
  static async createForTeam(
    idToken: string,
    teamId: string,
    input: NewParticipant
  ): Promise<FirestoreParticipant> {
    await AuthService.assertTeamManager(idToken, teamId);

    const db = getAdminDb();
    if (!db) {
      throw new Error('Database Unavailable: Cannot register a participant.');
    }
    if (!teamId || !input.name?.trim() || !input.categoryId) {
      throw new Error('Validation Error: Team, participant name, and category are required.');
    }

    const teamRef = db.collection('teams').doc(teamId);
    const categoryRef = db.collection('categories').doc(input.categoryId);
    const counterRef = db.collection('systemCounters').doc('participantBib');
    const participantId = `part-${randomUUID()}`;
    const participantRef = db.collection('participants').doc(participantId);

    return db.runTransaction(async transaction => {
      const [teamSnapshot, categorySnapshot, counterSnapshot] = await Promise.all([
        transaction.get(teamRef),
        transaction.get(categoryRef),
        transaction.get(counterRef)
      ]);
      if (!teamSnapshot.exists || teamSnapshot.data()?.status === 'DISABLED') {
        throw new Error('Validation Error: The assigned team is unavailable.');
      }
      if (!categorySnapshot.exists || categorySnapshot.data()?.status === 'INACTIVE') {
        throw new Error('Validation Error: Select an active participant category.');
      }

      let lastBibNumber = Number(counterSnapshot.data()?.value);
      if (!Number.isInteger(lastBibNumber) || lastBibNumber < 1000) {
        const existingParticipants = await transaction.get(db.collection('participants'));
        lastBibNumber = existingParticipants.docs.reduce((maximum, participant) => {
          const match = /^#?(\d+)$/.exec(String(participant.data().bib || '').trim());
          return match ? Math.max(maximum, Number(match[1])) : maximum;
        }, 1000);
      }

      const team = teamSnapshot.data()!;
      const category = categorySnapshot.data()!;
      const bib = `#${lastBibNumber + 1}`;
      const now = new Date().toISOString();
      const participant: FirestoreParticipant = {
        id: participantId,
        bib,
        name: input.name.trim(),
        email: input.email?.trim() || '',
        phone: input.phone?.trim() || '',
        teamId,
        teamCode: team.code || '',
        teamName: team.name || '',
        categoryId: categorySnapshot.id,
        categoryName: category.name || '',
        classGrade: input.classGrade || '',
        division: input.division || '',
        dob: input.dob || '',
        photoUrl: input.photoUrl || '',
        registeredEventIds: [],
        idStatus: 'GENERATED',
        createdAt: now
      };

      transaction.set(counterRef, { value: lastBibNumber + 1, updatedAt: now }, { merge: true });
      transaction.create(participantRef, { ...participant, remarks: input.remarks || '' });
      transaction.set(teamRef, {
        contestantsCount: Number(team.contestantsCount || 0) + 1,
        updatedAt: now
      }, { merge: true });

      return participant;
    });
  }
}
