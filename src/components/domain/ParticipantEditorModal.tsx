'use client';

import React, { useEffect, useId, useState } from 'react';
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
  onSave: (participant: Omit<Participant, 'id' | 'bib' | 'idStatus'>, photoFile?: File | null) => Promise<string | void>;
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
  const [photoFile, setPhotoFile] = useState<File | null>(null);
  const [photoPreviewUrl, setPhotoPreviewUrl] = useState<string>('');

  useEffect(() => {
    return () => {
      if (photoPreviewUrl) URL.revokeObjectURL(photoPreviewUrl);
    };
  }, [photoPreviewUrl]);

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
      await onSave(payload, photoFile);
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
        <div className="flex w-full flex-col-reverse gap-2 sm:flex-row sm:justify-end">
          <Button type="button" variant="outline" size="md" className="w-full sm:w-auto" onClick={close} disabled={saving}>Cancel</Button>
          <Button
            type="submit"
            form={formId}
            variant="primary"
            size="md"
            className="w-full sm:w-auto"
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
            photoUrl={photoPreviewUrl || fields.photoUrl}
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

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <Input
            label="Class / Grade"
            placeholder="e.g. Std 11"
            value={fields.classGrade}
            onChange={e => update('classGrade', e.target.value)}
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

        <div className="space-y-2">
          <Input
            label="Participant Photo URL (Optional)"
            type="url"
            placeholder="Paste a direct public image URL (https://...)"
            helperText="Use a direct image link. Google Photos and Google Drive share links may require sign-in and may not display for other users."
            value={fields.photoUrl}
            onChange={e => update('photoUrl', e.target.value)}
          />
          <label className="block">
            <span className="mb-1.5 block text-xs font-semibold text-[#111111]">Or upload a photo</span>
            <input
              type="file"
              accept="image/jpeg,image/png,image/webp"
              onChange={event => {
                const file = event.target.files?.[0] || null;
                if (!file) {
                  setPhotoFile(null);
                  setPhotoPreviewUrl('');
                  return;
                }
                if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type)) {
                  setError('Choose a JPG, PNG, or WebP image.');
                  event.target.value = '';
                  return;
                }
                if (file.size > 4 * 1024 * 1024) {
                  setError('Photo must be smaller than 4 MB.');
                  event.target.value = '';
                  return;
                }
                setPhotoFile(file);
                setPhotoPreviewUrl(URL.createObjectURL(file));
                setError('');
              }}
              className="block w-full rounded-xl border border-[#E1E7EF] bg-white px-3 py-2 text-sm text-[#526070] file:mr-3 file:rounded-lg file:border-0 file:bg-blue-50 file:px-3 file:py-2 file:text-xs file:font-semibold file:text-blue-700 hover:file:bg-blue-100"
            />
            <span className="mt-1 block text-[11px] text-[#526070]">JPG, PNG, or WebP · Maximum 4 MB. Uploaded photos are stored in the festival Firebase Storage bucket.</span>
            {photoFile && <span className="mt-1 block text-xs font-semibold text-emerald-700">Selected: {photoFile.name} (will replace the URL above)</span>}
          </label>
        </div>

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
