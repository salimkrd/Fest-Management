'use client';
import React, { useState } from 'react';
import { Pencil, Save, X } from 'lucide-react';

type Props = {
  profile: { name?: string; classGrade?: string; email?: string; phone?: string; photoUrl?: string; remarks?: string };
  onSaved: () => Promise<void>;
};

export function ParticipantProfileEditor({ profile, onSaved }: Props) {
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [form, setForm] = useState({
    name: profile.name || '', classGrade: profile.classGrade || '',
    email: profile.email || '', phone: profile.phone || '',
    photoUrl: profile.photoUrl || '', remarks: profile.remarks || ''
  });
  const openEditor = () => {
    setForm({ name: profile.name || '', classGrade: profile.classGrade || '', email: profile.email || '', phone: profile.phone || '', photoUrl: profile.photoUrl || '', remarks: profile.remarks || '' });
    setError('');
    setOpen(true);
  };
  const save = async (e: React.FormEvent) => {
    e.preventDefault(); setSaving(true); setError('');
    try {
      const res = await fetch('/api/participant/profile', { method: 'PATCH', credentials: 'same-origin', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(form), cache: 'no-store' });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(json.error || 'Could not save profile.');
      await onSaved(); setOpen(false);
    } catch (err) { setError(err instanceof Error ? err.message : 'Could not save profile.'); }
    finally { setSaving(false); }
  };
  const field = (key: keyof typeof form, label: string, type = 'text', required = false) => (
    <label className="block">
      <span className="block text-xs font-bold text-[#334155] mb-2">{label}</span>
      <input type={type} required={required} value={form[key]} onChange={e => setForm(v => ({ ...v, [key]: e.target.value }))} className="w-full rounded-lg border border-[#CBD5E1] px-3 py-2.5 text-sm text-[#111827]" />
    </label>
  );
  return <>
    <button type="button" onClick={openEditor} className="inline-flex items-center justify-center gap-2 border border-[#CBD5E1] rounded-xl px-5 py-3 text-sm font-bold"><Pencil className="w-4 h-4" /> Edit My Profile</button>
    {open && <div className="fixed inset-0 z-50 bg-slate-950/50 flex items-center justify-center p-4 overflow-y-auto">
      <form onSubmit={save} className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[92vh] overflow-y-auto">
        <header className="sticky top-0 bg-white border-b p-5 flex justify-between items-center"><div><h2 className="font-extrabold text-lg">Edit My Profile</h2><p className="text-xs text-slate-500">Only these six details can be changed.</p></div><button type="button" onClick={() => setOpen(false)} aria-label="Close"><X /></button></header>
        <div className="p-6 grid sm:grid-cols-2 gap-4">
          {field('name', 'Full Student Name', 'text', true)}
          {field('classGrade', 'Class / Grade')}
          {field('email', 'Email', 'email')}
          {field('phone', 'Contact Phone', 'tel')}
          <div className="sm:col-span-2">{field('photoUrl', 'Participant Photo URL', 'url')}</div>
          <label className="sm:col-span-2 block"><span className="block text-xs font-bold mb-2">Stage / Accommodation Remarks</span><textarea rows={4} maxLength={1000} value={form.remarks} onChange={e => setForm(v => ({ ...v, remarks: e.target.value }))} className="w-full rounded-lg border px-3 py-2.5 text-sm" /></label>
          <p className="sm:col-span-2 text-xs text-slate-500">Bib, Date of Birth, Team, Category, ID status, registrations and results cannot be edited.</p>
          {error && <p role="alert" className="sm:col-span-2 text-sm text-red-700">{error}</p>}
        </div>
        <footer className="sticky bottom-0 bg-white border-t p-4 flex justify-end gap-2"><button type="button" onClick={() => setOpen(false)} className="border rounded-lg px-4 py-2">Cancel</button><button type="submit" disabled={saving} className="bg-blue-600 text-white rounded-lg px-4 py-2 inline-flex gap-2 items-center"><Save className="w-4 h-4" />{saving ? 'Saving...' : 'Save Changes'}</button></footer>
      </form>
    </div>}
  </>;
}
