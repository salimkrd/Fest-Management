'use client';

import React, { useState, useEffect, Suspense } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { ShieldCheck, Lock, Mail, KeyRound, CheckCircle2, AlertCircle, ArrowRight, Eye, EyeOff } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { useFest } from '@/context/FestContext';
import { FestivalLogo, FestivalStatusBadge } from '@/components/domain/FestivalBrand';

function TeamActivateForm() {
  const { theme } = useFest();
  const router = useRouter();
  const searchParams = useSearchParams();

  const [code, setCode] = useState('');
  const [email, setEmail] = useState('');
  const [teamId, setTeamId] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [activatedTeam, setActivatedTeam] = useState<{ teamName?: string; email?: string } | null>(null);

  useEffect(() => {
    const codeParam = searchParams.get('code');
    const emailParam = searchParams.get('email');
    const teamIdParam = searchParams.get('teamId');

    if (codeParam) setCode(codeParam.trim().toUpperCase());
    if (emailParam) setEmail(emailParam.trim().toLowerCase());
    if (teamIdParam) setTeamId(teamIdParam.trim());
  }, [searchParams]);

  const handleActivate = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    const trimmedCode = code.trim().toUpperCase();
    const trimmedEmail = email.trim().toLowerCase();

    if (!trimmedCode) {
      setError('Please enter your invitation code.');
      return;
    }

    if (!newPassword || newPassword.length < 6) {
      setError('Password must be at least 6 characters in length.');
      return;
    }

    if (newPassword !== confirmPassword) {
      setError('Passwords do not match. Please re-enter your new password.');
      return;
    }

    setLoading(true);

    try {
      const res = await fetch('/api/team/activate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          code: trimmedCode,
          email: trimmedEmail || undefined,
          newPassword,
          teamId: teamId || undefined
        })
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || 'Activation failed. Please verify your code and email.');
      }

      setActivatedTeam({
        email: data.managerEmail || trimmedEmail
      });
    } catch (err: any) {
      setError(err.message || 'An unexpected error occurred during activation.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col justify-center py-12 px-4 sm:px-6 lg:px-8">
      <div className="sm:mx-auto sm:w-full sm:max-w-md">
        {/* Brand Header */}
        <div className="text-center">
          <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-blue-600 text-white shadow-lg shadow-blue-500/30 mb-4">
            <KeyRound className="w-7 h-7" />
          </div>
          <p className="text-xs font-bold tracking-widest uppercase text-blue-600 mb-1">
            {theme.festivalName} · {theme.institutionName}
          </p>
          <h1 className="text-2xl font-black text-slate-900 tracking-tight">
            Team Manager Activation
          </h1>
          <p className="mt-2 text-sm text-slate-600 max-w-sm mx-auto">
            Redeem your one-time WhatsApp invitation code and configure your secure account password.
          </p>
        </div>

        {/* Activation Card */}
        <div className="mt-8 bg-white py-8 px-6 shadow-xl shadow-slate-200/50 rounded-2xl border border-slate-200 sm:px-10">
          {activatedTeam ? (
            <div className="text-center space-y-5 py-4">
              <div className="w-16 h-16 bg-emerald-100 rounded-full flex items-center justify-center mx-auto text-emerald-600">
                <CheckCircle2 className="w-9 h-9" />
              </div>
              <div>
                <h3 className="text-lg font-bold text-slate-900">
                  Account Activated Successfully!
                </h3>
                <p className="text-xs text-slate-600 mt-2 leading-relaxed">
                  Your Team Manager credentials have been verified and your new password has been established. You are now authorized to manage delegation entries.
                </p>
              </div>

              <div className="p-3.5 bg-slate-50 border border-slate-200 rounded-xl text-left text-xs space-y-1">
                <div className="text-[11px] text-slate-500 uppercase tracking-wider font-semibold">Registered Login Email</div>
                <div className="font-mono font-bold text-slate-900">{activatedTeam.email}</div>
              </div>

              <div className="pt-2">
                <Button
                  variant="primary"
                  className="w-full justify-center gap-2 py-3 shadow-md shadow-blue-600/20"
                  onClick={() => router.push('/team/login')}
                >
                  <span>Proceed to Manager Login</span>
                  <ArrowRight className="w-4 h-4" />
                </Button>
              </div>
            </div>
          ) : (
            <form onSubmit={handleActivate} className="space-y-4">
              {error && (
                <div className="p-3.5 rounded-xl bg-rose-50 border border-rose-200 text-xs text-rose-800 flex items-start gap-2.5">
                  <AlertCircle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
                  <span className="leading-relaxed font-medium">{error}</span>
                </div>
              )}

              <div>
                <Input
                  label="Invitation Code *"
                  placeholder="Paste your invitation code"
                  value={code}
                  onChange={(e) => setCode(e.target.value.toUpperCase())}
                  required
                  className="font-mono text-center tracking-wider text-base font-bold uppercase"
                />
                <p className="text-[11px] text-slate-500 mt-1">
                  Enter the exact invitation code received in your WhatsApp message.
                </p>
              </div>

              <div>
                <Input
                  label="Registered Email Address"
                  type="email"
                  placeholder="manager@domain.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="text-sm"
                />
                <p className="text-[11px] text-slate-500 mt-1">
                  The login email specified in your WhatsApp invitation.
                </p>
              </div>

              <div className="pt-2 border-t border-slate-100">
                <div className="relative">
                  <Input
                    label="Choose New Password *"
                    type={showPassword ? 'text' : 'password'}
                    placeholder="Minimum 6 characters"
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    required
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-9 text-slate-400 hover:text-slate-600 text-xs"
                    aria-label="Toggle password visibility"
                  >
                    {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              <div>
                <Input
                  label="Confirm New Password *"
                  type={showPassword ? 'text' : 'password'}
                  placeholder="Re-enter password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  required
                />
              </div>

              <div className="pt-3">
                <Button
                  type="submit"
                  variant="primary"
                  className="w-full justify-center py-2.5 shadow-md shadow-blue-600/20"
                  isLoading={loading}
                >
                  Activate Account &amp; Save Password
                </Button>
              </div>

              <div className="pt-4 text-center">
                <p className="text-xs text-slate-500">
                  Already activated your account?{' '}
                  <Link href="/team/login" className="text-blue-600 font-bold hover:underline">
                    Sign in here
                  </Link>
                </p>
              </div>
            </form>
          )}
        </div>

        {/* Security Footer Notice */}
        <div className="mt-6 text-center text-xs text-slate-400 space-y-1">
          <div className="flex items-center justify-center gap-1.5 font-medium text-slate-500">
            <ShieldCheck className="w-4 h-4 text-emerald-600" />
            <span>End-to-End Cryptographically Secured Activation</span>
          </div>
          <p>{theme.festivalName} · Fest Management System</p>
        </div>
      </div>
    </div>
  );
}

export default function TeamActivatePage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
        <div className="text-slate-400 text-sm font-medium animate-pulse">Loading activation portal...</div>
      </div>
    }>
      <TeamActivateForm />
    </Suspense>
  );
}
