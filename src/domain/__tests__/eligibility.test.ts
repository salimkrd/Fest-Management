import { describe, it, expect } from 'vitest';
import { isParticipantEligibleForCategory } from '../eligibility';
import { Category, Participant } from '@/types/fest';

describe('Festival Category & Contestant Eligibility Domain Engine', () => {
  const categories: Category[] = [
    { id: 'cat-sj', name: 'Sub Junior', code: 'CAT-SJ', eligibility: 'Class 5 to 7', ageRange: '10 - 12 Years', classRange: 'Std 5 - 7', enrolledCount: 0, competitionsCount: 0, status: 'ACTIVE' },
    { id: 'cat-jr', name: 'Junior', code: 'CAT-JR', eligibility: 'Class 8 to 10', ageRange: '13 - 15 Years', classRange: 'Std 8 - 10', enrolledCount: 0, competitionsCount: 0, status: 'ACTIVE' },
    { id: 'cat-sr', name: 'Senior', code: 'CAT-SR', eligibility: 'Class 11 to 12', ageRange: '16 - 18 Years', classRange: 'Std 11 - 12', enrolledCount: 0, competitionsCount: 0, status: 'ACTIVE' },
    { id: 'cat-gen', name: 'General', code: 'CAT-GEN', eligibility: 'All Eligible Students', ageRange: 'Open Tier', classRange: 'Campus Wide', enrolledCount: 0, competitionsCount: 0, status: 'ACTIVE' }
  ];

  const seniorParticipant: Participant = {
    id: 'part-salim',
    bib: '#1002',
    name: 'Salim Karakkad',
    email: 'salim.karakkad@student.institution.org',
    phone: '+91 9539405815',
    teamId: 'team-alpha',
    teamCode: 'TEA',
    teamName: 'Team Alpha',
    categoryId: 'cat-sr',
    categoryName: 'Senior',
    classGrade: 'UG',
    division: 'Div',
    dob: '2005-01-01',
    photoUrl: '',
    registeredEventIds: [],
    idStatus: 'GENERATED'
  };

  const juniorParticipant: Participant = {
    id: 'part-junior',
    bib: '#1003',
    name: 'Junior Student',
    email: 'junior@student.institution.org',
    phone: '+91 9847000000',
    teamId: 'team-alpha',
    teamCode: 'TEA',
    teamName: 'Team Alpha',
    categoryId: 'cat-jr',
    categoryName: 'Junior',
    classGrade: 'Std 9',
    division: 'A',
    dob: '2010-01-01',
    photoUrl: '',
    registeredEventIds: [],
    idStatus: 'GENERATED'
  };

  it('1. General tier competitions are OPEN to ALL students from any academic category (Senior, Junior, Sub Junior)', () => {
    const generalCat = categories.find(c => c.name === 'General')!;
    
    // Senior student MUST be eligible for General competitions
    expect(isParticipantEligibleForCategory(seniorParticipant, generalCat, categories)).toBe(true);

    // Junior student MUST be eligible for General competitions
    expect(isParticipantEligibleForCategory(juniorParticipant, generalCat, categories)).toBe(true);
  });

  it('2. Senior contestants are eligible for Senior tier competitions', () => {
    const seniorCat = categories.find(c => c.name === 'Senior')!;
    expect(isParticipantEligibleForCategory(seniorParticipant, seniorCat, categories)).toBe(true);
  });

  it('3. Junior contestants are NOT eligible for Senior competitions and Senior contestants are NOT eligible for Junior competitions', () => {
    const seniorCat = categories.find(c => c.name === 'Senior')!;
    const juniorCat = categories.find(c => c.name === 'Junior')!;

    expect(isParticipantEligibleForCategory(juniorParticipant, seniorCat, categories)).toBe(false);
    expect(isParticipantEligibleForCategory(seniorParticipant, juniorCat, categories)).toBe(false);
  });

  it('4. Resilient matching: matches when categoryId differs from initial ID mapping (e.g. cat-3 vs cat-sr) by name/code', () => {
    const legacySeniorParticipant: Participant = {
      ...seniorParticipant,
      categoryId: 'cat-3',
      categoryName: 'Senior'
    };
    const seniorCat = categories.find(c => c.name === 'Senior')!; // id: 'cat-sr'

    expect(isParticipantEligibleForCategory(legacySeniorParticipant, seniorCat, categories)).toBe(true);
  });

  it('6. Rejects a participant whose explicit category name conflicts with a legacy Senior ID', () => {
    const mislabeledSeniorId: Participant = {
      ...seniorParticipant,
      categoryId: 'cat-3',
      categoryName: 'Test CAT 26'
    };
    const seniorCat = categories.find(c => c.name === 'Senior')!;
    expect(isParticipantEligibleForCategory(mislabeledSeniorId, seniorCat, categories)).toBe(false);
  });

  it('7. Rejects a participant from another custom category even if their ID resembles a legacy tier ID', () => {
    const customCategoryParticipant: Participant = {
      ...seniorParticipant,
      categoryId: 'cat-3',
      categoryName: 'Test CAT 26'
    };
    const juniorCat = categories.find(c => c.name === 'Junior')!;
    const seniorCat = categories.find(c => c.name === 'Senior')!;
    expect(isParticipantEligibleForCategory(customCategoryParticipant, juniorCat, categories)).toBe(false);
    expect(isParticipantEligibleForCategory(customCategoryParticipant, seniorCat, categories)).toBe(false);
  });

  it('5. Resilient matching: handles legacy cat-4 General category ID mapping', () => {
    const legacyGeneralCat: Category = {
      id: 'cat-4',
      name: 'General',
      code: 'CAT-GEN',
      eligibility: 'All Eligible Students',
      ageRange: 'Open Tier',
      classRange: 'Campus Wide',
      enrolledCount: 0,
      competitionsCount: 0,
      status: 'ACTIVE'
    };

    expect(isParticipantEligibleForCategory(seniorParticipant, legacyGeneralCat, categories)).toBe(true);
  });
});
