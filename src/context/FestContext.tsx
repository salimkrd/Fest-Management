'use client';

import React, { createContext, useContext, useState, useEffect, useMemo, useRef, useCallback } from 'react';
import { auth, db } from '@/lib/firebase/client';
import { onAuthStateChanged } from 'firebase/auth';
import { collection, doc, setDoc, updateDoc, deleteDoc, onSnapshot, query, where, getDocs, runTransaction } from 'firebase/firestore';
import type { DocumentData } from 'firebase/firestore';
import { sanitizeForFirestore } from '@/lib/firebase/sanitize';
import { festivalNameFontFamily, festivalFontStylesheet } from '@/domain/festivalFonts';
import { createUnloadedFestivalTheme, mergePublishedFestivalTheme } from '@/domain/festivalSettings';
import { isParticipantEligibleForCategory } from '@/domain/eligibility';
import type { PosterMediaRecord, ReleasedPoster } from '@/services/posterService';
import {
  Category,
  Team,
  Competition,
  Participant,
  Registration,
  Stage,
  ScheduleSlot,
  MarkEntry,
  CompetitionResult,
  ResultRank,
  PublicThemeSettings,
  PosterConfig,
  ResultStatus,
  PointsLedgerEntry
} from '@/types/fest';
import {
  commitResultToLedger,
  reverseResultInLedger,
  recalculateTeamChampionship
} from '@/domain/ledger';
import {
  createJudgeAssignment
} from '@/domain/judgeAuth';

interface FestContextType {
  theme: PublicThemeSettings;
  themeSyncState: 'loading' | 'ready' | 'error' | 'idle';
  updateTheme: (newTheme: Partial<PublicThemeSettings>) => Promise<void>;

  categories: Category[];
  categoriesSyncState: 'loading' | 'ready' | 'error' | 'idle';
  addCategory: (cat: Omit<Category, 'id' | 'enrolledCount' | 'competitionsCount'>) => Promise<void>;
  updateCategory: (id: string, cat: Partial<Category>) => Promise<void>;
  deleteCategory: (id: string) => Promise<void>;

  teams: Team[];
  teamsSyncState: 'loading' | 'ready' | 'error' | 'idle';
  addTeam: (team: Omit<Team, 'id' | 'totalPoints' | 'soloPoints' | 'groupPoints' | 'rank' | 'firstCount' | 'secondCount' | 'thirdCount' | 'contestantsCount' | 'eventsCount'> & { id?: string }) => Promise<void>;
  updateTeam: (id: string, team: Partial<Team>) => Promise<void>;
  deleteTeam: (id: string) => Promise<void>;

  competitions: Competition[];
  competitionsSyncState: 'loading' | 'ready' | 'error' | 'idle';
  addCompetition: (comp: Omit<Competition, 'id' | 'entriesCount'>) => Promise<void>;
  updateCompetition: (id: string, comp: Partial<Competition>) => Promise<void>;
  deleteCompetition: (id: string) => Promise<void>;

  participants: Participant[];
  participantsSyncState: 'loading' | 'ready' | 'error' | 'idle';
  addParticipant: (part: Omit<Participant, 'id' | 'bib' | 'idStatus'>) => Promise<Participant>;
  updateParticipant: (id: string, part: Partial<Participant>) => Promise<void>;
  deleteParticipant: (id: string) => Promise<void>;
  checkParticipantCategoryConflicts: (participantId: string, newCategoryId: string) => Promise<Array<{
    registrationId: string;
    registrationCode: string;
    competitionId: string;
    competitionName: string;
    competitionCode: string;
    competitionCategoryName: string;
  }>>;

  registrations: Registration[];
  registrationsSyncState: 'loading' | 'ready' | 'error' | 'idle';
  addRegistration: (reg: Omit<Registration, 'id' | 'code' | 'registeredAt'>) => Promise<void>;
  updateRegistrationStatus: (id: string, status: 'APPROVED' | 'PENDING' | 'REJECTED' | 'CANCELLED') => Promise<void>;
  deleteRegistration: (id: string) => Promise<void>;

  stages: Stage[];
  stagesSyncState: 'loading' | 'ready' | 'error' | 'idle';
  addStage: (stage: Omit<Stage, 'id'>) => Promise<void>;
  updateStage: (id: string, stage: Partial<Stage>) => Promise<void>;
  deleteStage: (id: string) => Promise<void>;

  schedules: ScheduleSlot[];
  schedulesSyncState: 'loading' | 'ready' | 'error' | 'idle';
  addSchedule: (slot: Omit<ScheduleSlot, 'id'>) => Promise<void>;
  updateSchedule: (id: string, slot: Partial<ScheduleSlot>) => Promise<void>;
  deleteSchedule: (id: string) => Promise<void>;

  markEntries: MarkEntry[];
  markEntriesSyncState: 'loading' | 'ready' | 'error' | 'idle';
  addOrUpdateJudgeAssignment: (assignment: {
    competitionId: string;
    judgeName: string;
    judgePhone: string;
    stageName?: string;
  }) => Promise<{ assignmentId: string; accessCode: string; oneTimeSecret: string; directUrl: string }>;
  submitJudgeMarks: (markEntryId: string, scores: MarkEntry['scores'], verificationHash?: string) => void;
  revokeJudgeAssignment: (markEntryId: string) => void;
  cleanupOrphanedJudgeAssignments: (options?: { dryRun?: boolean; confirm?: boolean }) => Promise<{
    success: boolean;
    dryRun?: boolean;
    requiresConfirmation?: boolean;
    totalOrphaned?: number;
    removedJudgeAssignments?: number;
    removedMarkEntries?: number;
    message?: string;
    orphanedJudgeDetails?: Array<{ id: string; competitionId: string; judgeName: string }>;
    orphanedMarkDetails?: Array<{ id: string; competitionId: string }>;
  }>;

  // Official Results & Tabulation Ledger
  results: CompetitionResult[];
  resultsSyncState: 'loading' | 'ready' | 'error' | 'idle';
  topScorersSyncState: 'loading' | 'ready' | 'error' | 'idle';
  pointsLedger: PointsLedgerEntry[];
  publishResult: (resultId: string) => Promise<void>;
  unpublishResult: (resultId: string, reason?: string) => Promise<void>;
  updateResultStatus: (resultId: string, status: ResultStatus) => void;
  confirmResultPositionsAndGrades: (resultId: string, ranks: ResultRank[]) => Promise<void>;
  updatePosterConfig: (resultId: string, config: PosterConfig, release?: boolean) => Promise<void>;

  currentTeamUser: Team | null;
  setCurrentTeamUser: (team: Team | null) => void;
}

const defaultTheme: PublicThemeSettings = {
  festivalName: 'Sahithyolsav 2025',
  institutionName: 'Markaz Knowledge City',
  tagline: 'Annual Arts & Cultural Fest',
  year: '2025',
  primaryColor: '#2563EB',
  secondaryColor: '#111111',
  accentColor: '#D97706',
  headingFont: 'Montserrat',
  bodyFont: 'Montserrat',
  fontFamily: 'Montserrat',
  backgroundStyle: 'clean-white',
  cardStyle: 'elevated',
  heroBannerText: 'Celebrating Art, Literature, Eloquence & Cultural Heritage'
};

const initialBaseTeams: Team[] = [
  {
    id: 'team-1',
    name: 'Al-Bayan House',
    code: 'ABH',
    color: '#2563EB',
    managerName: 'Zayd Al-Ansari',
    managerEmail: 'bayan@fest.org',
    managerPhone: '+91 98471 20001',
    zone: 'East Wing Campus',
    contestantsCount: 124,
    eventsCount: 38,
    totalPoints: 45,
    soloPoints: 22,
    groupPoints: 23,
    rank: 1,
    firstCount: 3,
    secondCount: 0,
    thirdCount: 0,
    portalAccess: true
  },
  {
    id: 'team-2',
    name: 'Badr Squad',
    code: 'BSH',
    color: '#059669',
    managerName: 'Rashid Farooq',
    managerEmail: 'badr@fest.org',
    managerPhone: '+91 98471 20002',
    zone: 'West Wing Campus',
    contestantsCount: 118,
    eventsCount: 36,
    totalPoints: 38,
    soloPoints: 17,
    groupPoints: 21,
    rank: 2,
    firstCount: 0,
    secondCount: 3,
    thirdCount: 0,
    portalAccess: true
  },
  {
    id: 'team-3',
    name: 'Khalid Al-Walid',
    code: 'KAH',
    color: '#D97706',
    managerName: 'Salman Tariq',
    managerEmail: 'khalid@fest.org',
    managerPhone: '+91 98471 20003',
    zone: 'North Wing Campus',
    contestantsCount: 120,
    eventsCount: 35,
    totalPoints: 28,
    soloPoints: 12,
    groupPoints: 16,
    rank: 3,
    firstCount: 0,
    secondCount: 0,
    thirdCount: 3,
    portalAccess: true
  },
  {
    id: 'team-4',
    name: 'Fathul Mubeen',
    code: 'FSH',
    color: '#7C3AED',
    managerName: 'Hamza Niyas',
    managerEmail: 'fath@fest.org',
    managerPhone: '+91 98471 20004',
    zone: 'South Wing Campus',
    contestantsCount: 120,
    eventsCount: 34,
    totalPoints: 0,
    soloPoints: 0,
    groupPoints: 0,
    rank: 4,
    firstCount: 0,
    secondCount: 0,
    thirdCount: 0,
    portalAccess: true
  }
];

// Initial Results with exact Sahithyolsav points matrix
const initialResults: CompetitionResult[] = [
  {
    id: 'res-1',
    competitionId: 'cmp-1',
    competitionCode: 'CMP-01',
    competitionName: 'Extempore Speech (English)',
    categoryName: 'Senior',
    type: 'SOLO',
    stageName: 'Main Auditorium',
    marksStatus: 'COMPLETE',
    resultStatus: 'PUBLISHED',
    publishedDate: '2025-11-14 11:30 AM',
    posterReleased: true,
    posterConfig: {
      aspectRatio: '1:1',
      fontFamily: 'Montserrat',
      fontSize: 'standard',
      fontWeight: '700',
      colorPreset: 'royal'
    },
    ranks: [
      {
        rank: 1,
        registrationId: 'reg-1',
        bib: '#1042',
        candidateName: 'Rayan Siddiqui',
        teamId: 'team-1',
        teamCode: 'ABH',
        teamName: 'Al-Bayan House',
        teamColor: '#2563EB',
        score: 95,
        grade: 'A+',
        officialPoints: 11, // Solo, A+, 1st = 11 pts
        totalEarnedPoints: 11
      },
      {
        rank: 2,
        registrationId: 'reg-2',
        bib: '#1018',
        candidateName: 'Faris Ibrahim',
        teamId: 'team-2',
        teamCode: 'BSH',
        teamName: 'Badr Squad',
        teamColor: '#059669',
        score: 89,
        grade: 'A',
        officialPoints: 8, // Solo, A, 2nd = 8 pts
        totalEarnedPoints: 8
      },
      {
        rank: 3,
        registrationId: 'reg-3',
        bib: '#1035',
        candidateName: 'Hassan Bilgrami',
        teamId: 'team-3',
        teamCode: 'KAH',
        teamName: 'Khalid Al-Walid',
        teamColor: '#D97706',
        score: 82,
        grade: 'A',
        officialPoints: 6, // Solo, A, 3rd = 6 pts
        totalEarnedPoints: 6
      }
    ]
  },
  {
    id: 'res-2',
    competitionId: 'cmp-2',
    competitionCode: 'CMP-02',
    competitionName: 'Quran Recitation (Tajweed)',
    categoryName: 'Junior',
    type: 'SOLO',
    stageName: 'Seminar Hall A',
    marksStatus: 'COMPLETE',
    resultStatus: 'PUBLISHED',
    publishedDate: '2025-11-14 01:45 PM',
    posterReleased: true,
    posterConfig: {
      aspectRatio: '4:5',
      fontFamily: 'Montserrat',
      fontSize: 'standard',
      fontWeight: '600',
      colorPreset: 'emerald'
    },
    ranks: [
      {
        rank: 1,
        registrationId: 'reg-5',
        bib: '#2011',
        candidateName: 'Aasim Faizee',
        teamId: 'team-1',
        teamCode: 'ABH',
        teamName: 'Al-Bayan House',
        teamColor: '#2563EB',
        score: 98,
        grade: 'A+',
        officialPoints: 11, // Solo, A+, 1st = 11 pts
        totalEarnedPoints: 11
      },
      {
        rank: 2,
        registrationId: 'reg-6',
        bib: '#2045',
        candidateName: 'Zayd Imran',
        teamId: 'team-2',
        teamCode: 'BSH',
        teamName: 'Badr Squad',
        teamColor: '#059669',
        score: 93,
        grade: 'A+',
        officialPoints: 9, // Solo, A+, 2nd = 9 pts
        totalEarnedPoints: 9
      },
      {
        rank: 3,
        registrationId: 'reg-7',
        bib: '#2062',
        candidateName: 'Bilal Madani',
        teamId: 'team-3',
        teamCode: 'KAH',
        teamName: 'Khalid Al-Walid',
        teamColor: '#D97706',
        score: 86,
        grade: 'A',
        officialPoints: 6, // Solo, A, 3rd = 6 pts
        totalEarnedPoints: 6
      }
    ]
  },
  {
    id: 'res-3',
    competitionId: 'cmp-3',
    competitionCode: 'CMP-03',
    competitionName: 'Sufi & Cultural Group Song',
    categoryName: 'General',
    type: 'GROUP',
    stageName: 'Open Amphitheatre',
    marksStatus: 'COMPLETE',
    resultStatus: 'PUBLISHED',
    publishedDate: '2025-11-14 04:45 PM',
    posterReleased: true,
    posterConfig: {
      aspectRatio: '1:1',
      fontFamily: 'Montserrat',
      fontSize: 'standard',
      fontWeight: '700',
      colorPreset: 'royal'
    },
    ranks: [
      {
        rank: 1,
        registrationId: 'reg-grp-1',
        bib: '#GRP-ABH',
        candidateName: 'Al-Bayan Harmony Troupe',
        teamId: 'team-1',
        teamCode: 'ABH',
        teamName: 'Al-Bayan House',
        teamColor: '#2563EB',
        score: 96,
        grade: 'A+',
        officialPoints: 23, // Group, A+, 1st = 23 pts (awarded once per group)
        totalEarnedPoints: 23
      },
      {
        rank: 2,
        registrationId: 'reg-grp-2',
        bib: '#GRP-BSH',
        candidateName: 'Badr Voice Ensemble',
        teamId: 'team-2',
        teamCode: 'BSH',
        teamName: 'Badr Squad',
        teamColor: '#059669',
        score: 91,
        grade: 'A+',
        officialPoints: 21, // Group, A+, 2nd = 21 pts
        totalEarnedPoints: 21
      },
      {
        rank: 3,
        registrationId: 'reg-grp-3',
        bib: '#GRP-KAH',
        candidateName: 'Khalid Al-Walid Choral Choir',
        teamId: 'team-3',
        teamCode: 'KAH',
        teamName: 'Khalid Al-Walid',
        teamColor: '#D97706',
        score: 85,
        grade: 'A',
        officialPoints: 16, // Group, A, 3rd = 16 pts
        totalEarnedPoints: 16
      }
    ]
  },
  {
    id: 'res-4',
    competitionId: 'cmp-4',
    competitionCode: 'CMP-04',
    competitionName: 'Arabic Calligraphy',
    categoryName: 'Senior',
    type: 'SOLO',
    stageName: 'Seminar Hall A',
    marksStatus: 'COMPLETE',
    resultStatus: 'READY_FOR_REVIEW', // Judge submitted marks; awaiting Admin review & publication
    ranks: [
      {
        rank: 1,
        registrationId: 'reg-8',
        bib: '#1055',
        candidateName: 'Luqman Hakim',
        teamId: 'team-1',
        teamCode: 'ABH',
        teamName: 'Al-Bayan House',
        teamColor: '#2563EB',
        score: 94,
        grade: 'A+',
        officialPoints: 11,
        totalEarnedPoints: 11
      },
      {
        rank: 2,
        registrationId: 'reg-9',
        bib: '#1072',
        candidateName: 'Sufyan Ali',
        teamId: 'team-2',
        teamCode: 'BSH',
        teamName: 'Badr Squad',
        teamColor: '#059669',
        score: 88,
        grade: 'A',
        officialPoints: 8,
        totalEarnedPoints: 8
      }
    ],
    posterReleased: false
  }
];

