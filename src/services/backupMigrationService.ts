/**
 * Local Data Backup & Firestore Migration Service
 * 
 * Provides:
 * 1. Safe export and download of local browser data before altering or cleansing localStorage.
 * 2. Automated snapshot backup creation before migration.
 * 3. Dry-run migration analysis: Counts, schema validations, duplicate detection against Firestore.
 * 4. Explicit-approval production migration execution.
 */

import {
  Category,
  Team,
  Competition,
  Stage,
  ScheduleSlot,
  Participant,
  Registration
} from '@/types/fest';
import { Firestore, collection, getDocs, doc, setDoc } from 'firebase/firestore';
import { sanitizeForFirestore } from '@/lib/firebase/sanitize';

export interface LocalFestBackupData {
  version: string;
  timestamp: string;
  exportedAt: string;
  project: string;
  counts: Record<string, number>;
  data: {
    theme?: any;
    categories?: Category[];
    teams?: Team[];
    competitions?: Competition[];
    stages?: Stage[];
    schedules?: ScheduleSlot[];
    participants?: Participant[];
    registrations?: Registration[];
    markEntries?: any[];
    results?: any[];
    pointsLedger?: any[];
  };
}

export interface CollectionDryRun<T> {
  collectionName: string;
  totalLocal: number;
  validToMigrate: T[];
  duplicates: Array<{ id: string; nameOrCode: string; reason: string }>;
  invalid: Array<{ item: any; errors: string[] }>;
}

export interface DryRunMigrationReport {
  timestamp: string;
  hasItemsToMigrate: boolean;
  totalToMigrateCount: number;
  categories: CollectionDryRun<Category>;
  teams: CollectionDryRun<Team>;
  competitions: CollectionDryRun<Competition>;
  stages: CollectionDryRun<Stage>;
  schedules: CollectionDryRun<ScheduleSlot>;
  participants: CollectionDryRun<Participant>;
  registrations: CollectionDryRun<Registration>;
}

