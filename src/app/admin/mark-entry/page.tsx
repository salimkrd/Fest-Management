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
  const { markEntries, competitions, addOrUpdateJudgeAssignment } = useFest();

  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('ALL');
  const [selectedForDispatch, setSelectedForDispatch] = useState<MarkEntry | null>(null);
  const [assignModalOpen, setAssignModalOpen] = useState(false);

  // Assignment Form State
  const [competitionId, setCompetitionId] = useState(competitions[0]?.id || '');
  const [judgeName, setJudgeName] = useState('');
  const [judgePhone, setJudgePhone] = useState('+91 9847');
  const [error, setError] = useState('');

  const filteredEntries = markEntries.filter(m => {
    const matchesSearch = m.competitionName.toLowerCase().includes(search.toLowerCase()) ||
                          m.competitionCode.toLowerCase().includes(search.toLowerCase()) ||
                          m.judgeName.toLowerCase().includes(search.toLowerCase());
    const matchesStatus = statusFilter === 'ALL' || m.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  const notStartedCount = markEntries.filter(m => m.status === 'NOT_STARTED').length;
  const inProgressCount = markEntries.filter(m => m.status === 'IN_PROGRESS').length;
  const submittedCount = markEntries.filter(m => m.status === 'SUBMITTED').length;

  const handleOpenAssign = () => {
    setCompetitionId(competitions[0]?.id || '');
    setJudgeName('');
    setJudgePhone('+91 9847');
    setError('');
    setAssignModalOpen(true);
  };

  const handleSaveAssignment = (e: React.FormEvent) => {
    e.preventDefault();
    if (!judgeName || !judgePhone) {
      setError('Please provide judge name and WhatsApp phone number.');
      return;
    }

    addOrUpdateJudgeAssignment({
      competitionId,
      judgeName,
      judgePhone
    });

    setAssignModalOpen(false);
  };

  const getStatusBadge = (st: MarkEntry['status']) => {
    switch (st) {
      case 'SUBMITTED':
        return <Badge variant="success" size="sm" dot>SUBMITTED</Badge>;
      case 'IN_PROGRESS':
        return <Badge variant="warning" size="sm" dot>IN PROGRESS</Badge>;
      case 'NOT_STARTED':
      default:
        return <Badge variant="default" size="sm" dot>NOT STARTED</Badge>;
    }
  };

  return (
    <AdminLayout>
      <div className="space-y-6 max-w-6xl">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-2 border-b border-[#E1E7EF]">
          <div>
            <h1 className="text-xl sm:text-2xl font-bold text-[#111111] tracking-tight">
              Mark Entry &amp; Jury Dispatch
            </h1>
            <p className="text-xs text-[#526070] mt-1">
              Issue secure evaluation links to stage judges via WhatsApp and monitor live score submission status
            </p>
          </div>
          <Button
            variant="primary"
            size="md"
            leftIcon={<UserPlus className="w-4 h-4" />}
            onClick={handleOpenAssign}
          >
            Assign Judge &amp; Generate Link
          </Button>
        </div>

        {/* 3 Status KPI Pills */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div className="bg-white p-4 rounded-xl border border-[#E1E7EF] flex items-center justify-between shadow-xs">
            <div>
              <span className="text-xs text-[#526070] uppercase font-bold tracking-wider">Awaiting Evaluation</span>
              <h3 className="text-2xl font-bold text-[#111111] mt-1">{notStartedCount} Events</h3>
            </div>
            <div className="w-10 h-10 rounded-lg bg-neutral-100 flex items-center justify-center text-[#526070]">
              <Clock className="w-5 h-5" />
            </div>
          </div>

          <div className="bg-white p-4 rounded-xl border border-[#E1E7EF] flex items-center justify-between shadow-xs">
            <div>
              <span className="text-xs text-[#526070] uppercase font-bold tracking-wider">Live In Progress</span>
              <h3 className="text-2xl font-bold text-amber-600 mt-1">{inProgressCount} Events</h3>
            </div>
            <div className="w-10 h-10 rounded-lg bg-amber-50 flex items-center justify-center text-amber-600">
              <Clock className="w-5 h-5" />
            </div>
          </div>

          <div className="bg-white p-4 rounded-xl border border-[#E1E7EF] flex items-center justify-between shadow-xs">
            <div>
              <span className="text-xs text-[#526070] uppercase font-bold tracking-wider">Submitted &amp; Sealed</span>
              <h3 className="text-2xl font-bold text-emerald-600 mt-1">{submittedCount} Events</h3>
            </div>
            <div className="w-10 h-10 rounded-lg bg-emerald-50 flex items-center justify-center text-emerald-600">
              <CheckCircle2 className="w-5 h-5" />
            </div>
          </div>
        </div>

        {/* Search & Filter Bar */}
        <div className="bg-white p-4 rounded-xl border border-[#E1E7EF] flex flex-col md:flex-row items-center justify-between gap-4">
          <div className="relative flex-1 w-full md:max-w-md">
            <Search className="w-4 h-4 text-[#526070] absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
            <input
              type="text"
              placeholder="Search event code, competition or judge..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full text-xs pl-9 pr-4 py-2 bg-[#F8FAFC] border border-[#E1E7EF] rounded-lg text-[#111111] focus:outline-none focus:bg-white focus:border-[#2563EB]"
            />
          </div>

          <div className="flex items-center gap-3 w-full md:w-auto">
            <select
              aria-label="Filter by Evaluation Status"
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="text-xs font-semibold py-2 px-3 rounded-lg border border-[#E1E7EF] bg-[#F8FAFC] text-[#111111] focus:outline-none focus:bg-white"
            >
              <option value="ALL">All Evaluation States</option>
              <option value="NOT_STARTED">Not Started</option>
              <option value="IN_PROGRESS">In Progress</option>
              <option value="SUBMITTED">Submitted</option>
            </select>
          </div>
        </div>

        {/* Evaluation Table */}
        <div className="bg-white rounded-xl border border-[#E1E7EF] shadow-xs overflow-hidden">
          <div className="px-6 py-4 border-b border-[#E1E7EF] flex items-center justify-between">
            <h3 className="text-sm font-bold text-[#111111]">Stage Evaluation Roster</h3>
            <span className="text-xs text-[#526070]">{filteredEntries.length} Assigned Competitions</span>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="border-b border-[#E1E7EF] bg-[#F8FAFC] text-[#526070] font-bold uppercase text-[11px]">
                  <th className="py-3 px-6">Competition Name &amp; Code</th>
                  <th className="py-3 px-6">Category / Type</th>
                  <th className="py-3 px-6">Assigned Judges</th>
                  <th className="py-3 px-6 text-center">Mark Entry Status</th>
                  <th className="py-3 px-6 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#E1E7EF]">
                {filteredEntries.map((entry) => (
                  <tr key={entry.id} className="hover:bg-[#F8FAFC] transition-colors">
                    <td className="py-4 px-6">
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
                    <td className="py-4 px-6 font-semibold text-[#111111]">
                      {entry.categoryName} · {entry.type}
                    </td>
                    <td className="py-4 px-6">
                      <span className="font-semibold text-[#111111] block">{entry.judgeName}</span>
                      <span className="text-[11px] text-[#526070]">{entry.judgePhone}</span>
                    </td>
                    <td className="py-4 px-6 text-center">
                      {getStatusBadge(entry.status)}
                    </td>
                    <td className="py-4 px-6 text-right">
                      <div className="flex items-center justify-end gap-2">
                        {/* WhatsApp Dispatch Button */}
                        <Button
                          variant="outline"
                          size="sm"
                          leftIcon={<MessageSquare className="w-3.5 h-3.5 text-emerald-600" />}
                          onClick={() => setSelectedForDispatch(entry)}
                        >
                          Dispatch Link
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
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* WhatsApp Dispatch Drawer Modal */}
        <WhatsAppDispatchModal
          markEntry={selectedForDispatch}
          isOpen={!!selectedForDispatch}
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
              <Button variant="primary" size="sm" onClick={handleSaveAssignment}>
                Generate Credentials
              </Button>
            </div>
          }
        >
          <form onSubmit={handleSaveAssignment} className="space-y-4">
            {error && (
              <p className="text-xs text-[#DC2626] font-semibold">{error}</p>
            )}

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
      </div>
    </AdminLayout>
  );
}