// Seed initial points ledger from published results res-1, res-2, res-3
const initialPointsLedger: PointsLedgerEntry[] = [
  // res-1 (SOLO - Extempore)
  {
    id: 'res-1_reg-1',
    resultId: 'res-1',
    competitionId: 'cmp-1',
    competitionCode: 'CMP-01',
    competitionName: 'Extempore Speech (English)',
    competitionType: 'SOLO',
    teamId: 'team-1',
    teamCode: 'ABH',
    teamName: 'Al-Bayan House',
    registrationId: 'reg-1',
    candidateName: 'Rayan Siddiqui',
    bib: '#1042',
    score: 95,
    rank: 1,
    grade: 'A+',
    points: 11,
    status: 'COMMITTED',
    publishedAt: '2025-11-14 11:30 AM'
  },
  {
    id: 'res-1_reg-2',
    resultId: 'res-1',
    competitionId: 'cmp-1',
    competitionCode: 'CMP-01',
    competitionName: 'Extempore Speech (English)',
    competitionType: 'SOLO',
    teamId: 'team-2',
    teamCode: 'BSH',
    teamName: 'Badr Squad',
    registrationId: 'reg-2',
    candidateName: 'Faris Ibrahim',
    bib: '#1018',
    score: 89,
    rank: 2,
    grade: 'A',
    points: 8,
    status: 'COMMITTED',
    publishedAt: '2025-11-14 11:30 AM'
  },
  {
    id: 'res-1_reg-3',
    resultId: 'res-1',
    competitionId: 'cmp-1',
    competitionCode: 'CMP-01',
    competitionName: 'Extempore Speech (English)',
    competitionType: 'SOLO',
    teamId: 'team-3',
    teamCode: 'KAH',
    teamName: 'Khalid Al-Walid',
    registrationId: 'reg-3',
    candidateName: 'Hassan Bilgrami',
    bib: '#1035',
    score: 82,
    rank: 3,
    grade: 'A',
    points: 6,
    status: 'COMMITTED',
    publishedAt: '2025-11-14 11:30 AM'
  },
  // res-2 (SOLO - Quran)
  {
    id: 'res-2_reg-5',
    resultId: 'res-2',
    competitionId: 'cmp-2',
    competitionCode: 'CMP-02',
    competitionName: 'Quran Recitation (Tajweed)',
    competitionType: 'SOLO',
    teamId: 'team-1',
    teamCode: 'ABH',
    teamName: 'Al-Bayan House',
    registrationId: 'reg-5',
    candidateName: 'Aasim Faizee',
    bib: '#2011',
    score: 98,
    rank: 1,
    grade: 'A+',
    points: 11,
    status: 'COMMITTED',
    publishedAt: '2025-11-14 01:45 PM'
  },
  {
    id: 'res-2_reg-6',
    resultId: 'res-2',
    competitionId: 'cmp-2',
    competitionCode: 'CMP-02',
    competitionName: 'Quran Recitation (Tajweed)',
    competitionType: 'SOLO',
    teamId: 'team-2',
    teamCode: 'BSH',
    teamName: 'Badr Squad',
    registrationId: 'reg-6',
    candidateName: 'Zayd Imran',
    bib: '#2045',
    score: 93,
    rank: 2,
    grade: 'A+',
    points: 9,
    status: 'COMMITTED',
    publishedAt: '2025-11-14 01:45 PM'
  },
  {
    id: 'res-2_reg-7',
    resultId: 'res-2',
    competitionId: 'cmp-2',
    competitionCode: 'CMP-02',
    competitionName: 'Quran Recitation (Tajweed)',
    competitionType: 'SOLO',
    teamId: 'team-3',
    teamCode: 'KAH',
    teamName: 'Khalid Al-Walid',
    registrationId: 'reg-7',
    candidateName: 'Bilal Madani',
    bib: '#2062',
    score: 86,
    rank: 3,
    grade: 'A',
    points: 6,
    status: 'COMMITTED',
    publishedAt: '2025-11-14 01:45 PM'
  },
  // res-3 (GROUP - Sufi Song)
  {
    id: 'res-3_reg-grp-1',
    resultId: 'res-3',
    competitionId: 'cmp-3',
    competitionCode: 'CMP-03',
    competitionName: 'Sufi & Cultural Group Song',
    competitionType: 'GROUP',
    teamId: 'team-1',
    teamCode: 'ABH',
    teamName: 'Al-Bayan House',
    registrationId: 'reg-grp-1',
    candidateName: 'Al-Bayan Harmony Troupe',
    bib: '#GRP-ABH',
    score: 96,
    rank: 1,
    grade: 'A+',
    points: 23,
    status: 'COMMITTED',
    publishedAt: '2025-11-14 04:45 PM'
  },
  {
    id: 'res-3_reg-grp-2',
    resultId: 'res-3',
    competitionId: 'cmp-3',
    competitionCode: 'CMP-03',
    competitionName: 'Sufi & Cultural Group Song',
    competitionType: 'GROUP',
    teamId: 'team-2',
    teamCode: 'BSH',
    teamName: 'Badr Squad',
    registrationId: 'reg-grp-2',
    candidateName: 'Badr Voice Ensemble',
    bib: '#GRP-BSH',
    score: 91,
    rank: 2,
    grade: 'A+',
    points: 21,
    status: 'COMMITTED',
    publishedAt: '2025-11-14 04:45 PM'
  },
  {
    id: 'res-3_reg-grp-3',
    resultId: 'res-3',
    competitionId: 'cmp-3',
    competitionCode: 'CMP-03',
    competitionName: 'Sufi & Cultural Group Song',
    competitionType: 'GROUP',
    teamId: 'team-3',
    teamCode: 'KAH',
    teamName: 'Khalid Al-Walid',
    registrationId: 'reg-grp-3',
    candidateName: 'Khalid Al-Walid Choral Choir',
    bib: '#GRP-KAH',
    score: 85,
    rank: 3,
    grade: 'A',
    points: 16,
    status: 'COMMITTED',
    publishedAt: '2025-11-14 04:45 PM'
  }
];

const FestContext = createContext<FestContextType | undefined>(undefined);

// Older imported results use category/name/points rather than the current field names.
function readStoredResult(id: string, data: DocumentData): CompetitionResult {
  return {
    id,
    competitionId: data.competitionId || '',
    competitionCode: data.competitionCode || '',
    competitionName: data.competitionName || '',
    categoryName: data.categoryName || data.category || '',
    type: data.type === 'GROUP' ? 'GROUP' : 'SOLO',
    stageName: data.stageName || '',
    marksStatus: data.marksStatus === 'PARTIAL' ? 'PARTIAL' : 'COMPLETE',
    resultStatus: data.resultStatus,
    publishedDate: data.publishedDate === null ? undefined : (data.publishedDate || data.publishedAt),
    posterReleased: false,
    ranks: Array.isArray(data.ranks) ? data.ranks.map((rank: DocumentData) => ({
      rank: [1, 2, 3].includes(rank.rank) ? rank.rank : null,
      registrationId: rank.registrationId || '',
      bib: rank.bib || '',
      candidateName: rank.candidateName || rank.name || '',
      teamId: rank.teamId || '',
      teamCode: rank.teamCode || '',
      teamName: rank.teamName || '',
      teamColor: rank.teamColor || '#2563EB',
      score: typeof rank.score === 'number' ? rank.score : 0,
      grade: rank.grade || 'NO_GRADE',
      officialPoints: rank.officialPoints ?? rank.points ?? rank.totalEarnedPoints ?? 0,
      totalEarnedPoints: rank.totalEarnedPoints ?? rank.officialPoints ?? rank.points ?? 0,
    })) : [],
  };
}

