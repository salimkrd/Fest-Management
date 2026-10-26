'use client';

import React, { useId, useState } from 'react';
import type { Category, Participant, Team } from '@/types/fest';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Select } from '@/components/ui/Select';
import { Modal } from '@/components/ui/Modal';
import { ParticipantPhoto } from '@/components/domain/ParticipantPhoto';
import {
  initialParticipantFields,
  prepareParticipantPayload,
  type ParticipantEditorFields
} from '@/lib/participantEditor';

interface ParticipantEditorModalProps {
  participant: Participant | null;
  teams: Team[];
  categories: Category[];
  /** Present for Team Managers only; the team is non-editable and cannot fall back to another team. */
  lockedTeam?: Team | null;
  onSave: (participant: Omit<Participant, 'id' | 'bib' | 'idStatus'>) => Promise<void>;
  onClose: () => void;
}

export function ParticipantEditorModal({
  participant,
  teams,
  categories,
  lockedTeam,
  onSave,
  onClose
}: ParticipantEditorModalProps) {
  const formId = useId();
  const isTeamManager = lockedTeam !== undefined;
  const [fields, setFields] = useState<ParticipantEditorFields>(() =>
    initialParticipantFields(participant, teams, categories, lockedTeam)
  );
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);

  const update = (key: keyof ParticipantEditorFields, value: string) => {
    setFields(previous => ({ ...previous, [key]: value }));
    setError('');
  };
  const effectiveFields = {
    ...fields,
    teamId: isTeamManager ? lockedTeam?.id || '' : fields.teamId || (!participant ? teams[0]?.id || '' : '')
  };
  const selectedTeam = teams.find(t => t.id === effectiveFields.teamId);
  const effectiveCategoryId = fields.categoryId || (!participant ? categories[0]?.id || '' : '');

  const close = () => {
    if (!saving) onClose();
  };

  const submit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (saving) return;
    setError('');
    try {
      const payload = prepareParticipantPayload(
        { ...effectiveFields, categoryId: effectiveCategoryId },
        teams,
        categories,
        participant,
        isTeamManager ? lockedTeam?.id : undefined
      );
      setSaving(true);
      await onSave(payload);
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to save participant.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal
      isOpen
      onClose={close}
      title={participant ? 'Edit Participant (' + participant.name + ')' : 'Add Participant'}
      description="Use the same participant details in the Admin and Team Manager portals."
      maxWidth="xl"
      footer={
        <div className="flex items-center justify-end gap-2 w-full">
          <Button type="button" variant="outline" size="sm" onClick={close} disabled={saving}>Cancel</Button>
          <Button
            type="submit"
            form={formId}
            variant="primary"
            size="sm"
            isLoading={saving}
            disabled={saving || !selectedTeam || !effectiveCategoryId}
          >
            {participant ? 'Update Participant' : 'Save & Generate Bib'}
          </Button>
        </div>
      }
    >
      <form id={formId} onSubmit={submit} className="space-y-4">
        {error && <p role="alert" className="text-xs font-semibold text-[#DC2626]">{error}</p>}

        <div className="flex items-center gap-3 pb-2 border-b border-[#E1E7EF]">
          <ParticipantPhoto
            photoUrl={fields.photoUrl}
            name={fields.name}
            size="md"
            shape="rounded"
            className="border border-[#E1E7EF]"
          />
          <div>
            <p className="text-xs font-bold text-[#111111]">Participant Profile</p>
            <p className="text-xs text-[#526070]">
              {participant ? 'Bib ' + participant.bib + ' · Existing registrations preserved' :
                'Bib number is generated automatically after saving'}
            </p>
          </div>
        </div>

        <Input
          label="Full Student Name"
          placeholder="Enter participant full name"
          value={fields.name}
          onChange={e => update('name', e.target.value)}
          required
          maxLength={120}
        />

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {isTeamManager ? (
            <Input label="Team / House" value={selectedTeam ? selectedTeam.name + ' (' + selectedTeam.code + ')' : 'No assigned team'} disabled />
          ) : (
            <Select
              label="Team / House"
              value={effectiveFields.teamId}
              onChange={e => update('teamId', e.target.value)}
              required
              options={teams.map(t => ({ value: t.id, label: t.name + ' (' + t.code + ')', disabled: t.status === 'DISABLED' }))}
            />
          )}
          <Select
            label="Category"
            value={effectiveCategoryId}
            onChange={e => update('categoryId', e.target.value)}
            required
            options={categories.map(c => ({ value: c.id, label: c.name, disabled: c.status === 'INACTIVE' }))}
          />
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <Input
            label="Class / Grade"
            placeholder="e.g. Std 11"
            value={fields.classGrade}
            onChange={e => update('classGrade', e.target.value)}
          />
          <Input
            label="Division"
            placeholder="e.g. A"
            value={fields.division}
            onChange={e => update('division', e.target.value)}
          />
          <Input
            label="Date of Birth"
            type="date"
            value={fields.dob}
            onChange={e => update('dob', e.target.value)}
            required
            helperText="Required for participant Bib + DOB login"
          />
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <Input
            label="Email (Optional)"
            type="email"
            placeholder="student@example.com"
            value={fields.email}
            onChange={e => update('email', e.target.value)}
          />
          <Input
            label="Contact Phone (Optional)"
            type="tel"
            placeholder="+91 ..."
            value={fields.phone}
            onChange={e => update('phone', e.target.value)}
          />
        </div>

        <Input
          label="Participant Photo URL (Optional)"
          type="url"
          placeholder="https://..."
          helperText="Leave blank to show the official neutral silhouette/initials placeholder"
          value={fields.photoUrl}
          onChange={e => update('photoUrl', e.target.value)}
        />

        <Input
          label="Stage / Accommodation Remarks (Optional)"
          placeholder="Relevant stage arrangements"
          value={fields.remarks}
          onChange={e => update('remarks', e.target.value)}
        />
      </form>
    </Modal>
  );
}
