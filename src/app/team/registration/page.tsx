'use client';

import React, { useEffect, useState } from 'react';
import { TeamLayout } from '@/components/layout/TeamLayout';
import { TeamSyncStatus } from '@/components/domain/TeamSyncStatus';
import { useFest } from '@/context/FestContext';
import { isParticipantEligibleForCategory } from '@/domain/eligibility';
import { Button } from '@/components/ui/Button';
import { Select } from '@/components/ui/Select';
import { Badge } from '@/components/ui/Badge';
import { Modal } from '@/components/ui/Modal';
import { Plus, Search, Trash2, ClipboardList, CalendarDays, Users } from 'lucide-react';

export default function TeamRegistrationPage() {
  const {
    currentTeamUser,
    registrations,
    registrationsSyncState,
    categories,
    categoriesSyncState,
    competitions,
    competitionsSyncState,
    participants,
    participantsSyncState,
    addRegistration,
    deleteRegistration
  } = useFest();

  const team = currentTeamUser;
  const [search, setSearch] = useState('');
  const [modalOpen, setModalOpen] = useState(false);
  const [categoryId, setCategoryId] = useState('');
  const [competitionId, setCompetitionId] = useState('');
  const [participantIds, setParticipantIds] = useState<string[]>([]);
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);
  const [deletingId, setDeletingId] = useState('');

  // Firestore data arrives asynchronously. Keep category and competition selections
  // valid when the live lists first load or change while the manager is signed in.
  useEffect(() => {
    if (categories.length === 0) {
      if (categoryId) setCategoryId('');
      if (competitionId) setCompetitionId('');
      return;
    }

    const categoryStillExists = categories.some(category => category.id === categoryId);
    const nextCategoryId = categoryStillExists ? categoryId : categories[0].id;
    if (nextCategoryId !== categoryId) setCategoryId(nextCategoryId);

    const competitionsForCategory = competitions.filter(comp => comp.categoryId === nextCategoryId);
    const selectedIsValid = competitionsForCategory.some(comp => comp.id === competitionId);
    if (!selectedIsValid) {
      setCompetitionId(competitionsForCategory[0]?.id || '');
    }
  }, [categories, competitions, categoryId, competitionId]);

  // Every list is scoped to the authenticated team; never fall back to the first team.
  const myRegistrations = registrations.filter(registration => registration.teamId === team?.id);
  const myTeamParticipants = participants.filter(participant => participant.teamId === team?.id);
  const selectedCategory = categories.find(category => category.id === categoryId);
  const availableCompetitions = competitions.filter(comp => comp.categoryId === categoryId);
  const selectedCompetition = availableCompetitions.find(comp => comp.id === competitionId);
  const isGroup = selectedCompetition?.type === 'GROUP';

  const teamEligibleParticipants = myTeamParticipants.filter(participant =>
    isParticipantEligibleForCategory(participant, selectedCategory, categories)
  );

  const normalizedSearch = search.trim().toLowerCase();
  const filtered = myRegistrations.filter(registration =>
    registration.participantName.toLowerCase().includes(normalizedSearch) ||
    registration.competitionName.toLowerCase().includes(normalizedSearch) ||
    registration.code.toLowerCase().includes(normalizedSearch)
  );

  const handleOpenAdd = () => {
    const initialCategoryId = categories[0]?.id || '';
    const initialCompetitions = competitions.filter(comp => comp.categoryId === initialCategoryId);
    setCategoryId(initialCategoryId);
    setCompetitionId(initialCompetitions[0]?.id || '');
    setParticipantIds([]);
    setError('');
    setModalOpen(true);
  };

  const handleCategoryChange = (nextCategoryId: string) => {
    setCategoryId(nextCategoryId);
    const matchingCompetitions = competitions.filter(comp => comp.categoryId === nextCategoryId);
    setCompetitionId(matchingCompetitions[0]?.id || '');
    setParticipantIds([]);
    setError('');
  };

  const handleCompetitionChange = (nextCompetitionId: string) => {
    const competition = competitions.find(comp => comp.id === nextCompetitionId);
    setCompetitionId(nextCompetitionId);
    if (competition?.categoryId) setCategoryId(competition.categoryId);
    setParticipantIds([]);
    setError('');
  };

  const toggleParticipant = (participantId: string) => {
    setParticipantIds(current => current.includes(participantId)
      ? current.filter(id => id !== participantId)
      : [...current, participantId]);
  };

  const handleSave = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (saving) return;

    const category = categories.find(item => item.id === categoryId);
    const competition = availableCompetitions.find(item => item.id === competitionId);
    if (!competition) {
      setError('Choose a competition from the selected category.');
      return;
    }

    const selectedParticipants = teamEligibleParticipants.filter(item => participantIds.includes(item.id));
    if (selectedParticipants.length !== participantIds.length || selectedParticipants.length === 0) {
      setError(isGroup
        ? 'Choose at least one eligible group leader.'
        : 'Choose at least one eligible participant from your team roster.');
      return;
    }
    if (!competition) return;
    if (competition.type === 'SOLO') {
      const maximumEntries = Math.max(1, Number(competition.maxEntriesPerTeam) || 1);
      const activeEntries = myRegistrations.filter(registration =>
        registration.competitionId === competition.id &&
        registration.status !== 'REJECTED' &&
        registration.status !== 'CANCELLED'
      ).length;
      if (activeEntries + selectedParticipants.length > maximumEntries) {
        setError(`This competition allows ${maximumEntries} entries from your team; ${activeEntries} already registered.`);
        return;
      }
    }

    if (!team) {
      setError('No active team is assigned to this manager session.');
      return;
    }

    setSaving(true);
    setError('');
    try {
      const groupEntry = competition.type === 'GROUP';
      await addRegistration({
        participantIds: groupEntry ? undefined : selectedParticipants.map(participant => participant.id),
        groupLeaderIds: groupEntry ? selectedParticipants.map(participant => participant.id) : undefined,
        participantName: selectedParticipants.map(participant => participant.name).join(', '),
        teamId: team.id,
        teamCode: team.code,
        teamName: team.name,
        categoryId: competition.categoryId || categoryId,
        categoryName: competition.categoryName || category?.name || 'General',
        competitionId: competition.id,
        competitionName: competition.name,
        type: competition.type,
        chestNumber: '',
        status: 'APPROVED'
      });
      setModalOpen(false);
      setParticipantIds([]);
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : 'Could not register for the competition.');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: string, name: string) => {
    if (!team || deletingId) return;
    if (!window.confirm(`Cancel the event registration for "${name}"?`)) return;

    setDeletingId(id);
    try {
      await deleteRegistration(id);
    } catch (deleteError) {
      window.alert(deleteError instanceof Error ? deleteError.message : 'Failed to cancel registration.');
    } finally {
      setDeletingId('');
    }
  };

  const statusClass = (status: string) => {
    if (status === 'APPROVED') return 'border-emerald-200 bg-emerald-50 text-emerald-700';
    if (status === 'REJECTED') return 'border-red-200 bg-red-50 text-red-700';
    return 'border-amber-200 bg-amber-50 text-amber-700';
  };

  return (
    <TeamLayout>
      <div className="space-y-5 sm:space-y-6">
        <header className="flex flex-col gap-4 border-b border-slate-200 pb-5 sm:flex-row sm:items-end sm:justify-between">
          <div className="min-w-0">
            <div className="mb-1 flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.12em] text-blue-700">
              <ClipboardList className="h-4 w-4" />
              Event entries
            </div>
            <h1 className="text-2xl font-bold tracking-tight text-slate-950 sm:text-[28px]">Competition Registration</h1>
            <p className="mt-1.5 text-sm leading-5 text-slate-600">
              Register eligible participants from {team?.name || 'your team'} for individual and group competitions.
            </p>
          </div>
          <Button
            variant="primary"
            size="lg"
            className="w-full shrink-0 !rounded-xl sm:w-auto"
            leftIcon={<Plus className="h-4 w-4" />}
            onClick={handleOpenAdd}
            disabled={!team || categories.length === 0 || competitions.length === 0}
          >
            Enroll in Competition
          </Button>
        </header>

        <TeamSyncStatus sources={['participants', 'registrations', 'categories', 'competitions']} />

        <section className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-3">
          <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:p-5">
            <div className="flex items-center gap-2 text-xs font-semibold text-slate-500">
              <ClipboardList className="h-4 w-4 text-blue-700" />
              Event entries
            </div>
            <p className="mt-2 text-2xl font-bold tabular-nums text-slate-950">{myRegistrations.length}</p>
            <p className="mt-1 text-xs text-slate-500">For your contingent</p>
          </div>
          <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:p-5">
            <div className="flex items-center gap-2 text-xs font-semibold text-slate-500">
              <Users className="h-4 w-4 text-emerald-700" />
              Eligible roster
            </div>
            <p className="mt-2 text-2xl font-bold tabular-nums text-slate-950">{myTeamParticipants.length}</p>
            <p className="mt-1 text-xs text-slate-500">Registered team members</p>
          </div>
          <div className="col-span-2 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:p-5 lg:col-span-1">
            <div className="flex items-center gap-2 text-xs font-semibold text-slate-500">
              <CalendarDays className="h-4 w-4 text-violet-700" />
              Competitions available
            </div>
            <p className="mt-2 text-2xl font-bold tabular-nums text-slate-950">{competitions.length}</p>
            <p className="mt-1 text-xs text-slate-500">Across all categories</p>
          </div>
        </section>

        <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
          <div className="flex flex-col gap-3 border-b border-slate-200 p-4 sm:flex-row sm:items-center sm:justify-between sm:p-5">
            <div>
              <h2 className="text-sm font-bold text-slate-950">Your event registrations</h2>
              <p className="mt-1 text-xs text-slate-500">Only entries belonging to your assigned team are shown.</p>
            </div>
            <div className="relative w-full sm:w-72">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
              <input
                type="search"
                aria-label="Search registrations"
                placeholder="Search contestant, event or code…"
                value={search}
                onChange={event => setSearch(event.target.value)}
                className="min-h-11 w-full rounded-xl border border-slate-300 bg-white py-2.5 pl-9 pr-3 text-sm text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-blue-600 focus:ring-2 focus:ring-blue-100"
              />
            </div>
          </div>

          {registrationsSyncState === 'loading' && myRegistrations.length === 0 ? (
            <div className="p-10 text-center text-sm text-slate-500">Loading your team registrations…</div>
          ) : registrationsSyncState === 'error' ? (
            <div className="p-8 text-center text-sm text-amber-800">Registration data could not be synchronized. Please refresh after your connection is restored.</div>
          ) : filtered.length === 0 ? (
            <div className="px-5 py-12 text-center">
              <ClipboardList className="mx-auto h-9 w-9 text-slate-300" />
              <h3 className="mt-3 text-sm font-semibold text-slate-900">
                {myRegistrations.length === 0 ? 'No event registrations yet' : 'No registrations match this search'}
              </h3>
              <p className="mx-auto mt-1 max-w-md text-xs leading-5 text-slate-500">
                {myRegistrations.length === 0
                  ? 'Enroll an eligible participant in an available competition to create your first entry.'
                  : 'Try another contestant name, competition title or registration code.'}
              </p>
            </div>
          ) : (
            <>
              <div className="space-y-3 p-3 md:hidden">
                {filtered.map(registration => (
                  <article key={registration.id} className="rounded-xl border border-slate-200 p-3.5">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <p className="break-words text-sm font-semibold text-slate-950">{registration.participantName}</p>
                        <p className="mt-1 text-xs text-slate-500">{registration.competitionName}</p>
                      </div>
                      <span className={`shrink-0 rounded-full border px-2.5 py-1 text-[10px] font-bold ${statusClass(registration.status)}`}>
                        {registration.status}
                      </span>
                    </div>
                    <div className="mt-3 grid grid-cols-2 gap-x-3 gap-y-2 border-t border-slate-100 pt-3 text-xs">
                      <div><span className="text-slate-500">Reg. code</span><p className="mt-0.5 font-mono font-semibold text-slate-800">{registration.code}</p></div>
                      <div><span className="text-slate-500">Category / type</span><p className="mt-0.5 font-medium text-slate-800">{registration.categoryName} · {registration.type === 'SOLO' ? 'Individual' : 'Group'}</p></div>
                      <div><span className="text-slate-500">Bib / chest</span><p className="mt-0.5 font-mono font-semibold text-slate-800">{registration.chestNumber || '—'}</p></div>
                    </div>
                    <div className="mt-3 flex justify-end border-t border-slate-100 pt-2">
                      <button
                        type="button"
                        onClick={() => handleDelete(registration.id, registration.participantName)}
                        disabled={!!deletingId}
                        className="inline-flex min-h-10 items-center gap-2 rounded-lg px-3 text-xs font-semibold text-red-700 transition hover:bg-red-50 disabled:opacity-50"
                      >
                        {deletingId === registration.id ? <span className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-red-200 border-t-red-700" /> : <Trash2 className="h-3.5 w-3.5" />}
                        Cancel entry
                      </button>
                    </div>
                  </article>
                ))}
              </div>

              <div className="hidden overflow-x-auto md:block">
                <table className="min-w-[800px] w-full text-left text-sm">
                  <thead className="bg-slate-50 text-[11px] font-semibold uppercase tracking-wide text-slate-500">
                    <tr>
                      <th className="px-5 py-3.5">Reg. code</th>
                      <th className="px-5 py-3.5">Participant / group</th>
                      <th className="px-5 py-3.5">Competition</th>
                      <th className="px-5 py-3.5">Category</th>
                      <th className="px-5 py-3.5">Type</th>
                      <th className="px-5 py-3.5 text-center">Status</th>
                      <th className="px-5 py-3.5 text-right">Action</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {filtered.map(registration => (
                      <tr key={registration.id} className="transition hover:bg-slate-50/80">
                        <td className="px-5 py-4 font-mono text-xs font-semibold text-blue-700">{registration.code}</td>
                        <td className="px-5 py-4">
                          <p className="text-sm font-semibold text-slate-900">{registration.participantName}</p>
                          <p className="mt-0.5 text-xs text-slate-500">Bib / chest: {registration.chestNumber || '—'}</p>
                        </td>
                        <td className="px-5 py-4 text-sm font-medium text-slate-800">{registration.competitionName}</td>
                        <td className="px-5 py-4 text-sm text-slate-600">{registration.categoryName}</td>
                        <td className="px-5 py-4 text-sm text-slate-600">{registration.type === 'SOLO' ? 'Individual' : 'Group'}</td>
                        <td className="px-5 py-4 text-center">
                          <span className={`inline-flex rounded-full border px-2.5 py-1 text-[10px] font-bold ${statusClass(registration.status)}`}>{registration.status}</span>
                        </td>
                        <td className="px-5 py-4 text-right">
                          <button
                            type="button"
                            onClick={() => handleDelete(registration.id, registration.participantName)}
                            disabled={!!deletingId}
                            aria-label={`Cancel ${registration.participantName} registration`}
                            className="inline-flex h-9 w-9 items-center justify-center rounded-lg text-slate-500 transition hover:bg-red-50 hover:text-red-700 disabled:opacity-50"
                          >
                            {deletingId === registration.id ? <span className="h-4 w-4 animate-spin rounded-full border-2 border-slate-300 border-t-red-600" /> : <Trash2 className="h-4 w-4" />}
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </>
          )}
        </section>

        <Modal
          isOpen={modalOpen}
          onClose={() => {
            if (!saving) setModalOpen(false);
          }}
          title={`Enroll Contestant: ${team?.name || 'My Team'}`}
          description="Choose a category, competition and eligible team participant."
          maxWidth="md"
          footer={
            <div className="flex w-full flex-col-reverse gap-2 sm:flex-row sm:justify-end">
              <Button variant="outline" size="md" className="w-full sm:w-auto" onClick={() => setModalOpen(false)} disabled={saving}>
                Cancel
              </Button>
              <Button
                variant="primary"
                size="md"
                className="w-full sm:w-auto"
                type="submit"
                form="team-registration-form"
                disabled={saving || !selectedCompetition || participantIds.length === 0}
                isLoading={saving}
              >
                Confirm Entry
              </Button>
            </div>
          }
        >
          <form id="team-registration-form" onSubmit={handleSave} className="space-y-4">
            {error && <p role="alert" className="rounded-xl border border-red-200 bg-red-50 px-3.5 py-3 text-xs font-medium leading-5 text-red-700">{error}</p>}

            <Select
              label="Select Category"
              value={categoryId}
              onChange={event => handleCategoryChange(event.target.value)}
              options={categories.map(category => ({ value: category.id, label: category.name }))}
            />

            <Select
              label="Select Competition"
              value={competitionId}
              onChange={event => handleCompetitionChange(event.target.value)}
              options={availableCompetitions.map(comp => ({
                value: comp.id,
                label: `${comp.name} (${comp.type === 'SOLO' ? 'Individual' : 'Group'})`
              }))}
            />

            {categoriesSyncState === 'loading' || competitionsSyncState === 'loading' ? (
              <p className="rounded-xl bg-blue-50 px-3.5 py-3 text-xs text-blue-800">Loading the latest categories and competitions…</p>
            ) : availableCompetitions.length === 0 ? (
              <p className="rounded-xl border border-amber-200 bg-amber-50 px-3.5 py-3 text-xs leading-5 text-amber-800">
                No competitions are currently listed under {selectedCategory?.name || 'this category'}.
              </p>
            ) : null}

            {selectedCompetition && (
              <div className="rounded-xl border border-slate-200 bg-slate-50 px-3.5 py-3 text-xs leading-5 text-slate-700">
                <p className="font-semibold text-slate-900">{selectedCompetition.name}</p>
                <p className="mt-0.5">{selectedCompetition.code} · {selectedCompetition.type === 'SOLO' ? 'Individual event' : `Group event · ${selectedCompetition.groupSize || 'Group size not set'} members`}</p>
              </div>
            )}

            <div className="space-y-2">
              <div className="flex items-center justify-between gap-2">
                <label className="text-sm font-semibold text-slate-800">{isGroup ? 'Select Group Leader(s)' : 'Select Team Participant(s)'}</label>
                <span className="text-xs font-semibold text-blue-700">{participantIds.length} selected</span>
              </div>
              <div className="max-h-64 overflow-y-auto rounded-xl border border-slate-200 bg-white divide-y divide-slate-100">
                {teamEligibleParticipants.map(participant => (
                  <label key={participant.id} className="flex cursor-pointer items-center gap-3 px-3 py-3 hover:bg-slate-50">
                    <input
                      type="checkbox"
                      checked={participantIds.includes(participant.id)}
                      onChange={() => toggleParticipant(participant.id)}
                      className="h-4 w-4 shrink-0 rounded border-slate-300 text-blue-600 focus:ring-blue-500"
                    />
                    <span className="min-w-0 flex-1">
                      <span className="block text-sm font-medium text-slate-900">{participant.name}</span>
                      <span className="block text-xs text-slate-500">{participant.bib || 'No Bib'}</span>
                    </span>
                  </label>
                ))}
                {participantsSyncState === 'loading' ? (
                  <p className="px-3 py-4 text-xs text-blue-700">Loading your team roster…</p>
                ) : teamEligibleParticipants.length === 0 ? (
                  <p className="px-3 py-4 text-xs text-amber-700">
                    {myTeamParticipants.length === 0
                      ? 'Your team has no participants yet. Add participants from My Participants first.'
                      : `No team participants are eligible for ${selectedCategory?.name || 'this category'}.`}
                  </p>
                ) : null}
              </div>
              <p className="text-xs leading-5 text-slate-500">
                {isGroup
                  ? `Select one leader for each group. Each leader creates a separate group entry; group members are not individually registered. Championship points remain credited to the team.`
                  : 'Select multiple contestants in one submission. Each contestant gets a separate registration and Bib number.'}
              </p>
            </div>
          </form>
        </Modal>
      </div>
    </TeamLayout>
  );
}
