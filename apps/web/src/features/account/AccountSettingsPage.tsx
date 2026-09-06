import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router';

import { Button } from '@/components/ui/button';
import { Field, Input } from '@/components/ui/field';
import { Problem, Spinner } from '@/components/ui/feedback';
import { Modal } from '@/components/ui/modal';
import { account, type SessionSummary } from '@/lib/api';
import { useAuth } from '@/lib/auth-store';
import { formatWhen } from '@/lib/utils';

/** Reads "Chrome on Linux" out of a user-agent string, or gives up honestly. */
function describeClient(userAgent: string | null): string {
  if (userAgent === null || userAgent.trim() === '') return 'Unknown client';

  const browser =
    /Firefox\/[\d.]+/.test(userAgent)
      ? 'Firefox'
      : /Edg\//.test(userAgent)
        ? 'Edge'
        : /Chrome\//.test(userAgent)
          ? 'Chrome'
          : /Safari\//.test(userAgent)
            ? 'Safari'
            : 'Unknown browser';

  const platform = /Windows/.test(userAgent)
    ? 'Windows'
    : /Macintosh|Mac OS/.test(userAgent)
      ? 'macOS'
      : /Android/.test(userAgent)
        ? 'Android'
        : /iPhone|iPad/.test(userAgent)
          ? 'iOS'
          : /Linux/.test(userAgent)
            ? 'Linux'
            : 'unknown platform';

  return `${browser} on ${platform}`;
}

export function AccountSettingsPage() {
  const { user, signOut } = useAuth();
  const navigate = useNavigate();

  const [name, setName] = useState(user?.name ?? '');
  const [nameSaved, setNameSaved] = useState(false);
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [passwordSaved, setPasswordSaved] = useState(false);
  const [sessions, setSessions] = useState<SessionSummary[] | null>(null);
  const [error, setError] = useState<unknown>(null);
  const [deleting, setDeleting] = useState(false);
  const [deletePassword, setDeletePassword] = useState('');

  const reloadSessions = (): void => {
    account.sessions().then(setSessions).catch(setError);
  };
  useEffect(reloadSessions, []);

  return (
    <div className="mx-auto max-w-2xl px-6 py-10">
      <h1 className="text-xl font-medium text-ink">Your account</h1>

      {error !== null ? (
        <div className="mt-4">
          <Problem error={error} />
        </div>
      ) : null}

      <section className="mt-8 border border-rule bg-surface p-4">
        <h2 className="text-sm font-medium text-ink">Name</h2>
        <p className="mt-1 text-xs text-ink-muted">
          What the people you share a workspace with see. Your email is{' '}
          <span className="text-ink">{user?.email}</span>; changing it needs email delivery, which is
          not built yet.
        </p>
        <form
          className="mt-4 flex items-end gap-2"
          onSubmit={(event) => {
            event.preventDefault();
            void account
              .updateName(name.trim())
              .then(() => {
                setError(null);
                setNameSaved(true);
                window.setTimeout(() => setNameSaved(false), 2000);
              })
              .catch(setError);
          }}
        >
          <div className="flex-1">
            <Field label="Display name">
              {(id) => (
                <Input id={id} value={name} onChange={(event) => setName(event.target.value)} />
              )}
            </Field>
          </div>
          <Button
            type="submit"
            variant="primary"
            disabled={name.trim() === '' || name.trim() === user?.name}
          >
            {nameSaved ? 'Saved' : 'Save'}
          </Button>
        </form>
      </section>

      <section className="mt-6 border border-rule bg-surface p-4">
        <h2 className="text-sm font-medium text-ink">Password</h2>
        <p className="mt-1 text-xs text-ink-muted">
          Changing it signs out every other session. If you are changing it because you think it
          leaked, that is the point.
        </p>
        <form
          className="mt-4 space-y-3"
          onSubmit={(event) => {
            event.preventDefault();
            void account
              .changePassword(currentPassword, newPassword)
              .then(() => {
                setError(null);
                setCurrentPassword('');
                setNewPassword('');
                setPasswordSaved(true);
                window.setTimeout(() => setPasswordSaved(false), 2500);
                reloadSessions();
              })
              .catch(setError);
          }}
        >
          <Field label="Current password">
            {(id) => (
              <Input
                id={id}
                type="password"
                autoComplete="current-password"
                value={currentPassword}
                onChange={(event) => setCurrentPassword(event.target.value)}
              />
            )}
          </Field>
          <Field label="New password" hint="At least 10 characters.">
            {(id) => (
              <Input
                id={id}
                type="password"
                autoComplete="new-password"
                minLength={10}
                value={newPassword}
                onChange={(event) => setNewPassword(event.target.value)}
              />
            )}
          </Field>
          <Button
            type="submit"
            variant="primary"
            disabled={currentPassword === '' || newPassword.length < 10}
          >
            {passwordSaved ? 'Password changed' : 'Change password'}
          </Button>
        </form>
      </section>

      <section className="mt-6 border border-rule bg-surface p-4">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h2 className="text-sm font-medium text-ink">Where you are signed in</h2>
            <p className="mt-1 text-xs text-ink-muted">
              End a session you do not recognise. This one stays.
            </p>
          </div>
          {sessions !== null && sessions.length > 1 ? (
            <Button
              size="sm"
              variant="quiet"
              onClick={() => void account.revokeOthers().then(reloadSessions).catch(setError)}
            >
              End the others
            </Button>
          ) : null}
        </div>

        {sessions === null ? (
          <div className="grid py-8 place-items-center">
            <Spinner />
          </div>
        ) : (
          <ul className="mt-4 divide-y divide-rule border-t border-rule">
            {sessions.map((session) => (
              <li key={session.id} className="flex items-center justify-between gap-4 py-2.5">
                <div className="min-w-0">
                  <span className="block truncate text-sm text-ink">
                    {describeClient(session.userAgent)}
                    {session.current ? (
                      <span className="ml-2 text-xs text-ink-faint">this one</span>
                    ) : null}
                  </span>
                  <span className="block text-xs text-ink-muted">
                    Started {formatWhen(session.createdAt)}
                  </span>
                </div>
                {!session.current ? (
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() =>
                      void account.revokeSession(session.id).then(reloadSessions).catch(setError)
                    }
                  >
                    End
                  </Button>
                ) : null}
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="mt-6 border border-danger/40 bg-surface p-4">
        <h2 className="text-sm font-medium text-ink">Delete your account</h2>
        <p className="mt-1 max-w-prose text-xs text-ink-muted">
          Everything you own goes with it: workspaces where you are the only owner, and every
          project and plan inside them. Export what you want to keep first.
        </p>
        <Button variant="danger" className="mt-4" onClick={() => setDeleting(true)}>
          Delete account
        </Button>
      </section>

      <Modal
        open={deleting}
        onOpenChange={setDeleting}
        title="Delete your account"
        description="This cannot be undone. Confirm with your password."
      >
        <form
          className="space-y-4"
          onSubmit={(event) => {
            event.preventDefault();
            void account
              .remove(deletePassword)
              .then(async () => {
                await signOut();
                void navigate('/login');
              })
              .catch(setError);
          }}
        >
          <Field label="Password">
            {(id) => (
              <Input
                id={id}
                type="password"
                autoFocus
                autoComplete="current-password"
                value={deletePassword}
                onChange={(event) => setDeletePassword(event.target.value)}
              />
            )}
          </Field>
          <div className="flex justify-end gap-2">
            <Button type="button" variant="ghost" onClick={() => setDeleting(false)}>
              Cancel
            </Button>
            <Button type="submit" variant="danger" disabled={deletePassword === ''}>
              Delete my account
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
