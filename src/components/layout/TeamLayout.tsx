'use client';

import React from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import {
  LayoutDashboard,
  Users,
  ClipboardCheck,
  Award,
  Shield,
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
  const { currentTeamUser, setCurrentTeamUser, theme } = useFest();
  const [checking, setChecking] = React.useState(!currentTeamUser);

  const team = currentTeamUser;

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
    <div className="min-h-screen bg-[#F8FAFC] flex flex-col">
      {/* Top Banner with Team Badge */}
      <header className="bg-white border-b border-[#E1E7EF] sticky top-0 z-30">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            <div className="flex items-center gap-3">
              <FestivalLogo size={36} />
              <div
                className="w-9 h-9 rounded-xl flex items-center justify-center text-white font-extrabold text-xs shadow-xs"
                style={{ backgroundColor: team?.color || '#2563EB' }}
              >
                {team?.code}
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h1 className="text-sm font-bold text-[#111111] leading-none">
                    {team?.name}
                  </h1>
                  <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-blue-50 text-[#2563EB] border border-blue-200">
                    CONTINGENT
                  </span>
                </div>
                <span className="text-[11px] text-[#526070] font-medium">
                  <span className="festival-name">{theme.festivalName}</span> · {theme.institutionName}
                </span>
              </div>
            </div>

            {/* Right Team Stats & Controls */}
            <FestivalStatusBadge className="hidden md:inline-flex" />
            <div className="flex items-center gap-4">
              <div className="hidden sm:flex items-center gap-3 bg-[#F8FAFC] px-3.5 py-1.5 rounded-lg border border-[#E1E7EF] text-xs">
                <div className="flex items-center gap-1.5">
                  <Trophy className="w-3.5 h-3.5 text-amber-500" />
                  <span className="text-[#526070]">Rank:</span>
                  <span className="font-extrabold text-[#111111]">#{team?.rank}</span>
                </div>
                <div className="w-px h-3 bg-neutral-300" />
                <div>
                  <span className="text-[#526070]">Total Points:</span>{' '}
                  <span className="font-extrabold text-[#2563EB]">{team?.totalPoints}</span>
                </div>
              </div>

              {/* Authenticated Team Contingent Display */}
              <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg border border-[#E1E7EF] bg-white text-xs font-bold text-[#111111]">
                <span className="w-2 h-2 rounded-full bg-emerald-500 shrink-0"></span>
                <span>{team?.name} ({team?.code})</span>
              </div>

              <button
                type="button"
                onClick={async () => {
                  if (auth) {
                    try {
                      await signOut(auth);
                    } catch (e) {
                      console.warn('Sign out error:', e);
                    }
                  }
                  setCurrentTeamUser(null);
                  router.push('/team/login');
                }}
                className="p-2 rounded-lg text-[#526070] hover:text-[#DC2626] hover:bg-red-50 transition-colors"
                title="Sign out of Team Workspace"
              >
                <LogOut className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* Navigation Tabs Bar */}
          <div className="flex space-x-1 border-t border-[#E1E7EF] pt-1 overflow-x-auto">
            {teamNavItems.map((item) => {
              const isActive = pathname === item.href;
              const Icon = item.icon;
              return (
                <Link
                  key={item.name}
                  href={item.href}
                  className={`flex items-center gap-2 py-3 px-4 border-b-2 font-semibold text-xs transition-colors whitespace-nowrap ${
                    isActive
                      ? 'border-[#2563EB] text-[#2563EB]'
                      : 'border-transparent text-[#526070] hover:text-[#111111] hover:border-neutral-300'
                  }`}
                >
                  <Icon className="w-4 h-4" />
                  <span>{item.name}</span>
                </Link>
              );
            })}
          </div>
        </div>
      </header>

      {/* Main Container */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 flex-1 w-full">
        {children}
      </main>
    </div>
  );
};
