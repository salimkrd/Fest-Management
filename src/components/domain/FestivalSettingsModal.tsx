'use client';

import React, { useEffect, useState } from 'react';
import { useFest } from '@/context/FestContext';
import { normalizeFestivalSettings } from '@/domain/festivalSettings';
import { Modal } from '@/components/ui/Modal';
import { Input } from '@/components/ui/Input';
import { Button } from '@/components/ui/Button';
import { FestivalLogo } from '@/components/domain/FestivalBrand';

interface Props { isOpen: boolean; onClose: () => void }
export function FestivalSettingsModal({ isOpen, onClose }: Props) {
  const { theme, updateTheme } = useFest();
  const [form, setForm] = useState({
    festivalName: theme.festivalName, institutionName: theme.institutionName,
    logoUrl: theme.logoUrl || '', festivalStartDate: theme.festivalStartDate || '',
    festivalEndDate: theme.festivalEndDate || ''
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [saved, setSaved] = useState(false);
  useEffect(() => {
    if (!isOpen) return;
    setForm({
      festivalName: theme.festivalName, institutionName: theme.institutionName,
      logoUrl: theme.logoUrl || '', festivalStartDate: theme.festivalStartDate || '',
      festivalEndDate: theme.festivalEndDate || ''
    });
    setError('');
    setSaved(false);
  }, [isOpen]); // Reset once when opened; do not overwrite in-progress edits from snapshots

  const change = (key: keyof typeof form, value: string) => {
    setForm(old => ({ ...old, [key]: value }));
    setError(''); setSaved(false);
  };
  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (saving) return;
    try {
      const changes = normalizeFestivalSettings(form);
      setSaving(true); setError(''); setSaved(false);
      await updateTheme(changes);
      setSaved(true);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not save festival settings.');
    } finally {
      setSaving(false);
    }
  };

  return <Modal isOpen={isOpen} onClose={() => { if (!saving) onClose(); }}
    title="Festival Settings"
    description="Chief Administrator · Official festival identity and dates across every portal"
    maxWidth="xl"
    footer={<div className="w-full flex justify-end gap-2">
      <Button variant="outline" size="sm" onClick={onClose} disabled={saving}>Close</Button>
      <Button variant="primary" size="sm" type="submit" form="festival-settings-form"
        isLoading={saving} disabled={saving}>Save Settings</Button>
    </div>}>
    <form id="festival-settings-form" onSubmit={submit} className="space-y-5">
      <p className="text-xs text-[#526070] rounded-lg bg-blue-50 border border-blue-100 p-3">
        Changes are published across Admin, Team Manager, Judge, Green Room, Participant and Public portals.
        Festival dates follow Asia/Kolkata (Indian Standard Time).
      </p>
      {error && <p role="alert" className="rounded-lg bg-red-50 text-red-700 p-3 text-xs font-semibold">{error}</p>}
      {saved && <p role="status" className="rounded-lg bg-emerald-50 text-emerald-700 p-3 text-xs font-semibold">Festival settings saved successfully.</p>}
      <Input label="Festival Name" value={form.festivalName} required maxLength={100}
        onChange={e => change('festivalName', e.target.value)} placeholder="INSPIRAATH 26" />
      <Input label="Institution Name" value={form.institutionName} required maxLength={150}
        onChange={e => change('institutionName', e.target.value)} placeholder="Ma'din Suffa Campus Vavoor" />
      <div>
        <Input label="Festival Logo URL (Optional)" type="url" value={form.logoUrl}
          placeholder="https://example.com/festival-logo.png"
          helperText="Use a direct, publicly accessible image URL (not a ChatGPT chat link). Leave empty for an initial."
          onChange={e => change('logoUrl', e.target.value)} />
        <div className="flex items-center gap-2 mt-2 text-xs text-[#526070]">
          <FestivalLogo size={30} /> Current published logo
        </div>
      </div>
      <div>
        <p className="text-xs font-bold text-[#111111] mb-2">Festival Date Range</p>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <Input label="From (Start Date)" type="date" required value={form.festivalStartDate}
            onChange={e => change('festivalStartDate', e.target.value)} />
          <Input label="To (End Date)" type="date" required min={form.festivalStartDate || undefined}
            value={form.festivalEndDate} onChange={e => change('festivalEndDate', e.target.value)} />
        </div>
        <p className="mt-2 text-[11px] text-[#526070]">Example: 16/10/2026 to 18/10/2026 · LIVE Day 1/3, Day 2/3, Day 3/3 on those respective dates.</p>
      </div>
    </form>
  </Modal>;
}
