'use client';

import React from 'react';
import Link from 'next/link';
import { useFest } from '@/context/FestContext';
import { FestivalLogo, FestivalStatusBadge } from '@/components/domain/FestivalBrand';
import {
  ShieldAlert,
  Users2,
  IdCard,
  Gavel,
  Sparkles,
  ArrowRight,
  Trophy,
  CheckCircle2,
  Calendar,
  Layers,
  MapPin
} from 'lucide-react';

export default function HomePage() {
  const { theme, teams, competitions, participants, results } = useFest();

  const publishedCount = results.filter(r => r.resultStatus === 'PUBLISHED').length;

  return (
    <div className="min-h-screen bg-[#F8FAFC] flex flex-col justify-between">
      {/* Top Banner */}
      <header className="bg-white border-b border-[#E1E7EF] py-4 px-6 sm:px-12">
        <div className="max-w-6xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-3">
            <FestivalLogo size={40} />
            <div>
              <h1 className="text-base font-extrabold text-[#111111] tracking-tight leading-tight">
                {theme.festivalName}
              </h1>
              <p className="text-xs text-[#526070] font-medium">{theme.institutionName} · Single-Fest System</p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <FestivalStatusBadge />
          </div>
        </div>
      </header>

      {/* Hero Welcome */}
      <main className="max-w-6xl mx-auto px-6 py-12 flex-1 w-full">
        <div className="text-center max-w-2xl mx-auto mb-12">
          <span className="text-xs font-extrabold uppercase tracking-widest text-[#2563EB] bg-blue-50 px-3 py-1 rounded-full border border-blue-200">
            Unified Festival Operations Platform
          </span>
          <h2 className="text-3xl sm:text-4xl font-extrabold text-[#111111] tracking-tight mt-4">
            Fest Management System
          </h2>
          <p className="mt-2 text-sm text-[#526070] leading-relaxed">
            Select your operational role below to enter the portal. Administrative controls, team registrations, judge score entry, and public results are synchronized in real-time.
          </p>

          {/* Quick Metrics */}
          <div className="mt-6 flex flex-wrap items-center justify-center gap-6 text-xs text-[#526070] font-semibold">
            <span className="flex items-center gap-1.5">
              <Users2 className="w-4 h-4 text-[#2563EB]" /> {participants.length} Contestants
            </span>
            <span>•</span>
            <span className="flex items-center gap-1.5">
              <Trophy className="w-4 h-4 text-[#D97706]" /> {competitions.length} Competitions
            </span>
            <span>•</span>
            <span className="flex items-center gap-1.5">
              <CheckCircle2 className="w-4 h-4 text-emerald-600" /> {publishedCount} Results Published
            </span>
          </div>
        </div>

        {/* Festival Portals Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 max-w-4xl mx-auto">
          {/* 1. Admin Portal */}
          <Link
            href="/admin"
            className="group p-6 bg-white rounded-2xl border border-[#E1E7EF] shadow-xs hover:border-[#2563EB] hover:shadow-md transition-all flex flex-col justify-between"
          >
            <div>
              <div className="flex items-center justify-between">
                <div className="w-12 h-12 rounded-xl bg-blue-50 border border-blue-100 flex items-center justify-center text-[#2563EB] group-hover:scale-105 transition-transform">
                  <ShieldAlert className="w-6 h-6" />
                </div>
                <span className="text-[10px] font-bold px-2 py-0.5 rounded uppercase bg-blue-50 text-[#2563EB] border border-blue-200">
                  Full Authority
                </span>
              </div>
              <h3 className="text-lg font-bold text-[#111111] mt-4 group-hover:text-[#2563EB] transition-colors">
                Admin Control Center
              </h3>
              <p className="text-xs text-[#526070] mt-1.5 leading-relaxed">
                Access the 12 core administrative pages: Categories, Teams, Competitions, Registration, Mark Entry, Result Verification, Stages, Schedules, Media Studio, and Data Export.
              </p>
            </div>
            <div className="mt-6 pt-4 border-t border-[#E1E7EF] flex items-center justify-between text-xs font-bold text-[#2563EB]">
              <span>Enter Admin Dashboard</span>
              <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
            </div>
          </Link>

          {/* 2. Team Manager Portal */}
          <Link
            href="/team"
            className="group p-6 bg-white rounded-2xl border border-[#E1E7EF] shadow-xs hover:border-emerald-600 hover:shadow-md transition-all flex flex-col justify-between"
          >
            <div>
              <div className="flex items-center justify-between">
                <div className="w-12 h-12 rounded-xl bg-emerald-50 border border-emerald-100 flex items-center justify-center text-emerald-600 group-hover:scale-105 transition-transform">
                  <Users2 className="w-6 h-6" />
                </div>
                <span className="text-[10px] font-bold px-2 py-0.5 rounded uppercase bg-emerald-50 text-emerald-700 border border-emerald-200">
                  Contingents
                </span>
              </div>
              <h3 className="text-lg font-bold text-[#111111] mt-4 group-hover:text-emerald-600 transition-colors">
                Team Manager Workspace
              </h3>
              <p className="text-xs text-[#526070] mt-1.5 leading-relaxed">
                Dedicated workspace for house managers: register team contestants, enroll squad members in stage &amp; off-stage competitions, generate digital ID cards, and review scores.
              </p>
            </div>
            <div className="mt-6 pt-4 border-t border-[#E1E7EF] flex items-center justify-between text-xs font-bold text-emerald-700">
              <span>Enter Team Workspace</span>
              <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
            </div>
          </Link>

          {/* 3. Judge Portal */}
          <Link
            href="/judge/login"
            className="group p-6 bg-white rounded-2xl border border-[#E1E7EF] shadow-xs hover:border-neutral-900 hover:shadow-md transition-all flex flex-col justify-between"
          >
            <div>
              <div className="flex items-center justify-between">
                <div className="w-12 h-12 rounded-xl bg-neutral-100 border border-neutral-200 flex items-center justify-center text-neutral-800 group-hover:scale-105 transition-transform">
                  <Gavel className="w-6 h-6" />
                </div>
                <span className="text-[10px] font-bold px-2 py-0.5 rounded uppercase bg-neutral-100 text-neutral-800 border border-neutral-300">
                  Jury Session
                </span>
              </div>
              <h3 className="text-lg font-bold text-[#111111] mt-4 group-hover:text-neutral-900 transition-colors">
                Judge Secure Evaluation
              </h3>
              <p className="text-xs text-[#526070] mt-1.5 leading-relaxed">
                Stage roster scoring sheet: input marks with criteria steppers, auto-tally totals, sign off evaluation rosters, and generate official cryptographically sealed receipts.
              </p>
            </div>
            <div className="mt-6 pt-4 border-t border-[#E1E7EF] flex items-center justify-between text-xs font-bold text-[#111111]">
              <span>Authenticate Jury Link</span>
              <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
            </div>
          </Link>

          {/* 4. Public Result Website */}
          <Link
            href="/"
            className="group p-6 bg-white rounded-2xl border border-[#E1E7EF] shadow-xs hover:border-amber-500 hover:shadow-md transition-all flex flex-col justify-between"
          >
            <div>
              <div className="flex items-center justify-between">
                <div className="w-12 h-12 rounded-xl bg-amber-50 border border-amber-100 flex items-center justify-center text-amber-600 group-hover:scale-105 transition-transform">
                  <Sparkles className="w-6 h-6" />
                </div>
                <span className="text-[10px] font-bold px-2 py-0.5 rounded uppercase bg-amber-50 text-amber-800 border border-amber-200">
                  Public Domain
                </span>
              </div>
              <h3 className="text-lg font-bold text-[#111111] mt-4 group-hover:text-amber-600 transition-colors">
                Public Results &amp; Championship
              </h3>
              <p className="text-xs text-[#526070] mt-1.5 leading-relaxed">
                Themed public experience: live contestant search, published winners feed, laureate podiums, released media posters, and official team championship leaderboard.
              </p>
            </div>
            <div className="mt-6 pt-4 border-t border-[#E1E7EF] flex items-center justify-between text-xs font-bold text-amber-700">
              <span>View Public Portal</span>
              <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
            </div>
          </Link>

          {/* 5. Participant Portal */}
          <Link
            href="/participant/login"
            className="group p-6 bg-white rounded-2xl border border-[#E1E7EF] shadow-xs hover:border-[#2563EB] hover:shadow-md transition-all flex flex-col justify-between"
          >
            <div>
              <div className="flex items-center justify-between">
                <div className="w-12 h-12 rounded-xl bg-blue-50 border border-blue-100 text-[#2563EB] group-hover:scale-105 transition-transform flex items-center justify-center">
                  <IdCard className="w-6 h-6" />
                </div>
                <span className="text-[10px] font-bold px-2 py-0.5 rounded uppercase bg-blue-50 text-blue-800 border border-blue-200">
                  Personal Access
                </span>
              </div>
              <h3 className="text-lg font-bold text-[#111111] mt-4 group-hover:text-[#2563EB] transition-colors">
                Participant Portal
              </h3>
              <p className="text-xs text-[#526070] mt-1.5 leading-relaxed">
                Sign in with your short Bib Number and Date of Birth to view your competitions, published results,
                individual points, and digitally verified participant ID card.
              </p>
            </div>
            <div className="mt-6 pt-4 border-t border-[#E1E7EF] flex items-center justify-between text-xs font-bold text-[#2563EB]">
              <span>Participant Login</span>
              <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
            </div>
          </Link>
        </div>
      </main>

      {/* Footer */}
      <footer className="bg-white border-t border-[#E1E7EF] py-4 text-center text-xs text-[#526070]">
        <span>{theme.institutionName} · {theme.festivalName} · Single-Organization Fest v2.0</span>
      </footer>
    </div>
  );
}
