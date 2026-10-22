'use client';

import React, { useState } from 'react';
import { AdminLayout } from '@/components/layout/AdminLayout';
import { useFest } from '@/context/FestContext';
import { Registration, CompetitionType } from '@/types/fest';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Select } from '@/components/ui/Select';
import { Badge } from '@/components/ui/Badge';
import { Modal } from '@/components/ui/Modal';
import { Plus, Search, Check, X, Trash2, ClipboardList, CheckCircle2 } from 'lucide-react';

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
  const [groupName, setGroupName] = useState('');
  const [chestNumber, setChestNumber] = useState('');
  const [error, setError] = useState('');

  // Derived available competitions
  const availableCompetitions = competitions.filter(c => c.categoryId === categoryId);
  const selectedCompetition = competitions.find(c => c.id === competitionId);
  const isGroup = selectedCompetition?.type === 'GROUP';

  // Derived available participants for selected team & category
  const availableParticipants = participants.filter(p => p.teamId === teamId && p.categoryId === categoryId);

  const filteredRegistrations = registrations.filter(r => {
    const matchesSearch = r.code.toLowerCase().includes(search.toLowerCase()) ||
                          r.participantName.toLowerCase().includes(search.toLowerCase()) ||
                          r.competitionName.toLowerCase().includes(search.toLowerCase());
    const matchesTeam = teamFilter === 'ALL' || r.teamId === teamFilter;
    const matchesStatus = statusFilter === 'ALL' || r.status === statusFilter;
    return matchesSearch && matchesTeam && matchesStatus;
  });

  const handleOpenAdd = () => {
    setTeamId(teams[0]?.id || '');
    setCategoryId(categories[0]?.id || '');
    setCompetitionId(competitions[0]?.id || '');
    setParticipantId('');
    setGroupName('');
    setChestNumber('#' + Math.floor(1000 + Math.random() * 9000));
    setError('');
    setModalOpen(true);
  };

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    const team = teams.find(t => t.id === teamId);
    const cat = categories.find(c => c.id === categoryId);
    const comp = competitions.find(c => c.id === competitionId);

    if (!comp) {
      setError('Please select a valid competition.');
      return;
    }

    let participantName = '';
    if (comp.type === 'SOLO') {
      const part = participants.find(p => p.id === participantId);
      if (!part) {
        setError('Please select a student contestant.');
        return;
      }
      participantName = part.name;
    } else {
      if (!groupName) {
        setError('Please enter ensemble or group troupe name.');
        return;
      }
      participantName = groupName;
    }

    addRegistration({
      participantId: comp.type === 'SOLO' ? participantId : undefined,
      participantName,
      teamId,
      teamCode: team?.code || 'ABH',
      teamName: team?.name || 'Al-Bayan House',
      categoryId,
      categoryName: cat?.name || 'Senior',
      competitionId,
      competitionName: comp.name,
      type: comp.type,
      chestNumber: chestNumber || '#' + Math.floor(1000 + Math.random() * 9000),
      status: 'APPROVED'
    });

    setModalOpen(false);
  };

  const handleDelete = (id: string, name: string) => {
    if (confirm(`Are you sure you want to revoke registration for "${name}"?`)) {
      deleteRegistration(id);
    }
  };

  return (
    <AdminLayout>
      <div className="space-y-6 max-w-6xl">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-2 border-b border-[#E1E7EF]">
          <div>
            <h1 className="text-xl sm:text-2xl font-bold text-[#111111] tracking-tight">
              Registration Management
            </h1>
            <p className="text-xs text-[#526070] mt-1">
              Verify, approve, and manage contestant &amp; squad enrollments for scheduled events
            </p>
          </div>
          <Button
            variant="primary"
            size="md"
            leftIcon={<Plus className="w-4 h-4" />}
            onClick={handleOpenAdd}
          >
            New Competition Entry
          </Button>
        </div>

        {/* Filter bar */}
        <div className="bg-white p-4 rounded-xl border border-[#E1E7EF] flex flex-col md:flex-row items-center justify-between gap-4">
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

          <div className="flex items-center gap-3 w-full md:w-auto">
            <select
              aria-label="Filter by Team"
              value={teamFilter}
              onChange={(e) => setTeamFilter(e.target.value)}
              className="text-xs font-semibold py-2 px-3 rounded-lg border border-[#E1E7EF] bg-[#F8FAFC] text-[#111111] focus:outline-none focus:bg-white"
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
            </select>
          </div>
        </div>

        {/* Master Registration Table */}
        <div className="bg-white rounded-xl border border-[#E1E7EF] shadow-xs overflow-hidden">
          <div className="px-6 py-4 border-b border-[#E1E7EF] flex items-center justify-between">
            <h3 className="text-sm font-bold text-[#111111]">Competition Entry Register</h3>
            <span className="text-xs text-[#526070]">Total {filteredRegistrations.length} Registrations</span>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="border-b border-[#E1E7EF] bg-[#F8FAFC] text-[#526070] font-bold uppercase text-[11px]">
                  <th className="py-3 px-6">Registration ID</th>
                  <th className="py-3 px-6">Participant / Group</th>
                  <th className="py-3 px-6">Team</th>
                  <th className="py-3 px-6">Category</th>
                  <th className="py-3 px-6">Competition</th>
                  <th className="py-3 px-6 text-center">Type</th>
                  <th className="py-3 px-6 text-center">Status</th>
                  <th className="py-3 px-6 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#E1E7EF]">
                {filteredRegistrations.map((reg) => (
                  <tr key={reg.id} className="hover:bg-[#F8FAFC] transition-colors">
                    <td className="py-4 px-6 font-mono font-bold text-[#2563EB]">
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
                        {reg.type}
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
              <Button variant="primary" size="sm" onClick={handleSave}>
                Confirm Registration
              </Button>
            </div>
          }
        >
          <form onSubmit={handleSave} className="space-y-4">
            {error && (
              <p className="text-xs text-[#DC2626] font-semibold">{error}</p>
            )}

            <div className="grid grid-cols-2 gap-3">
              <Select
                label="Select Team"
                value={teamId}
                onChange={(e) => setTeamId(e.target.value)}
                options={teams.map(t => ({ value: t.id, label: `${t.name} (${t.code})` }))}
              />
              <Select
                label="Select Category Tier"
                value={categoryId}
                onChange={(e) => setCategoryId(e.target.value)}
                options={categories.map(c => ({ value: c.id, label: c.name }))}
              />
            </div>

            <div>
              <Select
                label="Select Competition"
                value={competitionId}
                onChange={(e) => setCompetitionId(e.target.value)}
                options={availableCompetitions.map(c => ({ value: c.id, label: `${c.name} (${c.type})` }))}
              />
            </div>

            {isGroup ? (
              <Input
                label="Group Troupe / Ensemble Name"
                placeholder="e.g. Al-Bayan Harmony Troupe"
                value={groupName}
                onChange={(e) => setGroupName(e.target.value)}
                required
              />
            ) : (
              <div>
                <Select
                  label="Select Student Contestant"
                  value={participantId}
                  onChange={(e) => setParticipantId(e.target.value)}
                  options={[
                    { value: '', label: '-- Select Enrolled Student --' },
                    ...availableParticipants.map(p => ({ value: p.id, label: `${p.name} (${p.bib} - ${p.classGrade})` }))
                  ]}
                  required
                />
                {availableParticipants.length === 0 && (
                  <p className="mt-1 text-xs text-amber-600">
                    No participants registered under this team and category. Please register students first.
                  </p>
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
