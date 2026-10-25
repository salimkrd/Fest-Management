export type CategoryTier = 'SUB_JUNIOR' | 'JUNIOR' | 'SENIOR' | 'GENERAL';

export interface Category {
  id: string;
  name: string;
  code: string;
  eligibility: string;
  ageRange: string;
  classRange: string;
  enrolledCount: number;
  competitionsCount: number;
  status: 'ACTIVE' | 'INACTIVE';
}

export interface Team {
  id: string;
  name: string;
  code: string; // e.g. ABH, BSH, KAH, FSH
  color: string; // Hex color
  managerName: string;
  managerEmail: string;
  managerPhone: string;
  managerUid?: string;
  zone: string;
  contestantsCount: number;
  eventsCount: number;
  totalPoints: number;
  soloPoints: number;
  groupPoints: number;
  rank: number;
  firstCount: number;
  secondCount: number;
  thirdCount: number;
  portalAccess: boolean;
  status?: 'ACTIVE' | 'DISABLED';
  provisioningStatus?: 'PENDING' | 'PROVISIONED' | 'FAILED' | 'AWAITING_MANAGER';
  invitationStatus?:
    | 'PENDING'
    | 'READY_TO_SEND'
    | 'MANUALLY_SENT'
    | 'ACTIVATED'
    | 'EXPIRED'
    | 'REVOKED'
    | 'SENT'
    | 'FAILED'
    | 'DELIVERED';
  invitationExpiresAt?: string;
  invitationProvider?: string;
  invitationSentAt?: string;
  lastDeliveryError?: string;
  createdAt?: string;
  updatedAt?: string;
}

export type CompetitionType = 'SOLO' | 'GROUP';
export type CompetitionPerformanceMode = 'STAGE' | 'OFF_STAGE';
export type CompetitionStatus = 'SCHEDULED' | 'IN_PROGRESS' | 'MARKS_ENTERED' | 'PUBLISHED';

export interface JudgingCriterion {
  id: string;
  name: string;
  maxMarks: number;
}

export interface Competition {
  id: string;
  code: string; // e.g. CMP-01
  name: string;
  categoryId: string;
  categoryName: string;
  type: CompetitionType;
  performanceMode?: CompetitionPerformanceMode; // Explicit classification independent of venue
  groupSize?: number; // Members per group; leader-only registration
  entriesCount: number;
  stageId: string;
  stageName: string;
  assignedJudges: string[];
  status: CompetitionStatus;
  date: string;
  timeSlot: string;
  durationMinutes: number;
  maxEntriesPerTeam: number;
  criteria: JudgingCriterion[];
}

export interface Participant {
  id: string;
  bib: string; // e.g. #1042
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
  remarks?: string;
}

export interface Registration {
  id: string;
  code: string; // e.g. REG-8821
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
  groupMembers?: string[]; // Legacy full-roster groups remain readable
  groupLeaderId?: string; // Member representing a group, no individual credit
  registeredAt: string;
}

export interface Stage {
  id: string;
  code: string; // e.g. STG-01
  name: string;
  venue: string;
  capacity: number;
  managerName: string;
  managerPhone: string;
  audioVisualStatus: 'OPERATIONAL' | 'STANDBY' | 'MAINTENANCE';
  currentEvent?: string;
  nextEvent?: string;
}

