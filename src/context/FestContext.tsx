'use client';

import React, { createContext, useContext, useState, useEffect } from 'react';
import { db } from '@/lib/firebase/client';
import { collection, onSnapshot } from 'firebase/firestore';
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
  calculateGradeFromPercentage,
  getChampionshipPoints,
  Grade
} from '@/domain/scoring';
import {
  commitResultToLedger,
  reverseResultInLedger,
  recalculateTeamChampionship
} from '@/domain/ledger';
import {
  createJudgeAssignment,
  verifyJudgeAssignment,
  buildWhatsAppDispatchUrl
} from '@/domain/judgeAuth';

interface FestContextType {
  theme: PublicThemeSettings;
  updateTheme: (newTheme: Partial<PublicThemeSettings>) => void;

  categories: Category[];
  addCategory: (cat: Omit<Category, 'id' | 'enrolledCount' | 'competitionsCount'>) => void;
  updateCategory: (id: string, cat: Partial<Category>) => void;
  deleteCategory: (id: string) => void;

  teams: Team[];
  addTeam: (team: Omit<Team, 'id' | 'totalPoints' | 'soloPoints' | 'groupPoints' | 'rank' | 'firstCount' | 'secondCount' | 'thirdCount' | 'contestantsCount' | 'eventsCount'>) => void;
  updateTeam: (id: string, team: Partial<Team>) => void;
  deleteTeam: (id: string) => void;

  competitions: Competition[];
  addCompetition: (comp: Omit<Competition, 'id' | 'entriesCount'>) => void;
  updateCompetition: (id: string, comp: Partial<Competition>) => void;
  deleteCompetition: (id: string) => void;

  participants: Participant[];
  addParticipant: (part: Omit<Participant, 'id' | 'bib' | 'idStatus'>) => void;
  updateParticipant: (id: string, part: Partial<Participant>) => void;
  deleteParticipant: (id: string) => void;

  registrations: Registration[];
  addRegistration: (reg: Omit<Registration, 'id' | 'code' | 'registeredAt'>) => void;
  updateRegistrationStatus: (id: string, status: 'APPROVED' | 'PENDING' | 'REJECTED') => void;
  deleteRegistration: (id: string) => void;

  stages: Stage[];
  addStage: (stage: Omit<Stage, 'id'>) => void;
  updateStage: (id: string, stage: Partial<Stage>) => void;
  deleteStage: (id: string) => void;

  schedules: ScheduleSlot[];
  addSchedule: (slot: Omit<ScheduleSlot, 'id'>) => void;
  updateSchedule: (id: string, slot: Partial<ScheduleSlot>) => void;
  deleteSchedule: (id: string) => void;

  markEntries: MarkEntry[];
  addOrUpdateJudgeAssignment: (assignment: {
    competitionId: string;
    judgeName: string;
    judgePhone: string;
    stageName?: string;
  }) => Promise<{ accessCode: string; oneTimeSecret: string; directUrl: string }>;
  submitJudgeMarks: (markEntryId: string, scores: MarkEntry['scores'], verificationHash?: string) => void;
  revokeJudgeAssignment: (markEntryId: string) => void;

