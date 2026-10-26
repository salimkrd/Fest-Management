import type { Category, Participant, Team } from '@/types/fest';

export interface ParticipantEditorFields {
  name: string;
  email: string;
  phone: string;
  teamId: string;
  categoryId: string;
  classGrade: string;
  division: string;
  dob: string;
  photoUrl: string;
  remarks: string;
}

export function initialParticipantFields(
  participant: Participant | null,
  teams: Team[],
  categories: Category[],
  lockedTeam?: Team | null
): ParticipantEditorFields {
  return {
    name: participant?.name || '',
    email: participant?.email || '',
    phone: participant?.phone || '',
    teamId: lockedTeam?.id || participant?.teamId || teams[0]?.id || '',
    categoryId: participant?.categoryId || categories[0]?.id || '',
    classGrade: participant?.classGrade || '',
    division: participant?.division || '',
    dob: participant?.dob || '',
    photoUrl: participant?.photoUrl || '',
    remarks: participant?.remarks || ''
  };
}

/** Used by both the Admin and Team Manager editors: identical validation and data mapping. */
export function prepareParticipantPayload(
  fields: ParticipantEditorFields,
  teams: Team[],
  categories: Category[],
  existing: Participant | null,
  lockedTeamId?: string
): Omit<Participant, 'id' | 'bib' | 'idStatus'> {
  const name = fields.name.trim();
  if (!name) throw new Error('Please enter the participant full name.');

  if (lockedTeamId && fields.teamId !== lockedTeamId) {
    throw new Error('You can only manage participants in your assigned team.');
  }
  const team = teams.find(t => t.id === fields.teamId);
  if (!team || team.status === 'DISABLED') {
    throw new Error('Please select an active team.');
  }
  const category = categories.find(c => c.id === fields.categoryId);
  if (!category || category.status === 'INACTIVE') {
    throw new Error('Please select an active category.');
  }

  // DOB is required for Bib + DOB participant authentication; never use an invented default.
  const dob = fields.dob.trim();
  const parsed = /^\d{4}-\d{2}-\d{2}$/.test(dob) ? new Date(dob + 'T00:00:00.000Z') : null;
  if (!parsed || Number.isNaN(parsed.getTime()) || parsed.toISOString().slice(0, 10) !== dob ||
      dob > new Date().toISOString().slice(0, 10)) {
    throw new Error('Enter a valid past date of birth.');
  }

  const email = fields.email.trim();
  if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    throw new Error('Enter a valid email or leave it blank.');
  }

  // Older records may have an obsolete stock photo placeholder: do not persist it on edit.
  const photoUrl = fields.photoUrl.trim();
  const safePhotoUrl = photoUrl.includes('1534528741775-53994a69daeb') ? '' : photoUrl;
  if (safePhotoUrl && !/^https?:\/\//i.test(safePhotoUrl)) {
    throw new Error('Enter a valid photo URL beginning with https:// or leave it blank.');
  }

  return {
    name,
    email,
    phone: fields.phone.trim(),
    teamId: team.id,
    teamCode: team.code,
    teamName: team.name,
    categoryId: category.id,
    categoryName: category.name,
    classGrade: fields.classGrade.trim(),
    division: fields.division.trim(),
    dob,
    photoUrl: safePhotoUrl,
    remarks: fields.remarks.trim(),
    // Never fabricate event registrations or silently lose existing assignments.
    registeredEventIds: existing?.registeredEventIds || []
  };
}
