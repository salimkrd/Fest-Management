'use client';

import React, { useState } from 'react';
import { jsPDF } from 'jspdf';
import { AdminLayout } from '@/components/layout/AdminLayout';
import { useFest } from '@/context/FestContext';
import { ScheduleSlot } from '@/types/fest';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Select } from '@/components/ui/Select';
import { Badge } from '@/components/ui/Badge';
import { Modal } from '@/components/ui/Modal';
import { Plus, Search, Edit2, Trash2, CalendarDays, Clock, MapPin, CheckCircle2, FileDown, AlertCircle, RefreshCw, X, CalendarClock, Timer, ListFilter } from 'lucide-react';

const getTimeMinutes = (value: string): number => {
  const match = value.trim().match(/^(\d{1,2}):(\d{2})\s*(AM|PM)?$/i);
  if (!match) return Number.NaN;
  const rawHours = Number(match[1]);
  const minutes = Number(match[2]);
  if (minutes > 59) return Number.NaN;
  if (match[3]) {
    if (rawHours < 1 || rawHours > 12) return Number.NaN;
    let hours = rawHours % 12;
    if (match[3].toUpperCase() === 'PM') hours += 12;
    return hours * 60 + minutes;
  }
  if (rawHours > 23) return Number.NaN;
  return rawHours * 60 + minutes;
};

const toTimeInputValue = (value: string): string => {
  const total = getTimeMinutes(value);
  if (!Number.isFinite(total)) return '';
  return `${String(Math.floor(total / 60)).padStart(2, '0')}:${String(total % 60).padStart(2, '0')}`;
};

const toStoredTime = (value: string): string => {
  const total = getTimeMinutes(value);
  if (!Number.isFinite(total)) return value;
  const hours = Math.floor(total / 60);
  const minutes = total % 60;
  const displayHours = hours % 12 || 12;
  return `${String(displayHours).padStart(2, '0')}:${String(minutes).padStart(2, '0')} ${hours >= 12 ? 'PM' : 'AM'}`;
};

const getTodayDateInput = (): string => {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
};

const formatScheduleDate = (value: string): string => {
  const parts = value.split('-').map(Number);
  if (parts.length !== 3 || parts.some(part => !Number.isFinite(part))) return value;
  return new Intl.DateTimeFormat('en-GB', {
    day: '2-digit',
    month: 'short',
    year: 'numeric'
  }).format(new Date(parts[0], parts[1] - 1, parts[2]));
};

