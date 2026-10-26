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
  const { participants, teams, categories, addParticipant, updateParticipant, deleteParticipant } = useFest();

  const [search, setSearch] = useState('');
  const [teamFilter, setTeamFilter] = useState('ALL');
  const [categoryFilter, setCategoryFilter] = useState('ALL');
  const [modalOpen, setModalOpen] = useState(false);
  const [editingPart, setEditingPart] = useState<Participant | null>(null);
  const [selectedIdCardPart, setSelectedIdCardPart] = useState<Participant | null>(null);

  const filteredParticipants = participants.filter(p => {
    const matchesSearch = p.name.toLowerCase().includes(search.toLowerCase()) ||
                          p.bib.toLowerCase().includes(search.toLowerCase()) ||
                          p.email.toLowerCase().includes(search.toLowerCase());
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
      await updateParticipant(editingPart.id, data);
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

  return (
    <AdminLayout>
      <div className="space-y-6 max-w-6xl">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-2 border-b border-[#E1E7EF]">
          <div>
            <h1 className="text-xl sm:text-2xl font-bold text-[#111111] tracking-tight">
              Participant Management
            </h1>
            <p className="text-xs text-[#526070] mt-1">
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
        <div className="bg-white p-4 rounded-xl border border-[#E1E7EF] flex flex-col md:flex-row items-center justify-between gap-4">
          <div className="relative flex-1 w-full md:max-w-md">
            <Search className="w-4 h-4 text-[#526070] absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
            <input
              type="text"
              placeholder="Search by Bib #, Student Name, or Email..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full text-xs pl-9 pr-4 py-2 bg-[#F8FAFC] border border-[#E1E7EF] rounded-lg text-[#111111] focus:outline-none focus:bg-white focus:border-[#2563EB]"
            />
          </div>

          <div className="flex items-center gap-3 w-full md:w-auto">
            <select
              aria-label="Filter by Team Contingent"
              value={teamFilter}
              onChange={(e) => setTeamFilter(e.target.value)}
              className="text-xs font-semibold py-2 px-3 rounded-lg border border-[#E1E7EF] bg-[#F8FAFC] text-[#111111] focus:outline-none focus:bg-white"
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
        <div className="bg-white rounded-xl border border-[#E1E7EF] shadow-xs overflow-hidden">
          <div className="px-6 py-4 border-b border-[#E1E7EF] flex items-center justify-between">
            <h3 className="text-sm font-bold text-[#111111]">Student Contestants Directory</h3>
            <span className="text-xs text-[#526070]">Showing {filteredParticipants.length} Contestants</span>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="border-b border-[#E1E7EF] bg-[#F8FAFC] text-[#526070] font-bold uppercase text-[11px]">
                  <th className="py-3 px-6">Participant ID / Bib</th>
                  <th className="py-3 px-6">Photo &amp; Full Name</th>
                  <th className="py-3 px-6">Team Affiliation</th>
                  <th className="py-3 px-6">Category</th>
                  <th className="py-3 px-6">Class / Grade</th>
                  <th className="py-3 px-6 text-center">Registered Events</th>
                  <th className="py-3 px-6 text-center">ID Status</th>
                  <th className="py-3 px-6 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#E1E7EF]">
                {filteredParticipants.map((p) => (
                  <tr key={p.id} className="hover:bg-[#F8FAFC] transition-colors">
                    <td className="py-4 px-6 font-mono font-bold text-[#111111]">
                      {p.bib}
                    </td>
                    <td className="py-4 px-6">
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
                    <td className="py-4 px-6">
                      <span className="font-semibold text-[#111111]">{p.teamName}</span>
                      <span className="text-[#526070] text-[11px] ml-1">({p.teamCode})</span>
                    </td>
                    <td className="py-4 px-6 font-semibold text-[#111111]">
                      {p.categoryName}
                    </td>
                    <td className="py-4 px-6 text-[#526070]">
                      {p.classGrade} - Div {p.division}
                    </td>
                    <td className="py-4 px-6 text-center">
                      <span className="font-bold text-[#2563EB] bg-blue-50 px-2 py-0.5 rounded border border-blue-100">
                        {p.registeredEventIds.length} Events
                      </span>
                    </td>
                    <td className="py-4 px-6 text-center">
                      <Badge variant="success" size="sm">
                        {p.idStatus}
                      </Badge>
                    </td>
                    <td className="py-4 px-6 text-right">
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