  // Official Results & Tabulation Ledger
  results: CompetitionResult[];
  pointsLedger: PointsLedgerEntry[];
  publishResult: (resultId: string) => void;
  unpublishResult: (resultId: string, reason?: string) => void;
  updateResultStatus: (resultId: string, status: ResultStatus) => void;
  confirmResultPositionsAndGrades: (resultId: string, ranks: ResultRank[]) => void;
  updatePosterConfig: (resultId: string, config: PosterConfig, release?: boolean) => void;

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

const initialCategories: Category[] = [
  { id: 'cat-1', name: 'Sub Junior', code: 'CAT-SJ', eligibility: 'Class 5 to 7', ageRange: '10 - 12 Years', classRange: 'Std 5 - 7', enrolledCount: 94, competitionsCount: 10, status: 'ACTIVE' },
  { id: 'cat-2', name: 'Junior', code: 'CAT-JR', eligibility: 'Class 8 to 10', ageRange: '13 - 15 Years', classRange: 'Std 8 - 10', enrolledCount: 148, competitionsCount: 14, status: 'ACTIVE' },
  { id: 'cat-3', name: 'Senior', code: 'CAT-SR', eligibility: 'Class 11 to 12', ageRange: '16 - 18 Years', classRange: 'Std 11 - 12', enrolledCount: 162, competitionsCount: 16, status: 'ACTIVE' },
  { id: 'cat-4', name: 'General', code: 'CAT-GEN', eligibility: 'All Eligible Students', ageRange: 'Open Tier', classRange: 'Campus Wide', enrolledCount: 78, competitionsCount: 8, status: 'ACTIVE' }
];

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

const initialCompetitions: Competition[] = [
  {
    id: 'cmp-1',
    code: 'CMP-01',
    name: 'Extempore Speech (English)',
    categoryId: 'cat-3',
    categoryName: 'Senior',
    type: 'SOLO',
    entriesCount: 8,
    stageId: 'stg-1',
    stageName: 'Main Auditorium',
    assignedJudges: ['Dr. Tariq Jameel', 'Prof. Sarah Khan'],
    status: 'PUBLISHED',
    date: '2025-11-14',
    timeSlot: '09:30 AM - 11:30 AM',
    durationMinutes: 120,
    maxEntriesPerTeam: 2,
    criteria: [
      { id: 'crt-1', name: 'Clarity & Articulation', maxMarks: 30 },
      { id: 'crt-2', name: 'Content & Vocabulary', maxMarks: 40 },
      { id: 'crt-3', name: 'Poise & Confidence', maxMarks: 30 }
    ]
  },
  {
    id: 'cmp-2',
    code: 'CMP-02',
    name: 'Quran Recitation (Tajweed)',
    categoryId: 'cat-2',
    categoryName: 'Junior',
    type: 'SOLO',
    entriesCount: 12,
    stageId: 'stg-2',
    stageName: 'Seminar Hall A',
    assignedJudges: ['Usthad Abdullah', 'Qari Zubair'],
    status: 'PUBLISHED',
    date: '2025-11-14',
    timeSlot: '11:45 AM - 01:45 PM',
    durationMinutes: 120,
    maxEntriesPerTeam: 2,
    criteria: [
      { id: 'crt-4', name: 'Tajweed Rules & Makharidj', maxMarks: 40 },
      { id: 'crt-5', name: 'Voice Tone & Modulation', maxMarks: 30 },
      { id: 'crt-6', name: 'Fluency & Memorization', maxMarks: 30 }
    ]
  },
  {
    id: 'cmp-3',
    code: 'CMP-03',
    name: 'Sufi & Cultural Group Song',
    categoryId: 'cat-4',
    categoryName: 'General',
    type: 'GROUP',
    entriesCount: 4,
    stageId: 'stg-3',
    stageName: 'Open Amphitheatre',
    assignedJudges: ['Ustad Fayyaz', 'Rashid Qawwal'],
    status: 'PUBLISHED',
    date: '2025-11-14',
    timeSlot: '02:30 PM - 04:30 PM',
    durationMinutes: 120,
    maxEntriesPerTeam: 1,
    criteria: [
      { id: 'crt-7', name: 'Harmony & Synchronization', maxMarks: 35 },
      { id: 'crt-8', name: 'Rhythm & Tal', maxMarks: 35 },
      { id: 'crt-9', name: 'Presentation & Attire', maxMarks: 30 }
    ]
  },
  {
    id: 'cmp-4',
    code: 'CMP-04',
    name: 'Arabic Calligraphy',
    categoryId: 'cat-3',
    categoryName: 'Senior',
    type: 'SOLO',
    entriesCount: 10,
    stageId: 'stg-2',
    stageName: 'Seminar Hall A',
    assignedJudges: ['Usthad Nooruddin'],
    status: 'MARKS_ENTERED',
    date: '2025-11-15',
    timeSlot: '09:00 AM - 11:00 AM',
    durationMinutes: 120,
    maxEntriesPerTeam: 2,
    criteria: [
      { id: 'crt-10', name: 'Script Precision (Thuluth/Naskh)', maxMarks: 40 },
      { id: 'crt-11', name: 'Composition & Balance', maxMarks: 30 },
      { id: 'crt-12', name: 'Ink & Nib Execution', maxMarks: 30 }
    ]
  },
  {
    id: 'cmp-5',
    code: 'CMP-05',
    name: 'Elocution (Malayalam)',
    categoryId: 'cat-1',
    categoryName: 'Sub Junior',
    type: 'SOLO',
    entriesCount: 8,
    stageId: 'stg-1',
    stageName: 'Main Auditorium',
    assignedJudges: ['Dr. Vijayan Menon'],
    status: 'SCHEDULED',
    date: '2025-11-15',
    timeSlot: '11:15 AM - 01:00 PM',
    durationMinutes: 105,
    maxEntriesPerTeam: 2,
    criteria: [
      { id: 'crt-13', name: 'Language & Pronunciation', maxMarks: 35 },
      { id: 'crt-14', name: 'Subject Depth', maxMarks: 35 },
      { id: 'crt-15', name: 'Body Language', maxMarks: 30 }
    ]
  },
  {
    id: 'cmp-6',
    code: 'CMP-06',
    name: 'Daf Muttu Performance',
    categoryId: 'cat-3',
    categoryName: 'Senior',
    type: 'GROUP',
    entriesCount: 4,
    stageId: 'stg-3',
    stageName: 'Open Amphitheatre',
    assignedJudges: ['Usthad Moideen', 'Salim Ustad'],
    status: 'SCHEDULED',
    date: '2025-11-15',
    timeSlot: '02:00 PM - 04:30 PM',
    durationMinutes: 150,
    maxEntriesPerTeam: 1,
    criteria: [
      { id: 'crt-16', name: 'Acrobatic Formations & Movements', maxMarks: 40 },
      { id: 'crt-17', name: 'Beat Synchronization', maxMarks: 35 },
      { id: 'crt-18', name: 'Bait Recitation & Energy', maxMarks: 25 }
    ]
  }
];

const initialParticipants: Participant[] = [
  {
    id: 'part-1',
    bib: '#1042',
    name: 'Rayan Siddiqui',
    email: 'rayan.s@fest.org',
    phone: '+91 98471 10001',
    teamId: 'team-1',
    teamCode: 'ABH',
    teamName: 'Al-Bayan House',
    categoryId: 'cat-3',
    categoryName: 'Senior',
    classGrade: 'Grade 12',
    division: 'A',
    dob: '2008-04-12',
    photoUrl: 'https://images.unsplash.com/photo-1539571696357-5a69c17a67c6?auto=format&fit=crop&q=80&w=256',
    registeredEventIds: ['cmp-1'],
    idStatus: 'GENERATED'
  },
  {
    id: 'part-2',
    bib: '#1018',
    name: 'Faris Ibrahim',
    email: 'faris.i@fest.org',
    phone: '+91 98471 10002',
    teamId: 'team-2',
    teamCode: 'BSH',
    teamName: 'Badr Squad',
    categoryId: 'cat-3',
    categoryName: 'Senior',
    classGrade: 'Grade 11',
    division: 'B',
    dob: '2009-02-18',
    photoUrl: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?auto=format&fit=crop&q=80&w=256',
    registeredEventIds: ['cmp-1'],
    idStatus: 'GENERATED'
  },
  {
    id: 'part-3',
    bib: '#1035',
    name: 'Hassan Bilgrami',
    email: 'hassan.b@fest.org',
    phone: '+91 98471 10003',
    teamId: 'team-3',
    teamCode: 'KAH',
    teamName: 'Khalid Al-Walid',
    categoryId: 'cat-3',
    categoryName: 'Senior',
    classGrade: 'Grade 12',
    division: 'C',
    dob: '2008-09-05',
    photoUrl: 'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?auto=format&fit=crop&q=80&w=256',
    registeredEventIds: ['cmp-1'],
    idStatus: 'GENERATED'
  },
  {
    id: 'part-4',
    bib: '#2011',
    name: 'Aasim Faizee',
    email: 'aasim.f@fest.org',
    phone: '+91 98471 10004',
    teamId: 'team-1',
    teamCode: 'ABH',
    teamName: 'Al-Bayan House',
    categoryId: 'cat-2',
    categoryName: 'Junior',
    classGrade: 'Grade 9',
    division: 'A',
    dob: '2010-06-22',
    photoUrl: 'https://images.unsplash.com/photo-1522075469751-3a6694fb2f61?auto=format&fit=crop&q=80&w=256',
    registeredEventIds: ['cmp-2'],
    idStatus: 'GENERATED'
  },
  {
    id: 'part-5',
    bib: '#2045',
    name: 'Zayd Imran',
    email: 'zayd.i@fest.org',
    phone: '+91 98471 10005',
    teamId: 'team-2',
    teamCode: 'BSH',
    teamName: 'Badr Squad',
    categoryId: 'cat-2',
    categoryName: 'Junior',
    classGrade: 'Grade 10',
    division: 'B',
    dob: '2009-11-14',
    photoUrl: 'https://images.unsplash.com/photo-1492562080023-ab3db95bfbce?auto=format&fit=crop&q=80&w=256',
    registeredEventIds: ['cmp-2'],
    idStatus: 'GENERATED'
  },
  {
    id: 'part-6',
    bib: '#2062',
    name: 'Bilal Madani',
    email: 'bilal.m@fest.org',
    phone: '+91 98471 10006',
    teamId: 'team-3',
    teamCode: 'KAH',
    teamName: 'Khalid Al-Walid',
    categoryId: 'cat-2',
    categoryName: 'Junior',
    classGrade: 'Grade 10',
    division: 'A',
    dob: '2010-01-30',
    photoUrl: 'https://images.unsplash.com/photo-1519085360753-af0119f7cbe7?auto=format&fit=crop&q=80&w=256',
    registeredEventIds: ['cmp-2'],
    idStatus: 'GENERATED'
  }
];

const initialRegistrations: Registration[] = [
  {
    id: 'reg-1',
    code: 'REG-8821',
    participantId: 'part-1',
    participantName: 'Rayan Siddiqui',
    teamId: 'team-1',
    teamCode: 'ABH',
    teamName: 'Al-Bayan House',
    categoryId: 'cat-3',
    categoryName: 'Senior',
    competitionId: 'cmp-1',
    competitionName: 'Extempore Speech (English)',
    type: 'SOLO',
    chestNumber: '1042',
    status: 'APPROVED',
    registeredAt: '2025-11-10 10:20 AM'
  },
  {
    id: 'reg-2',
    code: 'REG-8822',
    participantId: 'part-2',
    participantName: 'Faris Ibrahim',
    teamId: 'team-2',
    teamCode: 'BSH',
    teamName: 'Badr Squad',
    categoryId: 'cat-3',
    categoryName: 'Senior',
    competitionId: 'cmp-1',
    competitionName: 'Extempore Speech (English)',
    type: 'SOLO',
    chestNumber: '1018',
    status: 'APPROVED',
    registeredAt: '2025-11-10 11:15 AM'
  },
  {
    id: 'reg-3',
    code: 'REG-8823',
    participantId: 'part-3',
    participantName: 'Hassan Bilgrami',
    teamId: 'team-3',
    teamCode: 'KAH',
    teamName: 'Khalid Al-Walid',
    categoryId: 'cat-3',
    categoryName: 'Senior',
    competitionId: 'cmp-1',
    competitionName: 'Extempore Speech (English)',
    type: 'SOLO',
    chestNumber: '1035',
    status: 'APPROVED',
    registeredAt: '2025-11-10 11:40 AM'
  },
  {
    id: 'reg-4',
    code: 'REG-8824',
    participantName: 'Tariq Niyas',
    teamId: 'team-4',
    teamCode: 'FSH',
    teamName: 'Fathul Mubeen',
    categoryId: 'cat-3',
    categoryName: 'Senior',
    competitionId: 'cmp-1',
    competitionName: 'Extempore Speech (English)',
    type: 'SOLO',
    chestNumber: '1088',
    status: 'APPROVED',
    registeredAt: '2025-11-10 12:05 PM'
  },
  {
    id: 'reg-5',
    code: 'REG-8825',
    participantId: 'part-4',
    participantName: 'Aasim Faizee',
    teamId: 'team-1',
    teamCode: 'ABH',
    teamName: 'Al-Bayan House',
    categoryId: 'cat-2',
    categoryName: 'Junior',
    competitionId: 'cmp-2',
    competitionName: 'Quran Recitation (Tajweed)',
    type: 'SOLO',
    chestNumber: '2011',
    status: 'APPROVED',
    registeredAt: '2025-11-10 02:10 PM'
  },
  {
    id: 'reg-6',
    code: 'REG-8826',
    participantId: 'part-5',
    participantName: 'Zayd Imran',
    teamId: 'team-2',
    teamCode: 'BSH',
    teamName: 'Badr Squad',
    categoryId: 'cat-2',
    categoryName: 'Junior',
    competitionId: 'cmp-2',
    competitionName: 'Quran Recitation (Tajweed)',
    type: 'SOLO',
    chestNumber: '2045',
    status: 'APPROVED',
    registeredAt: '2025-11-10 02:30 PM'
  },
  {
    id: 'reg-7',
    code: 'REG-8827',
    participantId: 'part-6',
    participantName: 'Bilal Madani',
    teamId: 'team-3',
    teamCode: 'KAH',
    teamName: 'Khalid Al-Walid',
    categoryId: 'cat-2',
    categoryName: 'Junior',
    competitionId: 'cmp-2',
    competitionName: 'Quran Recitation (Tajweed)',
    type: 'SOLO',
    chestNumber: '2062',
    status: 'APPROVED',
    registeredAt: '2025-11-10 03:00 PM'
  },
  {
    id: 'reg-grp-1',
    code: 'REG-8828',
    participantName: 'Al-Bayan Harmony Troupe',
    teamId: 'team-1',
    teamCode: 'ABH',
    teamName: 'Al-Bayan House',
    categoryId: 'cat-4',
    categoryName: 'General',
    competitionId: 'cmp-3',
    competitionName: 'Sufi & Cultural Group Song',
    type: 'GROUP',
    chestNumber: 'GRP-ABH',
    status: 'APPROVED',
    registeredAt: '2025-11-11 09:15 AM'
  },
  {
    id: 'reg-grp-2',
    code: 'REG-8829',
    participantName: 'Badr Voice Ensemble',
    teamId: 'team-2',
    teamCode: 'BSH',
    teamName: 'Badr Squad',
    categoryId: 'cat-4',
    categoryName: 'General',
    competitionId: 'cmp-3',
    competitionName: 'Sufi & Cultural Group Song',
    type: 'GROUP',
    chestNumber: 'GRP-BSH',
    status: 'APPROVED',
    registeredAt: '2025-11-11 09:30 AM'
  },
  {
    id: 'reg-grp-3',
    code: 'REG-8830',
    participantName: 'Khalid Al-Walid Choral Choir',
    teamId: 'team-3',
    teamCode: 'KAH',
    teamName: 'Khalid Al-Walid',
    categoryId: 'cat-4',
    categoryName: 'General',
    competitionId: 'cmp-3',
    competitionName: 'Sufi & Cultural Group Song',
    type: 'GROUP',
    chestNumber: 'GRP-KAH',
    status: 'APPROVED',
    registeredAt: '2025-11-11 10:00 AM'
  }
];

const initialStages: Stage[] = [
  {
    id: 'stg-1',
    code: 'STG-01',
    name: 'Main Auditorium',
    venue: 'Block A Central Complex',
    capacity: 1200,
    managerName: 'Shafiq Rahman',
    managerPhone: '+91 98471 40001',
    audioVisualStatus: 'OPERATIONAL',
    currentEvent: 'Extempore Speech (Senior)',
    nextEvent: 'Elocution (Sub Junior)'
  },
  {
    id: 'stg-2',
    code: 'STG-02',
    name: 'Seminar Hall A',
    venue: 'Academic Wing Level 2',
    capacity: 350,
    managerName: 'Zubair Al-Hindi',
    managerPhone: '+91 98471 40002',
    audioVisualStatus: 'OPERATIONAL',
    currentEvent: 'Quran Recitation (Junior)',
    nextEvent: 'Arabic Calligraphy'
  },
  {
    id: 'stg-3',
    code: 'STG-03',
    name: 'Open Amphitheatre',
    venue: 'Courtyard Greens',
    capacity: 2500,
    managerName: 'Muneer Ahmad',
    managerPhone: '+91 98471 40003',
    audioVisualStatus: 'STANDBY',
    currentEvent: 'Sufi & Cultural Group Song',
    nextEvent: 'Daf Muttu Performance'
  }
];

const initialSchedules: ScheduleSlot[] = [
  {
    id: 'sch-1',
    competitionId: 'cmp-1',
    competitionName: 'Extempore Speech (English)',
    categoryName: 'Senior',
    type: 'SOLO',
    stageId: 'stg-1',
    stageName: 'Main Auditorium',
    date: '2025-11-14',
    startTime: '09:30 AM',
    endTime: '11:30 AM',
    status: 'COMPLETED'
  },
  {
    id: 'sch-2',
    competitionId: 'cmp-2',
    competitionName: 'Quran Recitation (Tajweed)',
    categoryName: 'Junior',
    type: 'SOLO',
    stageId: 'stg-2',
    stageName: 'Seminar Hall A',
    date: '2025-11-14',
    startTime: '11:45 AM',
    endTime: '01:45 PM',
    status: 'COMPLETED'
  },
  {
    id: 'sch-3',
    competitionId: 'cmp-3',
    competitionName: 'Sufi & Cultural Group Song',
    categoryName: 'General',
    type: 'GROUP',
    stageId: 'stg-3',
    stageName: 'Open Amphitheatre',
    date: '2025-11-14',
    startTime: '02:30 PM',
    endTime: '04:30 PM',
    status: 'COMPLETED'
  },
  {
    id: 'sch-4',
    competitionId: 'cmp-4',
    competitionName: 'Arabic Calligraphy',
    categoryName: 'Senior',
    type: 'SOLO',
    stageId: 'stg-2',
    stageName: 'Seminar Hall A',
    date: '2025-11-15',
    startTime: '09:00 AM',
    endTime: '11:00 AM',
    status: 'LIVE'
  },
  {
    id: 'sch-5',
    competitionId: 'cmp-5',
    competitionName: 'Elocution (Malayalam)',
    categoryName: 'Sub Junior',
    type: 'SOLO',
    stageId: 'stg-1',
    stageName: 'Main Auditorium',
    date: '2025-11-15',
    startTime: '11:15 AM',
    endTime: '01:00 PM',
    status: 'SCHEDULED'
  },
  {
    id: 'sch-6',
    competitionId: 'cmp-6',
    competitionName: 'Daf Muttu Performance',
    categoryName: 'Senior',
    type: 'GROUP',
    stageId: 'stg-3',
    stageName: 'Open Amphitheatre',
    date: '2025-11-15',
    startTime: '02:00 PM',
    endTime: '04:30 PM',
    status: 'SCHEDULED'
  }
];

// Initial Mark Entries with hashed secrets
const initialMarkEntries: MarkEntry[] = [
  {
    id: 'me-1',
    competitionId: 'cmp-1',
    competitionName: 'Extempore Speech (English)',
    competitionCode: 'CMP-01',
    categoryName: 'Senior',
    type: 'SOLO',
    judgeName: 'Dr. Tariq Jameel',
    judgePhone: '+91 98471 50001',
    accessCode: 'JRY-4101',
    secretHash: 'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855',
    salt: 'salt-cmp-1',
    status: 'SUBMITTED',
    submittedAt: '2025-11-14 11:20 AM',
    verificationHash: 'SHA256:88fa291bce99',
    scores: [
      {
        registrationId: 'reg-1',
        participantName: 'Rayan Siddiqui',
        bib: '#1042',
        teamCode: 'ABH',
        teamName: 'Al-Bayan House',
        criteriaMarks: { 'crt-1': 29, 'crt-2': 38, 'crt-3': 28 },
        totalMarks: 95
      },
      {
        registrationId: 'reg-2',
        participantName: 'Faris Ibrahim',
        bib: '#1018',
        teamCode: 'BSH',
        teamName: 'Badr Squad',
        criteriaMarks: { 'crt-1': 27, 'crt-2': 35, 'crt-3': 27 },
        totalMarks: 89
      },
      {
        registrationId: 'reg-3',
        participantName: 'Hassan Bilgrami',
        bib: '#1035',
        teamCode: 'KAH',
        teamName: 'Khalid Al-Walid',
        criteriaMarks: { 'crt-1': 24, 'crt-2': 33, 'crt-3': 25 },
        totalMarks: 82
      }
    ]
  },
  {
    id: 'me-2',
    competitionId: 'cmp-2',
    competitionName: 'Quran Recitation (Tajweed)',
    competitionCode: 'CMP-02',
    categoryName: 'Junior',
    type: 'SOLO',
    judgeName: 'Usthad Abdullah',
    judgePhone: '+91 98471 50002',
    accessCode: 'JRY-4102',
    secretHash: 'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855',
    salt: 'salt-cmp-2',
    status: 'SUBMITTED',
    submittedAt: '2025-11-14 01:35 PM',
    verificationHash: 'SHA256:77da812efc44',
    scores: [
      {
        registrationId: 'reg-5',
        participantName: 'Aasim Faizee',
        bib: '#2011',
        teamCode: 'ABH',
        teamName: 'Al-Bayan House',
        criteriaMarks: { 'crt-4': 39, 'crt-5': 30, 'crt-6': 29 },
        totalMarks: 98
      },
      {
        registrationId: 'reg-6',
        participantName: 'Zayd Imran',
        bib: '#2045',
        teamCode: 'BSH',
        teamName: 'Badr Squad',
        criteriaMarks: { 'crt-4': 37, 'crt-5': 28, 'crt-6': 28 },
        totalMarks: 93
      },
      {
        registrationId: 'reg-7',
        participantName: 'Bilal Madani',
        bib: '#2062',
        teamCode: 'KAH',
        teamName: 'Khalid Al-Walid',
        criteriaMarks: { 'crt-4': 34, 'crt-5': 26, 'crt-6': 26 },
        totalMarks: 86
      }
    ]
  },
  {
    id: 'me-3',
    competitionId: 'cmp-3',
    competitionName: 'Sufi & Cultural Group Song',
    competitionCode: 'CMP-03',
    categoryName: 'General',
    type: 'GROUP',
    judgeName: 'Ustad Fayyaz',
    judgePhone: '+91 98471 50003',
    accessCode: 'JRY-4103',
    secretHash: 'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855',
    salt: 'salt-cmp-3',
    status: 'SUBMITTED',
    submittedAt: '2025-11-14 04:20 PM',
    verificationHash: 'SHA256:99ac331bbd12',
    scores: [
      {
        registrationId: 'reg-grp-1',
        participantName: 'Al-Bayan Harmony Troupe',
        bib: '#GRP-ABH',
        teamCode: 'ABH',
        teamName: 'Al-Bayan House',
        criteriaMarks: { 'crt-7': 34, 'crt-8': 34, 'crt-9': 28 },
        totalMarks: 96
      },
      {
        registrationId: 'reg-grp-2',
        participantName: 'Badr Voice Ensemble',
        bib: '#GRP-BSH',
        teamCode: 'BSH',
        teamName: 'Badr Squad',
        criteriaMarks: { 'crt-7': 32, 'crt-8': 31, 'crt-9': 28 },
        totalMarks: 91
      },
      {
        registrationId: 'reg-grp-3',
        participantName: 'Khalid Al-Walid Choral Choir',
        bib: '#GRP-KAH',
        teamCode: 'KAH',
        teamName: 'Khalid Al-Walid',
        criteriaMarks: { 'crt-7': 30, 'crt-8': 29, 'crt-9': 26 },
        totalMarks: 85
      }
    ]
  },
  {
    id: 'me-4',
    competitionId: 'cmp-4',
    competitionName: 'Arabic Calligraphy',
    competitionCode: 'CMP-04',
    categoryName: 'Senior',
    type: 'SOLO',
    judgeName: 'Usthad Nooruddin',
    judgePhone: '+91 98471 50004',
    accessCode: 'JRY-4104',
    secretHash: 'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855',
    salt: 'salt-cmp-4',
    status: 'SUBMITTED',
    submittedAt: '2025-11-15 10:45 AM',
    verificationHash: 'SHA256:11dd884aef55',
    scores: [
      {
        registrationId: 'reg-8',
        participantName: 'Luqman Hakim',
        bib: '#1055',
        teamCode: 'ABH',
        teamName: 'Al-Bayan House',
        criteriaMarks: { 'crt-10': 38, 'crt-11': 28, 'crt-12': 28 },
        totalMarks: 94
      },
      {
        registrationId: 'reg-9',
        participantName: 'Sufyan Ali',
        bib: '#1072',
        teamCode: 'BSH',
        teamName: 'Badr Squad',
        criteriaMarks: { 'crt-10': 35, 'crt-11': 27, 'crt-12': 26 },
        totalMarks: 88
      }
    ]
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

export function FestProvider({ children }: { children: React.ReactNode }) {
  const isEmulator = process.env.NEXT_PUBLIC_USE_FIREBASE_EMULATOR === 'true';
  const isDemoMode = process.env.NEXT_PUBLIC_DEMO_MODE === 'true';
  const isTestEnv = process.env.NODE_ENV === 'test' || Boolean(process.env.VITEST);
  const isIsolatedDemoOrTest = isEmulator || isDemoMode || isTestEnv;

  const DEMO_TEAM_IDS = ['team-1', 'team-2', 'team-3', 'team-4'];
  const DEMO_CATEGORY_IDS = ['cat-1', 'cat-2', 'cat-3', 'cat-4'];
  const DEMO_COMPETITION_IDS = ['cmp-1', 'cmp-2', 'cmp-3', 'cmp-4', 'cmp-5', 'cmp-6'];

  const isDemoCategory = (c: Category) =>
    initialCategories.some(init => init.id === c.id) || DEMO_CATEGORY_IDS.includes(c.id);
  const isDemoCompetition = (comp: Competition) =>
    initialCompetitions.some(init => init.id === comp.id) || DEMO_COMPETITION_IDS.includes(comp.id);
  const isDemoParticipant = (p: Participant) =>
    initialParticipants.some(init => init.id === p.id) || DEMO_TEAM_IDS.includes(p.teamId);
  const isDemoRegistration = (r: Registration) =>
    initialRegistrations.some(init => init.id === r.id) || DEMO_TEAM_IDS.includes(r.teamId);
  const isDemoMarkEntry = (m: MarkEntry) =>
    initialMarkEntries.some(init => init.id === m.id);
  const isDemoResult = (res: CompetitionResult) =>
    initialResults.some(init => init.id === res.id) ||
    res.ranks.some(rk => DEMO_TEAM_IDS.includes(rk.teamId));
  const isDemoPointsLedgerEntry = (l: PointsLedgerEntry) =>
    initialPointsLedger.some(init => init.id === l.id) || DEMO_TEAM_IDS.includes(l.teamId);

  const [theme, setTheme] = useState<PublicThemeSettings>(() => {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem('fest_theme_settings_v2');
      if (saved) {
        try { return JSON.parse(saved); } catch (e) { console.error(e); }
      }
    }
    return defaultTheme;
  });

  const [categories, setCategories] = useState<Category[]>(() => {
    if (!isIsolatedDemoOrTest) {
      if (typeof window !== 'undefined') {
        const saved = localStorage.getItem('fest_categories_v2');
        if (saved) {
          try {
            const parsed = JSON.parse(saved);
            if (Array.isArray(parsed)) {
              return parsed.filter(c => !isDemoCategory(c));
            }
          } catch (e) { console.error(e); }
        }
      }
      return [];
    }

    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem('fest_categories_v2');
      if (saved) {
        try { return JSON.parse(saved); } catch (e) { console.error(e); }
      }
    }
    return initialCategories;
  });

  const [competitions, setCompetitions] = useState<Competition[]>(() => {
    if (!isIsolatedDemoOrTest) {
      if (typeof window !== 'undefined') {
        const saved = localStorage.getItem('fest_competitions_v2');
        if (saved) {
          try {
            const parsed = JSON.parse(saved);
            if (Array.isArray(parsed)) {
              return parsed.filter(c => !isDemoCompetition(c));
            }
          } catch (e) { console.error(e); }
        }
      }
      return [];
    }

    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem('fest_competitions_v2');
      if (saved) {
        try { return JSON.parse(saved); } catch (e) { console.error(e); }
      }
    }
    return initialCompetitions;
  });

