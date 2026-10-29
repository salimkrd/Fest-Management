'use client';

import React, { useState } from 'react';
import { AdminLayout } from '@/components/layout/AdminLayout';
import { useFest } from '@/context/FestContext';
import { Competition, CompetitionType, CompetitionStatus, CompetitionPerformanceMode } from '@/types/fest';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Select } from '@/components/ui/Select';
import { Badge } from '@/components/ui/Badge';
import { Modal } from '@/components/ui/Modal';
import { Plus, Search, Edit2, Trash2, Trophy, MapPin, Calendar, Clock, Users, AlertCircle } from 'lucide-react';

export default function CompetitionsPage() {
  const { competitions, categories, stages, registrations, results, markEntries, addCompetition, updateCompetition, deleteCompetition } = useFest();

  const [search, setSearch] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('ALL');
  const [typeFilter, setTypeFilter] = useState('ALL');
  const [performanceFilter, setPerformanceFilter] = useState('ALL');
  const [modalOpen, setModalOpen] = useState(false);
  const [editingComp, setEditingComp] = useState<Competition | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  // Form State
  const [name, setName] = useState('');
  const [code, setCode] = useState('');
  const [categoryId, setCategoryId] = useState(categories[0]?.id || '');
  const [type, setType] = useState<CompetitionType>('SOLO');
  const [performanceMode, setPerformanceMode] = useState<CompetitionPerformanceMode | ''>('STAGE');
  const [groupSize, setGroupSize] = useState(2);
  const [stageId, setStageId] = useState(stages[0]?.id || '');
  const [date, setDate] = useState('2025-11-15');
  const [timeSlot, setTimeSlot] = useState('09:30 AM - 11:00 AM');
  const [durationMinutes, setDurationMinutes] = useState(90);
  const [maxEntriesPerTeam, setMaxEntriesPerTeam] = useState(2);
  const [status, setStatus] = useState<CompetitionStatus>('SCHEDULED');
  const [error, setError] = useState('');

  // Judge assignments are managed through Mark Entry (judgeAssignments collection).
  // Do not display stale legacy names from Competition.assignedJudges.
  const getAssignedJudgeNames = (competitionId: string) => {
    const seen = new Set<string>();
    return markEntries
      .filter(entry => entry.competitionId === competitionId && !entry.revoked && entry.status !== 'REVOKED')
      .map(entry => entry.judgeName?.trim() || '')
      .filter(judgeName => {
        const key = judgeName.toLocaleLowerCase();
        if (!key || seen.has(key)) return false;
        seen.add(key);
        return true;
      });
  };

  const filteredCompetitions = competitions.filter(comp => {
    const matchesSearch = comp.name.toLowerCase().includes(search.toLowerCase()) ||
                          comp.code.toLowerCase().includes(search.toLowerCase());
    const matchesCat = categoryFilter === 'ALL' || comp.categoryId === categoryFilter;
    const matchesType = typeFilter === 'ALL' || comp.type === typeFilter;
    const matchesPerformance = performanceFilter === 'ALL' || (performanceFilter === 'UNCLASSIFIED' ? !comp.performanceMode : comp.performanceMode === performanceFilter);
    return matchesSearch && matchesCat && matchesType && matchesPerformance;
  });

  const handleOpenAdd = () => {
    setEditingComp(null);
    setName('');
    setCode('CMP-' + (competitions.length + 1).toString().padStart(2, '0'));
    setCategoryId(categories[0]?.id || '');
    setType('SOLO');
    setPerformanceMode('STAGE');
    setGroupSize(2);
    setStageId(stages[0]?.id || '');
    setDate('2025-11-15');
    setTimeSlot('10:00 AM - 11:30 AM');
    setDurationMinutes(90);
    setMaxEntriesPerTeam(2);
    setStatus('SCHEDULED');
    setError('');
    setModalOpen(true);
  };

  const handleOpenEdit = (comp: Competition) => {
    setEditingComp(comp);
    setName(comp.name);
    setCode(comp.code);
    setCategoryId(comp.categoryId);
    setType(comp.type);
    setPerformanceMode(comp.performanceMode || '');
    setGroupSize(comp.groupSize || 2);
    setStageId(comp.stageId);
    setDate(comp.date);
    setTimeSlot(comp.timeSlot);
    setDurationMinutes(comp.durationMinutes);
    setMaxEntriesPerTeam(comp.maxEntriesPerTeam);
    setStatus(comp.status);
    setError('');
    setModalOpen(true);
  };

  const [saving, setSaving] = useState(false);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (!name || !code) {
      setError('Please provide competition name and code.');
      return;
    }

    const category = categories.find(c => c.id === categoryId);
    if (!category) {
      setError('Please select a valid category. You must create at least one category before adding competitions.');
      return;
    }
    if (editingComp && type !== editingComp.type && (
      registrations.some(r => r.competitionId === editingComp.id) || results.some(r => r.competitionId === editingComp.id)
    )) {
      setError('Competition format cannot be changed after registrations or results exist.');
      return;
    }
    if (!performanceMode) {
      setError('Select Stage or Off Stage before saving the competition.');
      return;
    }
    if (type === 'GROUP' && (!Number.isInteger(groupSize) || groupSize < 2)) {
      setError('Group members per entry must be at least 2.');
      return;
    }
    const stage = stages.find(s => s.id === stageId);

    const compData = {
      name,
      code: code.toUpperCase(),
      categoryId: category.id,
      categoryName: category.name,
      type,
      performanceMode,
      groupSize: type === 'GROUP' ? groupSize : 1,
      stageId,
      stageName: stage?.name || 'Main Auditorium',
      date,
      timeSlot,
      durationMinutes: Number(durationMinutes),
      maxEntriesPerTeam: Number(maxEntriesPerTeam),
      assignedJudges: editingComp ? editingComp.assignedJudges : ['Prof. David Miller'],
      status,
      criteria: editingComp ? editingComp.criteria : [
        { id: 'cr-1', name: 'Subject Mastery & Accuracy', maxMarks: 35 },
        { id: 'cr-2', name: 'Artistic Delivery & Articulation', maxMarks: 35 },
        { id: 'cr-3', name: 'Overall Impression & Timing', maxMarks: 30 }
      ]
    };

    setSaving(true);
    try {
      if (editingComp) {
        await updateCompetition(editingComp.id, compData);
      } else {
        await addCompetition(compData);
      }
      setModalOpen(false);
    } catch (err: any) {
      setError(err?.message || 'Failed to save competition.');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: string, name: string) => {
    if (confirm(`Are you sure you want to delete competition "${name}"?`)) {
      setActionError(null);
      setDeletingId(id);
      try {
        await deleteCompetition(id);
      } catch (err: any) {
        setActionError(err?.message || 'Failed to delete competition.');
      } finally {
        setDeletingId(null);
      }
    }
  };

  const getStatusBadge = (st: CompetitionStatus) => {
    switch (st) {
      case 'PUBLISHED':
        return <Badge variant="success" size="sm">PUBLISHED</Badge>;
      case 'MARKS_ENTERED':
        return <Badge variant="info" size="sm">MARKS ENTERED</Badge>;
      case 'IN_PROGRESS':
        return <Badge variant="warning" size="sm">IN PROGRESS</Badge>;
      case 'SCHEDULED':
      default:
        return <Badge variant="default" size="sm">SCHEDULED</Badge>;
    }
  };

  return (
    <AdminLayout>
      <div className="w-full max-w-[1600px] space-y-6 lg:space-y-8">
        {/* Header */}
        <div className="flex flex-col gap-4 border-b border-slate-200 pb-5 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <h1 className="text-2xl font-bold tracking-tight text-slate-950 sm:text-3xl">
              Competition Directory
            </h1>
            <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-500">
              Configure festival artistic, literary, and stage events with judging criteria
            </p>
          </div>
          <Button
            variant="primary"
            size="md"
            leftIcon={<Plus className="w-4 h-4" />}
            onClick={handleOpenAdd}
          >
            Create Competition
          </Button>
        </div>

        {/* Action Error Banner */}
        {actionError && (
          <div className="flex items-start justify-between gap-3 rounded-xl border border-red-200 bg-red-50 px-4 py-3.5 text-sm text-red-700">
            <div className="flex items-center gap-2">
              <AlertCircle className="w-4 h-4 text-red-500 shrink-0" />
              <span>{actionError}</span>
            </div>
            <button onClick={() => setActionError(null)} className="text-red-500 hover:text-red-700 font-bold ml-4">
              ✕
            </button>
          </div>
        )}

        {/* Filter bar */}
        <div className="flex flex-col gap-4 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:p-5 xl:flex-row xl:items-center xl:justify-between">
          <div className="relative w-full flex-1 xl:max-w-md">
            <Search className="w-4 h-4 text-[#526070] absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
            <input
              type="text"
              placeholder="Search competition code or title..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full rounded-xl border border-slate-200 bg-slate-50 py-2.5 pl-10 pr-4 text-sm text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-blue-500 focus:bg-white focus:ring-4 focus:ring-blue-500/10"
            />
          </div>

          <div className="grid w-full grid-cols-1 gap-2 sm:grid-cols-2 xl:flex xl:w-auto xl:flex-wrap">
            <select
              aria-label="Filter by Category"
              value={categoryFilter}
              onChange={(e) => setCategoryFilter(e.target.value)}
              className="min-w-0 w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm font-medium text-slate-700 outline-none transition focus:border-blue-500 focus:bg-white focus:ring-4 focus:ring-blue-500/10 xl:min-w-[150px]"
            >
              <option value="ALL">All Categories</option>
              {categories.map(c => (
                <option key={c.id} value={c.id}>{c.name}</option>
              ))}
            </select>

            <select
              aria-label="Filter by Competition Type"
              value={typeFilter}
              onChange={(e) => setTypeFilter(e.target.value)}
              className="min-w-0 w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm font-medium text-slate-700 outline-none transition focus:border-blue-500 focus:bg-white focus:ring-4 focus:ring-blue-500/10 xl:min-w-[150px]"
            >
              <option value="ALL">All Types</option>
              <option value="SOLO">Solo Contests</option>
              <option value="GROUP">Group Contests</option>
            </select>
            <select
              aria-label="Filter by Performance Mode"
              value={performanceFilter}
              onChange={(e) => setPerformanceFilter(e.target.value)}
              className="min-w-0 w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm font-medium text-slate-700 outline-none transition focus:border-blue-500 focus:bg-white focus:ring-4 focus:ring-blue-500/10 xl:min-w-[150px]"
            >
              <option value="ALL">All Performance Modes</option>
              <option value="STAGE">Stage</option>
              <option value="OFF_STAGE">Off Stage</option>
              <option value="UNCLASSIFIED">Unclassified</option>
            </select>
          </div>
        </div>

        {/* Competitions Table */}
        <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
          <div className="flex flex-col gap-1 border-b border-slate-200 px-4 py-4 sm:flex-row sm:items-center sm:justify-between sm:px-5">
            <h3 className="text-base font-semibold text-slate-900">Competitions</h3>
            <span className="text-sm text-slate-500">Showing <span className="font-semibold tabular-nums text-slate-700">{filteredCompetitions.length}</span> of {competitions.length} events</span>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full min-w-[1180px] text-left text-sm">
              <thead>
                <tr className="border-b border-slate-200 bg-slate-50 text-[11px] font-semibold uppercase tracking-wider text-slate-500">
                  <th className="px-4 py-3.5">Code &amp; Title</th>
                  <th className="px-4 py-3.5">Category</th>
                  <th className="px-4 py-3.5 text-center">Type</th>
                  <th className="px-4 py-3.5 text-center">Performance</th>
                  <th className="px-4 py-3.5 text-center">Group Size</th>
                  <th className="px-4 py-3.5 text-center">Entries</th>
                  <th className="px-4 py-3.5">Stage Assignment</th>
                  <th className="px-4 py-3.5">Assigned Judges</th>
                  <th className="px-4 py-3.5 text-center">Status</th>
                  <th className="py-3 px-6 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#E1E7EF]">
                {filteredCompetitions.length === 0 ? (
                  <tr>
                    <td colSpan={10} className="px-6 py-16 text-center text-sm text-slate-500">
                      <div className="flex flex-col items-center justify-center gap-3">
                        <Trophy className="w-8 h-8 text-[#94A3B8]" />
                        <p className="font-semibold text-sm text-[#111111]">
                          {competitions.length === 0 ? 'No competitions configured' : 'No competitions found'}
                        </p>
                        <p className="text-xs text-[#526070]">
                          {competitions.length === 0
                            ? "Use 'Create Competition' to configure competitions."
                            : 'No competitions match your filter criteria.'}
                        </p>
                      </div>
                    </td>
                  </tr>
                ) : (
                  filteredCompetitions.map((comp) => (
                    <tr key={comp.id} className="transition-colors hover:bg-slate-50/80">
                      <td className="px-4 py-4">
                        <div className="flex items-center gap-2.5">
                          <span className="font-mono text-xs font-bold text-[#2563EB] bg-blue-50 px-2 py-0.5 rounded border border-blue-100">
                            {comp.code}
                          </span>
                          <span className="font-bold text-[#111111] text-sm">{comp.name}</span>
                        </div>
                      </td>
                      <td className="px-4 py-4 font-medium text-slate-700">
                        {comp.categoryName}
                      </td>
                      <td className="px-4 py-4 text-center">
                        <span className={`text-[11px] font-bold px-2 py-0.5 rounded ${comp.type === 'SOLO' ? 'bg-slate-100 text-slate-800' : 'bg-purple-100 text-purple-800'}`}>
                          {comp.type}
                        </span>
                      </td>
                      <td className="px-4 py-4 text-center font-medium text-slate-600">{comp.performanceMode === 'STAGE' ? 'Stage' : comp.performanceMode === 'OFF_STAGE' ? 'Off Stage' : 'Unclassified'}</td>
                      <td className="px-4 py-4 text-center font-medium text-slate-700">{comp.type === 'GROUP' ? (comp.groupSize || 'Not set') : '—'}</td>
                      <td className="px-4 py-4 text-center font-semibold tabular-nums text-slate-900">
                        {comp.entriesCount}
                      </td>
                      <td className="px-4 py-4 text-slate-600">
                        <div className="flex items-center gap-1.5">
                          <MapPin className="w-3.5 h-3.5 text-[#526070] shrink-0" />
                          <span className="truncate max-w-[150px]">{comp.stageName}</span>
                        </div>
                      </td>
                      <td className="px-4 py-4 text-slate-600">
                        {getAssignedJudgeNames(comp.id).length > 0 ? getAssignedJudgeNames(comp.id).join(', ') : 'Pending Assignment'}
                      </td>
                      <td className="px-4 py-4 text-center">
                        {getStatusBadge(comp.status)}
                      </td>
                      <td className="px-4 py-4 text-right">
                        <div className="flex items-center justify-end gap-1.5">
                          <button
                            type="button"
                            onClick={() => handleOpenEdit(comp)}
                            className="rounded-lg p-2 text-slate-500 transition-colors hover:bg-blue-50 hover:text-blue-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
                            title="Edit Competition"
                          >
                            <Edit2 className="w-4 h-4" />
                          </button>
                          <button
                            type="button"
                            onClick={() => handleDelete(comp.id, comp.name)}
                            className="rounded-lg p-2 text-slate-500 transition-colors hover:bg-red-50 hover:text-red-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-500"
                            title="Delete Competition"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* Add/Edit Modal */}
        <Modal
          isOpen={modalOpen}
          onClose={() => setModalOpen(false)}
          title={editingComp ? `Edit Competition (${editingComp.name})` : 'Create New Competition'}
          description="Define event rules, stage location, duration, and maximum registration quotas"
          maxWidth="xl"
          footer={
            <div className="flex w-full flex-col-reverse gap-2 sm:flex-row sm:justify-end">
              <Button variant="outline" size="md" onClick={() => setModalOpen(false)}>
                Cancel
              </Button>
              <Button variant="primary" size="md" onClick={handleSave} disabled={saving}>
                {editingComp ? 'Update Competition' : 'Save Competition'}
              </Button>
            </div>
          }
        >
          <form onSubmit={handleSave} className="space-y-6">
            {error && (
              <div role="alert" className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-medium leading-5 text-red-700">{error}</div>
            )}

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-3 sm:gap-5">
              <div className="sm:col-span-2">
                <Input
                  label="Competition Name"
                  placeholder="e.g. Extempore Speech (English)"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  required
                />
              </div>
              <Input
                label="Event Code"
                placeholder="e.g. CMP-01"
                value={code}
                onChange={(e) => setCode(e.target.value)}
                required
              />
            </div>

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 sm:gap-5">
              <Select
                label="Category Division"
                value={categoryId}
                onChange={(e) => setCategoryId(e.target.value)}
                options={categories.map(c => ({ value: c.id, label: c.name }))}
              />
              <Select
                label="Competition Format"
                value={type}
                onChange={(e) => setType(e.target.value as CompetitionType)}
                options={[
                  { value: 'SOLO', label: 'Solo Contest (Individual)' },
                  { value: 'GROUP', label: 'Group Ensemble (Team Item)' }
                ]}
              />
            </div>

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 sm:gap-5">
              <Select
                label="Performance Mode"
                value={performanceMode}
                onChange={(e) => setPerformanceMode(e.target.value as CompetitionPerformanceMode)}
                options={[{ value: '', label: 'Select classification' }, { value: 'STAGE', label: 'Stage' }, { value: 'OFF_STAGE', label: 'Off Stage' }]}
              />
              {type === 'GROUP' && (
                <Input label="Members Per Group" type="number" min={2} value={groupSize} onChange={(e) => setGroupSize(Number(e.target.value))} />
              )}
            </div>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 sm:gap-5">
              <Select
                label="Assigned Stage Venue"
                value={stageId}
                onChange={(e) => setStageId(e.target.value)}
                options={stages.map(s => ({ value: s.id, label: s.name }))}
              />
              {type === 'SOLO' ? <Input
                label="Max Registrations / Team"
                type="number"
                min={1}
                max={5}
                value={maxEntriesPerTeam}
                onChange={(e) => setMaxEntriesPerTeam(Number(e.target.value))}
              /> : <p className="self-center rounded-xl bg-slate-50 px-3 py-3 text-sm leading-5 text-slate-600 sm:col-span-2">Unlimited groups per team. Register each group using its leader.</p>}
            </div>

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-3 sm:gap-5">
              <Input
                label="Competition Date"
                type="date"
                value={date}
                onChange={(e) => setDate(e.target.value)}
              />
              <div className="sm:col-span-2">
                <Input
                  label="Time Slot Window"
                  placeholder="09:30 AM - 11:00 AM"
                  value={timeSlot}
                  onChange={(e) => setTimeSlot(e.target.value)}
                />
              </div>
            </div>

            <Select
              label="Evaluation State"
              value={status}
              onChange={(e) => setStatus(e.target.value as CompetitionStatus)}
              options={[
                { value: 'SCHEDULED', label: 'Scheduled (Awaiting start)' },
                { value: 'IN_PROGRESS', label: 'In Progress (Active on Stage)' },
                { value: 'MARKS_ENTERED', label: 'Marks Entered (Ready for Review)' },
                { value: 'PUBLISHED', label: 'Published (Officially Approved)' }
              ]}
            />
          </form>
        </Modal>
      </div>
    </AdminLayout>
  );
}