export default function SchedulePage() {
  const {
    schedules,
    schedulesSyncState,
    competitions,
    stages,
    theme,
    addSchedule,
    updateSchedule,
    deleteSchedule
  } = useFest();

  const [search, setSearch] = useState('');
  const [stageFilter, setStageFilter] = useState('ALL');
  const [statusFilter, setStatusFilter] = useState('ALL');
  const [modalOpen, setModalOpen] = useState(false);
  const [editingSlot, setEditingSlot] = useState<ScheduleSlot | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<ScheduleSlot | null>(null);
  const [competitionId, setCompetitionId] = useState('');
  const [stageId, setStageId] = useState('');
  const [date, setDate] = useState(getTodayDateInput);
  const [startTime, setStartTime] = useState('09:00');
  const [endTime, setEndTime] = useState('10:00');
  const [status, setStatus] = useState<ScheduleSlot['status']>('SCHEDULED');
  const [error, setError] = useState('');
  const [notice, setNotice] = useState<{ type: 'success' | 'error'; message: string } | null>(null);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const canManageSchedules = schedulesSyncState === 'ready';

  const filteredSchedules = schedules.filter(slot => {
    const query = search.trim().toLowerCase();
    const matchesSearch = !query || [
      slot.competitionName,
      slot.categoryName,
      slot.stageName
    ].some(value => (value || '').toLowerCase().includes(query));
    const matchesStage = stageFilter === 'ALL' || slot.stageId === stageFilter;
    const matchesStatus = statusFilter === 'ALL' || slot.status === statusFilter;
    return matchesSearch && matchesStage && matchesStatus;
  });

  const sortedSchedules = [...filteredSchedules].sort((a, b) =>
    a.date.localeCompare(b.date) || getTimeMinutes(a.startTime) - getTimeMinutes(b.startTime)
  );

  const liveCount = schedules.filter(slot => slot.status === 'LIVE').length;
  const scheduledCount = schedules.filter(slot => slot.status === 'SCHEDULED').length;
  const completedCount = schedules.filter(slot => slot.status === 'COMPLETED').length;
  const delayedCount = schedules.filter(slot => slot.status === 'DELAYED').length;

  const handleOpenAdd = () => {
    if (!canManageSchedules) return;
    setEditingSlot(null);
    setCompetitionId(competitions[0]?.id || '');
    setStageId(stages[0]?.id || '');
    setDate(getTodayDateInput());
    setStartTime('09:00');
    setEndTime('10:00');
    setStatus('SCHEDULED');
    setError('');
    setModalOpen(true);
  };

  const handleOpenEdit = (slot: ScheduleSlot) => {
    if (!canManageSchedules) return;
    setEditingSlot(slot);
    setCompetitionId(slot.competitionId);
    setStageId(slot.stageId);
    setDate(slot.date);
    setStartTime(toTimeInputValue(slot.startTime));
    setEndTime(toTimeInputValue(slot.endTime));
    setStatus(slot.status);
    setError('');
    setModalOpen(true);
  };

  const handleSave = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError('');
    if (!canManageSchedules) {
      setError('Live schedule sync is unavailable. Reconnect before saving changes.');
      return;
    }

    const competition = competitions.find(item => item.id === competitionId);
    const stage = stages.find(item => item.id === stageId);
    if (!competition || !stage) {
      setError('Select a valid competition and stage before saving.');
      return;
    }
    if (!date) {
      setError('Select a schedule date.');
      return;
    }

    const startMinutes = getTimeMinutes(startTime);
    const endMinutes = getTimeMinutes(endTime);
    if (!Number.isFinite(startMinutes) || !Number.isFinite(endMinutes)) {
      setError('Enter valid start and end times.');
      return;
    }
    if (endMinutes <= startMinutes) {
      setError('End time must be later than the start time.');
      return;
    }

    const conflictingSlot = schedules.find(existing => {
      if (existing.id === editingSlot?.id || existing.stageId !== stageId || existing.date !== date) return false;
      const existingStart = getTimeMinutes(existing.startTime);
      const existingEnd = getTimeMinutes(existing.endTime);
      if (!Number.isFinite(existingStart) || !Number.isFinite(existingEnd)) return false;
      return startMinutes < existingEnd && endMinutes > existingStart;
    });
    if (conflictingSlot) {
      setError(`This stage already has “${conflictingSlot.competitionName}” scheduled from ${conflictingSlot.startTime} to ${conflictingSlot.endTime} on this date.`);
      return;
    }

    const slotData = {
      competitionId,
      competitionName: competition.name,
      categoryName: competition.categoryName,
      type: competition.type,
      stageId,
      stageName: stage.name,
      date,
      startTime: toStoredTime(startTime),
      endTime: toStoredTime(endTime),
      status
    };

    setSaving(true);
    try {
      if (editingSlot) {
        await updateSchedule(editingSlot.id, slotData);
        setNotice({ type: 'success', message: 'Schedule slot updated successfully.' });
      } else {
        await addSchedule(slotData);
        setNotice({ type: 'success', message: 'Schedule slot created successfully.' });
      }
      setModalOpen(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save schedule slot.');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!deleteTarget || !canManageSchedules) return;
    setDeleting(true);
    try {
      await deleteSchedule(deleteTarget.id);
      setDeleteTarget(null);
      setNotice({ type: 'success', message: 'Schedule slot deleted successfully.' });
    } catch (err) {
      setNotice({
        type: 'error',
        message: err instanceof Error ? err.message : 'Failed to delete schedule slot.'
      });
    } finally {
      setDeleting(false);
    }
  };

  const clearFilters = () => {
    setSearch('');
    setStageFilter('ALL');
    setStatusFilter('ALL');
  };

  const handleExportSchedulePDF = () => {
    if (sortedSchedules.length === 0) {
      alert('There are no schedule entries to export with the current filters.');
      return;
    }

    const doc = new jsPDF({ orientation: 'landscape', unit: 'pt', format: 'a4' });
    const pageWidth = doc.internal.pageSize.getWidth();
    const pageHeight = doc.internal.pageSize.getHeight();
    const margin = 26;
    const tableWidth = pageWidth - margin * 2;
    const generatedDate = new Date().toLocaleDateString('en-GB');
    const columns: {
      label: string;
      width: number;
      align?: 'left' | 'center' | 'right';
      value: (slot: ScheduleSlot, index: number) => string;
    }[] = [
      { label: '#', width: 30, align: 'center', value: (_slot, index) => String(index + 1) },
      { label: 'COMPETITION', width: 184, value: slot => slot.competitionName || '-' },
      { label: 'CATEGORY', width: 104, value: slot => slot.categoryName || '-' },
      { label: 'TYPE', width: 48, align: 'center', value: slot => slot.type || '-' },
      { label: 'STAGE / VENUE', width: 112, value: slot => slot.stageName || '-' },
      { label: 'DATE', width: 80, value: slot => formatScheduleDate(slot.date) },
      { label: 'TIME', width: 140, align: 'center', value: slot => `${toStoredTime(slot.startTime || '-') || '-'} - ${toStoredTime(slot.endTime || '-') || '-'}` },
      { label: 'STATUS', width: 91, align: 'center', value: slot => slot.status.replace('_', ' ') }
    ];

    const drawPageHeader = (): number => {
      doc.setFillColor(37, 99, 235);
      doc.rect(0, 0, pageWidth, 64, 'F');

      const festivalName = (theme.festivalName || 'Festival').toUpperCase();
      doc.setFont('helvetica', 'bold');
      let titleSize = 15;
      doc.setFontSize(titleSize);
      while (doc.getTextWidth(festivalName) > tableWidth - 175 && titleSize > 9) {
        titleSize -= 0.5;
        doc.setFontSize(titleSize);
      }
      doc.setTextColor(255, 255, 255);
      doc.text(festivalName, margin, 27);

      doc.setFont('helvetica', 'normal');
      doc.setFontSize(8.5);
      doc.text(theme.institutionName || 'Official Competition Timetable', margin, 45);
      doc.text('Generated: ' + generatedDate, pageWidth - margin, 45, { align: 'right' });

      doc.setTextColor(17, 24, 39);
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(11);
      doc.text('COMPETITION SCHEDULE', margin, 86);
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(8);
      doc.setTextColor(82, 96, 112);
      doc.text(String(sortedSchedules.length) + ' schedule entries | Chronological order | Current filters applied', margin, 101);

      let x = margin;
      const tableTop = 115;
      const headerHeight = 23;
      columns.forEach(column => {
        doc.setFillColor(241, 245, 249);
        doc.setDrawColor(203, 213, 225);
        doc.rect(x, tableTop, column.width, headerHeight, 'FD');
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(7.4);
        doc.setTextColor(51, 65, 85);
        const textX = column.align === 'center' ? x + column.width / 2 :
          column.align === 'right' ? x + column.width - 5 : x + 5;
        doc.text(column.label, textX, tableTop + 14, {
          align: column.align || 'left'
        });
        x += column.width;
      });
      return tableTop + headerHeight;
    };

    let y = drawPageHeader();
    sortedSchedules.forEach((slot, index) => {
      doc.setFont('helvetica', index % 8 === 0 ? 'bold' : 'normal');
      doc.setFontSize(8);
      const cellLines = columns.map(column =>
        doc.splitTextToSize(column.value(slot, index), column.width - 10) as string[]
      );
      const maxLines = Math.max(1, ...cellLines.map(lines => lines.length));
      const rowHeight = Math.max(25, maxLines * 10 + 8);

      if (y + rowHeight > pageHeight - 38) {
        doc.addPage();
        y = drawPageHeader();
      }

      let x = margin;
      columns.forEach((column, columnIndex) => {
        doc.setFillColor(index % 2 === 0 ? 255 : 248, index % 2 === 0 ? 255 : 250, index % 2 === 0 ? 255 : 252);
        doc.setDrawColor(226, 232, 240);
        doc.rect(x, y, column.width, rowHeight, 'FD');
        doc.setFont('helvetica', columnIndex === 1 ? 'bold' : 'normal');
        doc.setFontSize(8);
        doc.setTextColor(columnIndex === 1 ? 17 : 51, columnIndex === 1 ? 24 : 65, columnIndex === 1 ? 39 : 85);
        const lines = cellLines[columnIndex];
        const textY = y + Math.max(8, (rowHeight - lines.length * 9) / 2 + 7);
        const textX = column.align === 'center' ? x + column.width / 2 :
          column.align === 'right' ? x + column.width - 5 : x + 5;
        doc.text(lines, textX, textY, { align: column.align || 'left', lineHeightFactor: 1.1 });
        x += column.width;
      });
      y += rowHeight;
    });

    const totalPages = doc.getNumberOfPages();
    for (let page = 1; page <= totalPages; page += 1) {
      doc.setPage(page);
      doc.setDrawColor(203, 213, 225);
      doc.line(margin, pageHeight - 27, pageWidth - margin, pageHeight - 27);
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(7);
      doc.setTextColor(100, 116, 139);
      doc.text('Festival Schedule | A4 Landscape', margin, pageHeight - 13);
      doc.text('Page ' + page + ' of ' + totalPages, pageWidth - margin, pageHeight - 13, { align: 'right' });
    }

    const safeName = (theme.festivalName || 'Festival').trim().replace(/[^\w-]+/g, '_').replace(/^_+|_+$/g, '') || 'Festival';
    doc.save(safeName + '_Competition_Schedule_A4.pdf');
  };

  const getStatusBadge = (st: ScheduleSlot['status']) => {
    switch (st) {
      case 'LIVE':
        return <Badge variant="error" size="sm" dot>LIVE ON STAGE</Badge>;
      case 'COMPLETED':
        return <Badge variant="success" size="sm" dot>COMPLETED</Badge>;
      case 'DELAYED':
        return <Badge variant="warning" size="sm" dot>DELAYED</Badge>;
      case 'SCHEDULED':
      default:
        return <Badge variant="default" size="sm" dot>SCHEDULED</Badge>;
    }
  };

  const getStatusBadge = (slotStatus: ScheduleSlot['status']) => {
    switch (slotStatus) {
      case 'LIVE':
        return <Badge variant="error" size="sm" dot>LIVE ON STAGE</Badge>;
      case 'COMPLETED':
        return <Badge variant="success" size="sm" dot>COMPLETED</Badge>;
      case 'DELAYED':
        return <Badge variant="warning" size="sm" dot>DELAYED</Badge>;
      case 'SCHEDULED':
      default:
        return <Badge variant="default" size="sm" dot>SCHEDULED</Badge>;
    }
  };

  const statusPillClass = (slotStatus: ScheduleSlot['status']) => {
    if (slotStatus === 'LIVE') return 'border-red-200 bg-red-50 text-red-700';
    if (slotStatus === 'COMPLETED') return 'border-emerald-200 bg-emerald-50 text-emerald-700';
    if (slotStatus === 'DELAYED') return 'border-amber-200 bg-amber-50 text-amber-700';
    return 'border-slate-200 bg-slate-50 text-slate-700';
  };

  return (
    <AdminLayout>
      <div className="mx-auto w-full max-w-[1440px] space-y-5 pb-8 sm:space-y-6">
        <div className="flex flex-col gap-4 border-b border-slate-200 pb-5 sm:flex-row sm:items-end sm:justify-between">
          <div className="min-w-0">
            <div className="mb-2 flex items-center gap-2">
              <span className="rounded-lg bg-blue-50 p-2 text-blue-700">
                <CalendarDays className="h-5 w-5" />
              </span>
              <span className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">Event operations</span>
            </div>
            <h1 className="text-2xl font-bold tracking-tight text-slate-950 sm:text-3xl">Competition Schedule</h1>
            <p className="mt-1.5 max-w-2xl text-sm leading-6 text-slate-500">
              Manage stage allocations, performance timings and the official festival timetable.
            </p>
          </div>
          <div className="flex w-full flex-col gap-2 sm:w-auto sm:flex-row">
            <Button
              variant="outline"
              size="md"
              leftIcon={<FileDown className="h-4 w-4" />}
              onClick={handleExportSchedulePDF}
              disabled={sortedSchedules.length === 0 || schedulesSyncState !== 'ready'}
              className="w-full sm:w-auto"
            >
              Export A4 PDF
            </Button>
            <Button
              variant="primary"
              size="md"
              leftIcon={<Plus className="h-4 w-4" />}
              onClick={handleOpenAdd}
              disabled={!canManageSchedules || competitions.length === 0 || stages.length === 0}
              className="w-full sm:w-auto"
            >
              Create Schedule Slot
            </Button>
          </div>
        </div>

        <div className={`flex flex-col gap-2 rounded-xl border px-4 py-3 sm:flex-row sm:items-center sm:justify-between ${schedulesSyncState === 'error' ? 'border-red-200 bg-red-50' : schedulesSyncState === 'loading' ? 'border-blue-200 bg-blue-50' : 'border-emerald-200 bg-emerald-50'}`}>
          <div className="flex min-w-0 items-start gap-2.5">
            {schedulesSyncState === 'error' ? (
              <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-red-600" />
            ) : schedulesSyncState === 'loading' ? (
              <RefreshCw className="mt-0.5 h-4 w-4 shrink-0 animate-spin text-blue-600" />
            ) : (
              <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-emerald-700" />
            )}
            <div className="min-w-0">
              <p className={`text-sm font-semibold ${schedulesSyncState === 'error' ? 'text-red-800' : schedulesSyncState === 'loading' ? 'text-blue-800' : 'text-emerald-800'}`}>
                {schedulesSyncState === 'error' ? 'Schedule sync unavailable' : schedulesSyncState === 'loading' ? 'Connecting to live schedule' : 'Live schedule sync connected'}
              </p>
              <p className={`mt-0.5 text-xs leading-5 ${schedulesSyncState === 'error' ? 'text-red-700' : schedulesSyncState === 'loading' ? 'text-blue-700' : 'text-emerald-700'}`}>
                {schedulesSyncState === 'error'
                  ? 'Schedule data may be out of date. Editing is disabled until the Firestore connection is restored.'
                  : schedulesSyncState === 'loading'
                    ? 'Retrieving the latest schedule entries from the shared database.'
                    : 'Changes are saved to Firestore and appear across connected admin devices.'}
              </p>
            </div>
          </div>
          <span className={`whitespace-nowrap text-xs font-semibold ${schedulesSyncState === 'error' ? 'text-red-700' : schedulesSyncState === 'loading' ? 'text-blue-700' : 'text-emerald-700'}`}>
            {schedulesSyncState === 'ready' ? 'SYNCED' : schedulesSyncState.toUpperCase()}
          </span>
        </div>

        {notice && (
          <div className={`flex items-start justify-between gap-3 rounded-xl border px-4 py-3 ${notice.type === 'success' ? 'border-emerald-200 bg-emerald-50 text-emerald-800' : 'border-red-200 bg-red-50 text-red-800'}`}>
            <div className="flex items-start gap-2.5">
              {notice.type === 'success' ? <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0" /> : <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />}
              <p className="text-sm font-medium leading-5">{notice.message}</p>
            </div>
            <button type="button" onClick={() => setNotice(null)} className="rounded-md p-1 opacity-70 transition hover:bg-black/5 hover:opacity-100" aria-label="Dismiss message">
              <X className="h-4 w-4" />
            </button>
          </div>
        )}

        <div className="grid grid-cols-2 gap-3 xl:grid-cols-4">
          {[
            { label: 'Total slots', value: schedules.length, icon: CalendarClock, tone: 'bg-blue-50 text-blue-700' },
            { label: 'Live now', value: liveCount, icon: Timer, tone: 'bg-red-50 text-red-700' },
            { label: 'Scheduled', value: scheduledCount, icon: CalendarDays, tone: 'bg-indigo-50 text-indigo-700' },
            { label: 'Completed', value: completedCount, icon: CheckCircle2, tone: 'bg-emerald-50 text-emerald-700' }
          ].map(metric => {
            const Icon = metric.icon;
            return (
              <div key={metric.label} className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm sm:p-5">
                <div className="flex items-center justify-between gap-3">
                  <div className="min-w-0">
                    <p className="text-xs font-medium text-slate-500">{metric.label}</p>
                    <p className="mt-1 text-2xl font-bold tabular-nums text-slate-950">{metric.value}</p>
                  </div>
                  <span className={`rounded-xl p-2.5 ${metric.tone}`}>
                    <Icon className="h-5 w-5" />
                  </span>
                </div>
              </div>
            );
          })}
        </div>

        <section className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
          <div className="border-b border-slate-200 p-4 sm:p-5">
            <div className="mb-4 flex items-center justify-between gap-3">
              <div>
                <h2 className="text-base font-bold text-slate-950">Master timetable</h2>
                <p className="mt-0.5 text-xs text-slate-500">Search and filter by stage or performance status.</p>
              </div>
              <span className="rounded-full bg-slate-100 px-2.5 py-1 text-xs font-semibold tabular-nums text-slate-600">
                {filteredSchedules.length} of {schedules.length}
              </span>
            </div>
            <div className="grid grid-cols-1 gap-3 md:grid-cols-[minmax(220px,1fr)_200px_190px_auto]">
              <div className="relative min-w-0">
                <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                <input
                  type="search"
                  placeholder="Search competition, category or stage..."
                  value={search}
                  onChange={event => setSearch(event.target.value)}
                  className="h-11 w-full rounded-lg border border-slate-200 bg-slate-50 pl-9 pr-3 text-sm text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-blue-500 focus:bg-white focus:ring-2 focus:ring-blue-100"
                />
              </div>
              <select
                aria-label="Filter by stage"
                value={stageFilter}
                onChange={event => setStageFilter(event.target.value)}
                className="h-11 w-full rounded-lg border border-slate-200 bg-slate-50 px-3 text-sm font-medium text-slate-700 outline-none transition focus:border-blue-500 focus:bg-white focus:ring-2 focus:ring-blue-100"
              >
                <option value="ALL">All stages</option>
                {stages.map(stage => <option key={stage.id} value={stage.id}>{stage.name}</option>)}
              </select>
              <select
                aria-label="Filter by status"
                value={statusFilter}
                onChange={event => setStatusFilter(event.target.value)}
                className="h-11 w-full rounded-lg border border-slate-200 bg-slate-50 px-3 text-sm font-medium text-slate-700 outline-none transition focus:border-blue-500 focus:bg-white focus:ring-2 focus:ring-blue-100"
              >
                <option value="ALL">All statuses</option>
                <option value="LIVE">Live</option>
                <option value="SCHEDULED">Scheduled</option>
                <option value="COMPLETED">Completed</option>
                <option value="DELAYED">Delayed</option>
              </select>
              {(search || stageFilter !== 'ALL' || statusFilter !== 'ALL') && (
                <Button variant="ghost" size="md" onClick={clearFilters} className="w-full md:w-auto">
                  <ListFilter className="mr-1 h-4 w-4" /> Reset
                </Button>
              )}
            </div>
          </div>

          {schedulesSyncState === 'loading' && schedules.length === 0 ? (
            <div className="flex min-h-48 flex-col items-center justify-center px-5 py-10 text-center">
              <RefreshCw className="mb-3 h-6 w-6 animate-spin text-blue-600" />
              <p className="text-sm font-semibold text-slate-800">Loading schedule entries</p>
              <p className="mt-1 text-xs text-slate-500">The latest timetable is being retrieved.</p>
            </div>
          ) : sortedSchedules.length === 0 ? (
            <div className="flex min-h-48 flex-col items-center justify-center px-5 py-10 text-center">
              <span className="mb-3 rounded-xl bg-slate-100 p-3 text-slate-500"><CalendarDays className="h-6 w-6" /></span>
              <p className="text-sm font-semibold text-slate-800">{schedules.length === 0 ? 'No schedule slots yet' : 'No matching schedule slots'}</p>
              <p className="mt-1 max-w-sm text-xs leading-5 text-slate-500">
                {schedules.length === 0 ? 'Create a schedule slot to add the first competition to the timetable.' : 'Try changing the search term or filters to see more entries.'}
              </p>
              {schedules.length > 0 && (
                <button type="button" onClick={clearFilters} className="mt-3 text-xs font-semibold text-blue-700 hover:text-blue-800">Clear filters</button>
              )}
            </div>
          ) : (
            <>
              <div className="space-y-3 p-3 sm:p-4 lg:hidden">
                {sortedSchedules.map(slot => (
                  <article key={slot.id} className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <p className="break-words text-sm font-bold leading-5 text-slate-950">{slot.competitionName}</p>
                        <p className="mt-1 text-xs text-slate-500">{slot.categoryName} <span className="mx-1 text-slate-300">•</span> {slot.type === 'SOLO' ? 'Individual' : 'Group'}</p>
                      </div>
                      {getStatusBadge(slot.status)}
                    </div>
                    <div className="mt-4 grid grid-cols-1 gap-3 rounded-lg bg-slate-50 p-3 sm:grid-cols-2">
                      <div className="flex items-start gap-2 text-xs text-slate-600">
                        <MapPin className="mt-0.5 h-4 w-4 shrink-0 text-slate-400" />
                        <div><p className="font-semibold text-slate-800">{slot.stageName}</p><p className="mt-0.5 text-slate-500">Stage / venue</p></div>
                      </div>
                      <div className="flex items-start gap-2 text-xs text-slate-600">
                        <Clock className="mt-0.5 h-4 w-4 shrink-0 text-slate-400" />
                        <div><p className="font-semibold text-slate-800">{toStoredTime(slot.startTime)} – {toStoredTime(slot.endTime)}</p><p className="mt-0.5 text-slate-500">{formatScheduleDate(slot.date)}</p></div>
                      </div>
                    </div>
                    <div className="mt-3 flex items-center justify-end gap-2">
                      <Button type="button" variant="outline" size="sm" onClick={() => handleOpenEdit(slot)} disabled={!canManageSchedules}>
                        <Edit2 className="mr-1 h-3.5 w-3.5" /> Edit
                      </Button>
                      <Button type="button" variant="ghost" size="sm" onClick={() => setDeleteTarget(slot)} disabled={!canManageSchedules} className="text-red-600 hover:bg-red-50 hover:text-red-700">
                        <Trash2 className="mr-1 h-3.5 w-3.5" /> Delete
                      </Button>
                    </div>
                  </article>
                ))}
              </div>

              <div className="hidden overflow-x-auto lg:block">
                <table className="w-full min-w-[980px] text-left text-sm">
                  <thead className="bg-slate-50 text-[11px] font-bold uppercase tracking-wide text-slate-500">
                    <tr>
                      <th className="px-5 py-3.5">Competition</th>
                      <th className="px-4 py-3.5">Category</th>
                      <th className="px-4 py-3.5 text-center">Type</th>
                      <th className="px-4 py-3.5">Stage / venue</th>
                      <th className="px-4 py-3.5">Date &amp; time</th>
                      <th className="px-4 py-3.5 text-center">Status</th>
                      <th className="px-5 py-3.5 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {sortedSchedules.map(slot => (
                      <tr key={slot.id} className="transition-colors hover:bg-slate-50/80">
                        <td className="max-w-[260px] px-5 py-4">
                          <p className="font-semibold text-slate-900">{slot.competitionName}</p>
                          <p className="mt-0.5 text-xs text-slate-500">{slot.competitionId}</p>
                        </td>
                        <td className="px-4 py-4 font-medium text-slate-700">{slot.categoryName}</td>
                        <td className="px-4 py-4 text-center">
                          <span className={`inline-flex rounded-full border px-2.5 py-1 text-[11px] font-semibold ${slot.type === 'SOLO' ? 'border-slate-200 bg-slate-50 text-slate-700' : 'border-violet-200 bg-violet-50 text-violet-700'}`}>
                            {slot.type === 'SOLO' ? 'Individual' : 'Group'}
                          </span>
                        </td>
                        <td className="px-4 py-4">
                          <div className="flex items-center gap-2 text-slate-700"><MapPin className="h-4 w-4 shrink-0 text-slate-400" />{slot.stageName}</div>
                        </td>
                        <td className="px-4 py-4">
                          <p className="font-semibold tabular-nums text-slate-800">{toStoredTime(slot.startTime)} – {toStoredTime(slot.endTime)}</p>
                          <p className="mt-0.5 text-xs text-slate-500">{formatScheduleDate(slot.date)}</p>
                        </td>
                        <td className="px-4 py-4 text-center">{getStatusBadge(slot.status)}</td>
                        <td className="px-5 py-4">
                          <div className="flex items-center justify-end gap-1">
                            <button type="button" onClick={() => handleOpenEdit(slot)} disabled={!canManageSchedules} className="rounded-lg p-2 text-slate-500 transition hover:bg-blue-50 hover:text-blue-700 disabled:cursor-not-allowed disabled:opacity-40" title="Edit schedule slot" aria-label={`Edit ${slot.competitionName}`}>
                              <Edit2 className="h-4 w-4" />
                            </button>
                            <button type="button" onClick={() => setDeleteTarget(slot)} disabled={!canManageSchedules} className="rounded-lg p-2 text-slate-500 transition hover:bg-red-50 hover:text-red-700 disabled:cursor-not-allowed disabled:opacity-40" title="Delete schedule slot" aria-label={`Delete ${slot.competitionName}`}>
                              <Trash2 className="h-4 w-4" />
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
          <div className="flex flex-col gap-1 border-t border-slate-100 px-4 py-3 text-xs text-slate-500 sm:flex-row sm:items-center sm:justify-between">
            <span>{sortedSchedules.length} timetable {sortedSchedules.length === 1 ? 'entry' : 'entries'} displayed</span>
            <span>{delayedCount} delayed {delayedCount === 1 ? 'slot' : 'slots'} across all stages</span>
          </div>
        </section>

        <Modal
          isOpen={modalOpen}
          onClose={() => { if (!saving) setModalOpen(false); }}
          title={editingSlot ? 'Edit schedule slot' : 'Create schedule slot'}
          description="Choose a competition, allocate a stage, and set the performance time."
          maxWidth="lg"
          footer={
            <div className="flex w-full flex-col-reverse gap-2 sm:flex-row sm:justify-end">
              <Button type="button" variant="outline" size="md" onClick={() => setModalOpen(false)} disabled={saving} className="w-full sm:w-auto">Cancel</Button>
              <Button type="submit" form="schedule-slot-form" variant="primary" size="md" isLoading={saving} disabled={!canManageSchedules} className="w-full sm:w-auto">
                {editingSlot ? 'Save changes' : 'Create slot'}
              </Button>
            </div>
          }
        >
          <form id="schedule-slot-form" onSubmit={handleSave} className="space-y-5">
            {error && (
              <div className="flex items-start gap-2 rounded-lg border border-red-200 bg-red-50 px-3 py-2.5 text-sm text-red-700">
                <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
                <p className="leading-5">{error}</p>
              </div>
            )}
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div className="sm:col-span-2">
                <Select
                  label="Competition"
                  value={competitionId}
                  onChange={event => setCompetitionId(event.target.value)}
                  options={competitions.map(item => ({ value: item.id, label: `${item.name} (${item.code} · ${item.categoryName})` }))}
                />
              </div>
              <div className="sm:col-span-2">
                <Select
                  label="Stage / venue"
                  value={stageId}
                  onChange={event => setStageId(event.target.value)}
                  options={stages.map(item => ({ value: item.id, label: item.name }))}
                />
              </div>
              <Input label="Schedule date" type="date" value={date} onChange={event => setDate(event.target.value)} required />
              <Select
                label="Schedule status"
                value={status}
                onChange={event => setStatus(event.target.value as ScheduleSlot['status'])}
                options={[
                  { value: 'SCHEDULED', label: 'Scheduled' },
                  { value: 'LIVE', label: 'Live on stage' },
                  { value: 'COMPLETED', label: 'Completed' },
                  { value: 'DELAYED', label: 'Delayed' }
                ]}
              />
              <Input label="Start time" type="time" value={startTime} onChange={event => setStartTime(event.target.value)} required />
              <Input label="End time" type="time" value={endTime} onChange={event => setEndTime(event.target.value)} required />
            </div>
            <p className="rounded-lg bg-slate-50 px-3 py-2.5 text-xs leading-5 text-slate-500">
              Time slots cannot overlap with another competition assigned to the same stage on the same date.
            </p>
          </form>
        </Modal>

        <Modal
          isOpen={Boolean(deleteTarget)}
          onClose={() => { if (!deleting) setDeleteTarget(null); }}
          title="Delete schedule slot?"
          description="This removes the selected entry from the shared festival timetable."
          maxWidth="sm"
          footer={
            <div className="flex w-full flex-col-reverse gap-2 sm:flex-row sm:justify-end">
              <Button type="button" variant="outline" size="md" onClick={() => setDeleteTarget(null)} disabled={deleting} className="w-full sm:w-auto">Cancel</Button>
              <Button type="button" variant="destructive" size="md" onClick={handleDelete} isLoading={deleting} disabled={!canManageSchedules} className="w-full sm:w-auto">Delete slot</Button>
            </div>
          }
        >
          <div className="flex items-start gap-3">
            <span className="rounded-xl bg-red-50 p-2.5 text-red-600"><Trash2 className="h-5 w-5" /></span>
            <div className="min-w-0">
              <p className="text-sm font-semibold text-slate-900">{deleteTarget?.competitionName}</p>
              <p className="mt-1 text-xs leading-5 text-slate-500">
                {deleteTarget ? `${deleteTarget.stageName} · ${formatScheduleDate(deleteTarget.date)} · ${toStoredTime(deleteTarget.startTime)}–${toStoredTime(deleteTarget.endTime)}` : ''}
              </p>
              <p className="mt-2 text-xs leading-5 text-red-700">This action cannot be undone.</p>
            </div>
          </div>
        </Modal>
      </div>
    </AdminLayout>
  );
}
