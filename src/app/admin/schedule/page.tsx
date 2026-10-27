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
import { Plus, Search, Edit2, Trash2, Calendar, Clock, MapPin, CheckCircle2, FileDown } from 'lucide-react';

const getTimeMinutes = (value: string): number => {
  const match = value.trim().match(/^(\d{1,2}):(\d{2})\s*(AM|PM)?$/i);
  if (!match) return Number.MAX_SAFE_INTEGER;
  let hours = Number(match[1]) % 12;
  const minutes = Number(match[2]);
  if (match[3]?.toUpperCase() === 'PM') hours += 12;
  return hours * 60 + minutes;
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
  const { schedules, competitions, stages, theme, addSchedule, updateSchedule, deleteSchedule } = useFest();

  const [search, setSearch] = useState('');
  const [stageFilter, setStageFilter] = useState('ALL');
  const [statusFilter, setStatusFilter] = useState('ALL');
  const [modalOpen, setModalOpen] = useState(false);
  const [editingSlot, setEditingSlot] = useState<ScheduleSlot | null>(null);

  // Form State
  const [competitionId, setCompetitionId] = useState(competitions[0]?.id || '');
  const [stageId, setStageId] = useState(stages[0]?.id || '');
  const [date, setDate] = useState('2025-11-15');
  const [startTime, setStartTime] = useState('09:30 AM');
  const [endTime, setEndTime] = useState('11:00 AM');
  const [status, setStatus] = useState<ScheduleSlot['status']>('SCHEDULED');
  const [error, setError] = useState('');

  const filteredSchedules = schedules.filter(s => {
    const matchesSearch = s.competitionName.toLowerCase().includes(search.toLowerCase()) ||
                          s.categoryName.toLowerCase().includes(search.toLowerCase()) ||
                          s.stageName.toLowerCase().includes(search.toLowerCase());
    const matchesStage = stageFilter === 'ALL' || s.stageId === stageFilter;
    const matchesStatus = statusFilter === 'ALL' || s.status === statusFilter;
    return matchesSearch && matchesStage && matchesStatus;
  });

  const sortedSchedules = [...filteredSchedules].sort((a, b) =>
    a.date.localeCompare(b.date) || getTimeMinutes(a.startTime) - getTimeMinutes(b.startTime)
  );

  const handleOpenAdd = () => {
    setEditingSlot(null);
    setCompetitionId(competitions[0]?.id || '');
    setStageId(stages[0]?.id || '');
    setDate('2025-11-15');
    setStartTime('10:00 AM');
    setEndTime('11:30 AM');
    setStatus('SCHEDULED');
    setError('');
    setModalOpen(true);
  };

  const handleOpenEdit = (slot: ScheduleSlot) => {
    setEditingSlot(slot);
    setCompetitionId(slot.competitionId);
    setStageId(slot.stageId);
    setDate(slot.date);
    setStartTime(slot.startTime);
    setEndTime(slot.endTime);
    setStatus(slot.status);
    setError('');
    setModalOpen(true);
  };

  const [saving, setSaving] = useState(false);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    const comp = competitions.find(c => c.id === competitionId);
    const stg = stages.find(s => s.id === stageId);

    if (!comp || !stg) {
      setError('Please select a valid competition and stage.');
      return;
    }

    const slotData = {
      competitionId,
      competitionName: comp.name,
      categoryName: comp.categoryName,
      type: comp.type,
      stageId,
      stageName: stg.name,
      date,
      startTime,
      endTime,
      status
    };

    setSaving(true);
    try {
      if (editingSlot) {
        await updateSchedule(editingSlot.id, slotData);
      } else {
        await addSchedule(slotData);
      }
      setModalOpen(false);
    } catch (err: any) {
      setError(err?.message || 'Failed to save schedule slot.');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: string, name: string) => {
    if (confirm(`Are you sure you want to delete schedule slot for "${name}"?`)) {
      try {
        await deleteSchedule(id);
      } catch (err: any) {
        alert(err?.message || 'Failed to delete schedule slot.');
      }
    }
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
      { label: 'TIME', width: 140, align: 'center', value: slot => (slot.startTime || '-') + ' - ' + (slot.endTime || '-') },
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

  return (
    <AdminLayout>
      <div className="space-y-6 max-w-6xl">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-2 border-b border-[#E1E7EF]">
          <div>
            <h1 className="text-xl sm:text-2xl font-bold text-[#111111] tracking-tight">
              Competition Schedule
            </h1>
            <p className="text-xs text-[#526070] mt-1">
              Master chronological timetable, venue slot allocations, and stage performance progression
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Button
              variant="outline"
              size="md"
              leftIcon={<FileDown className="w-4 h-4" />}
              onClick={handleExportSchedulePDF}
              disabled={sortedSchedules.length === 0}
            >
              Export A4 PDF
            </Button>
            <Button
              variant="primary"
              size="md"
              leftIcon={<Plus className="w-4 h-4" />}
              onClick={handleOpenAdd}
            >
              Create Schedule Slot
            </Button>
          </div>
        </div>

        {/* Filter bar */}
        <div className="bg-white p-4 rounded-xl border border-[#E1E7EF] flex flex-col md:flex-row items-center justify-between gap-4">
          <div className="relative flex-1 w-full md:max-w-md">
            <Search className="w-4 h-4 text-[#526070] absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
            <input
              type="text"
              placeholder="Search event title or stage..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full text-xs pl-9 pr-4 py-2 bg-[#F8FAFC] border border-[#E1E7EF] rounded-lg text-[#111111] focus:outline-none focus:bg-white focus:border-[#2563EB]"
            />
          </div>

          <div className="flex items-center gap-3 w-full md:w-auto">
            <select
              aria-label="Filter by Stage"
              value={stageFilter}
              onChange={(e) => setStageFilter(e.target.value)}
              className="text-xs font-semibold py-2 px-3 rounded-lg border border-[#E1E7EF] bg-[#F8FAFC] text-[#111111] focus:outline-none focus:bg-white"
            >
              <option value="ALL">All Stages</option>
              {stages.map(s => (
                <option key={s.id} value={s.id}>{s.name}</option>
              ))}
            </select>

            <select
              aria-label="Filter by Status"
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="text-xs font-semibold py-2 px-3 rounded-lg border border-[#E1E7EF] bg-[#F8FAFC] text-[#111111] focus:outline-none focus:bg-white"
            >
              <option value="ALL">All Statuses</option>
              <option value="LIVE">Live</option>
              <option value="SCHEDULED">Scheduled</option>
              <option value="COMPLETED">Completed</option>
              <option value="DELAYED">Delayed</option>
            </select>
          </div>
        </div>

        {/* Schedule Table */}
        <div className="bg-white rounded-xl border border-[#E1E7EF] shadow-xs overflow-hidden">
          <div className="px-6 py-4 border-b border-[#E1E7EF] flex items-center justify-between">
            <h3 className="text-sm font-bold text-[#111111]">Master Timetable</h3>
            <span className="text-xs text-[#526070]">{filteredSchedules.length} Scheduled Slots</span>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="border-b border-[#E1E7EF] bg-[#F8FAFC] text-[#526070] font-bold uppercase text-[11px]">
                  <th className="py-3 px-6">Competition</th>
                  <th className="py-3 px-6">Category</th>
                  <th className="py-3 px-6 text-center">Type</th>
                  <th className="py-3 px-6">Stage &amp; Venue</th>
                  <th className="py-3 px-6">Date &amp; Time Slot</th>
                  <th className="py-3 px-6 text-center">Status</th>
                  <th className="py-3 px-6 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#E1E7EF]">
                {sortedSchedules.map((slot) => (
                  <tr key={slot.id} className="hover:bg-[#F8FAFC] transition-colors">
                    <td className="py-4 px-6 font-bold text-[#111111] text-sm">
                      {slot.competitionName}
                    </td>
                    <td className="py-4 px-6 font-semibold text-[#111111]">
                      {slot.categoryName}
                    </td>
                    <td className="py-4 px-6 text-center">
                      <span className={`text-[10px] font-bold px-2 py-0.5 rounded ${slot.type === 'SOLO' ? 'bg-slate-100 text-slate-800' : 'bg-purple-100 text-purple-800'}`}>
                        {slot.type}
                      </span>
                    </td>
                    <td className="py-4 px-6 text-[#526070]">
                      <div className="flex items-center gap-1.5">
                        <MapPin className="w-3.5 h-3.5 text-[#526070]" />
                        <span>{slot.stageName}</span>
                      </div>
                    </td>
                    <td className="py-4 px-6">
                      <div className="flex items-center gap-1.5 text-[#111111] font-semibold">
                        <Clock className="w-3.5 h-3.5 text-[#526070]" />
                        <span>{slot.startTime} - {slot.endTime}</span>
                      </div>
                      <span className="text-[10px] text-[#526070] block mt-0.5">{slot.date}</span>
                    </td>
                    <td className="py-4 px-6 text-center">
                      {getStatusBadge(slot.status)}
                    </td>
                    <td className="py-4 px-6 text-right">
                      <div className="flex items-center justify-end gap-2">
                        <button
                          type="button"
                          onClick={() => handleOpenEdit(slot)}
                          className="p-1.5 rounded-lg text-[#526070] hover:text-[#2563EB] hover:bg-blue-50 transition-colors"
                          title="Edit Schedule"
                        >
                          <Edit2 className="w-4 h-4" />
                        </button>
                        <button
                          type="button"
                          onClick={() => handleDelete(slot.id, slot.competitionName)}
                          className="p-1.5 rounded-lg text-[#526070] hover:text-[#DC2626] hover:bg-red-50 transition-colors"
                          title="Delete Schedule Slot"
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
          title={editingSlot ? `Edit Schedule Slot (${editingSlot.competitionName})` : 'Create Schedule Slot'}
          description="Assign competition to stage venue, configure start and conclusion times"
          maxWidth="md"
          footer={
            <div className="flex items-center justify-end gap-2 w-full">
              <Button variant="outline" size="sm" onClick={() => setModalOpen(false)}>
                Cancel
              </Button>
              <Button variant="primary" size="sm" onClick={handleSave}>
                {editingSlot ? 'Update Slot' : 'Save Slot'}
              </Button>
            </div>
          }
        >
          <form onSubmit={handleSave} className="space-y-4">
            {error && (
              <p className="text-xs text-[#DC2626] font-semibold">{error}</p>
            )}

            <Select
              label="Select Competition"
              value={competitionId}
              onChange={(e) => setCompetitionId(e.target.value)}
              options={competitions.map(c => ({ value: c.id, label: `${c.name} (${c.code} - ${c.categoryName})` }))}
            />

            <Select
              label="Assigned Stage Venue"
              value={stageId}
              onChange={(e) => setStageId(e.target.value)}
              options={stages.map(s => ({ value: s.id, label: s.name }))}
            />

            <Input
              label="Date"
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
              required
            />

            <div className="grid grid-cols-2 gap-3">
              <Input
                label="Start Time"
                placeholder="09:30 AM"
                value={startTime}
                onChange={(e) => setStartTime(e.target.value)}
                required
              />
              <Input
                label="End Time"
                placeholder="11:00 AM"
                value={endTime}
                onChange={(e) => setEndTime(e.target.value)}
                required
              />
            </div>

            <Select
              label="Status"
              value={status}
              onChange={(e) => setStatus(e.target.value as any)}
              options={[
                { value: 'SCHEDULED', label: 'Scheduled (Upcoming)' },
                { value: 'LIVE', label: 'Live On Stage' },
                { value: 'COMPLETED', label: 'Completed' },
                { value: 'DELAYED', label: 'Delayed / Rescheduled' }
              ]}
            />
          </form>
        </Modal>
      </div>
    </AdminLayout>
  );
}
