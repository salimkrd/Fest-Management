import { describe, expect, it } from 'vitest';
import type { Category, Participant, Team } from '@/types/fest';
import { initialParticipantFields, prepareParticipantPayload } from '@/lib/participantEditor';

const teamA = { id: 'team-a', code: 'ALF', name: 'Al Farooq', status: 'ACTIVE' } as Team;
const teamB = { id: 'team-b', code: 'NAW', name: 'An Nawa', status: 'ACTIVE' } as Team;
const senior = { id: 'senior', name: 'Senior', status: 'ACTIVE' } as Category;
const junior = { id: 'junior', name: 'Junior', status: 'ACTIVE' } as Category;

const existing: Participant = {
  id: 'part-1042', bib: '#1042', idStatus: 'GENERATED',
  name: 'Old Name', email: 'original@example.com', phone: '9876543210',
  teamId: teamA.id, teamName: teamA.name, teamCode: teamA.code,
  categoryId: senior.id, categoryName: senior.name,
  classGrade: 'Std 11', division: 'B', dob: '2010-05-12',
  photoUrl: 'https://example.com/photo.jpg', remarks: 'Needs front seat',
  registeredEventIds: ['competition-one']
};

describe('Shared Admin and Team Manager participant editor', () => {
  it('starts new registrations without invented DOB, contact details, photo or events', () => {
    const fields = initialParticipantFields(null, [teamA], [senior]);
    expect(fields.dob).toBe('');
    expect(fields.phone).toBe('');
    expect(fields.email).toBe('');
    expect(fields.photoUrl).toBe('');
    expect(fields.teamId).toBe(teamA.id);
    expect(() => prepareParticipantPayload(fields, [teamA], [senior], null)).toThrow(/name/i);
    const payload = prepareParticipantPayload({ ...fields, name: ' New Student ', dob: '2010-05-12' }, [teamA], [senior], null);
    expect(payload).toMatchObject({
      name: 'New Student', email: '', phone: '', photoUrl: '', registeredEventIds: [],
      teamId: teamA.id, categoryId: senior.id, dob: '2010-05-12'
    });
  });

  it('prefills all previously entered values in BOTH editor contexts', () => {
    const fields = initialParticipantFields(existing, [teamA, teamB], [junior, senior], teamA);
    expect(fields).toMatchObject({
      name: existing.name, email: existing.email, phone: existing.phone,
      teamId: existing.teamId, categoryId: existing.categoryId,
      classGrade: existing.classGrade, division: existing.division, dob: existing.dob,
      photoUrl: existing.photoUrl, remarks: existing.remarks
    });
    const saved = prepareParticipantPayload(fields, [teamA], [senior], existing, teamA.id);
    expect(saved.email).toBe(existing.email);
    expect(saved.photoUrl).toBe(existing.photoUrl);
    expect(saved.remarks).toBe(existing.remarks);
    expect(saved.registeredEventIds).toEqual(['competition-one']);
  });

  it('blocks Team Managers from reassigning a participant to another team', () => {
    const fields = initialParticipantFields(existing, [teamA, teamB], [senior], teamA);
    expect(() => prepareParticipantPayload({ ...fields, teamId: teamB.id }, [teamA, teamB], [senior], existing, teamA.id))
      .toThrow(/assigned team/i);
    const admin = prepareParticipantPayload({ ...fields, teamId: teamB.id }, [teamA, teamB], [senior], existing);
    expect(admin.teamId).toBe(teamB.id);
  });

  it('rejects missing or invalid DOB, category and team on either editor', () => {
    const fields = initialParticipantFields(existing, [teamA], [senior]);
    expect(() => prepareParticipantPayload({ ...fields, dob: '' }, [teamA], [senior], existing)).toThrow(/birth/i);
    expect(() => prepareParticipantPayload({ ...fields, dob: '2099-01-01' }, [teamA], [senior], existing)).toThrow(/birth/i);
    expect(() => prepareParticipantPayload({ ...fields, dob: '2010-02-30' }, [teamA], [senior], existing)).toThrow(/birth/i);
    expect(() => prepareParticipantPayload({ ...fields, categoryId: 'invalid' }, [teamA], [senior], existing)).toThrow(/category/i);
    expect(() => prepareParticipantPayload({ ...fields, teamId: 'invalid' }, [teamA], [senior], existing)).toThrow(/team/i);
  });

  it('does not retain old Unsplash stock portraits when a participant is edited', () => {
    const fields = initialParticipantFields(existing, [teamA], [senior]);
    const data = prepareParticipantPayload({
      ...fields, photoUrl: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format'
    }, [teamA], [senior], existing);
    expect(data.photoUrl).toBe('');
  });
});
