/**
 * Phase 1 Data Integrity Verification Test Suite
 * 
 * Verifies against Local Firebase Emulator Suite (demo-sahithyolsav-2025):
 * 
 * 1. F-01: Category Switching Validation & Eligibility Protection
 *    - Participant category change with 0 existing registrations succeeds without blocking.
 *    - Participant category change with existing registrations that remain valid (e.g. General tier) succeeds.
 *    - Participant category change with one or more conflicting registrations is blocked, returning the exact list of conflicts and not modifying the participant.
 *    - Group leader category conflict detection.
 *    - Cancellation / rejection filtering (cancelled/rejected registrations do not block).
 *    - Domain rules for isParticipantEligibleForCategory (SJ, JR, SR, General open tier).
 * 
 * 2. F-02: Team Switching Counter Synchronization
 *    - Participant team change decrements old team contestantsCount and increments new team contestantsCount.
 *    - Transactional atomicity: partial failures leave both teams and the participant in their original state.
 *    - Updating participant fields without changing team does not alter any team contestantsCount.
 *    - Invalid / non-existent old or new team IDs are handled safely without crashing.
 *    - Counts never drop below 0 (clamping at 0).
 * 
 * 3. F-03: Registration Deletion Synchronization
 *    - Deleting a registration removes competition ID from participant registeredEventIds.
 *    - Decrements competition entriesCount by 1.
 *    - Deletes the registration document.
 *    - Prevents negative counts (clamping at 0).
 *    - Safe against duplicate calls (idempotent: second call is a no-op without corrupting counters).
 *    - Handles missing participant or missing competition document gracefully.
 */

import './setupEnv';
import { describe, it, expect, beforeAll } from 'vitest';
import { getAdminDb } from '@/lib/firebase/admin';
import { isParticipantEligibleForCategory } from '@/domain/eligibility';
import { Category, Participant, Registration, Competition } from '@/types/fest';

