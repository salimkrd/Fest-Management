'use client';

import React from 'react';
import Link from 'next/link';
import { TeamLayout } from '@/components/layout/TeamLayout';
import { useFest } from '@/context/FestContext';
import { StatCard } from '@/components/ui/StatCard';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import {
  Users,
  Trophy,
  ClipboardList,
  Award,
  PlusCircle,
  Calendar,
  IdCard,
  ChevronRight,
  ArrowRight,
  Sparkles
} from 'lucide-react';

export default function TeamManagerDashboardPage() {
  const { currentTeamUser, teams, participants, registrations, schedules, results } = useFest();
  const team = currentTeamUser
    ? teams.find(candidate => candidate.id === currentTeamUser.id) || currentTeamUser
    : null;

  // Scoped team data
  const teamParticipants = participants.filter(p => p.teamId === team?.id);
  const teamRegistrations = registrations.filter(r => r.teamId === team?.id);

  // Team upcoming schedules
  const upcomingTeamEvents = schedules.filter(s => {
    return teamRegistrations.some(r => r.competitionId === s.competitionId);
  }).slice(0, 4);

  // Recent Activity
  const recentTeamRegistrations = [...teamRegistrations].reverse().slice(0, 4);

  return (
    <TeamLayout>
      <div className="space-y-8">
        {/* Welcome Banner */}
        <div className="bg-white rounded-2xl border border-[#E1E7EF] p-6 shadow-xs flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2">
              <span
                className="w-3 h-3 rounded-full"
                style={{ backgroundColor: team?.color || '#2563EB' }}
              />
              <span className="text-xs font-bold uppercase tracking-wider text-[#526070]">
                {team?.zone} · House Contingent
              </span>
            </div>
            <h1 className="text-xl sm:text-2xl font-black text-[#111111] tracking-tight mt-1">
              {team?.name} ({team?.code}) Workspace
            </h1>
            <p className="text-xs text-[#526070] mt-0.5">
              Team Manager: {team?.managerName} · Contact: {team?.managerPhone}
            </p>
          </div>

          <div className="flex items-center gap-3">
            <Link href="/team/registration">
              <Button variant="primary" size="sm" leftIcon={<PlusCircle className="w-4 h-4" />}>
                Register Contestant in Event
              </Button>
            </Link>
          </div>
        </div>

        {/* 4 Team Metrics */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <StatCard
            label="Total Contestants"
            value={teamParticipants.length}
            subValue="Roster members"
            icon={<Users className="w-4 h-4" />}
          />
          <StatCard
            label="Event Registrations"
            value={teamRegistrations.length}
            subValue="Solo &amp; Group entries"
            icon={<ClipboardList className="w-4 h-4" />}
          />
          <StatCard
            label="Championship Points"
            value={team?.totalPoints || 0}
            subValue={`Solo: ${team?.soloPoints} | Group: ${team?.groupPoints}`}
            icon={<Trophy className="w-4 h-4 text-amber-500" />}
          />
          <StatCard
            label="Leaderboard Rank"
            value={`#${team?.rank || 1}`}
            subValue="Live standings"
            icon={<Award className="w-4 h-4 text-[#2563EB]" />}
            badge={team?.rank === 1 ? 'LEADER' : undefined}
          />
        </div>

        {/* Two Column Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          {/* Upcoming Team Competitions */}
          <div className="lg:col-span-7 bg-white rounded-xl border border-[#E1E7EF] p-5 shadow-xs flex flex-col justify-between">
            <div>
              <div className="flex items-center justify-between pb-3 border-b border-[#E1E7EF]">
                <div className="flex items-center gap-2">
                  <Calendar className="w-4 h-4 text-[#2563EB]" />
                  <h3 className="text-sm font-bold text-[#111111]">Upcoming Team Competitions</h3>
                </div>
                <Link href="/team/registration" className="text-xs text-[#2563EB] hover:underline font-semibold flex items-center gap-1">
                  All Registrations <ChevronRight className="w-3.5 h-3.5" />
                </Link>
              </div>

              <div className="mt-4 space-y-3">
                {upcomingTeamEvents.length === 0 ? (
                  <p className="text-xs text-[#526070] italic py-6 text-center">
                    No active schedule slots found for enrolled competitions.
                  </p>
                ) : (
                  upcomingTeamEvents.map(slot => (
                    <div
                      key={slot.id}
                      className="p-3.5 rounded-lg border border-[#E1E7EF] bg-[#F8FAFC] flex items-center justify-between"
                    >
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="text-xs font-bold text-[#111111]">{slot.competitionName}</span>
                          <span className="text-[10px] font-bold px-1.5 py-0.2 rounded bg-blue-50 text-[#2563EB]">
                            {slot.categoryName}
                          </span>
                        </div>
                        <span className="text-[11px] text-[#526070] block mt-1">
                          Stage: {slot.stageName} · {slot.date}
                        </span>
                      </div>
                      <div className="text-right">
                        <span className="text-xs font-mono font-bold text-[#111111]">{slot.startTime}</span>
                        <span className="text-[10px] text-[#526070] block">{slot.status}</span>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>

            <div className="mt-4 pt-3 border-t border-[#E1E7EF] text-right">
              <Link href="/team/participants" className="text-xs text-[#526070] hover:text-[#111111] font-semibold">
                View My Team Participants Roster →
              </Link>
            </div>
          </div>

          {/* Quick Actions & Recent Activity */}
          <div className="lg:col-span-5 space-y-6">
            {/* Quick Actions */}
            <div className="bg-white rounded-xl border border-[#E1E7EF] p-5 shadow-xs">
              <h3 className="text-sm font-bold text-[#111111] pb-3 border-b border-[#E1E7EF]">
                Quick Operations
              </h3>
              <div className="mt-3 space-y-2">
                <Link
                  href="/team/participants"
                  className="p-3 rounded-lg border border-[#E1E7EF] hover:border-[#2563EB] hover:bg-blue-50/20 transition-all flex items-center justify-between group"
                >
                  <div className="flex items-center gap-3">
                    <Users className="w-4 h-4 text-[#2563EB]" />
                    <span className="text-xs font-bold text-[#111111] group-hover:text-[#2563EB]">
                      Add New Team Participant
                    </span>
                  </div>
                  <ChevronRight className="w-4 h-4 text-[#526070]" />
                </Link>

                <Link
                  href="/team/registration"
                  className="p-3 rounded-lg border border-[#E1E7EF] hover:border-[#2563EB] hover:bg-blue-50/20 transition-all flex items-center justify-between group"
                >
                  <div className="flex items-center gap-3">
                    <ClipboardList className="w-4 h-4 text-[#2563EB]" />
                    <span className="text-xs font-bold text-[#111111] group-hover:text-[#2563EB]">
                      Enroll Contestant into Event
                    </span>
                  </div>
                  <ChevronRight className="w-4 h-4 text-[#526070]" />
                </Link>

                <Link
                  href="/team/results"
                  className="p-3 rounded-lg border border-[#E1E7EF] hover:border-[#2563EB] hover:bg-blue-50/20 transition-all flex items-center justify-between group"
                >
                  <div className="flex items-center gap-3">
                    <Award className="w-4 h-4 text-[#2563EB]" />
                    <span className="text-xs font-bold text-[#111111] group-hover:text-[#2563EB]">
                      Review Scores &amp; Points Breakdown
                    </span>
                  </div>
                  <ChevronRight className="w-4 h-4 text-[#526070]" />
                </Link>
              </div>
            </div>

            {/* Recent Registration Activity */}
            <div className="bg-white rounded-xl border border-[#E1E7EF] p-5 shadow-xs">
              <h3 className="text-sm font-bold text-[#111111] pb-3 border-b border-[#E1E7EF]">
                Recent Team Activity
              </h3>
              <div className="mt-3 space-y-2.5">
                {recentTeamRegistrations.map(r => (
                  <div key={r.id} className="text-xs flex items-center justify-between p-2 rounded-lg bg-[#F8FAFC]">
                    <div>
                      <span className="font-bold text-[#111111]">{r.participantName}</span>
                      <span className="text-[#526070] text-[11px] block">{r.competitionName}</span>
                    </div>
                    <Badge variant="success" size="sm">CONFIRMED</Badge>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>
    </TeamLayout>
  );
}
