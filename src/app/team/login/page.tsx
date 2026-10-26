'use client';

import React, { useState, useEffect, Suspense } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { useFest } from '@/context/FestContext';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Users2, Lock, Mail, ArrowRight, ShieldCheck, AlertCircle, Info } from 'lucide-react';
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
    <div className="min-h-screen bg-[#F8FAFC] flex flex-col justify-center py-12 sm:px-6 lg:px-8">
      <div className="sm:mx-auto sm:w-full sm:max-w-md">
        <div className="flex justify-center">
          <div className="w-12 h-12 rounded-2xl bg-emerald-600 flex items-center justify-center text-white font-extrabold text-xl shadow-md">
            <Users2 className="w-6 h-6" />
          </div>
        </div>

        <h2 className="mt-4 text-center text-2xl font-bold tracking-tight text-[#111111]">
          Team Manager Portal
        </h2>
        <p className="mt-1 text-center text-xs text-[#526070]">
          {theme.festivalName} · Contingent House Administration
        </p>
      </div>

      <div className="mt-8 sm:mx-auto sm:w-full sm:max-w-md px-4 sm:px-0">
        <div className="bg-white py-8 px-6 shadow-xs rounded-2xl border border-[#E1E7EF] sm:px-10">
          {notice && (
            <div className="mb-6 p-3 rounded-lg bg-blue-50 border border-blue-200 text-xs text-[#2563EB] flex items-center gap-2">
              <Info className="w-4 h-4 shrink-0" />
              <span>{notice}</span>
            </div>
          )}

          {error && (
            <div className="mb-6 p-3 rounded-lg bg-red-50 border border-red-200 text-xs text-[#DC2626] flex items-center gap-2">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          <form className="space-y-5" onSubmit={handleSubmit}>
            <div>
              <Input
                label="Team Manager Work Email"
                type="email"
                placeholder="manager@domain.com"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                leftIcon={<Mail className="w-4 h-4" />}
              />
            </div>

            <div>
              <Input
                label="Manager Password"
                type="password"
                placeholder="••••••••••••"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                leftIcon={<Lock className="w-4 h-4" />}
              />
            </div>

            <div>
              <Button
                type="submit"
                variant="primary"
                size="md"
                className="w-full font-bold bg-emerald-600 hover:bg-emerald-700"
                isLoading={loading}
                rightIcon={<ArrowRight className="w-4 h-4" />}
              >
                Access Team Workspace
              </Button>
            </div>
          </form>

          <div className="mt-6 pt-6 border-t border-[#E1E7EF] text-center">
            <div className="inline-flex items-center gap-1.5 text-[11px] text-[#526070] font-medium bg-[#F8FAFC] px-3 py-1 rounded-full border border-[#E1E7EF]">
              <ShieldCheck className="w-3.5 h-3.5 text-emerald-600" />
              <span>Contingent Workspace · Single Fest Management</span>
            </div>
          </div>
        </div>

        <div className="mt-6 flex items-center justify-center gap-4 text-xs text-[#526070]">
          <Link href="/admin/login" className="hover:text-[#111111] hover:underline font-medium">
            Admin Control Center
          </Link>
          <span>•</span>
          <Link href="/" className="hover:text-[#111111] hover:underline font-medium">
            Public Website
          </Link>
        </div>
      </div>
    </div>
  );
}

export default function TeamManagerLoginPage() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-[#F8FAFC] flex items-center justify-center text-xs text-[#526070]">Loading Team Portal...</div>}>
      <TeamLoginForm />
    </Suspense>
  );
}
