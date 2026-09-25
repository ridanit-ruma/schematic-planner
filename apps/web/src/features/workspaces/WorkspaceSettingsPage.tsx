import { useState } from 'react';
import { useNavigate } from 'react-router';

import { Button } from '@/components/ui/button';
import { Field, Input } from '@/components/ui/field';
import { Problem } from '@/components/ui/feedback';
import { Modal } from '@/components/ui/modal';
import { workspaces } from '@/lib/api';
import { useWorkspace } from './workspace-context';
import { useDocumentTitle } from '@/lib/use-document-title';
import { useT } from '@/i18n';

export function WorkspaceSettingsPage() {
  const t = useT();
  const m = t.workspaces.settings;
  useDocumentTitle(m.title);
  const { current, reload } = useWorkspace();
  const navigate = useNavigate();

  const [name, setName] = useState(current.name);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<unknown>(null);
  const [deleting, setDeleting] = useState(false);
  const [confirm, setConfirm] = useState('');

  const canRename = current.role === 'OWNER' || current.role === 'ADMIN';
  const canDelete = current.role === 'OWNER';

  const save = async (): Promise<void> => {
    try {
      await workspaces.update(current.id, name.trim());
      setError(null);
      setSaved(true);
      window.setTimeout(() => setSaved(false), 2000);
      reload();
    } catch (cause) {
      setError(cause);
    }
  };

  return (
    <div className="mx-auto max-w-2xl px-6 py-7">
      <h1 className="text-lg font-semibold tracking-tight text-ink">{m.title}</h1>

      {error !== null ? (
        <div className="mt-4">
          <Problem error={error} />
        </div>
      ) : null}

      <section className="mt-8 rounded-lg border border-rule bg-surface-2 p-4">
        <h2 className="text-sm font-medium text-ink">{m.name.title}</h2>
        <p className="mt-1 text-xs text-ink-muted">
          {m.name.body(<code className="slug">{current.slug}</code>)}
        </p>
        <form
          className="mt-4 flex items-end gap-2"
          onSubmit={(event) => {
            event.preventDefault();
            void save();
          }}
        >
          <div className="flex-1">
            <Field label={m.name.label}>
              {(id) => (
                <Input
                  id={id}
                  value={name}
                  disabled={!canRename}
                  onChange={(event) => setName(event.target.value)}
                />
              )}
            </Field>
          </div>
          <Button
            type="submit"
            variant="primary"
            disabled={!canRename || name.trim() === '' || name.trim() === current.name}
          >
            {saved ? t.common.saved : t.common.save}
          </Button>
        </form>
      </section>

      {canDelete ? (
        <section className="mt-6 rounded-lg border border-danger/20 bg-surface-2 p-4">
          <h2 className="text-sm font-medium text-ink">{m.delete.title}</h2>
          <p className="mt-1 max-w-prose text-xs text-ink-muted">{m.delete.body(current.name)}</p>
          <Button variant="danger" className="mt-4" onClick={() => setDeleting(true)}>
            {m.delete.action}
          </Button>
        </section>
      ) : null}

      <Modal
        open={deleting}
        onOpenChange={setDeleting}
        title={m.delete.confirmTitle(current.name)}
        description={m.delete.confirmBody}
      >
        <form
          className="space-y-4"
          onSubmit={(event) => {
            event.preventDefault();
            void workspaces
              .remove(current.id, confirm)
              .then(() => navigate('/'))
              .catch(setError);
          }}
        >
          <Field label={m.delete.typeName(current.name)}>
            {(id) => (
              <Input
                id={id}
                autoFocus
                value={confirm}
                onChange={(event) => setConfirm(event.target.value)}
              />
            )}
          </Field>
          <div className="flex justify-end gap-2">
            <Button type="button" variant="ghost" onClick={() => setDeleting(false)}>
              {t.common.cancel}
            </Button>
            <Button type="submit" variant="danger" disabled={confirm !== current.name}>
              {m.delete.action}
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
