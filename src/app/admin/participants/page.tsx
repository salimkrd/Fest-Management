'use client';

import React, { useState } from 'react';
import { jsPDF } from 'jspdf';
import { AdminLayout } from '@/components/layout/AdminLayout';
import { useFest } from '@/context/FestContext';
import { Participant } from '@/types/fest';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { DigitalIdCard } from '@/components/domain/DigitalIdCard';
import { ParticipantEditorModal } from '@/components/domain/ParticipantEditorModal';
import { ParticipantPhoto } from '@/components/domain/ParticipantPhoto';
import { uploadParticipantPhoto } from '@/lib/participantPhotoUpload';
import { Plus, Search, Edit2, Trash2, IdCard, FileDown } from 'lucide-react';

const formatPdfScheduleDate = (value: string): string => {
  const parts = value.split('-').map(Number);
  if (parts.length !== 3 || parts.some(part => !Number.isFinite(part))) return value || '—';
  return new Intl.DateTimeFormat('en-GB', {
    day: '2-digit',
    month: 'short',
    year: 'numeric'
  }).format(new Date(parts[0], parts[1] - 1, parts[2]));
};

const getPdfScheduleTimeMinutes = (value: string): number => {
  const match = value.trim().match(/^(\d{1,2}):(\d{2})\s*(AM|PM)?$/i);
  if (!match) return Number.MAX_SAFE_INTEGER;
  const rawHours = Number(match[1]);
  const minutes = Number(match[2]);
  if (minutes > 59) return Number.MAX_SAFE_INTEGER;
  if (match[3]) {
    if (rawHours < 1 || rawHours > 12) return Number.MAX_SAFE_INTEGER;
    let hours = rawHours % 12;
    if (match[3].toUpperCase() === 'PM') hours += 12;
    return hours * 60 + minutes;
  }
  if (rawHours > 23) return Number.MAX_SAFE_INTEGER;
  return rawHours * 60 + minutes;
};

