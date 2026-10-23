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
  Edit3,
  Award,
  MapPin,
  CalendarDays,
  Image as ImageIcon,
  FileDown,
  ExternalLink,
  Menu,
  X,
  Bell,
  Sparkles
} from 'lucide-react';
import { useFest } from '@/context/FestContext';
import { auth, db } from '@/lib/firebase/client';
import { onAuthStateChanged, signOut, User } from 'firebase/auth';
import { doc, getDoc } from 'firebase/firestore';

interface AdminLayoutProps {
  children: React.ReactNode;
}

export const AdminLayout: React.FC<AdminLayoutProps> = ({ children }) => {
  const pathname = usePathname();
  const router = useRouter();
  const { theme } = useFest();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [authorizedUser, setAuthorizedUser] = useState<User | null>(null);
  const [authChecking, setAuthChecking] = useState<boolean>(true);

  useEffect(() => {
    if (!auth) {
      setAuthChecking(false);
      router.replace('/admin/login');
      return;
    }

    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      if (!user) {
        setAuthorizedUser(null);
        setAuthChecking(false);
        router.replace('/admin/login');
        return;
      }

      try {
        const tokenResult = await user.getIdTokenResult();
        if (tokenResult.claims.role !== 'ADMIN') {
          console.warn('[AdminLayout] User is missing ADMIN custom claim.');
          if (auth) await signOut(auth);
          setAuthorizedUser(null);
          setAuthChecking(false);
          router.replace('/admin/login');
          return;
        }

        // Validate authoritative Firestore user document
        if (db) {
          const userDocSnap = await getDoc(doc(db, 'users', user.uid));
          if (!userDocSnap.exists()) {
            console.warn('[AdminLayout] Authoritative user document missing.');
            if (auth) await signOut(auth);
            setAuthorizedUser(null);
            setAuthChecking(false);
            router.replace('/admin/login');
            return;
          }

          const userData = userDocSnap.data();
          if (userData?.role !== 'ADMIN' || userData?.status !== 'ACTIVE' || userData?.disabled === true) {
            console.warn('[AdminLayout] User profile inactive, disabled, or not ADMIN.');
            if (auth) await signOut(auth);
            setAuthorizedUser(null);
            setAuthChecking(false);
            router.replace('/admin/login');
            return;
          }
        }

        setAuthorizedUser(user);
        setAuthChecking(false);
      } catch (authErr) {
        console.warn('[AdminLayout] Auth verification error:', authErr);
        if (auth) await signOut(auth);
        setAuthorizedUser(null);
        setAuthChecking(false);
        router.replace('/admin/login');
      }
    });

    return () => unsubscribe();
  }, [router]);

  const handleSignOut = async () => {
    if (auth) {
      try {
        await signOut(auth);
      } catch (err) {
        console.warn('[AdminLayout] Sign out error:', err);
      }
    }
    router.push('/admin/login');
  };

  // Exact 12 Authoritative Sidebar Items from PRD / DESIGN v2.0
  const navItems = [
    { name: 'Dashboard', href: '/admin', icon: LayoutDashboard },
    { name: 'Categories', href: '/admin/categories', icon: Layers },
    { name: 'Teams', href: '/admin/teams', icon: Users2 },
    { name: 'Competitions', href: '/admin/competitions', icon: Trophy },
    { name: 'Participants', href: '/admin/participants', icon: UserCheck },
    { name: 'Registration', href: '/admin/registration', icon: ClipboardList },
    { name: 'Mark Entry', href: '/admin/mark-entry', icon: Edit3 },
    { name: 'Result', href: '/admin/results', icon: Award },
    { name: 'Stages', href: '/admin/stages', icon: MapPin },
    { name: 'Schedule', href: '/admin/schedule', icon: CalendarDays },
    { name: 'Media', href: '/admin/media', icon: ImageIcon },
    { name: 'Export', href: '/admin/export', icon: FileDown },
  ];

  if (authChecking) {
    return (
      <div className="min-h-screen bg-[#F8FAFC] flex flex-col items-center justify-center p-4">
        <div className="flex flex-col items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-[#2563EB] flex items-center justify-center text-white font-bold text-lg shadow-md animate-pulse">
            S
          </div>
          <p className="text-xs font-semibold text-[#526070] tracking-wide">
            Verifying Fest Administrator Session...
          </p>
        </div>
      </div>
    );
  }

  if (!authorizedUser) {
    return null;
  }

  const userInitials = authorizedUser.email
    ? authorizedUser.email.slice(0, 2).toUpperCase()
    : 'AD';

  return (
    <div className="min-h-screen bg-[#F8FAFC] flex flex-col lg:flex-row">
      {/* Desktop Sidebar */}
      <aside className="hidden lg:flex lg:flex-col lg:w-64 bg-white border-r border-[#E1E7EF] shrink-0 sticky top-0 h-screen">
        {/* Brand Header */}
        <div className="h-16 px-6 border-b border-[#E1E7EF] flex items-center justify-between">
          <Link href="/admin" className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-[#2563EB] flex items-center justify-center text-white font-bold text-sm shadow-xs">
              S
            </div>
            <div>
              <span className="font-bold text-[#111111] text-sm tracking-tight block leading-tight">
                {theme.festivalName}
              </span>
              <span className="text-[10px] text-[#526070] font-semibold uppercase tracking-wider block">
                Control Center
              </span>
            </div>
          </Link>
        </div>

        {/* Navigation Items (Exact 12 items) */}
        <nav className="flex-1 px-3 py-4 space-y-1 overflow-y-auto">
          {navItems.map((item) => {
            const isActive = pathname === item.href || (item.href !== '/admin' && pathname.startsWith(item.href));
            const Icon = item.icon;
            return (
              <Link
                key={item.name}
                href={item.href}
                className={`flex items-center gap-3 px-3.5 py-2.5 rounded-lg text-xs font-semibold transition-all ${
                  isActive
                    ? 'bg-[#2563EB] text-white shadow-xs'
                    : 'text-[#526070] hover:text-[#111111] hover:bg-[#F8FAFC]'
                }`}
              >
                <Icon className={`w-4 h-4 shrink-0 ${isActive ? 'text-white' : 'text-[#526070]'}`} />
                <span>{item.name}</span>
              </Link>
            );
          })}
        </nav>

        {/* Sidebar Footer */}
        <div className="p-4 border-t border-[#E1E7EF] bg-white">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-full bg-blue-100 text-[#2563EB] font-bold text-xs flex items-center justify-center">
              {userInitials}
            </div>
            <div className="flex-1 min-w-0">
              <span className="text-xs font-bold text-[#111111] truncate block">Chief Administrator</span>
              <span className="text-[10px] text-[#526070] truncate block">{authorizedUser.email || 'admin@fest.institution.org'}</span>
            </div>
            <button
              type="button"
              onClick={handleSignOut}
              className="text-[10px] font-semibold text-[#DC2626] hover:underline cursor-pointer"
              title="Sign out"
            >
              Exit
            </button>
          </div>
        </div>
      </aside>

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Top Header */}
        <header className="h-16 bg-white border-b border-[#E1E7EF] px-4 sm:px-8 flex items-center justify-between sticky top-0 z-30">
          <div className="flex items-center gap-3">
            <button
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              className="lg:hidden p-2 rounded-lg text-[#526070] hover:bg-[#F8FAFC]"
              aria-label="Toggle Navigation"
            >
              {mobileMenuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
            </button>

            <div className="flex items-center gap-3">
              <div className="hidden sm:flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-emerald-500 animate-ping" />
                <span className="text-xs font-bold text-emerald-700 bg-emerald-50 border border-emerald-200 px-2 py-0.5 rounded-full uppercase tracking-wider">
                  Live · Day 2 of 3
                </span>
              </div>
              <span className="text-xs text-[#526070] hidden md:inline">
                Institutional Arts &amp; Cultural Championship
              </span>
            </div>
          </div>

          {/* Header Actions */}
          <div className="flex items-center gap-3">
            {/* Public View Button as required: Accessed through Dashboard/Header, not sidebar */}
            <Link
              href="/public"
              target="_blank"
              className="inline-flex items-center gap-1.5 px-3.5 py-1.5 text-xs font-bold rounded-lg border border-[#E1E7EF] bg-white text-[#111111] hover:bg-[#F8FAFC] shadow-xs transition-colors"
            >
              <Sparkles className="w-3.5 h-3.5 text-amber-500" />
              <span>Public View</span>
              <ExternalLink className="w-3.5 h-3.5 text-[#526070]" />
            </Link>

            <button
              type="button"
              className="p-2 rounded-lg text-[#526070] hover:text-[#111111] hover:bg-[#F8FAFC] relative"
              aria-label="Notifications"
            >
              <Bell className="w-4 h-4" />
              <span className="absolute top-1.5 right-1.5 w-2 h-2 rounded-full bg-[#2563EB]" />
            </button>
          </div>
        </header>

        {/* Mobile Navigation Drawer */}
        {mobileMenuOpen && (
          <div className="lg:hidden fixed inset-0 z-40 bg-black/50" onClick={() => setMobileMenuOpen(false)}>
            <div className="w-64 bg-white h-full flex flex-col p-4 shadow-xl" onClick={(e) => e.stopPropagation()}>
              <div className="flex items-center justify-between pb-4 border-b border-[#E1E7EF]">
                <span className="font-bold text-sm text-[#111111]">{theme.festivalName}</span>
                <button onClick={() => setMobileMenuOpen(false)}>
                  <X className="w-5 h-5 text-[#526070]" />
                </button>
              </div>
              <nav className="flex-1 py-4 space-y-1 overflow-y-auto">
                {navItems.map((item) => {
                  const isActive = pathname === item.href;
                  const Icon = item.icon;
                  return (
                    <Link
                      key={item.name}
                      href={item.href}
                      onClick={() => setMobileMenuOpen(false)}
                      className={`flex items-center gap-3 px-3.5 py-2.5 rounded-lg text-xs font-semibold ${
                        isActive
                          ? 'bg-[#2563EB] text-white'
                          : 'text-[#526070] hover:text-[#111111] hover:bg-[#F8FAFC]'
                      }`}
                    >
                      <Icon className="w-4 h-4" />
                      <span>{item.name}</span>
                    </Link>
                  );
                })}
              </nav>
            </div>
          </div>
        )}

        {/* Page Content */}
        <main className="flex-1 p-4 sm:p-8 overflow-y-auto">
          {children}
        </main>
      </div>
    </div>
  );
};
