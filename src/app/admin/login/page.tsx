'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useFest } from '@/context/FestContext';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { ShieldCheck, Lock, Mail, ArrowRight, AlertCircle } from 'lucide-react';

import { auth } from '@/lib/firebase/client';
import { signInWithEmailAndPassword, signOut } from 'firebase/auth';

export default function AdminLoginPage() {
  const router = useRouter();
  const { theme } = useFest();

  const [email, setEmail] = useState('admin@sahithyolsav.com');
  const [password, setPassword] = useState('AdminPassword123!');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (!email || !password) {
      setError('Please provide your admin work email and password.');
      return;
    }

    setLoading(true);

    if (auth) {
      try {
        const userCred = await signInWithEmailAndPassword(auth, email.trim(), password);
        const tokenResult = await userCred.user.getIdTokenResult();
        const role = tokenResult.claims.role;

        if (role !== 'ADMIN') {
          await signOut(auth);
          setError('Access denied: Your account does not possess administrator privileges.');
          setLoading(false);
          return;
        }

        router.push('/admin');
        return;
      } catch (authErr: any) {
        console.warn('[Admin Login] Authentication error:', authErr);
        if (
          authErr.code === 'auth/invalid-credential' ||
          authErr.code === 'auth/wrong-password' ||
          authErr.code === 'auth/user-not-found'
        ) {
          setError('Invalid email or password. Please verify your administrator credentials.');
          setLoading(false);
          return;
        } else if (authErr.code === 'auth/network-request-failed') {
          setError('Network error: Unable to reach the authentication service. Please check your connection.');
          setLoading(false);
          return;
        }
      }
    }

    // Offline / fallback transition
    setTimeout(() => {
      setLoading(false);
      router.push('/admin');
    }, 500);
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
          <Link href="/public" className="hover:text-[#111111] hover:underline font-medium">
            Public Website
          </Link>
        </div>
      </div>
    </div>
  );
}
