import { randomUUID } from 'crypto';
import { AuthService } from '@/services/authService';
import { getAdminDb } from '@/lib/firebase/admin';
import { FirestoreParticipant } from '@/types/firestore';
import { Category, Competition, Participant } from '@/types/fest';
import { isParticipantEligibleForCategory } from '@/domain/eligibility';
import { sanitizeForFirestore } from '@/lib/firebase/sanitize';

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

  static async updateParticipant(
    idToken: string,
    participantId: string,
    updates: Partial<Participant>
  ): Promise<FirestoreParticipant> {
    const user = await AuthService.verifySession(idToken);
    if (user.role !== 'ADMIN' && user.role !== 'TEAM_MANAGER') {
      throw new Error('Unauthorized: Insufficient permissions to update participant.');
    }

    const db = getAdminDb();
    if (!db) {
      throw new Error('Database Unavailable: Cannot update participant.');
    }

    return db.runTransaction(async (transaction) => {
      const partRef = db.collection('participants').doc(participantId);
      const partSnap = await transaction.get(partRef);
      if (!partSnap.exists) {
        throw new Error(`Validation Error: Participant with ID "${participantId}" was not found.`);
      }

      const currentPart = { id: partSnap.id, ...partSnap.data() } as FirestoreParticipant;

      // Access Control
      if (user.role === 'TEAM_MANAGER') {
        if (user.teamId !== currentPart.teamId) {
          throw new Error('Unauthorized: Team managers can only manage participants from their assigned team.');
        }
        if (updates.teamId && updates.teamId !== currentPart.teamId) {
          throw new Error('Unauthorized: Team managers cannot transfer participants between teams.');
        }
      }

      // F-02: Team Switching Verification
      const oldTeamId = currentPart.teamId;
      const newTeamId = updates.teamId;
      const isTeamChanged = Boolean(newTeamId && oldTeamId && newTeamId !== oldTeamId);

      let oldTeamSnap: FirebaseFirestore.DocumentSnapshot | null = null;
      let newTeamSnap: FirebaseFirestore.DocumentSnapshot | null = null;
      if (isTeamChanged) {
        const oldTeamRef = db.collection('teams').doc(oldTeamId);
        const newTeamRef = db.collection('teams').doc(newTeamId!);
        [oldTeamSnap, newTeamSnap] = await Promise.all([
          transaction.get(oldTeamRef),
          transaction.get(newTeamRef)
        ]);
        if (!newTeamSnap.exists || newTeamSnap.data()?.status === 'DISABLED') {
          throw new Error('Validation Error: Destination team does not exist or is disabled.');
        }
      }

      // F-01: Concurrency-Safe Category Switching Conflict Check
      const oldCatId = currentPart.categoryId;
      const newCatId = updates.categoryId;
      const isCatChanged = Boolean(newCatId && oldCatId && newCatId !== oldCatId);

      let targetCatName = currentPart.categoryName;
      if (isCatChanged) {
        const targetCatRef = db.collection('categories').doc(newCatId!);
        const [targetCatSnap, regsSnap, grpRegsSnap, memberRegsSnap] = await Promise.all([
          transaction.get(targetCatRef),
          transaction.get(db.collection('registrations').where('participantId', '==', participantId)),
          transaction.get(db.collection('registrations').where('groupLeaderId', '==', participantId)),
          transaction.get(db.collection('registrations').where('groupMembers', 'array-contains', participantId))
        ]);

        if (!targetCatSnap.exists || targetCatSnap.data()?.status === 'INACTIVE') {
          throw new Error('Validation Error: Target category does not exist or is inactive.');
        }
        const targetCategory = { id: targetCatSnap.id, ...targetCatSnap.data() } as Category;
        targetCatName = targetCategory.name;

        // Filter active registrations (ignoring REJECTED and CANCELLED)
        const activeRegDocs = [...regsSnap.docs, ...grpRegsSnap.docs, ...memberRegsSnap.docs].filter(d => {
          const st = String(d.data().status || '');
          return st !== 'REJECTED' && st !== 'CANCELLED';
        });

        const seenRegIds = new Set<string>();
        const uniqueActiveRegDocs = activeRegDocs.filter(d => {
          if (seenRegIds.has(d.id)) return false;
          seenRegIds.add(d.id);
          return true;
        });

        if (uniqueActiveRegDocs.length > 0) {
          const compIds = Array.from(new Set(uniqueActiveRegDocs.map(d => String(d.data().competitionId || ''))));
          const compSnaps = await Promise.all(
            compIds.map(cId => transaction.get(db.collection('competitions').doc(cId)))
          );
          const comps = compSnaps.map(s => ({ id: s.id, ...s.data() } as Competition));

          const catIds = Array.from(new Set(comps.map(c => c.categoryId).filter(Boolean)));
          if (!catIds.includes(newCatId!)) {
            catIds.push(newCatId!);
          }
          const catSnaps = await Promise.all(
            catIds.map(catId => transaction.get(db.collection('categories').doc(catId)))
          );
          const allCats = catSnaps.map(s => ({ id: s.id, ...s.data() } as Category));

          const simulatedParticipant: Participant = {
            ...(currentPart as unknown as Participant),
            ...updates,
            categoryId: newCatId!,
            categoryName: targetCatName
          };

          const conflicts: string[] = [];
          for (const regDoc of uniqueActiveRegDocs) {
            const cId = regDoc.data().competitionId;
            const comp = comps.find(c => c.id === cId);
            if (!comp) continue;
            const compCat = allCats.find(c => c.id === comp.categoryId);
            const isEligible = isParticipantEligibleForCategory(simulatedParticipant, compCat, allCats);
            if (!isEligible) {
              conflicts.push(`${comp.code || 'CMP'} (${comp.name || 'Competition'})`);
            }
          }

          if (conflicts.length > 0) {
            throw new Error(
              `Validation Error: Cannot change category for participant "${currentPart.name}". Conflicting active registrations exist in: ${conflicts.join(', ')}. Please resolve conflicting registrations first.`
            );
          }
        }
      }

      // Write participant update
      const now = new Date().toISOString();
      const cleanUpdates = {
        ...updates,
        categoryName: isCatChanged ? targetCatName : (updates.categoryName || currentPart.categoryName),
        updatedAt: now
      };
      transaction.update(partRef, sanitizeForFirestore(cleanUpdates));

      // Synchronize team counters (F-02)
      if (isTeamChanged && oldTeamId && newTeamId && oldTeamSnap && newTeamSnap) {
        if (oldTeamSnap.exists) {
          const currentOld = Number(oldTeamSnap.data()?.contestantsCount) || 0;
          transaction.update(db.collection('teams').doc(oldTeamId), {
            contestantsCount: Math.max(0, currentOld - 1),
            updatedAt: now
          });
        }
        if (newTeamSnap.exists) {
          const currentNew = Number(newTeamSnap.data()?.contestantsCount) || 0;
          transaction.update(db.collection('teams').doc(newTeamId), {
            contestantsCount: currentNew + 1,
            updatedAt: now
          });
        }
      }

      return { ...currentPart, ...cleanUpdates };
    });
  }
}
