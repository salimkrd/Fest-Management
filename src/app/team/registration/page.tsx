'use client';

import React, { useState } from 'react';
import { TeamLayout } from '@/components/layout/TeamLayout';
import { useFest } from '@/context/FestContext';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Select } from '@/components/ui/Select';
import { Badge } from '@/components/ui/Badge';
import { Modal } from '@/components/ui/Modal';
import { Plus, Search, Trash2, Calendar, MapPin, CheckCircle2 } from 'lucide-react';

export default function TeamRegistrationPage() {
  const { currentTeamUser, teams, registrations, categories, competitions, participants, addRegistration, deleteRegistration } = useFest();
  const team = currentTeamUser || teams[0];

  const [search, setSearch] = useState('');
  const [modalOpen, setModalOpen] = useState(false);

  // Form State
  const [categoryId, setCategoryId] = useState(categories[0]?.id || '');
  const [competitionId, setCompetitionId] = useState(competitions[0]?.id || '');
  const [participantId, setParticipantId] = useState('');
  const [groupName, setGroupName] = useState('');
  const [chestNumber, setChestNumber] = useState('');
  const [error, setError] = useState('');

  // Scoped to team only!
  const myRegistrations = registrations.filter(r => r.teamId === team?.id);

  const availableCompetitions = competitions.filter(c => c.categoryId === categoryId);
  const selectedCompetition = competitions.find(c => c.id === competitionId);
  const isGroup = selectedCompetition?.type === 'GROUP';

  // Available participants from this team and category
  const teamEligibleParticipants = participants.filter(p => p.teamId === team?.id && p.categoryId === categoryId);

  const filtered = myRegistrations.filter(r =>
    r.participantName.toLowerCase().includes(search.toLowerCase()) ||
    r.competitionName.toLowerCase().includes(search.toLowerCase()) ||
    r.code.toLowerCase().includes(search.toLowerCase())
  );

  const handleOpenAdd = () => {
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
    const cat = categories.find(c => c.id === categoryId);
    const comp = competitions.find(c => c.id === competitionId);

    if (!comp) {
      setError('Please select an active competition.');
      return;
    }

    let participantName = '';
    if (comp.type === 'SOLO') {
      const part = teamEligibleParticipants.find(p => p.id === participantId);
      if (!part) {
        setError('Please select a student contestant from your team roster.');
        return;
      }
      participantName = part.name;
    } else {
      if (!groupName) {
        setError('Please enter your ensemble or group troupe name.');
        return;
      }
      participantName = groupName;
    }

    addRegistration({
      participantId: comp.type === 'SOLO' ? participantId : undefined,
      participantName,
      teamId: team?.id || 'team-1',
      teamCode: team?.code || 'ABH',
      teamName: team?.name || 'Al-Bayan House',
      categoryId,
      categoryName: cat?.name || 'Senior',
      competitionId: comp.id,
      competitionName: comp.name,
      type: comp.type,
      chestNumber: chestNumber || '#' + Math.floor(1000 + Math.random() * 9000),
      status: 'APPROVED'
    });

    setModalOpen(false);
  };

  const handleDelete = (id: string, name: string) => {
    if (confirm(`Are you sure you want to cancel event registration for "${name}"?`)) {
      deleteRegistration(id);
    }
  };

  return (
    <TeamLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-2 border-b border-[#E1E7EF]">
          <div>
            <h1 className="text-xl sm:text-2xl font-bold text-[#111111] tracking-tight">
              Competition Registration
            </h1>
            <p className="text-xs text-[#526070] mt-1">
              Enroll {team?.name} contestants into solo and group competitions
            </p>
          </div>
          <Button
            variant="primary"
            size="md"
            leftIcon={<Plus className="w-4 h-4" />}
            onClick={handleOpenAdd}
          >
            Enroll in Competition
          </Button>
        </div>

        {/* Filter bar */}
        <div className="bg-white p-4 rounded-xl border border-[#E1E7EF] flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="relative flex-1 w-full sm:max-w-md">
            <Search className="w-4 h-4 text-[#526070] absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
            <input
              type="text"
              placeholder="Search enrolled contestant or event..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full text-xs pl-9 pr-4 py-2 bg-[#F8FAFC] border border-[#E1E7EF] rounded-lg text-[#111111] focus:outline-none focus:bg-white focus:border-[#2563EB]"
            />
          </div>
          <span className="text-xs text-[#526070]">
            {filtered.length} Active Event Entries
          </span>
        </div>

        {/* Table */}
        <div className="bg-white rounded-xl border border-[#E1E7EF] shadow-xs overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="border-b border-[#E1E7EF] bg-[#F8FAFC] text-[#526070] font-bold uppercase text-[11px]">
                  <th className="py-3 px-6">Reg Code</th>
                  <th className="py-3 px-6">Participant / Ensemble</th>
                  <th className="py-3 px-6">Competition Title &amp; Code</th>
                  <th className="py-3 px-6">Category</th>
                  <th className="py-3 px-6 text-center">Type</th>
                  <th className="py-3 px-6 text-center">Status</th>
                  <th className="py-3 px-6 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#E1E7EF]">
                {filtered.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="py-8 text-center text-[#526070]">
                      No event entries registered yet for {team?.name}.
                    </td>
                  </tr>
                ) : (
                  filtered.map(r => (
                    <tr key={r.id} className="hover:bg-[#F8FAFC] transition-colors">
                      <td className="py-4 px-6 font-mono font-bold text-[#2563EB]">
                        {r.code}
                      </td>
                      <td className="py-4 px-6">
                        <span className="font-bold text-[#111111] text-sm block">{r.participantName}</span>
                        <span className="text-[11px] font-mono text-[#526070]">Chest {r.chestNumber}</span>
                      </td>
                      <td className="py-4 px-6 font-semibold text-[#111111]">
                        {r.competitionName}
                      </td>
                      <td className="py-4 px-6 text-[#526070]">
                        {r.categoryName}
                      </td>
                      <td className="py-4 px-6 text-center">
                        <span className={`text-[10px] font-bold px-2 py-0.5 rounded ${r.type === 'SOLO' ? 'bg-slate-100 text-slate-800' : 'bg-purple-100 text-purple-800'}`}>
                          {r.type}
                        </span>
                      </td>
                      <td className="py-4 px-6 text-center">
                        <Badge variant="success" size="sm" dot>{r.status}</Badge>
                      </td>
                      <td className="py-4 px-6 text-right">
                        <button
                          type="button"
                          onClick={() => handleDelete(r.id, r.participantName)}
                          className="p-1.5 rounded-lg text-[#526070] hover:text-[#DC2626] hover:bg-red-50 transition-colors"
                          title="Cancel Entry"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* Add Modal */}
        <Modal
          isOpen={modalOpen}
          onClose={() => setModalOpen(false)}
          title={`Enroll Contestant: ${team?.name}`}
          description="Register squad member into an active event with automatic category check"
          maxWidth="md"
          footer={
            <div className="flex items-center justify-end gap-2 w-full">
              <Button variant="outline" size="sm" onClick={() => setModalOpen(false)}>
                Cancel
              </Button>
              <Button variant="primary" size="sm" onClick={handleSave}>
                Confirm Entry
              </Button>
            </div>
          }
        >
          <form onSubmit={handleSave} className="space-y-4">
            {error && (
              <p className="text-xs text-[#DC2626] font-semibold">{error}</p>
            )}

            <Select
              label="Select Category Tier"
              value={categoryId}
              onChange={(e) => setCategoryId(e.target.value)}
              options={categories.map(c => ({ value: c.id, label: c.name }))}
            />

            <Select
              label="Select Competition"
              value={competitionId}
              onChange={(e) => setCompetitionId(e.target.value)}
              options={availableCompetitions.map(c => ({ value: c.id, label: `${c.name} (${c.type})` }))}
            />

            {isGroup ? (
              <Input
                label="Team Ensemble / Troupe Name"
                placeholder={`e.g. ${team?.name} Voice Troupe`}
                value={groupName}
                onChange={(e) => setGroupName(e.target.value)}
                required
              />
            ) : (
              <div>
                <Select
                  label="Select Team Contestant"
                  value={participantId}
                  onChange={(e) => setParticipantId(e.target.value)}
                  options={[
                    { value: '', label: '-- Select Enrolled Team Member --' },
                    ...teamEligibleParticipants.map(p => ({ value: p.id, label: `${p.name} (${p.bib} - ${p.classGrade})` }))
                  ]}
                  required
                />
                {teamEligibleParticipants.length === 0 && (
                  <p className="mt-1 text-xs text-amber-600">
                    No participants found under {team?.name} for this category tier.
                  </p>
                )}
              </div>
            )}

            <Input
              label="Assigned Chest / Bib Number"
              placeholder="#1042"
              value={chestNumber}
              onChange={(e) => setChestNumber(e.target.value)}
            />
          </form>
        </Modal>
      </div>
    </TeamLayout>
  );
}
