'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import {
  LayoutDashboard,
  Layers,
  Users2,
  Trophy,
  UserCheck,
  ClipboardList,
  DoorOpen,
  Edit3,
  Award,
  MapPin,
  CalendarDays,
  Image as ImageIcon,
  FileDown,
  ExternalLink,
  Menu,
  X,
  Sparkles,
  LogOut,
  LoaderCircle,
  ChevronRight,
} from 'lucide-react';
import { useFest } from '@/context/FestContext';
import { FestivalLogo, FestivalStatusBadge } from '@/components/domain/FestivalBrand';
import { auth, db } from '@/lib/firebase/client';
import { onAuthStateChanged, signOut, User } from 'firebase/auth';
import { doc, getDoc } from 'firebase/firestore';

interface AdminLayoutProps {
  children: React.ReactNode;
}

const navGroups = [
  {
    label: 'Workspace',
    items: [
      { name: 'Dashboard', href: '/admin', icon: LayoutDashboard },
    ],
  },
  {
    label: 'Festival setup',
    items: [
      { name: 'Categories', href: '/admin/categories', icon: Layers },
      { name: 'Teams', href: '/admin/teams', icon: Users2 },
      { name: 'Competitions', href: '/admin/competitions', icon: Trophy },
      { name: 'Participants', href: '/admin/participants', icon: UserCheck },
      { name: 'Registration', href: '/admin/registration', icon: ClipboardList },
    ],
  },
  {
    label: 'Live operations',
    items: [
      { name: 'Green Room', href: '/admin/green-room', icon: DoorOpen },
      { name: 'Mark Entry', href: '/admin/mark-entry', icon: Edit3 },
      { name: 'Results', href: '/admin/results', icon: Award },
      { name: 'Stages', href: '/admin/stages', icon: MapPin },
      { name: 'Schedule', href: '/admin/schedule', icon: CalendarDays },
    ],
  },
  {
    label: 'Insights & tools',
    items: [
      { name: 'Media', href: '/admin/media', icon: ImageIcon },
      { name: 'Export', href: '/admin/export', icon: FileDown },
      { name: 'Top Scorers', href: '/admin/top-scorers', icon: Trophy },
    ],
  },
];

