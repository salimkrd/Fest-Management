/**
 * Cloud Firestore Collection Schema Definitions
 * Single-Institution, Single-Fest Architecture: "Sahithyolsav 2025"
 */

import { Grade, CompetitionType } from '@/domain/scoring';
import type { CompetitionPerformanceMode } from '@/types/fest';
import { ResultStatus } from '@/domain/ledger';

export type UserRole = 'ADMIN' | 'TEAM_MANAGER' | 'JUDGE' | 'GREEN_ROOM_STAFF' | 'PUBLIC';

export interface FirestoreUser {
  id: string; // Auth UID
  email: string;
  displayName: string;
  role: UserRole;
  teamId?: string; // Set only if role === 'TEAM_MANAGER'
  assignmentId?: string; // Set only if role === 'JUDGE'
  disabled?: boolean;
  status?: 'ACTIVE' | 'DISABLED' | 'PENDING';
  createdAt: string;
  updatedAt: string;
}

export interface FirestoreCategory {
  id: string;
  name: string;
  code: string;
  eligibility: string;
  ageRange: string;
  classRange: string;
  status: 'ACTIVE' | 'INACTIVE';
  createdAt: string;
}

export type ProvisioningStatus = 'PENDING' | 'PROVISIONED' | 'FAILED' | 'AWAITING_MANAGER';
export type InvitationStatus =
  | 'PENDING'
  | 'READY_TO_SEND'
  | 'MANUALLY_SENT'
  | 'ACTIVATED'
  | 'EXPIRED'
  | 'REVOKED'
  | 'SENT'
  | 'FAILED'
  | 'DELIVERED';

// Public Team Document (Stored in /teams/{teamId} - SAFE PUBLIC METADATA ONLY)
export interface FirestoreTeam {
  id: string;
  name: string;
  code: string;
  color: string;
  zone: string;
  status: 'ACTIVE' | 'DISABLED';
  createdAt: string;
  updatedAt?: string;
}

// Private Manager & Onboarding Document (Stored in /teams/{teamId}/private/managerInfo - ADMIN ONLY)
export interface FirestoreTeamPrivate {
  teamId: string;
  managerUid?: string;
  managerName?: string;
  managerEmail?: string;
  managerPhone?: string; // WhatsApp Contact Number
  portalAccess: boolean;
  provisioningStatus: ProvisioningStatus;
  invitationStatus: InvitationStatus;
  invitationTokenHash?: string; // SHA-256 hash of single-use invitation code
  invitationExpiresAt?: string; // ISO expiration timestamp
  invitationCreatedAt?: string;
  invitationSentAt?: string;
  invitationRedeemedAt?: string;
  invitationRevokedAt?: string;
  invitationRedeemed?: boolean;
  activationInProgress?: boolean; // Concurrency protection flag
  activationAttemptAt?: string;
  failedActivationAttempts?: number; // Account-specific rate limiting
  lockedUntil?: string | null; // Lockout timestamp after repeated failures
  lastActivationError?: string;
  invitationProvider?: string;
  invitationMessageId?: string;
  lastDeliveryError?: string;
  createdAt: string;
  updatedAt: string;
}

// Combined representation used in administrative management
export interface CombinedTeam extends FirestoreTeam {
  managerName?: string;
  managerEmail?: string;
  managerPhone?: string;
  managerUid?: string;
  portalAccess?: boolean;
  provisioningStatus?: ProvisioningStatus;
  invitationStatus?: InvitationStatus;
  invitationExpiresAt?: string;
  invitationSentAt?: string;
  invitationRedeemedAt?: string;
  invitationProvider?: string;
  invitationMessageId?: string;
  lastDeliveryError?: string;
}

export interface FirestoreParticipant {
  id: string;
  bib: string;
  name: string;
  email: string;
  phone: string;
  teamId: string;
  teamCode: string;
  teamName: string;
  categoryId: string;
  categoryName: string;
  classGrade: string;
  division: string;
  dob: string;
  photoUrl: string;
  registeredEventIds: string[];
  idStatus: 'GENERATED' | 'PENDING';
  createdAt: string;
}

export interface FirestoreJudgingCriterion {
  id: string;
  name: string;
  maxMarks: number;
}

export interface FirestoreCompetition {
  id: string;
  code: string;
  name: string;
  categoryId: string;
  categoryName: string;
  type: CompetitionType;
  performanceMode?: CompetitionPerformanceMode;
  groupSize?: number;
  stageId: string;
  stageName: string;
  status: 'SCHEDULED' | 'IN_PROGRESS' | 'MARKS_ENTERED' | 'PUBLISHED';
  date: string;
  timeSlot: string;
  durationMinutes: number;
  maxEntriesPerTeam: number;
  criteria: FirestoreJudgingCriterion[];
  createdAt: string;
}

export interface FirestoreRegistration {
  id: string;
  code: string;
  participantId?: string;
  participantName: string;
  teamId: string;
  teamCode: string;
  teamName: string;
  categoryId: string;
  categoryName: string;
  competitionId: string;
  competitionName: string;
  type: CompetitionType;
  chestNumber: string;
  status: 'APPROVED' | 'PENDING' | 'REJECTED';
  groupMembers?: string[];
  groupLeaderId?: string;
  registeredAt: string;
}

export interface FirestoreJudge {
  id: string;
  name: string;
  phone: string;
  email?: string;
  specialization: string;
  status: 'ACTIVE' | 'INACTIVE';
  createdAt: string;
}

