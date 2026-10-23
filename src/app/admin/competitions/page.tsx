'use client';

import React, { useState } from 'react';
import { AdminLayout } from '@/components/layout/AdminLayout';
import { useFest } from '@/context/FestContext';
import { Competition, CompetitionType, CompetitionStatus } from '@/types/fest';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Select } from '@/components/ui/Select';
import { Badge } from '@/components/ui/Badge';
import { Modal } from '@/components/ui/Modal';
import { Plus, Search, Edit2, Trash2, Trophy, MapPin, Calendar, Clock, Users } from 'lucide-react';

export default function CompetitionsPage() {
  const { competitions, categories, stages, addCompetition, updateCompetition, deleteCompetition } = useFest();

  const [search, setSearch] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('ALL');
  const [typeFilter, setTypeFilter] = useState('ALL');
  const [modalOpen, setModalOpen] = useState(false);
  const [editingComp, setEditingComp] = useState<Competition | null>(null);

  // Form State
  const [name, setName] = useState('');
  const [code, setCode] = useState('');
  const [categoryId, setCategoryId] = useState(categories[0]?.id || '');
  const [type, setType] = useState<CompetitionType>('SOLO');
  const [stageId, setStageId] = useState(stages[0]?.id || '');
  const [date, setDate] = useState('2025-11-15');
  const [timeSlot, setTimeSlot] = useState('09:30 AM - 11:00 AM');
  const [durationMinutes, setDurationMinutes] = useState(90);
  const [maxEntriesPerTeam, setMaxEntriesPerTeam] = useState(2);
  const [status, setStatus] = useState<CompetitionStatus>('SCHEDULED');
  const [error, setError] = useState('');

  const filteredCompetitions = competitions.filter(comp => {
    const matchesSearch = comp.name.toLowerCase().includes(search.toLowerCase()) ||
                          comp.code.toLowerCase().includes(search.toLowerCase());
    const matchesCat = categoryFilter === 'ALL' || comp.categoryId === categoryFilter;
    const matchesType = typeFilter === 'ALL' || comp.type === typeFilter;
    return matchesSearch && matchesCat && matchesType;
  });

  const handleOpenAdd = () => {
    setEditingComp(null);
    setName('');
    setCode('CMP-' + (competitions.length + 1).toString().padStart(2, '0'));
    setCategoryId(categories[0]?.id || '');
    setType('SOLO');
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
    setStageId(comp.stageId);
    setDate(comp.date);
    setTimeSlot(comp.timeSlot);
    setDurationMinutes(comp.durationMinutes);
    setMaxEntriesPerTeam(comp.maxEntriesPerTeam);
    setStatus(comp.status);
    setError('');
    setModalOpen(true);
  };

  const handleSave = (e: React.FormEvent) => {
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
    const stage = stages.find(s => s.id === stageId);

    const compData = {
      name,
      code: code.toUpperCase(),
      categoryId: category.id,
      categoryName: category.name,
      type,
      stageId,
      stageName: stage?.name || 'Main Auditorium',
      date,
      timeSlot,
      durationMinutes: Number(durationMinutes),
      maxEntriesPerTeam: Number(maxEntriesPerTeam),
      assignedJudges: editingComp ? editingComp.assignedJudges : ['Prof. David Miller'],
      status,
      criteria: [
        { id: 'cr-1', name: 'Subject Mastery & Accuracy', maxMarks: 35 },
        { id: 'cr-2', name: 'Artistic Delivery & Articulation', maxMarks: 35 },
        { id: 'cr-3', name: 'Overall Impression & Timing', maxMarks: 30 }
      ]
    };

    if (editingComp) {
      updateCompetition(editingComp.id, compData);
    } else {
      addCompetition(compData);
    }

    setModalOpen(false);
  };

  const handleDelete = (id: string, name: string) => {
    if (confirm(`Are you sure you want to delete competition "${name}"?`)) {
      deleteCompetition(id);
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
      <div className="space-y-6 max-w-6xl">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-2 border-b border-[#E1E7EF]">
          <div>
            <h1 className="text-xl sm:text-2xl font-bold text-[#111111] tracking-tight">
              Competition Directory
            </h1>
            <p className="text-xs text-[#526070] mt-1">
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

        {/* Filter bar */}
        <div className="bg-white p-4 rounded-xl border border-[#E1E7EF] flex flex-col md:flex-row items-center justify-between gap-4">
          <div className="relative flex-1 w-full md:max-w-md">
            <Search className="w-4 h-4 text-[#526070] absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
            <input
              type="text"
              placeholder="Search competition code or title..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full text-xs pl-9 pr-4 py-2 bg-[#F8FAFC] border border-[#E1E7EF] rounded-lg text-[#111111] focus:outline-none focus:bg-white focus:border-[#2563EB]"
            />
          </div>

          <div className="flex items-center gap-3 w-full md:w-auto">
            <select
              aria-label="Filter by Category"
              value={categoryFilter}
              onChange={(e) => setCategoryFilter(e.target.value)}
              className="text-xs font-semibold py-2 px-3 rounded-lg border border-[#E1E7EF] bg-[#F8FAFC] text-[#111111] focus:outline-none focus:bg-white"
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
              className="text-xs font-semibold py-2 px-3 rounded-lg border border-[#E1E7EF] bg-[#F8FAFC] text-[#111111] focus:outline-none focus:bg-white"
            >
              <option value="ALL">All Types</option>
              <option value="SOLO">Solo Contests</option>
              <option value="GROUP">Group Contests</option>
            </select>
          </div>
        </div>

        {/* Competitions Table */}
        <div className="bg-white rounded-xl border border-[#E1E7EF] shadow-xs overflow-hidden">
          <div className="px-6 py-4 border-b border-[#E1E7EF] flex items-center justify-between">
            <h3 className="text-sm font-bold text-[#111111]">Competitions Roster</h3>
            <span className="text-xs text-[#526070]">Showing {filteredCompetitions.length} Events</span>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="border-b border-[#E1E7EF] bg-[#F8FAFC] text-[#526070] font-bold uppercase text-[11px]">
                  <th className="py-3 px-6">Code &amp; Title</th>
                  <th className="py-3 px-6">Category</th>
                  <th className="py-3 px-6 text-center">Type</th>
                  <th className="py-3 px-6 text-center">Entries</th>
                  <th className="py-3 px-6">Stage Assignment</th>
                  <th className="py-3 px-6">Assigned Judges</th>
                  <th className="py-3 px-6 text-center">Status</th>
                  <th className="py-3 px-6 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#E1E7EF]">
                {filteredCompetitions.map((comp) => (
                  <tr key={comp.id} className="hover:bg-[#F8FAFC] transition-colors">
                    <td className="py-4 px-6">
                      <div className="flex items-center gap-2.5">
                        <span className="font-mono text-xs font-bold text-[#2563EB] bg-blue-50 px-2 py-0.5 rounded border border-blue-100">
                          {comp.code}
                        </span>
                        <span className="font-bold text-[#111111] text-sm">{comp.name}</span>
                      </div>
                    </td>
                    <td className="py-4 px-6 font-semibold text-[#111111]">
                      {comp.categoryName}
                    </td>
                    <td className="py-4 px-6 text-center">
                      <span className={`text-[11px] font-bold px-2 py-0.5 rounded ${comp.type === 'SOLO' ? 'bg-slate-100 text-slate-800' : 'bg-purple-100 text-purple-800'}`}>
                        {comp.type}
                      </span>
                    </td>
                    <td className="py-4 px-6 text-center font-bold text-[#111111]">
                      {comp.entriesCount}
                    </td>
                    <td className="py-4 px-6 text-[#526070]">
                      <div className="flex items-center gap-1.5">
                        <MapPin className="w-3.5 h-3.5 text-[#526070] shrink-0" />
                        <span className="truncate max-w-[150px]">{comp.stageName}</span>
                      </div>
                    </td>
                    <td className="py-4 px-6 text-[#526070]">
                      {comp.assignedJudges.length > 0 ? comp.assignedJudges.join(', ') : 'Pending Assignment'}
                    </td>
                    <td className="py-4 px-6 text-center">
                      {getStatusBadge(comp.status)}
                    </td>
                    <td className="py-4 px-6 text-right">
                      <div className="flex items-center justify-end gap-2">
                        <button
                          type="button"
                          onClick={() => handleOpenEdit(comp)}
                          className="p-1.5 rounded-lg text-[#526070] hover:text-[#2563EB] hover:bg-blue-50 transition-colors"
                          title="Edit Competition"
                        >
                          <Edit2 className="w-4 h-4" />
                        </button>
                        <button
                          type="button"
                          onClick={() => handleDelete(comp.id, comp.name)}
                          className="p-1.5 rounded-lg text-[#526070] hover:text-[#DC2626] hover:bg-red-50 transition-colors"
                          title="Delete Competition"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
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
          maxWidth="lg"
          footer={
            <div className="flex items-center justify-end gap-2 w-full">
              <Button variant="outline" size="sm" onClick={() => setModalOpen(false)}>
                Cancel
              </Button>
              <Button variant="primary" size="sm" onClick={handleSave}>
                {editingComp ? 'Update Competition' : 'Save Competition'}
              </Button>
            </div>
          }
        >
          <form onSubmit={handleSave} className="space-y-4">
            {error && (
              <p className="text-xs text-[#DC2626] font-semibold">{error}</p>
            )}

            <div className="grid grid-cols-3 gap-3">
              <div className="col-span-2">
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

            <div className="grid grid-cols-2 gap-3">
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

            <div className="grid grid-cols-2 gap-3">
              <Select
                label="Assigned Stage Venue"
                value={stageId}
                onChange={(e) => setStageId(e.target.value)}
                options={stages.map(s => ({ value: s.id, label: s.name }))}
              />
              <Input
                label="Max Registrations / Team"
                type="number"
                min={1}
                max={5}
                value={maxEntriesPerTeam}
                onChange={(e) => setMaxEntriesPerTeam(Number(e.target.value))}
              />
            </div>

            <div className="grid grid-cols-3 gap-3">
              <Input
                label="Competition Date"
                type="date"
                value={date}
                onChange={(e) => setDate(e.target.value)}
              />
              <div className="col-span-2">
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