  const [participants, setParticipants] = useState<Participant[]>(() => {
    if (!isIsolatedDemoOrTest) {
      if (typeof window !== 'undefined') {
        const saved = localStorage.getItem('fest_participants_v2');
        if (saved) {
          try {
            const parsed = JSON.parse(saved);
            if (Array.isArray(parsed)) {
              return parsed.filter(p => !isDemoParticipant(p));
            }
          } catch (e) { console.error(e); }
        }
      }
      return [];
    }

    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem('fest_participants_v2');
      if (saved) {
        try { return JSON.parse(saved); } catch (e) { console.error(e); }
      }
    }
    return initialParticipants;
  });

  const [registrations, setRegistrations] = useState<Registration[]>(() => {
    if (!isIsolatedDemoOrTest) {
      if (typeof window !== 'undefined') {
        const saved = localStorage.getItem('fest_registrations_v2');
        if (saved) {
          try {
            const parsed = JSON.parse(saved);
            if (Array.isArray(parsed)) {
              return parsed.filter(r => !isDemoRegistration(r));
            }
          } catch (e) { console.error(e); }
        }
      }
      return [];
    }

    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem('fest_registrations_v2');
      if (saved) {
        try { return JSON.parse(saved); } catch (e) { console.error(e); }
      }
    }
    return initialRegistrations;
  });

  const [stages, setStages] = useState<Stage[]>(() => {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem('fest_stages_v2');
      if (saved) {
        try { return JSON.parse(saved); } catch (e) { console.error(e); }
      }
    }
    return initialStages;
  });

  const [schedules, setSchedules] = useState<ScheduleSlot[]>(() => {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem('fest_schedules_v2');
      if (saved) {
        try { return JSON.parse(saved); } catch (e) { console.error(e); }
      }
    }
    return initialSchedules;
  });

  const [markEntries, setMarkEntries] = useState<MarkEntry[]>(() => {
    if (!isIsolatedDemoOrTest) {
      if (typeof window !== 'undefined') {
        const saved = localStorage.getItem('fest_mark_entries_v2');
        if (saved) {
          try {
            const parsed = JSON.parse(saved);
            if (Array.isArray(parsed)) {
              return parsed.filter(m => !isDemoMarkEntry(m));
            }
          } catch (e) { console.error(e); }
        }
      }
      return [];
    }

    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem('fest_mark_entries_v2');
      if (saved) {
        try { return JSON.parse(saved); } catch (e) { console.error(e); }
      }
    }
    return initialMarkEntries;
  });

  const [results, setResults] = useState<CompetitionResult[]>(() => {
    if (!isIsolatedDemoOrTest) {
      if (typeof window !== 'undefined') {
        const saved = localStorage.getItem('fest_results_v2');
        if (saved) {
          try {
            const parsed = JSON.parse(saved);
            if (Array.isArray(parsed)) {
              return parsed.filter(res => !isDemoResult(res));
            }
          } catch (e) { console.error(e); }
        }
      }
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

  const [pointsLedger, setPointsLedger] = useState<PointsLedgerEntry[]>(() => {
    if (!isIsolatedDemoOrTest) {
      if (typeof window !== 'undefined') {
        const saved = localStorage.getItem('fest_points_ledger_v2');
        if (saved) {
          try {
            const parsed = JSON.parse(saved);
            if (Array.isArray(parsed)) {
              return parsed.filter(l => !isDemoPointsLedgerEntry(l));
            }
          } catch (e) { console.error(e); }
        }
      }
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

  // Purge stale mock fixtures from localStorage in live production
  useEffect(() => {
    if (!isIsolatedDemoOrTest && typeof window !== 'undefined') {
      try {
        localStorage.removeItem('fest_teams_v2');

        const cleanse = (key: string, isDemoFn: (item: any) => boolean) => {
          const val = localStorage.getItem(key);
          if (val) {
            try {
              const parsed = JSON.parse(val);
              if (Array.isArray(parsed)) {
                const filtered = parsed.filter(item => !isDemoFn(item));
                if (filtered.length > 0) {
                  localStorage.setItem(key, JSON.stringify(filtered));
                } else {
                  localStorage.removeItem(key);
                }
              }
            } catch {
              localStorage.removeItem(key);
            }
          }
        };

        cleanse('fest_categories_v2', isDemoCategory);
        cleanse('fest_competitions_v2', isDemoCompetition);
        cleanse('fest_participants_v2', isDemoParticipant);
        cleanse('fest_registrations_v2', isDemoRegistration);
        cleanse('fest_mark_entries_v2', isDemoMarkEntry);
        cleanse('fest_results_v2', isDemoResult);
        cleanse('fest_points_ledger_v2', isDemoPointsLedgerEntry);
      } catch {}
    }
  }, [isIsolatedDemoOrTest]);

  // Realtime Firestore teams synchronization for live production
  useEffect(() => {
    if (!isIsolatedDemoOrTest && db) {
      try {
        const teamsRef = collection(db, 'teams');
        const unsubscribe = onSnapshot(
          teamsRef,
          (snapshot) => {
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
          },
          (err) => {
            console.warn('[FestContext] Firestore realtime teams sync warning:', err);
          }
        );
        return () => unsubscribe();
      } catch (e) {
        console.warn('[FestContext] Could not subscribe to realtime teams:', e);
      }
    }
  }, [isIsolatedDemoOrTest]);

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

  // Sync state to localStorage
  useEffect(() => {
    if (typeof window !== 'undefined') {
      localStorage.setItem('fest_theme_settings_v2', JSON.stringify(theme));
      localStorage.setItem('fest_categories_v2', JSON.stringify(categories));
      if (isIsolatedDemoOrTest) {
        localStorage.setItem('fest_teams_v2', JSON.stringify(teams));
      } else {
        localStorage.removeItem('fest_teams_v2');
      }
      localStorage.setItem('fest_competitions_v2', JSON.stringify(competitions));
      localStorage.setItem('fest_participants_v2', JSON.stringify(participants));
      localStorage.setItem('fest_registrations_v2', JSON.stringify(registrations));
      localStorage.setItem('fest_stages_v2', JSON.stringify(stages));
      localStorage.setItem('fest_schedules_v2', JSON.stringify(schedules));
      localStorage.setItem('fest_mark_entries_v2', JSON.stringify(markEntries));
      localStorage.setItem('fest_results_v2', JSON.stringify(results));
      localStorage.setItem('fest_points_ledger_v2', JSON.stringify(pointsLedger));
      if (currentTeamUser) {
        localStorage.setItem('fest_current_team_user_v2', JSON.stringify(currentTeamUser));
      } else {
        localStorage.removeItem('fest_current_team_user_v2');
      }
    }
  }, [theme, categories, teams, competitions, participants, registrations, stages, schedules, markEntries, results, pointsLedger, currentTeamUser, isIsolatedDemoOrTest]);

  const updateTheme = (newTheme: Partial<PublicThemeSettings>) => {
    setTheme(prev => ({ ...prev, ...newTheme }));
  };

  const addCategory = (catData: Omit<Category, 'id' | 'enrolledCount' | 'competitionsCount'>) => {
    const newCat: Category = {
      ...catData,
      id: 'cat-' + Date.now().toString(36) + '-' + Math.random().toString(36).substring(2, 6),
      enrolledCount: 0,
      competitionsCount: 0
    };
    setCategories(prev => [...prev, newCat]);
  };

  const updateCategory = (id: string, updated: Partial<Category>) => {
    setCategories(prev => prev.map(c => c.id === id ? { ...c, ...updated } : c));
  };

  const deleteCategory = (id: string) => {
    setCategories(prev => prev.filter(c => c.id !== id));
  };

  const handleSetCurrentTeamUser = (teamUser: Team | null) => {
    setCurrentTeamUser(teamUser);
    if (teamUser) {
      setTeams(prev => {
        const idx = prev.findIndex(t => t.id === teamUser.id);
        if (idx !== -1) {
          const updated = [...prev];
          updated[idx] = { ...updated[idx], ...teamUser };
          return updated;
        }
        return [...prev, teamUser];
      });
    }
  };

  const addTeam = (teamData: Omit<Team, 'id' | 'totalPoints' | 'soloPoints' | 'groupPoints' | 'rank' | 'firstCount' | 'secondCount' | 'thirdCount' | 'contestantsCount' | 'eventsCount'> & { id?: string }) => {
    const customId = (teamData as any).id;
    const newTeam: Team = {
      ...teamData,
      id: customId || ('team-' + (teams.length + 1)),
      contestantsCount: (teamData as any).contestantsCount || 0,
      eventsCount: (teamData as any).eventsCount || 0,
      totalPoints: (teamData as any).totalPoints || 0,
      soloPoints: (teamData as any).soloPoints || 0,
      groupPoints: (teamData as any).groupPoints || 0,
      firstCount: (teamData as any).firstCount || 0,
      secondCount: (teamData as any).secondCount || 0,
      thirdCount: (teamData as any).thirdCount || 0,
      rank: (teamData as any).rank || (teams.length + 1)
    };
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

  const updateTeam = (id: string, updated: Partial<Team>) => {
    setTeams(prev => prev.map(t => t.id === id ? { ...t, ...updated } : t));
  };

  const deleteTeam = (id: string) => {
    setTeams(prev => prev.filter(t => t.id !== id));
  };

  const addCompetition = (compData: Omit<Competition, 'id' | 'entriesCount'>) => {
    const newComp: Competition = {
      ...compData,
      id: 'cmp-' + Date.now().toString(36) + '-' + Math.random().toString(36).substring(2, 6),
      entriesCount: 0
    };
    setCompetitions(prev => [...prev, newComp]);
  };

  const updateCompetition = (id: string, updated: Partial<Competition>) => {
    setCompetitions(prev => prev.map(c => c.id === id ? { ...c, ...updated } : c));
  };

  const deleteCompetition = (id: string) => {
    setCompetitions(prev => prev.filter(c => c.id !== id));
  };

  const addParticipant = (partData: Omit<Participant, 'id' | 'bib' | 'idStatus'>) => {
    const nextNum = participants.length + 1;
    const newBib = '#' + (1000 + nextNum);
    const newParticipant: Participant = {
      ...partData,
      id: 'part-' + Date.now().toString(36) + '-' + Math.random().toString(36).substring(2, 6),
      bib: newBib,
      idStatus: 'GENERATED'
    };
    setParticipants(prev => [...prev, newParticipant]);
    setTeams(prev => prev.map(t => t.id === partData.teamId ? { ...t, contestantsCount: t.contestantsCount + 1 } : t));
  };

  const updateParticipant = (id: string, updated: Partial<Participant>) => {
    setParticipants(prev => prev.map(p => p.id === id ? { ...p, ...updated } : p));
  };

  const deleteParticipant = (id: string) => {
    setParticipants(prev => prev.filter(p => p.id !== id));
  };

  const addRegistration = (regData: Omit<Registration, 'id' | 'code' | 'registeredAt'>) => {
    const nextNum = registrations.length + 1;
    const newReg: Registration = {
      ...regData,
      id: 'reg-' + Date.now().toString(36) + '-' + Math.random().toString(36).substring(2, 6),
      code: 'REG-' + (8820 + nextNum),
      registeredAt: new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })
    };
    setRegistrations(prev => [...prev, newReg]);
    setCompetitions(prev => prev.map(c => c.id === regData.competitionId ? { ...c, entriesCount: c.entriesCount + 1 } : c));
  };

  const updateRegistrationStatus = (id: string, status: 'APPROVED' | 'PENDING' | 'REJECTED') => {
    setRegistrations(prev => prev.map(r => r.id === id ? { ...r, status } : r));
  };

  const deleteRegistration = (id: string) => {
    setRegistrations(prev => prev.filter(r => r.id !== id));
  };

  const addStage = (stageData: Omit<Stage, 'id'>) => {
    const newStage: Stage = {
      ...stageData,
      id: 'stg-' + (stages.length + 1)
    };
    setStages(prev => [...prev, newStage]);
  };

  const updateStage = (id: string, updated: Partial<Stage>) => {
    setStages(prev => prev.map(s => s.id === id ? { ...s, ...updated } : s));
  };

  const deleteStage = (id: string) => {
    setStages(prev => prev.filter(s => s.id !== id));
  };

  const addSchedule = (slotData: Omit<ScheduleSlot, 'id'>) => {
    const newSlot: ScheduleSlot = {
      ...slotData,
      id: 'sch-' + (schedules.length + 1)
    };
    setSchedules(prev => [...prev, newSlot]);
  };

  const updateSchedule = (id: string, updated: Partial<ScheduleSlot>) => {
    setSchedules(prev => prev.map(s => s.id === id ? { ...s, ...updated } : s));
  };

  const deleteSchedule = (id: string) => {
    setSchedules(prev => prev.filter(s => s.id !== id));
  };

  // Secure Judge Assignment
  const addOrUpdateJudgeAssignment = async (params: {
    competitionId: string;
    judgeName: string;
    judgePhone: string;
    stageName?: string;
  }): Promise<{ accessCode: string; oneTimeSecret: string; directUrl: string }> => {
    const comp = competitions.find(c => c.id === params.competitionId);
    const creds = await createJudgeAssignment({
      id: 'me-' + (markEntries.length + 1),
      judgeName: params.judgeName,
      judgePhone: params.judgePhone,
      competitionId: params.competitionId,
      competitionCode: comp ? comp.code : 'CMP-X',
      competitionName: comp ? comp.name : 'Unknown Competition',
      stageName: params.stageName || (comp ? comp.stageName : 'Main Stage')
    });

    const newEntry: MarkEntry = {
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

    setMarkEntries(prev => [...prev, newEntry]);

    return {
      accessCode: creds.assignment.accessCode,
      oneTimeSecret: creds.oneTimeSecret,
      directUrl: creds.directLoginUrl
    };
  };

  const revokeJudgeAssignment = (markEntryId: string) => {
    setMarkEntries(prev => prev.map(m => m.id === markEntryId ? { ...m, revoked: true, status: 'REVOKED' } : m));
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

    if (assignment) {
      // Find or create result record and set status to READY_FOR_REVIEW
      setResults(prev => {
        const existing = prev.find(r => r.competitionId === assignment.competitionId);
        if (existing) {
          return prev.map(r => r.id === existing.id ? { ...r, resultStatus: 'READY_FOR_REVIEW', marksStatus: 'COMPLETE' } : r);
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
          marksStatus: 'COMPLETE',
          resultStatus: 'READY_FOR_REVIEW',
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

  const confirmResultPositionsAndGrades = (resultId: string, ranks: ResultRank[]) => {
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
  const publishResult = (resultId: string) => {
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
  const unpublishResult = (resultId: string, reason: string = 'Administrative review') => {
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
          resultStatus: 'REVISION_REQUIRED'
        };
      }
      return r;
    }));
  };

  const updatePosterConfig = (resultId: string, config: PosterConfig, release?: boolean) => {
    setResults(prev => prev.map(r => {
      if (r.id === resultId) {
        return {
          ...r,
          posterConfig: config,
          posterReleased: release !== undefined ? release : r.posterReleased
        };
      }
      return r;
    }));
  };

  return (
    <FestContext.Provider
      value={{
        theme,
        updateTheme,
        categories,
        addCategory,
        updateCategory,
        deleteCategory,
        teams,
        addTeam,
        updateTeam,
        deleteTeam,
        competitions,
        addCompetition,
        updateCompetition,
        deleteCompetition,
        participants,
        addParticipant,
        updateParticipant,
        deleteParticipant,
        registrations,
        addRegistration,
        updateRegistrationStatus,
        deleteRegistration,
        stages,
        addStage,
        updateStage,
        deleteStage,
        schedules,
        addSchedule,
        updateSchedule,
        deleteSchedule,
        markEntries,
        addOrUpdateJudgeAssignment,
        submitJudgeMarks,
        revokeJudgeAssignment,
        results,
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