export interface FirestoreJudgeAssignment {
  id: string;
  judgeId: string;
  judgeName: string;
  judgePhone: string;
  competitionId: string;
  competitionCode: string;
  competitionName: string;
  stageId: string;
  stageName: string;
  accessCode: string; // e.g. JRY-4821
  secretHash: string; // SHA-256 hash (never plaintext)
  salt: string;
  issuedAt: string;
  expiresAt: string;
  revoked: boolean;
  status: 'ACTIVE' | 'SUBMITTED' | 'EXPIRED' | 'REVOKED';
}

export interface FirestoreParticipantScore {
  registrationId: string;
  participantName: string;
  bib: string;
  teamCode: string;
  criteriaMarks: Record<string, number>;
  totalMarks: number;
  remarks?: string;
  disqualified?: boolean;
}

export interface FirestoreMarkEntry {
  id: string;
  assignmentId: string;
  competitionId: string;
  judgeName: string;
  scores: FirestoreParticipantScore[];
  status: 'DRAFT' | 'SUBMITTED';
  submittedAt?: string;
  verificationHash?: string;
}

export interface FirestoreResultRank {
  rank: 1 | 2 | 3 | null;
  registrationId: string;
  bib: string;
  candidateName: string;
  teamId: string;
  teamCode: string;
  teamName: string;
  score: number;
  grade: Grade;
  officialPoints: number;
}

export interface FirestoreResult {
  id: string;
  competitionId: string;
  competitionCode: string;
  competitionName: string;
  categoryName: string;
  type: CompetitionType;
  stageName: string;
  resultStatus: ResultStatus;
  publishedDate?: string;
  publishedBy?: string; // Admin UID
  ranks: FirestoreResultRank[];
  posterReleased: boolean;
  posterConfig?: any;
}

export interface FirestorePointsLedgerEntry {
  id: string; // `${resultId}_${registrationId}`
  resultId: string;
  competitionId: string;
  competitionCode: string;
  competitionName: string;
  competitionType: CompetitionType;
  teamId: string;
  teamCode: string;
  teamName: string;
  registrationId: string;
  candidateName: string;
  bib: string;
  score: number;
  rank: 1 | 2 | 3 | null;
  grade: Grade;
  points: number;
  status: 'COMMITTED' | 'REVERSED';
  publishedAt: string;
  reversalReason?: string;
}

export interface FirestoreLeaderboardEntry {
  teamId: string;
  teamCode: string;
  teamName: string;
  color: string;
  soloPoints: number;
  groupPoints: number;
  totalPoints: number;
  firstCount: number;
  secondCount: number;
  thirdCount: number;
  rank: number;
  lastUpdated: string;
}

export interface FirestoreStage {
  id: string;
  code: string;
  name: string;
  venue: string;
  capacity: number;
  managerName: string;
  managerPhone: string;
  audioVisualStatus: 'OPERATIONAL' | 'STANDBY' | 'MAINTENANCE';
  currentEvent?: string;
  nextEvent?: string;
}

export interface FirestoreSchedule {
  id: string;
  competitionId: string;
  competitionName: string;
  categoryName: string;
  type: CompetitionType;
  stageId: string;
  stageName: string;
  date: string;
  startTime: string;
  endTime: string;
  status: 'SCHEDULED' | 'LIVE' | 'COMPLETED' | 'DELAYED';
}

export interface FirestoreMediaTemplate {
  id: string;
  name: string;
  aspectRatio: '1:1' | '4:5' | '9:16' | '16:9';
  previewUrl: string;
  primaryColor: string;
  fontFamily: string;
}

export interface FirestoreGeneratedPoster {
  id: string;
  competitionId: string;
  resultId: string;
  aspectRatio: string;
  storageUrl: string;
  generatedAt: string;
}

export interface FirestoreSettings {
  festivalName: string;
  institutionName: string;
  tagline: string;
  year: string;
  primaryColor: string;
  secondaryColor: string;
  accentColor: string;
  headingFont: string;
  bodyFont: string;
  backgroundStyle: string;
  cardStyle: string;
  logoUrl?: string;
  heroBannerText: string;
  updatedAt: string;
  updatedBy: string;
}

export interface FirestoreAuditLog {
  id: string;
  action: string;
  actorId: string;
  actorEmail: string;
  actorRole: UserRole;
  targetCollection: string;
  targetDocId: string;
  details: Record<string, any>;
  timestamp: string;
}

export type GreenRoomContestantStatus = 'CHECKED_IN' | 'ON_STAGE' | 'COMPLETED' | 'ABSENT';

export interface FirestoreGreenRoomAssignment {
  id: string; // `${competitionId}_${registrationId}`
  competitionId: string;
  competitionCode: string;
  competitionName: string;
  categoryId: string;
  categoryName: string;
  stageId: string;
  stageName: string;
  registrationId: string;
  registrationCode: string;
  participantId?: string;
  participantName: string;
  teamId: string;
  teamCode: string;
  teamName: string;
  chestNumber: string;
  type: CompetitionType;
  groupMembers?: string[];
  codeLetter: string; // A..Z, AA..ZZ
  codeIndex: number; // 0..701
  status: GreenRoomContestantStatus;
  checkedInAt: string;
  checkedInBy: string; // UID
  checkedInByRole: 'ADMIN' | 'GREEN_ROOM_STAFF';
  notes?: string;
  reassignedFrom?: string;
  reassignedAt?: string;
  reassignmentReason?: string;
  checkInMethod?: 'QR_SCAN' | 'MANUAL_LOOKUP';
  qrVerified?: boolean;
  createdAt: string;
  updatedAt: string;
}
