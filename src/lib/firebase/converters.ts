/**
 * Firestore Generic & Collection Typed Converters
 */

import {
  FirestoreDataConverter,
  QueryDocumentSnapshot,
  SnapshotOptions,
  DocumentData
} from 'firebase/firestore';
import {
  FirestoreUser,
  FirestoreCategory,
  FirestoreTeam,
  FirestoreParticipant,
  FirestoreCompetition,
  FirestoreRegistration,
  FirestoreJudgeAssignment,
  FirestoreMarkEntry,
  FirestoreResult,
  FirestorePointsLedgerEntry,
  FirestoreLeaderboardEntry,
  FirestoreStage,
  FirestoreSchedule,
  FirestoreSettings,
  FirestoreAuditLog
} from '@/types/firestore';

import { sanitizeForFirestore } from './sanitize';

export function createConverter<T extends DocumentData>(): FirestoreDataConverter<T> {
  return {
    toFirestore(modelObject: T): DocumentData {
      return sanitizeForFirestore(modelObject);
    },
    fromFirestore(snapshot: QueryDocumentSnapshot, options: SnapshotOptions): T {
      const data = snapshot.data(options);
      return ({
        id: snapshot.id,
        ...data
      } as unknown) as T;
    }
  };
}

export const userConverter = createConverter<FirestoreUser>();
export const categoryConverter = createConverter<FirestoreCategory>();
export const teamConverter = createConverter<FirestoreTeam>();
export const participantConverter = createConverter<FirestoreParticipant>();
export const competitionConverter = createConverter<FirestoreCompetition>();
export const registrationConverter = createConverter<FirestoreRegistration>();
export const judgeAssignmentConverter = createConverter<FirestoreJudgeAssignment>();
export const markEntryConverter = createConverter<FirestoreMarkEntry>();
export const resultConverter = createConverter<FirestoreResult>();
export const pointsLedgerConverter = createConverter<FirestorePointsLedgerEntry>();
export const leaderboardConverter = createConverter<FirestoreLeaderboardEntry>();
export const stageConverter = createConverter<FirestoreStage>();
export const scheduleConverter = createConverter<FirestoreSchedule>();
export const settingsConverter = createConverter<FirestoreSettings>();
export const auditLogConverter = createConverter<FirestoreAuditLog>();
