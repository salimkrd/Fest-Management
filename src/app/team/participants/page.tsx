'use client';

import React, { useState } from 'react';
import { TeamLayout } from '@/components/layout/TeamLayout';
import { TeamSyncStatus } from '@/components/domain/TeamSyncStatus';
import { useFest } from '@/context/FestContext';
import { Participant } from '@/types/fest';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { DigitalIdCard } from '@/components/domain/DigitalIdCard';
import { ParticipantEditorModal } from '@/components/domain/ParticipantEditorModal';
import { ParticipantPhoto } from '@/components/domain/ParticipantPhoto';
import { Plus, Search, Edit2, Trash2, IdCard, Users, ClipboardList } from 'lucide-react';

export default function TeamParticipantsPage() {
  const {
    currentTeamUser,
    teams,
    participants,
    participantsSyncState,
    categories,
    categoriesSyncState,
    teamsSyncState,
    addParticipant,
    updateParticipant,
    deleteParticipant
  } = useFest();

  const team = currentTeamUser
    ? teams.find(candidate => candidate.id === currentTeamUser.id) || currentTeamUser
    : null;

  const [search, setSearch] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('ALL');
  const [modalOpen, setModalOpen] = useState(false);
  const [editingPart, setEditingPart] = useState<Participant | null>(null);
  const [selectedIdCard, setSelectedIdCard] = useState<Participant | null>(null);
  const [deletingId, setDeletingId] = useState('');

  // The Firestore query is scoped to the authenticated manager's team.
  const myParticipants = participants.filter(participant => participant.teamId === team?.id);
  const normalizedSearch = search.trim().toLowerCase();

  const filtered = myParticipants.filter(participant => {
    const matchesSearch =
      participant.name.toLowerCase().includes(normalizedSearch) ||
      (participant.bib || '').toLowerCase().includes(normalizedSearch) ||
      (participant.phone || '').toLowerCase().includes(normalizedSearch);
    const matchesCategory = categoryFilter === 'ALL' || participant.categoryId === categoryFilter;
    return matchesSearch && matchesCategory;
  });

  const handleOpenAdd = () => {
    if (!team) return;
    setEditingPart(null);
    setModalOpen(true);
  };

  const handleOpenEdit = (participant: Participant) => {
    if (!team || participant.teamId !== team.id) return;
    setEditingPart(participant);
    setModalOpen(true);
  };

  const handleSave = async (data: Omit<Participant, 'id' | 'bib' | 'idStatus'>) => {
    if (!team || data.teamId !== team.id || (editingPart && editingPart.teamId !== team.id)) {
      throw new Error('You can only manage participants belonging to your assigned team.');
    }

    if (editingPart) {
      // Preserve server-managed registration links while editing permitted profile fields.
      const profileUpdates: Partial<Participant> = { ...data };
      delete profileUpdates.registeredEventIds;
      await updateParticipant(editingPart.id, profileUpdates);
    } else {
      await addParticipant(data);
    }
  };

  const handleDelete = async (participant: Participant) => {
    if (!team || participant.teamId !== team.id || deletingId) return;
    const confirmed = window.confirm(`Remove "${participant.name}" from your team roster?`);
    if (!confirmed) return;

    setDeletingId(participant.id);
    try {
      await deleteParticipant(participant.id);
    } catch (error) {
      window.alert(error instanceof Error ? error.message : 'Failed to remove participant.');
    } finally {
      setDeletingId('');
    }
  };

  return (
    <TeamLayout>
      <div className="space-y-5 sm:space-y-6">
        <header className="flex flex-col gap-4 border-b border-slate-200 pb-5 sm:flex-row sm:items-end sm:justify-between">
          <div className="min-w-0">
            <div className="mb-1 flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.12em] text-blue-700">
              <Users className="h-4 w-4" />
              Team roster
            </div>
            <h1 className="text-2xl font-bold tracking-tight text-slate-950 sm:text-[28px]">My Team Participants</h1>
            <p className="mt-1.5 text-sm leading-5 text-slate-600">
              Manage the registered contestants for {team?.name || 'your team'}.
            </p>
          </div>
          <Button
            variant="primary"
            size="lg"
            className="w-full shrink-0 !rounded-xl sm:w-auto"
            leftIcon={<Plus className="h-4 w-4" />}
            onClick={handleOpenAdd}
            disabled={!team}
          >
            Add Participant
          </Button>
        </header>

        <TeamSyncStatus sources={['teams', 'categories', 'participants']} />

        <section className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-3">
          <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:p-5">
            <div className="flex items-center gap-2 text-xs font-semibold text-slate-500">
              <Users className="h-4 w-4 text-blue-700" />
              Total participants
            </div>
            <p className="mt-2 text-2xl font-bold tabular-nums text-slate-950">{myParticipants.length}</p>
            <p className="mt-1 text-xs text-slate-500">In your team roster</p>
          </div>
          <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:p-5">
            <div className="flex items-center gap-2 text-xs font-semibold text-slate-500">
              <ClipboardList className="h-4 w-4 text-emerald-700" />
              Filtered results
            </div>
            <p className="mt-2 text-2xl font-bold tabular-nums text-slate-950">{filtered.length}</p>
            <p className="mt-1 text-xs text-slate-500">Matching current filters</p>
          </div>
          <div className="col-span-2 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:p-5 lg:col-span-1">
            <p className="text-xs font-semibold text-slate-500">Assigned contingent</p>
            <p className="mt-2 truncate text-base font-bold text-slate-950">{team?.name || 'Team not available'}</p>
            <p className="mt-1 text-xs text-slate-500">{team?.code || '—'} · {team?.zone || 'House contingent'}</p>
          </div>
        </section>

        <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
          <div className="flex flex-col gap-3 border-b border-slate-200 p-4 sm:flex-row sm:items-center sm:justify-between sm:p-5">
            <div>
              <h2 className="text-sm font-bold text-slate-950">Participant directory</h2>
              <p className="mt-1 text-xs text-slate-500">Search by name, Bib number or contact number.</p>
            </div>
            <div className="flex w-full flex-col gap-2 sm:w-auto sm:flex-row">
              <div className="relative w-full sm:w-64">
                <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                <input
                  type="search"
                  aria-label="Search participants"
                  placeholder="Search team participants…"
                  value={search}
                  onChange={event => setSearch(event.target.value)}
                  className="min-h-11 w-full rounded-xl border border-slate-300 bg-white py-2.5 pl-9 pr-3 text-sm text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-blue-600 focus:ring-2 focus:ring-blue-100"
                />
              </div>
              <select
                aria-label="Filter participants by category"
                value={categoryFilter}
                onChange={event => setCategoryFilter(event.target.value)}
                className="min-h-11 w-full rounded-xl border border-slate-300 bg-white px-3 text-sm font-medium text-slate-700 outline-none focus:border-blue-600 focus:ring-2 focus:ring-blue-100 sm:w-48"
              >
                <option value="ALL">All categories</option>
                {categories.map(category => (
                  <option key={category.id} value={category.id}>{category.name}</option>
                ))}
              </select>
            </div>
          </div>

          {participantsSyncState === 'loading' && myParticipants.length === 0 ? (
            <div className="p-10 text-center text-sm text-slate-500">Loading your team participants…</div>
          ) : participantsSyncState === 'error' ? (
            <div className="p-8 text-center text-sm text-amber-800">Participant data could not be synchronized. Please refresh the page after your connection is restored.</div>
          ) : filtered.length === 0 ? (
            <div className="px-5 py-12 text-center">
              <Users className="mx-auto h-9 w-9 text-slate-300" />
              <h3 className="mt-3 text-sm font-semibold text-slate-900">
                {myParticipants.length === 0 ? 'No participants added yet' : 'No participants match these filters'}
              </h3>
              <p className="mx-auto mt-1 max-w-md text-xs leading-5 text-slate-500">
                {myParticipants.length === 0
                  ? 'Add your first participant to build your team roster.'
                  : 'Try another search term or choose a different category.'}
              </p>
              {myParticipants.length === 0 && (
                <Button className="mt-4" size="md" leftIcon={<Plus className="h-4 w-4" />} onClick={handleOpenAdd}>
                  Add Participant
                </Button>
              )}
            </div>
          ) : (
            <>
              <div className="space-y-3 p-3 md:hidden">
                {filtered.map(participant => (
                  <article key={participant.id} className="rounded-xl border border-slate-200 p-3.5">
                    <div className="flex min-w-0 items-start gap-3">
                      <ParticipantPhoto
                        photoUrl={participant.photoUrl}
                        name={participant.name}
                        size="md"
                        shape="circle"
                        className="shrink-0 border border-slate-200"
                      />
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <h3 className="break-words text-sm font-semibold text-slate-950">{participant.name}</h3>
                          <Badge variant="success" size="sm">{participant.idStatus || 'ID READY'}</Badge>
                        </div>
                        <p className="mt-1 text-xs text-slate-500">Bib: <span className="font-mono font-semibold text-slate-700">{participant.bib || '—'}</span></p>
                        <p className="mt-1 text-xs text-slate-600">{participant.categoryName || 'Uncategorized'} · {participant.classGrade || 'Class not set'}</p>
                        <p className="mt-1 text-xs text-slate-500">{participant.phone || 'No contact number'}</p>
                      </div>
                    </div>
                    <div className="mt-3 flex items-center justify-between border-t border-slate-100 pt-3">
                      <span className="text-xs font-medium text-slate-600">
                        {(participant.registeredEventIds || []).length} event registrations
                      </span>
                      <div className="flex items-center gap-1.5">
                        <button type="button" onClick={() => setSelectedIdCard(participant)} aria-label={`Open ID card for ${participant.name}`} className="flex h-10 w-10 items-center justify-center rounded-lg text-slate-600 transition hover:bg-blue-50 hover:text-blue-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500">
                          <IdCard className="h-4 w-4" />
                        </button>
                        <button type="button" onClick={() => handleOpenEdit(participant)} aria-label={`Edit ${participant.name}`} className="flex h-10 w-10 items-center justify-center rounded-lg text-slate-600 transition hover:bg-blue-50 hover:text-blue-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500">
                          <Edit2 className="h-4 w-4" />
                        </button>
                        <button type="button" onClick={() => handleDelete(participant)} disabled={deletingId === participant.id || !!deletingId} aria-label={`Remove ${participant.name}`} className="flex h-10 w-10 items-center justify-center rounded-lg text-slate-600 transition hover:bg-red-50 hover:text-red-700 disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-500">
                          {deletingId === participant.id ? <span className="h-4 w-4 animate-spin rounded-full border-2 border-slate-300 border-t-red-600" /> : <Trash2 className="h-4 w-4" />}
                        </button>
                      </div>
                    </div>
                  </article>
                ))}
              </div>

              <div className="hidden overflow-x-auto md:block">
                <table className="min-w-[780px] w-full text-left text-sm">
                  <thead className="bg-slate-50 text-[11px] font-semibold uppercase tracking-wide text-slate-500">
                    <tr>
                      <th className="px-5 py-3.5">Bib</th>
                      <th className="px-5 py-3.5">Participant</th>
                      <th className="px-5 py-3.5">Category</th>
                      <th className="px-5 py-3.5">Class</th>
                      <th className="px-5 py-3.5 text-center">Events</th>
                      <th className="px-5 py-3.5 text-center">Digital ID</th>
                      <th className="px-5 py-3.5 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {filtered.map(participant => (
                      <tr key={participant.id} className="transition hover:bg-slate-50/80">
                        <td className="px-5 py-4 font-mono text-xs font-bold text-slate-700">{participant.bib || '—'}</td>
                        <td className="px-5 py-4">
                          <div className="flex items-center gap-3">
                            <ParticipantPhoto photoUrl={participant.photoUrl} name={participant.name} size="sm" shape="circle" className="border border-slate-200" />
                            <div className="min-w-0">
                              <p className="truncate text-sm font-semibold text-slate-900">{participant.name}</p>
                              <p className="mt-0.5 text-xs text-slate-500">{participant.phone || '—'}</p>
                            </div>
                          </div>
                        </td>
                        <td className="px-5 py-4 text-sm text-slate-700">{participant.categoryName || '—'}</td>
                        <td className="px-5 py-4 text-sm text-slate-600">{participant.classGrade || '—'}</td>
                        <td className="px-5 py-4 text-center text-sm font-semibold tabular-nums text-slate-700">{(participant.registeredEventIds || []).length}</td>
                        <td className="px-5 py-4 text-center"><Badge variant="success" size="sm">{participant.idStatus || 'ID READY'}</Badge></td>
                        <td className="px-5 py-4">
                          <div className="flex items-center justify-end gap-1">
                            <button type="button" onClick={() => setSelectedIdCard(participant)} aria-label={`Open ID card for ${participant.name}`} className="flex h-9 w-9 items-center justify-center rounded-lg text-slate-600 transition hover:bg-blue-50 hover:text-blue-700">
                              <IdCard className="h-4 w-4" />
                            </button>
                            <button type="button" onClick={() => handleOpenEdit(participant)} aria-label={`Edit ${participant.name}`} className="flex h-9 w-9 items-center justify-center rounded-lg text-slate-600 transition hover:bg-blue-50 hover:text-blue-700">
                              <Edit2 className="h-4 w-4" />
                            </button>
                            <button type="button" onClick={() => handleDelete(participant)} disabled={deletingId === participant.id || !!deletingId} aria-label={`Remove ${participant.name}`} className="flex h-9 w-9 items-center justify-center rounded-lg text-slate-600 transition hover:bg-red-50 hover:text-red-700 disabled:opacity-50">
                              {deletingId === participant.id ? <span className="h-4 w-4 animate-spin rounded-full border-2 border-slate-300 border-t-red-600" /> : <Trash2 className="h-4 w-4" />}
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </>
          )}
        </section>

        {modalOpen && (
          <ParticipantEditorModal
            participant={editingPart}
            teams={teams}
            categories={categories}
            lockedTeam={team}
            onSave={handleSave}
            onClose={() => setModalOpen(false)}
          />
        )}

        <DigitalIdCard
          participant={selectedIdCard}
          isOpen={!!selectedIdCard}
          onClose={() => setSelectedIdCard(null)}
        />
      </div>
    </TeamLayout>
  );
}
