'use client';

import React, { useState } from 'react';
import { jsPDF } from 'jspdf';
import { AdminLayout } from '@/components/layout/AdminLayout';
import { useFest } from '@/context/FestContext';
import { Competition, CompetitionType, CompetitionStatus, CompetitionPerformanceMode } from '@/types/fest';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Select } from '@/components/ui/Select';
import { Badge } from '@/components/ui/Badge';
import { Modal } from '@/components/ui/Modal';
import { Plus, Search, Edit2, Trash2, Trophy, MapPin, AlertCircle, FileDown } from 'lucide-react';

export default function CompetitionsPage() {
  const { competitions, categories, schedules, registrations, participants, results, markEntries, addCompetition, updateCompetition, deleteCompetition } = useFest();

  const [search, setSearch] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('ALL');
  const [typeFilter, setTypeFilter] = useState('ALL');
  const [performanceFilter, setPerformanceFilter] = useState('ALL');
  const [modalOpen, setModalOpen] = useState(false);
  const [editingComp, setEditingComp] = useState<Competition | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const getCompetitionRegistrations = (competitionId: string) =>
    registrations
      .filter(reg => reg.competitionId === competitionId && reg.status !== 'REJECTED' && reg.status !== 'CANCELLED')
      .sort((a, b) => a.teamName.localeCompare(b.teamName) || a.participantName.localeCompare(b.participantName));

  const handleDownloadParticipants = (competition: Competition) => {
    try {
      const entries = getCompetitionRegistrations(competition.id);
      const pdf = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4', compress: true });
      const pageWidth = 1240;
      const pageHeight = 1754;
      const margin = 70;
      const contentWidth = pageWidth - margin * 2;
      const columnWidths = [60, 145, 280, 210, 220, 185];
      const columnLabels = ['No.', 'Bib / Chest No.', 'Participant / Group Leader', 'Team', 'Registration ID', 'Status'];
      const lineHeight = 22;
      const participantsById = new Map(participants.map((participant) => [participant.id, participant] as const));
      let currentPageNumber = 1;
      let currentCanvas = document.createElement('canvas');
      let currentContext = currentCanvas.getContext('2d') as CanvasRenderingContext2D;
      let currentY = 0;

      const wrapText = (ctx: CanvasRenderingContext2D, value: string, maxWidth: number) => {
        const output: string[] = [];
        String(value || '-').split('\n').forEach((paragraph) => {
          const words = paragraph.split(/\s+/).filter(Boolean);
          if (words.length === 0) {
            output.push('');
            return;
          }
          let line = '';
          words.forEach((word) => {
            const candidate = line ? line + ' ' + word : word;
            if (ctx.measureText(candidate).width <= maxWidth) {
              line = candidate;
              return;
            }
            if (line) output.push(line);
            if (ctx.measureText(word).width <= maxWidth) {
              line = word;
              return;
            }
            let fragment = '';
            Array.from(word).forEach((character) => {
              const next = fragment + character;
              if (fragment && ctx.measureText(next).width > maxWidth) {
                output.push(fragment);
                fragment = character;
              } else {
                fragment = next;
              }
            });
            line = fragment;
          });
          if (line) output.push(line);
        });
        return output.length ? output : ['-'];
      };

      const drawTableHeader = (ctx: CanvasRenderingContext2D, top: number) => {
        ctx.fillStyle = '#eaf1ff';
        ctx.fillRect(margin, top, contentWidth, 48);
        ctx.strokeStyle = '#94a3b8';
        ctx.lineWidth = 1.5;
        ctx.font = 'bold 17px Arial, sans-serif';
        let x = margin;
        columnLabels.forEach((label, index) => {
          const lines = wrapText(ctx, label, columnWidths[index] - 14);
          ctx.strokeRect(x, top, columnWidths[index], 48);
          ctx.fillStyle = '#172554';
          lines.slice(0, 2).forEach((line, lineIndex) => {
            ctx.fillText(line, x + 8, top + 8 + lineIndex * 20);
          });
          x += columnWidths[index];
        });
      };

      const createPage = (continued: boolean) => {
        const canvas = document.createElement('canvas');
        canvas.width = pageWidth;
        canvas.height = pageHeight;
        const context = canvas.getContext('2d');
        if (!context) throw new Error('Unable to prepare the PDF page.');
        context.fillStyle = '#ffffff';
        context.fillRect(0, 0, pageWidth, pageHeight);
        context.textBaseline = 'top';
        context.textAlign = 'left';

        let y = 58;
        if (continued) {
          context.fillStyle = '#1e40af';
          context.font = 'bold 25px Arial, sans-serif';
          context.fillText('INSPIRATH', margin, y);
          context.fillStyle = '#475569';
          context.font = '16px Arial, sans-serif';
          context.textAlign = 'right';
          context.fillText('PARTICIPANT LIST - CONTINUED', pageWidth - margin, y + 6);
          context.textAlign = 'left';
          y += 54;
          context.fillStyle = '#0f172a';
          context.font = 'bold 21px Arial, sans-serif';
          const titleLines = wrapText(context, competition.name, contentWidth);
          titleLines.slice(0, 2).forEach((line, index) => context.fillText(line, margin, y + index * 26));
          y += Math.min(titleLines.length, 2) * 26 + 14;
        } else {
          context.fillStyle = '#1e40af';
          context.font = 'bold 34px Arial, sans-serif';
          context.textAlign = 'center';
          context.fillText('INSPIRATH', pageWidth / 2, y);
          context.fillStyle = '#334155';
          context.font = 'bold 16px Arial, sans-serif';
          context.fillText('OFFICIAL COMPETITION PARTICIPANT LIST', pageWidth / 2, y + 42);
          context.fillStyle = '#0f172a';
          context.font = 'bold 27px Arial, sans-serif';
          const titleLines = wrapText(context, competition.name, contentWidth);
          titleLines.slice(0, 2).forEach((line, index) => context.fillText(line, pageWidth / 2, y + 76 + index * 32));
          context.textAlign = 'left';
          y += 76 + Math.min(titleLines.length, 2) * 32 + 18;

          context.fillStyle = '#334155';
          context.font = '17px Arial, sans-serif';
          const meta = 'Code: ' + competition.code + '    Category: ' + competition.categoryName + '    Type: ' +
            (competition.type === 'GROUP' ? 'Group' : 'Individual') + '    Date: ' + (competition.date || '-');
          const metaLines = wrapText(context, meta, contentWidth);
          metaLines.forEach((line, index) => context.fillText(line, margin, y + index * 24));
          y += metaLines.length * 24 + 18;
          context.strokeStyle = '#1d4ed8';
          context.lineWidth = 3;
          context.beginPath();
          context.moveTo(margin, y);
          context.lineTo(pageWidth - margin, y);
          context.stroke();
          y += 22;
        }
        drawTableHeader(context, y);
        y += 48;
        return { canvas, context, y };
      };

      const saveCurrentPage = (isLastPage: boolean) => {
        currentContext.strokeStyle = '#cbd5e1';
        currentContext.lineWidth = 1.5;
        currentContext.beginPath();
        currentContext.moveTo(margin, pageHeight - 78);
        currentContext.lineTo(pageWidth - margin, pageHeight - 78);
        currentContext.stroke();
        currentContext.fillStyle = '#475569';
        currentContext.font = '15px Arial, sans-serif';
        currentContext.textAlign = 'left';
        if (isLastPage) {
          currentContext.font = 'bold 16px Arial, sans-serif';
          currentContext.fillText('Total registered entries: ' + entries.length, margin, pageHeight - 64);
        } else {
          currentContext.fillText('INSPIRATH Fest Management', margin, pageHeight - 64);
        }
        currentContext.textAlign = 'right';
        currentContext.font = '15px Arial, sans-serif';
        currentContext.fillText('Page ' + currentPageNumber, pageWidth - margin, pageHeight - 64);
        currentContext.textAlign = 'left';

        const image = currentCanvas.toDataURL('image/jpeg', 0.94);
        if (currentPageNumber > 1) pdf.addPage();
        pdf.addImage(image, 'JPEG', 0, 0, 210, 297, 'participant-page-' + currentPageNumber, 'FAST');
      };

      const beginPage = (continued: boolean) => {
        const page = createPage(continued);
        currentCanvas = page.canvas;
        currentContext = page.context;
        currentY = page.y;
      };

      beginPage(false);
      const rows = entries.map((entry, index) => {
        const participant = participantsById.get(entry.participantId || entry.groupLeaderId || '');
        const participantName = entry.participantName || participant?.name || '-';
        const displayName = entry.type === 'GROUP' ? participantName + '\nGroup entry - leader' : participantName;
        return [
          String(index + 1),
          entry.chestNumber || participant?.bib || '-',
          displayName,
          entry.teamName ? entry.teamName + (entry.teamCode ? ' (' + entry.teamCode + ')' : '') : '-',
          entry.code || '-',
          entry.status || '-'
        ];
      });

      if (rows.length === 0) {
        const emptyHeight = 56;
        currentContext.fillStyle = '#64748b';
        currentContext.font = '18px Arial, sans-serif';
        currentContext.fillText('No participants registered for this competition.', margin + 12, currentY + 18);
        currentContext.strokeStyle = '#cbd5e1';
        currentContext.strokeRect(margin, currentY, contentWidth, emptyHeight);
        currentY += emptyHeight;
      } else {
        rows.forEach((row, rowIndex) => {
          currentContext.font = '16px Arial, sans-serif';
          const cellLines = row.map((value, columnIndex) =>
            wrapText(currentContext, value, columnWidths[columnIndex] - 16)
          );
          const maxLines = Math.max(...cellLines.map((lines) => lines.length));
          const rowHeight = Math.max(42, maxLines * lineHeight + 16);
          if (currentY + rowHeight > pageHeight - 96) {
            saveCurrentPage(false);
            currentPageNumber += 1;
            beginPage(true);
          }

          currentContext.fillStyle = rowIndex % 2 === 0 ? '#ffffff' : '#f8fafc';
          currentContext.fillRect(margin, currentY, contentWidth, rowHeight);
          currentContext.strokeStyle = '#cbd5e1';
          currentContext.lineWidth = 1;
          let x = margin;
          cellLines.forEach((lines, columnIndex) => {
            currentContext.strokeRect(x, currentY, columnWidths[columnIndex], rowHeight);
            currentContext.fillStyle = '#0f172a';
            currentContext.font = columnIndex === 0 ? 'bold 16px Arial, sans-serif' : '16px Arial, sans-serif';
            lines.forEach((line, lineIndex) => {
              currentContext.fillText(line, x + 8, currentY + 8 + lineIndex * lineHeight);
            });
            x += columnWidths[columnIndex];
          });
          currentY += rowHeight;
        });
      }

      saveCurrentPage(true);
      pdf.setProperties({
        title: competition.name + ' - Participant List',
        subject: 'A4 competition participant list',
        creator: 'INSPIRATH Fest Management'
      });
      const safeName = (competition.code + '-' + competition.name + '-participants')
        .replace(/[^\w-]+/g, '-')
        .replace(/-+/g, '-')
        .replace(/^-|-$/g, '') || 'competition-participants';
      pdf.save(safeName + '.pdf');
    } catch (err) {
      setActionError(err instanceof Error ? err.message : 'Failed to generate the participant PDF.');
    }
  };

  // Form State
  const [name, setName] = useState('');
  const [code, setCode] = useState('');
  const [categoryId, setCategoryId] = useState(categories[0]?.id || '');
  const [type, setType] = useState<CompetitionType>('SOLO');
  const [performanceMode, setPerformanceMode] = useState<CompetitionPerformanceMode | ''>('STAGE');
  const [groupSize, setGroupSize] = useState(2);
  const [durationMinutes, setDurationMinutes] = useState(90);
  const [maxEntriesPerTeam, setMaxEntriesPerTeam] = useState(2);
  const [status, setStatus] = useState<CompetitionStatus>('SCHEDULED');
  const [error, setError] = useState('');

  // Judge assignments are managed through Mark Entry (judgeAssignments collection).
  // Do not display stale legacy names from Competition.assignedJudges.
  const getAssignedJudgeNames = (competitionId: string) => {
    const seen = new Set<string>();
    return markEntries
      .filter(entry => entry.competitionId === competitionId && !entry.revoked && entry.status !== 'REVOKED')
      .map(entry => entry.judgeName?.trim() || '')
      .filter(judgeName => {
        const key = judgeName.toLocaleLowerCase();
        if (!key || seen.has(key)) return false;
        seen.add(key);
        return true;
      });
  };

  const filteredCompetitions = competitions.filter(comp => {
    const matchesSearch = comp.name.toLowerCase().includes(search.toLowerCase()) ||
                          comp.code.toLowerCase().includes(search.toLowerCase());
    const matchesCat = categoryFilter === 'ALL' || comp.categoryId === categoryFilter;
    const matchesType = typeFilter === 'ALL' || comp.type === typeFilter;
    const matchesPerformance = performanceFilter === 'ALL' || (performanceFilter === 'UNCLASSIFIED' ? !comp.performanceMode : comp.performanceMode === performanceFilter);
    return matchesSearch && matchesCat && matchesType && matchesPerformance;
  });

  const handleOpenAdd = () => {
    setEditingComp(null);
    setName('');
    setCode('CMP-' + (competitions.length + 1).toString().padStart(2, '0'));
    setCategoryId(categories[0]?.id || '');
    setType('SOLO');
    setPerformanceMode('STAGE');
    setGroupSize(2);
    setDurationMinutes(90);
    setMaxEntriesPerTeam(2);
    setStatus('SCHEDULED');
    setError('');
    setModalOpen(true);
  };

  const handleOpenEdit = (comp: Competition) => {
    setEditingComp(comp);
    setName(comp.name);
    setCode(comp.code);
    setCategoryId(comp.categoryId);
    setType(comp.type);
    setPerformanceMode(comp.performanceMode || '');
    setGroupSize(comp.groupSize || 2);
    setDurationMinutes(comp.durationMinutes);
    setMaxEntriesPerTeam(comp.maxEntriesPerTeam);
    setStatus(comp.status);
    setError('');
    setModalOpen(true);
  };

  const [saving, setSaving] = useState(false);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (!name || !code) {
      setError('Please provide competition name and code.');
      return;
    }

    const category = categories.find(c => c.id === categoryId);
    if (!category) {
      setError('Please select a valid category. You must create at least one category before adding competitions.');
      return;
    }
    if (editingComp && type !== editingComp.type && (
      registrations.some(r => r.competitionId === editingComp.id) || results.some(r => r.competitionId === editingComp.id)
    )) {
      setError('Competition format cannot be changed after registrations or results exist.');
      return;
    }
    if (!performanceMode) {
      setError('Select Stage or Off Stage before saving the competition.');
      return;
    }
    if (type === 'GROUP' && (!Number.isInteger(groupSize) || groupSize < 2)) {
      setError('Group members per entry must be at least 2.');
      return;
    }
    const compData = {
      name,
      code: code.toUpperCase(),
      categoryId: category.id,
      categoryName: category.name,
      type,
      performanceMode,
      groupSize: type === 'GROUP' ? groupSize : 1,
      durationMinutes: Number(durationMinutes),
      maxEntriesPerTeam: Number(maxEntriesPerTeam),
      assignedJudges: editingComp ? editingComp.assignedJudges : ['Prof. David Miller'],
      status,
      criteria: editingComp ? editingComp.criteria : [
        { id: 'cr-1', name: 'Subject Mastery & Accuracy', maxMarks: 35 },
        { id: 'cr-2', name: 'Artistic Delivery & Articulation', maxMarks: 35 },
        { id: 'cr-3', name: 'Overall Impression & Timing', maxMarks: 30 }
      ]
    };

    setSaving(true);
    try {
      if (editingComp) {
        await updateCompetition(editingComp.id, compData);
      } else {
        await addCompetition({ ...compData, stageId: '', stageName: '', date: '', timeSlot: '' });
      }
      setModalOpen(false);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to save competition.');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: string, name: string) => {
    if (confirm(`Are you sure you want to delete competition "${name}"?`)) {
      setActionError(null);
      setDeletingId(id);
      try {
        await deleteCompetition(id);
      } catch (err: unknown) {
        setActionError(err instanceof Error ? err.message : 'Failed to delete competition.');
      } finally {
        setDeletingId(null);
      }
    }
  };

  const getScheduleStatusBadge = (status: Competition['scheduleStatus']) => {
    switch (status || 'SCHEDULED') {
      case 'LIVE':
        return <Badge variant="error" size="sm" dot>LIVE</Badge>;
      case 'COMPLETED':
        return <Badge variant="success" size="sm" dot>COMPLETED</Badge>;
      case 'SCHEDULED':
      default:
        return <Badge variant="default" size="sm" dot>SCHEDULED</Badge>;
    }
  };

  return (
    <AdminLayout>
      <>
      <div className="w-full max-w-[1600px] space-y-6 lg:space-y-8">
        {/* Header */}
        <div className="flex flex-col gap-4 border-b border-slate-200 pb-5 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <h1 className="text-2xl font-bold tracking-tight text-slate-950 sm:text-3xl">
              Competition Directory
            </h1>
            <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-500">
              Configure festival artistic, literary, and stage events with judging criteria
            </p>
          </div>
          <Button
            variant="primary"
            size="md"
            leftIcon={<Plus className="w-4 h-4" />}
            onClick={handleOpenAdd}
          >
            Create Competition
          </Button>
        </div>

        {/* Action Error Banner */}
        {actionError && (
          <div className="flex items-start justify-between gap-3 rounded-xl border border-red-200 bg-red-50 px-4 py-3.5 text-sm text-red-700">
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
        <div className="flex flex-col gap-4 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:p-5 xl:flex-row xl:items-center xl:justify-between">
          <div className="relative w-full flex-1 xl:max-w-md">
            <Search className="w-4 h-4 text-[#526070] absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
            <input
              type="text"
              placeholder="Search competition code or title..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full rounded-xl border border-slate-200 bg-slate-50 py-2.5 pl-10 pr-4 text-sm text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-blue-500 focus:bg-white focus:ring-4 focus:ring-blue-500/10"
            />
          </div>

          <div className="grid w-full grid-cols-1 gap-2 sm:grid-cols-2 xl:flex xl:w-auto xl:flex-wrap">
            <select
              aria-label="Filter by Category"
              value={categoryFilter}
              onChange={(e) => setCategoryFilter(e.target.value)}
              className="min-w-0 w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm font-medium text-slate-700 outline-none transition focus:border-blue-500 focus:bg-white focus:ring-4 focus:ring-blue-500/10 xl:min-w-[150px]"
            >
              <option value="ALL">All Categories</option>
              {categories.map(c => (
                <option key={c.id} value={c.id}>{c.name}</option>
              ))}
            </select>

            <select
              aria-label="Filter by Competition Type"
              value={typeFilter}
              onChange={(e) => setTypeFilter(e.target.value)}
              className="min-w-0 w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm font-medium text-slate-700 outline-none transition focus:border-blue-500 focus:bg-white focus:ring-4 focus:ring-blue-500/10 xl:min-w-[150px]"
            >
              <option value="ALL">All Types</option>
              <option value="SOLO">Individual Contests</option>
              <option value="GROUP">Group Contests</option>
            </select>
            <select
              aria-label="Filter by Performance Mode"
              value={performanceFilter}
              onChange={(e) => setPerformanceFilter(e.target.value)}
              className="min-w-0 w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm font-medium text-slate-700 outline-none transition focus:border-blue-500 focus:bg-white focus:ring-4 focus:ring-blue-500/10 xl:min-w-[150px]"
            >
              <option value="ALL">All Performance Modes</option>
              <option value="STAGE">Stage</option>
              <option value="OFF_STAGE">Off Stage</option>
              <option value="UNCLASSIFIED">Unclassified</option>
            </select>
          </div>
        </div>

        {/* Competitions Table */}
        <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
          <div className="flex flex-col gap-1 border-b border-slate-200 px-4 py-4 sm:flex-row sm:items-center sm:justify-between sm:px-5">
            <h3 className="text-base font-semibold text-slate-900">Competitions</h3>
            <span className="text-sm text-slate-500">Showing <span className="font-semibold tabular-nums text-slate-700">{filteredCompetitions.length}</span> of {competitions.length} events</span>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full min-w-[1180px] text-left text-sm">
              <thead>
                <tr className="border-b border-slate-200 bg-slate-50 text-[11px] font-semibold uppercase tracking-wider text-slate-500">
                  <th className="px-4 py-3.5">Code &amp; Title</th>
                  <th className="px-4 py-3.5">Category</th>
                  <th className="px-4 py-3.5 text-center">Type</th>
                  <th className="px-4 py-3.5 text-center">Performance</th>
                  <th className="px-4 py-3.5 text-center">Group Size</th>
                  <th className="px-4 py-3.5 text-center">Entries</th>
                  <th className="px-4 py-3.5">Stage Assignment</th>
                  <th className="px-4 py-3.5">Assigned Judges</th>
                  <th className="px-4 py-3.5 text-center">Status</th>
                  <th className="py-3 px-6 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#E1E7EF]">
                {filteredCompetitions.length === 0 ? (
                  <tr>
                    <td colSpan={10} className="px-6 py-16 text-center text-sm text-slate-500">
                      <div className="flex flex-col items-center justify-center gap-3">
                        <Trophy className="w-8 h-8 text-[#94A3B8]" />
                        <p className="font-semibold text-sm text-[#111111]">
                          {competitions.length === 0 ? 'No competitions configured' : 'No competitions found'}
                        </p>
                        <p className="text-xs text-[#526070]">
                          {competitions.length === 0
                            ? "Use 'Create Competition' to configure competitions."
                            : 'No competitions match your filter criteria.'}
                        </p>
                      </div>
                    </td>
                  </tr>
                ) : (
                  filteredCompetitions.map((comp) => (
                    <tr key={comp.id} className="transition-colors hover:bg-slate-50/80">
                      <td className="px-4 py-4">
                        <div className="flex items-center gap-2.5">
                          <span className="font-mono text-xs font-bold text-[#2563EB] bg-blue-50 px-2 py-0.5 rounded border border-blue-100">
                            {comp.code}
                          </span>
                          <span className="font-bold text-[#111111] text-sm">{comp.name}</span>
                        </div>
                      </td>
                      <td className="px-4 py-4 font-medium text-slate-700">
                        {comp.categoryName}
                      </td>
                      <td className="px-4 py-4 text-center">
                        <span className={`text-[11px] font-bold px-2 py-0.5 rounded ${comp.type === 'SOLO' ? 'bg-slate-100 text-slate-800' : 'bg-purple-100 text-purple-800'}`}>
                          {comp.type === 'SOLO' ? 'Individual' : 'Group'}
                        </span>
                      </td>
                      <td className="px-4 py-4 text-center font-medium text-slate-600">{comp.performanceMode === 'STAGE' ? 'Stage' : comp.performanceMode === 'OFF_STAGE' ? 'Off Stage' : 'Unclassified'}</td>
                      <td className="px-4 py-4 text-center font-medium text-slate-700">{comp.type === 'GROUP' ? (comp.groupSize || 'Not set') : '—'}</td>
                      <td className="px-4 py-4 text-center font-semibold tabular-nums text-slate-900">
                        {comp.entriesCount}
                      </td>
                      <td className="px-4 py-4 text-slate-600">
                        <div className="flex items-center gap-1.5">
                          <MapPin className="w-3.5 h-3.5 text-[#526070] shrink-0" />
                          <span className="truncate max-w-[150px]">
                            {[...new Set(schedules.filter(slot => slot.competitionId === comp.id).map(slot => slot.stageName).filter(Boolean))].join(', ') || 'Not scheduled'}
                          </span>
                        </div>
                      </td>
                      <td className="px-4 py-4 text-slate-600">
                        {getAssignedJudgeNames(comp.id).length > 0 ? getAssignedJudgeNames(comp.id).join(', ') : 'Pending Assignment'}
                      </td>
                      <td className="px-4 py-4 text-center">
                        {getScheduleStatusBadge(comp.scheduleStatus)}
                      </td>
                      <td className="px-4 py-4 text-right">
                        <div className="flex items-center justify-end gap-1.5">
                          <button
                            type="button"
                            onClick={() => handleDownloadParticipants(comp)}
                            className="rounded-lg p-2 text-slate-500 transition-colors hover:bg-emerald-50 hover:text-emerald-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500"
                            title="Download Participants List (A4)"
                            aria-label={`Download participant list for ${comp.name}`}
                          >
                            <FileDown className="w-4 h-4" />
                          </button>
                          <button
                            type="button"
                            onClick={() => handleOpenEdit(comp)}
                            className="rounded-lg p-2 text-slate-500 transition-colors hover:bg-blue-50 hover:text-blue-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
                            title="Edit Competition"
                          >
                            <Edit2 className="w-4 h-4" />
                          </button>
                          <button
                            type="button"
                            onClick={() => handleDelete(comp.id, comp.name)}
                            disabled={deletingId === comp.id}
                            className="rounded-lg p-2 text-slate-500 transition-colors hover:bg-red-50 hover:text-red-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-500 disabled:opacity-50"
                            title="Delete Competition"
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
          title={editingComp ? `Edit Competition (${editingComp.name})` : 'Create New Competition'}
          description="Define event rules, stage location, duration, and maximum registration quotas"
          maxWidth="xl"
          footer={
            <div className="flex w-full flex-col-reverse gap-2 sm:flex-row sm:justify-end">
              <Button variant="outline" size="md" onClick={() => setModalOpen(false)}>
                Cancel
              </Button>
              <Button variant="primary" size="md" onClick={handleSave} isLoading={saving} disabled={saving}>
                {editingComp ? 'Update Competition' : 'Save Competition'}
              </Button>
            </div>
          }
        >
          <form onSubmit={handleSave} className="space-y-6">
            {error && (
              <div role="alert" className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-medium leading-5 text-red-700">{error}</div>
            )}

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-3 sm:gap-5">
              <div className="sm:col-span-2">
                <Input
                  label="Competition Name"
                  placeholder="e.g. Extempore Speech (English)"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  required
                />
              </div>
              <Input
                label="Event Code"
                placeholder="e.g. CMP-01"
                value={code}
                onChange={(e) => setCode(e.target.value)}
                required
              />
            </div>

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 sm:gap-5">
              <Select
                label="Category Division"
                value={categoryId}
                onChange={(e) => setCategoryId(e.target.value)}
                options={categories.map(c => ({ value: c.id, label: c.name }))}
              />
              <Select
                label="Competition Format"
                value={type}
                onChange={(e) => setType(e.target.value as CompetitionType)}
                options={[
                  { value: 'SOLO', label: 'Individual Contest' },
                  { value: 'GROUP', label: 'Group Ensemble (Team Item)' }
                ]}
              />
            </div>

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 sm:gap-5">
              <Select
                label="Performance Mode"
                value={performanceMode}
                onChange={(e) => setPerformanceMode(e.target.value as CompetitionPerformanceMode)}
                options={[{ value: '', label: 'Select classification' }, { value: 'STAGE', label: 'Stage' }, { value: 'OFF_STAGE', label: 'Off Stage' }]}
              />
              {type === 'GROUP' && (
                <Input label="Members Per Group" type="number" min={2} value={groupSize} onChange={(e) => setGroupSize(Number(e.target.value))} />
              )}
            </div>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 sm:gap-5">
              {type === 'SOLO' ? <Input
                label="Max Registrations / Team"
                type="number"
                min={1}
                max={5}
                value={maxEntriesPerTeam}
                onChange={(e) => setMaxEntriesPerTeam(Number(e.target.value))}
              /> : <p className="self-center rounded-xl bg-slate-50 px-3 py-3 text-sm leading-5 text-slate-600 sm:col-span-2">Unlimited groups per team. Register each group using its leader.</p>}
            </div>

            <p className="rounded-xl border border-blue-100 bg-blue-50 px-3.5 py-3 text-xs leading-5 text-blue-800">
              Stage venue, competition date and time slot are managed centrally from the Schedule page after the competition is created.
            </p>

            <Select
              label="Evaluation State"
              value={status}
              onChange={(e) => setStatus(e.target.value as CompetitionStatus)}
              options={[
                { value: 'SCHEDULED', label: 'Scheduled (Awaiting start)' },
                { value: 'IN_PROGRESS', label: 'In Progress (Active on Stage)' },
                { value: 'MARKS_ENTERED', label: 'Marks Entered (Ready for Review)' },
                { value: 'PUBLISHED', label: 'Published (Officially Approved)' }
              ]}
            />
          </form>
        </Modal>
      </div>
      </>
    </AdminLayout>
  );
}