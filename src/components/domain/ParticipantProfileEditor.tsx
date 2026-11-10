'use client';

import React, { useState } from 'react';
import { AlertCircle, CheckCircle2, LoaderCircle, Pencil, Save, X } from 'lucide-react';

type EditableProfile = {
  name: string;
  classGrade: string;
  email: string;
  phone: string;
  photoUrl: string;
  remarks: string;
};

type Props = {
  profile: Partial<EditableProfile>;
  onSaved: () => Promise<void>;
};

export function ParticipantProfileEditor({ profile, onSaved }: Props) {
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [savedMessage, setSavedMessage] = useState('');
  const [form, setForm] = useState<EditableProfile>({
    name: profile.name || '',
    classGrade: profile.classGrade || '',
    email: profile.email || '',
    phone: profile.phone || '',
    photoUrl: profile.photoUrl || '',
    remarks: profile.remarks || ''
  });

  const openEditor = () => {
    setForm({
      name: profile.name || '',
      classGrade: profile.classGrade || '',
      email: profile.email || '',
      phone: profile.phone || '',
      photoUrl: profile.photoUrl || '',
      remarks: profile.remarks || ''
    });
    setError('');
    setSavedMessage('');
    setOpen(true);
  };

  const closeEditor = () => {
    if (!saving) setOpen(false);
  };

  const save = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (saving) return;
    setSaving(true);
    setError('');
    setSavedMessage('');

    try {
      const response = await fetch('/api/participant/profile', {
        method: 'PATCH',
        credentials: 'same-origin',
        cache: 'no-store',
        headers: {
          'Content-Type': 'application/json',
          Accept: 'application/json'
        },
        body: JSON.stringify(form)
      });
      const result = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(result.error || 'Could not save your profile.');

      await onSaved();
      setOpen(false);
      setSavedMessage('Your profile has been updated successfully.');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not save your profile.');
    } finally {
      setSaving(false);
    }
  };

  const inputClass = 'min-h-11 w-full rounded-xl border border-slate-200 bg-white px-3.5 py-2.5 text-sm text-slate-900 outline-none transition placeholder:text-slate-400 hover:border-slate-300 focus:border-blue-500 focus:ring-2 focus:ring-blue-100 disabled:cursor-not-allowed disabled:bg-slate-50';
  const labelClass = 'mb-1.5 block text-xs font-semibold text-slate-700';

  return (
    <>
      <button
        type="button"
        onClick={openEditor}
        className="inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm font-bold text-slate-700 shadow-sm transition hover:border-blue-200 hover:bg-blue-50 hover:text-blue-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2"
      >
        <Pencil className="h-4 w-4" />
        Edit My Profile
      </button>

      {savedMessage && (
        <p role="status" className="mt-1 flex items-center gap-1.5 text-xs font-medium text-emerald-700">
          <CheckCircle2 className="h-3.5 w-3.5" /> {savedMessage}
        </p>
      )}

      {open && (
        <div
          className="fixed inset-0 z-50 flex items-end justify-center overflow-y-auto overscroll-contain bg-slate-950/50 p-0 backdrop-blur-[2px] sm:items-center sm:p-4"
          onMouseDown={event => {
            if (event.target === event.currentTarget) closeEditor();
          }}
        >
          <form
            role="dialog"
            aria-modal="true"
            aria-labelledby="participant-profile-title"
            onSubmit={save}
            className="flex max-h-[96dvh] w-full max-w-2xl flex-col overflow-hidden rounded-t-3xl border border-slate-200 bg-white shadow-2xl sm:max-h-[92dvh] sm:rounded-2xl"
          >
            <header className="flex shrink-0 items-start justify-between gap-4 border-b border-slate-100 px-4 py-4 sm:px-6 sm:py-5">
              <div className="min-w-0">
                <div className="mb-1 inline-flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-[0.16em] text-blue-700">
                  <Pencil className="h-3 w-3" /> Profile settings
                </div>
                <h2 id="participant-profile-title" className="text-lg font-extrabold tracking-tight text-slate-950 sm:text-xl">
                  Edit My Profile
                </h2>
                <p className="mt-1 text-xs leading-5 text-slate-500">
                  Update only the six personal details listed below.
                </p>
              </div>
              <button
                type="button"
                onClick={closeEditor}
                disabled={saving}
                aria-label="Close profile editor"
                className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl text-slate-500 transition hover:bg-slate-100 hover:text-slate-900 disabled:opacity-40"
              >
                <X className="h-5 w-5" />
              </button>
            </header>

            <div className="min-h-0 flex-1 space-y-4 overflow-y-auto overscroll-contain px-4 py-5 sm:px-6 sm:py-6">
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <label className="block">
                  <span className={labelClass}>Full Student Name <span className="text-red-500">*</span></span>
                  <input
                    required
                    maxLength={120}
                    autoComplete="name"
                    value={form.name}
                    onChange={event => setForm(current => ({ ...current, name: event.target.value }))}
                    className={inputClass}
                    placeholder="Enter your full name"
                  />
                </label>
                <label className="block">
                  <span className={labelClass}>Class / Grade</span>
                  <input
                    maxLength={40}
                    value={form.classGrade}
                    onChange={event => setForm(current => ({ ...current, classGrade: event.target.value }))}
                    className={inputClass}
                    placeholder="e.g. Grade 12"
                  />
                </label>
                <label className="block">
                  <span className={labelClass}>Email</span>
                  <input
                    type="email"
                    maxLength={254}
                    autoComplete="email"
                    value={form.email}
                    onChange={event => setForm(current => ({ ...current, email: event.target.value }))}
                    className={inputClass}
                    placeholder="name@example.com"
                  />
                </label>
                <label className="block">
                  <span className={labelClass}>Contact Phone</span>
                  <input
                    type="tel"
                    maxLength={25}
                    autoComplete="tel"
                    value={form.phone}
                    onChange={event => setForm(current => ({ ...current, phone: event.target.value }))}
                    className={inputClass}
                    placeholder="+91"
                  />
                </label>
              </div>

              <label className="block">
                <span className={labelClass}>Participant Photo URL</span>
                <input
                  type="url"
                  maxLength={2048}
                  autoComplete="url"
                  value={form.photoUrl}
                  onChange={event => setForm(current => ({ ...current, photoUrl: event.target.value }))}
                  className={inputClass}
                  placeholder="https://…"
                />
                <span className="mt-1.5 block text-[11px] leading-4 text-slate-500">
                  Use a direct HTTP or HTTPS image link. The Digital ID will use this photo.
                </span>
              </label>

              <label className="block">
                <span className={labelClass}>Stage / Accommodation Remarks</span>
                <textarea
                  rows={4}
                  maxLength={1000}
                  value={form.remarks}
                  onChange={event => setForm(current => ({ ...current, remarks: event.target.value }))}
                  className="w-full resize-y rounded-xl border border-slate-200 bg-white px-3.5 py-3 text-sm text-slate-900 outline-none transition placeholder:text-slate-400 hover:border-slate-300 focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
                  placeholder="Add any relevant stage or accommodation information"
                />
                <span className="mt-1 block text-right text-[10px] tabular-nums text-slate-400">{form.remarks.length}/1000</span>
              </label>

              <div className="flex items-start gap-2.5 rounded-xl border border-slate-200 bg-slate-50 px-3.5 py-3">
                <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-slate-500" />
                <p className="text-[11px] leading-5 text-slate-600">
                  Bib number, date of birth, team, category, ID status, registrations and results are protected and cannot be edited here.
                </p>
              </div>

              {error && (
                <p role="alert" className="flex items-start gap-2 rounded-xl border border-red-200 bg-red-50 px-3.5 py-3 text-xs leading-5 text-red-700">
                  <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" /> {error}
                </p>
              )}
            </div>

            <footer className="flex shrink-0 flex-col-reverse gap-2 border-t border-slate-100 bg-slate-50 px-4 py-3.5 sm:flex-row sm:justify-end sm:px-6 sm:py-4">
              <button
                type="button"
                onClick={closeEditor}
                disabled={saving}
                className="min-h-11 w-full rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 transition hover:bg-slate-100 disabled:opacity-50 sm:w-auto"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={saving}
                className="inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-xl bg-blue-600 px-5 py-2.5 text-sm font-bold text-white shadow-sm transition hover:bg-blue-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2 disabled:cursor-wait disabled:opacity-60 sm:w-auto"
              >
                {saving ? <LoaderCircle className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                {saving ? 'Saving…' : 'Save Changes'}
              </button>
            </footer>
          </form>
        </div>
      )}
    </>
  );
}
