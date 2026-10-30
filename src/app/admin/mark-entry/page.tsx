'use client';

import React, { useState } from 'react';
import { AdminLayout } from '@/components/layout/AdminLayout';
import { useFest } from '@/context/FestContext';
import { MarkEntry } from '@/types/fest';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { Modal } from '@/components/ui/Modal';
import { Input } from '@/components/ui/Input';
import { Select } from '@/components/ui/Select';
import { WhatsAppDispatchModal } from '@/components/domain/WhatsAppDispatchModal';
import {
  MessageSquare,
  Search,
  CheckCircle2,
  Clock,
  AlertCircle,
  Eye,
  FileSpreadsheet,
  Send,
  UserPlus,
  ShieldCheck,
  ExternalLink
} from 'lucide-react';
import Link from 'next/link';

export default function MarkEntryPage() {
  const { markEntries, markEntriesSyncState, competitions, addOrUpdateJudgeAssignment, cleanupOrphanedJudgeAssignments } = useFest();

  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('ALL');
  const [selectedForDispatch, setSelectedForDispatch] = useState<MarkEntry | null>(null);
  const [dispatchCredentials, setDispatchCredentials] = useState<{ oneTimeSecret: string; directUrl: string } | null>(null);
  const [assignModalOpen, setAssignModalOpen] = useState(false);
  const [savingAssignment, setSavingAssignment] = useState(false);

  // Admin-authorized Dry-Run & Confirmed Orphan Inspection State
  const [inspectModalOpen, setInspectModalOpen] = useState(false);
  const [inspecting, setInspecting] = useState(false);
  const [purging, setPurging] = useState(false);
  const [inspectResult, setInspectResult] = useState<any>(null);
  const [inspectError, setInspectError] = useState<string | null>(null);

  const handleInspectDryRun = async () => {
    setInspecting(true);
    setInspectError(null);
    setInspectResult(null);
    setInspectModalOpen(true);
    try {
      const res = await cleanupOrphanedJudgeAssignments({ dryRun: true });
      setInspectResult(res);
    } catch (err: any) {
      setInspectError(err?.message || 'Failed to inspect orphaned records.');
    } finally {
      setInspecting(false);
    }
  };

  const handleConfirmPurge = async () => {
    setPurging(true);
    setInspectError(null);
    try {
      const res = await cleanupOrphanedJudgeAssignments({ confirm: true });
      setInspectResult(res);
    } catch (err: any) {
      setInspectError(err?.message || 'Failed to clean up orphaned records.');
    } finally {
      setPurging(false);
    }
  };

  // Filter mark entries to strictly show only those belonging to existing Firestore competitions
  const validMarkEntries = React.useMemo(() => {
    if (competitions.length === 0) return [];
    const activeCompIds = new Set(competitions.map(c => c.id));
    return markEntries.filter(m => activeCompIds.has(m.competitionId));
  }, [markEntries, competitions]);

  // Assignment Form State
  const [competitionId, setCompetitionId] = useState(competitions[0]?.id || '');
  const [judgeName, setJudgeName] = useState('');
  const [judgePhone, setJudgePhone] = useState('+91 9847');
  const [error, setError] = useState('');

  const filteredEntries = validMarkEntries.filter(m => {
    const matchesSearch = m.competitionName.toLowerCase().includes(search.toLowerCase()) ||
                          m.competitionCode.toLowerCase().includes(search.toLowerCase()) ||
                          m.judgeName.toLowerCase().includes(search.toLowerCase());
    const matchesStatus = statusFilter === 'ALL' || m.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  const notStartedCount = validMarkEntries.filter(m => m.status === 'NOT_STARTED').length;
  const inProgressCount = validMarkEntries.filter(m => m.status === 'IN_PROGRESS').length;
  const submittedCount = validMarkEntries.filter(m => m.status === 'SUBMITTED').length;
  const expiredCount = validMarkEntries.filter(m => m.status === 'EXPIRED').length;
  const revokedCount = validMarkEntries.filter(m => m.status === 'REVOKED' || m.revoked).length;

  const handleOpenAssign = () => {
    setCompetitionId(competitions[0]?.id || '');
    setJudgeName('');
    setJudgePhone('+91 9847');
    setError('');
    setAssignModalOpen(true);
  };

  const handleSaveAssignment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!judgeName || !judgePhone) {
      setError('Please provide judge name and WhatsApp phone number.');
      return;
    }

    setSavingAssignment(true);
    setError('');
    try {
      const credentials = await addOrUpdateJudgeAssignment({
        competitionId,
        judgeName,
        judgePhone
      });
      const competition = competitions.find(item => item.id === competitionId);
      setSelectedForDispatch({
        id: credentials.assignmentId,
        competitionId,
        competitionName: competition?.name || '',
        competitionCode: competition?.code || '',
        categoryName: competition?.categoryName || 'General',
        type: competition?.type || 'SOLO',
        judgeName,
        judgePhone,
        accessCode: credentials.accessCode,
        secretHash: '',
        salt: '',
        revoked: false,
        status: 'NOT_STARTED',
        scores: []
      });
      setDispatchCredentials({
        oneTimeSecret: credentials.oneTimeSecret,
        directUrl: credentials.directUrl
      });
      setAssignModalOpen(false);
    } catch (error) {
      setError(error instanceof Error ? error.message : 'Could not create the judge assignment.');
    } finally {
      setSavingAssignment(false);
    }
  };

  const getStatusBadge = (st: MarkEntry['status']) => {
    switch (st) {
      case 'SUBMITTED':
        return <Badge variant="success" size="sm" dot>SUBMITTED</Badge>;
      case 'IN_PROGRESS':
        return <Badge variant="warning" size="sm" dot>IN PROGRESS</Badge>;
      case 'EXPIRED':
        return <Badge variant="error" size="sm" dot>EXPIRED</Badge>;
      case 'REVOKED':
        return <Badge variant="error" size="sm" dot>REVOKED</Badge>;
      case 'NOT_STARTED':
      default:
        return <Badge variant="default" size="sm" dot>NOT STARTED</Badge>;
    }
  };

  return (
    <AdminLayout>
      <div className="w-full min-w-0 max-w-7xl space-y-5 sm:space-y-6">
        {/* Header */}
        <div className="flex flex-col gap-4 border-b border-[#E1E7EF] pb-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="text-xl sm:text-2xl font-bold text-[#111111] tracking-tight">
              Mark Entry &amp; Jury Dispatch
            </h1>
            <p className="mt-1.5 max-w-3xl text-xs leading-5 text-[#64748B] sm:text-sm">
              Issue secure evaluation links to stage judges via WhatsApp and monitor live score submission status
            </p>
          </div>
          <div className="grid w-full grid-cols-1 gap-2 sm:flex sm:w-auto sm:flex-wrap sm:justify-end">
            <Button
              variant="outline"
              size="md"
              className="w-full sm:w-auto"
              leftIcon={<ShieldCheck className="w-4 h-4 text-emerald-600" />}
              onClick={handleInspectDryRun}
            >
              Inspect Orphan Records
            </Button>
            <Button
              variant="primary"
              size="md"
              className="w-full sm:w-auto"
              disabled={competitions.length === 0}
              leftIcon={<UserPlus className="w-4 h-4" />}
              onClick={handleOpenAssign}
            >
              Assign Judge &amp; Generate Link
            </Button>
          </div>
        </div>

        {/* Evaluation overview */}
        <div className="grid grid-cols-2 gap-3 sm:gap-4 xl:grid-cols-4">
          <div className="flex min-w-0 items-center justify-between rounded-xl border border-[#E2E8F0] bg-white p-3.5 shadow-sm sm:p-4"><div className="min-w-0"><span className="text-[10px] font-bold uppercase tracking-wider text-[#64748B] sm:text-xs">Assigned judges</span><h3 className="mt-1 text-2xl font-bold tabular-nums text-[#0F172A]">{validMarkEntries.length}</h3></div><div className="ml-2 flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-slate-100 text-slate-600 sm:h-10 sm:w-10"><FileSpreadsheet className="h-5 w-5" /></div></div>
          <div className="flex min-w-0 items-center justify-between rounded-xl border border-[#E2E8F0] bg-white p-3.5 shadow-sm sm:p-4"><div className="min-w-0"><span className="text-[10px] font-bold uppercase tracking-wider text-[#64748B] sm:text-xs">Awaiting</span><h3 className="mt-1 text-2xl font-bold tabular-nums text-[#0F172A]">{notStartedCount}</h3></div><div className="ml-2 flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-slate-100 text-slate-600 sm:h-10 sm:w-10"><Clock className="h-5 w-5" /></div></div>
          <div className="flex min-w-0 items-center justify-between rounded-xl border border-amber-200 bg-white p-3.5 shadow-sm sm:p-4"><div className="min-w-0"><span className="text-[10px] font-bold uppercase tracking-wider text-amber-700 sm:text-xs">In progress</span><h3 className="mt-1 text-2xl font-bold tabular-nums text-amber-700">{inProgressCount}</h3></div><div className="ml-2 flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-amber-50 text-amber-600 sm:h-10 sm:w-10"><Clock className="h-5 w-5" /></div></div>
          <div className="flex min-w-0 items-center justify-between rounded-xl border border-emerald-200 bg-white p-3.5 shadow-sm sm:p-4"><div className="min-w-0"><span className="text-[10px] font-bold uppercase tracking-wider text-emerald-700 sm:text-xs">Submitted</span><h3 className="mt-1 text-2xl font-bold tabular-nums text-emerald-700">{submittedCount}</h3></div><div className="ml-2 flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-emerald-50 text-emerald-600 sm:h-10 sm:w-10"><CheckCircle2 className="h-5 w-5" /></div></div>
        </div>

        {/* Search & Filter Bar */}
        <div className="rounded-xl border border-[#E2E8F0] bg-white p-3.5 shadow-sm sm:p-4">
          <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <div className="relative w-full md:max-w-lg md:flex-1">
            <Search className="w-4 h-4 text-[#526070] absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
            <input
              type="text"
              placeholder="Search event code, competition or judge..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="min-h-11 w-full rounded-lg border border-[#E2E8F0] bg-[#F8FAFC] py-2.5 pl-9 pr-4 text-sm text-[#0F172A] outline-none transition focus:border-blue-500 focus:bg-white focus:ring-2 focus:ring-blue-100"
            />
          </div>

          <div className="flex w-full flex-col gap-2 sm:flex-row md:w-auto">
            <select
              aria-label="Filter by Evaluation Status"
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="min-h-11 w-full rounded-lg border border-[#E2E8F0] bg-[#F8FAFC] px-3 py-2.5 text-sm font-semibold text-[#0F172A] outline-none transition focus:border-blue-500 focus:bg-white focus:ring-2 focus:ring-blue-100 sm:w-auto"
            >
              <option value="ALL">All Evaluation States</option>
              <option value="NOT_STARTED">Not Started</option>
              <option value="IN_PROGRESS">In Progress</option>
              <option value="SUBMITTED">Submitted</option>
              <option value="EXPIRED">Expired</option>
              <option value="REVOKED">Revoked</option>
            </select>
            <div className="flex flex-wrap items-center gap-2 text-[11px] text-[#64748B] sm:ml-1">{expiredCount > 0 && <span>{expiredCount} expired</span>}{revokedCount > 0 && <span>{revokedCount} revoked</span>}</div>
          </div>
          </div>
        </div>

        {/* Evaluation Table */}
        <div className="overflow-hidden rounded-xl border border-[#E2E8F0] bg-white shadow-sm">
          <div className="flex flex-col gap-2 border-b border-[#E2E8F0] px-4 py-4 sm:flex-row sm:items-center sm:justify-between sm:px-5">
            <div><h3 className="text-sm font-bold text-[#0F172A] sm:text-base">Stage Evaluation Roster</h3><p className="mt-0.5 text-xs text-[#64748B]">Judge assignments and live submission progress</p></div>
            <div className="flex items-center gap-2 self-start sm:self-auto">
              <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-semibold ${markEntriesSyncState === 'ready' ? 'bg-emerald-50 text-emerald-700' : markEntriesSyncState === 'error' ? 'bg-red-50 text-red-700' : 'bg-amber-50 text-amber-700'}`}><span className={`h-1.5 w-1.5 rounded-full ${markEntriesSyncState === 'ready' ? 'bg-emerald-500' : markEntriesSyncState === 'error' ? 'bg-red-500' : 'bg-amber-500'}`} />{markEntriesSyncState === 'ready' ? 'Live sync' : markEntriesSyncState === 'error' ? 'Sync issue' : markEntriesSyncState === 'idle' ? 'Offline' : 'Connecting'}</span>
              <span className="text-xs tabular-nums text-[#64748B]">{filteredEntries.length} / {validMarkEntries.length}</span>
            </div>
          </div>
          {markEntriesSyncState === 'error' && <div role="alert" className="border-b border-red-100 bg-red-50 px-4 py-3 text-xs text-red-800 sm:px-5">Live judge assignment updates could not be loaded. Check the administrator session and Firestore permissions, then reload the page.</div>}
          {markEntriesSyncState === 'loading' && <div className="flex items-center gap-3 border-b border-blue-100 bg-blue-50/70 px-4 py-3 text-xs text-blue-800 sm:px-5"><Clock className="h-4 w-4 animate-spin" />Connecting to the live judge assignment feed…</div>}
          <div className="divide-y divide-[#E2E8F0] lg:hidden">
            {filteredEntries.length === 0 ? <div className="px-4 py-10 text-center"><FileSpreadsheet className="mx-auto mb-2 h-8 w-8 text-slate-300" /><p className="text-sm font-semibold text-[#0F172A]">{markEntriesSyncState === 'loading' ? 'Loading assignments…' : 'No mark entries found'}</p><p className="mx-auto mt-1 max-w-sm text-xs leading-5 text-[#64748B]">{competitions.length === 0 ? 'Create a competition before assigning a judge.' : 'No judge assignments match the current search or status filter.'}</p></div> : filteredEntries.map(entry => (
              <article key={entry.id} className="space-y-3 p-4">
                <div className="flex min-w-0 items-start justify-between gap-3"><div className="min-w-0"><span className="inline-flex rounded-md border border-blue-100 bg-blue-50 px-2 py-0.5 font-mono text-[11px] font-bold text-blue-700">{entry.competitionCode}</span><h4 className="mt-1.5 break-words text-sm font-bold leading-5 text-[#0F172A]">{entry.competitionName}</h4><p className="mt-1 text-xs text-[#64748B]">{entry.categoryName} · {entry.type === 'SOLO' ? 'Individual' : 'Group'}</p></div><div className="shrink-0">{getStatusBadge(entry.status)}</div></div>
                <div className="rounded-lg bg-slate-50 px-3 py-2.5"><p className="text-sm font-semibold text-[#0F172A]">{entry.judgeName}</p><p className="mt-0.5 text-xs text-[#64748B]">{entry.judgePhone}</p>{entry.submittedAt && <p className="mt-1 text-[11px] text-emerald-700">Submitted: {entry.submittedAt}</p>}</div>
                <div className="grid grid-cols-2 gap-2"><Button variant="outline" size="sm" className="w-full" leftIcon={<MessageSquare className="h-3.5 w-3.5 text-emerald-600" />} onClick={() => { setDispatchCredentials(null); setSelectedForDispatch(entry); }}>Dispatch details</Button><Link href={`/judge/marking?code=${encodeURIComponent(entry.accessCode)}&competitionId=${encodeURIComponent(entry.competitionId)}`} target="_blank" className="w-full"><Button variant="secondary" size="sm" className="w-full" leftIcon={<ExternalLink className="h-3.5 w-3.5" />}>Open sheet</Button></Link></div>
              </article>
            ))}
          </div>
          <div className="hidden overflow-x-auto lg:block">
            <table className="w-full min-w-[900px] text-left text-xs">
              <thead>
                <tr className="border-b border-[#E1E7EF] bg-[#F8FAFC] text-[#526070] font-bold uppercase text-[11px]">
                  <th className="px-5 py-3">Competition Name &amp; Code</th>
                  <th className="py-3 px-6">Category / Type</th>
                  <th className="py-3 px-6">Assigned Judges</th>
                  <th className="px-5 py-3 text-center">Mark Entry Status</th>
                  <th className="px-5 py-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#E1E7EF]">
                {filteredEntries.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="py-12 text-center text-xs text-[#526070]">
                      <div className="flex flex-col items-center justify-center space-y-2">
                        <FileSpreadsheet className="w-8 h-8 text-[#94A3B8]" />
                        <p className="font-semibold text-sm text-[#111111]">No mark entries found</p>
                        <p className="text-xs text-[#526070]">
                          {competitions.length === 0
                            ? 'No competitions exist in the festival database. Create competitions before assigning judges.'
                            : 'No active competition judge assignments match your filter criteria.'}
                        </p>
                      </div>
                    </td>
                  </tr>
                ) : (
                  filteredEntries.map((entry) => (
                    <tr key={entry.id} className="hover:bg-[#F8FAFC] transition-colors">
                      <td className="px-5 py-4">
                        <div className="flex items-center gap-2.5">
                          <span className="font-mono text-xs font-bold text-[#2563EB] bg-blue-50 px-2 py-0.5 rounded border border-blue-100">
                            {entry.competitionCode}
                          </span>
                          <div>
                            <span className="font-bold text-[#111111] text-sm block">{entry.competitionName}</span>
                            {entry.submittedAt && (
                              <span className="text-[11px] text-[#526070]">Submitted: {entry.submittedAt}</span>
                            )}
                          </div>
                        </div>
                      </td>
                      <td className="px-5 py-4 font-semibold text-[#111111]">
                        {entry.categoryName} · {entry.type === 'SOLO' ? 'Individual' : 'Group'}
                      </td>
                      <td className="py-4 px-6">
                        <span className="font-semibold text-[#111111] block">{entry.judgeName}</span>
                        <span className="text-[11px] text-[#526070]">{entry.judgePhone}</span>
                      </td>
                      <td className="px-5 py-4 text-center">
                        {getStatusBadge(entry.status)}
                      </td>
                      <td className="px-5 py-4 text-right">
                        <div className="flex items-center justify-end gap-2">
                          {/* WhatsApp Dispatch Button */}
                          <Button
                            variant="outline"
                            size="sm"
                            leftIcon={<MessageSquare className="w-3.5 h-3.5 text-emerald-600" />}
                            onClick={() => {
                              setDispatchCredentials(null);
                              setSelectedForDispatch(entry);
                            }}
                          >
                            Dispatch Details
                          </Button>

                          {/* Open as Judge Simulator link */}
                          <Link
                            href={`/judge/marking?code=${entry.accessCode}&competitionId=${entry.competitionId}`}
                            target="_blank"
                          >
                            <Button
                              variant="secondary"
                              size="sm"
                              leftIcon={<ExternalLink className="w-3.5 h-3.5" />}
                            >
                              Open Sheet
                            </Button>
                          </Link>
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* WhatsApp Dispatch Drawer Modal */}
        <WhatsAppDispatchModal
          markEntry={selectedForDispatch}
          isOpen={!!selectedForDispatch}
          oneTimeSecret={dispatchCredentials?.oneTimeSecret}
          directUrl={dispatchCredentials?.directUrl}
          onClose={() => setSelectedForDispatch(null)}
        />

        {/* Assign Judge Modal */}
        <Modal
          isOpen={assignModalOpen}
          onClose={() => setAssignModalOpen(false)}
          title="Assign Judge &amp; Provision Token"
          description="Nominate an adjudicator for a stage contest and generate an exclusive evaluation PIN"
          maxWidth="md"
          footer={
            <div className="flex items-center justify-end gap-2 w-full">
              <Button variant="outline" size="sm" onClick={() => setAssignModalOpen(false)}>
                Cancel
              </Button>
              <Button variant="primary" size="sm" onClick={() => (document.getElementById('mark-entry-assignment-form') as HTMLFormElement | null)?.requestSubmit()} disabled={savingAssignment || !competitionId} isLoading={savingAssignment}>
                {savingAssignment ? 'Generating...' : 'Generate Credentials'}
              </Button>
            </div>
          }
        >
          <form id="mark-entry-assignment-form" onSubmit={handleSaveAssignment} className="space-y-4">
            {competitions.length === 0 && <p className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-xs text-amber-800">No competitions are available. Add a competition before assigning a judge.</p>}
            {error && <p role="alert" className="rounded-lg border border-red-200 bg-red-50 p-3 text-xs font-semibold text-red-700">{error}</p>}

            <Select
              label="Select Competition"
              value={competitionId}
              onChange={(e) => setCompetitionId(e.target.value)}
              options={competitions.map(c => ({ value: c.id, label: `${c.name} (${c.code} - ${c.categoryName})` }))}
            />

            <Input
              label="Judge Full Name"
              placeholder="e.g. Prof. David Miller"
              value={judgeName}
              onChange={(e) => setJudgeName(e.target.value)}
              required
            />

            <Input
              label="Judge WhatsApp Phone Number"
              placeholder="+91 98473 00000"
              value={judgePhone}
              onChange={(e) => setJudgePhone(e.target.value)}
              helperText="Credentials and evaluation link will be dispatched to this WhatsApp contact"
              required
            />
          </form>
        </Modal>

        {/* Admin-Authorized Dry-Run & Confirmed Orphan Inspection Modal */}
        <Modal
          isOpen={inspectModalOpen}
          onClose={() => setInspectModalOpen(false)}
          title="Database Integrity &amp; Orphan Inspection"
          description="Admin-authorized preview and cleanup of orphaned judge assignments and score records"
          maxWidth="lg"
          footer={
            <div className="flex items-center justify-end gap-2 w-full">
              <Button variant="outline" size="sm" onClick={() => setInspectModalOpen(false)}>
                Close
              </Button>
              {inspectResult?.dryRun && (inspectResult?.totalOrphaned || 0) > 0 && (
                <Button
                  variant="primary"
                  size="sm"
                  onClick={handleConfirmPurge}
                  disabled={purging}
                  className="bg-red-600 hover:bg-red-700 text-white"
                >
                  {purging ? 'Purging Records...' : `Confirm & Purge ${inspectResult.totalOrphaned} Orphans`}
                </Button>
              )}
            </div>
          }
        >
          <div className="space-y-4">
            {inspecting && (
              <div className="py-8 flex flex-col items-center justify-center text-center space-y-3">
                <Clock className="w-8 h-8 text-blue-600 animate-spin" />
                <p className="text-sm font-medium text-[#111111]">Scanning database records...</p>
                <p className="text-xs text-[#526070]">Comparing judge assignments and mark entries against active competitions.</p>
              </div>
            )}

            {inspectError && (
              <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-xl flex items-start gap-2 text-xs">
                <AlertCircle className="w-4 h-4 mt-0.5 shrink-0" />
                <span>{inspectError}</span>
              </div>
            )}

            {!inspecting && inspectResult && (
              <div className="space-y-4">
                {inspectResult.dryRun ? (
                  (inspectResult.totalOrphaned || 0) === 0 ? (
                    <div className="p-4 bg-emerald-50 border border-emerald-200 rounded-xl flex items-start gap-3">
                      <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0 mt-0.5" />
                      <div>
                        <h4 className="text-sm font-bold text-emerald-900">Database Clean &amp; Fully Synchronized</h4>
                        <p className="text-xs text-emerald-700 mt-1">
                          Dry-run verification completed successfully. All judge assignments and mark entries map to valid active competitions. No orphaned records exist.
                        </p>
                      </div>
                    </div>
                  ) : (
                    <div className="space-y-3">
                      <div className="p-4 bg-amber-50 border border-amber-200 rounded-xl flex items-start gap-3">
                        <AlertCircle className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
                        <div>
                          <h4 className="text-sm font-bold text-amber-900">
                            Dry-Run Preview: {inspectResult.totalOrphaned} Orphaned Records Detected
                          </h4>
                          <p className="text-xs text-amber-700 mt-1">
                            Found {inspectResult.orphanedJudgeAssignmentsCount || 0} judge assignment(s) and {inspectResult.orphanedMarkEntriesCount || 0} mark entry/entries referencing deleted competitions. No records have been modified.
                          </p>
                        </div>
                      </div>

                      {inspectResult.orphanedJudgeDetails && inspectResult.orphanedJudgeDetails.length > 0 && (
                        <div className="border border-[#E1E7EF] rounded-xl p-3 bg-neutral-50 max-h-48 overflow-y-auto space-y-2">
                          <p className="text-xs font-bold text-[#111111]">Detected Orphaned Assignments:</p>
                          {inspectResult.orphanedJudgeDetails.slice(0, 10).map((item: any) => (
                            <div key={item.id} className="text-xs text-[#526070] flex justify-between border-b border-[#E1E7EF] pb-1 last:border-0">
                              <span className="font-medium text-[#111111]">{item.judgeName}</span>
                              <span className="font-mono text-[10px] text-neutral-500">Comp ID: {item.competitionId}</span>
                            </div>
                          ))}
                          {inspectResult.orphanedJudgeDetails.length > 10 && (
                            <p className="text-[11px] text-[#526070] italic">...and {inspectResult.orphanedJudgeDetails.length - 10} more</p>
                          )}
                        </div>
                      )}

                      <div className="p-3 bg-red-50 border border-red-100 rounded-lg text-xs text-red-800">
                        <strong>Explicit Confirmation Required:</strong> Deletion is permanent and removes these unlinked records to prevent stale submissions.
                      </div>
                    </div>
                  )
                ) : (
                  <div className="p-4 bg-emerald-50 border border-emerald-200 rounded-xl flex items-start gap-3">
                    <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0 mt-0.5" />
                    <div>
                      <h4 className="text-sm font-bold text-emerald-900">Cleanup Successfully Executed</h4>
                      <p className="text-xs text-emerald-700 mt-1">
                        Permanently removed {inspectResult.removedJudgeAssignments || 0} judge assignment(s) and {inspectResult.removedMarkEntries || 0} mark entry/entries. Database integrity restored.
                      </p>
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        </Modal>
      </div>
    </AdminLayout>
  );
}
