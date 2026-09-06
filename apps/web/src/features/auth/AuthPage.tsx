import { useState } from 'react';
import { Link, Navigate, useLocation, useNavigate } from 'react-router';

import { Wordmark } from '@/components/Mark';
import { Button } from '@/components/ui/button';
import { Field, Input } from '@/components/ui/field';
import { Problem } from '@/components/ui/feedback';
import { workspaces } from '@/lib/api';
import { useAuth } from '@/lib/auth-store';

/**
 * Where to go once signed in.
 *
 * Not `/`: on the usual deployment one origin serves the marketing site there,
 * and landing on it would take the person straight back out of the application.
 * Their own workspace is the answer, and a deep link they were interrupted on
 * beats even that.
 */
async function landing(state: unknown): Promise<string> {
  const from = (state as { from?: string } | null)?.from;
  if (typeof from === 'string' && from !== '/' && from !== '/login' && from !== '/register') {
    return from;
  }
  const list = await workspaces.list().catch(() => []);
  const first = list[0];
  return first === undefined ? '/' : `/workspace/${first.slug}`;
}

export function AuthPage({ mode }: { mode: 'sign-in' | 'sign-up' }) {
  const { status, signIn, signUp } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<unknown>(null);
  const [busy, setBusy] = useState(false);

  if (status === 'signed-in') return <Navigate to="/" replace />;

  const submit = async (event: React.FormEvent): Promise<void> => {
    event.preventDefault();
    setBusy(true);
    setError(null);
    try {
      if (mode === 'sign-in') await signIn(email, password);
      else await signUp(name, email, password);
      void navigate(await landing(location.state), { replace: true });
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
      <div className="fixed top-3 right-3">
      </div>

      <div className="w-full max-w-sm border border-rule bg-surface p-6">
        <Wordmark className="text-ink" />
        <p className="mt-4 text-sm text-ink-muted">
          {mode === 'sign-in'
            ? 'Sign in to your plans.'
            : 'Set up an account and a workspace to plan in.'}
        </p>

        <form className="mt-6 space-y-4" onSubmit={(event) => void submit(event)}>
          {mode === 'sign-up' ? (
            <Field label="Name">
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

          <Field label="Email">
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
            label="Password"
            hint={mode === 'sign-up' ? 'At least 10 characters.' : undefined}
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

          {error !== null ? <Problem error={error} /> : null}

          <Button type="submit" variant="primary" className="w-full" disabled={busy}>
            {mode === 'sign-in' ? 'Sign in' : 'Create account'}
          </Button>
        </form>

        <p className="mt-5 border-t border-rule pt-4 text-xs text-ink-muted">
          {mode === 'sign-in' ? (
            <>
              No account yet?{' '}
              <Link to="/register" className="text-accent underline">
                Create one
              </Link>
            </>
          ) : (
            <>
              Already have an account?{' '}
              <Link to="/login" className="text-accent underline">
                Sign in
              </Link>
            </>
          )}
        </p>
      </div>
    </div>
  );
}
