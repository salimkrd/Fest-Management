'use client';

import React, { useEffect, useState } from 'react';
import { AdminLayout } from '@/components/layout/AdminLayout';
import { useFest } from '@/context/FestContext';
import { CompetitionResult, ResultStatus, ResultRank } from '@/types/fest';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { Modal } from '@/components/ui/Modal';
import { PosterStudioModal } from '@/components/domain/PosterStudioModal';
import {
  CheckCircle2,
  Clock,
  Search,
  Eye,
  Globe,
  RotateCcw,
  Sparkles,
  Trophy,
  ShieldAlert,
  FileCheck,
  AlertTriangle,
  Send
} from 'lucide-react';
import Link from 'next/link';

export default function ResultManagementPage() {
  const { results, resultsSyncState, publishResult, unpublishResult, confirmResultPositionsAndGrades } = useFest();

  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('ALL');
  const [selectedResult, setSelectedResult] = useState<CompetitionResult | null>(null);
  const [publishConfirmResult, setPublishConfirmResult] = useState<CompetitionResult | null>(null);
  const [posterStudioResult, setPosterStudioResult] = useState<CompetitionResult | null>(null);
  const [actionError, setActionError] = useState('');
  const [savingResult, setSavingResult] = useState(false);

  const filteredResults = results.filter(r => {
    const term = search.trim().toLowerCase();
    const matchesSearch = !term || r.competitionName.toLowerCase().includes(term) ||
                          r.competitionCode.toLowerCase().includes(term) || r.categoryName.toLowerCase().includes(term);
    const matchesStatus = statusFilter === 'ALL' || r.resultStatus === statusFilter;
    return matchesSearch && matchesStatus;
  });

  const reviewCount = results.filter(r => r.resultStatus === 'READY_FOR_REVIEW' || r.resultStatus === 'REVISION_REQUIRED').length;
  const readyToPublishCount = results.filter(r => r.resultStatus === 'READY_TO_PUBLISH').length;
  const publishedCount = results.filter(r => r.resultStatus === 'PUBLISHED').length;

  // Keep open dialogs aligned with Firestore snapshots from other admin sessions.
  useEffect(() => {
    setSelectedResult(current => current ? results.find(result => result.id === current.id) || null : null);
    setPublishConfirmResult(current => current ? results.find(result => result.id === current.id) || null : null);
    setPosterStudioResult(current => current ? results.find(result => result.id === current.id) || null : null);
  }, [results]);

  const handleConfirmPublish = async () => {
    if (publishConfirmResult) {
      setSavingResult(true);
      setActionError('');
      try {
        await publishResult(publishConfirmResult.id);
        setPublishConfirmResult(null);
      } catch (error) {
        setActionError(error instanceof Error ? error.message : 'Could not publish the result.');
      } finally {
        setSavingResult(false);
      }
    }
  };

  const getResultStatusBadge = (st: ResultStatus) => {
    switch (st) {
      case 'PUBLISHED':
        return <Badge variant="success" size="sm" dot>PUBLISHED</Badge>;
      case 'READY_TO_PUBLISH':
        return <Badge variant="info" size="sm" dot>READY TO PUBLISH</Badge>;
      case 'READY_FOR_REVIEW':
        return <Badge variant="warning" size="sm" dot>READY FOR REVIEW</Badge>;
      case 'AWAITING_MARKS':
        return <Badge variant="default" size="sm" dot>AWAITING MARKS</Badge>;
      case 'REVISION_REQUIRED':
        return <Badge variant="error" size="sm" dot>REVISION REQUIRED</Badge>;
      case 'DRAFT':
      default:
        return <Badge variant="default" size="sm" dot>DRAFT</Badge>;
    }
  };

  const handleConfirmGradesAndPositions = async (result: CompetitionResult) => {
    setSavingResult(true);
    setActionError('');
    try {
      if (!result.ranks.length || result.marksStatus !== 'COMPLETE') {
        throw new Error('Submitted marks and verified ranks are required before confirming a result.');
      }
      await confirmResultPositionsAndGrades(result.id, result.ranks);
      setSelectedResult(prev => prev ? { ...prev, resultStatus: 'READY_TO_PUBLISH' } : null);
    } catch (error) {
      setActionError(error instanceof Error ? error.message : 'Could not confirm result positions.');
    } finally {
      setSavingResult(false);
    }
  };

  const handleUnpublish = async (resultId: string, reason: string) => {
    setSavingResult(true);
    setActionError('');
    try {
      await unpublishResult(resultId, reason);
      setSelectedResult(null);
    } catch (error) {
      setActionError(error instanceof Error ? error.message : 'Could not unpublish the result.');
    } finally {
      setSavingResult(false);
    }
  };

  return (
    <AdminLayout>
      <div className="w-full min-w-0 max-w-7xl space-y-5 sm:space-y-6">
        {actionError && (
          <div role="alert" className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-xs font-semibold text-red-700">
            {actionError}
          </div>
        )}
        {/* Header */}
        <div className="flex flex-col gap-4 border-b border-[#E2E8F0] pb-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="text-xl sm:text-2xl font-bold text-[#111111] tracking-tight">
              Result Management &amp; Tabulation Verification
            </h1>
            <p className="mt-1.5 max-w-3xl text-xs leading-5 text-[#64748B] sm:text-sm">
              Audit adjudicated marks, verify rank calculations, and authorize release to the public results website
            </p>
          </div>
          <Link href="/public" target="_blank">
            <Button
              variant="outline"
              size="md"
              className="w-full sm:w-auto"
              leftIcon={<Globe className="w-4 h-4 text-[#2563EB]" />}
            >
              View Public Results Feed
            </Button>
          </Link>
        </div>

        {/* Workflow Guide Banner */}
        <div className="flex flex-col gap-2 rounded-xl border border-blue-200 bg-blue-50/70 p-3.5 text-xs leading-5 text-blue-950 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex min-w-0 items-start gap-2">
            <FileCheck className="w-4 h-4 text-[#2563EB] shrink-0" />
            <span>
              <strong>Publication Lifecycle:</strong> 1. Judge submits marks → 2. Ready for Review → 3. Admin confirms ranks → 4. Admin publishes → 5. Team points update in ledger.
            </span>
          </div>
          <span className="text-[11px] font-semibold text-[#2563EB]">Idempotent Points Ledger Protected</span>
        </div>

        {/* Filter bar */}
        <div className="rounded-xl border border-[#E2E8F0] bg-white p-3.5 shadow-sm sm:p-4">
          <div className="relative w-full md:max-w-lg md:flex-1">
            <Search className="w-4 h-4 text-[#526070] absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
            <input
              type="text"
              placeholder="Search competition code or name..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="min-h-11 w-full rounded-lg border border-[#E2E8F0] bg-[#F8FAFC] py-2.5 pl-9 pr-4 text-sm text-[#0F172A] outline-none transition focus:border-blue-500 focus:bg-white focus:ring-2 focus:ring-blue-100"
            />
          </div>

          <div className="mt-3 flex w-full flex-col gap-2 sm:flex-row md:mt-0 md:w-auto">
            <select
              aria-label="Filter by Publication Status"
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="min-h-11 w-full rounded-lg border border-[#E2E8F0] bg-[#F8FAFC] px-3 py-2.5 text-sm font-semibold text-[#0F172A] outline-none transition focus:border-blue-500 focus:bg-white focus:ring-2 focus:ring-blue-100 sm:w-auto"
            >
              <option value="ALL">All Publication States</option>
              <option value="READY_FOR_REVIEW">Ready for Review</option>
              <option value="READY_TO_PUBLISH">Ready to Publish</option>
              <option value="PUBLISHED">Published Results</option>
              <option value="REVISION_REQUIRED">Revision Required</option>
              <option value="AWAITING_MARKS">Awaiting Marks</option>
              <option value="DRAFT">Drafts</option>
            </select>
          </div>
        </div>

        {/* Results overview */}
        <div className="grid grid-cols-2 gap-3 sm:gap-4 xl:grid-cols-4">
          <div className="flex min-w-0 items-center justify-between rounded-xl border border-[#E2E8F0] bg-white p-3.5 shadow-sm sm:p-4">
            <div className="min-w-0"><span className="text-[10px] font-bold uppercase tracking-wider text-[#64748B] sm:text-xs">Total results</span><h3 className="mt-1 text-2xl font-bold tabular-nums text-[#0F172A]">{results.length}</h3></div>
            <div className="ml-2 flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-slate-100 text-slate-600 sm:h-10 sm:w-10"><Trophy className="h-5 w-5" /></div>
          </div>
          <div className="flex min-w-0 items-center justify-between rounded-xl border border-amber-200 bg-white p-3.5 shadow-sm sm:p-4">
            <div className="min-w-0"><span className="text-[10px] font-bold uppercase tracking-wider text-amber-700 sm:text-xs">Needs review</span><h3 className="mt-1 text-2xl font-bold tabular-nums text-amber-700">{reviewCount}</h3></div>
            <div className="ml-2 flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-amber-50 text-amber-600 sm:h-10 sm:w-10"><Eye className="h-5 w-5" /></div>
          </div>
          <div className="flex min-w-0 items-center justify-between rounded-xl border border-blue-200 bg-white p-3.5 shadow-sm sm:p-4">
            <div className="min-w-0"><span className="text-[10px] font-bold uppercase tracking-wider text-blue-700 sm:text-xs">Ready to publish</span><h3 className="mt-1 text-2xl font-bold tabular-nums text-blue-700">{readyToPublishCount}</h3></div>
            <div className="ml-2 flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-blue-50 text-blue-600 sm:h-10 sm:w-10"><Send className="h-5 w-5" /></div>
          </div>
          <div className="flex min-w-0 items-center justify-between rounded-xl border border-emerald-200 bg-white p-3.5 shadow-sm sm:p-4">
            <div className="min-w-0"><span className="text-[10px] font-bold uppercase tracking-wider text-emerald-700 sm:text-xs">Published</span><h3 className="mt-1 text-2xl font-bold tabular-nums text-emerald-700">{publishedCount}</h3></div>
            <div className="ml-2 flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-emerald-50 text-emerald-600 sm:h-10 sm:w-10"><CheckCircle2 className="h-5 w-5" /></div>
          </div>
        </div>

        {/* Verification Register Table */}
        <div className="overflow-hidden rounded-xl border border-[#E2E8F0] bg-white shadow-sm">
          <div className="flex flex-col gap-2 border-b border-[#E2E8F0] px-4 py-4 sm:flex-row sm:items-center sm:justify-between sm:px-5">
            <div><h3 className="text-sm font-bold text-[#0F172A] sm:text-base">Competitions Verification Register</h3><p className="mt-0.5 text-xs text-[#64748B]">Review marks, confirm positions, and publish verified results</p></div>
            <div className="flex items-center gap-2 self-start sm:self-auto">
              <span className={"inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-semibold " + (resultsSyncState === 'ready' ? 'bg-emerald-50 text-emerald-700' : resultsSyncState === 'error' ? 'bg-red-50 text-red-700' : resultsSyncState === 'idle' ? 'bg-slate-100 text-slate-600' : 'bg-amber-50 text-amber-700')}>
                <span className={"h-1.5 w-1.5 rounded-full " + (resultsSyncState === 'ready' ? 'bg-emerald-500' : resultsSyncState === 'error' ? 'bg-red-500' : resultsSyncState === 'idle' ? 'bg-slate-400' : 'bg-amber-500')} />
                {resultsSyncState === 'ready' ? 'Live sync' : resultsSyncState === 'error' ? 'Sync issue' : resultsSyncState === 'idle' ? 'Offline' : 'Connecting'}
              </span>
              <span className="text-xs tabular-nums text-[#64748B]">{filteredResults.length} / {results.length}</span>
            </div>
          </div>
          {resultsSyncState === 'error' && <div role="alert" className="border-b border-red-100 bg-red-50 px-4 py-3 text-xs text-red-800 sm:px-5">The results feed could not be synchronized from Firestore. Check the administrator session and database permissions, then reload the page.</div>}
          {resultsSyncState === 'loading' && <div className="flex items-center gap-3 border-b border-blue-100 bg-blue-50/70 px-4 py-3 text-xs text-blue-800 sm:px-5"><Clock className="h-4 w-4 animate-spin" />Connecting to the live results feed…</div>}

          {/* Mobile result cards */}
          <div className="divide-y divide-[#E2E8F0] lg:hidden">
            {filteredResults.length === 0 ? (
              <div className="px-4 py-10 text-center">
                <Trophy className="mx-auto mb-2 h-8 w-8 text-slate-300" />
                <p className="text-sm font-semibold text-[#0F172A]">{resultsSyncState === 'loading' ? 'Loading results…' : 'No results found'}</p>
                <p className="mx-auto mt-1 max-w-sm text-xs leading-5 text-[#64748B]">{results.length === 0 ? 'Results will appear here after judge submissions are completed.' : 'No competitions match the current search or publication filter.'}</p>
              </div>
            ) : filteredResults.map(res => (
              <article key={res.id} className="space-y-3 p-4">
                <div className="flex min-w-0 items-start justify-between gap-3">
                  <div className="min-w-0">
                    <span className="inline-flex rounded-md border border-blue-100 bg-blue-50 px-2 py-0.5 font-mono text-[11px] font-bold text-blue-700">{res.competitionCode}</span>
                    <h4 className="mt-1.5 break-words text-sm font-bold leading-5 text-[#0F172A]">{res.competitionName}</h4>
                    <p className="mt-1 text-xs text-[#64748B]">{res.categoryName} · {res.type === 'SOLO' ? 'Individual' : 'Group'} · {res.stageName}</p>
                  </div>
                  <div className="shrink-0">{getResultStatusBadge(res.resultStatus)}</div>
                </div>
                <div className="grid grid-cols-2 gap-2 rounded-lg bg-slate-50 p-3">
                  <div><span className="block text-[10px] font-semibold uppercase tracking-wide text-[#64748B]">Marks</span><Badge variant={res.marksStatus === 'COMPLETE' ? 'success' : 'warning'} size="sm">{res.marksStatus}</Badge></div>
                  <div><span className="block text-[10px] font-semibold uppercase tracking-wide text-[#64748B]">Published</span><span className="mt-1 block text-xs font-medium text-[#334155]">{res.publishedDate || 'Not yet published'}</span></div>
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <Button variant="outline" size="sm" className="w-full" leftIcon={<Eye className="h-3.5 w-3.5" />} onClick={() => setSelectedResult(res)}>Review details</Button>
                  {res.resultStatus === 'PUBLISHED' ? (
                    <Button variant="outline" size="sm" className="w-full" leftIcon={<RotateCcw className="h-3.5 w-3.5 text-red-600" />} onClick={() => void handleUnpublish(res.id, 'Admin unpublish from Results card')} disabled={savingResult} isLoading={savingResult}>Unpublish</Button>
                  ) : res.resultStatus === 'READY_TO_PUBLISH' ? (
                    <Button variant="primary" size="sm" className="w-full" leftIcon={<CheckCircle2 className="h-3.5 w-3.5" />} onClick={() => setPublishConfirmResult(res)} disabled={savingResult}>Publish</Button>
                  ) : res.resultStatus === 'READY_FOR_REVIEW' || res.resultStatus === 'REVISION_REQUIRED' ? (
                    <Button variant="secondary" size="sm" className="w-full" leftIcon={<FileCheck className="h-3.5 w-3.5" />} onClick={() => setSelectedResult(res)} disabled={savingResult}>Audit &amp; confirm</Button>
                  ) : (
                    <span className="flex items-center justify-center rounded-lg border border-dashed border-[#CBD5E1] px-2 text-center text-[11px] text-[#64748B]">Awaiting marks</span>
                  )}
                </div>
              </article>
            ))}
          </div>

          {/* Desktop register */}
          <div className="hidden overflow-x-auto lg:block">
            <table className="w-full min-w-[1120px] text-left text-xs">
              <thead>
                <tr className="border-b border-[#E1E7EF] bg-[#F8FAFC] text-[#526070] font-bold uppercase text-[11px]">
                  <th className="px-5 py-3">Competition</th>
                  <th className="py-3 px-6">Category</th>
                  <th className="px-5 py-3 text-center">Type</th>
                  <th className="py-3 px-6 text-center">Marks Status</th>
                  <th className="py-3 px-6 text-center">Result Status</th>
                  <th className="py-3 px-6">Published Date</th>
                  <th className="px-5 py-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#E1E7EF]">
                {filteredResults.length === 0 ? (
                  <tr><td colSpan={7} className="px-6 py-14 text-center">
                    <Trophy className="mx-auto mb-2 h-8 w-8 text-slate-300" />
                    <p className="text-sm font-semibold text-[#0F172A]">{resultsSyncState === 'loading' ? 'Loading results…' : 'No results found'}</p>
                    <p className="mt-1 text-xs text-[#64748B]">{results.length === 0 ? 'Results will appear here after judge submissions are completed.' : 'No competitions match the current search or publication filter.'}</p>
                  </td></tr>
                ) : filteredResults.map((res) => (
                  <tr key={res.id} className="hover:bg-[#F8FAFC] transition-colors">
                    <td className="px-5 py-4">
                      <div className="flex items-center gap-2.5">
                        <span className="font-mono text-xs font-bold text-[#2563EB] bg-blue-50 px-2 py-0.5 rounded border border-blue-100">
                          {res.competitionCode}
                        </span>
                        <div>
                          <span className="font-bold text-[#111111] text-sm block">{res.competitionName}</span>
                          <span className="text-[11px] text-[#526070]">Venue: {res.stageName}</span>
                        </div>
                      </div>
                    </td>
                    <td className="px-5 py-4 font-semibold text-[#111111]">
                      {res.categoryName}
                    </td>
                    <td className="px-5 py-4 text-center">
                      <span className={`text-[10px] font-bold px-2 py-0.5 rounded ${res.type === 'SOLO' ? 'bg-slate-100 text-slate-800' : 'bg-purple-100 text-purple-800'}`}>
                        {res.type === 'SOLO' ? 'Individual' : 'Group'}
                      </span>
                    </td>
                    <td className="py-4 px-6 text-center font-semibold">
                      <Badge variant={res.marksStatus === 'COMPLETE' ? 'success' : 'warning'} size="sm">
                        {res.marksStatus}
                      </Badge>
                    </td>
                    <td className="py-4 px-6 text-center">
                      {getResultStatusBadge(res.resultStatus)}
                    </td>
                    <td className="px-5 py-4 text-[#64748B]">
                      {res.publishedDate || 'Not yet published'}
                    </td>
                    <td className="px-5 py-4 text-right">
                      <div className="flex items-center justify-end gap-2">
                        {/* Review Breakdown Button */}
                        <Button
                          variant="outline"
                          size="sm"
                          leftIcon={<Eye className="w-3.5 h-3.5" />}
                          onClick={() => setSelectedResult(res)}
                        >
                          Review &amp; Verify
                        </Button>

                        {/* Publish / Unpublish Button */}
                        {res.resultStatus === 'PUBLISHED' ? (
                          <Button
                            variant="outline"
                            size="sm"
                            leftIcon={<RotateCcw className="w-3.5 h-3.5 text-[#DC2626]" />}
                            onClick={() => void handleUnpublish(res.id, 'Admin unpublish from Results table')}
                            disabled={savingResult}
                          >
                            Unpublish
                          </Button>
                        ) : res.resultStatus === 'READY_TO_PUBLISH' ? (
                          <Button
                            variant="primary"
                            size="sm"
                            leftIcon={<CheckCircle2 className="w-3.5 h-3.5" />}
                            onClick={() => setPublishConfirmResult(res)}
                          >
                            Publish Result
                          </Button>
                        ) : res.resultStatus === 'READY_FOR_REVIEW' || res.resultStatus === 'REVISION_REQUIRED' ? (
                          <Button
                            variant="secondary"
                            size="sm"
                            leftIcon={<FileCheck className="w-3.5 h-3.5 text-[#2563EB]" />}
                            onClick={() => setSelectedResult(res)}
                          >
                            Audit &amp; Confirm
                          </Button>
                        ) : (
                          <span className="text-[11px] text-[#526070] italic px-2">Awaiting Marks</span>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Verification Breakdown Modal */}
        <Modal
          isOpen={!!selectedResult}
          onClose={() => setSelectedResult(null)}
          title={`Tabulation Audit: ${selectedResult?.competitionName}`}
          description="Detailed breakdown of participant marks, assigned grades, and official championship points"
          maxWidth="4xl"
          footer={
            <div className="flex w-full flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
              <Button
                variant="outline"
                size="sm"
                className="w-full sm:w-auto"
                leftIcon={<Sparkles className="w-4 h-4 text-amber-500" />}
                onClick={() => {
                  setPosterStudioResult(selectedResult);
                  setSelectedResult(null);
                }}
              >
                Open Poster Studio
              </Button>
              <div className="grid w-full grid-cols-1 gap-2 sm:flex sm:w-auto sm:items-center">
                <Button variant="outline" size="sm" className="w-full sm:w-auto" onClick={() => setSelectedResult(null)}>
                  Close Audit
                </Button>
                {selectedResult && (selectedResult.resultStatus === 'READY_FOR_REVIEW' || selectedResult.resultStatus === 'REVISION_REQUIRED') && (
                  <Button
                    variant="secondary"
                    size="sm"
                    leftIcon={<FileCheck className="w-4 h-4 text-[#2563EB]" />}
                    onClick={() => void handleConfirmGradesAndPositions(selectedResult)}
                    disabled={savingResult}
                    isLoading={savingResult}
                    className="w-full sm:w-auto"
                  >
                    Confirm Positions &amp; Grades
                  </Button>
                )}
                {selectedResult && selectedResult.resultStatus === 'READY_TO_PUBLISH' && (
                  <Button
                    variant="primary"
                    size="sm"
                    leftIcon={<CheckCircle2 className="w-4 h-4" />}
                    onClick={() => {
                      setPublishConfirmResult(selectedResult);
                      setSelectedResult(null);
                    }}
                    disabled={savingResult}
                    className="w-full sm:w-auto"
                  >
                    Authorize &amp; Publish
                  </Button>
                )}
                {selectedResult?.resultStatus === 'PUBLISHED' && (
                  <Button
                    variant="outline"
                    size="sm"
                    className="text-[#DC2626] border-red-200 hover:bg-red-50"
                    leftIcon={<RotateCcw className="w-4 h-4 text-[#DC2626]" />}
                    onClick={() => void handleUnpublish(selectedResult.id, 'Unpublished from Audit Modal')}
                    disabled={savingResult}
                    isLoading={savingResult}
                    className="w-full sm:w-auto"
                  >
                    Unpublish Result
                  </Button>
                )}
              </div>
            </div>
          }
        >
          {selectedResult && (
            <div className="space-y-4">
              <div className="grid grid-cols-1 gap-3 rounded-xl border border-[#E2E8F0] bg-slate-50 p-3.5 text-xs sm:grid-cols-3 sm:p-4">
                <div>
                  <span className="text-[#526070] font-medium block">Adjudication Category:</span>
                  <span className="font-bold text-[#111111]">{selectedResult.categoryName} ({selectedResult.type})</span>
                </div>
                <div>
                  <span className="text-[#526070] font-medium block">Venue Location:</span>
                  <span className="font-bold text-[#111111]">{selectedResult.stageName}</span>
                </div>
                <div>
                  <span className="text-[#526070] font-medium block">Publication State:</span>
                  {getResultStatusBadge(selectedResult.resultStatus)}
                </div>
              </div>

              {selectedResult.ranks.length === 0 ? (
                <div className="p-8 text-center bg-[#F8FAFC] rounded-xl border border-[#E1E7EF]">
                  <Clock className="w-8 h-8 text-[#526070] mx-auto mb-2" />
                  <h4 className="text-sm font-bold text-[#111111]">Scores Pending Juror Submission</h4>
                  <p className="text-xs text-[#526070] mt-1">
                    Jury evaluation sheet has not been submitted or finalized for this event.
                  </p>
                </div>
              ) : (
                <>
                {/* Mobile audit cards */}
                <div className="space-y-3 md:hidden">
                  {selectedResult.ranks.map(rk => (
                    <article key={rk.registrationId} className="rounded-xl border border-[#E2E8F0] bg-white p-3.5 shadow-sm">
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0"><p className="break-words text-sm font-bold text-[#0F172A]">{rk.candidateName}</p><p className="mt-0.5 font-mono text-[10px] text-[#64748B]">{rk.bib}</p></div>
                        <div className="shrink-0 text-right">
                          {rk.rank === 1 ? <Badge variant="warning" size="sm">1st Place</Badge> : rk.rank === 2 ? <Badge variant="default" size="sm">2nd Place</Badge> : rk.rank === 3 ? <Badge variant="info" size="sm">3rd Place</Badge> : <Badge variant="default" size="sm">No Prize</Badge>}
                        </div>
                      </div>
                      <div className="mt-3 grid grid-cols-2 gap-2 rounded-lg bg-slate-50 p-3">
                        <div><span className="block text-[10px] font-semibold uppercase text-[#64748B]">House</span><span className="mt-0.5 block text-xs font-semibold text-[#0F172A]">{rk.teamName} <span className="font-normal text-[#64748B]">({rk.teamCode})</span></span></div>
                        <div><span className="block text-[10px] font-semibold uppercase text-[#64748B]">Score</span><span className="mt-0.5 block text-sm font-bold tabular-nums text-[#0F172A]">{rk.score}</span></div>
                        <div><span className="block text-[10px] font-semibold uppercase text-[#64748B]">Grade</span><span className="mt-0.5 block text-xs font-bold text-blue-700">Grade {rk.grade}</span></div>
                        <div><span className="block text-[10px] font-semibold uppercase text-[#64748B]">{selectedResult.type === 'GROUP' ? 'Team points' : 'Points'}</span><span className="mt-0.5 block text-sm font-bold tabular-nums text-emerald-700">+{rk.officialPoints ?? rk.totalEarnedPoints} pts</span></div>
                      </div>
                      {selectedResult.type === 'GROUP' && <p className="mt-2 text-[10px] font-medium text-[#64748B]">Points are awarded to the team only.</p>}
                    </article>
                  ))}
                </div>
                {/* Desktop audit table */}
                <div className="hidden overflow-x-auto rounded-xl border border-[#E2E8F0] md:block">
                  <table className="w-full min-w-[780px] text-left text-xs">
                    <thead>
                      <tr className="bg-[#F8FAFC] border-b border-[#E1E7EF] text-[#526070] font-bold uppercase text-[10px]">
                        <th className="py-2.5 px-4">Rank</th>
                        <th className="py-2.5 px-4">Candidate / Troupe</th>
                        <th className="py-2.5 px-4">House</th>
                        <th className="py-2.5 px-4 text-center">Score</th>
                        <th className="py-2.5 px-4 text-center">Grade</th>
                        <th className="py-2.5 px-4 text-right">Team Points</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-[#E1E7EF]">
                      {selectedResult.ranks.map(rk => (
                        <tr key={rk.registrationId} className="hover:bg-[#F8FAFC]">
                          <td className="py-3 px-4 font-bold text-[#111111]">
                            {rk.rank === 1 && <span className="text-amber-600 font-extrabold mr-1">🥇 1st</span>}
                            {rk.rank === 2 && <span className="text-slate-600 font-extrabold mr-1">🥈 2nd</span>}
                            {rk.rank === 3 && <span className="text-amber-800 font-extrabold mr-1">🥉 3rd</span>}
                            {!rk.rank && <span className="text-[#526070] font-medium text-[11px]">No Prize</span>}
                          </td>
                          <td className="py-3 px-4">
                            <span className="font-bold text-[#111111] block">{rk.candidateName}</span>
                            <span className="text-[10px] font-mono text-[#526070]">{rk.bib}</span>
                          </td>
                          <td className="py-3 px-4">
                            <span className="font-semibold text-[#111111]">{rk.teamName}</span> ({rk.teamCode})
                          </td>
                          <td className="py-3 px-4 text-center font-black text-sm text-[#111111]">
                            {rk.score}
                          </td>
                          <td className="py-3 px-4 text-center font-bold text-[#2563EB]">
                            Grade {rk.grade}
                          </td>
                          <td className="py-3 px-4 text-right font-extrabold text-emerald-600 text-sm">
                            +{rk.officialPoints ?? rk.totalEarnedPoints} pts
                            {selectedResult.type === 'GROUP' && <span className="block text-[10px] font-medium text-[#526070]">Team only</span>}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                </>
              )}

              {/* Official Point Rule Reference */}
              <div className="flex flex-col gap-2 rounded-lg border border-blue-200 bg-blue-50/70 p-3 text-[11px] leading-5 text-blue-900 sm:flex-row sm:items-center sm:justify-between">
                <span>
                  <strong>Official points matrix:</strong> Exact lookup from ({selectedResult.type}, Grade, Position). Points commit to championship ledger exclusively upon publication.
                </span>
                <span className="font-bold text-[#2563EB]">Idempotent Ledger</span>
              </div>
            </div>
          )}
        </Modal>

        {/* Confirmation Modal for Publish Action */}
        <Modal
          isOpen={!!publishConfirmResult}
          onClose={() => setPublishConfirmResult(null)}
          title="Confirm Official Result Publication"
          description="This action commits points to the official championship ledger and releases verified rankings to the public website."
          maxWidth="md"
          footer={
            <div className="grid w-full grid-cols-1 gap-2 sm:flex sm:items-center sm:justify-end">
              <Button variant="outline" size="sm" className="w-full sm:w-auto" onClick={() => setPublishConfirmResult(null)} disabled={savingResult}>
                Cancel
              </Button>
              <Button variant="primary" size="sm" className="w-full sm:w-auto" onClick={() => void handleConfirmPublish()} disabled={savingResult} isLoading={savingResult} leftIcon={<CheckCircle2 className="w-4 h-4" />}>
                Confirm &amp; Publish Official Result
              </Button>
            </div>
          }
        >
          {publishConfirmResult && (
            <div className="space-y-3">
              <div className="flex items-start gap-2.5 rounded-lg border border-amber-200 bg-amber-50 p-3.5 text-xs leading-5 text-amber-900">
                <ShieldAlert className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
                <div>
                  <h4 className="font-bold">Official Publication Check</h4>
                  <p className="mt-0.5 text-amber-800">
                    Are you sure you want to publish results for <strong>{publishConfirmResult.competitionName}</strong>? Once published, candidate ranks and house championship points become visible to all public visitors.
                  </p>
                </div>
              </div>

              <div className="space-y-1 rounded-lg border border-[#E2E8F0] bg-slate-50 p-3 text-xs text-[#64748B]">
                <div>Event: <strong className="text-[#0F172A]">{publishConfirmResult.competitionName} [{publishConfirmResult.competitionCode}]</strong></div>
                <div>Category: <strong className="text-[#0F172A]">{publishConfirmResult.categoryName}</strong></div>
                <div>Type: <strong className="text-[#111111]">{publishConfirmResult.type === 'SOLO' ? 'Individual' : 'Group'}</strong></div>
                <div>Verified entries: <strong className="text-[#0F172A]">{publishConfirmResult.ranks.length}</strong></div>
              </div>
            </div>
          )}
        </Modal>

        {/* Poster Studio Modal */}
        <PosterStudioModal
          result={posterStudioResult}
          isOpen={!!posterStudioResult}
          onClose={() => setPosterStudioResult(null)}
        />
      </div>
    </AdminLayout>
  );
}