export const AdminLayout: React.FC<AdminLayoutProps> = ({ children }) => {
  const pathname = usePathname();
  const router = useRouter();
  const { theme } = useFest();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [authorizedUser, setAuthorizedUser] = useState<User | null>(null);
  const [userRole, setUserRole] = useState<'ADMIN' | 'GREEN_ROOM_STAFF' | null>(null);
  const [authChecking, setAuthChecking] = useState<boolean>(true);
  const [signingOut, setSigningOut] = useState(false);

  useEffect(() => {
    if (!auth) {
      setAuthChecking(false);
      router.replace('/admin/login');
      return;
    }

    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      if (!user) {
        setAuthorizedUser(null);
        setUserRole(null);
        setAuthChecking(false);
        router.replace('/admin/login');
        return;
      }

      try {
        let tokenResult = await user.getIdTokenResult();
        let role = tokenResult.claims.role as string | undefined;

        if (role !== 'ADMIN' && role !== 'GREEN_ROOM_STAFF') {
          try {
            const syncRes = await fetch('/api/auth/sync-claims', {
              method: 'POST',
              headers: { Authorization: 'Bearer ' + await user.getIdToken() }
            });
            if (syncRes.ok) {
              tokenResult = await user.getIdTokenResult(true);
              role = tokenResult.claims.role as string | undefined;
            }
          } catch (syncErr) {
            console.warn('[AdminLayout] Claims auto-sync attempt error:', syncErr);
          }
        }

        if (role !== 'ADMIN' && role !== 'GREEN_ROOM_STAFF') {
          console.warn('[AdminLayout] User is missing ADMIN or GREEN_ROOM_STAFF claim.');
          if (auth) await signOut(auth);
          setAuthorizedUser(null);
          setUserRole(null);
          setAuthChecking(false);
          router.replace('/admin/login');
          return;
        }

        // Validate authoritative Firestore user document.
        if (db) {
          const userDocSnap = await getDoc(doc(db, 'users', user.uid));
          if (!userDocSnap.exists()) {
            console.warn('[AdminLayout] Authoritative user document missing.');
            if (auth) await signOut(auth);
            setAuthorizedUser(null);
            setUserRole(null);
            setAuthChecking(false);
            router.replace('/admin/login');
            return;
          }

          const userData = userDocSnap.data();
          const docRole = userData?.role;
          if (
            (docRole !== 'ADMIN' && docRole !== 'GREEN_ROOM_STAFF') ||
            userData?.status !== 'ACTIVE' ||
            userData?.disabled === true
          ) {
            console.warn('[AdminLayout] User profile inactive, disabled, or unauthorized role.');
            if (auth) await signOut(auth);
            setAuthorizedUser(null);
            setUserRole(null);
            setAuthChecking(false);
            router.replace('/admin/login');
            return;
          }
        }

        const effectiveRole = role as 'ADMIN' | 'GREEN_ROOM_STAFF';
        setAuthorizedUser(user);
        setUserRole(effectiveRole);
        setAuthChecking(false);

        // GREEN_ROOM_STAFF is restricted to the Green Room workspace.
        if (effectiveRole === 'GREEN_ROOM_STAFF' && pathname && !pathname.startsWith('/admin/green-room')) {
          router.replace('/admin/green-room');
        }
      } catch (authErr) {
        console.warn('[AdminLayout] Auth verification error:', authErr);
        if (auth) await signOut(auth);
        setAuthorizedUser(null);
        setUserRole(null);
        setAuthChecking(false);
        router.replace('/admin/login');
      }
    });

    return () => unsubscribe();
  }, [router, pathname]);

  // Close the mobile drawer after navigation so it never remains over the new page.
  useEffect(() => {
    setMobileMenuOpen(false);
  }, [pathname]);

  // Keep the page from scrolling behind the drawer and support the Escape key.
  useEffect(() => {
    if (!mobileMenuOpen) return;

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setMobileMenuOpen(false);
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [mobileMenuOpen]);

  const handleSignOut = async () => {
    if (signingOut) return;
    setSigningOut(true);

    try {
      if (auth) if (auth) await signOut(auth);
      setAuthorizedUser(null);
      setMobileMenuOpen(false);
      router.replace('/admin/login');
      router.refresh();
    } catch (err) {
      console.warn('[AdminLayout] Sign out error:', err);
      setSigningOut(false);
    }
  };

  const filteredGroups = userRole === 'GREEN_ROOM_STAFF'
    ? navGroups
      .map(group => ({
        ...group,
        items: group.items.filter(item => item.href === '/admin/green-room'),
      }))
      .filter(group => group.items.length > 0)
    : navGroups;

  const isItemActive = (href: string) =>
    pathname === href || (href !== '/admin' && Boolean(pathname?.startsWith(href + '/')));

  const currentPage = filteredGroups.flatMap(group => group.items).find(item => isItemActive(item.href));
  const userInitials = authorizedUser?.email
    ? authorizedUser.email.slice(0, 2).toUpperCase()
    : 'AD';
  const roleLabel = userRole === 'GREEN_ROOM_STAFF' ? 'Green Room Staff' : 'Chief Administrator';

  const renderNavigation = (mobile = false) => (
    <nav aria-label="Admin navigation" className={mobile ? 'min-h-0 flex-1 overflow-y-auto px-3 py-4' : 'min-h-0 flex-1 overflow-y-auto px-3 py-5'}>
      <div className="space-y-5">
        {filteredGroups.map(group => (
          <section key={group.label} aria-label={group.label}>
            <p className="mb-2 px-3 text-[10px] font-bold uppercase tracking-[0.16em] text-slate-400">
              {group.label}
            </p>
            <div className="space-y-1">
              {group.items.map(item => {
                const active = isItemActive(item.href);
                const Icon = item.icon;
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    onClick={mobile ? () => setMobileMenuOpen(false) : undefined}
                    aria-current={active ? 'page' : undefined}
                    className={
                      'group relative flex min-h-10 items-center gap-3 rounded-xl px-3 py-2.5 text-[13px] font-semibold transition-colors duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-400 focus-visible:ring-offset-2 focus-visible:ring-offset-slate-950 ' +
                      (active
                        ? 'bg-blue-600 text-white shadow-sm shadow-blue-950/20'
                        : 'text-slate-300 hover:bg-slate-800 hover:text-white')
                    }
                  >
                    <Icon className={'h-[18px] w-[18px] shrink-0 transition-colors ' + (active ? 'text-white' : 'text-slate-400 group-hover:text-white')} strokeWidth={1.9} aria-hidden="true" />
                    <span className="min-w-0 flex-1">{item.name}</span>
                    {active ? (
                      <ChevronRight className="h-4 w-4 shrink-0 text-blue-100" aria-hidden="true" />
                    ) : null}
                  </Link>
                );
              })}
            </div>
          </section>
        ))}
      </div>
    </nav>
  );

  const renderUserPanel = (mobile = false) => (
    <div className={mobile ? 'border-t border-slate-800 bg-slate-950 p-4' : 'border-t border-slate-800 bg-slate-900/70 p-4'}>
      <div className="flex min-w-0 items-center gap-3">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-blue-500/15 text-xs font-bold text-blue-200 ring-1 ring-inset ring-blue-400/20">
          {userInitials}
        </div>
        <div className="min-w-0 flex-1">
          <p className="truncate text-xs font-bold text-white">{roleLabel}</p>
          <p className="mt-0.5 truncate text-[11px] text-slate-400">{authorizedUser?.email || 'Administrator account'}</p>
        </div>
      </div>
      <button
        type="button"
        onClick={handleSignOut}
        disabled={signingOut}
        className="mt-3 inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-xl border border-rose-400/20 bg-rose-500/10 px-4 py-2.5 text-sm font-semibold text-rose-200 transition-colors hover:border-rose-300/40 hover:bg-rose-500/20 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rose-300 focus-visible:ring-offset-2 focus-visible:ring-offset-slate-950 disabled:cursor-wait disabled:opacity-60"
      >
        {signingOut ? (
          <LoaderCircle className="h-4 w-4 animate-spin" aria-hidden="true" />
        ) : (
          <LogOut className="h-4 w-4" aria-hidden="true" />
        )}
        {signingOut ? 'Signing out…' : 'Sign out'}
      </button>
    </div>
  );

  if (authChecking) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center bg-slate-50 p-4">
        <div className="flex flex-col items-center gap-3">
          <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-blue-600 text-lg font-bold text-white shadow-lg shadow-blue-600/20">
            <FestivalLogo size={28} />
          </div>
          <p className="text-xs font-semibold tracking-wide text-slate-500">
            Verifying administrator session…
          </p>
        </div>
      </div>
    );
  }

  if (!authorizedUser) return null;

  return (
    <div className="flex min-h-screen bg-[#F5F7FB] text-slate-900">
      {/* Desktop navigation */}
      <aside className="sticky top-0 hidden h-screen w-[272px] shrink-0 flex-col bg-slate-950 text-white lg:flex xl:w-[288px]">
        <div className="flex h-[76px] shrink-0 items-center border-b border-slate-800 px-5">
          <Link href="/admin" className="flex min-w-0 items-center gap-3 rounded-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-400">
            <FestivalLogo size={40} className="rounded-xl" />
            <span className="min-w-0">
              <span className="festival-name block truncate text-sm font-extrabold tracking-tight text-white">
                {theme.festivalName}
              </span>
              <span className="mt-0.5 block text-[10px] font-semibold uppercase tracking-[0.16em] text-slate-400">
                Admin workspace
              </span>
            </span>
          </Link>
        </div>
        {renderNavigation()}
        {renderUserPanel()}
      </aside>

      {/* Main workspace */}
      <div className="flex min-w-0 flex-1 flex-col">
        <header className="sticky top-0 z-30 flex min-h-[68px] items-center justify-between gap-3 border-b border-slate-200 bg-white/95 px-3 shadow-sm shadow-slate-900/[0.02] backdrop-blur sm:px-5 lg:px-8">
          <div className="flex min-w-0 items-center gap-3">
            <button
              type="button"
              onClick={() => setMobileMenuOpen(true)}
              className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-slate-200 bg-white text-slate-600 transition-colors hover:bg-slate-50 hover:text-slate-950 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-600 focus-visible:ring-offset-2 lg:hidden"
              aria-label="Open navigation menu"
              aria-expanded={mobileMenuOpen}
              aria-controls="admin-mobile-navigation"
            >
              <Menu className="h-5 w-5" aria-hidden="true" />
            </button>
            <div className="min-w-0">
              <p className="truncate text-sm font-bold text-slate-900 sm:text-base">
                {currentPage?.name || 'Admin workspace'}
              </p>
              <p className="hidden truncate text-[11px] text-slate-500 sm:block">
                {theme.institutionName}
              </p>
            </div>
          </div>

          <div className="flex shrink-0 items-center gap-2 sm:gap-3">
            <FestivalStatusBadge className="hidden md:inline-flex" />
            <Link
              href="/"
              target="_blank"
              rel="noreferrer"
              className="inline-flex h-10 items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-2.5 text-xs font-semibold text-slate-700 transition-colors hover:border-slate-300 hover:bg-slate-50 hover:text-slate-950 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-600 focus-visible:ring-offset-2 sm:px-3.5"
            >
              <Sparkles className="h-4 w-4 text-amber-500" aria-hidden="true" />
              <span className="hidden sm:inline">Public view</span>
              <ExternalLink className="hidden h-3.5 w-3.5 text-slate-400 sm:inline" aria-hidden="true" />
            </Link>
            <button
              type="button"
              onClick={handleSignOut}
              disabled={signingOut}
              className="inline-flex h-10 w-10 items-center justify-center rounded-xl border border-rose-200 bg-rose-50 text-rose-700 transition-colors hover:border-rose-300 hover:bg-rose-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rose-500 focus-visible:ring-offset-2 disabled:cursor-wait disabled:opacity-60 lg:hidden"
              aria-label={signingOut ? 'Signing out' : 'Sign out'}
              title="Sign out"
            >
              {signingOut ? (
                <LoaderCircle className="h-4 w-4 animate-spin" aria-hidden="true" />
              ) : (
                <LogOut className="h-4 w-4" aria-hidden="true" />
              )}
            </button>
          </div>
        </header>

        <main className="min-w-0 flex-1 p-4 sm:p-6 lg:p-8">
          {children}
        </main>
      </div>

      {/* Mobile navigation drawer */}
      {mobileMenuOpen && (
        <div
          className="fixed inset-0 z-50 bg-slate-950/60 backdrop-blur-[2px] lg:hidden"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) setMobileMenuOpen(false);
          }}
        >
          <aside
            id="admin-mobile-navigation"
            role="dialog"
            aria-modal="true"
            aria-label="Admin navigation menu"
            className="flex h-[100dvh] w-[min(88vw,360px)] max-w-full flex-col border-r border-slate-800 bg-slate-950 text-white shadow-2xl shadow-slate-950/30"
          >
            <div className="flex min-h-[76px] shrink-0 items-center justify-between border-b border-slate-800 px-4">
              <Link href="/admin" onClick={() => setMobileMenuOpen(false)} className="flex min-w-0 items-center gap-3">
                <FestivalLogo size={40} className="rounded-xl" />
                <span className="min-w-0">
                  <span className="festival-name block truncate text-sm font-extrabold tracking-tight text-white">
                    {theme.festivalName}
                  </span>
                  <span className="mt-0.5 block text-[10px] font-semibold uppercase tracking-[0.16em] text-slate-400">
                    Admin workspace
                  </span>
                </span>
              </Link>
              <button
                type="button"
                onClick={() => setMobileMenuOpen(false)}
                className="ml-2 inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-xl text-slate-300 transition-colors hover:bg-slate-800 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-400"
                aria-label="Close navigation menu"
              >
                <X className="h-5 w-5" aria-hidden="true" />
              </button>
            </div>

            {renderNavigation(true)}
            {renderUserPanel(true)}
          </aside>
        </div>
      )}
    </div>
  );
};
