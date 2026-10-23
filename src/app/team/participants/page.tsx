'use client';

import React, { useState } from 'react';
import { TeamLayout } from '@/components/layout/TeamLayout';
import { useFest } from '@/context/FestContext';
import { Participant } from '@/types/fest';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Select } from '@/components/ui/Select';
import { Badge } from '@/components/ui/Badge';
import { Modal } from '@/components/ui/Modal';
import { DigitalIdCard } from '@/components/domain/DigitalIdCard';
import { Plus, Search, Edit2, Trash2, IdCard, Users } from 'lucide-react';

export default function TeamParticipantsPage() {
  const { currentTeamUser, teams, participants, categories, addParticipant, updateParticipant, deleteParticipant } = useFest();
  const team = currentTeamUser || teams[0];

  const [search, setSearch] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('ALL');
  const [modalOpen, setModalOpen] = useState(false);
  const [editingPart, setEditingPart] = useState<Participant | null>(null);
  const [selectedIdCard, setSelectedIdCard] = useState<Participant | null>(null);

  // Form State
  const [name, setName] = useState('');
  const [dob, setDob] = useState('2008-04-12');
  const [categoryId, setCategoryId] = useState(categories[0]?.id || '');
  const [classGrade, setClassGrade] = useState('Std 11');
  const [division, setDivision] = useState('A');
  const [phone, setPhone] = useState('+91 98470 ');
  const [remarks, setRemarks] = useState('');
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);

  // Scoped to team only!
  const myParticipants = participants.filter(p => p.teamId === team?.id);

  const filtered = myParticipants.filter(p => {
    const matchesSearch = p.name.toLowerCase().includes(search.toLowerCase()) ||
                          p.bib.toLowerCase().includes(search.toLowerCase());
    const matchesCat = categoryFilter === 'ALL' || p.categoryId === categoryFilter;
    return matchesSearch && matchesCat;
  });

  const handleOpenAdd = () => {
    setEditingPart(null);
    setName('');
    setDob('2008-04-12');
    setCategoryId(categories[0]?.id || '');
    setClassGrade('Std 11');
    setDivision('A');
    setPhone('+91 98470 ');
    setRemarks('');
    setError('');
    setModalOpen(true);
  };

  const handleOpenEdit = (p: Participant) => {
    setEditingPart(p);
    setName(p.name);
    setDob(p.dob);
    setCategoryId(p.categoryId);
    setClassGrade(p.classGrade);
    setDivision(p.division);
    setPhone(p.phone);
    setRemarks(p.remarks || '');
    setError('');
    setModalOpen(true);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name) {
      setError('Please provide contestant full name.');
      return;
    }

    if (!team) {
      setError('No active team assigned to this manager session.');
      return;
    }

    const cat = categories.find(c => c.id === categoryId);

    const partData = {
      name,
      email: `${name.toLowerCase().replace(/\s+/g, '.')}@student.institution.org`,
      phone,
      teamId: team.id,
      teamCode: team.code,
      teamName: team.name,
      categoryId,
      categoryName: cat?.name || 'Senior',
      classGrade,
      division,
      dob,
      photoUrl: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=300&q=80',
      registeredEventIds: editingPart ? editingPart.registeredEventIds : [],
      remarks
    };

    setSaving(true);
    setError('');
    try {
      if (editingPart) {
        await updateParticipant(editingPart.id, partData);
      } else {
        await addParticipant(partData);
      }
      setModalOpen(false);
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : 'Could not save participant.');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = (id: string, name: string) => {
    if (confirm(`Are you sure you want to remove "${name}" from your team roster?`)) {
      deleteParticipant(id);
    }
  };

  return (
    <TeamLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-2 border-b border-[#E1E7EF]">
          <div>
            <h1 className="text-xl sm:text-2xl font-bold text-[#111111] tracking-tight">
              My Team Participants
            </h1>
            <p className="text-xs text-[#526070] mt-1">
              Contestant roster registered exclusively under {team?.name} ({team?.code})
            </p>
          </div>
          <Button
            variant="primary"
            size="md"
            leftIcon={<Plus className="w-4 h-4" />}
            onClick={handleOpenAdd}
          >
            Add Team Participant
          </Button>
        </div>

        {/* Filter bar */}
        <div className="bg-white p-4 rounded-xl border border-[#E1E7EF] flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="relative flex-1 w-full sm:max-w-md">
            <Search className="w-4 h-4 text-[#526070] absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
            <input
              type="text"
              placeholder="Search contestant name or Bib..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full text-xs pl-9 pr-4 py-2 bg-[#F8FAFC] border border-[#E1E7EF] rounded-lg text-[#111111] focus:outline-none focus:bg-white focus:border-[#2563EB]"
            />
          </div>

          <div className="flex items-center gap-3 w-full sm:w-auto">
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
            <span className="text-xs text-[#526070] whitespace-nowrap">
              {filtered.length} Students
            </span>
          </div>
        </div>

        {/* Table */}
        <div className="bg-white rounded-xl border border-[#E1E7EF] shadow-xs overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="border-b border-[#E1E7EF] bg-[#F8FAFC] text-[#526070] font-bold uppercase text-[11px]">
                  <th className="py-3 px-6">Bib &amp; ID</th>
                  <th className="py-3 px-6">Participant Info</th>
                  <th className="py-3 px-6">Category</th>
                  <th className="py-3 px-6">Class / Div</th>
                  <th className="py-3 px-6 text-center">Enrolled Competitions</th>
                  <th className="py-3 px-6 text-center">Digital ID</th>
                  <th className="py-3 px-6 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#E1E7EF]">
                {filtered.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="py-8 text-center text-[#526070]">
                      No participants registered yet for this team. Click &quot;Add Team Participant&quot; to begin.
                    </td>
                  </tr>
                ) : (
                  filtered.map(p => (
                    <tr key={p.id} className="hover:bg-[#F8FAFC] transition-colors">
                      <td className="py-4 px-6 font-mono font-bold text-[#111111]">
                        {p.bib}
                      </td>
                      <td className="py-4 px-6">
                        <div className="flex items-center gap-3">
                          <img
                            src={p.photoUrl || "https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=300&q=80"}
                            alt={p.name}
                            className="w-8 h-8 rounded-full object-cover border border-[#E1E7EF]"
                          />
                          <div>
                            <span className="font-bold text-[#111111] text-sm block">{p.name}</span>
                            <span className="text-[11px] text-[#526070]">{p.phone}</span>
                          </div>
                        </div>
                      </td>
                      <td className="py-4 px-6 font-semibold text-[#111111]">
                        {p.categoryName}
                      </td>
                      <td className="py-4 px-6 text-[#526070]">
                        {p.classGrade} - Div {p.division}
                      </td>
                      <td className="py-4 px-6 text-center font-bold text-[#2563EB]">
                        {p.registeredEventIds.length} Events
                      </td>
                      <td className="py-4 px-6 text-center">
                        <Badge variant="success" size="sm">ACTIVE PASS</Badge>
                      </td>
                      <td className="py-4 px-6 text-right">
                        <div className="flex items-center justify-end gap-2">
                          <button
                            type="button"
                            onClick={() => setSelectedIdCard(p)}
                            className="p-1.5 rounded-lg text-[#526070] hover:text-[#2563EB] hover:bg-blue-50 transition-colors"
                            title="Download / Print ID Card"
                          >
                            <IdCard className="w-4 h-4" />
                          </button>
                          <button
                            type="button"
                            onClick={() => handleOpenEdit(p)}
                            className="p-1.5 rounded-lg text-[#526070] hover:text-[#2563EB] hover:bg-blue-50 transition-colors"
                            title="Edit Profile"
                          >
                            <Edit2 className="w-4 h-4" />
                          </button>
                          <button
                            type="button"
                            onClick={() => handleDelete(p.id, p.name)}
                            className="p-1.5 rounded-lg text-[#526070] hover:text-[#DC2626] hover:bg-red-50 transition-colors"
                            title="Remove"
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
          title={editingPart ? `Edit Participant (${editingPart.name})` : 'Add Team Participant'}
          description={`Register a new contestant belonging to ${team?.name}`}
          maxWidth="lg"
          footer={
            <div className="flex items-center justify-end gap-2 w-full">
              <Button variant="outline" size="sm" onClick={() => setModalOpen(false)}>
                Cancel
              </Button>
              <Button variant="primary" size="sm" onClick={handleSave} disabled={saving}>
                {saving ? 'Saving...' : 'Save Contestant'}
              </Button>
            </div>
          }
        >
          <form onSubmit={handleSave} className="space-y-4">
            {error && (
              <p className="text-xs text-[#DC2626] font-semibold">{error}</p>
            )}

            <Input
              label="Student Full Name"
              placeholder="e.g. Zayd Al-Ansari"
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
            />

            <div className="grid grid-cols-2 gap-3">
              <Select
                label="Assigned Category Tier"
                value={categoryId}
                onChange={(e) => setCategoryId(e.target.value)}
                options={categories.map(c => ({ value: c.id, label: c.name }))}
              />
              <Input
                label="Date of Birth"
                type="date"
                value={dob}
                onChange={(e) => setDob(e.target.value)}
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <Input
                label="Academic Class &amp; Division"
                placeholder="Std 11 - A"
                value={classGrade}
                onChange={(e) => setClassGrade(e.target.value)}
              />
              <Input
                label="Contact Phone (WhatsApp)"
                placeholder="+91 98470 00000"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
              />
            </div>

            <Input
              label="Medical / Stage Remarks"
              placeholder="Any stage accommodations or dietary notes"
              value={remarks}
              onChange={(e) => setRemarks(e.target.value)}
            />
          </form>
        </Modal>

        {/* Digital ID Card Preview */}
        <DigitalIdCard
          participant={selectedIdCard}
          isOpen={!!selectedIdCard}
          onClose={() => setSelectedIdCard(null)}
        />
      </div>
    </TeamLayout>
  );
}
