'use client';

import React, { useState } from 'react';
import { AdminLayout } from '@/components/layout/AdminLayout';
import { useFest } from '@/context/FestContext';
import { Category } from '@/types/fest';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Select } from '@/components/ui/Select';
import { Badge } from '@/components/ui/Badge';
import { Modal } from '@/components/ui/Modal';
import {
  Plus,
  Search,
  Edit2,
  Trash2,
  Layers,
  CheckCircle2,
  AlertCircle,
  X,
  Users2,
  Trophy,
  CirclePause,
  ArrowUpRight
} from 'lucide-react';

export default function CategoriesPage() {
  const { categories, addCategory, updateCategory, deleteCategory } = useFest();

  const [search, setSearch] = useState('');
  const [modalOpen, setModalOpen] = useState(false);
  const [editingCategory, setEditingCategory] = useState<Category | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const [name, setName] = useState('');
  const [code, setCode] = useState('');
  const [ageRange, setAgeRange] = useState('');
  const [classRange, setClassRange] = useState('');
  const [eligibility, setEligibility] = useState('');
  const [status, setStatus] = useState<'ACTIVE' | 'INACTIVE'>('ACTIVE');
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);

  const query = search.trim().toLocaleLowerCase();
  const filteredCategories = categories.filter(category =>
    category.name.toLocaleLowerCase().includes(query) ||
    category.code.toLocaleLowerCase().includes(query)
  );

  const activeCount = categories.filter(category => category.status === 'ACTIVE').length;
  const inactiveCount = categories.length - activeCount;
  const competitionAssignments = categories.reduce(
    (total, category) => total + (Number(category.competitionsCount) || 0),
    0
  );

  const handleOpenAdd = () => {
    setEditingCategory(null);
    setName('');
    setCode('');
    setAgeRange('');
    setClassRange('');
    setEligibility('');
    setStatus('ACTIVE');
    setError('');
    setModalOpen(true);
  };

  const handleOpenEdit = (category: Category) => {
    setEditingCategory(category);
    setName(category.name);
    setCode(category.code);
    setAgeRange(category.ageRange);
    setClassRange(category.classRange);
    setEligibility(category.eligibility);
    setStatus(category.status);
    setError('');
    setModalOpen(true);
  };

  const handleSave = async (event: React.FormEvent) => {
    event.preventDefault();
    setError('');

    if (!name.trim() || !code.trim()) {
      setError('Please provide a category name and code.');
      return;
    }

    setSaving(true);
    try {
      const categoryData = {
        name: name.trim(),
        code: code.trim().toUpperCase(),
        ageRange: ageRange.trim(),
        classRange: classRange.trim(),
        eligibility: eligibility.trim(),
        status
      };

      if (editingCategory) {
        await updateCategory(editingCategory.id, categoryData);
      } else {
        await addCategory(categoryData);
      }
      setModalOpen(false);
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : 'Failed to save category.');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: string, categoryName: string) => {
    if (!confirm(`Are you sure you want to delete category "${categoryName}"?`)) return;

    setActionError(null);
    setDeletingId(id);
    try {
      await deleteCategory(id);
    } catch (deleteError) {
      setActionError(deleteError instanceof Error ? deleteError.message : 'Failed to delete category.');
    } finally {
      setDeletingId(null);
    }
  };

  const summaryCards = [
    {
      label: 'Total categories',
      value: categories.length,
      detail: 'Configured eligibility tiers',
      icon: <Layers className="h-5 w-5" />,
      iconStyle: 'bg-blue-50 text-blue-700'
    },
    {
      label: 'Active categories',
      value: activeCount,
      detail: 'Available for use',
      icon: <CheckCircle2 className="h-5 w-5" />,
      iconStyle: 'bg-emerald-50 text-emerald-700'
    },
    {
      label: 'Inactive categories',
      value: inactiveCount,
      detail: 'Currently disabled',
      icon: <CirclePause className="h-5 w-5" />,
      iconStyle: 'bg-slate-100 text-slate-600'
    },
    {
      label: 'Competition assignments',
      value: competitionAssignments,
      detail: 'Across all categories',
      icon: <Trophy className="h-5 w-5" />,
      iconStyle: 'bg-violet-50 text-violet-700'
    }
  ];

  return (
    <AdminLayout>
      <div className="mx-auto w-full max-w-[1440px] space-y-7 sm:space-y-8">
        {/* Page heading */}
        <section className="flex flex-col gap-5 border-b border-slate-200 pb-6 sm:flex-row sm:items-end sm:justify-between">
          <div className="min-w-0">
            <p className="mb-2 text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">
              Festival setup
            </p>
            <div className="flex flex-wrap items-center gap-3">
              <h1 className="text-2xl font-semibold leading-tight tracking-tight text-slate-950 sm:text-3xl">
                Category management
              </h1>
              <Badge variant="info" size="sm" className="normal-case tracking-normal">
                Eligibility tiers
              </Badge>
            </div>
            <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-600">
              Manage category codes, age and class ranges, and which participant groups are eligible for competitions.
            </p>
          </div>

          <Button
            variant="primary"
            size="md"
            leftIcon={<Plus className="h-4 w-4" />}
            onClick={handleOpenAdd}
            className="w-full sm:w-auto"
          >
            Add category
          </Button>
        </section>

        {/* Overview cards */}
        <section aria-label="Category overview" className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
          {summaryCards.map(card => (
            <article
              key={card.label}
              className="flex items-start justify-between gap-4 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm transition-colors hover:border-slate-300 sm:p-5"
            >
              <div className="min-w-0">
                <p className="text-sm font-medium text-slate-600">{card.label}</p>
                <p className="mt-2 text-3xl font-semibold leading-none tracking-tight text-slate-950">
                  {card.value.toLocaleString()}
                </p>
                <p className="mt-2 text-xs leading-5 text-slate-500">{card.detail}</p>
              </div>
              <span className={'flex h-11 w-11 shrink-0 items-center justify-center rounded-xl ' + card.iconStyle}>
                {card.icon}
              </span>
            </article>
          ))}
        </section>

        {/* Action error */}
        {actionError && (
          <div role="alert" className="flex items-start justify-between gap-4 rounded-xl border border-red-200 bg-red-50 px-4 py-3.5 text-sm text-red-800">
            <div className="flex min-w-0 items-start gap-2.5">
              <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-red-600" />
              <span className="break-words leading-5">{actionError}</span>
            </div>
            <button
              type="button"
              onClick={() => setActionError(null)}
              className="shrink-0 rounded-md p-1 text-red-600 transition-colors hover:bg-red-100 hover:text-red-800 focus:outline-none focus-visible:ring-2 focus-visible:ring-red-500"
              aria-label="Dismiss error"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        )}

        {/* Search and results count */}
        <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:p-5">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
            <div className="relative w-full lg:max-w-lg">
              <Search className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
              <input
                type="search"
                aria-label="Search categories"
                placeholder="Search by category name or code..."
                value={search}
                onChange={event => setSearch(event.target.value)}
                className="min-h-11 w-full rounded-xl border border-slate-200 bg-slate-50 py-2.5 pl-10 pr-10 text-sm text-slate-900 outline-none transition focus:border-blue-500 focus:bg-white focus:ring-4 focus:ring-blue-500/10"
              />
              {search && (
                <button
                  type="button"
                  onClick={() => setSearch('')}
                  className="absolute right-3 top-1/2 -translate-y-1/2 rounded-md p-1 text-slate-400 transition-colors hover:bg-slate-200 hover:text-slate-700"
                  aria-label="Clear search"
                >
                  <X className="h-4 w-4" />
                </button>
              )}
            </div>
            <div className="flex flex-wrap items-center justify-between gap-2 text-sm lg:justify-end">
              <span className="text-slate-500">
                Showing <strong className="font-semibold text-slate-900">{filteredCategories.length}</strong> of {categories.length} categories
              </span>
              {query && (
                <Badge variant="default" size="sm" className="normal-case tracking-normal">
                  Search active
                </Badge>
              )}
            </div>
          </div>
        </section>

        {/* Category registry */}
        <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
          <div className="flex flex-col gap-2 border-b border-slate-200 px-5 py-4 sm:flex-row sm:items-center sm:justify-between sm:px-6">
            <div>
              <h2 className="text-base font-semibold tracking-tight text-slate-900">Configured categories</h2>
              <p className="mt-1 text-sm text-slate-500">Category definitions used across participant registration and competitions.</p>
            </div>
            <div className="inline-flex items-center gap-2 self-start rounded-lg bg-slate-100 px-3 py-1.5 text-xs font-semibold text-slate-600 sm:self-auto">
              <Users2 className="h-3.5 w-3.5" />
              {categories.length} {categories.length === 1 ? 'tier' : 'tiers'}
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full min-w-[900px] table-auto text-left">
              <thead>
                <tr className="border-b border-slate-200 bg-slate-50 text-[11px] font-semibold uppercase tracking-[0.08em] text-slate-500">
                  <th scope="col" className="px-6 py-3.5">Category</th>
                  <th scope="col" className="px-5 py-3.5">Eligibility details</th>
                  <th scope="col" className="px-4 py-3.5 text-center">Participants</th>
                  <th scope="col" className="px-4 py-3.5 text-center">Competitions</th>
                  <th scope="col" className="px-4 py-3.5 text-center">Status</th>
                  <th scope="col" className="px-5 py-3.5 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredCategories.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="px-6 py-14 text-center">
                      <div className="mx-auto flex max-w-sm flex-col items-center">
                        <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-slate-100 text-slate-500">
                          <Layers className="h-6 w-6" />
                        </span>
                        <p className="mt-4 text-sm font-semibold text-slate-900">
                          {categories.length === 0 ? 'No categories created yet' : 'No matching categories'}
                        </p>
                        <p className="mt-1 text-sm leading-6 text-slate-500">
                          {categories.length === 0
                            ? 'Create a category to define participant eligibility for festival competitions.'
                            : 'Try another name or category code, or clear your search.'}
                        </p>
                        {categories.length === 0 ? (
                          <Button variant="outline" size="sm" leftIcon={<Plus className="h-4 w-4" />} onClick={handleOpenAdd} className="mt-4">
                            Create first category
                          </Button>
                        ) : (
                          <Button variant="ghost" size="sm" onClick={() => setSearch('')} className="mt-3">
                            Clear search
                          </Button>
                        )}
                      </div>
                    </td>
                  </tr>
                ) : (
                  filteredCategories.map(category => (
                    <tr key={category.id} className="transition-colors hover:bg-slate-50/80">
                      <td className="px-6 py-4">
                        <div className="flex min-w-0 items-center gap-3">
                          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-blue-100 bg-blue-50 text-blue-700">
                            <Layers className="h-4.5 w-4.5" />
                          </span>
                          <div className="min-w-0">
                            <p className="break-words text-sm font-semibold text-slate-900">{category.name}</p>
                            <p className="mt-1 font-mono text-xs tracking-wide text-slate-500">{category.code}</p>
                          </div>
                        </div>
                      </td>
                      <td className="px-5 py-4">
                        <p className="text-sm font-medium text-slate-800">
                          {category.classRange || 'Class range not specified'}
                        </p>
                        <p className="mt-1 text-xs text-slate-500">
                          {category.ageRange || 'Age range not specified'}
                        </p>
                        {category.eligibility && (
                          <p className="mt-1.5 max-w-xs text-xs leading-5 text-slate-500">{category.eligibility}</p>
                        )}
                      </td>
                      <td className="px-4 py-4 text-center">
                        <span className="text-sm font-semibold tabular-nums text-slate-900">
                          {(Number(category.enrolledCount) || 0).toLocaleString()}
                        </span>
                        <span className="mt-1 block text-xs text-slate-500">enrolled</span>
                      </td>
                      <td className="px-4 py-4 text-center">
                        <span className="text-sm font-semibold tabular-nums text-slate-900">
                          {(Number(category.competitionsCount) || 0).toLocaleString()}
                        </span>
                        <span className="mt-1 block text-xs text-slate-500">assigned</span>
                      </td>
                      <td className="px-4 py-4 text-center">
                        <Badge variant={category.status === 'ACTIVE' ? 'success' : 'default'} size="sm" dot>
                          {category.status === 'ACTIVE' ? 'Active' : 'Inactive'}
                        </Badge>
                      </td>
                      <td className="px-5 py-4">
                        <div className="flex items-center justify-end gap-1.5">
                          <button
                            type="button"
                            onClick={() => handleOpenEdit(category)}
                            className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-transparent text-slate-500 transition-colors hover:border-blue-100 hover:bg-blue-50 hover:text-blue-700 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
                            title="Edit category"
                            aria-label={`Edit ${category.name}`}
                          >
                            <Edit2 className="h-4 w-4" />
                          </button>
                          <button
                            type="button"
                            onClick={() => handleDelete(category.id, category.name)}
                            disabled={deletingId === category.id}
                            className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-transparent text-slate-500 transition-colors hover:border-red-100 hover:bg-red-50 hover:text-red-700 focus:outline-none focus-visible:ring-2 focus-visible:ring-red-500 disabled:cursor-wait disabled:opacity-50"
                            title="Delete category"
                            aria-label={`Delete ${category.name}`}
                          >
                            {deletingId === category.id
                              ? <span className="h-4 w-4 animate-spin rounded-full border-2 border-slate-300 border-t-red-600" />
                              : <Trash2 className="h-4 w-4" />}
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          {filteredCategories.length > 0 && (
            <div className="flex flex-col gap-2 border-t border-slate-100 bg-slate-50/70 px-5 py-3.5 text-xs text-slate-500 sm:flex-row sm:items-center sm:justify-between sm:px-6">
              <span>Showing {filteredCategories.length} {filteredCategories.length === 1 ? 'category' : 'categories'}.</span>
              <span>Changes apply across registration and competition management.</span>
            </div>
          )}
        </section>

        {/* Create / edit form */}
        <Modal
          isOpen={modalOpen}
          onClose={() => setModalOpen(false)}
          title={editingCategory ? `Edit category: ${editingCategory.name}` : 'Create category'}
          description="Set the details used to classify participants and assign competitions."
          maxWidth="lg"
          footer={
            <div className="flex w-full flex-col-reverse gap-2 sm:flex-row sm:justify-end">
              <Button variant="outline" size="md" onClick={() => setModalOpen(false)} disabled={saving} className="w-full sm:w-auto">
                Cancel
              </Button>
              <Button
                variant="primary"
                size="md"
                onClick={handleSave}
                disabled={saving}
                isLoading={saving}
                className="w-full sm:w-auto"
              >
                {editingCategory ? 'Save changes' : 'Create category'}
              </Button>
            </div>
          }
        >
          <form onSubmit={handleSave} className="space-y-5">
            {error && (
              <div role="alert" className="flex items-start gap-2.5 rounded-xl border border-red-200 bg-red-50 p-3.5 text-sm leading-5 text-red-800">
                <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-red-600" />
                <span>{error}</span>
              </div>
            )}

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <Input
                label="Category name"
                placeholder="e.g. Sub Junior"
                value={name}
                onChange={event => setName(event.target.value)}
                required
                autoComplete="off"
              />
              <Input
                label="Category code"
                placeholder="e.g. CAT-SJ"
                value={code}
                onChange={event => setCode(event.target.value)}
                required
                autoComplete="off"
                helperText="Short unique identifier; saved in uppercase."
              />
            </div>

            <div className="rounded-xl border border-slate-200 bg-slate-50/70 p-4">
              <p className="mb-3 text-xs font-semibold uppercase tracking-[0.1em] text-slate-600">Eligibility range</p>
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <Input
                  label="Class / grade range"
                  placeholder="e.g. Std 5–7"
                  value={classRange}
                  onChange={event => setClassRange(event.target.value)}
                />
                <Input
                  label="Age range"
                  placeholder="e.g. 10–12 years"
                  value={ageRange}
                  onChange={event => setAgeRange(event.target.value)}
                />
              </div>
              <div className="mt-4">
                <Input
                  label="Eligibility summary"
                  placeholder="e.g. Students enrolled in middle school"
                  value={eligibility}
                  onChange={event => setEligibility(event.target.value)}
                  helperText="A brief explanation for administrators; participant eligibility is also controlled by the selected category."
                />
              </div>
            </div>

            <Select
              label="Category status"
              value={status}
              onChange={event => setStatus(event.target.value as 'ACTIVE' | 'INACTIVE')}
              options={[
                { value: 'ACTIVE', label: 'Active — available for registration' },
                { value: 'INACTIVE', label: 'Inactive — unavailable for new use' }
              ]}
            />
          </form>
        </Modal>
      </div>
    </AdminLayout>
  );
}
