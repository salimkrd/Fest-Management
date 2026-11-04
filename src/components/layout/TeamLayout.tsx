'use client';

import React from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import {
  LayoutDashboard,
  Users,
  ClipboardCheck,
  Award,
  LogOut,
  Trophy,
  FileDown
} from 'lucide-react';
import { useFest } from '@/context/FestContext';
import { FestivalLogo, FestivalStatusBadge } from '@/components/domain/FestivalBrand';
import { auth } from '@/lib/firebase/client';
import { signOut } from 'firebase/auth';

interface TeamLayoutProps {
  children: React.ReactNode;
}

export const TeamLayout: React.FC<TeamLayoutProps> = ({ children }) => {
  const pathname = usePathname();
  const router = useRouter();
  const { currentTeamUser, teams, setCurrentTeamUser, theme } = useFest();
  const [checking, setChecking] = React.useState(!currentTeamUser);

  const team = currentTeamUser
    ? teams.find(candidate => candidate.id === currentTeamUser.id) || currentTeamUser
    : null;

  React.useEffect(() => {
    if (!currentTeamUser) {
      router.push('/team/login');
      return;
    }
    if (currentTeamUser.portalAccess === false || (currentTeamUser as any).status === 'DISABLED') {
      router.push('/team/login?error=disabled');
      return;
    }
    setChecking(false);
  }, [currentTeamUser, router]);

  React.useEffect(() => {
    if (!auth) return;
    const clientAuth = auth;
    const unsubscribe = clientAuth.onAuthStateChanged(async (user) => {
      if (!user) {
        setCurrentTeamUser(null);
        router.push('/team/login');
        return;
      }
      try {
        const tokenResult = await user.getIdTokenResult();
        const role = tokenResult.claims.role;
        const teamId = tokenResult.claims.teamId as string;
        if (role !== 'TEAM_MANAGER' && role !== 'ADMIN') {
          await signOut(clientAuth);
          setCurrentTeamUser(null);
          router.push('/team/login');
          return;
        }
        if (currentTeamUser && currentTeamUser.id !== teamId && role !== 'ADMIN') {
          // Cross-team access denied
          await signOut(clientAuth);
          setCurrentTeamUser(null);
          router.push('/team/login');
          return;
        }
      } catch (err) {
        console.warn('[TeamLayout] Token check error:', err);
      }
    });
    return () => unsubscribe();
  }, [currentTeamUser, router, setCurrentTeamUser]);

  const teamNavItems = [
    { name: 'Team Dashboard', href: '/team', icon: LayoutDashboard },
    { name: 'My Participants', href: '/team/participants', icon: Users },
    { name: 'Competition Registration', href: '/team/registration', icon: ClipboardCheck },
    { name: 'Team Results & Standings', href: '/team/results', icon: Award },
    { name: 'Export Page', href: '/team/export', icon: FileDown },
  ];

  if (checking || !team) {
    return (
      <div className="min-h-screen bg-[#F8FAFC] flex items-center justify-center p-4">
        <div className="text-center space-y-2">
          <div className="w-8 h-8 border-2 border-blue-600 border-t-transparent rounded-full animate-spin mx-auto"></div>
          <p className="text-xs text-[#526070] font-medium">Loading Team Contingent Workspace...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex min-h-dvh flex-col bg-slate-50">
      <header className="sticky top-0 z-30 border-b border-slate-200 bg-white/95 shadow-sm backdrop-blur">
        <div className="mx-auto max-w-7xl px-3 sm:px-6 lg:px-8">
          <div className="flex min-h-[68px] items-center justify-between gap-3 py-3">
            <div className="flex min-w-0 flex-1 items-center gap-2.5 sm:gap-3">
              <FestivalLogo size={34} />
              <div
                className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl text-[11px] font-extrabold text-white shadow-sm"
                style={{ backgroundColor: team.color || '#2563EB' }}
                aria-label={`Team code ${team.code}`}
              >
                {team.code}
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex min-w-0 items-center gap-2">
                  <h1 className="truncate text-sm font-bold leading-tight text-slate-950 sm:text-[15px]">
                    {team.name}
                  </h1>
                  <span className="hidden shrink-0 rounded-full border border-blue-100 bg-blue-50 px-2 py-0.5 text-[9px] font-bold uppercase tracking-wide text-blue-700 sm:inline-flex">
                    Contingent
                  </span>
                </div>
                <p className="mt-1 hidden truncate text-[11px] font-medium text-slate-500 sm:block">
                  <span className="festival-name">{theme.festivalName}</span>
                  <span className="px-1.5 text-slate-300">·</span>
                  {theme.institutionName}
                </p>
                <p className="mt-1 truncate text-[10px] font-medium text-slate-500 sm:hidden">
                  <span className="festival-name">{theme.festivalName}</span>
                </p>
              </div>
            </div>

            <div className="flex shrink-0 items-center gap-2 sm:gap-3">
              <FestivalStatusBadge className="hidden md:inline-flex" />

              <div className="hidden items-center gap-3 rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-xs lg:flex">
                <div className="flex items-center gap-1.5">
                  <Trophy className="h-3.5 w-3.5 text-amber-500" />
                  <span className="text-slate-500">Rank</span>
                  <span className="font-bold text-slate-900">#{team.rank || 1}</span>
                </div>
                <span className="h-4 w-px bg-slate-200" />
                <div>
                  <span className="text-slate-500">Points</span>
                  <span className="ml-1.5 font-bold text-blue-700">{team.totalPoints ?? 0}</span>
                </div>
              </div>

              <span className="hidden max-w-40 truncate rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-700 sm:inline-flex">
                {team.name} ({team.code})
              </span>

              <button
                type="button"
                onClick={async () => {
                  if (auth) {
                    try {
                      await signOut(auth);
                    } catch (error) {
                      console.warn('Sign out error:', error);
                    }
                  }
                  setCurrentTeamUser(null);
                  router.push('/team/login');
                }}
                aria-label="Sign out of Team Workspace"
                title="Sign out"
                className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-slate-200 bg-white text-slate-600 transition hover:border-red-200 hover:bg-red-50 hover:text-red-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
              >
                <LogOut className="h-4 w-4" />
              </button>
            </div>
          </div>

          <nav aria-label="Team Manager navigation" className="-mx-3 flex items-center gap-1 overflow-x-auto border-t border-slate-100 px-3 sm:mx-0 sm:px-0">
            {teamNavItems.map(item => {
              const isActive = pathname === item.href;
              const Icon = item.icon;
              return (
                <Link
                  key={item.name}
                  href={item.href}
                  aria-current={isActive ? 'page' : undefined}
                  className={`flex min-h-12 shrink-0 items-center gap-2 border-b-2 px-3 py-3 text-xs font-semibold whitespace-nowrap transition-colors sm:px-4 ${
                    isActive
                      ? 'border-blue-600 bg-blue-50/60 text-blue-700'
                      : 'border-transparent text-slate-500 hover:border-slate-300 hover:bg-slate-50 hover:text-slate-900'
                  }`}
                >
                  <Icon className="h-4 w-4" />
                  <span>{item.name}</span>
                </Link>
              );
            })}
          </nav>
        </div>
      </header>

      <main className="mx-auto w-full max-w-7xl flex-1 px-3 py-5 sm:px-6 sm:py-7 lg:px-8 lg:py-8">
        {children}
      </main>
    </div>
  );
};