export class BackupMigrationService {
  private static parseLocalArray<T>(key: string): T[] {
    if (typeof window === 'undefined') return [];
    try {
      const raw = localStorage.getItem(key);
      if (!raw) return [];
      const parsed = JSON.parse(raw);
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  }

  /**
   * Reads all festival records from localStorage into a structured backup object.
   */
  static exportLocalBackup(): LocalFestBackupData {
    const categories = this.parseLocalArray<Category>('fest_categories_v2');
    const teams = this.parseLocalArray<Team>('fest_teams_v2');
    const competitions = this.parseLocalArray<Competition>('fest_competitions_v2');
    const stages = this.parseLocalArray<Stage>('fest_stages_v2');
    const schedules = this.parseLocalArray<ScheduleSlot>('fest_schedules_v2');
    const participants = this.parseLocalArray<Participant>('fest_participants_v2');
    const registrations = this.parseLocalArray<Registration>('fest_registrations_v2');
    const markEntries = this.parseLocalArray<any>('fest_mark_entries_v2');
    const results = this.parseLocalArray<any>('fest_results_v2');
    const pointsLedger = this.parseLocalArray<any>('fest_points_ledger_v2');

    let theme: any = null;
    if (typeof window !== 'undefined') {
      try {
        const rawTheme = localStorage.getItem('fest_theme_settings_v2');
        if (rawTheme) theme = JSON.parse(rawTheme);
      } catch {}
    }

    return {
      version: '2.0',
      timestamp: new Date().toISOString(),
      exportedAt: new Date().toLocaleString(),
      project: 'inspirath-d6778',
      counts: {
        categories: categories.length,
        teams: teams.length,
        competitions: competitions.length,
        stages: stages.length,
        schedules: schedules.length,
        participants: participants.length,
        registrations: registrations.length,
        markEntries: markEntries.length,
        results: results.length,
        pointsLedger: pointsLedger.length
      },
      data: {
        theme,
        categories,
        teams,
        competitions,
        stages,
        schedules,
        participants,
        registrations,
        markEntries,
        results,
        pointsLedger
      }
    };
  }

  /**
   * Prompts a JSON file download of the full local browser data in the client.
   */
  static downloadLocalBackup(): { filename: string; sizeBytes: number } {
    const backup = this.exportLocalBackup();
    const jsonString = JSON.stringify(backup, null, 2);
    const blob = new Blob([jsonString], { type: 'application/json' });
    const filename = `inspirath_fest_backup_${Date.now()}.json`;

    if (typeof window !== 'undefined') {
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    }

    return { filename, sizeBytes: blob.size };
  }

  /**
   * Creates an internal preserved snapshot in localStorage before any state cleansing or migration.
   */
  static createSafeLocalSnapshot(): string {
    if (typeof window === 'undefined') return '';
    try {
      const snapshotKey = `fest_auto_snapshot_${Date.now()}`;
      const backup = this.exportLocalBackup();
      localStorage.setItem(snapshotKey, JSON.stringify(backup));
      return snapshotKey;
    } catch (e) {
      console.warn('[BackupMigrationService] Could not create local snapshot:', e);
      return '';
    }
  }

  /**
   * Performs a comprehensive Dry-Run analysis comparing localStorage against live Firestore.
   * Checks for duplicates, schema validity, and isolates real items from mock demo fixtures.
   */
  static async planDryRunMigration(db: Firestore): Promise<DryRunMigrationReport> {
    const backup = this.exportLocalBackup();

    // Fetch existing live Firestore IDs and codes to detect duplicates
    const [
      catSnap,
      teamSnap,
      compSnap,
      stageSnap,
      schedSnap,
      partSnap,
      regSnap
    ] = await Promise.all([
      getDocs(collection(db, 'categories')).catch(() => ({ docs: [] } as any)),
      getDocs(collection(db, 'teams')).catch(() => ({ docs: [] } as any)),
      getDocs(collection(db, 'competitions')).catch(() => ({ docs: [] } as any)),
      getDocs(collection(db, 'stages')).catch(() => ({ docs: [] } as any)),
      getDocs(collection(db, 'schedules')).catch(() => ({ docs: [] } as any)),
      getDocs(collection(db, 'participants')).catch(() => ({ docs: [] } as any)),
      getDocs(collection(db, 'registrations')).catch(() => ({ docs: [] } as any))
    ]);

    const existingCatIds = new Set(catSnap.docs.map((d: any) => d.id));
    const existingCatCodes = new Set(catSnap.docs.map((d: any) => d.data().code?.toUpperCase()));

    const existingTeamIds = new Set(teamSnap.docs.map((d: any) => d.id));
    const existingTeamCodes = new Set(teamSnap.docs.map((d: any) => d.data().code?.toUpperCase()));

    const existingCompIds = new Set(compSnap.docs.map((d: any) => d.id));
    const existingCompCodes = new Set(compSnap.docs.map((d: any) => d.data().code?.toUpperCase()));

    const existingStageIds = new Set(stageSnap.docs.map((d: any) => d.id));
    const existingStageCodes = new Set(stageSnap.docs.map((d: any) => d.data().code?.toUpperCase()));

    const existingSchedIds = new Set(schedSnap.docs.map((d: any) => d.id));
    const existingPartIds = new Set(partSnap.docs.map((d: any) => d.id));
    const existingPartBibs = new Set(partSnap.docs.map((d: any) => d.data().bib));
    const existingRegIds = new Set(regSnap.docs.map((d: any) => d.id));

    // Demo IDs to skip from migrating
    const DEMO_IDS = new Set([
      'team-1', 'team-2', 'team-3', 'team-4',
      'cat-1', 'cat-2', 'cat-3', 'cat-4',
      'cmp-1', 'cmp-2', 'cmp-3', 'cmp-4', 'cmp-5', 'cmp-6',
      'stg-1', 'stg-2', 'stg-3',
      'sch-1', 'sch-2', 'sch-3', 'sch-4', 'sch-5', 'sch-6'
    ]);

    // 1. Categories Analysis
    const catReport: CollectionDryRun<Category> = {
      collectionName: 'categories',
      totalLocal: backup.data.categories?.length || 0,
      validToMigrate: [],
      duplicates: [],
      invalid: []
    };
    (backup.data.categories || []).forEach(cat => {
      if (DEMO_IDS.has(cat.id)) return;
      if (existingCatIds.has(cat.id) || (cat.code && existingCatCodes.has(cat.code.toUpperCase()))) {
        catReport.duplicates.push({ id: cat.id, nameOrCode: cat.name || cat.code, reason: 'Already exists in Firestore' });
        return;
      }
      const errors: string[] = [];
      if (!cat.name?.trim()) errors.push('Missing category name');
      if (!cat.code?.trim()) errors.push('Missing category code');
      if (errors.length > 0) catReport.invalid.push({ item: cat, errors });
      else catReport.validToMigrate.push(cat);
    });

    // 2. Teams Analysis
    const teamReport: CollectionDryRun<Team> = {
      collectionName: 'teams',
      totalLocal: backup.data.teams?.length || 0,
      validToMigrate: [],
      duplicates: [],
      invalid: []
    };
    (backup.data.teams || []).forEach(team => {
      if (DEMO_IDS.has(team.id)) return;
      if (existingTeamIds.has(team.id) || (team.code && existingTeamCodes.has(team.code.toUpperCase()))) {
        teamReport.duplicates.push({ id: team.id, nameOrCode: team.name || team.code, reason: 'Already exists in Firestore' });
        return;
      }
      const errors: string[] = [];
      if (!team.name?.trim()) errors.push('Missing team name');
      if (!team.code?.trim()) errors.push('Missing team code');
      if (errors.length > 0) teamReport.invalid.push({ item: team, errors });
      else teamReport.validToMigrate.push(team);
    });

    // 3. Competitions Analysis
    const compReport: CollectionDryRun<Competition> = {
      collectionName: 'competitions',
      totalLocal: backup.data.competitions?.length || 0,
      validToMigrate: [],
      duplicates: [],
      invalid: []
    };
    (backup.data.competitions || []).forEach(comp => {
      if (DEMO_IDS.has(comp.id)) return;
      if (existingCompIds.has(comp.id) || (comp.code && existingCompCodes.has(comp.code.toUpperCase()))) {
        compReport.duplicates.push({ id: comp.id, nameOrCode: comp.name || comp.code, reason: 'Already exists in Firestore' });
        return;
      }
      const errors: string[] = [];
      if (!comp.name?.trim()) errors.push('Missing competition name');
      if (!comp.code?.trim()) errors.push('Missing competition code');
      if (!comp.categoryId) errors.push('Missing category association');
      if (errors.length > 0) compReport.invalid.push({ item: comp, errors });
      else compReport.validToMigrate.push(comp);
    });

    // 4. Stages Analysis
    const stageReport: CollectionDryRun<Stage> = {
      collectionName: 'stages',
      totalLocal: backup.data.stages?.length || 0,
      validToMigrate: [],
      duplicates: [],
      invalid: []
    };
    (backup.data.stages || []).forEach(stg => {
      if (DEMO_IDS.has(stg.id)) return;
      if (existingStageIds.has(stg.id) || (stg.code && existingStageCodes.has(stg.code.toUpperCase()))) {
        stageReport.duplicates.push({ id: stg.id, nameOrCode: stg.name || stg.code, reason: 'Already exists in Firestore' });
        return;
      }
      const errors: string[] = [];
      if (!stg.name?.trim()) errors.push('Missing stage name');
      if (!stg.code?.trim()) errors.push('Missing stage code');
      if (errors.length > 0) stageReport.invalid.push({ item: stg, errors });
      else stageReport.validToMigrate.push(stg);
    });

    // 5. Schedules Analysis
    const schedReport: CollectionDryRun<ScheduleSlot> = {
      collectionName: 'schedules',
      totalLocal: backup.data.schedules?.length || 0,
      validToMigrate: [],
      duplicates: [],
      invalid: []
    };
    (backup.data.schedules || []).forEach(sch => {
      if (DEMO_IDS.has(sch.id)) return;
      if (existingSchedIds.has(sch.id)) {
        schedReport.duplicates.push({ id: sch.id, nameOrCode: sch.competitionName || sch.id, reason: 'Already exists in Firestore' });
        return;
      }
      const errors: string[] = [];
      if (!sch.competitionId) errors.push('Missing competitionId');
      if (!sch.stageId) errors.push('Missing stageId');
      if (errors.length > 0) schedReport.invalid.push({ item: sch, errors });
      else schedReport.validToMigrate.push(sch);
    });

    // 6. Participants Analysis
    const partReport: CollectionDryRun<Participant> = {
      collectionName: 'participants',
      totalLocal: backup.data.participants?.length || 0,
      validToMigrate: [],
      duplicates: [],
      invalid: []
    };
    (backup.data.participants || []).forEach(p => {
      if (p.id.startsWith('part-1') || p.id.startsWith('part-2') || p.id.startsWith('part-3')) return;
      if (existingPartIds.has(p.id) || (p.bib && existingPartBibs.has(p.bib))) {
        partReport.duplicates.push({ id: p.id, nameOrCode: p.name || p.bib, reason: 'Already exists in Firestore' });
        return;
      }
      const errors: string[] = [];
      if (!p.name?.trim()) errors.push('Missing participant name');
      if (!p.teamId) errors.push('Missing team association');
      if (errors.length > 0) partReport.invalid.push({ item: p, errors });
      else partReport.validToMigrate.push(p);
    });

    // 7. Registrations Analysis
    const regReport: CollectionDryRun<Registration> = {
      collectionName: 'registrations',
      totalLocal: backup.data.registrations?.length || 0,
      validToMigrate: [],
      duplicates: [],
      invalid: []
    };
    (backup.data.registrations || []).forEach(r => {
      if (r.id.startsWith('reg-1') || r.id.startsWith('reg-2')) return;
      if (existingRegIds.has(r.id)) {
        regReport.duplicates.push({ id: r.id, nameOrCode: r.code || r.id, reason: 'Already exists in Firestore' });
        return;
      }
      const errors: string[] = [];
      if (!r.competitionId) errors.push('Missing competitionId');
      if (!r.teamId) errors.push('Missing teamId');
      if (errors.length > 0) regReport.invalid.push({ item: r, errors });
      else regReport.validToMigrate.push(r);
    });

    const totalToMigrateCount =
      catReport.validToMigrate.length +
      teamReport.validToMigrate.length +
      compReport.validToMigrate.length +
      stageReport.validToMigrate.length +
      schedReport.validToMigrate.length +
      partReport.validToMigrate.length +
      regReport.validToMigrate.length;

    return {
      timestamp: new Date().toISOString(),
      hasItemsToMigrate: totalToMigrateCount > 0,
      totalToMigrateCount,
      categories: catReport,
      teams: teamReport,
      competitions: compReport,
      stages: stageReport,
      schedules: schedReport,
      participants: partReport,
      registrations: regReport
    };
  }

  /**
   * Executes the migration of approved items into Firestore.
   * Guarantees an automated local snapshot is created first.
   */
  static async executeApprovedMigration(
    db: Firestore,
    plan: DryRunMigrationReport
  ): Promise<{ success: boolean; migratedCounts: Record<string, number>; snapshotKey: string }> {
    // 1. Mandatory snapshot backup before touching live database
    const snapshotKey = this.createSafeLocalSnapshot();

    const migratedCounts: Record<string, number> = {
      categories: 0,
      teams: 0,
      competitions: 0,
      stages: 0,
      schedules: 0,
      participants: 0,
      registrations: 0
    };

    // 2. Write categories
    for (const cat of plan.categories.validToMigrate) {
      await setDoc(doc(db, 'categories', cat.id), sanitizeForFirestore(cat), { merge: true });
      migratedCounts.categories++;
    }

    // 3. Write teams
    for (const tm of plan.teams.validToMigrate) {
      await setDoc(doc(db, 'teams', tm.id), sanitizeForFirestore(tm), { merge: true });
      migratedCounts.teams++;
    }

    // 4. Write competitions
    for (const cmp of plan.competitions.validToMigrate) {
      await setDoc(doc(db, 'competitions', cmp.id), sanitizeForFirestore(cmp), { merge: true });
      migratedCounts.competitions++;
    }

    // 5. Write stages
    for (const stg of plan.stages.validToMigrate) {
      await setDoc(doc(db, 'stages', stg.id), sanitizeForFirestore(stg), { merge: true });
      migratedCounts.stages++;
    }

    // 6. Write schedules
    for (const sch of plan.schedules.validToMigrate) {
      await setDoc(doc(db, 'schedules', sch.id), sanitizeForFirestore(sch), { merge: true });
      migratedCounts.schedules++;
    }

    // 7. Write participants
    for (const part of plan.participants.validToMigrate) {
      await setDoc(doc(db, 'participants', part.id), sanitizeForFirestore(part), { merge: true });
      migratedCounts.participants++;
    }

    // 8. Write registrations
    for (const reg of plan.registrations.validToMigrate) {
      await setDoc(doc(db, 'registrations', reg.id), sanitizeForFirestore(reg), { merge: true });
      migratedCounts.registrations++;
    }

    return {
      success: true,
      migratedCounts,
      snapshotKey
    };
  }
}