export default function ParticipantsPage() {
  const { participants, teams, categories, competitions, schedules, registrations, addParticipant, updateParticipant, deleteParticipant } = useFest();

  const [search, setSearch] = useState('');
  const [teamFilter, setTeamFilter] = useState('ALL');
  const [categoryFilter, setCategoryFilter] = useState('ALL');
  const [modalOpen, setModalOpen] = useState(false);
  const [editingPart, setEditingPart] = useState<Participant | null>(null);
  const [selectedIdCardPart, setSelectedIdCardPart] = useState<Participant | null>(null);

  const filteredParticipants = participants.filter(p => {
    const query = search.trim().toLowerCase();
    const matchesSearch = (p.name || '').toLowerCase().includes(query) ||
                          (p.bib || '').toLowerCase().includes(query) ||
                          (p.email || '').toLowerCase().includes(query) ||
                          (p.place || '').toLowerCase().includes(query);
    const matchesTeam = teamFilter === 'ALL' || p.teamId === teamFilter;
    const matchesCat = categoryFilter === 'ALL' || p.categoryId === categoryFilter;
    return matchesSearch && matchesTeam && matchesCat;
  });

  const handleOpenAdd = () => {
    setEditingPart(null);
    setModalOpen(true);
  };

  const handleOpenEdit = (participant: Participant) => {
    setEditingPart(participant);
    setModalOpen(true);
  };

  const handleSave = async (
    data: Omit<Participant, 'id' | 'bib' | 'idStatus'>,
    photoFile?: File | null
  ): Promise<string> => {
    let participantId: string;
    if (editingPart) {
      // Do not replace competition registrations when editing profile fields.
      const profileUpdates: Partial<Participant> = { ...data };
      delete profileUpdates.registeredEventIds;
      await updateParticipant(editingPart.id, profileUpdates);
      participantId = editingPart.id;
    } else {
      const created = await addParticipant(data);
      participantId = created.id;
      // If upload fails, the open editor becomes an edit session, avoiding duplicate creation on retry.
      setEditingPart(created);
    }

    if (photoFile) {
      const photoUrl = await uploadParticipantPhoto(participantId, photoFile);
      await updateParticipant(participantId, { photoUrl });
    }
    return participantId;
  };

  const handleDelete = async (id: string, name: string) => {
    if (confirm(`Are you sure you want to remove participant "${name}"?`)) {
      try {
        await deleteParticipant(id);
      } catch (err: unknown) {
        alert(err instanceof Error ? err.message : 'Failed to delete participant.');
      }
    }
  };

  const getParticipantRegistrations = (participantId: string) =>
    registrations
      .filter(reg =>
        reg.status !== 'REJECTED' &&
        reg.status !== 'CANCELLED' &&
        (reg.participantId === participantId || reg.groupLeaderId === participantId)
      )
      .sort((a, b) => {
        const competitionA = competitions.find(item => item.id === a.competitionId);
        const competitionB = competitions.find(item => item.id === b.competitionId);
        const dateCompare = (competitionA?.date || '').localeCompare(competitionB?.date || '');
        return dateCompare || (a.competitionName || '').localeCompare(b.competitionName || '');
      });

  const getRegisteredEventCount = (participantId: string) =>
    new Set(getParticipantRegistrations(participantId).map(reg => reg.competitionId)).size;

  const handleDownloadCompetitionList = (participant: Participant) => {
    try {
      const entries = getParticipantRegistrations(participant.id);
      const pdf = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4', compress: true });
      const pageWidth = 1240;
      const pageHeight = 1754;
      const margin = 54;
      const contentWidth = pageWidth - margin * 2;
      const columnWidths = [42, 300, 144, 100, 118, 170, 150, 108];
      const columnLabels = ['No.', 'Competition', 'Category', 'Format', 'Date', 'Time / Venue', 'Registration ID', 'Status'];
      const lineHeight = 22;
      let currentPageNumber = 1;
      let currentCanvas = document.createElement('canvas');
      let currentContext = currentCanvas.getContext('2d') as CanvasRenderingContext2D;
      let currentY = 0;

      const wrapText = (ctx: CanvasRenderingContext2D, value: string, maxWidth: number) => {
        const output: string[] = [];
        String(value || '—').split('\n').forEach((paragraph) => {
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
        return output.length ? output : ['—'];
      };

      const drawTableHeader = (ctx: CanvasRenderingContext2D, top: number) => {
        ctx.fillStyle = '#eaf1ff';
        ctx.fillRect(margin, top, contentWidth, 50);
        ctx.strokeStyle = '#94a3b8';
        ctx.lineWidth = 1.5;
        ctx.font = 'bold 16px Arial, sans-serif';
        let x = margin;
        columnLabels.forEach((label, index) => {
          const lines = wrapText(ctx, label, columnWidths[index] - 14);
          ctx.strokeRect(x, top, columnWidths[index], 50);
          ctx.fillStyle = '#172554';
          lines.slice(0, 2).forEach((line, lineIndex) => {
            ctx.fillText(line, x + 7, top + 8 + lineIndex * 20);
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

        let y = 54;
        if (continued) {
          context.fillStyle = '#1e40af';
          context.font = 'bold 28px Arial, sans-serif';
          context.fillText('INSPIRATH', margin, y);
          context.fillStyle = '#475569';
          context.font = 'bold 16px Arial, sans-serif';
          context.textAlign = 'right';
          context.fillText('COMPETITION LIST - CONTINUED', pageWidth - margin, y + 7);
          context.textAlign = 'left';
          y += 48;
          context.fillStyle = '#0f172a';
          context.font = 'bold 22px Arial, sans-serif';
          context.fillText(participant.name || 'Unnamed participant', margin, y);
          context.fillStyle = '#475569';
          context.font = '16px Arial, sans-serif';
          context.fillText('Bib: ' + (participant.bib || '—') + '    Team: ' + (participant.teamName || '—'), margin, y + 30);
          y += 66;
        } else {
          context.fillStyle = '#1e40af';
          context.font = 'bold 36px Arial, sans-serif';
          context.textAlign = 'center';
          context.fillText('INSPIRATH', pageWidth / 2, y);
          context.fillStyle = '#334155';
          context.font = 'bold 16px Arial, sans-serif';
          context.fillText('PARTICIPANT COMPETITION REGISTRATION LIST', pageWidth / 2, y + 44);
          context.textAlign = 'left';
          y += 100;

          context.fillStyle = '#0f172a';
          context.font = 'bold 27px Arial, sans-serif';
          context.fillText(participant.name || 'Unnamed participant', margin, y);
          context.fillStyle = '#334155';
          context.font = '17px Arial, sans-serif';
          y += 42;
          const details = [
            'Bib / Chest No.: ' + (participant.bib || '—'),
            'Team: ' + (participant.teamName || '—') + (participant.teamCode ? ' (' + participant.teamCode + ')' : ''),
            'Category: ' + (participant.categoryName || '—'),
            'Class / Grade: ' + (participant.classGrade || '—')
          ];
          const detailLines = details.join('     |     ');
          const wrappedDetails = wrapText(context, detailLines, contentWidth);
          wrappedDetails.forEach((line, index) => context.fillText(line, margin, y + index * 24));
          y += wrappedDetails.length * 24 + 16;

          context.fillStyle = '#1e40af';
          context.font = 'bold 18px Arial, sans-serif';
          context.fillText('Registered Competitions: ' + entries.length, margin, y);
          y += 36;

          context.strokeStyle = '#1d4ed8';
          context.lineWidth = 3;
          context.beginPath();
          context.moveTo(margin, y);
          context.lineTo(pageWidth - margin, y);
          context.stroke();
          y += 18;
        }

        drawTableHeader(context, y);
        y += 50;
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
          currentContext.fillText('Total registered competitions: ' + entries.length, margin, pageHeight - 64);
        } else {
          currentContext.fillText('INSPIRATH Fest Management', margin, pageHeight - 64);
        }
        currentContext.textAlign = 'right';
        currentContext.font = '15px Arial, sans-serif';
        currentContext.fillText('Page ' + currentPageNumber, pageWidth - margin, pageHeight - 64);
        currentContext.textAlign = 'left';

        const image = currentCanvas.toDataURL('image/jpeg', 0.92);
        if (currentPageNumber > 1) pdf.addPage();
        pdf.addImage(image, 'JPEG', 0, 0, 210, 297, 'participant-competitions-' + currentPageNumber, 'FAST');
      };

      const beginPage = (continued: boolean) => {
        const page = createPage(continued);
        currentCanvas = page.canvas;
        currentContext = page.context;
        currentY = page.y;
      };

      const rows = entries.map((entry, index) => {
        const competition = competitions.find(item => item.id === entry.competitionId);
        const name = entry.competitionName || competition?.name || 'Unknown competition';
        const code = competition?.code || '';
        // Schedule page is the source of truth for competition date, time and venue.
        // Support multiple schedule slots for the same competition without using stale
        // date/time values from the Competition record.
        const competitionSchedules = schedules
          .filter(slot => slot.competitionId === entry.competitionId)
          .sort((a, b) =>
            a.date.localeCompare(b.date) ||
            getPdfScheduleTimeMinutes(a.startTime) - getPdfScheduleTimeMinutes(b.startTime)
          );
        const date = competitionSchedules.length > 0
          ? competitionSchedules.map(slot => formatPdfScheduleDate(slot.date)).join('\n')
          : 'Not scheduled';
        const schedule = competitionSchedules.length > 0
          ? competitionSchedules.map(slot => [
              (slot.startTime || '—') + ' - ' + (slot.endTime || '—'),
              slot.stageName || ''
            ].filter(Boolean).join('\n')).join('\n\n')
          : 'Not scheduled';
        return {
          key: entry.id,
          values: [
            String(index + 1),
            code ? code + '\n' + name : name,
            entry.categoryName || competition?.categoryName || '—',
            entry.type === 'GROUP' ? 'Group' : 'Individual',
            date,
            schedule,
            entry.code || '—',
            entry.status
          ]
        };
      });

      beginPage(false);
      if (rows.length === 0) {
        const emptyHeight = 64;
        currentContext.fillStyle = '#64748b';
        currentContext.font = '19px Arial, sans-serif';
        currentContext.fillText('No active competition registrations found for this participant.', margin + 12, currentY + 20);
        currentContext.strokeStyle = '#cbd5e1';
        currentContext.strokeRect(margin, currentY, contentWidth, emptyHeight);
        currentY += emptyHeight;
      } else {
        rows.forEach((row, rowIndex) => {
          currentContext.font = '16px Arial, sans-serif';
          const cellLines = row.values.map((value, columnIndex) =>
            wrapText(currentContext, value, columnWidths[columnIndex] - 16)
          );
          const maxLines = Math.max(...cellLines.map(lines => lines.length));
          const rowHeight = Math.max(44, maxLines * lineHeight + 16);
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
              currentContext.fillText(line, x + 7, currentY + 8 + lineIndex * lineHeight);
            });
            x += columnWidths[columnIndex];
          });
          currentY += rowHeight;
        });
      }

      saveCurrentPage(true);
      pdf.setProperties({
        title: participant.name + ' - Competition Registration List',
        subject: 'A4 participant competition registration list',
        creator: 'INSPIRATH Fest Management'
      });
      const safeName = ((participant.bib || 'PARTICIPANT') + '-' + (participant.name || 'competitions') + '-competitions')
        .replace(/[^\w-]+/g, '-')
        .replace(/-+/g, '-')
        .replace(/^-|-$/g, '') || 'participant-competitions';
      pdf.save(safeName + '.pdf');
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Failed to generate the participant competition PDF.');
    }
  };



  return (
    <AdminLayout>
      <div className="w-full max-w-[1400px] min-w-0 space-y-5 sm:space-y-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 sm:gap-4 pb-4 border-b border-[#E1E7EF]">
          <div>
            <h1 className="text-xl sm:text-2xl font-bold text-slate-900 tracking-tight">
              Participant Management
            </h1>
            <p className="text-xs sm:text-sm text-slate-500 mt-1 leading-relaxed">
              Contestant roster, team affiliations, categories, and digital accreditation ID badges
            </p>
          </div>
          <Button
            variant="primary"
            size="md"
            leftIcon={<Plus className="w-4 h-4" />}
            onClick={handleOpenAdd}
          >
            Register Student
          </Button>
        </div>

        {/* Filter bar */}
        <div className="bg-white p-3 sm:p-4 rounded-xl border border-slate-200 shadow-sm flex flex-col lg:flex-row lg:items-center justify-between gap-3 sm:gap-4">
          <div className="relative flex-1 w-full lg:max-w-xl min-w-0">
            <Search className="w-4 h-4 text-[#526070] absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
            <input
              type="text"
              placeholder="Search by Bib, Name, Email, or Place..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full min-h-11 text-sm pl-10 pr-4 py-2.5 bg-slate-50 border border-slate-200 rounded-lg text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-100 focus:border-blue-500 transition-colors"
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 w-full lg:w-auto lg:min-w-[420px]">
            <select
              aria-label="Filter by Team Contingent"
              value={teamFilter}
              onChange={(e) => setTeamFilter(e.target.value)}
              className="w-full min-w-0 min-h-11 text-sm font-medium py-2.5 px-3 rounded-lg border border-slate-200 bg-white text-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-100 focus:border-blue-500"
            >
              <option value="ALL">All Teams / Houses</option>
              {teams.map(t => (
                <option key={t.id} value={t.id}>{t.name} ({t.code})</option>
              ))}
            </select>

            <select
              aria-label="Filter by Category"
              value={categoryFilter}
              onChange={(e) => setCategoryFilter(e.target.value)}
              className="text-xs font-semibold py-2 px-3 rounded-lg border border-[#E1E7EF] bg-[#F8FAFC] text-[#111111] focus:outline-none focus:bg-white"
            >
              <option value="ALL">All Categories</option>
              {categories.map(c => (
                <option key={c.id} value={c.id}>{c.name}</option>
              ))}
            </select>
          </div>
        </div>

        {/* Participants Table */}
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
          <div className="px-4 sm:px-5 py-4 border-b border-slate-200 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-1.5">
            <div>
              <h3 className="text-sm font-bold text-slate-900">Student Contestants Directory</h3>
              <p className="text-xs text-slate-500 mt-0.5">Participant profiles, team details and digital ID cards</p>
            </div>
            <span className="text-xs font-semibold text-slate-600 tabular-nums">Showing {filteredParticipants.length} of {participants.length} participants</span>
          </div>

          <div className="hidden md:block overflow-x-auto">
            <table className="w-full min-w-[1050px] text-left text-xs">
              <thead>
                <tr className="border-b border-slate-200 bg-slate-50 text-slate-500 font-bold uppercase text-[10px] tracking-wide">
                  <th className="py-3 px-4">Participant ID / Bib</th>
                  <th className="py-3 px-6">Photo &amp; Full Name</th>
                  <th className="py-3 px-6">Team Affiliation</th>
                  <th className="py-3 px-6">Place</th>
                  <th className="py-3 px-6">Category</th>
                  <th className="py-3 px-6">Class / Grade</th>
                  <th className="py-3 px-4 text-center">Registered Events</th>
                  <th className="py-3 px-6 text-center">ID Status</th>
                  <th className="py-3 px-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200">
                {filteredParticipants.length === 0 ? (
                  <tr><td colSpan={9} className="px-6 py-14 text-center text-sm text-slate-500">No participants match your search or filters.</td></tr>
                ) : filteredParticipants.map((p) => (
                  <tr key={p.id} className="hover:bg-slate-50/80 transition-colors">
                    <td className="py-3.5 px-4 font-mono font-bold text-[#111111]">
                      {p.bib}
                    </td>
                    <td className="py-3.5 px-4">
                      <div className="flex items-center gap-3">
                        <ParticipantPhoto
                          photoUrl={p.photoUrl}
                          name={p.name}
                          size="sm"
                          shape="circle"
                          className="border border-[#E1E7EF]"
                        />
                        <div>
                          <span className="font-bold text-[#111111] text-sm block">{p.name}</span>
                          <span className="text-[11px] text-[#526070]">{p.email}</span>
                        </div>
                      </div>
                    </td>
                    <td className="py-3.5 px-4">
                      <span className="font-semibold text-[#111111]">{p.teamName}</span>
                      <span className="text-[#526070] text-[11px] ml-1">({p.teamCode})</span>
                    </td>
                    <td className="py-3.5 px-4 text-[#526070]">
                      {p.place || '—'}
                    </td>
                    <td className="py-3.5 px-4 font-semibold text-[#111111]">
                      {p.categoryName}
                    </td>
                    <td className="py-3.5 px-4 text-[#526070]">
                      {p.classGrade || '—'}
                    </td>
                    <td className="py-3.5 px-4 text-center">
                      <span className="font-bold text-[#2563EB] bg-blue-50 px-2 py-0.5 rounded border border-blue-100">
                        {getRegisteredEventCount(p.id)} Events
                      </span>
                    </td>
                    <td className="py-3.5 px-4 text-center">
                      <Badge variant="success" size="sm">
                        {p.idStatus}
                      </Badge>
                    </td>
                    <td className="py-3.5 px-4 text-right">
                      <div className="flex items-center justify-end gap-2">
                        <button
                          type="button"
                          onClick={() => handleDownloadCompetitionList(p)}
                          className="p-1.5 rounded-lg text-[#526070] hover:text-emerald-700 hover:bg-emerald-50 transition-colors"
                          title="Download Participant Competition List (PDF)"
                          aria-label={`Download competition list for ${p.name}`}
                        >
                          <FileDown className="w-4 h-4" />
                        </button>
                        <button
                          type="button"
                          onClick={() => setSelectedIdCardPart(p)}
                          className="p-1.5 rounded-lg text-[#526070] hover:text-[#2563EB] hover:bg-blue-50 transition-colors"
                          title="View & Print Digital ID Card"
                        >
                          <IdCard className="w-4 h-4" />
                        </button>
                        <button
                          type="button"
                          onClick={() => handleOpenEdit(p)}
                          className="p-1.5 rounded-lg text-[#526070] hover:text-[#2563EB] hover:bg-blue-50 transition-colors"
                          title="Edit Participant"
                        >
                          <Edit2 className="w-4 h-4" />
                        </button>
                        <button
                          type="button"
                          onClick={() => handleDelete(p.id, p.name)}
                          className="p-1.5 rounded-lg text-[#526070] hover:text-[#DC2626] hover:bg-red-50 transition-colors"
                          title="Delete Participant"
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

          {/* Compact participant cards for phones and small tablets */}
          <div className="md:hidden divide-y divide-slate-200">
            {filteredParticipants.map((p) => (
              <article key={p.id} className="p-4 space-y-3">
                <div className="flex items-start gap-3 min-w-0">
                  <ParticipantPhoto photoUrl={p.photoUrl} name={p.name} size="md" shape="circle" className="border border-slate-200 shrink-0" />
                  <div className="min-w-0 flex-1">
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <h4 className="text-sm font-semibold text-slate-900 break-words">{p.name || 'Unnamed participant'}</h4>
                        <p className="text-xs text-slate-500 mt-0.5 break-all">{p.email || 'No email provided'}</p>
                      </div>
                      <span className="shrink-0 rounded-md bg-blue-50 border border-blue-100 px-2 py-1 text-xs font-mono font-bold text-blue-700">{p.bib || 'No Bib'}</span>
                    </div>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-x-3 gap-y-2 rounded-lg bg-slate-50 p-3 text-xs">
                  <div className="min-w-0"><p className="text-slate-500">Team</p><p className="font-semibold text-slate-800 break-words">{p.teamName || '—'}{p.teamCode ? ` (${p.teamCode})` : ''}</p></div>
                  <div className="min-w-0"><p className="text-slate-500">Category</p><p className="font-semibold text-slate-800 break-words">{p.categoryName || '—'}</p></div>
                  <div><p className="text-slate-500">Class / Grade</p><p className="font-medium text-slate-800">{p.classGrade || '—'}</p></div>
                  <div><p className="text-slate-500">Registered Events</p><p className="font-semibold text-blue-700">{getRegisteredEventCount(p.id)}</p></div>
                </div>
                <div className="flex items-center justify-between gap-3">
                  <Badge variant="success" size="sm">{p.idStatus || 'GENERATED'}</Badge>
                  <div className="flex items-center gap-1">
                    <button type="button" onClick={() => handleDownloadCompetitionList(p)} className="inline-flex min-h-10 min-w-10 items-center justify-center rounded-lg text-slate-600 hover:text-emerald-700 hover:bg-emerald-50" title="Download Participant Competition List (PDF)" aria-label={`Download competition list for ${p.name}`}><FileDown className="w-4 h-4" /></button><button type="button" onClick={() => setSelectedIdCardPart(p)} className="inline-flex min-h-10 min-w-10 items-center justify-center rounded-lg text-slate-600 hover:text-blue-700 hover:bg-blue-50" title="View & Print Digital ID Card" aria-label={`View ID card for ${p.name}`}><IdCard className="w-4 h-4" /></button>
                    <button type="button" onClick={() => handleOpenEdit(p)} className="inline-flex min-h-10 min-w-10 items-center justify-center rounded-lg text-slate-600 hover:text-blue-700 hover:bg-blue-50" title="Edit Participant" aria-label={`Edit ${p.name}`}><Edit2 className="w-4 h-4" /></button>
                    <button type="button" onClick={() => handleDelete(p.id, p.name)} className="inline-flex min-h-10 min-w-10 items-center justify-center rounded-lg text-slate-600 hover:text-red-700 hover:bg-red-50" title="Delete Participant" aria-label={`Delete ${p.name}`}><Trash2 className="w-4 h-4" /></button>
                  </div>
                </div>
              </article>
            ))}
            {filteredParticipants.length === 0 && <div className="px-4 py-12 text-center text-sm text-slate-500">No participants match your search or filters.</div>}
          </div>
        </div>

        {/* The same participant editor is used for Admin and Team Manager. */}
        {modalOpen && (
          <ParticipantEditorModal
            participant={editingPart}
            teams={teams}
            categories={categories}
            onSave={handleSave}
            onClose={() => setModalOpen(false)}
          />
        )}

        {/* Digital ID Card Preview Modal */}
        <DigitalIdCard
          participant={selectedIdCardPart}
          isOpen={!!selectedIdCardPart}
          onClose={() => setSelectedIdCardPart(null)}
        />
      </div>
    </AdminLayout>
  );
}
