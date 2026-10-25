'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useFest } from '@/context/FestContext';
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
    <div className="min-h-screen bg-[#F8FAFC] flex flex-col justify-center py-12 sm:px-6 lg:px-8">
      <div className="sm:mx-auto sm:w-full sm:max-w-md">
        {/* Brand Icon */}
        <div className="flex justify-center">
          <div className="w-12 h-12 rounded-2xl bg-[#2563EB] flex items-center justify-center text-white font-extrabold text-xl shadow-md">
            S
          </div>
        </div>

        <h2 className="mt-4 text-center text-2xl font-bold tracking-tight text-[#111111]">
          Fest Control Center
        </h2>
        <p className="mt-1 text-center text-xs text-[#526070]">
          {theme.festivalName} · {theme.institutionName}
        </p>
      </div>

      <div className="mt-8 sm:mx-auto sm:w-full sm:max-w-md px-4 sm:px-0">
        <div className="bg-white py-8 px-6 shadow-xs rounded-2xl border border-[#E1E7EF] sm:px-10">
          {error && (
            <div className="mb-6 p-3 rounded-lg bg-red-50 border border-red-200 text-xs text-[#DC2626] flex items-center gap-2">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          <form className="space-y-5" onSubmit={handleSubmit}>
            <div>
              <Input
                label="Admin Work Email"
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="admin@fest.org"
                leftIcon={<Mail className="w-4 h-4" />}
              />
            </div>

            <div>
              <Input
                label="Portal Password"
                type="password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••••••"
                leftIcon={<Lock className="w-4 h-4" />}
              />
            </div>

            <div className="flex items-center justify-between text-xs">
              <label className="flex items-center gap-2 text-[#526070] cursor-pointer select-none">
                <input
                  type="checkbox"
                  defaultChecked
                  className="rounded border-[#E1E7EF] text-[#2563EB] focus:ring-[#2563EB]"
                />
                <span>Remember this terminal</span>
              </label>
              <a href="#" className="font-semibold text-[#2563EB] hover:underline">
                Forgot access?
              </a>
            </div>

            <div>
              <Button
                type="submit"
                variant="primary"
                size="md"
                className="w-full font-bold"
                isLoading={loading}
                rightIcon={<ArrowRight className="w-4 h-4" />}
              >
                Sign In to Fest Control Center
              </Button>
            </div>
          </form>

          {/* Institutional Security Notice */}
          <div className="mt-6 pt-6 border-t border-[#E1E7EF] text-center">
            <div className="inline-flex items-center gap-1.5 text-[11px] text-[#526070] font-medium bg-[#F8FAFC] px-3 py-1 rounded-full border border-[#E1E7EF]">
              <ShieldCheck className="w-3.5 h-3.5 text-[#2563EB]" />
              <span>One Institution · Fest Operations v2.0</span>
            </div>
          </div>
        </div>

        {/* Alternative Portals */}
        <div className="mt-6 flex items-center justify-center gap-4 text-xs text-[#526070]">
          <Link href="/team/login" className="hover:text-[#111111] hover:underline font-medium">
            Team Manager Login
          </Link>
          <span>•</span>
          <Link href="/judge/login" className="hover:text-[#111111] hover:underline font-medium">
            Judge Secure Link
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
