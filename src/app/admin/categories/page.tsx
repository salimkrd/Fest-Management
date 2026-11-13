'use client';

import React, { useMemo, useState } from 'react';
import { AdminLayout } from '@/components/layout/AdminLayout';
import { useFest } from '@/context/FestContext';
import { Category, CategoryParticipantEligibility } from '@/types/fest';
import { resolveCategoryEligibilityPolicy } from '@/domain/eligibility';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Select } from '@/components/ui/Select';
import { Badge } from '@/components/ui/Badge';
import { Modal } from '@/components/ui/Modal';
import { Plus, Search, Edit2, Trash2, Layers, AlertCircle } from 'lucide-react';

export default function CategoriesPage() {
  const {
    categories,
    participants,
    participantsSyncState,
    competitions,
    competitionsSyncState,
    addCategory,
    updateCategory,
    deleteCategory
  } = useFest();

  // Counts are derived from the live source collections, not cached category
  // counters. This keeps them correct after participant/category/competition
  // changes and avoids showing stale zeroes from older category documents.
  const categoryUsageCounts = useMemo(() => {
    const counts = new Map<string, { participants: number; competitions: number }>();

    for (const category of categories) {
      const normalizedName = category.name.trim().toLocaleLowerCase();
      const normalizedCode = category.code.trim().toLocaleLowerCase();

      const enrolledParticipants = participants.filter(participant => {
        const assignedCategoryId = participant.categoryId?.trim();
        if (assignedCategoryId) return assignedCategoryId === category.id;

        const assignedCategoryName = participant.categoryName?.trim().toLocaleLowerCase();
        if (assignedCategoryName) return assignedCategoryName === normalizedName;

        // Compatibility for older participant records that stored the tier in
        // classGrade but did not persist categoryId/categoryName.
        const legacyTier = participant.classGrade?.trim().toLocaleLowerCase();
        return Boolean(legacyTier && (legacyTier === normalizedName || legacyTier === normalizedCode));
      }).length;

      const assignedCompetitions = competitions.filter(competition => {
        const assignedCategoryId = competition.categoryId?.trim();
        if (assignedCategoryId) return assignedCategoryId === category.id;

        // Older competition records may contain the category name only.
        return competition.categoryName.trim().toLocaleLowerCase() === normalizedName;
      }).length;

      counts.set(category.id, {
        participants: enrolledParticipants,
        competitions: assignedCompetitions
      });
    }

    return counts;
  }, [categories, participants, competitions]);

  const [search, setSearch] = useState('');
  const [modalOpen, setModalOpen] = useState(false);
  const [editingCategory, setEditingCategory] = useState<Category | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  // Form State
  const [name, setName] = useState('');
  const [code, setCode] = useState('');
  const [ageRange, setAgeRange] = useState('');
  const [classRange, setClassRange] = useState('');
  const [eligibility, setEligibility] = useState('');
  const [status, setStatus] = useState<'ACTIVE' | 'INACTIVE'>('ACTIVE');
  const [participantEligibility, setParticipantEligibility] = useState<CategoryParticipantEligibility>('CATEGORY_ONLY');
  const [error, setError] = useState('');

  const filteredCategories = categories.filter(c =>
    c.name.toLowerCase().includes(search.toLowerCase()) ||
    c.code.toLowerCase().includes(search.toLowerCase())
  );

  const handleOpenAdd = () => {
    setEditingCategory(null);
    setName('');
    setCode('');
    setAgeRange('');
    setClassRange('');
    setEligibility('');
    setStatus('ACTIVE');
    setParticipantEligibility('CATEGORY_ONLY');
    setError('');
    setModalOpen(true);
  };

  const handleOpenEdit = (cat: Category) => {
    setEditingCategory(cat);
    setName(cat.name);
    setCode(cat.code);
    setAgeRange(cat.ageRange);
    setClassRange(cat.classRange);
    setEligibility(cat.eligibility);
    setStatus(cat.status);
    setParticipantEligibility(cat.participantEligibility || resolveCategoryEligibilityPolicy(cat));
    setError('');
    setModalOpen(true);
  };

  const [saving, setSaving] = useState(false);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (!name || !code) {
      setError('Please provide category title and code.');
      return;
    }

    setSaving(true);
    try {
      if (editingCategory) {
        await updateCategory(editingCategory.id, {
          name,
          code: code.toUpperCase(),
          ageRange,
          classRange,
          eligibility,
          status,
          participantEligibility
        });
      } else {
        await addCategory({
          name,
          code: code.toUpperCase(),
          ageRange,
          classRange,
          eligibility,
          status,
          participantEligibility
        });
      }
      setModalOpen(false);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to save category.');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: string, name: string) => {
    if (confirm(`Are you sure you want to delete category "${name}"?`)) {
      setActionError(null);
      setDeletingId(id);
      try {
        await deleteCategory(id);
      } catch (err: unknown) {
        setActionError(err instanceof Error ? err.message : 'Failed to delete category.');
      } finally {
        setDeletingId(null);
      }
    }
  };

  return (
    <AdminLayout>
      <div className="mx-auto w-full max-w-[1440px] space-y-6 sm:space-y-7">
        {/* Header */}
        <div className="flex flex-col gap-4 border-b border-slate-200 pb-5 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="text-2xl font-bold tracking-tight text-slate-950 sm:text-[28px]">
              Category Management
            </h1>
            <p className="mt-1.5 max-w-2xl text-sm leading-6 text-slate-500">
              Configure student age groups, division tiers, and institutional competition criteria
            </p>
          </div>
          <Button
            variant="primary"
            size="md"
            leftIcon={<Plus className="w-4 h-4" />}
            onClick={handleOpenAdd}
          >
            Add Division Tier
          </Button>
        </div>

        {/* Action Error Banner */}
        {actionError && (
          <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-xl flex items-center justify-between text-xs">
            <div className="flex items-center gap-2">
              <AlertCircle className="w-4 h-4 text-red-500 shrink-0" />
              <span>{actionError}</span>
            </div>
            <button onClick={() => setActionError(null)} className="text-red-500 hover:text-red-700 font-bold ml-4">
              ✕
            </button>
          </div>
        )}

        {/* Filter bar */}
        <div className="flex flex-col gap-3 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:flex-row sm:items-center sm:justify-between sm:p-5">
          <div className="relative w-full flex-1 sm:max-w-lg">
            <Search className="w-4 h-4 text-[#526070] absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
            <input
              type="text"
              placeholder="Search category name or code..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full rounded-xl border border-slate-200 bg-slate-50 py-3 pl-10 pr-4 text-sm text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-blue-500 focus:bg-white focus:ring-4 focus:ring-blue-500/10"
            />
          </div>
          <span className="text-sm font-medium text-slate-500">
            Showing {filteredCategories.length} categories
          </span>
        </div>

        {/* Categories Table */}
        <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
          <div className="flex flex-col gap-1 border-b border-slate-200 bg-white px-4 py-4 sm:flex-row sm:items-center sm:justify-between sm:px-6">
            <h3 className="text-base font-semibold text-slate-900">Configured categories</h3>
            <span className="text-xs font-medium text-slate-500">{categories.length} total</span>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full min-w-[900px] text-left text-sm">
              <thead>
                <tr className="border-b border-slate-200 bg-slate-50 text-[11px] font-semibold uppercase tracking-wide text-slate-500">
                  <th className="px-5 py-4">Category Name &amp; Code</th>
                  <th className="px-5 py-4">Age / Class Eligibility</th>
                  <th className="px-5 py-4 text-center">Eligibility Policy</th>
                  <th className="px-5 py-4 text-center">Enrolled Participants</th>
                  <th className="px-5 py-4 text-center">Assigned Competitions</th>
                  <th className="px-5 py-4 text-center">System Status</th>
                  <th className="px-5 py-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#E1E7EF]">
                {filteredCategories.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="px-6 py-16 text-center text-sm text-slate-500">
                      <div className="flex flex-col items-center justify-center space-y-2">
                        <Layers className="w-8 h-8 text-[#94A3B8]" />
                        <p className="font-semibold text-sm text-[#111111]">
                          {categories.length === 0 ? 'No categories configured' : 'No categories found'}
                        </p>
                        <p className="text-xs text-[#526070]">
                          {categories.length === 0
                            ? "Use 'Add Division Tier' to create categories."
                            : 'No categories match your search query.'}
                        </p>
                      </div>
                    </td>
                  </tr>
                ) : (
                  filteredCategories.map((cat) => (
                    <tr key={cat.id} className="transition-colors hover:bg-slate-50/80">
                      <td className="px-5 py-5">
                        <div className="flex items-center gap-3">
                          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-blue-100 bg-blue-50 text-blue-600">
                            <Layers className="w-4 h-4" />
                          </div>
                          <div>
                            <span className="block text-sm font-semibold text-slate-900">{cat.name}</span>
                            <span className="mt-1 inline-flex rounded-md bg-slate-100 px-2 py-0.5 font-mono text-xs text-slate-600">{cat.code}</span>
                          </div>
                        </div>
                      </td>
                      <td className="px-5 py-5">
                        <span className="block font-medium text-slate-800">{cat.classRange || '—'}</span>
                        <span className="mt-1 block text-xs text-slate-500">{cat.ageRange || 'Age range not set'}</span>
                      </td>
                      <td className="px-5 py-5 text-center">
                        <span className={`text-[10px] font-bold px-2.5 py-1 rounded-full border ${
                          resolveCategoryEligibilityPolicy(cat) === 'OPEN_TO_ALL'
                            ? 'bg-purple-50 text-purple-700 border-purple-200'
                            : 'bg-blue-50 text-blue-700 border-blue-200'
                        }`}>
                          {resolveCategoryEligibilityPolicy(cat) === 'OPEN_TO_ALL' ? 'Open to All' : 'Restricted'}
                        </span>
                        <span className="text-[10px] text-slate-500 block mt-0.5">
                          {resolveCategoryEligibilityPolicy(cat) === 'OPEN_TO_ALL' ? 'All tiers allowed' : 'Match tier only'}
                        </span>
                      </td>
                      <td className="px-5 py-5 text-center">
                        <span className="font-semibold tabular-nums text-slate-900">
                          {participantsSyncState === 'ready'
                            ? categoryUsageCounts.get(cat.id)?.participants ?? 0
                            : '—'}
                        </span>
                        <span className="mt-1 block text-xs text-slate-500">
                          {participantsSyncState === 'ready'
                            ? 'Participants'
                            : participantsSyncState === 'loading'
                              ? 'Syncing…'
                              : 'Unavailable'}
                        </span>
                      </td>
                      <td className="px-5 py-5 text-center">
                        <span className="font-semibold tabular-nums text-slate-900">
                          {competitionsSyncState === 'ready'
                            ? categoryUsageCounts.get(cat.id)?.competitions ?? 0
                            : '—'}
                        </span>
                        <span className="mt-1 block text-xs text-slate-500">
                          {competitionsSyncState === 'ready'
                            ? 'Competitions'
                            : competitionsSyncState === 'loading'
                              ? 'Syncing…'
                              : 'Unavailable'}
                        </span>
                      </td>
                      <td className="px-5 py-5 text-center">
                        <Badge variant={cat.status === 'ACTIVE' ? 'success' : 'default'} size="sm" dot>
                          {cat.status}
                        </Badge>
                      </td>
                      <td className="px-5 py-5 text-right">
                        <div className="flex items-center justify-end gap-1.5">
                          <button
                            type="button"
                            onClick={() => handleOpenEdit(cat)}
                            className="rounded-lg p-2 text-slate-500 transition-colors hover:bg-blue-50 hover:text-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500/30"
                            title="Edit Category"
                          >
                            <Edit2 className="w-4 h-4" />
                          </button>
                          <button
                            type="button"
                            onClick={() => handleDelete(cat.id, cat.name)}
                            disabled={deletingId === cat.id}
                            className="rounded-lg p-2 text-slate-500 transition-colors hover:bg-red-50 hover:text-red-600 focus:outline-none focus:ring-2 focus:ring-red-500/30 disabled:opacity-50"
                            title="Delete Category"
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
          title={editingCategory ? `Edit Category (${editingCategory.name})` : 'Add New Category Tier'}
          description="Define eligibility boundaries, grade levels, and code for competition categorization"
          maxWidth="md"
          footer={
            <div className="flex items-center justify-end gap-2 w-full">
              <Button variant="outline" size="sm" onClick={() => setModalOpen(false)}>
                Cancel
              </Button>
              <Button
                variant="primary"
                size="sm"
                onClick={handleSave}
                disabled={saving}
                isLoading={saving}
              >
                {editingCategory ? 'Update Category' : 'Save Category'}
              </Button>
            </div>
          }
        >
          <form onSubmit={handleSave} className="space-y-5">
            {error && (
              <p className="text-xs text-[#DC2626] font-semibold">{error}</p>
            )}

            <Input
              label="Category Name"
              placeholder="e.g. Sub Junior"
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
            />

            <Input
              label="Category Code (Short ID)"
              placeholder="e.g. CAT-SJ"
              value={code}
              onChange={(e) => setCode(e.target.value)}
              required
            />

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <Input
                label="Class / Grade Range"
                placeholder="Std 5 - 7"
                value={classRange}
                onChange={(e) => setClassRange(e.target.value)}
              />
              <Input
                label="Age Range"
                placeholder="10 - 12 Years"
                value={ageRange}
                onChange={(e) => setAgeRange(e.target.value)}
              />
            </div>

            <Input
              label="Eligibility Summary"
              placeholder="Enrolled students from middle school"
              value={eligibility}
              onChange={(e) => setEligibility(e.target.value)}
            />

            <div>
              <label className="block text-xs font-bold text-[#111111] mb-1">
                Participant Eligibility
              </label>
              <p className="text-[11px] text-[#526070] mb-2">
                Configure whether competitions under this category are restricted to matching participants or open across tiers.
              </p>
              <div className="space-y-2">
                <label className="flex items-start gap-2.5 p-2.5 rounded-lg border border-[#E1E7EF] hover:bg-[#F8FAFC] cursor-pointer">
                  <input
                    type="radio"
                    name="participantEligibility"
                    value="CATEGORY_ONLY"
                    checked={participantEligibility === 'CATEGORY_ONLY'}
                    onChange={() => setParticipantEligibility('CATEGORY_ONLY')}
                    className="mt-0.5 text-[#2563EB] focus:ring-[#2563EB]"
                  />
                  <div>
                    <span className="text-xs font-bold text-[#111111] block">
                      Restricted to This Category (Default)
                    </span>
                    <span className="text-[11px] text-[#526070] block">
                      Only participants assigned to this specific category can register (e.g. Junior competitions allow only Junior participants).
                    </span>
                  </div>
                </label>
                <label className="flex items-start gap-2.5 p-2.5 rounded-lg border border-[#E1E7EF] hover:bg-[#F8FAFC] cursor-pointer">
                  <input
                    type="radio"
                    name="participantEligibility"
                    value="OPEN_TO_ALL"
                    checked={participantEligibility === 'OPEN_TO_ALL'}
                    onChange={() => setParticipantEligibility('OPEN_TO_ALL')}
                    className="mt-0.5 text-[#2563EB] focus:ring-[#2563EB]"
                  />
                  <div>
                    <span className="text-xs font-bold text-[#111111] block">
                      Open to All Categories
                    </span>
                    <span className="text-[11px] text-[#526070] block">
                      Participants from any academic category (Sub Junior, Junior, Senior, etc.) can register (e.g. General / campus-wide events).
                    </span>
                  </div>
                </label>
              </div>
            </div>

            <Select
              label="System Status"
              value={status}
              onChange={(e) => setStatus(e.target.value as 'ACTIVE' | 'INACTIVE')}
              options={[
                { value: 'ACTIVE', label: 'Active (Available for registrations)' },
                { value: 'INACTIVE', label: 'Inactive (Disabled)' }
              ]}
            />
          </form>
        </Modal>
      </div>
    </AdminLayout>
  );
}
