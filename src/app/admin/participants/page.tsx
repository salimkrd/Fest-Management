'use client';

import React, { useState } from 'react';
import { AdminLayout } from '@/components/layout/AdminLayout';
import { useFest } from '@/context/FestContext';
import { Participant } from '@/types/fest';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { DigitalIdCard } from '@/components/domain/DigitalIdCard';
import { ParticipantEditorModal } from '@/components/domain/ParticipantEditorModal';
import { ParticipantPhoto } from '@/components/domain/ParticipantPhoto';
import { Plus, Search, Edit2, Trash2, IdCard } from 'lucide-react';

export default function ParticipantsPage() {
  const { participants, teams, categories, registrations, addParticipant, updateParticipant, deleteParticipant } = useFest();

  const [search, setSearch] = useState('');
  const [teamFilter, setTeamFilter] = useState('ALL');
  const [categoryFilter, setCategoryFilter] = useState('ALL');
  const [modalOpen, setModalOpen] = useState(false);
  const [editingPart, setEditingPart] = useState<Participant | null>(null);
  const [selectedIdCardPart, setSelectedIdCardPart] = useState<Participant | null>(null);

  const filteredParticipants = participants.filter(p => {
    const query = search.trim().toLowerCase();
    const matchesSearch = (p.name || '').toLowerCase().includes(query) ||
                          (p.bib || '').toLowerCase().includes(query) ||
                          (p.email || '').toLowerCase().includes(query);
    const matchesTeam = teamFilter === 'ALL' || p.teamId === teamFilter;
    const matchesCat = categoryFilter === 'ALL' || p.categoryId === categoryFilter;
    return matchesSearch && matchesTeam && matchesCat;
  });

  const handleOpenAdd = () => {
    setEditingPart(null);
    setModalOpen(true);
  };

  const handleOpenEdit = (participant: Participant) => {
    setEditingPart(participant);
    setModalOpen(true);
  };

  const handleSave = async (data: Omit<Participant, 'id' | 'bib' | 'idStatus'>) => {
    if (editingPart) {
      // Do not replace competition registrations when editing profile fields.
      const profileUpdates: Partial<Participant> = { ...data };
      delete profileUpdates.registeredEventIds;
      await updateParticipant(editingPart.id, profileUpdates);
    } else {
      await addParticipant(data);
    }
  };

  const handleDelete = async (id: string, name: string) => {
    if (confirm(`Are you sure you want to remove participant "${name}"?`)) {
      try {
        await deleteParticipant(id);
      } catch (err: any) {
        alert(err?.message || 'Failed to delete participant.');
      }
    }
  };

  const getRegisteredEventCount = (participantId: string) => new Set(registrations.filter(reg => reg.status !== 'REJECTED' && (reg.participantId === participantId || reg.groupLeaderId === participantId)).map(reg => reg.competitionId)).size;

  const activeFilterCount = Number(teamFilter !== 'ALL') + Number(categoryFilter !== 'ALL');

  return (
    <AdminLayout>
      <div className="w-full max-w-[1400px] min-w-0 space-y-5 sm:space-y-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 sm:gap-4 pb-4 border-b border-[#E1E7EF]">
          <div>
            <h1 className="text-xl sm:text-2xl font-bold text-slate-900 tracking-tight">
              Participant Management
            </h1>
            <p className="text-xs sm:text-sm text-slate-500 mt-1 leading-relaxed">
              Contestant roster, team affiliations, categories, and digital accreditation ID badges
            </p>
          </div>
          <Button
            variant="primary"
            size="md"
            leftIcon={<Plus className="w-4 h-4" />}
            onClick={handleOpenAdd}
          >
            Register Student
          </Button>
        </div>

        {/* Filter bar */}
        <div className="bg-white p-3 sm:p-4 rounded-xl border border-slate-200 shadow-sm flex flex-col lg:flex-row lg:items-center justify-between gap-3 sm:gap-4">
          <div className="relative flex-1 w-full lg:max-w-xl min-w-0">
            <Search className="w-4 h-4 text-[#526070] absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
            <input
              type="text"
              placeholder="Search by Bib #, Student Name, or Email..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full min-h-11 text-sm pl-10 pr-4 py-2.5 bg-slate-50 border border-slate-200 rounded-lg text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-100 focus:border-blue-500 transition-colors"
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 w-full lg:w-auto lg:min-w-[420px]">
            <select
              aria-label="Filter by Team Contingent"
              value={teamFilter}
              onChange={(e) => setTeamFilter(e.target.value)}
              className="w-full min-w-0 min-h-11 text-sm font-medium py-2.5 px-3 rounded-lg border border-slate-200 bg-white text-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-100 focus:border-blue-500"
            >
              <option value="ALL">All Teams / Houses</option>
              {teams.map(t => (
                <option key={t.id} value={t.id}>{t.name} ({t.code})</option>
              ))}
            </select>

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
          </div>
        </div>

        {/* Participants Table */}
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
          <div className="px-4 sm:px-5 py-4 border-b border-slate-200 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-1.5">
            <div>
              <h3 className="text-sm font-bold text-slate-900">Student Contestants Directory</h3>
              <p className="text-xs text-slate-500 mt-0.5">Participant profiles, team details and digital ID cards</p>
            </div>
            <span className="text-xs font-semibold text-slate-600 tabular-nums">Showing {filteredParticipants.length} of {participants.length} participants</span>
          </div>

          <div className="hidden md:block overflow-x-auto">
            <table className="w-full min-w-[1050px] text-left text-xs">
              <thead>
                <tr className="border-b border-slate-200 bg-slate-50 text-slate-500 font-bold uppercase text-[10px] tracking-wide">
                  <th className="py-3 px-4">Participant ID / Bib</th>
                  <th className="py-3 px-6">Photo &amp; Full Name</th>
                  <th className="py-3 px-6">Team Affiliation</th>
                  <th className="py-3 px-6">Category</th>
                  <th className="py-3 px-6">Class / Grade</th>
                  <th className="py-3 px-4 text-center">Registered Events</th>
                  <th className="py-3 px-6 text-center">ID Status</th>
                  <th className="py-3 px-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200">
                {filteredParticipants.length === 0 ? (
                  <tr><td colSpan={8} className="px-6 py-14 text-center text-sm text-slate-500">No participants match your search or filters.</td></tr>
                ) : filteredParticipants.map((p) => (
                  <tr key={p.id} className="hover:bg-slate-50/80 transition-colors">
                    <td className="py-3.5 px-4 font-mono font-bold text-[#111111]">
                      {p.bib}
                    </td>
                    <td className="py-3.5 px-4">
                      <div className="flex items-center gap-3">
                        <ParticipantPhoto
                          photoUrl={p.photoUrl}
                          name={p.name}
                          size="sm"
                          shape="circle"
                          className="border border-[#E1E7EF]"
                        />
                        <div>
                          <span className="font-bold text-[#111111] text-sm block">{p.name}</span>
                          <span className="text-[11px] text-[#526070]">{p.email}</span>
                        </div>
                      </div>
                    </td>
                    <td className="py-3.5 px-4">
                      <span className="font-semibold text-[#111111]">{p.teamName}</span>
                      <span className="text-[#526070] text-[11px] ml-1">({p.teamCode})</span>
                    </td>
                    <td className="py-3.5 px-4 font-semibold text-[#111111]">
                      {p.categoryName}
                    </td>
                    <td className="py-3.5 px-4 text-[#526070]">
                      {p.classGrade || '—'}
                    </td>
                    <td className="py-3.5 px-4 text-center">
                      <span className="font-bold text-[#2563EB] bg-blue-50 px-2 py-0.5 rounded border border-blue-100">
                        {getRegisteredEventCount(p.id)} Events
                      </span>
                    </td>
                    <td className="py-3.5 px-4 text-center">
                      <Badge variant="success" size="sm">
                        {p.idStatus}
                      </Badge>
                    </td>
                    <td className="py-3.5 px-4 text-right">
                      <div className="flex items-center justify-end gap-2">
                        <button
                          type="button"
                          onClick={() => setSelectedIdCardPart(p)}
                          className="p-1.5 rounded-lg text-[#526070] hover:text-[#2563EB] hover:bg-blue-50 transition-colors"
                          title="View & Print Digital ID Card"
                        >
                          <IdCard className="w-4 h-4" />
                        </button>
                        <button
                          type="button"
                          onClick={() => handleOpenEdit(p)}
                          className="p-1.5 rounded-lg text-[#526070] hover:text-[#2563EB] hover:bg-blue-50 transition-colors"
                          title="Edit Participant"
                        >
                          <Edit2 className="w-4 h-4" />
                        </button>
                        <button
                          type="button"
                          onClick={() => handleDelete(p.id, p.name)}
                          className="p-1.5 rounded-lg text-[#526070] hover:text-[#DC2626] hover:bg-red-50 transition-colors"
                          title="Delete Participant"
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

          {/* Compact participant cards for phones and small tablets */}
          <div className="md:hidden divide-y divide-slate-200">
            {filteredParticipants.map((p) => (
              <article key={p.id} className="p-4 space-y-3">
                <div className="flex items-start gap-3 min-w-0">
                  <ParticipantPhoto photoUrl={p.photoUrl} name={p.name} size="md" shape="circle" className="border border-slate-200 shrink-0" />
                  <div className="min-w-0 flex-1">
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <h4 className="text-sm font-semibold text-slate-900 break-words">{p.name || 'Unnamed participant'}</h4>
                        <p className="text-xs text-slate-500 mt-0.5 break-all">{p.email || 'No email provided'}</p>
                      </div>
                      <span className="shrink-0 rounded-md bg-blue-50 border border-blue-100 px-2 py-1 text-xs font-mono font-bold text-blue-700">{p.bib || 'No Bib'}</span>
                    </div>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-x-3 gap-y-2 rounded-lg bg-slate-50 p-3 text-xs">
                  <div className="min-w-0"><p className="text-slate-500">Team</p><p className="font-semibold text-slate-800 break-words">{p.teamName || '—'}{p.teamCode ? ` (${p.teamCode})` : ''}</p></div>
                  <div className="min-w-0"><p className="text-slate-500">Category</p><p className="font-semibold text-slate-800 break-words">{p.categoryName || '—'}</p></div>
                  <div><p className="text-slate-500">Class / Grade</p><p className="font-medium text-slate-800">{p.classGrade || '—'}</p></div>
                  <div><p className="text-slate-500">Registered Events</p><p className="font-semibold text-blue-700">{getRegisteredEventCount(p.id)}</p></div>
                </div>
                <div className="flex items-center justify-between gap-3">
                  <Badge variant="success" size="sm">{p.idStatus || 'GENERATED'}</Badge>
                  <div className="flex items-center gap-1">
                    <button type="button" onClick={() => setSelectedIdCardPart(p)} className="inline-flex min-h-10 min-w-10 items-center justify-center rounded-lg text-slate-600 hover:text-blue-700 hover:bg-blue-50" title="View & Print Digital ID Card" aria-label={`View ID card for ${p.name}`}><IdCard className="w-4 h-4" /></button>
                    <button type="button" onClick={() => handleOpenEdit(p)} className="inline-flex min-h-10 min-w-10 items-center justify-center rounded-lg text-slate-600 hover:text-blue-700 hover:bg-blue-50" title="Edit Participant" aria-label={`Edit ${p.name}`}><Edit2 className="w-4 h-4" /></button>
                    <button type="button" onClick={() => handleDelete(p.id, p.name)} className="inline-flex min-h-10 min-w-10 items-center justify-center rounded-lg text-slate-600 hover:text-red-700 hover:bg-red-50" title="Delete Participant" aria-label={`Delete ${p.name}`}><Trash2 className="w-4 h-4" /></button>
                  </div>
                </div>
              </article>
            ))}
            {filteredParticipants.length === 0 && <div className="px-4 py-12 text-center text-sm text-slate-500">No participants match your search or filters.</div>}
          </div>
        </div>

        {/* The same participant editor is used for Admin and Team Manager. */}
        {modalOpen && (
          <ParticipantEditorModal
            participant={editingPart}
            teams={teams}
            categories={categories}
            onSave={handleSave}
            onClose={() => setModalOpen(false)}
          />
        )}

        {/* Digital ID Card Preview Modal */}
        <DigitalIdCard
          participant={selectedIdCardPart}
          isOpen={!!selectedIdCardPart}
          onClose={() => setSelectedIdCardPart(null)}
        />
      </div>
    </AdminLayout>
  );
}