export function FestProvider({ children }: { children: React.ReactNode }) {
  const isProduction = process.env.NODE_ENV === 'production' || process.env.VERCEL === '1';
  const isEmulator = !isProduction && process.env.NEXT_PUBLIC_USE_FIREBASE_EMULATOR === 'true';
  const isDemoMode = !isProduction && process.env.NEXT_PUBLIC_DEMO_MODE === 'true';
  const isTestEnv = process.env.NODE_ENV === 'test' || Boolean(process.env.VITEST);
  // Live production and local Firebase Emulator connect to Firestore for dynamic realtime sync.
  // Isolated mock demo mode is strictly for offline showcase (NEXT_PUBLIC_DEMO_MODE=true) or tests without DB.
  const isIsolatedDemoOrTest = isDemoMode || (isTestEnv && !isEmulator);

  const [theme, setTheme] = useState<PublicThemeSettings>(() => {
    if (isIsolatedDemoOrTest && typeof window !== 'undefined') {
      const saved = localStorage.getItem('fest_theme_settings_v2');
      if (saved) {
        try { return { ...defaultTheme, ...JSON.parse(saved) }; } catch (e) { console.error(e); }
      }
    }
    // Production and emulator sessions start without sample festival identity.
    // This prevents "Sahithyolsav 2025 / Markaz Knowledge City" flashing on refresh.
    return isIsolatedDemoOrTest ? defaultTheme : createUnloadedFestivalTheme(defaultTheme);
  });
  const [themeSyncState, setThemeSyncState] = useState<'loading' | 'ready' | 'error' | 'idle'>(isIsolatedDemoOrTest ? 'ready' : 'loading');

  useEffect(() => {
    if (isIsolatedDemoOrTest) {
      setThemeSyncState('ready');
      return;
    }
    if (!db) {
      setThemeSyncState('error');
      return;
    }

    // Ignore cache-only snapshots; only a server-confirmed settings document may
    // replace the neutral loading identity shown across portals.
    return onSnapshot(
      doc(db, 'settings', 'publicTheme'),
      { includeMetadataChanges: true },
      snapshot => {
        if (snapshot.metadata.fromCache) return;
        const published = snapshot.exists()
          ? snapshot.data() as Partial<PublicThemeSettings>
          : null;
        setTheme(mergePublishedFestivalTheme(defaultTheme, published));
        setThemeSyncState('ready');
      },
      error => {
        setThemeSyncState('error');
        console.warn('[FestContext] Festival settings synchronization failed:', error);
      }
    );
  }, [isIsolatedDemoOrTest]);

  // Only branded festival name text changes fonts; no portal body/control typography is modified.
  useEffect(() => {
    if (typeof document === 'undefined') return;
    const font = theme.festivalNameFont || 'Montserrat';
    document.documentElement.style.setProperty('--festival-name-font', festivalNameFontFamily(font));
    const href = festivalFontStylesheet([font]);
    const old = document.getElementById('festival-name-selected-font') as HTMLLinkElement | null;
    if (href) {
      if (!old) {
        const link = document.createElement('link');
        link.id = 'festival-name-selected-font';
        link.rel = 'stylesheet';
        link.href = href;
        document.head.appendChild(link);
      } else if (old.href !== href) {
        old.href = href;
      }
    } else {
      old?.remove();
    }
  }, [theme.festivalNameFont]);

  // Browser title and favicon follow the published festival identity.
  useEffect(() => {
    if (typeof document === 'undefined') return;
    document.title = theme.festivalName.trim()
      ? theme.festivalName + ' | Festival Management'
      : 'Festival Management';
    const existing = document.querySelector<HTMLLinkElement>('link[data-festival-icon="true"]');
    if (theme.logoUrl?.trim()) {
      const icon = existing || document.createElement('link');
      icon.rel = 'icon';
      icon.href = theme.logoUrl.trim();
      icon.dataset.festivalIcon = 'true';
      if (!existing) document.head.appendChild(icon);
    } else {
      existing?.remove();
    }
  }, [theme.festivalName, theme.logoUrl]);

  const [categoriesSyncState, setCategoriesSyncState] = useState<'loading' | 'ready' | 'error' | 'idle'>(isIsolatedDemoOrTest ? 'ready' : 'loading');

  const [categories, setCategories] = useState<Category[]>(() => {
    if (!isIsolatedDemoOrTest) {
      return [];
    }

    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem('fest_categories_v2');
      if (saved) {
        try {
          const parsed = JSON.parse(saved);
          if (Array.isArray(parsed)) return parsed;
        } catch (e) {
          console.error(e);
        }
      }
    }
    return [];
  });

  const [competitionsSyncState, setCompetitionsSyncState] = useState<'loading' | 'ready' | 'error' | 'idle'>(isIsolatedDemoOrTest ? 'ready' : 'loading');

  const [competitions, setCompetitions] = useState<Competition[]>(() => {
    if (!isIsolatedDemoOrTest) {
      return [];
    }

    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem('fest_competitions_v2');
      if (saved) {
        try {
          const parsed = JSON.parse(saved);
          if (Array.isArray(parsed)) return parsed;
        } catch (e) {
          console.error(e);
        }
      }
    }
    return [];
  });

  const [participantsSyncState, setParticipantsSyncState] = useState<'loading' | 'ready' | 'error' | 'idle'>(isIsolatedDemoOrTest ? 'ready' : 'loading');

  const [participants, setParticipants] = useState<Participant[]>(() => {
    if (!isIsolatedDemoOrTest) {
      return [];
    }

    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem('fest_participants_v2');
      if (saved) {
        try {
          const parsed = JSON.parse(saved);
          if (Array.isArray(parsed)) return parsed;
        } catch (e) {
          console.error(e);
        }
      }
    }
    return [];
  });

  const [registrationsSyncState, setRegistrationsSyncState] = useState<'loading' | 'ready' | 'error' | 'idle'>(isIsolatedDemoOrTest ? 'ready' : 'loading');

  const [registrations, setRegistrations] = useState<Registration[]>(() => {
    if (!isIsolatedDemoOrTest) {
      return [];
    }

    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem('fest_registrations_v2');
      if (saved) {
        try {
          const parsed = JSON.parse(saved);
          if (Array.isArray(parsed)) return parsed;
        } catch (e) {
          console.error(e);
        }
      }
    }
    return [];
  });

  const [stages, setStages] = useState<Stage[]>(() => {
    if (!isIsolatedDemoOrTest) {
      return [];
    }

    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem('fest_stages_v2');
      if (saved) {
        try {
          const parsed = JSON.parse(saved);
          if (Array.isArray(parsed)) return parsed;
        } catch (e) {
          console.error(e);
        }
      }
    }
    return [];
  });

  const [stagesSyncState, setStagesSyncState] = useState<'loading' | 'ready' | 'error' | 'idle'>(isIsolatedDemoOrTest ? 'ready' : 'loading');

  const [schedulesSyncState, setSchedulesSyncState] = useState<'loading' | 'ready' | 'error' | 'idle'>(isIsolatedDemoOrTest ? 'ready' : 'loading');

  const [schedules, setSchedules] = useState<ScheduleSlot[]>(() => {
    if (!isIsolatedDemoOrTest) {
      return [];
    }

    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem('fest_schedules_v2');
      if (saved) {
        try {
          const parsed = JSON.parse(saved);
          if (Array.isArray(parsed)) return parsed;
        } catch (e) {
          console.error(e);
        }
      }
    }
    return [];
  });

  const [rawJudgeAssignments, setRawJudgeAssignments] = useState<MarkEntry[]>([]);
  const [markEntriesSyncState, setMarkEntriesSyncState] = useState<'loading' | 'ready' | 'error' | 'idle'>(isIsolatedDemoOrTest ? 'ready' : 'loading');

  // Show ONLY judge assignments and mark entries for competitions that actually exist in Firestore
  const markEntries = useMemo(() => {
    if (competitions.length === 0) return [];
    const validCompIds = new Set(competitions.map(c => c.id));
    return rawJudgeAssignments.filter(entry => validCompIds.has(entry.competitionId));
  }, [rawJudgeAssignments, competitions]);

  const setMarkEntries = useCallback((action: React.SetStateAction<MarkEntry[]>) => {
    setRawJudgeAssignments(action);
  }, []);

  const [resultRecords, setResults] = useState<CompetitionResult[]>(() => {
    if (!isIsolatedDemoOrTest) {
      return [];
    }

    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem('fest_results_v2');
      if (saved) {
        try { return JSON.parse(saved); } catch (e) { console.error(e); }
      }
    }
    return initialResults;
  });
  const [resultsSyncState, setResultsSyncState] = useState<'loading' | 'ready' | 'error' | 'idle'>(isIsolatedDemoOrTest ? 'ready' : 'loading');

  const topScorersSyncState = useMemo(() => {
    const states = [competitionsSyncState, participantsSyncState, registrationsSyncState, resultsSyncState];
    if (states.includes('error')) return 'error' as const;
    if (states.every(state => state === 'ready')) return 'ready' as const;
    if (states.includes('idle')) return 'idle' as const;
    return 'loading' as const;
  }, [competitionsSyncState, participantsSyncState, registrationsSyncState, resultsSyncState]);

  // Draft artwork lives only in memory after an authenticated API read. Cached result
  // data never determines whether a poster is publicly available.
  const [posterMedia, setPosterMedia] = useState<Record<string, PosterMediaRecord>>({});
  const posterRevision = useRef(0);
  const results = useMemo(() => resultRecords.map(result => {
    const media = posterMedia[result.id];
    const published = result.resultStatus === 'PUBLISHED' && media?.posterReleased === true;
    return {
      ...result,
      posterReleased: published,
      posterConfig: published ? media.posterPublishedConfig : undefined,
      posterPublishedConfig: published ? media.posterPublishedConfig : undefined,
      posterDraftConfig: media?.posterDraftConfig,
    };
  }), [resultRecords, posterMedia]);

  const [pointsLedger, setPointsLedger] = useState<PointsLedgerEntry[]>(() => {
    if (!isIsolatedDemoOrTest) {
      return [];
    }

    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem('fest_points_ledger_v2');
      if (saved) {
        try { return JSON.parse(saved); } catch (e) { console.error(e); }
      }
    }
    return initialPointsLedger;
  });

  // Teams with points dynamically updated from the Points Ledger
  const [teamsSyncState, setTeamsSyncState] = useState<'loading' | 'ready' | 'error' | 'idle'>(isIsolatedDemoOrTest ? 'ready' : 'loading');

  const [teams, setTeams] = useState<Team[]>(() => {
    // In live production, demo fixtures are strictly isolated; authoritative source is Firestore
    if (!isIsolatedDemoOrTest) {
      return [];
    }

    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem('fest_teams_v2');
      if (saved) {
        try {
          const parsed = JSON.parse(saved);
          if (Array.isArray(parsed) && parsed.length > 0) return parsed;
        } catch (e) {
          console.error(e);
        }
      }
    }
    const calculated = recalculateTeamChampionship(initialBaseTeams, initialPointsLedger);
    return initialBaseTeams.map(t => {
      const agg = calculated.find(c => c.teamId === t.id);
      return {
        ...t,
        totalPoints: agg ? agg.totalPoints : 0,
        soloPoints: agg ? agg.soloPoints : 0,
        groupPoints: agg ? agg.groupPoints : 0,
        firstCount: agg ? agg.firstCount : 0,
        secondCount: agg ? agg.secondCount : 0,
        thirdCount: agg ? agg.thirdCount : 0,
        rank: agg ? agg.rank : 1
      };
    });
  });

  const [currentTeamUser, setCurrentTeamUser] = useState<Team | null>(() => {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem('fest_current_team_user_v2');
      if (saved) {
        try {
          return JSON.parse(saved);
        } catch (e) {
          console.error(e);
        }
      }
    }
    return null;
  });

  // Keep the authenticated manager's in-memory team in sync with the authoritative
  // team collection. Scores and standings can change while a manager stays signed in.
  useEffect(() => {
    if (!currentTeamUser) return;
    const latestTeam = teams.find(team => team.id === currentTeamUser.id);
    if (latestTeam && latestTeam !== currentTeamUser) {
      setCurrentTeamUser(latestTeam);
    }
  }, [teams, currentTeamUser]);


  // Purge stale localStorage caches in live production
  useEffect(() => {
    if (!isIsolatedDemoOrTest && typeof window !== 'undefined') {
      try {
        localStorage.removeItem('fest_teams_v2');
        localStorage.removeItem('fest_current_team_user_v2');
        localStorage.removeItem('fest_theme_settings_v2');
        localStorage.removeItem('fest_categories_v2');
        localStorage.removeItem('fest_competitions_v2');
        localStorage.removeItem('fest_participants_v2');
        localStorage.removeItem('fest_registrations_v2');
        localStorage.removeItem('fest_stages_v2');
        localStorage.removeItem('fest_schedules_v2');
        localStorage.removeItem('fest_mark_entries_v2');
        localStorage.removeItem('fest_results_v2');
        localStorage.removeItem('fest_points_ledger_v2');
      } catch {}
    }
  }, [isIsolatedDemoOrTest]);

  // Read official records from the same source the poster API checks before release.
  // Public subscriptions cannot see unpublished results or private poster drafts.
  useEffect(() => {
    if (!db) {
      setResultsSyncState(isIsolatedDemoOrTest ? 'ready' : 'error');
      return;
    }
    const firestore = db;
    let stopped = false;
    let generation = 0;
    let ready = false;
    let isAdmin = false;
    let unsubscribeResults: (() => void) | undefined;

    const refreshPosters = async () => {
      if (!ready || stopped) return;
      const currentGeneration = generation;
      const currentRevision = posterRevision.current;
      try {
        const token = isAdmin && auth?.currentUser ? await auth.currentUser.getIdToken() : null;
        const response = await fetch(isAdmin ? '/api/posters?view=admin' : '/api/posters', {
          cache: 'no-store',
          headers: token ? { Authorization: `Bearer ${token}` } : {},
        });
        if (!response.ok) throw new Error('Could not refresh saved posters.');
        const data = await response.json() as { posters: Array<PosterMediaRecord | ReleasedPoster> };
        if (stopped || generation !== currentGeneration || currentRevision !== posterRevision.current) return;
        const records: Record<string, PosterMediaRecord> = {};
        for (const item of data.posters) {
          records[item.resultId] = 'config' in item
            ? { resultId: item.resultId, posterReleased: true, posterPublishedConfig: item.config }
            : item;
        }
        setPosterMedia(records);
      } catch (error) {
        if (!stopped && generation === currentGeneration && currentRevision === posterRevision.current) {
          // An expired or revoked session cannot retain a cached private draft.
          setPosterMedia({});
          console.warn('[FestContext] Poster synchronization failed:', error);
        }
      }
    };

    const subscribe = async () => {
      const currentGeneration = ++generation;
      ready = false;
      setResultsSyncState('loading');
      unsubscribeResults?.();
      setPosterMedia({});
      let admin = false;
      try { admin = (await auth?.currentUser?.getIdTokenResult(true))?.claims.role === 'ADMIN'; }
      catch (error) { console.warn('[FestContext] Could not verify result access:', error); }
      if (stopped || currentGeneration !== generation) return;
      isAdmin = admin;
      const source = admin
        ? collection(firestore, 'results')
        : query(collection(firestore, 'results'), where('resultStatus', '==', 'PUBLISHED'));
      unsubscribeResults = onSnapshot(source, snapshot => {
        if (stopped || currentGeneration !== generation) return;
        const records = snapshot.docs.map(item => readStoredResult(item.id, item.data()));
        setResults(records);
        setResultsSyncState('ready');
      }, error => {
        setResultsSyncState('error');
        console.warn('[FestContext] Official results synchronization failed:', error);
      });
      ready = true;
      void refreshPosters();
    };

    const unsubscribeAuth = auth ? onAuthStateChanged(auth, () => { void subscribe(); }) : undefined;
    if (!auth) void subscribe();
    const interval = window.setInterval(() => { void refreshPosters(); }, 30_000);
    const onFocus = () => { void refreshPosters(); };
    window.addEventListener('focus', onFocus);
    return () => {
      stopped = true;
      generation++;
      unsubscribeAuth?.();
      unsubscribeResults?.();
      window.clearInterval(interval);
      window.removeEventListener('focus', onFocus);
    };
  }, [isIsolatedDemoOrTest]);

  // Realtime Firestore teams synchronization for live production.
  useEffect(() => {
    if (isIsolatedDemoOrTest) {
      setTeamsSyncState('ready');
      return;
    }
    if (!db) {
      setTeamsSyncState('error');
      return;
    }

    setTeamsSyncState('loading');
    try {
      const teamsRef = collection(db, 'teams');
      const unsubscribe = onSnapshot(
        teamsRef,
        snapshot => {
          const liveTeams: Team[] = snapshot.docs.map((d, idx) => {
            const dt = d.data();
            return {
              id: d.id,
              name: dt.name || '',
              code: dt.code || '',
              color: dt.color || '#2563EB',
              managerName: dt.managerName || '',
              managerEmail: dt.managerEmail || '',
              managerPhone: dt.managerPhone || '',
              zone: dt.zone || '',
              contestantsCount: dt.contestantsCount || 0,
              eventsCount: dt.eventsCount || 0,
              totalPoints: dt.totalPoints || 0,
              soloPoints: dt.soloPoints || 0,
              groupPoints: dt.groupPoints || 0,
              rank: dt.rank || idx + 1,
              firstCount: dt.firstCount || 0,
              secondCount: dt.secondCount || 0,
              thirdCount: dt.thirdCount || 0,
              portalAccess: dt.portalAccess !== false && dt.status !== 'DISABLED',
              status: dt.status || 'ACTIVE',
              provisioningStatus: dt.provisioningStatus || (dt.managerEmail ? 'PROVISIONED' : 'AWAITING_MANAGER'),
              invitationStatus: dt.invitationStatus || 'PENDING',
              invitationSentAt: dt.invitationSentAt || '',
              invitationExpiresAt: dt.invitationExpiresAt || ''
            };
          });
          setTeams(liveTeams);
          setTeamsSyncState('ready');
        },
        err => {
          setTeamsSyncState('error');
          console.warn('[FestContext] Firestore realtime teams sync warning:', err);
        }
      );
      return () => unsubscribe();
    } catch (error) {
      setTeamsSyncState('error');
      console.warn('[FestContext] Could not subscribe to realtime teams:', error);
    }
  }, [isIsolatedDemoOrTest, db]);

  // Realtime Firestore categories synchronization for live production.
  useEffect(() => {
    if (isIsolatedDemoOrTest) {
      setCategoriesSyncState('ready');
      return;
    }
    if (!db) {
      setCategoriesSyncState('error');
      return;
    }

    const firestore = db;
    setCategoriesSyncState('loading');
    try {
      const catRef = collection(firestore, 'categories');
      const unsubscribe = onSnapshot(
        catRef,
        snapshot => {
          const liveCategories: Category[] = snapshot.docs.map(d => {
            const dt = d.data();
            return {
              id: d.id,
              name: dt.name || '',
              code: dt.code || '',
              eligibility: dt.eligibility || '',
              ageRange: dt.ageRange || '',
              classRange: dt.classRange || '',
              enrolledCount: dt.enrolledCount || 0,
              competitionsCount: dt.competitionsCount || 0,
              status: dt.status || 'ACTIVE'
            };
          });
          setCategories(liveCategories);
          setCategoriesSyncState('ready');
        },
        err => {
          setCategoriesSyncState('error');
          console.warn('[FestContext] Firestore categories sync warning:', err);
        }
      );
      return () => unsubscribe();
    } catch (error) {
      setCategoriesSyncState('error');
      console.warn('[FestContext] Could not subscribe to categories:', error);
    }
  }, [isIsolatedDemoOrTest, db]);

  // Realtime Firestore competitions synchronization for live production
  useEffect(() => {
    if (isIsolatedDemoOrTest) return;
    if (!db) {
      setCompetitionsSyncState('error');
      return;
    }
    setCompetitionsSyncState('loading');
    if (!isIsolatedDemoOrTest && db) {
      const firestore = db;
      try {
        const compRef = collection(firestore, 'competitions');
        const unsubscribe = onSnapshot(
          compRef,
          (snapshot) => {
            if (snapshot.empty) {
              setCompetitions([]);
              setCompetitionsSyncState('ready');
              return;
            }
            const liveCompetitions: Competition[] = snapshot.docs.map(d => {
              const dt = d.data();
              return {
                id: d.id,
                code: dt.code || '',
                name: dt.name || '',
                categoryId: dt.categoryId || '',
                categoryName: dt.categoryName || '',
                type: dt.type || 'SOLO',
                performanceMode: dt.performanceMode === 'STAGE' || dt.performanceMode === 'OFF_STAGE' ? dt.performanceMode : undefined,
                groupSize: Number.isInteger(dt.groupSize) && dt.groupSize > 0 ? dt.groupSize : undefined,
                entriesCount: dt.entriesCount || 0,
                stageId: dt.stageId || '',
                stageName: dt.stageName || '',
                assignedJudges: dt.assignedJudges || [],
                status: dt.status || 'SCHEDULED',
                date: dt.date || '',
                timeSlot: dt.timeSlot || '',
                durationMinutes: dt.durationMinutes || 60,
                maxEntriesPerTeam: dt.maxEntriesPerTeam || 1,
                criteria: dt.criteria || []
              };
            });
            setCompetitions(liveCompetitions);
            setCompetitionsSyncState('ready');
          },
          (err) => {
            setCompetitionsSyncState('error');
            console.warn('[FestContext] Firestore competitions sync warning:', err);
          }
        );
        return () => unsubscribe();
      } catch (e) {
        setCompetitionsSyncState('error');
        console.warn('[FestContext] Could not subscribe to competitions:', e);
      }
    }
  }, [isIsolatedDemoOrTest]);

  // Realtime Firestore stages synchronization for live production.
  // The collection is publicly readable, while Firestore rules keep all writes Admin-only.
  useEffect(() => {
    if (isIsolatedDemoOrTest) {
      setStagesSyncState('ready');
      return;
    }
    if (!db) {
      setStagesSyncState('error');
      return;
    }

    const firestore = db;
    setStagesSyncState('loading');
    try {
      const stagesRef = collection(firestore, 'stages');
      const unsubscribe = onSnapshot(
        stagesRef,
        (snapshot) => {
          const liveStages: Stage[] = snapshot.docs.map(d => {
            const dt = d.data();
            return {
              id: d.id,
              code: dt.code || '',
              name: dt.name || '',
              venue: dt.venue || '',
              capacity: typeof dt.capacity === 'number' ? dt.capacity : Number(dt.capacity) || 0,
              managerName: dt.managerName || '',
              managerPhone: dt.managerPhone || '',
              audioVisualStatus: dt.audioVisualStatus || 'OPERATIONAL',
              currentEvent: dt.currentEvent || '',
              nextEvent: dt.nextEvent || ''
            };
          });
          setStages(liveStages);
          setStagesSyncState('ready');
        },
        (err) => {
          setStagesSyncState('error');
          console.warn('[FestContext] Firestore stages sync warning:', err);
        }
      );
      return () => unsubscribe();
    } catch (e) {
      setStagesSyncState('error');
      console.warn('[FestContext] Could not subscribe to stages:', e);
    }
  }, [isIsolatedDemoOrTest, db]);

  // Realtime Firestore schedules synchronization for live production.
  // Every snapshot, including an empty collection, is authoritative and marks the feed ready.
  useEffect(() => {
    if (isIsolatedDemoOrTest) {
      setSchedulesSyncState('ready');
      return;
    }
    if (!db) {
      setSchedulesSyncState('error');
      return;
    }

    const firestore = db;
    let active = true;
    setSchedulesSyncState('loading');
    try {
      const schedulesRef = collection(firestore, 'schedules');
      const unsubscribe = onSnapshot(
        schedulesRef,
        snapshot => {
          if (!active) return;
          const liveSchedules: ScheduleSlot[] = snapshot.docs.map(d => {
            const dt = d.data();
            const rawStatus = dt.status;
            const safeStatus = ['SCHEDULED', 'LIVE', 'COMPLETED', 'DELAYED'].includes(rawStatus)
              ? rawStatus as ScheduleSlot['status']
              : 'SCHEDULED';
            return {
              id: d.id,
              competitionId: dt.competitionId || '',
              competitionName: dt.competitionName || '',
              categoryName: dt.categoryName || '',
              type: dt.type || 'SOLO',
              stageId: dt.stageId || '',
              stageName: dt.stageName || '',
              date: dt.date || '',
              startTime: dt.startTime || '',
              endTime: dt.endTime || '',
              status: safeStatus
            };
          });
          setSchedules(liveSchedules);
          setSchedulesSyncState('ready');
        },
        err => {
          if (!active) return;
          setSchedulesSyncState('error');
          console.warn('[FestContext] Firestore schedules sync warning:', err);
        }
      );
      return () => {
        active = false;
        unsubscribe();
      };
    } catch (error) {
      active = false;
      setSchedulesSyncState('error');
      console.warn('[FestContext] Could not subscribe to schedules:', error);
    }
  }, [isIsolatedDemoOrTest, db]);

  // Realtime Firestore points ledger synchronization for live production
  useEffect(() => {
    if (!isIsolatedDemoOrTest && db) {
      const firestore = db;
      let unsubscribeLedger: (() => void) | undefined;
      let stopped = false;

      const subscribe = async () => {
        let isAdmin = false;
        try {
          const tokenResult = await auth?.currentUser?.getIdTokenResult();
          isAdmin = tokenResult?.claims?.role === 'ADMIN';
        } catch {}
        if (stopped) return;

        const ledgerRef = isAdmin
          ? collection(firestore, 'pointsLedger')
          : query(collection(firestore, 'pointsLedger'), where('status', '==', 'COMMITTED'));

        unsubscribeLedger?.();
        unsubscribeLedger = onSnapshot(
          ledgerRef,
          (snapshot) => {
            if (stopped) return;
            const liveEntries: PointsLedgerEntry[] = snapshot.docs.map(d => {
              const dt = d.data();
              return {
                id: d.id,
                resultId: dt.resultId || '',
                competitionId: dt.competitionId || '',
                competitionCode: dt.competitionCode || '',
                competitionName: dt.competitionName || '',
                competitionType: dt.competitionType || 'SOLO',
                teamId: dt.teamId || '',
                teamCode: dt.teamCode || '',
                teamName: dt.teamName || '',
                registrationId: dt.registrationId || '',
                candidateName: dt.candidateName || '',
                bib: dt.bib || '',
                score: dt.score || 0,
                rank: dt.rank,
                grade: dt.grade,
                points: dt.points || 0,
                status: dt.status || 'COMMITTED',
                publishedAt: dt.publishedAt || ''
              };
            });
            setPointsLedger(liveEntries);
          },
          (err) => {
            console.warn('[FestContext] Firestore pointsLedger sync warning:', err);
          }
        );
      };

      const unsubAuth = auth ? onAuthStateChanged(auth, () => { void subscribe(); }) : undefined;
      void subscribe();

      return () => {
        stopped = true;
        unsubAuth?.();
        unsubscribeLedger?.();
      };
    }
  }, [isIsolatedDemoOrTest]);

  // Realtime Firestore participants and registrations synchronization for live production
  useEffect(() => {
    if (isIsolatedDemoOrTest) return;
    if (!db || !auth) {
      setParticipantsSyncState('error');
      setRegistrationsSyncState('error');
      return;
    }
    const firestore = db;

    let unsubParts: (() => void) | null = null;
    let unsubRegs: (() => void) | null = null;
    let unsubJudges: (() => void) | null = null;

    const unsubAuth = onAuthStateChanged(auth, async (user) => {
      setParticipantsSyncState('loading');
      setRegistrationsSyncState('loading');
      if (unsubParts) {
        unsubParts();
        unsubParts = null;
      }
      if (unsubRegs) {
        unsubRegs();
        unsubRegs = null;
      }
      if (unsubJudges) {
        unsubJudges();
        unsubJudges = null;
      }

      if (!user) {
        setParticipants([]);
        setRegistrations([]);
        setParticipantsSyncState('idle');
        setRegistrationsSyncState('idle');
        setMarkEntries([]);
        setMarkEntriesSyncState('idle');
        return;
      }

      try {
        const tokenResult = await user.getIdTokenResult(true);
        const role = tokenResult.claims.role || (currentTeamUser ? 'TEAM_MANAGER' : undefined);
        const teamId = (tokenResult.claims.teamId as string | undefined) || currentTeamUser?.id;
        if (role === 'GREEN_ROOM_STAFF') {
          setParticipantsSyncState('idle');
          setMarkEntriesSyncState('idle');
        } else if (role !== 'ADMIN' && role !== 'TEAM_MANAGER') {
          setParticipantsSyncState('idle');
          setRegistrationsSyncState('idle');
          setMarkEntriesSyncState('idle');
        }

        if (role === 'ADMIN') {
          // 1. Admin reads all participants in realtime
          const partsRef = collection(firestore, 'participants');
          unsubParts = onSnapshot(
            partsRef,
            (snapshot) => {
              const liveParts: Participant[] = snapshot.docs.map(d => {
                const dt = d.data();
                return {
                  id: d.id,
                  bib: dt.bib || '',
                  name: dt.name || '',
                  email: dt.email || '',
                  phone: dt.phone || '',
                  teamId: dt.teamId || '',
                  teamCode: dt.teamCode || '',
                  teamName: dt.teamName || '',
                  categoryId: dt.categoryId || '',
                  categoryName: dt.categoryName || '',
                  classGrade: dt.classGrade || '',
                  division: dt.division || '',
                  dob: dt.dob || '',
                  photoUrl: dt.photoUrl || '',
                  registeredEventIds: Array.isArray(dt.registeredEventIds) ? dt.registeredEventIds.filter((eventId: unknown): eventId is string => typeof eventId === 'string') : [],
                  idStatus: dt.idStatus || 'GENERATED',
                  remarks: dt.remarks
                };
              });
              setParticipants(liveParts);
              setParticipantsSyncState('ready');
            },
            (err) => {
              setParticipantsSyncState('error');
              console.warn('[FestContext] Firestore participants sync warning:', err);
            }
          );

          // 2. Admin reads all registrations in realtime
          const regsRef = collection(firestore, 'registrations');
          unsubRegs = onSnapshot(
            regsRef,
            (snapshot) => {
              if (snapshot.empty) {
                setRegistrations([]);
                setRegistrationsSyncState('ready');
                return;
              }
              const liveRegs: Registration[] = snapshot.docs.map(d => {
                const dt = d.data();
                return {
                  id: d.id,
                  code: dt.code || '',
                  participantId: dt.participantId,
                  groupLeaderId: dt.groupLeaderId,
                  groupSize: dt.groupSize,
                  participantName: dt.participantName || '',
                  teamId: dt.teamId || '',
                  teamCode: dt.teamCode || '',
                  teamName: dt.teamName || '',
                  categoryId: dt.categoryId || '',
                  categoryName: dt.categoryName || '',
                  competitionId: dt.competitionId || '',
                  competitionName: dt.competitionName || '',
                  type: dt.type || 'SOLO',
                  chestNumber: dt.chestNumber || '',
                  status: dt.status || 'PENDING',
                  groupMembers: dt.groupMembers,
                  registeredAt: dt.registeredAt || ''
                };
              });
              setRegistrations(liveRegs);
              setRegistrationsSyncState('ready');
            },
            (err) => {
              setRegistrationsSyncState('error');
              console.warn('[FestContext] Firestore registrations sync warning:', err);
            }
          );

          // 3. Admin reads all judge assignments in realtime across browsers
          setMarkEntriesSyncState('loading');
          const judgesRef = collection(firestore, 'judgeAssignments');
          unsubJudges = onSnapshot(
            judgesRef,
            (snapshot) => {
              if (snapshot.empty) {
                setRawJudgeAssignments([]);
                setMarkEntriesSyncState('ready');
                return;
              }
              const liveAssignments: MarkEntry[] = snapshot.docs.map(d => {
                const dt = d.data();
                return {
                  id: d.id,
                  competitionId: dt.competitionId || '',
                  competitionName: dt.competitionName || '',
                  competitionCode: dt.competitionCode || '',
                  categoryName: dt.categoryName || 'General',
                  type: dt.type || 'SOLO',
                  judgeName: dt.judgeName || '',
                  judgePhone: dt.judgePhone || '',
                  accessCode: dt.accessCode || '',
                  secretHash: dt.secretHash || '',
                  salt: dt.salt || '',
                  expiresAt: dt.expiresAt || '',
                  revoked: dt.revoked || false,
                  status: dt.status === 'ACTIVE' ? 'NOT_STARTED' : (dt.status || 'NOT_STARTED'),
                  scores: dt.scores || [],
                  submittedAt: dt.submittedAt,
                  verificationHash: dt.verificationHash
                };
              });
              setRawJudgeAssignments(liveAssignments);
              setMarkEntriesSyncState('ready');
            },
            (err) => {
              setMarkEntriesSyncState('error');
              console.warn('[FestContext] Firestore judgeAssignments sync warning:', err);
            }
          );

          // Automatic demo-data seeding and legacy background migration are disabled in production
          // to ensure a clean database reset and require explicit migration approval.
        } else if (role === 'GREEN_ROOM_STAFF') {
          // Green Room Staff need to look up APPROVED competition registrations before
          // assigning anonymous Code Letters. They must not receive Admin-only judge
          // assignments or participant management data.
          const approvedRegs = query(
            collection(firestore, 'registrations'),
            where('status', '==', 'APPROVED')
          );
          unsubRegs = onSnapshot(
            approvedRegs,
            (snapshot) => {
              const assignedRegistrations: Registration[] = snapshot.docs.map(d => {
                const dt = d.data();
                return {
                  id: d.id,
                  code: dt.code || '',
                  participantId: dt.participantId,
                  groupLeaderId: dt.groupLeaderId,
                  groupSize: dt.groupSize,
                  participantName: dt.participantName || '',
                  teamId: dt.teamId || '',
                  teamCode: dt.teamCode || '',
                  teamName: dt.teamName || '',
                  categoryId: dt.categoryId || '',
                  categoryName: dt.categoryName || '',
                  competitionId: dt.competitionId || '',
                  competitionName: dt.competitionName || '',
                  type: dt.type || 'SOLO',
                  chestNumber: dt.chestNumber || '',
                  status: dt.status || 'PENDING',
                  groupMembers: dt.groupMembers,
                  registeredAt: dt.registeredAt || ''
                };
              });
              setRegistrations(assignedRegistrations);
            },
            (err) => {
              console.warn('[FestContext] Green Room Staff registrations sync failed:', err);
              setRegistrations([]);
            }
          );
        } else if (role === 'TEAM_MANAGER' && teamId) {
          // 1. Team Manager reads ONLY their own team's participants
          const partsQ = query(collection(firestore, 'participants'), where('teamId', '==', teamId));
          unsubParts = onSnapshot(
            partsQ,
            (snapshot) => {
              const liveParts: Participant[] = snapshot.docs.map(d => {
                const dt = d.data();
                return {
                  id: d.id,
                  bib: dt.bib || '',
                  name: dt.name || '',
                  email: dt.email || '',
                  phone: dt.phone || '',
                  teamId: dt.teamId || '',
                  teamCode: dt.teamCode || '',
                  teamName: dt.teamName || '',
                  categoryId: dt.categoryId || '',
                  categoryName: dt.categoryName || '',
                  classGrade: dt.classGrade || '',
                  division: dt.division || '',
                  dob: dt.dob || '',
                  photoUrl: dt.photoUrl || '',
                  registeredEventIds: Array.isArray(dt.registeredEventIds) ? dt.registeredEventIds.filter((eventId: unknown): eventId is string => typeof eventId === 'string') : [],
                  idStatus: dt.idStatus || 'GENERATED',
                  remarks: dt.remarks
                };
              });
              setParticipants(liveParts);
              setParticipantsSyncState('ready');
            },
            (err) => {
              setParticipantsSyncState('error');
              console.warn('[FestContext] Firestore team participants sync warning:', err);
            }
          );

          // 2. Team Manager reads ONLY their own team's registrations
          const regsQ = query(collection(firestore, 'registrations'), where('teamId', '==', teamId));
          unsubRegs = onSnapshot(
            regsQ,
            (snapshot) => {
              const liveRegs: Registration[] = snapshot.docs.map(d => {
                const dt = d.data();
                return {
                  id: d.id,
                  code: dt.code || '',
                  participantId: dt.participantId,
                  groupLeaderId: dt.groupLeaderId,
                  groupSize: dt.groupSize,
                  participantName: dt.participantName || '',
                  teamId: dt.teamId || '',
                  teamCode: dt.teamCode || '',
                  teamName: dt.teamName || '',
                  categoryId: dt.categoryId || '',
                  categoryName: dt.categoryName || '',
                  competitionId: dt.competitionId || '',
                  competitionName: dt.competitionName || '',
                  type: dt.type || 'SOLO',
                  chestNumber: dt.chestNumber || '',
                  status: dt.status || 'PENDING',
                  groupMembers: dt.groupMembers,
                  registeredAt: dt.registeredAt || ''
                };
              });
              setRegistrations(liveRegs);
              setRegistrationsSyncState('ready');
            },
            (err) => {
              setRegistrationsSyncState('error');
              console.warn('[FestContext] Firestore team registrations sync warning:', err);
            }
          );

          // Stale local participant/registration auto-migration is disabled to prevent accidental recreation.
        } else if (role === 'TEAM_MANAGER') {
          setParticipantsSyncState('error');
          setRegistrationsSyncState('error');
          console.warn('[FestContext] Team Manager session is missing an assigned team ID.');
        }
      } catch (authErr) {
        setParticipantsSyncState('error');
        setRegistrationsSyncState('error');
        console.warn('[FestContext] Auth state token check warning:', authErr);
      }
    });

    return () => {
      unsubAuth();
      if (unsubParts) unsubParts();
      if (unsubRegs) unsubRegs();
      if (unsubJudges) unsubJudges();
    };
  }, [isIsolatedDemoOrTest, currentTeamUser, setMarkEntries]);

  // Sync state to localStorage only in offline demo mode
  useEffect(() => {
    if (typeof window !== 'undefined') {
      if (isIsolatedDemoOrTest) {
        localStorage.setItem('fest_theme_settings_v2', JSON.stringify(theme));
        localStorage.setItem('fest_categories_v2', JSON.stringify(categories));
        localStorage.setItem('fest_teams_v2', JSON.stringify(teams));
        localStorage.setItem('fest_competitions_v2', JSON.stringify(competitions));
        localStorage.setItem('fest_participants_v2', JSON.stringify(participants));
        localStorage.setItem('fest_registrations_v2', JSON.stringify(registrations));
        localStorage.setItem('fest_stages_v2', JSON.stringify(stages));
        localStorage.setItem('fest_schedules_v2', JSON.stringify(schedules));
        localStorage.setItem('fest_mark_entries_v2', JSON.stringify(markEntries));
        localStorage.setItem('fest_results_v2', JSON.stringify(results.map(result => ({
          ...result,
          posterReleased: false,
          posterConfig: undefined,
          posterPublishedConfig: undefined,
          posterDraftConfig: undefined,
        }))));
        localStorage.setItem('fest_points_ledger_v2', JSON.stringify(pointsLedger));
      } else {
        localStorage.removeItem('fest_categories_v2');
        localStorage.removeItem('fest_teams_v2');
        localStorage.removeItem('fest_competitions_v2');
        localStorage.removeItem('fest_participants_v2');
        localStorage.removeItem('fest_registrations_v2');
        localStorage.removeItem('fest_stages_v2');
        localStorage.removeItem('fest_schedules_v2');
        localStorage.removeItem('fest_mark_entries_v2');
        localStorage.removeItem('fest_results_v2');
        localStorage.removeItem('fest_points_ledger_v2');
      }
      if (currentTeamUser) {
        localStorage.setItem('fest_current_team_user_v2', JSON.stringify(currentTeamUser));
      } else {
        localStorage.removeItem('fest_current_team_user_v2');
      }
    }
  }, [theme, categories, teams, competitions, participants, registrations, stages, schedules, markEntries, results, pointsLedger, currentTeamUser, isIsolatedDemoOrTest]);

  const updateTheme = async (newTheme: Partial<PublicThemeSettings>) => {
    if (isIsolatedDemoOrTest) {
      setTheme(prev => ({ ...prev, ...newTheme }));
      return;
    }
    if (!db || !auth?.currentUser) {
      throw new Error('Chief Administrator authentication is required to save settings.');
    }
    // Firestore rules enforce ADMIN. Await the actual write and propagate failure.
    // The public Firestore listener publishes the authoritative values to all portals.
    await setDoc(doc(db, 'settings', 'publicTheme'), sanitizeForFirestore(newTheme), { merge: true });
    // Update the current session immediately after the authoritative write succeeds;
    // the publicTheme onSnapshot listener then confirms the same values for all portals.
    setTheme(prev => ({ ...prev, ...newTheme }));
    setThemeSyncState('ready');
  };

  const addCategory = async (catData: Omit<Category, 'id' | 'enrolledCount' | 'competitionsCount'>) => {
    let newCat: Category;

    if (!isIsolatedDemoOrTest) {
      const user = auth?.currentUser;
      if (!user) {
        throw new Error('Authentication required: Administrator sign-in is required to save a category.');
      }
      const token = await user.getIdToken();
      const res = await fetch('/api/admin/categories', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify(catData)
      });
      if (!res.ok) {
        const errPayload = await res.json().catch(() => ({}));
        throw new Error(errPayload.error || `Failed to create category (HTTP ${res.status})`);
      }
      const data = await res.json();
      newCat = data.category;
    } else {
      const newId = 'cat-' + Date.now().toString(36) + '-' + Math.random().toString(36).substring(2, 6);
      newCat = {
        ...catData,
        id: newId,
        enrolledCount: 0,
        competitionsCount: 0
      };
      if (db) {
        await setDoc(doc(db, 'categories', newId), sanitizeForFirestore(newCat));
      }
    }

    setCategories(prev => [...prev.filter(c => c.id !== newCat.id), newCat]);

    if (typeof window !== 'undefined') {
      try {
        const cached = localStorage.getItem('fest_categories_v2');
        if (cached) {
          const list: Category[] = JSON.parse(cached);
          localStorage.setItem('fest_categories_v2', JSON.stringify([...list.filter(c => c.id !== newCat.id), newCat]));
        }
      } catch (e) {
        console.warn('[FestContext] Error updating cached categories on add:', e);
      }
    }
  };

  const updateCategory = async (id: string, updated: Partial<Category>) => {
    let updatedCat: Category | null = null;

    if (!isIsolatedDemoOrTest) {
      const user = auth?.currentUser;
      if (!user) {
        throw new Error('Authentication required: Administrator sign-in is required to update a category.');
      }
      const token = await user.getIdToken();
      const res = await fetch(`/api/admin/categories/${encodeURIComponent(id)}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify(updated)
      });
      if (!res.ok) {
        const errPayload = await res.json().catch(() => ({}));
        throw new Error(errPayload.error || `Failed to update category (HTTP ${res.status})`);
      }
      const data = await res.json();
      updatedCat = data.category;
    } else {
      if (db) {
        await updateDoc(doc(db, 'categories', id), sanitizeForFirestore(updated));
      }
    }

    setCategories(prev => prev.map(c => {
      if (c.id === id) {
        return updatedCat ? updatedCat : { ...c, ...updated };
      }
      return c;
    }));

    if (typeof window !== 'undefined') {
      try {
        const cached = localStorage.getItem('fest_categories_v2');
        if (cached) {
          const list: Category[] = JSON.parse(cached);
          localStorage.setItem('fest_categories_v2', JSON.stringify(list.map(c => {
            if (c.id === id) {
              return updatedCat ? updatedCat : { ...c, ...updated };
            }
            return c;
          })));
        }
      } catch (e) {
        console.warn('[FestContext] Error updating cached categories on update:', e);
      }
    }
  };

  const deleteCategory = async (id: string) => {
    // 1. Client-side guard: verify no active competitions are assigned to this category
    const dependentComps = competitions.filter(c => c.categoryId === id);
    if (dependentComps.length > 0) {
      const compNames = dependentComps.slice(0, 3).map(c => `"${c.name}"`).join(', ');
      const moreText = dependentComps.length > 3 ? ` and ${dependentComps.length - 3} more` : '';
      throw new Error(`Cannot delete category: ${dependentComps.length} active competition(s) (${compNames}${moreText}) are assigned to this category. Please reassign or delete them first.`);
    }

    // 2. In non-isolated mode, execute server deletion via Admin API
    if (!isIsolatedDemoOrTest) {
      const user = auth?.currentUser;
      if (!user) {
        throw new Error('Authentication required: Administrator sign-in is required to delete a category.');
      }
      const token = await user.getIdToken();
      const res = await fetch(`/api/admin/categories/${encodeURIComponent(id)}`, {
        method: 'DELETE',
        headers: {
          Authorization: `Bearer ${token}`
        }
      });
      if (!res.ok) {
        const errPayload = await res.json().catch(() => ({}));
        throw new Error(errPayload.error || `Failed to delete category (HTTP ${res.status})`);
      }
    }

    // 3. Update local state and localStorage cache only on success
    setCategories(prev => prev.filter(c => c.id !== id));

    if (typeof window !== 'undefined') {
      try {
        const cached = localStorage.getItem('fest_categories_v2');
        if (cached) {
          const list: Category[] = JSON.parse(cached);
          localStorage.setItem('fest_categories_v2', JSON.stringify(list.filter(c => c.id !== id)));
        }
      } catch (e) {
        console.warn('[FestContext] Error updating cached categories:', e);
      }
    }
  };

  const handleSetCurrentTeamUser = (teamUser: Team | null) => {
    setCurrentTeamUser(teamUser);
    if (teamUser) {
      // Do not overwrite live championship totals with the login/localStorage
      // snapshot. Firestore's teams collection remains authoritative for existing teams.
      setTeams(prev => (
        prev.some(team => team.id === teamUser.id)
          ? prev
          : [...prev, teamUser]
      ));
    }
  };

  const addTeam = async (teamData: Omit<Team, 'id' | 'totalPoints' | 'soloPoints' | 'groupPoints' | 'rank' | 'firstCount' | 'secondCount' | 'thirdCount' | 'contestantsCount' | 'eventsCount'> & { id?: string }) => {
    const optionalFields = teamData as Partial<Team>;
    const customId = optionalFields.id;
    const newId = customId || ('team-' + Date.now().toString(36) + '-' + Math.random().toString(36).substring(2, 6));
    const newTeam: Team = {
      ...teamData,
      id: newId,
      contestantsCount: optionalFields.contestantsCount || 0,
      eventsCount: optionalFields.eventsCount || 0,
      totalPoints: optionalFields.totalPoints || 0,
      soloPoints: optionalFields.soloPoints || 0,
      groupPoints: optionalFields.groupPoints || 0,
      firstCount: optionalFields.firstCount || 0,
      secondCount: optionalFields.secondCount || 0,
      thirdCount: optionalFields.thirdCount || 0,
      rank: optionalFields.rank || (teams.length + 1)
    };
    if (!isIsolatedDemoOrTest && db) {
      await setDoc(doc(db, 'teams', newId), sanitizeForFirestore(newTeam), { merge: true });
    }
    setTeams(prev => {
      const idx = prev.findIndex(t => t.id === newTeam.id);
      if (idx !== -1) {
        const updated = [...prev];
        updated[idx] = { ...updated[idx], ...newTeam };
        return updated;
      }
      return [...prev, newTeam];
    });
  };

  const updateTeam = async (id: string, updated: Partial<Team>) => {
    if (!isIsolatedDemoOrTest && db) {
      await updateDoc(doc(db, 'teams', id), sanitizeForFirestore(updated));
    }
    setTeams(prev => prev.map(t => t.id === id ? { ...t, ...updated } : t));
  };

  const deleteTeam = async (id: string) => {
    if (!isIsolatedDemoOrTest && db) {
      await deleteDoc(doc(db, 'teams', id));
    }
    setTeams(prev => prev.filter(t => t.id !== id));
  };

  const addCompetition = async (compData: Omit<Competition, 'id' | 'entriesCount'>) => {
    const newId = 'cmp-' + Date.now().toString(36) + '-' + Math.random().toString(36).substring(2, 6);
    const newComp: Competition = {
      ...compData,
      id: newId,
      entriesCount: 0
    };
    if (!isIsolatedDemoOrTest && db) {
      await setDoc(doc(db, 'competitions', newId), sanitizeForFirestore(newComp));
    }
    setCompetitions(prev => [...prev.filter(c => c.id !== newId), newComp]);
  };

  const updateCompetition = async (id: string, updated: Partial<Competition>) => {
    if (!isIsolatedDemoOrTest && db) {
      await updateDoc(doc(db, 'competitions', id), sanitizeForFirestore(updated));
    }
    setCompetitions(prev => prev.map(c => c.id === id ? { ...c, ...updated } : c));
  };

  const deleteCompetition = async (id: string) => {
    // 1. In non-isolated mode, execute server cascade deletion via Admin API first
    if (!isIsolatedDemoOrTest) {
      const user = auth?.currentUser;
      if (!user) {
        throw new Error('Authentication required: Administrator sign-in is required to delete a competition.');
      }
      const token = await user.getIdToken();
      const res = await fetch(`/api/admin/competitions/${encodeURIComponent(id)}`, {
        method: 'DELETE',
        headers: {
          Authorization: `Bearer ${token}`
        }
      });
      if (!res.ok) {
        const errPayload = await res.json().catch(() => ({}));
        throw new Error(errPayload.error || `Failed to delete competition (HTTP ${res.status})`);
      }
    }

    // 2. Safely update local state and cascade remove related records
    setCompetitions(prev => prev.filter(c => c.id !== id));
    setRawJudgeAssignments(prev => prev.filter(j => j.competitionId !== id));
    setRegistrations(prev => prev.filter(r => r.competitionId !== id));
    setSchedules(prev => prev.filter(s => s.competitionId !== id));
    setResults(prev => prev.filter(r => r.competitionId !== id && r.id !== `res-${id}`));

    // 3. Update points ledger and recalculate championship team points dynamically
    const remainingLedger = pointsLedger.filter(p => p.competitionId !== id);
    setPointsLedger(remainingLedger);
    const aggregated = recalculateTeamChampionship(initialBaseTeams, remainingLedger);
    setTeams(prev => prev.map(t => {
      const agg = aggregated.find(a => a.teamId === t.id);
      return agg ? {
        ...t,
        totalPoints: agg.totalPoints,
        soloPoints: agg.soloPoints,
        groupPoints: agg.groupPoints,
        firstCount: agg.firstCount,
        secondCount: agg.secondCount,
        thirdCount: agg.thirdCount,
        rank: agg.rank
      } : t;
    }));

    if (typeof window !== 'undefined') {
      try {
        const cached = localStorage.getItem('fest_competitions_v2');
        if (cached) {
          const list: Competition[] = JSON.parse(cached);
          localStorage.setItem('fest_competitions_v2', JSON.stringify(list.filter(c => c.id !== id)));
        }
      } catch (e) {
        console.warn('[FestContext] Error updating cached competitions:', e);
      }
    }
  };

  const addParticipant = async (partData: Omit<Participant, 'id' | 'bib' | 'idStatus'>) => {
    let newParticipant: Participant;
    if (!isIsolatedDemoOrTest && db) {
      const user = auth?.currentUser;
      if (!user) throw new Error('Unauthorized: Sign in before registering a participant.');
      if (!partData.teamId) throw new Error('Validation Error: Participant team is required.');

      const response = await fetch(`/api/team/${encodeURIComponent(partData.teamId)}/participants`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${await user.getIdToken()}`
        },
        body: JSON.stringify(partData)
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(payload.error || 'Could not register the participant.');
      newParticipant = payload.participant as Participant;
    } else {
      let maxBibNum = 1000;
      for (const participant of participants) {
        const num = parseInt((participant.bib || '').replace('#', ''), 10);
        if (!isNaN(num) && num > maxBibNum) maxBibNum = num;
      }
      newParticipant = {
        ...partData,
        id: 'part-' + Date.now().toString(36) + '-' + Math.random().toString(36).substring(2, 6),
        bib: `#${maxBibNum + 1}`,
        idStatus: 'GENERATED'
      };
    }

    setParticipants(prev => [...prev.filter(p => p.id !== newParticipant.id), newParticipant]);
    setTeams(prev => prev.map(t => t.id === partData.teamId ? { ...t, contestantsCount: t.contestantsCount + 1 } : t));
    return newParticipant;
  };

  const checkParticipantCategoryConflicts = useCallback(async (
    participantId: string,
    newCategoryId: string
  ): Promise<Array<{
    registrationId: string;
    registrationCode: string;
    competitionId: string;
    competitionName: string;
    competitionCode: string;
    competitionCategoryName: string;
  }>> => {
    const part = participants.find(p => p.id === participantId);
    if (!part) return [];
    if (part.categoryId === newCategoryId) return [];

    let allCats = categories;
    let targetCat = allCats.find(c => c.id === newCategoryId);
    let allComps = competitions;
    let relevantRegs: Registration[] = [];

    if (!isIsolatedDemoOrTest && db) {
      const firestore = db;
      try {
        const [catsSnap, compsSnap, regsSnap, grpRegsSnap] = await Promise.all([
          getDocs(collection(firestore, 'categories')),
          getDocs(collection(firestore, 'competitions')),
          getDocs(query(collection(firestore, 'registrations'), where('participantId', '==', participantId))),
          getDocs(query(collection(firestore, 'registrations'), where('groupLeaderId', '==', participantId)))
        ]);

        allCats = catsSnap.docs.map(d => ({ id: d.id, ...d.data() } as Category));
        targetCat = allCats.find(c => c.id === newCategoryId);
        allComps = compsSnap.docs.map(d => ({ id: d.id, ...d.data() } as Competition));

        const seenRegIds = new Set<string>();
        const fetchedRegs: Registration[] = [];
        for (const snap of [...regsSnap.docs, ...grpRegsSnap.docs]) {
          if (!seenRegIds.has(snap.id)) {
            seenRegIds.add(snap.id);
            fetchedRegs.push({ id: snap.id, ...snap.data() } as Registration);
          }
        }
        relevantRegs = fetchedRegs;
      } catch (err) {
        console.warn('[FestContext] Firestore conflict check fallback to state:', err);
        relevantRegs = registrations.filter(r => r.participantId === participantId || r.groupLeaderId === participantId);
      }
    } else {
      relevantRegs = registrations.filter(r => r.participantId === participantId || r.groupLeaderId === participantId);
    }

    const activeRegs = relevantRegs.filter(r => (r.status as string) !== 'REJECTED' && (r.status as string) !== 'CANCELLED');
    const simulatedParticipant: Participant = {
      ...part,
      categoryId: newCategoryId,
      categoryName: targetCat?.name || part.categoryName
    };

    const conflicts: Array<{
      registrationId: string;
      registrationCode: string;
      competitionId: string;
      competitionName: string;
      competitionCode: string;
      competitionCategoryName: string;
    }> = [];

    for (const reg of activeRegs) {
      const comp = allComps.find(c => c.id === reg.competitionId);
      if (!comp) continue;
      const compCat = allCats.find(c => c.id === comp.categoryId);
      const isEligible = isParticipantEligibleForCategory(simulatedParticipant, compCat, allCats);
      if (!isEligible) {
        conflicts.push({
          registrationId: reg.id,
          registrationCode: reg.code || 'REG',
          competitionId: comp.id,
          competitionName: comp.name || 'Competition',
          competitionCode: comp.code || 'CMP',
          competitionCategoryName: comp.categoryName || compCat?.name || 'Category'
        });
      }
    }

    return conflicts;
  }, [categories, competitions, isIsolatedDemoOrTest, participants, registrations]);

  const updateParticipant = async (id: string, updated: Partial<Participant>) => {
    const currentParticipant = participants.find(p => p.id === id);

    // F-01: Category Switching Validation (Enforce at Context / State Layer)
    if (updated.categoryId && currentParticipant && updated.categoryId !== currentParticipant.categoryId) {
      const conflicts = await checkParticipantCategoryConflicts(id, updated.categoryId);
      if (conflicts.length > 0) {
        const compList = conflicts.map(c => `${c.competitionCode} (${c.competitionName})`).join(', ');
        throw new Error(
          `Validation Error: Cannot change category for participant "${currentParticipant.name}". Conflicting active registrations exist in: ${compList}. Please resolve conflicting registrations first.`
        );
      }
    }

    // F-02: Team Switching Counter Synchronization
    const oldTeamId = currentParticipant?.teamId;
    const newTeamId = updated.teamId;
    const isTeamChanged = Boolean(newTeamId && oldTeamId && newTeamId !== oldTeamId);

    if (!isIsolatedDemoOrTest && db) {
      const user = auth?.currentUser;
      if (!user) throw new Error('Unauthorized: Sign in before updating a participant.');
      const token = await user.getIdToken();
      const response = await fetch(`/api/participants/${encodeURIComponent(id)}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify(updated)
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(payload.error || 'Failed to update participant.');
      }
    }

    // Synchronize local React state
    setParticipants(prev => prev.map(p => p.id === id ? { ...p, ...updated } : p));
    if (isTeamChanged) {
      setTeams(prev => prev.map(t => {
        if (t.id === oldTeamId) {
          return { ...t, contestantsCount: Math.max(0, (t.contestantsCount ?? 0) - 1) };
        }
        if (t.id === newTeamId) {
          return { ...t, contestantsCount: (t.contestantsCount ?? 0) + 1 };
        }
        return t;
      }));
    }
  };

  const deleteParticipant = async (id: string) => {
    const partToDelete = participants.find(p => p.id === id);
    if (!isIsolatedDemoOrTest && db) {
      await deleteDoc(doc(db, 'participants', id));
      if (partToDelete?.teamId) {
        await updateDoc(doc(db, 'teams', partToDelete.teamId), {
          contestantsCount: Math.max(0, (teams.find(t => t.id === partToDelete.teamId)?.contestantsCount || 1) - 1)
        }).catch(() => {});
      }
    }
    setParticipants(prev => prev.filter(p => p.id !== id));
    if (partToDelete?.teamId) {
      setTeams(prev => prev.map(t => t.id === partToDelete.teamId ? { ...t, contestantsCount: Math.max(0, t.contestantsCount - 1) } : t));
    }
  };

  const addRegistration = async (regData: Omit<Registration, 'id' | 'code' | 'registeredAt'>) => {
    let newReg: Registration;
    if (!isIsolatedDemoOrTest && db) {
      const user = auth?.currentUser;
      if (!user) throw new Error('Unauthorized: Sign in before registering for a competition.');
      if (!regData.teamId) throw new Error('Validation Error: Registration team is required.');

      const response = await fetch(`/api/team/${encodeURIComponent(regData.teamId)}/registrations`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${await user.getIdToken()}`
        },
        body: JSON.stringify({
          competitionId: regData.competitionId,
          participantId: regData.participantId,
          participantName: regData.participantName,
          groupLeaderId: regData.groupLeaderId,
          groupMembers: regData.groupMembers
        })
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(payload.error || 'Could not register for the competition.');
      newReg = payload.registration as Registration;
    } else {
      let maxRegNum = 8820;
      for (const registration of registrations) {
        const num = parseInt((registration.code || '').replace('REG-', ''), 10);
        if (!isNaN(num) && num > maxRegNum) maxRegNum = num;
      }
      newReg = {
        ...regData,
        id: 'reg-' + Date.now().toString(36) + '-' + Math.random().toString(36).substring(2, 6),
        code: `REG-${maxRegNum + 1}`,
        registeredAt: new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })
      };
    }

    setRegistrations(prev => [...prev.filter(r => r.id !== newReg.id), newReg]);
    setCompetitions(prev => prev.map(c => c.id === regData.competitionId ? { ...c, entriesCount: c.entriesCount + 1 } : c));
  };

  const updateRegistrationStatus = async (id: string, status: 'APPROVED' | 'PENDING' | 'REJECTED' | 'CANCELLED') => {
    let targetCompId: string | undefined;
    let targetPartId: string | undefined;
    let targetGroupMembers: string[] = [];
    let prevStatus: string | undefined;

    if (!isIsolatedDemoOrTest && db) {
      const firestore = db;
      let otherActiveCompRegs: DocumentData[] = [];

      const existingReg = registrations.find(r => r.id === id);
      const estCompId = existingReg?.competitionId;
      if (estCompId) {
        try {
          const qSnap = await getDocs(query(
            collection(firestore, 'registrations'),
            where('competitionId', '==', estCompId)
          ));
          otherActiveCompRegs = qSnap.docs
            .filter(d => d.id !== id)
            .map(d => d.data())
            .filter(data => data.status !== 'REJECTED' && data.status !== 'CANCELLED');
        } catch {
          otherActiveCompRegs = registrations.filter(r =>
            r.id !== id &&
            r.competitionId === estCompId &&
            r.status !== 'REJECTED' &&
            r.status !== 'CANCELLED'
          );
        }
      }

      await runTransaction(firestore, async (transaction) => {
        const regRef = doc(firestore, 'registrations', id);
        const regSnap = await transaction.get(regRef);
        if (!regSnap.exists()) return;

        const regData = regSnap.data();
        prevStatus = regData.status;
        targetCompId = regData.competitionId;
        targetPartId = regData.participantId || regData.groupLeaderId;
        targetGroupMembers = Array.isArray(regData.groupMembers) ? regData.groupMembers : [];

        if (prevStatus === status) return;

        const allAffectedPartIds = Array.from(new Set([targetPartId, ...targetGroupMembers])).filter(Boolean) as string[];
        const wasApproved = prevStatus === 'APPROVED';
        const isApproved = status === 'APPROVED';

        let compSnap = null;
        if (targetCompId && (wasApproved !== isApproved)) {
          compSnap = await transaction.get(doc(firestore, 'competitions', targetCompId));
        }

        const partSnaps = await Promise.all(
          allAffectedPartIds.map(pId => transaction.get(doc(firestore, 'participants', pId)))
        );

        // 1. Update status
        transaction.update(regRef, { status });

        // 2. Manage entriesCount
        if (wasApproved && !isApproved && compSnap && compSnap.exists()) {
          const currentEntries = Number(compSnap.data().entriesCount ?? 0);
          transaction.update(doc(firestore, 'competitions', targetCompId!), { entriesCount: Math.max(0, currentEntries - 1) });
        } else if (!wasApproved && isApproved && compSnap && compSnap.exists()) {
          const currentEntries = Number(compSnap.data().entriesCount ?? 0);
          transaction.update(doc(firestore, 'competitions', targetCompId!), { entriesCount: currentEntries + 1 });
        }

        // 3. Manage registeredEventIds transitions
        if (status === 'REJECTED' || status === 'CANCELLED') {
          partSnaps.forEach((pSnap, idx) => {
            if (pSnap.exists() && targetCompId) {
              const pId = allAffectedPartIds[idx];
              const hasOtherActive = otherActiveCompRegs.some(r =>
                r.participantId === pId ||
                r.groupLeaderId === pId ||
                (Array.isArray(r.groupMembers) && r.groupMembers.includes(pId))
              );
              if (!hasOtherActive) {
                const existingEvents: string[] = Array.isArray(pSnap.data().registeredEventIds)
                  ? pSnap.data().registeredEventIds
                  : [];
                transaction.update(doc(firestore, 'participants', pId), {
                  registeredEventIds: existingEvents.filter(eId => eId !== targetCompId)
                });
              }
            }
          });
        } else if (status === 'APPROVED' || status === 'PENDING') {
          partSnaps.forEach((pSnap, idx) => {
            if (pSnap.exists() && targetCompId) {
              const pId = allAffectedPartIds[idx];
              const existingEvents: string[] = Array.isArray(pSnap.data().registeredEventIds)
                ? pSnap.data().registeredEventIds
                : [];
              transaction.update(doc(firestore, 'participants', pId), {
                registeredEventIds: Array.from(new Set([...existingEvents, targetCompId]))
              });
            }
          });
        }
      });
    }

    // Synchronize local React state
    setRegistrations(prev => prev.map(r => r.id === id ? { ...r, status: status as 'APPROVED' | 'PENDING' | 'REJECTED' | 'CANCELLED' } : r));
    const wasApproved = (prevStatus || registrations.find(r => r.id === id)?.status) === 'APPROVED';
    const isApproved = status === 'APPROVED';

    if (wasApproved && !isApproved && targetCompId) {
      setCompetitions(prev => prev.map(c => c.id === targetCompId ? { ...c, entriesCount: Math.max(0, (c.entriesCount ?? 0) - 1) } : c));
    } else if (!wasApproved && isApproved && targetCompId) {
      setCompetitions(prev => prev.map(c => c.id === targetCompId ? { ...c, entriesCount: (c.entriesCount ?? 0) + 1 } : c));
    }

    if (targetCompId) {
      const allAffectedPartIds = Array.from(new Set([targetPartId, ...targetGroupMembers])).filter(Boolean) as string[];
      const otherActiveLocal = registrations.filter(r =>
        r.id !== id &&
        r.competitionId === targetCompId &&
        r.status !== 'REJECTED' &&
        r.status !== 'CANCELLED'
      );

      if (status === 'REJECTED' || status === 'CANCELLED') {
        setParticipants(prev => prev.map(p => {
          if (allAffectedPartIds.includes(p.id)) {
            const hasOtherActive = otherActiveLocal.some(r =>
              r.participantId === p.id ||
              r.groupLeaderId === p.id ||
              (Array.isArray(r.groupMembers) && r.groupMembers.includes(p.id))
            );
            if (!hasOtherActive) {
              const existingEvents = p.registeredEventIds || [];
              return { ...p, registeredEventIds: existingEvents.filter(eId => eId !== targetCompId) };
            }
          }
          return p;
        }));
      } else if (status === 'APPROVED' || status === 'PENDING') {
        setParticipants(prev => prev.map(p => {
          if (allAffectedPartIds.includes(p.id)) {
            const existingEvents = p.registeredEventIds || [];
            return { ...p, registeredEventIds: Array.from(new Set([...existingEvents, targetCompId!])) };
          }
          return p;
        }));
      }
    }
  };

  const deleteRegistration = async (id: string) => {
    const regToDelete = registrations.find(r => r.id === id);
    let targetCompId = regToDelete?.competitionId;
    let targetPartId = regToDelete?.participantId || regToDelete?.groupLeaderId;
    let targetGroupMembers: string[] = Array.isArray(regToDelete?.groupMembers) ? regToDelete.groupMembers : [];
    let wasApproved = regToDelete ? (regToDelete.status === 'APPROVED' || !regToDelete.status) : false;

    if (!isIsolatedDemoOrTest && db) {
      const firestore = db;
      let otherActiveCompRegs: DocumentData[] = [];
      if (targetCompId) {
        try {
          const qSnap = await getDocs(query(
            collection(firestore, 'registrations'),
            where('competitionId', '==', targetCompId)
          ));
          otherActiveCompRegs = qSnap.docs
            .filter(d => d.id !== id)
            .map(d => d.data())
            .filter(data => data.status !== 'REJECTED' && data.status !== 'CANCELLED');
        } catch {
          otherActiveCompRegs = registrations.filter(r =>
            r.id !== id &&
            r.competitionId === targetCompId &&
            r.status !== 'REJECTED' &&
            r.status !== 'CANCELLED'
          );
        }
      }

      await runTransaction(firestore, async (transaction) => {
        const regRef = doc(firestore, 'registrations', id);
        const regSnap = await transaction.get(regRef);
        if (!regSnap.exists()) {
          // Document already deleted or missing (safe idempotency against duplicate deletes)
          return;
        }

        const regData = regSnap.data();
        targetCompId = regData.competitionId || targetCompId;
        targetPartId = regData.participantId || regData.groupLeaderId || targetPartId;
        targetGroupMembers = Array.isArray(regData.groupMembers) ? regData.groupMembers : targetGroupMembers;
        wasApproved = regData.status === 'APPROVED' || !regData.status;

        const allAffectedPartIds = Array.from(new Set([targetPartId, ...targetGroupMembers])).filter(Boolean) as string[];

        let compSnap = null;
        if (targetCompId && wasApproved) {
          compSnap = await transaction.get(doc(firestore, 'competitions', targetCompId));
        }

        const partSnaps = await Promise.all(
          allAffectedPartIds.map(pId => transaction.get(doc(firestore, 'participants', pId)))
        );

        // 1. Delete registration
        transaction.delete(regRef);

        // 2. Decrement competition entriesCount only if registration was approved (prevent negative counts)
        if (wasApproved && compSnap && compSnap.exists()) {
          const currentEntries = Number(compSnap.data().entriesCount ?? 0);
          const newEntries = Math.max(0, currentEntries - 1);
          transaction.update(doc(firestore, 'competitions', targetCompId!), { entriesCount: newEntries });
        }

        // 3. Remove competitionId from participant registeredEventIds ONLY IF no other active registration exists
        partSnaps.forEach((pSnap, idx) => {
          if (pSnap.exists() && targetCompId) {
            const pId = allAffectedPartIds[idx];
            const hasOtherActive = otherActiveCompRegs.some(r =>
              r.participantId === pId ||
              r.groupLeaderId === pId ||
              (Array.isArray(r.groupMembers) && r.groupMembers.includes(pId))
            );
            if (!hasOtherActive) {
              const existingEvents: string[] = Array.isArray(pSnap.data().registeredEventIds)
                ? pSnap.data().registeredEventIds
                : [];
              const updatedEvents = existingEvents.filter(eId => eId !== targetCompId);
              transaction.update(doc(firestore, 'participants', pId), { registeredEventIds: updatedEvents });
            }
          }
        });
      });
    }

    // Synchronize local React state
    setRegistrations(prev => prev.filter(r => r.id !== id));
    if (wasApproved && targetCompId) {
      setCompetitions(prev => prev.map(c => c.id === targetCompId ? { ...c, entriesCount: Math.max(0, (c.entriesCount ?? 0) - 1) } : c));
    }
    if (targetCompId) {
      const allAffectedPartIds = Array.from(new Set([targetPartId, ...targetGroupMembers])).filter(Boolean) as string[];
      const otherActiveLocal = registrations.filter(r =>
        r.id !== id &&
        r.competitionId === targetCompId &&
        r.status !== 'REJECTED' &&
        r.status !== 'CANCELLED'
      );

      setParticipants(prev => prev.map(p => {
        if (allAffectedPartIds.includes(p.id)) {
          const hasOtherActive = otherActiveLocal.some(r =>
            r.participantId === p.id ||
            r.groupLeaderId === p.id ||
            (Array.isArray(r.groupMembers) && r.groupMembers.includes(p.id))
          );
          if (!hasOtherActive) {
            const existingEvents = p.registeredEventIds || [];
            return { ...p, registeredEventIds: existingEvents.filter(eId => eId !== targetCompId) };
          }
        }
        return p;
      }));
    }
  };

  const addStage = async (stageData: Omit<Stage, 'id'>) => {
    const newId = 'stg-' + Date.now().toString(36) + '-' + Math.random().toString(36).substring(2, 6);
    const newStage: Stage = {
      ...stageData,
      id: newId
    };
    if (!isIsolatedDemoOrTest && db) {
      await setDoc(doc(db, 'stages', newId), sanitizeForFirestore(newStage));
    }
    setStages(prev => [...prev.filter(s => s.id !== newId), newStage]);
  };

  const updateStage = async (id: string, updated: Partial<Stage>) => {
    if (!isIsolatedDemoOrTest && db) {
      await updateDoc(doc(db, 'stages', id), sanitizeForFirestore(updated));
    }
    setStages(prev => prev.map(s => s.id === id ? { ...s, ...updated } : s));
  };

  const deleteStage = async (id: string) => {
    if (!isIsolatedDemoOrTest && db) {
      await deleteDoc(doc(db, 'stages', id));
    }
    setStages(prev => prev.filter(s => s.id !== id));
  };

  const addSchedule = async (slotData: Omit<ScheduleSlot, 'id'>) => {
    const newId = 'sch-' + Date.now().toString(36) + '-' + Math.random().toString(36).substring(2, 6);
    const newSlot: ScheduleSlot = {
      ...slotData,
      id: newId
    };
    if (!isIsolatedDemoOrTest) {
      if (!db || !auth?.currentUser) {
        throw new Error('Administrator sign-in and a live Firestore connection are required to save schedule changes.');
      }
      await setDoc(doc(db, 'schedules', newId), sanitizeForFirestore(newSlot));
    }
    setSchedules(prev => [...prev.filter(s => s.id !== newId), newSlot]);
  };

  const updateSchedule = async (id: string, updated: Partial<ScheduleSlot>) => {
    if (!isIsolatedDemoOrTest) {
      if (!db || !auth?.currentUser) {
        throw new Error('Administrator sign-in and a live Firestore connection are required to save schedule changes.');
      }
      await updateDoc(doc(db, 'schedules', id), sanitizeForFirestore(updated));
    }
    setSchedules(prev => prev.map(s => s.id === id ? { ...s, ...updated } : s));
  };

  const deleteSchedule = async (id: string) => {
    if (!isIsolatedDemoOrTest) {
      if (!db || !auth?.currentUser) {
        throw new Error('Administrator sign-in and a live Firestore connection are required to save schedule changes.');
      }
      await deleteDoc(doc(db, 'schedules', id));
    }
    setSchedules(prev => prev.filter(s => s.id !== id));
  };

  // Secure Judge Assignment
  const addOrUpdateJudgeAssignment = async (params: {
    competitionId: string;
    judgeName: string;
    judgePhone: string;
    stageName?: string;
  }): Promise<{ assignmentId: string; accessCode: string; oneTimeSecret: string; directUrl: string }> => {
    const comp = competitions.find(c => c.id === params.competitionId);
    let assignment: MarkEntry;
    let oneTimeSecret: string;
    let directUrl: string;

    if (isIsolatedDemoOrTest || !db) {
      const creds = await createJudgeAssignment({
        id: 'asgn-' + Date.now().toString(36) + '-' + Math.random().toString(36).substring(2, 6),
        judgeName: params.judgeName,
        judgePhone: params.judgePhone,
        competitionId: params.competitionId,
        competitionCode: comp ? comp.code : 'CMP-X',
        competitionName: comp ? comp.name : 'Unknown Competition',
        stageName: params.stageName || (comp ? comp.stageName : 'Main Stage')
      });
      assignment = {
        id: creds.assignment.id,
        competitionId: params.competitionId,
        competitionName: comp ? comp.name : 'Unknown Competition',
        competitionCode: comp ? comp.code : 'CMP-X',
        categoryName: comp ? comp.categoryName : 'General',
        type: comp ? comp.type : 'SOLO',
        judgeName: params.judgeName,
        judgePhone: params.judgePhone,
        accessCode: creds.assignment.accessCode,
        secretHash: creds.assignment.secretHash,
        salt: creds.assignment.salt,
        expiresAt: creds.assignment.expiresAt,
        revoked: false,
        status: 'NOT_STARTED',
        scores: []
      };
      oneTimeSecret = creds.oneTimeSecret;
      directUrl = creds.directLoginUrl;
    } else {
      const user = auth?.currentUser;
      if (!user) {
        throw new Error('Unauthorized: Sign in as an administrator before assigning judges.');
      }

      const response = await fetch('/api/admin/judge-assignments', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${await user.getIdToken()}`
        },
        body: JSON.stringify({
          competitionId: params.competitionId,
          judgeName: params.judgeName,
          judgePhone: params.judgePhone
        })
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(payload.error || 'Could not create the judge assignment.');
      }

      assignment = {
        ...payload.assignment,
        status: 'NOT_STARTED',
        scores: []
      } as MarkEntry;
      oneTimeSecret = payload.oneTimeSecret;
      directUrl = payload.directUrl;
    }

    setMarkEntries(prev => [...prev.filter(m => m.id !== assignment.id), assignment]);

    return {
      assignmentId: assignment.id,
      accessCode: assignment.accessCode,
      oneTimeSecret,
      directUrl
    };
  };

  const revokeJudgeAssignment = async (markEntryId: string) => {
    setMarkEntries(prev => prev.map(m => m.id === markEntryId ? { ...m, revoked: true, status: 'REVOKED' } : m));
    if (!isIsolatedDemoOrTest && db) {
      try {
        await updateDoc(doc(db, 'judgeAssignments', markEntryId), {
          revoked: true,
          status: 'REVOKED'
        });
      } catch (err) {
        console.warn('[FestContext] Firestore revokeJudgeAssignment error:', err);
      }
    }
  };

  // Task 2: Fix Result Publication Logic
  // When a judge submits marks, update result to READY_FOR_REVIEW.
  // DO NOT award championship points here!
  const submitJudgeMarks = (markEntryId: string, scores: MarkEntry['scores'], verificationHash?: string) => {
    const assignment = markEntries.find(m => m.id === markEntryId);

    setMarkEntries(prev => prev.map(m => {
      if (m.id === markEntryId) {
        return {
          ...m,
          status: 'SUBMITTED',
          submittedAt: new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' }),
          verificationHash: verificationHash || 'SHA256:' + Math.random().toString(36).substring(2, 15),
          scores
        };
      }
      return m;
    }));

    if (!isIsolatedDemoOrTest && db) {
      try {
        updateDoc(doc(db, 'judgeAssignments', markEntryId), {
          status: 'SUBMITTED',
          submittedAt: new Date().toISOString(),
          verificationHash: verificationHash || ''
        }).catch(() => {});
      } catch (err) {
        console.warn('[FestContext] Firestore submitJudgeMarks error:', err);
      }
    }

    if (assignment) {
      // A competition is review-ready only after every active assigned judge has submitted.
      // The current submission is included even though React state updates asynchronously.
      const competitionAssignments = markEntries.filter(entry =>
        entry.competitionId === assignment.competitionId &&
        !entry.revoked &&
        entry.status !== 'REVOKED' &&
        entry.status !== 'EXPIRED'
      );
      const allJudgesSubmitted = competitionAssignments.length > 0 &&
        competitionAssignments.every(entry => entry.id === markEntryId || entry.status === 'SUBMITTED');
      const marksStatus: CompetitionResult['marksStatus'] = allJudgesSubmitted ? 'COMPLETE' : 'PARTIAL';
      const resultStatus: ResultStatus = allJudgesSubmitted ? 'READY_FOR_REVIEW' : 'AWAITING_MARKS';

      setResults(prev => {
        const existing = prev.find(r => r.competitionId === assignment.competitionId);
        if (existing) {
          return prev.map(r => r.id === existing.id
            ? { ...r, resultStatus, marksStatus }
            : r
          );
        }

        const comp = competitions.find(c => c.id === assignment.competitionId);
        const newRes: CompetitionResult = {
          id: 'res-' + (prev.length + 1),
          competitionId: assignment.competitionId,
          competitionCode: assignment.competitionCode,
          competitionName: assignment.competitionName,
          categoryName: assignment.categoryName,
          type: assignment.type,
          stageName: comp ? comp.stageName : 'Main Stage',
          marksStatus,
          resultStatus,
          ranks: [],
          posterReleased: false
        };
        return [...prev, newRes];
      });
    }
  };

  const updateResultStatus = (resultId: string, status: ResultStatus) => {
    setResults(prev => prev.map(r => r.id === resultId ? { ...r, resultStatus: status } : r));
  };

  const postAdminResultAction = async (
    resultId: string,
    action: 'CONFIRM' | 'PUBLISH' | 'UNPUBLISH',
    payload: Record<string, unknown> = {}
  ) => {
    const user = auth?.currentUser;
    if (!user) {
      throw new Error('Unauthorized: Sign in as an administrator before managing results.');
    }

    const response = await fetch(`/api/admin/results/${encodeURIComponent(resultId)}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${await user.getIdToken()}`
      },
      body: JSON.stringify({ action, ...payload })
    });
    const result = await response.json().catch(() => ({}));
    if (!response.ok) {
      throw new Error(result.error || `Could not ${action.toLowerCase()} the result.`);
    }
    return result;
  };

  const confirmResultPositionsAndGrades = async (resultId: string, ranks: ResultRank[]) => {
    if (!isIsolatedDemoOrTest && db) {
      const response = await postAdminResultAction(resultId, 'CONFIRM', { ranks });
      setResults(prev => prev.map(r => r.id === resultId
        ? { ...r, resultStatus: 'READY_TO_PUBLISH', ranks: response.ranks || ranks }
        : r
      ));
      return;
    }

    setResults(prev => prev.map(r => {
      if (r.id === resultId) {
        return {
          ...r,
          resultStatus: 'READY_TO_PUBLISH',
          ranks
        };
      }
      return r;
    }));
  };

  // Official Result Publication: Commits points to Points Ledger and updates team championship points
  const publishResult = async (resultId: string) => {
    if (!isIsolatedDemoOrTest && db) {
      await postAdminResultAction(resultId, 'PUBLISH');
      return;
    }

    const targetResult = results.find(r => r.id === resultId);
    if (!targetResult) return;

    const comp = competitions.find(c => c.id === targetResult.competitionId);
    const compType = targetResult.type || (comp ? comp.type : 'SOLO');

    // 1. Commit to ledger (idempotent)
    const ranksInput = targetResult.ranks.map(rk => ({
      registrationId: rk.registrationId,
      bib: rk.bib,
      candidateName: rk.candidateName,
      teamId: rk.teamId,
      teamCode: rk.teamCode,
      teamName: rk.teamName,
      score: rk.score,
      rank: rk.rank,
      grade: rk.grade
    }));

    const newLedger = commitResultToLedger(
      resultId,
      {
        id: targetResult.competitionId,
        code: targetResult.competitionCode,
        name: targetResult.competitionName,
        type: compType
      },
      ranksInput,
      pointsLedger
    );

    setPointsLedger(newLedger);

    // 2. Recalculate team points dynamically from the ledger
    const aggregated = recalculateTeamChampionship(initialBaseTeams, newLedger);
    setTeams(prev => prev.map(t => {
      const agg = aggregated.find(a => a.teamId === t.id);
      return agg ? {
        ...t,
        totalPoints: agg.totalPoints,
        soloPoints: agg.soloPoints,
        groupPoints: agg.groupPoints,
        firstCount: agg.firstCount,
        secondCount: agg.secondCount,
        thirdCount: agg.thirdCount,
        rank: agg.rank
      } : t;
    }));

    // 3. Mark result as published
    setResults(prev => prev.map(r => {
      if (r.id === resultId) {
        return {
          ...r,
          resultStatus: 'PUBLISHED',
          publishedDate: new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })
        };
      }
      return r;
    }));
  };

  // Result Unpublishing / Revision Reversal
  const unpublishResult = async (resultId: string, reason: string = 'Administrative review') => {
    if (!isIsolatedDemoOrTest && db) {
      await postAdminResultAction(resultId, 'UNPUBLISH', { reason });
      return;
    }

    // 1. Reverse ledger entries
    const newLedger = reverseResultInLedger(resultId, pointsLedger, reason);
    setPointsLedger(newLedger);

    // 2. Recalculate team points
    const aggregated = recalculateTeamChampionship(initialBaseTeams, newLedger);
    setTeams(prev => prev.map(t => {
      const agg = aggregated.find(a => a.teamId === t.id);
      return agg ? {
        ...t,
        totalPoints: agg.totalPoints,
        soloPoints: agg.soloPoints,
        groupPoints: agg.groupPoints,
        firstCount: agg.firstCount,
        secondCount: agg.secondCount,
        thirdCount: agg.thirdCount,
        rank: agg.rank
      } : t;
    }));

    // 3. Set status to REVISION_REQUIRED
    setResults(prev => prev.map(r => {
      if (r.id === resultId) {
        return {
          ...r,
          resultStatus: 'REVISION_REQUIRED',
          publishedDate: undefined
        };
      }
      return r;
    }));
  };

  const updatePosterConfig = async (resultId: string, config: PosterConfig, release?: boolean): Promise<void> => {
    const user = auth?.currentUser;
    if (!user) throw new Error('Sign in as an administrator to save or publish a poster.');
    const token = await user.getIdToken();
    const response = await fetch(`/api/posters/results/${encodeURIComponent(resultId)}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({ config, ...(release !== undefined ? { release } : {}) }),
    });
    const data = await response.json() as { poster?: PosterMediaRecord; error?: string };
    if (!response.ok || !data.poster) throw new Error(data.error || 'Could not save this poster. Please try again.');
    if (auth?.currentUser?.uid !== user.uid) return;
    // Ignore an older refresh that started before this successful save.
    posterRevision.current++;
    const poster = data.poster;
    setPosterMedia(previous => ({ ...previous, [resultId]: poster }));
  };

  const cleanupOrphanedJudgeAssignments = useCallback(async (options?: { dryRun?: boolean; confirm?: boolean }) => {
    if (isIsolatedDemoOrTest || !auth?.currentUser) {
      return {
        success: true,
        dryRun: options?.dryRun ?? true,
        requiresConfirmation: false,
        totalOrphaned: 0,
        removedJudgeAssignments: 0,
        removedMarkEntries: 0,
        message: 'No actions performed in demo/unauthenticated mode.'
      };
    }

    try {
      const token = await auth.currentUser.getIdToken();
      const isDryRun = options?.dryRun ?? (!options?.confirm);
      const isConfirmed = options?.confirm === true;

      const res = await fetch('/api/admin/judge-assignments/cleanup-orphaned', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({
          dryRun: isDryRun,
          confirm: isConfirmed
        })
      });

      if (!res.ok) {
        const errPayload = await res.json().catch(() => ({}));
        throw new Error(errPayload.error || `Failed to clean up orphaned assignments (HTTP ${res.status})`);
      }

      const data = await res.json();
      if (data.confirmed && (data.removedJudgeAssignments > 0 || data.removedMarkEntries > 0)) {
        setRawJudgeAssignments(prev => {
          const validCompIds = new Set(competitions.map(c => c.id));
          return prev.filter(entry => validCompIds.has(entry.competitionId));
        });
      }
      return data;
    } catch (err) {
      console.warn('[FestContext] Cleanup orphaned judge assignments failed:', err);
      throw err;
    }
  }, [isIsolatedDemoOrTest, competitions]);

  return (
    <FestContext.Provider
      value={{
        theme,
        themeSyncState,
        updateTheme,
        categories,
        categoriesSyncState,
        addCategory,
        updateCategory,
        deleteCategory,
        teams,
        teamsSyncState,
        addTeam,
        updateTeam,
        deleteTeam,
        competitions,
        competitionsSyncState,
        addCompetition,
        updateCompetition,
        deleteCompetition,
        participants,
        participantsSyncState,
        addParticipant,
        updateParticipant,
        deleteParticipant,
        checkParticipantCategoryConflicts,
        registrations,
        registrationsSyncState,
        addRegistration,
        updateRegistrationStatus,
        deleteRegistration,
        stages,
        stagesSyncState,
        addStage,
        updateStage,
        deleteStage,
        schedules,
        schedulesSyncState,
        addSchedule,
        updateSchedule,
        deleteSchedule,
        markEntries,
        markEntriesSyncState,
        addOrUpdateJudgeAssignment,
        submitJudgeMarks,
        revokeJudgeAssignment,
        cleanupOrphanedJudgeAssignments,
        results,
        resultsSyncState,
        topScorersSyncState,
        pointsLedger,
        publishResult,
        unpublishResult,
        updateResultStatus,
        confirmResultPositionsAndGrades,
        updatePosterConfig,
        currentTeamUser,
        setCurrentTeamUser: handleSetCurrentTeamUser
      }}
    >
      {children}
    </FestContext.Provider>
  );
}

export function useFest() {
  const context = useContext(FestContext);
  if (!context) {
    throw new Error('useFest must be used within a FestProvider');
  }
  return context;
}

export function useSafeFest() {
  return useContext(FestContext);
}

export { defaultTheme };
