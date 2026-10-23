'use client';

import React, { useState } from 'react';
import { AdminLayout } from '@/components/layout/AdminLayout';
import { useFest } from '@/context/FestContext';
import { Participant } from '@/types/fest';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Select } from '@/components/ui/Select';
import { Badge } from '@/components/ui/Badge';
import { Modal } from '@/components/ui/Modal';
import { DigitalIdCard } from '@/components/domain/DigitalIdCard';
import { Plus, Search, Edit2, Trash2, IdCard, Users2, Mail, Phone } from 'lucide-react';

export default function ParticipantsPage() {
  const { participants, teams, categories, competitions, addParticipant, updateParticipant, deleteParticipant } = useFest();

  const [search, setSearch] = useState('');
  const [teamFilter, setTeamFilter] = useState('ALL');
  const [categoryFilter, setCategoryFilter] = useState('ALL');
  const [modalOpen, setModalOpen] = useState(false);
  const [editingPart, setEditingPart] = useState<Participant | null>(null);
  const [selectedIdCardPart, setSelectedIdCardPart] = useState<Participant | null>(null);

  // Form State
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [teamId, setTeamId] = useState(teams[0]?.id || '');
  const [categoryId, setCategoryId] = useState(categories[0]?.id || '');
  const [classGrade, setClassGrade] = useState('Std 11');
  const [division, setDivision] = useState('A');
  const [dob, setDob] = useState('2008-05-10');
  const [photoUrl, setPhotoUrl] = useState('');
  const [error, setError] = useState('');

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
    setName('');
    setEmail('');
    setPhone('+91 98470 ');
    setTeamId(teams[0]?.id || '');
    setCategoryId(categories[0]?.id || '');
    setClassGrade('Std 11');
    setDivision('A');
    setDob('2008-05-10');
    setPhotoUrl('https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=300&q=80');
    setError('');
    setModalOpen(true);
  };

  const handleOpenEdit = (p: Participant) => {
    setEditingPart(p);
    setName(p.name);
    setEmail(p.email);
    setPhone(p.phone);
    setTeamId(p.teamId);
    setCategoryId(p.categoryId);
    setClassGrade(p.classGrade);
    setDivision(p.division);
    setDob(p.dob);
    setPhotoUrl(p.photoUrl);
    setError('');
    setModalOpen(true);
  };

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (!name) {
      setError('Please provide student full name.');
      return;
    }

    const team = teams.find(t => t.id === teamId);
    if (!team) {
      setError('Please select a valid participating team.');
      return;
    }
    const cat = categories.find(c => c.id === categoryId);

    const partData = {
      name,
      email: email || `${name.toLowerCase().replace(/\s+/g, '.')}@student.institution.org`,
      phone,
      teamId: team.id,
      teamCode: team.code,
      teamName: team.name,
      categoryId,
      categoryName: cat?.name || 'Senior',
      classGrade,
      division,
      dob,
      photoUrl: photoUrl || 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=300&q=80',
      registeredEventIds: editingPart ? editingPart.registeredEventIds : ['cmp-1']
    };

    if (editingPart) {
      updateParticipant(editingPart.id, partData);
    } else {
      addParticipant(partData);
    }

    setModalOpen(false);
  };

  const handleDelete = (id: string, name: string) => {
    if (confirm(`Are you sure you want to remove participant "${name}"?`)) {
      deleteParticipant(id);
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
                        <img
                          src={p.photoUrl || "https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=300&q=80"}
                          alt={p.name}
                          className="w-8 h-8 rounded-full object-cover border border-[#E1E7EF]"
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

        {/* Add/Edit Modal */}
        <Modal
          isOpen={modalOpen}
          onClose={() => setModalOpen(false)}
          title={editingPart ? `Edit Participant (${editingPart.name})` : 'Register New Participant'}
          description="Contestant profile, team allocation, grade tier, and contact information"
          maxWidth="lg"
          footer={
            <div className="flex items-center justify-end gap-2 w-full">
              <Button variant="outline" size="sm" onClick={() => setModalOpen(false)}>
                Cancel
              </Button>
              <Button variant="primary" size="sm" onClick={handleSave}>
                {editingPart ? 'Update Participant' : 'Save & Generate Bib'}
              </Button>
            </div>
          }
        >
          <form onSubmit={handleSave} className="space-y-4">
            {error && (
              <p className="text-xs text-[#DC2626] font-semibold">{error}</p>
            )}

            <Input
              label="Full Student Name"
              placeholder="e.g. Rayan Siddiqui"
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
            />

            <div className="grid grid-cols-2 gap-3">
              <Input
                label="Institutional Email"
                type="email"
                placeholder="student@institution.org"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
              <Input
                label="Contact Phone"
                placeholder="+91 98470 12345"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <Select
                label="Team Guild"
                value={teamId}
                onChange={(e) => setTeamId(e.target.value)}
                options={teams.map(t => ({ value: t.id, label: `${t.name} (${t.code})` }))}
              />
              <Select
                label="Category Division"
                value={categoryId}
                onChange={(e) => setCategoryId(e.target.value)}
                options={categories.map(c => ({ value: c.id, label: c.name }))}
              />
            </div>

            <div className="grid grid-cols-3 gap-3">
              <Input
                label="Class / Grade"
                placeholder="Std 11"
                value={classGrade}
                onChange={(e) => setClassGrade(e.target.value)}
              />
              <Input
                label="Division"
                placeholder="A"
                value={division}
                onChange={(e) => setDivision(e.target.value)}
              />
              <Input
                label="Date of Birth"
                type="date"
                value={dob}
                onChange={(e) => setDob(e.target.value)}
              />
            </div>

            <Input
              label="Student Profile Photo URL"
              placeholder="https://..."
              value={photoUrl}
              onChange={(e) => setPhotoUrl(e.target.value)}
              helperText="Paste direct image URL or leave default for avatar generation"
            />
          </form>
        </Modal>

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
