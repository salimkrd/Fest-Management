'use client';

import React, { useState, useEffect, Suspense } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { useFest } from '@/context/FestContext';
import { FestivalLogo, FestivalStatusBadge } from '@/components/domain/FestivalBrand';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Lock, Mail, ArrowRight, ShieldCheck, AlertCircle, Info } from 'lucide-react';
import { auth, db } from '@/lib/firebase/client';
import { signInWithEmailAndPassword, signOut } from 'firebase/auth';
import { doc, getDoc } from 'firebase/firestore';

function TeamLoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { teams, setCurrentTeamUser, theme } = useFest();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');

  useEffect(() => {
    const emailParam = searchParams.get('email');
    const isOnboarding = searchParams.get('onboarding');
    if (emailParam) {
      setEmail(emailParam);
    }
    if (isOnboarding === 'true') {
      setNotice('Welcome! Please log in with your provisioned manager credentials to access your team workspace.');
    }
  }, [searchParams]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (!email.trim() || !password) {
      setError('Please provide your manager work email and password.');
      return;
    }

    setLoading(true);

    if (auth) {
      try {
        const userCred = await signInWithEmailAndPassword(auth, email.trim(), password);
        let tokenResult = await userCred.user.getIdTokenResult(true);
        let role = tokenResult.claims.role;
        let assignedTeamId = tokenResult.claims.teamId as string | undefined;

        if (role !== 'TEAM_MANAGER' && role !== 'ADMIN') {
          try {
            const syncRes = await fetch('/api/auth/sync-claims', {
              method: 'POST',
              headers: { Authorization: `Bearer ${await userCred.user.getIdToken()}` }
            });
            if (syncRes.ok) {
              tokenResult = await userCred.user.getIdTokenResult(true);
              role = tokenResult.claims.role;
              assignedTeamId = tokenResult.claims.teamId as string | undefined;
            }
          } catch (syncErr) {
            console.warn('[Team Login] Claims auto-sync attempt error:', syncErr);
          }
        }

        // Verify role
        if (role !== 'TEAM_MANAGER' && role !== 'ADMIN') {
          await signOut(auth);
          setError('Access denied: Your account does not possess Team Manager privileges.');
          setLoading(false);
          return;
        }

        // Resolve Assigned Team
        let targetTeam = teams.find(t => t.id === assignedTeamId || t.managerEmail?.toLowerCase() === email.trim().toLowerCase());

        // 1. If not found in current context state, query Firestore client SDK directly (allowed by security rules)
        if (!targetTeam && assignedTeamId && db) {
          try {
            const teamDoc = await getDoc(doc(db, 'teams', assignedTeamId));
            if (teamDoc.exists()) {
              const dt = teamDoc.data();
              targetTeam = {
                id: teamDoc.id,
                name: dt.name || 'Delegation Team',
                code: dt.code || 'TM',
                color: dt.color || '#2563EB',
                managerName: dt.managerName || '',
                managerEmail: dt.managerEmail || email.trim(),
                managerPhone: dt.managerPhone || '',
                zone: dt.zone || '',
                contestantsCount: 0,
                eventsCount: 0,
                totalPoints: 0,
                soloPoints: 0,
                groupPoints: 0,
                rank: 1,
                firstCount: 0,
                secondCount: 0,
                thirdCount: 0,
                portalAccess: dt.portalAccess !== false && dt.status !== 'DISABLED',
                status: dt.status || 'ACTIVE'
              };
            }
          } catch (fsErr) {
            console.warn('[Team Login] Client Firestore lookup warning:', fsErr);
          }
        }

        // 2. Fallback: query public team API endpoint /api/team/[id]
        if (!targetTeam && assignedTeamId) {
          try {
            const res = await fetch(`/api/team/${assignedTeamId}`);
            if (res.ok) {
              const data = await res.json();
              if (data.team) {
                targetTeam = {
                  id: data.team.id,
                  name: data.team.name,
                  code: data.team.code,
                  color: data.team.color || '#2563EB',
                  managerName: data.team.managerName || '',
                  managerEmail: data.team.managerEmail || email.trim(),
                  managerPhone: data.team.managerPhone || '',
                  zone: data.team.zone || '',
                  contestantsCount: 0,
                  eventsCount: 0,
                  totalPoints: 0,
                  soloPoints: 0,
                  groupPoints: 0,
                  rank: 1,
                  firstCount: 0,
                  secondCount: 0,
                  thirdCount: 0,
                  portalAccess: data.team.portalAccess !== false && data.team.status !== 'DISABLED',
                  status: data.team.status || 'ACTIVE'
                };
              }
            }
          } catch (fetchErr) {
            console.warn('[Team Login] Failed to fetch team via API:', fetchErr);
          }
        }

        if (!targetTeam) {
          await signOut(auth);
          setError(`Access denied: No active team contingent record found for assigned team (${assignedTeamId || 'unassigned'}).`);
          setLoading(false);
          return;
        }

        // Verify portal access and team status
        if (targetTeam.portalAccess === false || (targetTeam as any).status === 'DISABLED') {
          await signOut(auth);
          setError('Access denied: Team contingent is currently disabled by the Chief Administrator.');
          setLoading(false);
          return;
        }

        setCurrentTeamUser(targetTeam);
        router.push('/team');
        return;
      } catch (authErr: any) {
        console.warn('[Team Login] Authentication error:', authErr);
        if (
          authErr.code === 'auth/invalid-credential' ||
          authErr.code === 'auth/wrong-password' ||
          authErr.code === 'auth/user-not-found'
        ) {
          setError('Invalid email or password. Please verify your team manager credentials.');
        } else if (authErr.code === 'auth/user-disabled') {
          setError('This team manager account has been disabled by the Chief Administrator.');
        } else if (authErr.code === 'auth/network-request-failed') {
          setError('Network error: Unable to reach the authentication service. Please check your connection.');
        } else {
          setError(authErr.message || 'Authentication failed. Please verify your credentials.');
        }
        setLoading(false);
        return;
      }
    } else {
      const isEmulatorOrDemo = process.env.NEXT_PUBLIC_USE_FIREBASE_EMULATOR === 'true' || process.env.NEXT_PUBLIC_DEMO_MODE === 'true';
      if (isEmulatorOrDemo) {
        // Isolated demo / emulator mode fallback only
        const matchingTeam = teams.find(t => t.managerEmail?.toLowerCase() === email.trim().toLowerCase());
        if (matchingTeam) {
          setCurrentTeamUser(matchingTeam);
          router.push('/team');
        } else {
          setError('No team contingent matching this email address was found in local storage.');
        }
      } else {
        setError('Authentication service is currently unavailable. Please verify system configuration.');
      }
      setLoading(false);
    }
  };

  return (
    <main className="flex min-h-dvh items-center justify-center bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-emerald-50 via-slate-50 to-white px-4 py-8 sm:px-6 sm:py-12">
      <div className="w-full max-w-[440px]">
        <header className="mb-7 text-center">
          <div className="mb-4 flex justify-center"><FestivalLogo size={52} /></div>
          <h1 className="text-[25px] font-bold tracking-tight text-slate-950 sm:text-[28px]">Team Manager Portal</h1>
          <p className="mt-2 text-[13px] leading-5 text-slate-600">
            <span className="festival-name font-semibold text-slate-800">{theme.festivalName}</span>
            <span className="px-1.5 text-slate-300">·</span>
            Contingent House Administration
          </p>
          <div className="mt-4 flex justify-center"><FestivalStatusBadge /></div>
        </header>

        <section className="rounded-3xl border border-slate-200/90 bg-white p-5 shadow-[0_20px_60px_-28px_rgba(15,23,42,0.24)] sm:p-8">
          <div className="mb-6">
            <p className="text-sm font-semibold text-slate-900">Manager sign in</p>
            <p className="mt-1 text-xs leading-5 text-slate-500">Sign in with the email and password provided for your team.</p>
          </div>

          {notice && (
            <div className="mb-5 flex items-start gap-2.5 rounded-xl border border-blue-200 bg-blue-50 px-4 py-3 text-sm leading-5 text-blue-800">
              <Info className="mt-0.5 h-4 w-4 shrink-0" />
              <span>{notice}</span>
            </div>
          )}

          {error && (
            <div role="alert" className="mb-5 flex items-start gap-2.5 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm leading-5 text-red-700">
              <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          <form className="space-y-5" onSubmit={handleSubmit}>
            <Input
              label="Team Manager Work Email"
              type="email"
              autoComplete="username"
              placeholder="manager@domain.com"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              leftIcon={<Mail className="h-4 w-4" />}
              className="!min-h-[50px] !rounded-xl !border-slate-300 !text-sm focus:!border-emerald-600 focus:!ring-2 focus:!ring-emerald-100"
            />

            <Input
              label="Manager Password"
              type="password"
              autoComplete="current-password"
              placeholder="Enter your password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              leftIcon={<Lock className="h-4 w-4" />}
              className="!min-h-[50px] !rounded-xl !border-slate-300 !text-sm focus:!border-emerald-600 focus:!ring-2 focus:!ring-emerald-100"
            />

            <Button
              type="submit"
              variant="primary"
              size="lg"
              className="mt-1 w-full !min-h-[52px] !rounded-xl !bg-emerald-700 !font-semibold shadow-sm shadow-emerald-900/10 hover:!bg-emerald-800 focus:!ring-emerald-600"
              isLoading={loading}
              rightIcon={<ArrowRight className="h-4 w-4" />}
            >
              Access Team Workspace
            </Button>
          </form>

          <div className="mt-6 flex items-start gap-2.5 rounded-xl bg-slate-50 px-3.5 py-3 text-xs leading-5 text-slate-600">
            <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-emerald-700" />
            <span>Secure access to your assigned contingent workspace.</span>
          </div>
        </section>

        <footer className="mt-6 text-center text-xs text-slate-500">
          <Link href="/" className="font-semibold text-emerald-700 underline-offset-4 transition hover:text-emerald-800 hover:underline">
            Public Website
          </Link>
        </footer>
      </div>
    </main>
  );
}

export default function TeamManagerLoginPage() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-[#F8FAFC] flex items-center justify-center text-xs text-[#526070]">Loading Team Portal...</div>}>
      <TeamLoginForm />
    </Suspense>
  );
}

  );
}