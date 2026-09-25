import { useEffect, useId, useState } from 'react';
import { Link, Navigate, useLocation, useNavigate } from 'react-router';

import { LanguagePicker } from '@/components/LanguagePicker';
import { Wordmark } from '@/components/Mark';
import { Button } from '@/components/ui/button';
import { Field, Input } from '@/components/ui/field';
import { Problem, Spinner } from '@/components/ui/feedback';
import { useT } from '@/i18n';
import { auth as authApi } from '@/lib/api';
import { useAuth } from '@/lib/auth-store';
import { useDocumentTitle } from '@/lib/use-document-title';

/**
 * Where to go once signed in.
 *
 * Not `/`: on the usual deployment one origin serves the marketing site there,
 * and landing on it would take the person straight back out of the application.
 * What they were last working on is the answer, and a deep link they were
 * interrupted on beats even that.
 */
function landing(state: unknown): string {
  const from = (state as { from?: string } | null)?.from;
  if (typeof from === 'string' && from !== '/' && from !== '/login' && from !== '/register') {
    return from;
  }
  return '/recent';
}

export function AuthPage({ mode }: { mode: 'sign-in' | 'sign-up' }) {
  const t = useT();
  useDocumentTitle(mode === 'sign-in' ? t.auth.documentTitle.signIn : t.auth.documentTitle.signUp);
  const languageId = useId();
  const { status, signIn, signUp } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  // An invitation arrives as a link, so the field is usually already filled in
  // and there is nothing to type. It stays visible and editable: a link that
  // was pasted wrong should be fixable here rather than mysteriously refused.
  const fromLink = new URLSearchParams(location.search).get('invite') ?? '';
  const [inviteCode, setInviteCode] = useState(fromLink);
  const [codeRequired, setCodeRequired] = useState(false);
  const [error, setError] = useState<unknown>(null);
  const [busy, setBusy] = useState(false);

  // Asked for up front rather than after the form is filled in: being turned
  // away at the end for a field that was never shown is the worst version of
  // this. A failure to reach the server leaves the field hidden — the sign-up
  // itself will say what is wrong.
  useEffect(() => {
    if (mode !== 'sign-up') return;
    let live = true;
    authApi
      .providers()
      .then((providers) => live && setCodeRequired(providers.inviteCode))
      .catch(() => undefined);
    return () => {
      live = false;
    };
  }, [mode]);

  // Signing in again after a session ended mid-use goes straight back to where
  // it ended, not by way of /recent.
  if (status === 'signed-in') return <Navigate to={landing(location.state)} replace />;
  // Until the session has been asked about, this may be somebody who is about
  // to be sent straight past the form. Showing it now would flash it at them.
  if (status === 'loading') {
    return (
      <div className="grid min-h-dvh place-items-center">
        <Spinner />
      </div>
    );
  }

  const submit = async (event: React.FormEvent): Promise<void> => {
    event.preventDefault();
    setBusy(true);
    setError(null);
    try {
      if (mode === 'sign-in') await signIn(email, password);
      else await signUp(name, email, password, inviteCode.trim() || undefined);
      void navigate(landing(location.state), { replace: true });
    } catch (cause) {
      setError(cause);
    } finally {
      setBusy(false);
    }
  };

  return (
    /* The drafting grid is the same one the canvas uses: the material of the
       product is visible before you are inside it. */
    <div
      className="grid min-h-dvh place-items-center px-6"
      style={{
        backgroundImage:
          'linear-gradient(var(--grid-fine) 1px, transparent 1px), linear-gradient(90deg, var(--grid-fine) 1px, transparent 1px), linear-gradient(var(--grid-coarse) 1px, transparent 1px), linear-gradient(90deg, var(--grid-coarse) 1px, transparent 1px)',
        backgroundSize: '20px 20px, 20px 20px, 100px 100px, 100px 100px',
      }}
    >
      <div className="w-full max-w-sm rounded-xl bg-surface-2 p-6 elevated">
        <Wordmark className="text-ink" />
        <p className="mt-4 text-sm text-ink-muted">
          {mode === 'sign-in' ? t.auth.intro.signIn : t.auth.intro.signUp}
        </p>

        <form className="mt-6 space-y-4" onSubmit={(event) => void submit(event)}>
          {mode === 'sign-up' ? (
            <Field label={t.auth.name}>
              {(id) => (
                <Input
                  id={id}
                  autoComplete="name"
                  value={name}
                  onChange={(event) => setName(event.target.value)}
                  required
                />
              )}
            </Field>
          ) : null}

          <Field label={t.auth.email}>
            {(id) => (
              <Input
                id={id}
                type="email"
                autoComplete="email"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                required
              />
            )}
          </Field>

          <Field
            label={t.auth.password}
            hint={mode === 'sign-up' ? t.auth.passwordHint : undefined}
          >
            {(id) => (
              <Input
                id={id}
                type="password"
                autoComplete={mode === 'sign-in' ? 'current-password' : 'new-password'}
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                required
                minLength={mode === 'sign-up' ? 10 : undefined}
              />
            )}
          </Field>

          {mode === 'sign-up' && (codeRequired || fromLink !== '') ? (
            <Field
              label={t.auth.invitation.label}
              hint={fromLink === '' ? t.auth.invitation.byInvitation : t.auth.invitation.fromLink}
            >
              {(id) => (
                <Input
                  id={id}
                  value={inviteCode}
                  onChange={(event) => setInviteCode(event.target.value)}
                  required
                  autoComplete="off"
                />
              )}
            </Field>
          ) : null}

          {error !== null ? <Problem error={error} /> : null}

          <Button type="submit" variant="primary" className="w-full" disabled={busy}>
            {mode === 'sign-in' ? t.auth.submit.signIn : t.auth.submit.signUp}
          </Button>
        </form>

        <p className="mt-5 border-t border-rule pt-4 text-xs text-ink-muted">
          {mode === 'sign-in'
            ? t.auth.switch.noAccount(
                <Link to="/register" className="text-accent underline">
                  {t.auth.switch.createOne}
                </Link>,
              )
            : t.auth.switch.haveAccount(
                <Link to="/login" className="text-accent underline">
                  {t.auth.switch.signIn}
                </Link>,
              )}
        </p>

        <div className="mt-4 flex items-center justify-end gap-2">
          <label htmlFor={languageId} className="text-xs text-ink-faint">
            {t.common.language}
          </label>
          <LanguagePicker id={languageId} className="w-auto py-1 text-xs" />
        </div>
      </div>
    </div>
  );
}
