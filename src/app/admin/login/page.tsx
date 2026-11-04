'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useFest } from '@/context/FestContext';
import { FestivalLogo, FestivalStatusBadge } from '@/components/domain/FestivalBrand';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { ShieldCheck, Lock, Mail, ArrowRight, AlertCircle } from 'lucide-react';

import { auth, db } from '@/lib/firebase/client';
import { signInWithEmailAndPassword, signOut } from 'firebase/auth';
import { doc, getDoc } from 'firebase/firestore';

export default function AdminLoginPage() {
  const router = useRouter();
  const { theme } = useFest();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (!email.trim() || !password) {
      setError('Please provide your admin work email and password.');
      return;
    }

    setLoading(true);

    if (!auth) {
      setError('Authentication service is currently unavailable. Please verify system configuration.');
      setLoading(false);
      return;
    }

    try {
      const userCred = await signInWithEmailAndPassword(auth, email.trim(), password);
      const user = userCred.user;
      let tokenResult = await user.getIdTokenResult(true);
      let role = tokenResult.claims.role;

      if (role !== 'ADMIN' && role !== 'GREEN_ROOM_STAFF') {
        try {
          const syncRes = await fetch('/api/auth/sync-claims', {
            method: 'POST',
            headers: { Authorization: `Bearer ${await user.getIdToken()}` }
          });
          if (syncRes.ok) {
            tokenResult = await user.getIdTokenResult(true);
            role = tokenResult.claims.role;
          }
        } catch (syncErr) {
          console.warn('[Admin Login] Claims auto-sync attempt error:', syncErr);
        }
      }

      if (role !== 'ADMIN' && role !== 'GREEN_ROOM_STAFF') {
        await signOut(auth);
        setError('Access denied: Your account does not possess administrator or green room staff privileges.');
        setLoading(false);
        return;
      }

      // Authoritative validation against Firestore user record
      if (db) {
        try {
          const userDocSnap = await getDoc(doc(db, 'users', user.uid));
          if (!userDocSnap.exists()) {
            await signOut(auth);
            setError('Access denied: Authoritative user profile not found.');
            setLoading(false);
            return;
          }
          const userData = userDocSnap.data();
          if (
            (userData?.role !== 'ADMIN' && userData?.role !== 'GREEN_ROOM_STAFF') ||
            userData?.status !== 'ACTIVE' ||
            userData?.disabled === true
          ) {
            await signOut(auth);
            setError('Access denied: Account is inactive, disabled, or unauthorized.');
            setLoading(false);
            return;
          }
        } catch (dbErr: any) {
          console.warn('[Admin Login] Authoritative Firestore profile check warning:', dbErr);
          // If security rules or network blocked getDoc, fail closed
          await signOut(auth);
          setError('Access denied: Could not verify authoritative status. Please try again.');
          setLoading(false);
          return;
        }
      }

      if (role === 'GREEN_ROOM_STAFF') {
        router.push('/admin/green-room');
      } else {
        router.push('/admin');
      }
      return;
    } catch (authErr: any) {
      console.warn('[Admin Login] Authentication error:', authErr);
      if (
        authErr.code === 'auth/invalid-credential' ||
        authErr.code === 'auth/wrong-password' ||
        authErr.code === 'auth/user-not-found' ||
        authErr.code === 'auth/invalid-login-credentials'
      ) {
        setError('Invalid email or password. Please verify your administrator credentials.');
      } else if (authErr.code === 'auth/user-disabled') {
        setError('Access denied: This administrator account has been disabled.');
      } else if (authErr.code === 'auth/too-many-requests') {
        setError('Access temporarily disabled due to multiple failed login attempts. Please try again later.');
      } else if (authErr.code === 'auth/network-request-failed') {
        setError('Network error: Unable to reach the authentication service. Please check your connection.');
      } else {
        setError(authErr.message || 'Authentication failed. Please verify your credentials.');
      }
      setLoading(false);
      return;
    }
  };

  return (
    <main className="flex min-h-dvh items-center justify-center bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-blue-50 via-slate-50 to-white px-4 py-8 sm:px-6 sm:py-12">
      <div className="w-full max-w-[440px]">
        <header className="mb-7 text-center">
          <div className="mb-4 flex justify-center">
            <FestivalLogo size={52} />
          </div>
          <h1 className="text-[25px] font-bold tracking-tight text-slate-950 sm:text-[28px]">
            Fest Control Center
          </h1>
          <p className="mx-auto mt-2 max-w-sm text-[13px] leading-5 text-slate-600">
            <span className="festival-name font-semibold text-slate-800">{theme.festivalName}</span>
            <span className="px-1.5 text-slate-300">·</span>
            {theme.institutionName}
          </p>
          <div className="mt-4 flex justify-center"><FestivalStatusBadge /></div>
        </header>

        <section className="rounded-3xl border border-slate-200/90 bg-white p-5 shadow-[0_20px_60px_-28px_rgba(15,23,42,0.24)] sm:p-8">
          <div className="mb-6">
            <p className="text-sm font-semibold text-slate-900">Administrator sign in</p>
            <p className="mt-1 text-xs leading-5 text-slate-500">Use your authorized administrator credentials to continue.</p>
          </div>

          {error && (
            <div role="alert" className="mb-5 flex items-start gap-2.5 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm leading-5 text-red-700">
              <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          <form className="space-y-5" onSubmit={handleSubmit}>
            <Input
              label="Admin Work Email"
              type="email"
              autoComplete="username"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="admin@fest.org"
              leftIcon={<Mail className="h-4 w-4" />}
              className="!min-h-[50px] !rounded-xl !border-slate-300 !text-sm focus:!border-blue-500 focus:!ring-2 focus:!ring-blue-100"
            />

            <Input
              label="Portal Password"
              type="password"
              autoComplete="current-password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Enter your password"
              leftIcon={<Lock className="h-4 w-4" />}
              className="!min-h-[50px] !rounded-xl !border-slate-300 !text-sm focus:!border-blue-500 focus:!ring-2 focus:!ring-blue-100"
            />

            <Button
              type="submit"
              variant="primary"
              size="lg"
              className="mt-1 w-full !min-h-[52px] !rounded-xl !font-semibold shadow-sm shadow-blue-900/10"
              isLoading={loading}
              rightIcon={<ArrowRight className="h-4 w-4" />}
            >
              Sign In to Fest Control Center
            </Button>
          </form>

          <div className="mt-6 flex items-start gap-2.5 rounded-xl bg-slate-50 px-3.5 py-3 text-xs leading-5 text-slate-600">
            <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-blue-600" />
            <span>Protected access for authorized festival operations staff.</span>
          </div>
        </section>

        <footer className="mt-6 text-center text-xs text-slate-500">
          <Link href="/" className="font-semibold text-blue-700 underline-offset-4 transition hover:text-blue-800 hover:underline">
            Public Website
          </Link>
        </footer>
      </div>
    </main>
  );
}