describe('Phase 1: Data Integrity Verification Test Suite', () => {
  const db = getAdminDb();
  if (!db) {
    throw new Error('Local Firebase Emulator Firestore is not available for test execution.');
  }

  // Common IDs for isolated test data
  const testRunId = `phase1-${Date.now()}`;
  const catSjId = `cat-sj-${testRunId}`;
  const catJrId = `cat-jr-${testRunId}`;
  const catSrId = `cat-sr-${testRunId}`;
  const catGenId = `cat-gen-${testRunId}`;

  const catSJ: Category = {
    id: catSjId,
    name: 'Sub Junior',
    code: 'CAT-SJ',
    classRange: 'Std 1 - 4',
    eligibility: 'Std 1 to 4 students',
    ageRange: '6 - 9 years',
    enrolledCount: 0,
    competitionsCount: 0,
    status: 'ACTIVE'
  };

  const catJR: Category = {
    id: catJrId,
    name: 'Junior',
    code: 'CAT-JR',
    classRange: 'Std 5 - 7',
    eligibility: 'Std 5 to 7 students',
    ageRange: '10 - 12 years',
    enrolledCount: 0,
    competitionsCount: 0,
    status: 'ACTIVE'
  };

  const catSR: Category = {
    id: catSrId,
    name: 'Senior',
    code: 'CAT-SR',
    classRange: 'Std 8 - 12',
    eligibility: 'Std 8 to 12 students',
    ageRange: '13 - 17 years',
    enrolledCount: 0,
    competitionsCount: 0,
    status: 'ACTIVE'
  };

  const catGEN: Category = {
    id: catGenId,
    name: 'General',
    code: 'CAT-GEN',
    classRange: 'Campus wide',
    eligibility: 'All Eligible Students across campus',
    ageRange: 'All ages',
    enrolledCount: 0,
    competitionsCount: 0,
    status: 'ACTIVE'
  };

  beforeAll(async () => {
    // Seed test categories
    await db.collection('categories').doc(catSjId).set(catSJ);
    await db.collection('categories').doc(catJrId).set(catJR);
    await db.collection('categories').doc(catSrId).set(catSR);
    await db.collection('categories').doc(catGenId).set(catGEN);
  });

  // =========================================================================
  // SECTION 1: F-01 Domain Eligibility Engine Rules
  // =========================================================================
  describe('F-01: Eligibility Engine Rules (isParticipantEligibleForCategory)', () => {
    const seniorPart: Participant = {
      id: 'part-sr-1',
      bib: '#1001',
      name: 'Senior Contestant',
      email: 'senior@school.org',
      phone: '+919876543210',
      teamId: 'team-1',
      teamCode: 'SHA',
      teamName: 'Al-Shamama',
      categoryId: catSrId,
      categoryName: 'Senior',
      classGrade: 'Std 11',
      division: 'A',
      dob: '2008-01-01',
      photoUrl: '',
      registeredEventIds: [],
      idStatus: 'GENERATED'
    };

    const juniorPart: Participant = {
      ...seniorPart,
      id: 'part-jr-1',
      categoryId: catJrId,
      categoryName: 'Junior',
      classGrade: 'Std 6'
    };

    const subJuniorPart: Participant = {
      ...seniorPart,
      id: 'part-sj-1',
      categoryId: catSjId,
      categoryName: 'Sub Junior',
      classGrade: 'Std 3'
    };

    it('Allows Senior participant in Senior category competition', () => {
      expect(isParticipantEligibleForCategory(seniorPart, catSR, [catSJ, catJR, catSR, catGEN])).toBe(true);
    });

    it('Allows Junior participant in Junior category competition', () => {
      expect(isParticipantEligibleForCategory(juniorPart, catJR, [catSJ, catJR, catSR, catGEN])).toBe(true);
    });

    it('Allows Sub Junior participant in Sub Junior category competition', () => {
      expect(isParticipantEligibleForCategory(subJuniorPart, catSJ, [catSJ, catJR, catSR, catGEN])).toBe(true);
    });

    it('Allows ANY academic tier participant in Campus-Wide General category', () => {
      expect(isParticipantEligibleForCategory(seniorPart, catGEN, [catSJ, catJR, catSR, catGEN])).toBe(true);
      expect(isParticipantEligibleForCategory(juniorPart, catGEN, [catSJ, catJR, catSR, catGEN])).toBe(true);
      expect(isParticipantEligibleForCategory(subJuniorPart, catGEN, [catSJ, catJR, catSR, catGEN])).toBe(true);
    });

    it('Blocks Senior participant from entering Junior category', () => {
      expect(isParticipantEligibleForCategory(seniorPart, catJR, [catSJ, catJR, catSR, catGEN])).toBe(false);
    });

    it('Blocks Senior participant from entering Sub Junior category', () => {
      expect(isParticipantEligibleForCategory(seniorPart, catSJ, [catSJ, catJR, catSR, catGEN])).toBe(false);
    });

    it('Blocks Junior participant from entering Senior category', () => {
      expect(isParticipantEligibleForCategory(juniorPart, catSR, [catSJ, catJR, catSR, catGEN])).toBe(false);
    });
  });

  // =========================================================================
  // SECTION 2: F-01 Category Switching Conflict Detection (Emulator Integration)
  // =========================================================================
  describe('F-01: Category Switching Validation & Registration Inspection', () => {
    // Helper replicating the Firestore conflict detection logic in FestContext
    async function checkConflicts(participantId: string, newCategoryId: string) {
      const targetCatSnap = await db!.collection('categories').doc(newCategoryId).get();
      const targetCategory = targetCatSnap.exists
        ? ({ id: targetCatSnap.id, ...targetCatSnap.data() } as Category)
        : undefined;

      const allCatsSnap = await db!.collection('categories').get();
      const allCategories = allCatsSnap.docs.map(d => ({ id: d.id, ...d.data() } as Category));

      const compsSnap = await db!.collection('competitions').get();
      const competitionsMap = new Map<string, Competition>();
      compsSnap.docs.forEach(d => {
        competitionsMap.set(d.id, { id: d.id, ...d.data() } as Competition);
      });

      const [directRegsSnap, leaderRegsSnap] = await Promise.all([
        db!.collection('registrations').where('participantId', '==', participantId).get(),
        db!.collection('registrations').where('groupLeaderId', '==', participantId).get()
      ]);

      const seenRegIds = new Set<string>();
      const combinedRegs: Registration[] = [];
      directRegsSnap.docs.forEach(d => {
        if (!seenRegIds.has(d.id)) {
          seenRegIds.add(d.id);
          combinedRegs.push({ id: d.id, ...d.data() } as Registration);
        }
      });
      leaderRegsSnap.docs.forEach(d => {
        if (!seenRegIds.has(d.id)) {
          seenRegIds.add(d.id);
          combinedRegs.push({ id: d.id, ...d.data() } as Registration);
        }
      });

      const activeRegs = combinedRegs.filter(r => (r.status as string) !== 'REJECTED' && (r.status as string) !== 'CANCELLED');

      const mockParticipant: Participant = {
        id: participantId,
        bib: '#9999',
        name: 'Mock Contestant',
        email: 'mock@test.com',
        phone: '1234567890',
        teamId: 'team-1',
        teamCode: 'SHA',
        teamName: 'Team 1',
        categoryId: newCategoryId,
        categoryName: targetCategory?.name || '',
        classGrade: 'Std 10',
        division: 'A',
        dob: '2008-01-01',
        photoUrl: '',
        registeredEventIds: [],
        idStatus: 'GENERATED'
      };

      const conflicts = [];
      for (const reg of activeRegs) {
        const comp = competitionsMap.get(reg.competitionId);
        if (!comp) continue;

        const compCat = allCategories.find(c => c.id === comp.categoryId);
        const isEligible = isParticipantEligibleForCategory(mockParticipant, compCat, allCategories);
        if (!isEligible) {
          conflicts.push({
            registrationId: reg.id,
            registrationCode: reg.code || reg.id,
            competitionId: comp.id,
            competitionName: comp.name,
            competitionCode: comp.code,
            competitionCategoryName: compCat?.name || comp.categoryName || 'Unknown Category'
          });
        }
      }

      return conflicts;
    }

    it('Category change with 0 existing registrations returns 0 conflicts (succeeds)', async () => {
      const partId = `part-0reg-${testRunId}`;
      await db.collection('participants').doc(partId).set({
        id: partId,
        name: 'Zero Reg Student',
        categoryId: catSrId,
        categoryName: 'Senior',
        registeredEventIds: []
      });

      const conflicts = await checkConflicts(partId, catJrId);
      expect(conflicts).toHaveLength(0);
    });

    it('Category change with existing registrations in General category returns 0 conflicts (valid across tiers)', async () => {
      const partId = `part-genreg-${testRunId}`;
      const compGenId = `cmp-gen-${testRunId}`;
      const regGenId = `reg-gen-${testRunId}`;

      // Create General tier competition
      await db.collection('competitions').doc(compGenId).set({
        id: compGenId,
        name: 'Campus Open Quiz',
        code: 'GEN-QZ',
        categoryId: catGenId,
        categoryName: 'General',
        type: 'INDIVIDUAL',
        entriesCount: 1
      });

      // Create Senior student registered in General competition
      await db.collection('participants').doc(partId).set({
        id: partId,
        name: 'General Reg Student',
        categoryId: catSrId,
        categoryName: 'Senior',
        registeredEventIds: [compGenId]
      });

      await db.collection('registrations').doc(regGenId).set({
        id: regGenId,
        code: 'REG-GEN-001',
        participantId: partId,
        competitionId: compGenId,
        status: 'APPROVED'
      });

      // Switch to Junior: General event is valid for Junior too, so 0 conflicts
      const conflicts = await checkConflicts(partId, catJrId);
      expect(conflicts).toHaveLength(0);
    });

    it('Category change with conflicting Senior-restricted competition is blocked and returns conflict details', async () => {
      const partId = `part-conflict-${testRunId}`;
      const compSrId = `cmp-sr-${testRunId}`;
      const regSrId = `reg-sr-${testRunId}`;

      // Create Senior restricted competition
      await db.collection('competitions').doc(compSrId).set({
        id: compSrId,
        name: 'Senior English Elocution',
        code: 'SR-ELO',
        categoryId: catSrId,
        categoryName: 'Senior',
        type: 'INDIVIDUAL',
        entriesCount: 1
      });

      // Create Senior participant with active registration in Senior event
      await db.collection('participants').doc(partId).set({
        id: partId,
        name: 'Senior Conflict Student',
        categoryId: catSrId,
        categoryName: 'Senior',
        registeredEventIds: [compSrId]
      });

      await db.collection('registrations').doc(regSrId).set({
        id: regSrId,
        code: 'REG-SR-042',
        participantId: partId,
        competitionId: compSrId,
        status: 'APPROVED'
      });

      // Attempt switch to Junior: Must identify conflict
      const conflicts = await checkConflicts(partId, catJrId);
      expect(conflicts).toHaveLength(1);
      expect(conflicts[0].registrationId).toBe(regSrId);
      expect(conflicts[0].registrationCode).toBe('REG-SR-042');
      expect(conflicts[0].competitionId).toBe(compSrId);
      expect(conflicts[0].competitionName).toBe('Senior English Elocution');
      expect(conflicts[0].competitionCode).toBe('SR-ELO');
      expect(conflicts[0].competitionCategoryName).toBe('Senior');
    });

    it('Detects conflict when participant is group leader for restricted category group event', async () => {
      const leaderId = `leader-conflict-${testRunId}`;
      const compGroupSrId = `cmp-grp-sr-${testRunId}`;
      const regGroupId = `reg-grp-sr-${testRunId}`;

      await db.collection('competitions').doc(compGroupSrId).set({
        id: compGroupSrId,
        name: 'Senior Group Song',
        code: 'SR-SNG',
        categoryId: catSrId,
        categoryName: 'Senior',
        type: 'GROUP',
        groupSize: 4,
        entriesCount: 1
      });

      await db.collection('participants').doc(leaderId).set({
        id: leaderId,
        name: 'Group Leader Contestant',
        categoryId: catSrId,
        categoryName: 'Senior',
        registeredEventIds: [compGroupSrId]
      });

      await db.collection('registrations').doc(regGroupId).set({
        id: regGroupId,
        code: 'REG-GRP-099',
        groupLeaderId: leaderId,
        competitionId: compGroupSrId,
        status: 'APPROVED'
      });

      const conflicts = await checkConflicts(leaderId, catJrId);
      expect(conflicts).toHaveLength(1);
      expect(conflicts[0].competitionCode).toBe('SR-SNG');
    });

    it('Does NOT flag rejected or cancelled registrations as conflicts', async () => {
      const partId = `part-cancelled-${testRunId}`;
      const compSrId = `cmp-sr-canc-${testRunId}`;
      const regCancelledId = `reg-sr-canc-${testRunId}`;

      await db.collection('competitions').doc(compSrId).set({
        id: compSrId,
        name: 'Senior Recitation',
        code: 'SR-REC',
        categoryId: catSrId,
        categoryName: 'Senior',
        type: 'INDIVIDUAL',
        entriesCount: 0
      });

      await db.collection('participants').doc(partId).set({
        id: partId,
        name: 'Cancelled Reg Student',
        categoryId: catSrId,
        categoryName: 'Senior',
        registeredEventIds: []
      });

      await db.collection('registrations').doc(regCancelledId).set({
        id: regCancelledId,
        code: 'REG-CANC-001',
        participantId: partId,
        competitionId: compSrId,
        status: 'REJECTED'
      });

      const conflicts = await checkConflicts(partId, catJrId);
      expect(conflicts).toHaveLength(0);
    });

    it('Defensively rejects participant update when category conflict exists', async () => {
      const partId = `part-defensive-${testRunId}`;
      const compSrId = `cmp-defensive-sr-${testRunId}`;
      const regId = `reg-defensive-${testRunId}`;

      await db.collection('competitions').doc(compSrId).set({
        id: compSrId,
        name: 'Senior Essay',
        code: 'SR-ESS',
        categoryId: catSrId,
        categoryName: 'Senior',
        type: 'INDIVIDUAL'
      });

      await db.collection('participants').doc(partId).set({
        id: partId,
        name: 'Defensive Check Student',
        categoryId: catSrId,
        categoryName: 'Senior'
      });

      await db.collection('registrations').doc(regId).set({
        id: regId,
        code: 'REG-DEF-001',
        participantId: partId,
        competitionId: compSrId,
        status: 'APPROVED'
      });

      // Simulation of updateParticipant defensive gate
      const attemptCategoryUpdate = async (newCatId: string) => {
        const conflicts = await checkConflicts(partId, newCatId);
        if (conflicts.length > 0) {
          throw new Error(
            `Cannot switch category: Participant has ${conflicts.length} active registration(s) conflicting with the requested category.`
          );
        }
        await db!.collection('participants').doc(partId).update({ categoryId: newCatId });
      };

      await expect(attemptCategoryUpdate(catJrId)).rejects.toThrow(
        /Cannot switch category: Participant has 1 active registration\(s\)/
      );

      // Verify participant category was NOT modified
      const snap = await db.collection('participants').doc(partId).get();
      expect(snap.data()?.categoryId).toBe(catSrId);
    });
  });

  // =========================================================================
  // SECTION 3: F-02 Team Switching Counter Synchronization (Emulator Integration)
  // =========================================================================
  describe('F-02: Team Switching Counter Synchronization', () => {
    // Helper replicating updateParticipant transaction logic
    async function updateParticipantWithTeamSync(
      participantId: string,
      updates: Partial<Participant>
    ) {
      await db!.runTransaction(async (transaction) => {
        const partRef = db!.collection('participants').doc(participantId);
        const partSnap = await transaction.get(partRef);

        const currentPart = partSnap.exists ? (partSnap.data() as Participant) : null;
        const txOldTeamId = currentPart?.teamId;
        const txNewTeamId = updates.teamId;
        const txTeamChanged = Boolean(txNewTeamId && txOldTeamId && txNewTeamId !== txOldTeamId);

        let oldTeamSnap = null;
        let newTeamSnap = null;

        if (txTeamChanged && txOldTeamId && txNewTeamId) {
          const oldTeamRef = db!.collection('teams').doc(txOldTeamId);
          const newTeamRef = db!.collection('teams').doc(txNewTeamId);
          oldTeamSnap = await transaction.get(oldTeamRef);
          newTeamSnap = await transaction.get(newTeamRef);
        }

        // Write participant update
        transaction.set(partRef, updates, { merge: true });

        // Update team counts atomically
        if (txTeamChanged && txOldTeamId && txNewTeamId) {
          if (oldTeamSnap && oldTeamSnap.exists) {
            const oldTeamRef = db!.collection('teams').doc(txOldTeamId);
            const currentOldCount = Number(oldTeamSnap.data()?.contestantsCount) || 0;
            const updatedOldCount = Math.max(0, currentOldCount - 1);
            transaction.update(oldTeamRef, { contestantsCount: updatedOldCount });
          }

          if (newTeamSnap && newTeamSnap.exists) {
            const newTeamRef = db!.collection('teams').doc(txNewTeamId);
            const currentNewCount = Number(newTeamSnap.data()?.contestantsCount) || 0;
            transaction.update(newTeamRef, { contestantsCount: currentNewCount + 1 });
          }
        }
      });
    }

    it('Decrements old team contestantsCount and increments new team contestantsCount atomically', async () => {
      const teamAId = `team-alpha-${testRunId}`;
      const teamBId = `team-beta-${testRunId}`;
      const partId = `part-team-switch-${testRunId}`;

      await db.collection('teams').doc(teamAId).set({
        id: teamAId,
        name: 'Team Alpha',
        code: 'ALP',
        contestantsCount: 3
      });

      await db.collection('teams').doc(teamBId).set({
        id: teamBId,
        name: 'Team Beta',
        code: 'BET',
        contestantsCount: 5
      });

      await db.collection('participants').doc(partId).set({
        id: partId,
        name: 'Team Switch Contestant',
        teamId: teamAId,
        teamCode: 'ALP',
        teamName: 'Team Alpha'
      });

      // Switch from Team Alpha to Team Beta
      await updateParticipantWithTeamSync(partId, {
        teamId: teamBId,
        teamCode: 'BET',
        teamName: 'Team Beta'
      });

      // Verify Team Alpha decremented to 2
      const teamASnap = await db.collection('teams').doc(teamAId).get();
      expect(teamASnap.data()?.contestantsCount).toBe(2);

      // Verify Team Beta incremented to 6
      const teamBSnap = await db.collection('teams').doc(teamBId).get();
      expect(teamBSnap.data()?.contestantsCount).toBe(6);

      // Verify participant updated
      const partSnap = await db.collection('participants').doc(partId).get();
      expect(partSnap.data()?.teamId).toBe(teamBId);
      expect(partSnap.data()?.teamCode).toBe('BET');
    });

    it('Updating participant fields without changing team preserves all team counters', async () => {
      const teamCId = `team-gamma-${testRunId}`;
      const partId = `part-no-team-change-${testRunId}`;

      await db.collection('teams').doc(teamCId).set({
        id: teamCId,
        name: 'Team Gamma',
        code: 'GAM',
        contestantsCount: 7
      });

      await db.collection('participants').doc(partId).set({
        id: partId,
        name: 'Gamma Student',
        phone: '+919876543210',
        teamId: teamCId,
        teamCode: 'GAM',
        teamName: 'Team Gamma'
      });

      // Update phone only (same teamId)
      await updateParticipantWithTeamSync(partId, {
        phone: '+919999988888',
        teamId: teamCId,
        teamCode: 'GAM',
        teamName: 'Team Gamma'
      });

      const teamSnap = await db.collection('teams').doc(teamCId).get();
      expect(teamSnap.data()?.contestantsCount).toBe(7);

      const partSnap = await db.collection('participants').doc(partId).get();
      expect(partSnap.data()?.phone).toBe('+919999988888');
    });

    it('Clamps contestantsCount to 0 and never allows negative counts', async () => {
      const teamZeroId = `team-zero-${testRunId}`;
      const teamTargetId = `team-target-${testRunId}`;
      const partId = `part-zero-clamp-${testRunId}`;

      // Team with 0 count
      await db.collection('teams').doc(teamZeroId).set({
        id: teamZeroId,
        name: 'Team Zero',
        code: 'ZER',
        contestantsCount: 0
      });

      await db.collection('teams').doc(teamTargetId).set({
        id: teamTargetId,
        name: 'Team Target',
        code: 'TGT',
        contestantsCount: 0
      });

      await db.collection('participants').doc(partId).set({
        id: partId,
        name: 'Zero Count Student',
        teamId: teamZeroId,
        teamCode: 'ZER',
        teamName: 'Team Zero'
      });

      // Switch away from Team Zero
      await updateParticipantWithTeamSync(partId, {
        teamId: teamTargetId,
        teamCode: 'TGT',
        teamName: 'Team Target'
      });

      const teamZeroSnap = await db.collection('teams').doc(teamZeroId).get();
      expect(teamZeroSnap.data()?.contestantsCount).toBe(0); // Clamped, not -1

      const teamTargetSnap = await db.collection('teams').doc(teamTargetId).get();
      expect(teamTargetSnap.data()?.contestantsCount).toBe(1);
    });

    it('Handles missing or non-existent team IDs safely without crashing', async () => {
      const nonExistentTeamId = `team-missing-${testRunId}`;
      const partId = `part-missing-team-${testRunId}`;

      await db.collection('participants').doc(partId).set({
        id: partId,
        name: 'Missing Team Student',
        teamId: 'team-prev-nonexistent'
      });

      // Should complete without throwing
      await expect(
        updateParticipantWithTeamSync(partId, {
          teamId: nonExistentTeamId,
          teamName: 'Non Existent'
        })
      ).resolves.not.toThrow();

      const partSnap = await db.collection('participants').doc(partId).get();
      expect(partSnap.data()?.teamId).toBe(nonExistentTeamId);
    });

    it('Transactional atomicity: abort rolls back changes completely', async () => {
      const teamAtomAId = `team-atom-a-${testRunId}`;
      const teamAtomBId = `team-atom-b-${testRunId}`;
      const partId = `part-atom-${testRunId}`;

      await db.collection('teams').doc(teamAtomAId).set({
        id: teamAtomAId,
        name: 'Team Atom A',
        contestantsCount: 10
      });

      await db.collection('teams').doc(teamAtomBId).set({
        id: teamAtomBId,
        name: 'Team Atom B',
        contestantsCount: 20
      });

      await db.collection('participants').doc(partId).set({
        id: partId,
        name: 'Atom Contestant',
        teamId: teamAtomAId
      });

      // Intentionally aborted transaction
      try {
        await db.runTransaction(async (transaction) => {
          const oldTeamRef = db.collection('teams').doc(teamAtomAId);
          const newTeamRef = db.collection('teams').doc(teamAtomBId);
          const partRef = db.collection('participants').doc(partId);

          transaction.update(oldTeamRef, { contestantsCount: 9 });
          transaction.update(newTeamRef, { contestantsCount: 21 });
          transaction.update(partRef, { teamId: teamAtomBId });

          // Simulate mid-transaction failure
          throw new Error('SIMULATED_TRANSACTION_FAILURE');
        });
      } catch (err: unknown) {
        expect((err as Error).message).toBe('SIMULATED_TRANSACTION_FAILURE');
      }

      // Verify no changes were committed
      const oldSnap = await db.collection('teams').doc(teamAtomAId).get();
      const newSnap = await db.collection('teams').doc(teamAtomBId).get();
      const partSnap = await db.collection('participants').doc(partId).get();

      expect(oldSnap.data()?.contestantsCount).toBe(10);
      expect(newSnap.data()?.contestantsCount).toBe(20);
      expect(partSnap.data()?.teamId).toBe(teamAtomAId);
    });
  });

  // =========================================================================
  // SECTION 4: F-03 Registration Deletion Synchronization (Emulator Integration)
  // =========================================================================
  describe('F-03: Registration Deletion Synchronization', () => {
    // Helper replicating deleteRegistration transaction logic
    async function deleteRegistrationWithSync(registrationId: string) {
      await db!.runTransaction(async (transaction) => {
        const regRef = db!.collection('registrations').doc(registrationId);
        const regSnap = await transaction.get(regRef);

        // Safe idempotency: if registration does not exist, return cleanly
        if (!regSnap.exists) {
          return;
        }

        const regData = regSnap.data() as Registration;
        const compId = regData.competitionId;
        const partId = regData.participantId || regData.groupLeaderId;

        let compSnap = null;
        let partSnap = null;

        if (compId) {
          const compRef = db!.collection('competitions').doc(compId);
          compSnap = await transaction.get(compRef);
        }

        if (partId) {
          const partRef = db!.collection('participants').doc(partId);
          partSnap = await transaction.get(partRef);
        }

        // 1. Delete registration document
        transaction.delete(regRef);

        // 2. Decrement competition entriesCount (prevent negative counts)
        if (compId && compSnap && compSnap.exists) {
          const compRef = db!.collection('competitions').doc(compId);
          const currentEntries = Number(compSnap.data()?.entriesCount) || 0;
          const updatedEntries = Math.max(0, currentEntries - 1);
          transaction.update(compRef, { entriesCount: updatedEntries });
        }

        // 3. Remove competitionId from participant registeredEventIds
        if (partId && partSnap && partSnap.exists && compId) {
          const partRef = db!.collection('participants').doc(partId);
          const currentEvents: string[] = partSnap.data()?.registeredEventIds || [];
          const updatedEvents = currentEvents.filter(id => id !== compId);
          transaction.update(partRef, { registeredEventIds: updatedEvents });
        }
      });
    }

    it('Deletes registration doc, decrements competition entriesCount, and removes event ID from participant', async () => {
      const compId = `cmp-del-sync-${testRunId}`;
      const partId = `part-del-sync-${testRunId}`;
      const regId = `reg-del-sync-${testRunId}`;

      await db.collection('competitions').doc(compId).set({
        id: compId,
        name: 'Sync Essay',
        code: 'ESS-SYNC',
        entriesCount: 4
      });

      await db.collection('participants').doc(partId).set({
        id: partId,
        name: 'Sync Contestant',
        registeredEventIds: [compId, 'cmp-other-1', 'cmp-other-2']
      });

      await db.collection('registrations').doc(regId).set({
        id: regId,
        code: 'REG-SYNC-01',
        competitionId: compId,
        participantId: partId,
        status: 'APPROVED'
      });

      // Execute deletion
      await deleteRegistrationWithSync(regId);

      // 1. Registration doc must be deleted
      const regSnap = await db.collection('registrations').doc(regId).get();
      expect(regSnap.exists).toBe(false);

      // 2. Competition entriesCount decremented from 4 to 3
      const compSnap = await db.collection('competitions').doc(compId).get();
      expect(compSnap.data()?.entriesCount).toBe(3);

      // 3. Participant registeredEventIds stripped of compId
      const partSnap = await db.collection('participants').doc(partId).get();
      expect(partSnap.data()?.registeredEventIds).toEqual(['cmp-other-1', 'cmp-other-2']);
    });

    it('Clamps competition entriesCount to 0 and never allows negative count', async () => {
      const compId = `cmp-del-zero-${testRunId}`;
      const partId = `part-del-zero-${testRunId}`;
      const regId = `reg-del-zero-${testRunId}`;

      await db.collection('competitions').doc(compId).set({
        id: compId,
        name: 'Zero Entries Competition',
        entriesCount: 0
      });

      await db.collection('participants').doc(partId).set({
        id: partId,
        name: 'Zero Entry Participant',
        registeredEventIds: [compId]
      });

      await db.collection('registrations').doc(regId).set({
        id: regId,
        competitionId: compId,
        participantId: partId,
        status: 'APPROVED'
      });

      await deleteRegistrationWithSync(regId);

      const compSnap = await db.collection('competitions').doc(compId).get();
      expect(compSnap.data()?.entriesCount).toBe(0); // Never -1
    });

    it('Is idempotent: repeated calls do NOT double-decrement or throw errors', async () => {
      const compId = `cmp-del-idemp-${testRunId}`;
      const partId = `part-del-idemp-${testRunId}`;
      const regId = `reg-del-idemp-${testRunId}`;

      await db.collection('competitions').doc(compId).set({
        id: compId,
        name: 'Idempotent Competition',
        entriesCount: 5
      });

      await db.collection('participants').doc(partId).set({
        id: partId,
        name: 'Idempotent Participant',
        registeredEventIds: [compId]
      });

      await db.collection('registrations').doc(regId).set({
        id: regId,
        competitionId: compId,
        participantId: partId,
        status: 'APPROVED'
      });

      // Call 1: Decrements 5 -> 4
      await deleteRegistrationWithSync(regId);
      const snapAfterFirst = await db.collection('competitions').doc(compId).get();
      expect(snapAfterFirst.data()?.entriesCount).toBe(4);

      // Call 2: Registration already deleted -> Safe no-op, entriesCount stays 4
      await expect(deleteRegistrationWithSync(regId)).resolves.not.toThrow();
      const snapAfterSecond = await db.collection('competitions').doc(compId).get();
      expect(snapAfterSecond.data()?.entriesCount).toBe(4); // Did NOT decrement to 3
    });

    it('Gracefully handles missing participant or missing competition document', async () => {
      const missingCompRegId = `reg-missing-comp-${testRunId}`;
      const missingPartRegId = `reg-missing-part-${testRunId}`;

      // Registration pointing to non-existent competition
      await db.collection('registrations').doc(missingCompRegId).set({
        id: missingCompRegId,
        competitionId: 'non-existent-competition-id',
        participantId: 'some-part-id',
        status: 'APPROVED'
      });

      // Registration pointing to non-existent participant
      await db.collection('registrations').doc(missingPartRegId).set({
        id: missingPartRegId,
        competitionId: 'some-comp-id',
        participantId: 'non-existent-participant-id',
        status: 'APPROVED'
      });

      // Both deletions should succeed safely
      await expect(deleteRegistrationWithSync(missingCompRegId)).resolves.not.toThrow();
      await expect(deleteRegistrationWithSync(missingPartRegId)).resolves.not.toThrow();

      const reg1 = await db.collection('registrations').doc(missingCompRegId).get();
      const reg2 = await db.collection('registrations').doc(missingPartRegId).get();
      expect(reg1.exists).toBe(false);
      expect(reg2.exists).toBe(false);
    });
  });
});
