'use client';

import React from 'react';
import Link from 'next/link';
import { AdminLayout } from '@/components/layout/AdminLayout';
import { useFest } from '@/context/FestContext';
import { StatCard } from '@/components/ui/StatCard';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import {
  Users2,
  Trophy,
  CheckCircle2,
  Clock,
  ArrowRight,
  ExternalLink,
  PlusCircle,
  FileSpreadsheet,
  Edit3,
  Calendar,
  Sparkles,
  MapPin,
  ChevronRight
} from 'lucide-react';

import { FestivalSettingsModal } from '@/components/domain/FestivalSettingsModal';
import { Settings } from 'lucide-react';

export default function AdminDashboardPage() {
  const { theme, participants, competitions, results, teams, schedules } = useFest();
  const [themeModalOpen, setThemeModalOpen] = React.useState(false);

  const publishedResults = results.filter(r => r.resultStatus === 'PUBLISHED');
  const pendingResultsCount = competitions.length - publishedResults.length;

  // Upcoming Schedule (max 3)
  const upcomingSchedules = schedules
    .filter(s => s.status === 'LIVE' || s.status === 'SCHEDULED')
    .slice(0, 3);

  // Recent Published Results (max 3)
  const recentPublished = publishedResults.slice(0, 3);

  // Top 3 Teams
  const topTeams = [...teams].sort((a, b) => b.totalPoints - a.totalPoints).slice(0, 3);

  return (
    <AdminLayout>
      <div className="space-y-8 max-w-6xl">
        {/* Page Title & Status Banner */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-2 border-b border-[#E1E7EF]">
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-xl sm:text-2xl font-bold text-[#111111] tracking-tight">
                <span className="festival-name">{theme.festivalName}</span> Workspace
              </h1>
              <span className="text-[11px] font-bold px-2 py-0.5 rounded bg-blue-50 text-[#2563EB] border border-blue-200">
                ACTIVE
              </span>
            </div>
            <p className="text-xs text-[#526070] mt-1">
              {theme.institutionName} · Central Operations Dashboard
            </p>
          </div>

          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              leftIcon={<Settings className="w-4 h-4 text-[#2563EB]" />}
              onClick={() => setThemeModalOpen(true)}
            >
              Settings
            </Button>
            <Link href="/" target="_blank">
              <Button
                variant="primary"
                size="sm"
                leftIcon={<Sparkles className="w-4 h-4 text-white" />}
                rightIcon={<ExternalLink className="w-3.5 h-3.5" />}
              >
                Open Public View
              </Button>
            </Link>
          </div>
        </div>

        <FestivalSettingsModal
          isOpen={themeModalOpen}
          onClose={() => setThemeModalOpen(false)}
        />


        {/* 2. Four Compact KPI Cards */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <StatCard
            label="Total Participants"
            value={participants.length}
            subValue="Enrolled across 4 teams"
            icon={<Users2 className="w-4 h-4" />}
          />
          <StatCard
            label="Total Competitions"
            value={competitions.length}
            subValue="Solo &amp; Group events"
            icon={<Trophy className="w-4 h-4" />}
          />
          <StatCard
            label="Published Results"
            value={publishedResults.length}
            subValue="Verified &amp; on public site"
            icon={<CheckCircle2 className="w-4 h-4 text-emerald-600" />}
          />
          <StatCard
            label="Pending Results"
            value={pendingResultsCount > 0 ? pendingResultsCount : 0}
            subValue="Under evaluation / live"
            icon={<Clock className="w-4 h-4 text-amber-500" />}
          />
        </div>

        {/* Two Column Section: Schedule & Published Results */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          {/* 3. Upcoming Schedule (max 3) */}
          <div className="lg:col-span-6 bg-white rounded-xl border border-[#E1E7EF] p-5 shadow-xs flex flex-col justify-between">
            <div>
              <div className="flex items-center justify-between pb-3 border-b border-[#E1E7EF]">
                <div className="flex items-center gap-2">
                  <Calendar className="w-4 h-4 text-[#2563EB]" />
                  <h3 className="text-sm font-bold text-[#111111]">Live Stage Timetable &amp; Upcoming</h3>
                </div>
                <Link href="/admin/schedule" className="text-xs text-[#2563EB] hover:underline font-semibold flex items-center gap-1">
                  Full Schedule <ChevronRight className="w-3.5 h-3.5" />
                </Link>
              </div>

              <div className="mt-4 space-y-3">
                {upcomingSchedules.length === 0 ? (
                  <p className="text-xs text-[#526070] italic py-4 text-center">
                    All scheduled items completed for current session.
                  </p>
                ) : (
                  upcomingSchedules.map((slot) => (
                    <div
                      key={slot.id}
                      className="p-3.5 rounded-lg border border-[#E1E7EF] bg-[#F8FAFC] flex items-center justify-between hover:border-neutral-300 transition-colors"
                    >
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="text-xs font-bold text-[#111111]">{slot.competitionName}</span>
                          <span className={`text-[10px] font-bold px-1.5 py-0.2 rounded uppercase ${slot.status === 'LIVE' ? 'bg-red-50 text-red-600 border border-red-200' : 'bg-blue-50 text-blue-700'}`}>
                            {slot.status}
                          </span>
                        </div>
                        <div className="mt-1 flex items-center gap-2 text-[11px] text-[#526070]">
                          <span className="flex items-center gap-1">
                            <MapPin className="w-3 h-3 text-[#526070]" /> {slot.stageName}
                          </span>
                          <span>•</span>
                          <span>{slot.categoryName} ({slot.type})</span>
                        </div>
                      </div>
                      <div className="text-right">
                        <span className="text-xs font-mono font-bold text-[#111111]">{slot.startTime}</span>
                        <span className="text-[10px] text-[#526070] block">{slot.endTime}</span>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>

            <div className="mt-4 pt-3 border-t border-[#E1E7EF] text-right">
              <Link href="/admin/stages" className="text-xs text-[#526070] hover:text-[#111111] font-semibold">
                Manage Stages &amp; Venues →
              </Link>
            </div>
          </div>

          {/* 4. Recent Published Results (max 3) */}
          <div className="lg:col-span-6 bg-white rounded-xl border border-[#E1E7EF] p-5 shadow-xs flex flex-col justify-between">
            <div>
              <div className="flex items-center justify-between pb-3 border-b border-[#E1E7EF]">
                <div className="flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                  <h3 className="text-sm font-bold text-[#111111]">Recently Published Results</h3>
                </div>
                <Link href="/admin/results" className="text-xs text-[#2563EB] hover:underline font-semibold flex items-center gap-1">
                  Verification Register <ChevronRight className="w-3.5 h-3.5" />
                </Link>
              </div>

              <div className="mt-4 space-y-3">
                {recentPublished.length === 0 ? (
                  <p className="text-xs text-[#526070] italic py-4 text-center">
                    No results published yet. Evaluate events in Mark Entry.
                  </p>
                ) : (
                  recentPublished.map((res) => {
                    const winner = res.ranks.find(r => r.rank === 1);
                    return (
                      <div
                        key={res.id}
                        className="p-3.5 rounded-lg border border-[#E1E7EF] bg-[#F8FAFC] flex items-center justify-between hover:border-neutral-300 transition-colors"
                      >
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="text-xs font-bold text-[#111111]">{res.competitionName}</span>
                            <span className="text-[10px] font-mono text-[#526070]">[{res.competitionCode}]</span>
                          </div>
                          {winner ? (
                            <div className="mt-1 text-xs text-[#526070]">
                              1st: <span className="font-semibold text-[#111111]">{winner.candidateName}</span> ({winner.teamCode}) · <span className="font-bold text-[#2563EB]">{winner.score} pts</span>
                            </div>
                          ) : (
                            <span className="text-xs text-[#526070]">Official results published</span>
                          )}
                        </div>

                        <div className="text-right">
                          <Badge variant="success" size="sm">PUBLISHED</Badge>
                          <span className="text-[10px] text-[#526070] block mt-1">{res.publishedDate}</span>
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            </div>

            <div className="mt-4 pt-3 border-t border-[#E1E7EF] text-right">
              <Link href="/admin/media" className="text-xs text-[#526070] hover:text-[#111111] font-semibold">
                Generate Winners Posters in Studio →
              </Link>
            </div>
          </div>
        </div>

        {/* 5. Top 3 Teams & Quick Actions */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          {/* Top 3 Teams */}
          <div className="lg:col-span-7 bg-white rounded-xl border border-[#E1E7EF] p-5 shadow-xs">
            <div className="flex items-center justify-between pb-3 border-b border-[#E1E7EF]">
              <div className="flex items-center gap-2">
                <Trophy className="w-4 h-4 text-amber-500" />
                <h3 className="text-sm font-bold text-[#111111]">Championship Standings (Top 3)</h3>
              </div>
              <Link href="/admin/teams" className="text-xs text-[#2563EB] hover:underline font-semibold flex items-center gap-1">
                All 4 Teams <ChevronRight className="w-3.5 h-3.5" />
              </Link>
            </div>

            <div className="mt-4 space-y-3">
              {topTeams.map((team, index) => {
                const maxPoints = topTeams[0]?.totalPoints || 150;
                const percent = Math.round((team.totalPoints / maxPoints) * 100);
                return (
                  <div key={team.id} className="p-3.5 rounded-lg border border-[#E1E7EF] bg-white">
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center gap-2.5">
                        <span className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold ${
                          index === 0 ? 'bg-amber-400 text-neutral-900' : index === 1 ? 'bg-slate-300 text-neutral-900' : 'bg-amber-700 text-white'
                        }`}>
                          {index + 1}
                        </span>
                        <div>
                          <span className="text-xs font-bold text-[#111111]">{team.name}</span>
                          <span className="text-[10px] text-[#526070] ml-1.5 font-semibold">({team.code})</span>
                        </div>
                      </div>
                      <div className="text-right">
                        <span className="text-sm font-extrabold text-[#111111]">{team.totalPoints}</span>
                        <span className="text-[10px] text-[#526070] ml-1">pts</span>
                      </div>
                    </div>
                    {/* Progress Bar */}
                    <div className="w-full bg-[#F8FAFC] h-2 rounded-full overflow-hidden border border-[#E1E7EF]">
                      <div
                        className="h-full rounded-full transition-all duration-500"
                        style={{
                          width: `${percent}%`,
                          backgroundColor: team.color || '#2563EB'
                        }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Quick Actions Card */}
          <div className="lg:col-span-5 bg-white rounded-xl border border-[#E1E7EF] p-5 shadow-xs flex flex-col justify-between">
            <div>
              <h3 className="text-sm font-bold text-[#111111] pb-3 border-b border-[#E1E7EF]">
                Administrative Shortcuts
              </h3>
              <div className="mt-4 grid grid-cols-2 gap-3">
                <Link
                  href="/admin/competitions"
                  className="p-3 rounded-lg border border-[#E1E7EF] hover:border-[#2563EB] hover:bg-blue-50/30 transition-all text-left flex flex-col justify-between group"
                >
                  <PlusCircle className="w-5 h-5 text-[#2563EB] mb-2" />
                  <span className="text-xs font-bold text-[#111111] group-hover:text-[#2563EB]">New Competition</span>
                  <span className="text-[10px] text-[#526070]">Configure event</span>
                </Link>

                <Link
                  href="/admin/registration"
                  className="p-3 rounded-lg border border-[#E1E7EF] hover:border-[#2563EB] hover:bg-blue-50/30 transition-all text-left flex flex-col justify-between group"
                >
                  <Users2 className="w-5 h-5 text-[#2563EB] mb-2" />
                  <span className="text-xs font-bold text-[#111111] group-hover:text-[#2563EB]">Register Entry</span>
                  <span className="text-[10px] text-[#526070]">Assign chest #</span>
                </Link>

                <Link
                  href="/admin/mark-entry"
                  className="p-3 rounded-lg border border-[#E1E7EF] hover:border-[#2563EB] hover:bg-blue-50/30 transition-all text-left flex flex-col justify-between group"
                >
                  <Edit3 className="w-5 h-5 text-[#2563EB] mb-2" />
                  <span className="text-xs font-bold text-[#111111] group-hover:text-[#2563EB]">Enter Marks</span>
                  <span className="text-[10px] text-[#526070]">WhatsApp link</span>
                </Link>

                <Link
                  href="/admin/export"
                  className="p-3 rounded-lg border border-[#E1E7EF] hover:border-[#2563EB] hover:bg-blue-50/30 transition-all text-left flex flex-col justify-between group"
                >
                  <FileSpreadsheet className="w-5 h-5 text-[#2563EB] mb-2" />
                  <span className="text-xs font-bold text-[#111111] group-hover:text-[#2563EB]">Export Center</span>
                  <span className="text-[10px] text-[#526070]">PDF / CSV sheet</span>
                </Link>
              </div>
            </div>

            <div className="mt-4 pt-3 border-t border-[#E1E7EF] text-center">
              <span className="text-[11px] text-[#526070]">
                All modules synchronized with live central state
              </span>
            </div>
          </div>
        </div>
      </div>
    </AdminLayout>
  );
}
