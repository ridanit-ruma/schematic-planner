import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router';

import { Avatar } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { Field, Input } from '@/components/ui/field';
import { Problem, Spinner } from '@/components/ui/feedback';
import { Modal } from '@/components/ui/modal';
import { account, type SessionSummary } from '@/lib/api';
import { useAuth } from '@/lib/auth-store';
import { formatWhen } from '@/lib/utils';
import { AvatarEditor } from './AvatarEditor';
import { LanguagePicker } from '@/components/LanguagePicker';
import { useT, type Messages } from '@/i18n';
import { useDocumentTitle } from '@/lib/use-document-title';

/** Reads "Chrome on Linux" out of a user-agent string, or gives up honestly. */
function describeClient(userAgent: string | null, t: Messages): string {
  if (userAgent === null || userAgent.trim() === '') return t.account.client.unknown;

  const browser = /Firefox\/[\d.]+/.test(userAgent)
    ? 'Firefox'
    : /Edg\//.test(userAgent)
      ? 'Edge'
      : /Chrome\//.test(userAgent)
        ? 'Chrome'
        : /Safari\//.test(userAgent)
          ? 'Safari'
          : t.account.client.unknownBrowser;

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
            : t.account.client.unknownPlatform;

  return t.account.client.on(browser, platform);
}

export function AccountSettingsPage() {
  const t = useT();
  useDocumentTitle(t.account.documentTitle);
  const { user, signOut, patchUser } = useAuth();
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
  const [picking, setPicking] = useState<File | null>(null);
  const pick = useRef<HTMLInputElement>(null);

  const reloadSessions = (): void => {
    account.sessions().then(setSessions).catch(setError);
  };
  useEffect(reloadSessions, []);

  return (
    <>
      {error !== null ? <Problem error={error} /> : null}

      <section className="rounded-lg border border-rule bg-surface-2 p-4">
        <h2 className="text-sm font-medium text-ink">{t.common.language}</h2>
        <div className="mt-4 max-w-56">
          <LanguagePicker />
        </div>
      </section>

      <section className="rounded-lg border border-rule bg-surface-2 p-4">
        <h2 className="text-sm font-medium text-ink">{t.account.picture.title}</h2>
        <p className="mt-1 text-xs text-ink-muted">{t.account.picture.body}</p>
        <div className="mt-4 flex items-center gap-4">
          <Avatar
            src={user?.avatarUrl}
            name={user?.name ?? '?'}
            className="size-16 rounded-md text-lg"
          />
          <div className="flex gap-2">
            <input
              ref={pick}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={(event) => {
                const file = event.target.files?.[0] ?? null;
                event.target.value = '';
                if (file !== null) setPicking(file);
              }}
            />
            <Button type="button" variant="ghost" onClick={() => pick.current?.click()}>
              {user?.avatarUrl == null || user.avatarUrl === ''
                ? t.account.picture.add
                : t.account.picture.replace}
            </Button>
            {user?.avatarUrl != null && user.avatarUrl !== '' ? (
              <Button
                type="button"
                variant="ghost"
                onClick={() => {
                  void account
                    .clearAvatar()
                    .then(() => {
                      setError(null);
                      patchUser({ avatarUrl: null });
                    })
                    .catch(setError);
                }}
              >
                {t.common.remove}
              </Button>
            ) : null}
          </div>
        </div>
      </section>

      <Modal
        open={picking !== null}
        onOpenChange={(open) => !open && setPicking(null)}
        title={t.account.picture.modalTitle}
      >
        {picking === null ? null : (
          <AvatarEditor
            file={picking}
            onCancel={() => setPicking(null)}
            onDone={async (png) => {
              try {
                const { avatarUrl } = await account.setAvatar(png);
                patchUser({ avatarUrl });
                setError(null);
                setPicking(null);
              } catch (cause) {
                setError(cause);
                setPicking(null);
              }
            }}
          />
        )}
      </Modal>

      <section className="rounded-lg border border-rule bg-surface-2 p-4">
        <h2 className="text-sm font-medium text-ink">{t.account.name.title}</h2>
        <p className="mt-1 text-xs text-ink-muted">
          {t.account.name.emailNote(<span className="text-ink">{user?.email}</span>)}
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
            <Field label={t.account.name.label}>
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
            {nameSaved ? t.common.saved : t.common.save}
          </Button>
        </form>
      </section>

      <section className="rounded-lg border border-rule bg-surface-2 p-4">
        <h2 className="text-sm font-medium text-ink">{t.account.password.title}</h2>
        <p className="mt-1 text-xs text-ink-muted">{t.account.password.body}</p>
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
          <Field label={t.account.password.current}>
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
          <Field label={t.account.password.new} hint={t.account.password.newHint}>
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
            {passwordSaved ? t.account.password.changed : t.account.password.change}
          </Button>
        </form>
      </section>

      <section className="rounded-lg border border-rule bg-surface-2 p-4">
        <div className="flex items-start justify-between gap-4">
          <div className="min-w-0">
            <h2 className="text-sm font-medium text-ink">{t.account.sessions.title}</h2>
            <p className="mt-1 text-xs text-ink-muted">{t.account.sessions.body}</p>
          </div>
          {sessions !== null && sessions.length > 1 ? (
            <Button
              size="sm"
              variant="quiet"
              onClick={() => void account.revokeOthers().then(reloadSessions).catch(setError)}
            >
              {t.account.sessions.endOthers}
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
                    {describeClient(session.userAgent, t)}
                    {session.current ? (
                      <span className="ml-2 text-xs text-ink-faint">
                        {t.account.sessions.thisOne}
                      </span>
                    ) : null}
                  </span>
                  <span className="block text-xs text-ink-muted">
                    {t.account.sessions.started(formatWhen(session.createdAt))}
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
                    {t.account.sessions.end}
                  </Button>
                ) : null}
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="rounded-lg border border-danger/20 bg-surface-2 p-4">
        <h2 className="text-sm font-medium text-ink">{t.account.remove.title}</h2>
        <p className="mt-1 max-w-prose text-xs text-ink-muted">{t.account.remove.body}</p>
        <Button variant="danger" className="mt-4" onClick={() => setDeleting(true)}>
          {t.account.remove.button}
        </Button>
      </section>

      <Modal
        open={deleting}
        onOpenChange={setDeleting}
        title={t.account.remove.modalTitle}
        description={t.account.remove.modalDescription}
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
          <Field label={t.account.remove.password}>
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
              {t.common.cancel}
            </Button>
            <Button type="submit" variant="danger" disabled={deletePassword === ''}>
              {t.account.remove.confirm}
            </Button>
          </div>
        </form>
      </Modal>
    </>
  );
}
