'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  ArrowLeft,
  CalendarDays,
  IdCard,
  LogIn,
  ShieldCheck,
  Sparkles,
  Trophy,
} from 'lucide-react';
import { useFest } from '@/context/FestContext';
import { FestivalLogo, FestivalStatusBadge } from '@/components/domain/FestivalBrand';
import './participant-login.css';

export default function ParticipantLoginPage() {
  const router = useRouter();
  const { theme, themeSyncState } = useFest();
  const [bib, setBib] = useState('');
  const [dob, setDob] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  const festivalName = theme.festivalName?.trim()
    || (themeSyncState === 'loading' ? 'Loading festival…' : 'Festival Portal');
  const institutionName = theme.institutionName?.trim()
    || (themeSyncState === 'loading' ? 'Loading institution…' : 'Official participant access');

  const handleLogin = async (event: React.FormEvent) => {
    event.preventDefault();
    setSubmitting(true);
    setError('');
    try {
      const response = await fetch('/api/participant/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'same-origin',
        cache: 'no-store',
        body: JSON.stringify({ bib: bib.trim(), dob })
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data.error || 'Sign in failed.');
      router.replace('/participant');
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to sign in.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <main className="participant-login">
      <div className="participant-login__ambient participant-login__ambient--one" aria-hidden="true" />
      <div className="participant-login__ambient participant-login__ambient--two" aria-hidden="true" />

      <div className="participant-login__shell">
        <nav className="participant-login__topbar" aria-label="Participant login navigation">
          <Link href="/" className="participant-login__back-link">
            <ArrowLeft aria-hidden="true" size={17} />
            <span>Back to Festival Home</span>
          </Link>
          <FestivalStatusBadge className="participant-login__status" />
        </nav>

        <div className="participant-login__layout">
          <section className="participant-login__intro" aria-labelledby="participant-festival-name">
            <div className="participant-login__identity">
              <FestivalLogo size={62} className="participant-login__festival-logo" />
              <div className="participant-login__identity-copy">
                <span className="participant-login__eyebrow">
                  <Sparkles size={13} aria-hidden="true" />
                  Official Participant Access
                </span>
                <h1 id="participant-festival-name" className="participant-login__festival-name festival-name">
                  {festivalName}
                </h1>
                <p className="participant-login__institution">{institutionName}</p>
              </div>
            </div>

            <div className="participant-login__welcome-copy">
              <span className="participant-login__section-kicker">Your Festival Journey</span>
              <h2>Everything about your participation, in one place.</h2>
              <p>
                Sign in to keep your festival information close. View your competition
                schedule, follow published results and access your digital ID card.
              </p>
            </div>

            <div className="participant-login__feature-list" aria-label="Participant portal features">
              <div className="participant-login__feature">
                <span className="participant-login__feature-icon">
                  <CalendarDays size={18} aria-hidden="true" />
                </span>
                <span>
                  <strong>Competition Schedule</strong>
                  <small>Know your event details</small>
                </span>
              </div>
              <div className="participant-login__feature">
                <span className="participant-login__feature-icon">
                  <Trophy size={18} aria-hidden="true" />
                </span>
                <span>
                  <strong>Published Results</strong>
                  <small>Follow your achievements</small>
                </span>
              </div>
              <div className="participant-login__feature">
                <span className="participant-login__feature-icon">
                  <IdCard size={18} aria-hidden="true" />
                </span>
                <span>
                  <strong>Digital ID Card</strong>
                  <small>Keep your participant ID handy</small>
                </span>
              </div>
            </div>
          </section>

          <section className="participant-login__card" aria-labelledby="participant-login-title">
            <header className="participant-login__card-header">
              <span className="participant-login__section-kicker">Participant Portal</span>
              <h2 id="participant-login-title">Welcome back</h2>
              <p>Enter your Bib Number and Date of Birth to sign in.</p>
            </header>

            <form className="participant-login__form" onSubmit={handleLogin}>
              <div className="participant-login__field">
                <label htmlFor="participant-bib">
                  Bib Number <span aria-hidden="true">*</span>
                </label>
                <div className="participant-login__input-wrap">
                  <IdCard className="participant-login__input-icon" aria-hidden="true" size={19} />
                  <input
                    id="participant-bib"
                    name="bib"
                    type="text"
                    required
                    inputMode="numeric"
                    autoComplete="username"
                    maxLength={10}
                    value={bib}
                    onChange={e => setBib(e.target.value)}
                    placeholder="e.g. 1042 or #1042"
                  />
                </div>
                <p className="participant-login__field-help">
                  Use the short Bib Number printed on your Digital ID Card. Both 1042 and #1042 work.
                </p>
              </div>

              <div className="participant-login__field">
                <label htmlFor="participant-dob">
                  Date of Birth <span aria-hidden="true">*</span>
                </label>
                <div className="participant-login__input-wrap">
                  <CalendarDays className="participant-login__input-icon" aria-hidden="true" size={19} />
                  <input
                    id="participant-dob"
                    name="dob"
                    type="date"
                    required
                    autoComplete="bday"
                    value={dob}
                    onChange={e => setDob(e.target.value)}
                  />
                </div>
              </div>

              {error && (
                <p role="alert" className="participant-login__error">
                  {error}
                </p>
              )}

              <button
                type="submit"
                disabled={!bib.trim() || !dob || submitting}
                className="participant-login__submit"
              >
                {submitting ? (
                  <span className="participant-login__spinner" aria-hidden="true" />
                ) : (
                  <LogIn aria-hidden="true" size={18} />
                )}
                <span>{submitting ? 'Signing In…' : 'Sign In to My Portal'}</span>
              </button>

              <div className="participant-login__security-note">
                <ShieldCheck size={19} aria-hidden="true" />
                <p>
                  Your account shows only information belonging to you. Contact your
                  Team Manager if your Bib Number or registered Date of Birth is incorrect.
                </p>
              </div>
            </form>
          </section>
        </div>

        <footer className="participant-login__footer">
          <span>{festivalName}</span>
          <span className="participant-login__footer-dot" aria-hidden="true" />
          <span>Secure Participant Access</span>
        </footer>
      </div>
    </main>
  );
}