export interface ScheduleSlot {
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

export interface ParticipantScore {
  registrationId: string;
  participantName: string;
  bib: string;
  teamCode: string;
  teamName: string;
  criteriaMarks: Record<string, number>; // criterionId -> marks
  totalMarks: number;
  remarks?: string;
  disqualified?: boolean;
}

import { Grade } from '@/domain/scoring';
import { ResultStatus, PointsLedgerEntry } from '@/domain/ledger';

export type { Grade, ResultStatus, PointsLedgerEntry };

export interface MarkEntry {
  id: string;
  competitionId: string;
  competitionName: string;
  competitionCode: string;
  categoryName: string;
  type: CompetitionType;
  judgeName: string;
  judgePhone: string;
  accessCode: string; // e.g. JRY-8291
  secretHash: string; // SHA-256 hash (never plaintext)
  salt: string;
  expiresAt?: string;
  revoked?: boolean;
  status: 'NOT_STARTED' | 'IN_PROGRESS' | 'SUBMITTED' | 'EXPIRED' | 'REVOKED';
  submittedAt?: string;
  verificationHash?: string;
  scores: ParticipantScore[];
}

export interface ResultRank {
  rank: 1 | 2 | 3 | null;
  registrationId: string;
  bib: string;
  candidateName: string;
  teamId: string;
  teamCode: string;
  teamName: string;
  teamColor: string;
  score: number;
  grade: Grade; // 'A+' | 'A' | 'B' | 'C' | 'NO_GRADE'
  officialPoints: number; // Exact matrix lookup points
  totalEarnedPoints: number; // Backward compatibility alias
}

export interface CompetitionResult {
  id: string;
  competitionId: string;
  competitionCode: string;
  competitionName: string;
  categoryName: string;
  type: CompetitionType;
  stageName: string;
  marksStatus: 'COMPLETE' | 'PARTIAL';
  resultStatus: ResultStatus; // 'DRAFT' | 'AWAITING_MARKS' | 'READY_FOR_REVIEW' | 'READY_TO_PUBLISH' | 'PUBLISHED' | 'REVISION_REQUIRED'
  publishedDate?: string;
  ranks: ResultRank[];
  posterReleased: boolean;
  posterConfig?: PosterConfig;
  posterDraftConfig?: PosterConfig;
  posterPublishedConfig?: PosterConfig;
}

export interface PosterConfig {
  aspectRatio: '1:1' | '4:5' | '9:16';
  fontFamily: string;
  fontSize: 'standard' | 'large' | 'compact';
  fontWeight: string;
  colorPreset: 'royal' | 'crimson' | 'emerald' | 'monochrome';
  customTitle?: string;
  version?: 2;
  backgroundColor?: string;
  accentColor?: string;
  textColor?: string;
  backgroundImage?: string;
  backgroundOpacity?: number;
  decoration?: 'arches' | 'confetti' | 'minimal';
  elements?: PosterElement[];
}

export type PosterField = 'text' | 'festivalName' | 'institutionName' | 'competitionName' | 'categoryName' | 'competitionCode' | 'rank1.name' | 'rank1.team' | 'rank1.grade' | 'rank1.score' | 'rank2.name' | 'rank2.team' | 'rank2.grade' | 'rank2.score' | 'rank3.name' | 'rank3.team' | 'rank3.grade' | 'rank3.score';

export interface PosterElement {
  id: string;
  type: 'text' | 'image';
  label: string;
  field: PosterField;
  text: string;
  x: number;
  y: number;
  width: number;
  height: number;
  fontSize: number;
  fontFamily: 'sans' | 'serif' | 'mono';
  fontWeight: '400' | '600' | '800';
  color: string;
  align: 'left' | 'center' | 'right';
  image?: string;
}

export interface PosterTemplate {
  id: string;
  name: string;
  config: PosterConfig;
  updatedAt?: string;
}

export interface PublicThemeSettings {
  festivalName: string;
  institutionName: string;
  tagline: string;
  year: string;
  primaryColor: string; // e.g. #2563EB or custom
  secondaryColor: string; // e.g. #111111 or dark slate
  accentColor: string; // e.g. #D97706 or gold
  headingFont: string; // 'Montserrat' | 'Outfit' | 'Inter' | 'Playfair Display'
  bodyFont: string; // 'Montserrat' | 'Inter'
  fontFamily: string; // fallback alias
  backgroundStyle: 'clean-white' | 'subtle-pattern' | 'festive-aurora' | 'gradient-mesh';
  cardStyle: 'elevated' | 'glassmorphism' | 'bordered' | 'minimal';
  logoUrl?: string;
  heroBannerText: string;
}

export type GreenRoomContestantStatus = 'CHECKED_IN' | 'ON_STAGE' | 'COMPLETED' | 'ABSENT';

export interface GreenRoomAssignment {
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
  createdAt: string;
  updatedAt: string;
}

