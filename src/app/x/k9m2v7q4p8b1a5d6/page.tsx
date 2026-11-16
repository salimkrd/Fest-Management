'use client';

import React, { useState, useEffect, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import {
  Lock,
  Mail,
  Eye,
  EyeOff,
  ShieldCheck,
  AlertCircle,
  Info,
  Loader2,
  Sparkles,
  LogIn,
  Users,
  Compass
} from 'lucide-react';
import { useFest } from '@/context/FestContext';
import { FestivalLogo, FestivalStatusBadge } from '@/components/domain/FestivalBrand';
import { auth } from '@/lib/firebase/client';
import { signInWithEmailAndPassword, signOut } from 'firebase/auth';
import './staff-login.css';

function StaffLoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { setCurrentTeamUser, theme, themeSyncState } = useFest();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');

  useEffect(() => {
    const emailParam = searchParams.get('email');
    const isOnboarding = searchParams.get('onboarding');
    const errorParam = searchParams.get('error');

    if (emailParam && !email) {
      setEmail(emailParam);
    }

    if (isOnboarding === 'true' || isOnboarding === 'complete') {
      setNotice(
        'Welcome! Your team manager account has been provisioned. Please sign in with your email and password to access your workspace.'
      );
    }

    if (errorParam === 'disabled') {
      setError('Access denied: Your account or team contingent is currently disabled by fest administration.');
    }
  }, [searchParams, email]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    const trimmedEmail = email.trim();
    if (!trimmedEmail || !password) {
      setError('Please provide both your official work email and password.');
      return;
    }

    setSubmitting(true);

    if (!auth) {
      setError('Authentication service is currently unavailable. Please verify system configuration.');
      setSubmitting(false);
      return;
    }

    try {
      // 1. Firebase client authentication
      const userCred = await signInWithEmailAndPassword(auth, trimmedEmail, password);
      const user = userCred.user;
      const initialIdToken = await user.getIdToken();

      // 2. Strict server-side verification and claims synchronization
      let res = await fetch('/api/auth/staff-login', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${initialIdToken}`,
        },
      });

      let data = await res.json().catch(() => ({}));

      // 3. If claims were synchronized server-side, refresh the token and re-verify
      if (res.ok && data.needsTokenRefresh) {
        const refreshedToken = await user.getIdToken(true);
        res = await fetch('/api/auth/staff-login', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${refreshedToken}`,
          },
        });
        data = await res.json().catch(() => ({}));
      }

      // 4. Fail-closed on verification rejection
      if (!res.ok || !data.success) {
        await signOut(auth);
        setCurrentTeamUser(null);
        try {
          localStorage.removeItem('fest_current_team_user_v2');
        } catch {
          // ignore storage error
        }
        setError(data.error || 'Access denied: Unable to verify staff authorization.');
        setSubmitting(false);
        return;
      }

      // 5. Authoritative role routing
      if (data.role === 'ADMIN') {
        setCurrentTeamUser(null);
        try {
          localStorage.removeItem('fest_current_team_user_v2');
        } catch {
          // ignore storage error
        }
        router.replace('/admin');
        router.refresh();
        return;
      }

      if (data.role === 'GREEN_ROOM_STAFF') {
        setCurrentTeamUser(null);
        try {
          localStorage.removeItem('fest_current_team_user_v2');
        } catch {
          // ignore storage error
        }
        router.replace('/admin/green-room');
        router.refresh();
        return;
      }

      if (data.role === 'TEAM_MANAGER') {
        if (data.team) {
          setCurrentTeamUser(data.team);
          try {
            localStorage.setItem('fest_current_team_user_v2', JSON.stringify(data.team));
          } catch {
            // ignore storage error
          }
        }
        router.replace('/team');
        router.refresh();
        return;
      }

      // Fallback rejection for any unrecognized role
      await signOut(auth);
      setCurrentTeamUser(null);
      try {
        localStorage.removeItem('fest_current_team_user_v2');
      } catch {
        // ignore storage error
      }
      setError('Access denied: Unknown or unauthorized staff role.');
      setSubmitting(false);
    } catch (authErr: unknown) {
      console.warn('[Staff Login] Authentication error:', authErr);
      if (auth) {
        await signOut(auth).catch(() => {});
      }
      setCurrentTeamUser(null);
      try {
        localStorage.removeItem('fest_current_team_user_v2');
      } catch {
        // ignore storage error
      }

      const code =
        authErr && typeof authErr === 'object' && 'code' in authErr
          ? String((authErr as { code?: unknown }).code)
          : '';

      if (
        code === 'auth/invalid-credential' ||
        code === 'auth/wrong-password' ||
        code === 'auth/user-not-found' ||
        code === 'auth/invalid-email'
      ) {
        setError('Invalid email or password. Please verify your staff credentials.');
      } else if (code === 'auth/user-disabled') {
        setError('Access denied: This staff account has been disabled by fest administration.');
      } else if (code === 'auth/too-many-requests') {
        setError('Access temporarily disabled due to multiple failed login attempts. Please try again later.');
      } else if (code === 'auth/network-request-failed') {
        setError('Network error: Unable to reach the authentication service. Please check your connection.');
      } else {
        setError(
          (authErr instanceof Error ? authErr.message : '') ||
            'Authentication failed. Please verify your credentials.'
        );
      }
      setSubmitting(false);
    }
  };

  const festivalDisplayName =
    theme.festivalName?.trim() ||
    (themeSyncState === 'loading' ? 'Loading festival…' : 'Festival Gateway');
  const institutionDisplayName =
    theme.institutionName?.trim() ||
    (themeSyncState === 'loading' ? 'Loading institution…' : 'Festival Administration');

  return (
    <main className="staff-login">
      <div className="staff-login__ambient staff-login__ambient--one" aria-hidden="true" />
      <div className="staff-login__ambient staff-login__ambient--two" aria-hidden="true" />

      <div className="staff-login__shell">
        <header className="staff-login__topbar" aria-label="Staff login header">
          <div className="inline-flex items-center gap-2 text-xs font-semibold tracking-wider uppercase text-[#FDBF0F]">
            <Sparkles size={14} aria-hidden="true" />
            <span>Authorized Operations Center</span>
          </div>
          <FestivalStatusBadge className="staff-login__status" />
        </header>

        <div className="staff-login__layout">
          {/* Identity & Context Panel */}
          <section className="staff-login__intro" aria-labelledby="staff-festival-heading">
            <div className="staff-login__identity">
              <FestivalLogo size={68} className="staff-login__festival-logo" />
              <div className="staff-login__identity-copy">
                <span className="staff-login__eyebrow">
                  <ShieldCheck size={13} aria-hidden="true" />
                  Official Staff Gateway
                </span>
                <h2 id="staff-festival-heading" className="staff-login__festival-name festival-name">
                  {festivalDisplayName}
                </h2>
                <p className="staff-login__institution">{institutionDisplayName}</p>
              </div>
            </div>

            <div className="staff-login__welcome-copy">
              <span className="staff-login__section-kicker">Unified Staff Access</span>
              <h1>Festival Control &amp; Delegation Management</h1>
              <p>
                Secure portal for festival administrators, team contingent managers, and green room staff.
                Sign in with your verified credentials to access your designated operational workspace.
              </p>
            </div>

            <div className="staff-login__badges" aria-label="Authorized roles summary">
              <span className="staff-login__badge-item">
                <ShieldCheck size={14} aria-hidden="true" />
                Fest Administration
              </span>
              <span className="staff-login__badge-item">
                <Users size={14} aria-hidden="true" />
                Team Contingent Houses
              </span>
              <span className="staff-login__badge-item">
                <Compass size={14} aria-hidden="true" />
                Green Room Desk
              </span>
            </div>
          </section>

          {/* Secure Login Form Card */}
          <section className="staff-login__card" aria-label="Staff Login Form">
            <header className="staff-login__card-header">
              <span className="staff-login__section-kicker">Unified Credential Entry</span>
              <h2>Staff Sign In</h2>
              <p>Enter your official email and password to automatically route to your assigned portal.</p>
            </header>

            <form className="staff-login__form" onSubmit={handleSubmit} noValidate>
              {notice && (
                <div className="staff-login__notice staff-login__notice--info" role="status">
                  <Info size={16} aria-hidden="true" />
                  <span>{notice}</span>
                </div>
              )}

              {error && (
                <div className="staff-login__notice staff-login__notice--error" role="alert">
                  <AlertCircle size={16} aria-hidden="true" />
                  <span>{error}</span>
                </div>
              )}

              {/* Email Field */}
              <div className="staff-login__field">
                <label htmlFor="staff-email">
                  Work Email <span>*</span>
                </label>
                <div className="staff-login__input-wrap">
                  <Mail size={18} className="staff-login__input-icon" aria-hidden="true" />
                  <input
                    id="staff-email"
                    type="email"
                    autoComplete="email"
                    required
                    placeholder="name@festival.org"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    disabled={submitting}
                  />
                </div>
              </div>

              {/* Password Field with Show/Hide toggle */}
              <div className="staff-login__field">
                <label htmlFor="staff-password">
                  Password <span>*</span>
                </label>
                <div className="staff-login__input-wrap">
                  <Lock size={18} className="staff-login__input-icon" aria-hidden="true" />
                  <input
                    id="staff-password"
                    type={showPassword ? 'text' : 'password'}
                    autoComplete="current-password"
                    required
                    placeholder="Enter your account password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    disabled={submitting}
                  />
                  <button
                    type="button"
                    className="staff-login__toggle-pw"
                    onClick={() => setShowPassword(!showPassword)}
                    aria-label={showPassword ? 'Hide password' : 'Show password'}
                    title={showPassword ? 'Hide password' : 'Show password'}
                    tabIndex={0}
                  >
                    {showPassword ? <EyeOff size={16} aria-hidden="true" /> : <Eye size={16} aria-hidden="true" />}
                  </button>
                </div>
              </div>

              {/* Submit Button */}
              <button
                type="submit"
                className="staff-login__submit"
                disabled={submitting}
                aria-busy={submitting}
              >
                {submitting ? (
                  <>
                    <Loader2 size={16} className="animate-spin" aria-hidden="true" />
                    <span>Verifying Credentials…</span>
                  </>
                ) : (
                  <>
                    <LogIn size={16} aria-hidden="true" />
                    <span>Authenticate &amp; Enter</span>
                  </>
                )}
              </button>
            </form>

            <footer className="staff-login__card-footer">
              <ShieldCheck size={15} aria-hidden="true" />
              <span>Cryptographically Verified Multi-Role Security</span>
            </footer>
          </section>
        </div>
      </div>
    </main>
  );
}

export default function StaffLoginPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen bg-[#1B090B] flex items-center justify-center p-4 text-[#FFF8EE]">
          <div className="text-center space-y-3">
            <div className="w-8 h-8 border-2 border-[#FDBF0F] border-t-transparent rounded-full animate-spin mx-auto" />
            <p className="text-xs text-[#FDBF0F] font-medium tracking-wider uppercase">
              Loading Staff Gateway…
            </p>
          </div>
        </div>
      }
    >
      <StaffLoginForm />
    </Suspense>
  );
}
