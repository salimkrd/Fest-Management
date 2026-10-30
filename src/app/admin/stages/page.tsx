'use client';

import React, { useMemo, useState } from 'react';
import { AdminLayout } from '@/components/layout/AdminLayout';
import { useFest } from '@/context/FestContext';
import { Stage } from '@/types/fest';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Select } from '@/components/ui/Select';
import { Badge } from '@/components/ui/Badge';
import { Modal } from '@/components/ui/Modal';
import {
  Plus, Edit2, Trash2, MapPin, Users, Radio, Phone, Music,
  Search, Building2, Activity, Wrench, Clock3, Wifi, WifiOff, AlertCircle,
  CalendarDays
} from 'lucide-react';

type AudioStatus = Stage['audioVisualStatus'];

export default function StagesPage() {
  const { stages, stagesSyncState, schedules, addStage, updateStage, deleteStage } = useFest();

  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<'ALL' | AudioStatus>('ALL');
  const [modalOpen, setModalOpen] = useState(false);
  const [editingStage, setEditingStage] = useState<Stage | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<Stage | null>(null);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [formError, setFormError] = useState('');
  const [pageError, setPageError] = useState('');

  const [name, setName] = useState('');
  const [code, setCode] = useState('');
  const [venue, setVenue] = useState('');
  const [capacity, setCapacity] = useState(500);
  const [managerName, setManagerName] = useState('');
  const [managerPhone, setManagerPhone] = useState('');
  const [audioVisualStatus, setAudioVisualStatus] = useState<AudioStatus>('OPERATIONAL');
  const [currentEvent, setCurrentEvent] = useState('');
  const [nextEvent, setNextEvent] = useState('');

  const stageCounts = useMemo(() => ({
    total: stages.length,
    operational: stages.filter(stage => stage.audioVisualStatus === 'OPERATIONAL').length,
    standby: stages.filter(stage => stage.audioVisualStatus === 'STANDBY').length,
    maintenance: stages.filter(stage => stage.audioVisualStatus === 'MAINTENANCE').length
  }), [stages]);

  const filteredStages = useMemo(() => {
    const term = search.trim().toLowerCase();
    return stages.filter(stage => {
      const matchesSearch = !term || [
        stage.name, stage.code, stage.venue, stage.managerName, stage.managerPhone,
        stage.currentEvent || '', stage.nextEvent || ''
      ].some(value => (value || '').toLowerCase().includes(term));
      const matchesStatus = statusFilter === 'ALL' || stage.audioVisualStatus === statusFilter;
      return matchesSearch && matchesStatus;
    }).sort((a, b) => a.name.localeCompare(b.name));
  }, [stages, search, statusFilter]);

  const scheduledUsageCount = (stageId: string) =>
    schedules.filter(slot => slot.stageId === stageId && slot.status !== 'COMPLETED').length;

  const getNextStageCode = () => {
    const used = new Set(stages.map(stage => stage.code.trim().toUpperCase()));
    let index = 1;
    while (used.has(`STG-${String(index).padStart(2, '0')}`)) index += 1;
    return `STG-${String(index).padStart(2, '0')}`;
  };

  const resetForm = () => {
    setEditingStage(null);
    setName('');
    setCode(getNextStageCode());
    setVenue('');
    setCapacity(500);
    setManagerName('');
    setManagerPhone('');
    setAudioVisualStatus('OPERATIONAL');
    setCurrentEvent('');
    setNextEvent('');
    setFormError('');
  };

  const handleOpenAdd = () => {
    setPageError('');
    resetForm();
    setModalOpen(true);
  };

  const handleOpenEdit = (stage: Stage) => {
    setPageError('');
    setEditingStage(stage);
    setName(stage.name || '');
    setCode(stage.code || '');
    setVenue(stage.venue || '');
    setCapacity(Number(stage.capacity) || 0);
    setManagerName(stage.managerName || '');
    setManagerPhone(stage.managerPhone || '');
    setAudioVisualStatus(stage.audioVisualStatus || 'OPERATIONAL');
    setCurrentEvent(stage.currentEvent || '');
    setNextEvent(stage.nextEvent || '');
    setFormError('');
    setModalOpen(true);
  };

  const handleSave = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setFormError('');
    setPageError('');

    const cleanName = name.trim();
    const cleanCode = code.trim().toUpperCase();
    const cleanVenue = venue.trim();
    const numericCapacity = Number(capacity);

    if (!cleanName || !cleanCode || !cleanVenue) {
      setFormError('Stage name, stage code and campus location are required.');
      return;
    }
    if (!/^[A-Z0-9-]{2,16}$/.test(cleanCode)) {
      setFormError('Use 2–16 letters, numbers or hyphens for the stage code.');
      return;
    }
    if (!Number.isSafeInteger(numericCapacity) || numericCapacity < 1) {
      setFormError('Audience capacity must be a whole number greater than zero.');
      return;
    }

    const duplicateCode = stages.some(stage =>
      stage.code.trim().toUpperCase() === cleanCode && stage.id !== editingStage?.id
    );
    if (duplicateCode) {
      setFormError(`Stage code "${cleanCode}" is already in use. Choose a unique code.`);
      return;
    }

    const stageData = {
      name: cleanName,
      code: cleanCode,
      venue: cleanVenue,
      capacity: numericCapacity,
      managerName: managerName.trim(),
      managerPhone: managerPhone.trim(),
      audioVisualStatus,
      currentEvent: currentEvent.trim(),
      nextEvent: nextEvent.trim()
    };

    setSaving(true);
    try {
      if (editingStage) {
        await updateStage(editingStage.id, stageData);
      } else {
        await addStage(stageData);
      }
      setModalOpen(false);
      setPageError('');
    } catch (error) {
      setFormError(error instanceof Error ? error.message : 'Failed to save the stage. Please try again.');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    const activeSlots = scheduledUsageCount(deleteTarget.id);
    if (activeSlots > 0) {
      setPageError(`"${deleteTarget.name}" is used by ${activeSlots} active schedule slot(s). Move or remove those schedule slots before deleting this stage.`);
      setDeleteTarget(null);
      return;
    }

    setDeleting(true);
    setPageError('');
    try {
      await deleteStage(deleteTarget.id);
      setDeleteTarget(null);
    } catch (error) {
      setPageError(error instanceof Error ? error.message : 'Failed to delete the stage. Please try again.');
    } finally {
      setDeleting(false);
    }
  };

  const getAudioBadge = (status: AudioStatus) => {
    switch (status) {
      case 'OPERATIONAL':
        return <Badge variant="success" size="sm" dot>Operational</Badge>;
      case 'STANDBY':
        return <Badge variant="warning" size="sm" dot>Standby</Badge>;
      case 'MAINTENANCE':
      default:
        return <Badge variant="error" size="sm" dot>Maintenance</Badge>;
    }
  };

  const syncLabel = stagesSyncState === 'ready' ? 'Live sync' :
    stagesSyncState === 'error' ? 'Sync issue' :
    stagesSyncState === 'idle' ? 'Offline' : 'Connecting';
  const syncClasses = stagesSyncState === 'ready' ? 'bg-emerald-50 text-emerald-700 border-emerald-200' :
    stagesSyncState === 'error' ? 'bg-red-50 text-red-700 border-red-200' :
    'bg-amber-50 text-amber-700 border-amber-200';

  return (
    <AdminLayout>
      <div className="mx-auto w-full min-w-0 max-w-[1440px] space-y-5 sm:space-y-6">
        {/* Page header */}
        <div className="flex flex-col gap-4 border-b border-slate-200 pb-5 sm:flex-row sm:items-center sm:justify-between">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="text-xl font-bold tracking-tight text-slate-950 sm:text-2xl">Stage Management</h1>
              <span className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[10px] font-semibold ${syncClasses}`}>
                {stagesSyncState === 'ready' ? <Wifi className="h-3 w-3" /> : stagesSyncState === 'error' ? <WifiOff className="h-3 w-3" /> : <Clock3 className="h-3 w-3" />}
                {syncLabel}
              </span>
            </div>
            <p className="mt-1.5 max-w-3xl text-xs leading-5 text-slate-500 sm:text-sm">
              Manage stage venues, A/V readiness, audience capacity and stage manager coordination.
            </p>
          </div>
          <Button variant="primary" size="md" className="w-full shrink-0 sm:w-auto" leftIcon={<Plus className="h-4 w-4" />} onClick={handleOpenAdd} disabled={stagesSyncState === 'error'}>
            Add Stage
          </Button>
        </div>

        {/* Overview */}
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 sm:gap-4">
          <div className="flex min-w-0 items-center justify-between rounded-2xl border border-slate-200 bg-white p-3.5 shadow-sm sm:p-4">
            <div className="min-w-0"><p className="text-[10px] font-semibold uppercase tracking-wide text-slate-500 sm:text-xs">Total stages</p><p className="mt-1 text-2xl font-bold tabular-nums text-slate-900">{stageCounts.total}</p></div>
            <div className="ml-2 flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-blue-50 text-blue-600 sm:h-10 sm:w-10"><Building2 className="h-5 w-5" /></div>
          </div>
          <div className="flex min-w-0 items-center justify-between rounded-2xl border border-emerald-200 bg-white p-3.5 shadow-sm sm:p-4">
            <div className="min-w-0"><p className="text-[10px] font-semibold uppercase tracking-wide text-emerald-700 sm:text-xs">Operational</p><p className="mt-1 text-2xl font-bold tabular-nums text-emerald-700">{stageCounts.operational}</p></div>
            <div className="ml-2 flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-emerald-50 text-emerald-600 sm:h-10 sm:w-10"><Activity className="h-5 w-5" /></div>
          </div>
          <div className="flex min-w-0 items-center justify-between rounded-2xl border border-amber-200 bg-white p-3.5 shadow-sm sm:p-4">
            <div className="min-w-0"><p className="text-[10px] font-semibold uppercase tracking-wide text-amber-700 sm:text-xs">Standby</p><p className="mt-1 text-2xl font-bold tabular-nums text-amber-700">{stageCounts.standby}</p></div>
            <div className="ml-2 flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-amber-50 text-amber-600 sm:h-10 sm:w-10"><Radio className="h-5 w-5" /></div>
          </div>
          <div className="flex min-w-0 items-center justify-between rounded-2xl border border-red-200 bg-white p-3.5 shadow-sm sm:p-4">
            <div className="min-w-0"><p className="text-[10px] font-semibold uppercase tracking-wide text-red-700 sm:text-xs">Maintenance</p><p className="mt-1 text-2xl font-bold tabular-nums text-red-700">{stageCounts.maintenance}</p></div>
            <div className="ml-2 flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-red-50 text-red-600 sm:h-10 sm:w-10"><Wrench className="h-5 w-5" /></div>
          </div>
        </div>

        {/* Search and filters */}
        <div className="flex flex-col gap-3 rounded-2xl border border-slate-200 bg-white p-3.5 shadow-sm sm:p-4 lg:flex-row lg:items-center lg:justify-between">
          <div className="relative w-full lg:max-w-xl lg:flex-1">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <input
              type="search"
              value={search}
              onChange={event => setSearch(event.target.value)}
              placeholder="Search stage, code, venue or manager..."
              aria-label="Search stages"
              className="min-h-11 w-full rounded-xl border border-slate-200 bg-slate-50 py-2.5 pl-10 pr-4 text-sm text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-blue-500 focus:bg-white focus:ring-4 focus:ring-blue-500/10"
            />
          </div>
          <div className="grid w-full grid-cols-1 gap-2 sm:grid-cols-2 lg:w-auto lg:min-w-[320px]">
            <Select
              aria-label="Filter by A/V status"
              value={statusFilter}
              onChange={event => setStatusFilter(event.target.value as typeof statusFilter)}
              options={[
                { value: 'ALL', label: 'All A/V statuses' },
                { value: 'OPERATIONAL', label: 'Operational' },
                { value: 'STANDBY', label: 'Standby' },
                { value: 'MAINTENANCE', label: 'Maintenance' }
              ]}
            />
            <Button variant="outline" size="md" className="w-full" onClick={() => { setSearch(''); setStatusFilter('ALL'); }}>
              Clear filters
            </Button>
          </div>
        </div>

        {pageError && (
          <div role="alert" className="flex items-start gap-2.5 rounded-xl border border-red-200 bg-red-50 p-3.5 text-sm text-red-800">
            <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
            <p className="min-w-0 flex-1 leading-5">{pageError}</p>
            <button type="button" onClick={() => setPageError('')} className="rounded-md p-1 text-red-700 hover:bg-red-100" aria-label="Dismiss error">×</button>
          </div>
        )}

        {stagesSyncState === 'error' && (
          <div role="alert" className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
            <p className="font-semibold">Stage data could not be synchronized.</p>
            <p className="mt-1 text-xs leading-5">The page may be showing out-of-date information. Check the Admin session and Firestore connection before making changes.</p>
          </div>
        )}

        {/* Stage cards */}
        {stagesSyncState === 'loading' && stages.length === 0 ? (
          <div className="rounded-2xl border border-slate-200 bg-white px-5 py-14 text-center shadow-sm">
            <div className="mx-auto mb-3 h-7 w-7 animate-spin rounded-full border-2 border-blue-600 border-t-transparent" />
            <p className="text-sm font-semibold text-slate-800">Loading stage venues…</p>
            <p className="mt-1 text-xs text-slate-500">Connecting to the live stages collection.</p>
          </div>
        ) : filteredStages.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-slate-300 bg-white px-5 py-14 text-center">
            <Building2 className="mx-auto mb-3 h-9 w-9 text-slate-300" />
            <h3 className="text-base font-semibold text-slate-900">{stages.length === 0 ? 'No stage venues yet' : 'No matching stages'}</h3>
            <p className="mx-auto mt-1 max-w-md text-sm leading-6 text-slate-500">{stages.length === 0 ? 'Add your first stage venue to start managing A/V readiness and event coordination.' : 'Try a different search term or clear the selected status filter.'}</p>
            {stages.length === 0 && <Button variant="primary" size="md" className="mt-4" leftIcon={<Plus className="h-4 w-4" />} onClick={handleOpenAdd}>Add first stage</Button>}
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-4 xl:grid-cols-2 sm:gap-5">
            {filteredStages.map(stage => {
              const activeSlots = scheduledUsageCount(stage.id);
              return (
                <article key={stage.id} className="flex min-w-0 flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm transition hover:border-slate-300 hover:shadow-md">
                  <div className="space-y-4 p-4 sm:p-5">
                    <div className="flex min-w-0 items-start justify-between gap-3">
                      <div className="flex min-w-0 items-center gap-3">
                        <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border border-blue-100 bg-blue-50 text-xs font-extrabold text-blue-700 sm:h-12 sm:w-12"><span className="break-all text-center">{stage.code}</span></div>
                        <div className="min-w-0">
                          <h3 className="break-words text-base font-bold text-slate-950">{stage.name}</h3>
                          <p className="mt-1 flex min-w-0 items-start gap-1.5 text-xs leading-5 text-slate-500"><MapPin className="mt-0.5 h-3.5 w-3.5 shrink-0" /><span className="break-words">{stage.venue}</span></p>
                        </div>
                      </div>
                      <div className="shrink-0">{getAudioBadge(stage.audioVisualStatus)}</div>
                    </div>

                    <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                      <div className="min-w-0 rounded-xl border border-slate-200 bg-slate-50 p-3">
                        <div className="flex items-center justify-between gap-2"><span className="text-[10px] font-bold uppercase tracking-wider text-blue-700">Currently on stage</span><span className="inline-flex items-center gap-1 text-[9px] font-bold text-red-600"><span className="h-1.5 w-1.5 animate-pulse rounded-full bg-red-500" />LIVE</span></div>
                        <p className="mt-1.5 break-words text-sm font-semibold text-slate-900">{stage.currentEvent || 'No contest currently on stage'}</p>
                      </div>
                      <div className="min-w-0 rounded-xl border border-slate-200 bg-slate-50 p-3">
                        <div className="flex items-center justify-between gap-2"><span className="text-[10px] font-bold uppercase tracking-wider text-slate-500">Up next</span><span className="text-[9px] font-bold text-slate-400">LINEUP</span></div>
                        <p className="mt-1.5 break-words text-sm font-semibold text-slate-900">{stage.nextEvent || 'Awaiting schedule queue'}</p>
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-3 border-t border-slate-100 pt-4">
                      <div className="min-w-0">
                        <span className="block text-[10px] font-semibold uppercase tracking-wide text-slate-500">Audience capacity</span>
                        <span className="mt-1 flex items-center gap-1.5 text-sm font-bold tabular-nums text-slate-900"><Users className="h-4 w-4 text-slate-400" />{stage.capacity.toLocaleString()} seats</span>
                      </div>
                      <div className="min-w-0">
                        <span className="block text-[10px] font-semibold uppercase tracking-wide text-slate-500">Active schedule slots</span>
                        <span className="mt-1 flex items-center gap-1.5 text-sm font-bold tabular-nums text-slate-900"><CalendarDays className="h-4 w-4 text-slate-400" />{activeSlots}</span>
                      </div>
                      <div className="min-w-0">
                        <span className="block text-[10px] font-semibold uppercase tracking-wide text-slate-500">Stage manager</span>
                        <span className="mt-1 block break-words text-sm font-semibold text-slate-800">{stage.managerName || 'Not assigned'}</span>
                      </div>
                      <div className="min-w-0">
                        <span className="block text-[10px] font-semibold uppercase tracking-wide text-slate-500">Contact</span>
                        <span className="mt-1 flex min-w-0 items-start gap-1.5 break-all text-xs font-medium text-slate-600">{stage.managerPhone ? <><Phone className="mt-0.5 h-3.5 w-3.5 shrink-0 text-slate-400" />{stage.managerPhone}</> : 'Not provided'}</span>
                      </div>
                    </div>
                  </div>

                  <div className="mt-auto flex flex-col gap-2 border-t border-slate-100 bg-slate-50/70 p-3 sm:flex-row sm:items-center sm:justify-between sm:px-4">
                    <span className="text-[10px] text-slate-500">{activeSlots > 0 ? `Used by ${activeSlots} active schedule slot(s)` : 'No active schedule dependencies'}</span>
                    <div className="grid grid-cols-2 gap-2 sm:flex sm:items-center">
                      <Button variant="outline" size="sm" className="w-full sm:w-auto" leftIcon={<Edit2 className="h-3.5 w-3.5" />} onClick={() => handleOpenEdit(stage)} disabled={stagesSyncState === 'error'}>Edit stage</Button>
                      <Button variant="ghost" size="sm" className="w-full text-red-600 hover:bg-red-50 hover:text-red-700 sm:w-auto" leftIcon={<Trash2 className="h-3.5 w-3.5" />} onClick={() => setDeleteTarget(stage)} disabled={stagesSyncState === 'error'}>Remove</Button>
                    </div>
                  </div>
                </article>
              );
            })}
          </div>
        )}

        {/* Add/Edit Stage Modal */}
        <Modal
          isOpen={modalOpen}
          onClose={() => !saving && setModalOpen(false)}
          title={editingStage ? 'Edit stage venue' : 'Add stage venue'}
          description="Configure the physical venue, capacity, A/V readiness and coordinator details."
          maxWidth="2xl"
          footer={
            <div className="grid w-full grid-cols-1 gap-2 sm:flex sm:items-center sm:justify-end">
              <Button type="button" variant="outline" size="md" className="w-full sm:w-auto" onClick={() => setModalOpen(false)} disabled={saving}>Cancel</Button>
              <Button type="submit" form="stage-venue-form" variant="primary" size="md" className="w-full sm:w-auto" isLoading={saving} disabled={saving}>
                {editingStage ? 'Save changes' : 'Create stage'}
              </Button>
            </div>
          }
        >
          <form id="stage-venue-form" onSubmit={handleSave} className="space-y-5">
            {formError && <div role="alert" className="rounded-lg border border-red-200 bg-red-50 px-3.5 py-3 text-xs leading-5 text-red-700">{formError}</div>}
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-[minmax(0,1fr)_150px]">
              <Input label="Stage name" placeholder="e.g. Main Auditorium" value={name} onChange={event => setName(event.target.value)} required />
              <Input label="Stage code" placeholder="STG-01" value={code} onChange={event => setCode(event.target.value.toUpperCase())} required />
            </div>
            <Input label="Campus location / building" placeholder="e.g. Central Academic Block, Floor 1" value={venue} onChange={event => setVenue(event.target.value)} required />
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <Input label="Audience capacity" type="number" value={capacity} onChange={event => setCapacity(Number(event.target.value))} required />
              <Select label="Audio / Visual status" value={audioVisualStatus} onChange={event => setAudioVisualStatus(event.target.value as AudioStatus)} options={[
                { value: 'OPERATIONAL', label: 'Operational — ready' },
                { value: 'STANDBY', label: 'Standby — pre-check' },
                { value: 'MAINTENANCE', label: 'Maintenance — offline' }
              ]} />
            </div>
            <div className="border-t border-slate-200 pt-4">
              <h4 className="mb-3 flex items-center gap-2 text-sm font-semibold text-slate-900"><Users className="h-4 w-4 text-slate-500" />Stage coordinator</h4>
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <Input label="Manager name" placeholder="Stage manager name" value={managerName} onChange={event => setManagerName(event.target.value)} />
                <Input label="Contact phone" type="tel" placeholder="+91 98472 00000" value={managerPhone} onChange={event => setManagerPhone(event.target.value)} />
              </div>
            </div>
            <div className="border-t border-slate-200 pt-4">
              <h4 className="mb-3 flex items-center gap-2 text-sm font-semibold text-slate-900"><Music className="h-4 w-4 text-slate-500" />Stage programme</h4>
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <Input label="Current event (optional)" placeholder="e.g. Extempore Speech" value={currentEvent} onChange={event => setCurrentEvent(event.target.value)} />
                <Input label="Next scheduled event (optional)" placeholder="e.g. Classical Recitation" value={nextEvent} onChange={event => setNextEvent(event.target.value)} />
              </div>
            </div>
            <p className="text-[11px] leading-5 text-slate-500">Stage code must be unique. Changes are saved to Firestore and shared with other connected devices.</p>
          </form>
        </Modal>

        {/* Remove Stage Confirmation */}
        <Modal
          isOpen={!!deleteTarget}
          onClose={() => !deleting && setDeleteTarget(null)}
          title="Remove stage venue?"
          description="This action removes the stage record from the shared festival setup."
          maxWidth="md"
          footer={
            <div className="grid w-full grid-cols-1 gap-2 sm:flex sm:justify-end">
              <Button variant="outline" size="md" className="w-full sm:w-auto" onClick={() => setDeleteTarget(null)} disabled={deleting}>Keep stage</Button>
              <Button variant="destructive" size="md" className="w-full sm:w-auto" onClick={() => void handleDelete()} isLoading={deleting} disabled={deleting || (deleteTarget ? scheduledUsageCount(deleteTarget.id) > 0 : false)}>Remove stage</Button>
            </div>
          }
        >
          {deleteTarget && (
            <div className="space-y-3">
              <div className="rounded-xl border border-red-200 bg-red-50 p-3.5">
                <p className="text-sm font-semibold text-red-900">{deleteTarget.name} <span className="font-mono text-xs text-red-700">({deleteTarget.code})</span></p>
                <p className="mt-1 text-xs text-red-800">{deleteTarget.venue}</p>
              </div>
              {scheduledUsageCount(deleteTarget.id) > 0 ? (
                <div className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-xs leading-5 text-amber-900">
                  This stage is assigned to {scheduledUsageCount(deleteTarget.id)} active schedule slot(s). Move or remove those slots first. The stage cannot be deleted while it is in use.
                </div>
              ) : (
                <p className="text-xs leading-5 text-slate-600">No active schedule slots use this stage. Removing it cannot affect the existing timetable.</p>
              )}
            </div>
          )}
        </Modal>
      </div>
    </AdminLayout>
  );
}
