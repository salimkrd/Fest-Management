'use client';

import React, { useMemo } from 'react';
import { AdminLayout } from '@/components/layout/AdminLayout';
import { useFest } from '@/context/FestContext';
import { calculateTopScorers, type TopScorerRow } from '@/domain/topScorers';
import { Award, BookOpen, Mic2, Trophy, Info } from 'lucide-react';

function ScorerTable({ rows }: { rows: TopScorerRow[] }) {
  if (!rows.length) {
    return (
      <div className="px-6 py-10 text-center text-sm text-[#526070]">
        No published individual results for this category yet. Assign each competition a
        Stage / Off Stage classification and publish its results to populate the rankings.
      </div>
    );
  }
  return (
    <div className="overflow-x-auto">
      <table className="min-w-full text-left text-xs">
        <thead className="bg-[#F8FAFC] text-[#526070] uppercase text-[11px]">
          <tr>
            <th className="px-5 py-3">Position</th>
            <th className="px-5 py-3">Participant</th>
            <th className="px-5 py-3">Team</th>
            <th className="px-5 py-3 text-right">Competitions</th>
            <th className="px-5 py-3 text-right">Average / 100</th>
            <th className="px-5 py-3 text-right">Total Marks</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-[#E1E7EF]">
          {rows.map(row => (
            <tr key={row.participantId} className={row.position === 1 ? 'bg-blue-50/50' : ''}>
              <td className="px-5 py-3 font-bold text-[#111111]">
                {row.position === 1 ? '🏆' : ''} #{row.position}
              </td>
              <td className="px-5 py-3">
                <span className="block font-bold text-[#111111]">{row.name}</span>
                <span className="text-[#526070]">{row.bib} · {row.categoryName}</span>
              </td>
              <td className="px-5 py-3">{row.teamName} ({row.teamCode})</td>
              <td className="px-5 py-3 text-right">{row.competitionsCount}</td>
              <td className="px-5 py-3 text-right">{row.averagePercentage.toFixed(2)}</td>
              <td className="px-5 py-3 text-right font-extrabold text-[#2563EB]">{row.totalMarks.toFixed(2)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export default function TopScorersPage() {
  const { competitions, results, registrations, participants } = useFest();
  const stage = useMemo(
    () => calculateTopScorers('STAGE', competitions, results, registrations, participants),
    [competitions, results, registrations, participants]
  );
  const offStage = useMemo(
    () => calculateTopScorers('OFF_STAGE', competitions, results, registrations, participants),
    [competitions, results, registrations, participants]
  );
  const unclassified = competitions.filter(c => !c.performanceMode).length;

  const sections = [
    { title: 'Star of the Fest', subtitle: 'Stage Competitions', icon: Mic2, rows: stage },
    { title: 'Pen of the Fest', subtitle: 'Off Stage Competitions', icon: BookOpen, rows: offStage }
  ];

  return (
    <AdminLayout>
      <div className="space-y-6 max-w-6xl">
        <div className="flex items-center gap-3 border-b border-[#E1E7EF] pb-4">
          <div className="p-3 bg-blue-50 rounded-xl text-[#2563EB]"><Trophy className="w-6 h-6" /></div>
          <div>
            <h1 className="text-2xl font-extrabold text-[#111111]">Top Scorers</h1>
            <p className="text-xs text-[#526070] mt-1">Individual award rankings from published solo competitions only</p>
          </div>
        </div>
        <div className="rounded-xl bg-blue-50/60 border border-blue-200 p-4 flex gap-2 text-xs text-blue-900">
          <Info className="h-4 w-4 shrink-0" />
          <p>Marks are normalized to 100 per event and summed across published solo competitions.
            Group scores are excluded from individual awards and count only toward the Team Championship.
            Unpublished results are excluded automatically. Equal totals share the top award position.</p>
        </div>
        {unclassified > 0 && (
          <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-xs font-semibold text-amber-900">
            {unclassified} competition(s) are not classified as Stage or Off Stage.
            Open Competitions → Edit to classify them. Unclassified competitions cannot affect these awards.
          </div>
        )}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {sections.map(({ title, subtitle, icon: Icon, rows }) => (
            <div key={title} className="bg-white border border-[#E1E7EF] rounded-xl p-5 shadow-xs">
              <div className="flex items-center gap-3">
                <span className="p-2 rounded-lg bg-blue-50 text-[#2563EB]"><Icon className="w-5 h-5" /></span>
                <div>
                  <div className="text-xs uppercase tracking-wide text-[#526070]">{subtitle}</div>
                  <div className="font-extrabold text-lg text-[#111111]">{title}</div>
                </div>
                <Award className="ml-auto w-5 h-5 text-amber-600" />
              </div>
              <div className="mt-4 border-t border-[#E1E7EF] pt-4">
                {rows.length ? (
                  <>
                    <div className="text-xs uppercase font-semibold text-[#526070]">Current leader{rows.filter(r => r.position === 1).length > 1 ? 's (tie)' : ''}</div>
                    <div className="text-xl font-extrabold mt-1 text-[#111111]">
                      {rows.filter(row => row.position === 1).map(row => row.name).join(' / ')}
                    </div>
                    <div className="text-xs mt-1 text-[#526070]">{rows[0].totalMarks.toFixed(2)} total normalized marks</div>
                  </>
                ) : <p className="text-sm text-[#526070]">No eligible published results</p>}
              </div>
            </div>
          ))}
        </div>
        {sections.map(({ title, rows }) => (
          <section key={title} className="bg-white rounded-xl border border-[#E1E7EF] shadow-xs overflow-hidden">
            <div className="px-5 py-4 border-b border-[#E1E7EF] flex items-center justify-between">
              <h2 className="font-bold text-[#111111]">{title} — Ranked Participants</h2>
              <span className="text-xs text-[#526070]">{rows.length} scorers</span>
            </div>
            <ScorerTable rows={rows} />
          </section>
        ))}
      </div>
    </AdminLayout>
  );
}
