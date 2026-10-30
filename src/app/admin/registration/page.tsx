'use client';

import React, { useState } from 'react';
import { AdminLayout } from '@/components/layout/AdminLayout';
import { useFest } from '@/context/FestContext';
import { isParticipantEligibleForCategory } from '@/domain/eligibility';
import { Registration } from '@/types/fest';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Select } from '@/components/ui/Select';
import { Badge } from '@/components/ui/Badge';
import { Modal } from '@/components/ui/Modal';
import { Plus, Search, Check, Trash2, ClipboardList, Filter } from 'lucide-react';

export default function RegistrationManagementPage() {
  const { registrations, teams, categories, competitions, participants, addRegistration, updateRegistrationStatus, deleteRegistration } = useFest();

  const [search, setSearch] = useState('');
  const [teamFilter, setTeamFilter] = useState('ALL');
  const [statusFilter, setStatusFilter] = useState('ALL');
  const [modalOpen, setModalOpen] = useState(false);

  // Form State
  const [teamId, setTeamId] = useState(teams[0]?.id || '');
  const [categoryId, setCategoryId] = useState(categories[0]?.id || '');
  const [competitionId, setCompetitionId] = useState(competitions[0]?.id || '');
  const [participantId, setParticipantId] = useState('');
  const [chestNumber, setChestNumber] = useState('');
  const [error, setError] = useState('');

  // Derived available competitions
  const selectedCategory = categories.find(c => c.id === categoryId);
  const availableCompetitions = competitions.filter(c => c.categoryId === categoryId);
  const selectedCompetition = competitions.find(c => c.id === competitionId);
  const isGroup = selectedCompetition?.type === 'GROUP';
  const approvedCount = registrations.filter(r => r.status === 'APPROVED').length;
  const pendingCount = registrations.filter(r => r.status === 'PENDING').length;

  // Derived available participants for selected team & category using domain eligibility engine
  const availableParticipants = participants.filter(p =>
    p.teamId === teamId && isParticipantEligibleForCategory(p, selectedCategory, categories)
  );

  const filteredRegistrations = registrations.filter(r => {
    const term = search.trim().toLowerCase();
    const matchesSearch = !term || [r.code, r.participantName, r.competitionName, r.teamName, r.categoryName].some(value => (value || '').toLowerCase().includes(term));
    const matchesTeam = teamFilter === 'ALL' || r.teamId === teamFilter;
    const matchesStatus = statusFilter === 'ALL' || r.status === statusFilter;
    return matchesSearch && matchesTeam && matchesStatus;
  });

  const handleOpenAdd = () => {
    const initTeam = teams[0]?.id || '';
    const initCat = categories[0]?.id || '';
    setTeamId(initTeam);
    setCategoryId(initCat);
    const initialComps = competitions.filter(c => c.categoryId === initCat);
    setCompetitionId(initialComps[0]?.id || competitions[0]?.id || '');
    setParticipantId('');
    setChestNumber('');
    setError('');
    setModalOpen(true);
  };

  const handleTeamChange = (newTeamId: string) => {
    setTeamId(newTeamId);
    setParticipantId('');
    setChestNumber('');
  };

  const handleCategoryChange = (newCatId: string) => {
    setCategoryId(newCatId);
    const matchingComps = competitions.filter(c => c.categoryId === newCatId);
    if (matchingComps.length > 0) {
      setCompetitionId(matchingComps[0].id);
    } else {
      setCompetitionId('');
    }
    setParticipantId('');
    setChestNumber('');
  };

  const handleCompetitionChange = (newCompId: string) => {
    setCompetitionId(newCompId);
    const comp = competitions.find(c => c.id === newCompId);
    if (comp && comp.categoryId && comp.categoryId !== categoryId) {
      setCategoryId(comp.categoryId);
    }
    setParticipantId('');
    setChestNumber('');
  };

  const handleParticipantChange = (newPartId: string) => {
    setParticipantId(newPartId);
    const part = participants.find(p => p.id === newPartId);
    if (part?.bib) {
      setChestNumber(part.bib);
    }
  };

  const [saving, setSaving] = useState(false);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    const team = teams.find(t => t.id === teamId);
    if (!team) {
      setError('Please select a valid participating team.');
      return;
    }
    const cat = categories.find(c => c.id === categoryId);
    const comp = competitions.find(c => c.id === competitionId);

    if (!comp) {
      setError('Please select a valid competition.');
      return;
    }

    let participantName = '';
    if (comp.type !== 'GROUP') {
      const part = availableParticipants.find(p => p.id === participantId);
      if (!part) {
        setError('Please select a student contestant.');
        return;
      }
      participantName = part.name;
    } else {
      const leader = availableParticipants.find(p => p.id === participantId);
      if (!leader) {
        setError('Select a registered participant to represent this group.');
        return;
      }
      participantName = `${leader.name} & Team`;
    }

    setSaving(true);
    try {
      await addRegistration({
        participantId: comp.type !== 'GROUP' ? participantId : undefined,
        groupLeaderId: comp.type === 'GROUP' ? participantId : undefined,
        participantName,
        teamId: team.id,
        teamCode: team.code,
        teamName: team.name,
        categoryId: comp.categoryId || categoryId,
        categoryName: comp.categoryName || cat?.name || 'General',
        competitionId: comp.id,
        competitionName: comp.name,
        type: comp.type,
        chestNumber: chestNumber || (comp.type !== 'GROUP' ? (availableParticipants.find(p => p.id === participantId)?.bib || '#1000') : `GRP-${team.code}`),
        status: 'APPROVED'
      });
      setModalOpen(false);
    } catch (err: any) {
      setError(err?.message || 'Failed to save registration.');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: string, name: string) => {
    if (confirm(`Are you sure you want to revoke registration for "${name}"?`)) {
      try {
        await deleteRegistration(id);
      } catch (err: any) {
        alert(err?.message || 'Failed to delete registration.');
      }
    }
  };

  return (
    <AdminLayout>
      <div className="w-full max-w-[1440px] mx-auto space-y-5 sm:space-y-6">
        {/* Header */}
        <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4 rounded-2xl border border-slate-200 bg-white p-4 sm:p-6 shadow-sm">
          <div>
            <h1 className="text-xl sm:text-2xl font-bold text-slate-900 tracking-tight">
              Registration Management
            </h1>
            <p className="text-sm text-slate-500 mt-1">
              Verify, approve, and manage contestant &amp; squad enrollments for scheduled events
            </p>
          </div>
          <Button
            variant="primary"
            size="md"
            leftIcon={<Plus className="w-4 h-4" />}
            onClick={handleOpenAdd}
          >
            Add Registration
          </Button>
        </div>

        {/* Registration overview */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 sm:gap-4">
          <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm flex items-center gap-3">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-blue-50 text-blue-600"><ClipboardList className="h-5 w-5" /></div>
            <div><p className="text-xs font-medium text-slate-500">Total registrations</p><p className="text-2xl font-bold tracking-tight text-slate-900">{registrations.length}</p></div>
          </div>
          <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm flex items-center gap-3">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-emerald-50 text-emerald-600"><Check className="h-5 w-5" /></div>
            <div><p className="text-xs font-medium text-slate-500">Approved</p><p className="text-2xl font-bold tracking-tight text-slate-900">{approvedCount}</p></div>
          </div>
          <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm flex items-center gap-3">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-amber-50 text-amber-600"><Filter className="h-5 w-5" /></div>
            <div><p className="text-xs font-medium text-slate-500">Pending review</p><p className="text-2xl font-bold tracking-tight text-slate-900">{pendingCount}</p></div>
          </div>
        </div>

        {/* Filter bar */}
        <div className="rounded-2xl border border-slate-200 bg-white p-3 sm:p-4 shadow-sm flex flex-col lg:flex-row lg:items-center lg:justify-between gap-3">
          <div className="relative flex-1 w-full md:max-w-md">
            <Search className="w-4 h-4 text-[#526070] absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
            <input
              type="text"
              placeholder="Search Reg ID, Contestant, Event..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full text-xs pl-9 pr-4 py-2 bg-[#F8FAFC] border border-[#E1E7EF] rounded-lg text-[#111111] focus:outline-none focus:bg-white focus:border-[#2563EB]"
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 w-full lg:w-auto">
            <select
              aria-label="Filter by Team"
              value={teamFilter}
              onChange={(e) => setTeamFilter(e.target.value)}
              className="w-full min-w-0 text-sm font-medium py-2.5 px-3 rounded-xl border border-slate-200 bg-slate-50 text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-100 focus:border-blue-500"
            >
              <option value="ALL">All Teams</option>
              {teams.map(t => (
                <option key={t.id} value={t.id}>{t.name} ({t.code})</option>
              ))}
            </select>

            <select
              aria-label="Filter by Status"
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="text-xs font-semibold py-2 px-3 rounded-lg border border-[#E1E7EF] bg-[#F8FAFC] text-[#111111] focus:outline-none focus:bg-white"
            >
              <option value="ALL">All Statuses</option>
              <option value="APPROVED">Approved</option>
              <option value="PENDING">Pending</option>
              <option value="REJECTED">Rejected</option>
            </select>
          </div>
        </div>

        {/* Master Registration Table */}
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
          <div className="px-4 sm:px-6 py-4 border-b border-slate-100 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-1">
            <div className="flex items-center gap-2"><ClipboardList className="w-4 h-4 text-blue-600" /><h3 className="text-sm font-bold text-slate-900">Competition Entry Register</h3></div>
            <span className="text-xs font-medium text-slate-500">Showing {filteredRegistrations.length} of {registrations.length} registrations</span>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full min-w-[900px] text-left text-sm">
              <thead>
                <tr className="border-b border-[#E1E7EF] bg-[#F8FAFC] text-[#526070] font-bold uppercase text-[11px]">
                  <th className="py-3 px-4 sm:px-5">Registration ID</th>
                  <th className="py-3 px-6">Participant / Group</th>
                  <th className="py-3 px-6">Team</th>
                  <th className="py-3 px-6">Category</th>
                  <th className="py-3 px-6">Competition</th>
                  <th className="py-3 px-4 sm:px-5 text-center">Type</th>
                  <th className="py-3 px-6 text-center">Status</th>
                  <th className="py-3 px-4 sm:px-5 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#E1E7EF]">
                {filteredRegistrations.length === 0 ? (<tr><td colSpan={8} className="px-6 py-14 text-center"><div className="mx-auto mb-3 flex h-11 w-11 items-center justify-center rounded-2xl bg-slate-100 text-slate-500"><ClipboardList className="h-5 w-5" /></div><p className="text-sm font-semibold text-slate-800">No registrations found</p><p className="mt-1 text-xs text-slate-500">Try changing the search or filters.</p></td></tr>) : filteredRegistrations.map((reg) => (
                  <tr key={reg.id} className="hover:bg-[#F8FAFC] transition-colors">
                    <td className="py-3.5 px-4 sm:px-5 font-mono font-bold text-[#2563EB]">
                      {reg.code}
                    </td>
                    <td className="py-4 px-6">
                      <span className="font-bold text-[#111111] text-sm block">{reg.participantName}</span>
                      <span className="font-mono text-[#526070] text-[11px]">Chest {reg.chestNumber}</span>
                    </td>
                    <td className="py-4 px-6">
                      <span className="font-semibold text-[#111111]">{reg.teamName}</span>
                      <span className="text-[#526070] text-[11px] ml-1">({reg.teamCode})</span>
                    </td>
                    <td className="py-4 px-6 font-semibold text-[#111111]">
                      {reg.categoryName}
                    </td>
                    <td className="py-4 px-6 text-[#111111] font-medium">
                      {reg.competitionName}
                    </td>
                    <td className="py-4 px-6 text-center">
                      <span className={`text-[10px] font-bold px-2 py-0.5 rounded ${reg.type === 'SOLO' ? 'bg-slate-100 text-slate-800' : 'bg-purple-100 text-purple-800'}`}>
                        {reg.type === 'SOLO' ? 'Individual' : 'Group'}
                      </span>
                    </td>
                    <td className="py-4 px-6 text-center">
                      <Badge variant={reg.status === 'APPROVED' ? 'success' : 'warning'} size="sm" dot>
                        {reg.status}
                      </Badge>
                    </td>
                    <td className="py-4 px-6 text-right">
                      <div className="flex items-center justify-end gap-1.5">
                        {reg.status !== 'APPROVED' && (
                          <button
                            type="button"
                            onClick={() => updateRegistrationStatus(reg.id, 'APPROVED')}
                            className="p-1.5 rounded-lg text-[#526070] hover:text-emerald-600 hover:bg-emerald-50 transition-colors"
                            title="Approve Entry"
                          >
                            <Check className="w-4 h-4" />
                          </button>
                        )}
                        <button
                          type="button"
                          onClick={() => handleDelete(reg.id, reg.participantName)}
                          className="p-1.5 rounded-lg text-[#526070] hover:text-[#DC2626] hover:bg-red-50 transition-colors"
                          title="Revoke Entry"
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

        {/* Add Registration Modal */}
        <Modal
          isOpen={modalOpen}
          onClose={() => setModalOpen(false)}
          title="New Competition Registration"
          description="Enroll a contestant or team ensemble into an active festival competition"
          maxWidth="lg"
          footer={
            <div className="flex items-center justify-end gap-2 w-full">
              <Button variant="outline" size="sm" onClick={() => setModalOpen(false)}>
                Cancel
              </Button>
              <Button variant="primary" size="sm" onClick={() => { const form = document.querySelector<HTMLFormElement>('[data-registration-form]'); form?.requestSubmit(); }} disabled={saving}>
                Confirm Registration
              </Button>
            </div>
          }
        >
          <form data-registration-form onSubmit={handleSave} className="space-y-5">
            {error && (
              <p className="text-xs text-[#DC2626] font-semibold">{error}</p>
            )}

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <Select
                label="Select Team"
                value={teamId}
                onChange={(e) => handleTeamChange(e.target.value)}
                options={teams.map(t => ({ value: t.id, label: `${t.name} (${t.code})` }))}
              />
              <Select
                label="Select Category Tier"
                value={categoryId}
                onChange={(e) => handleCategoryChange(e.target.value)}
                options={categories.map(c => ({ value: c.id, label: c.name }))}
              />
            </div>

            <div>
              <Select
                label="Select Competition"
                value={competitionId}
                onChange={(e) => handleCompetitionChange(e.target.value)}
                options={availableCompetitions.map(c => ({ value: c.id, label: `${c.name} (${c.type === 'SOLO' ? 'Individual' : 'Group'})` }))}
              />
            </div>

            {availableCompetitions.length === 0 && (
              <p className="text-xs text-amber-600 italic">
                No active competitions available for {selectedCategory?.name || 'this category'}.
              </p>
            )}

            {isGroup ? (
              <div className="space-y-2">
                <Select
                  label="Group Leader (registered participant)"
                  value={participantId}
                  onChange={(e) => handleParticipantChange(e.target.value)}
                  options={[{ value: '', label: '-- Select Group Leader --' }, ...availableParticipants.map(p => ({ value: p.id, label: `${p.name} (${p.bib})` }))]}
                  required
                />
                <p className="text-xs text-[#526070]">{selectedCompetition?.groupSize || 'Not set'} members per group. Only the leader is recorded. Unlimited groups per team; group marks count toward the team only.</p>
              </div>
            ) : (
              <div>
                <Select
                  label="Select Student Contestant"
                  value={participantId}
                  onChange={(e) => handleParticipantChange(e.target.value)}
                  options={[
                    { value: '', label: '-- Select Enrolled Student --' },
                    ...availableParticipants.map(p => ({
                      value: p.id,
                      label: `${p.name} (${p.bib || 'No Bib'} - ${p.categoryName || p.classGrade || 'Contestant'})`
                    }))
                  ]}
                  required
                />
                {availableParticipants.length === 0 && (
                  <div className="mt-2 p-2.5 rounded-lg bg-amber-50 border border-amber-200">
                    <p className="text-xs text-amber-800 font-medium">
                      No participants found under selected team eligible for {selectedCategory?.name || 'this category'}. Please register students first.
                    </p>
                  </div>
                )}
              </div>
            )}

            <Input
              label="Assigned Chest / Bib Number"
              placeholder="#1042"
              value={chestNumber}
              onChange={(e) => setChestNumber(e.target.value)}
              helperText="Auto-generated or custom physical chest number tag"
            />
          </form>
        </Modal>
      </div>
    </AdminLayout>
  );
}
