import { useState } from 'react';
import { useNavigate } from 'react-router';

import { Button } from '@/components/ui/button';
import { Field, Input } from '@/components/ui/field';
import { Problem } from '@/components/ui/feedback';
import { Modal } from '@/components/ui/modal';
import { workspaces } from '@/lib/api';
import { useWorkspace } from './workspace-context';

export function WorkspaceSettingsPage() {
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
    <div className="mx-auto max-w-2xl px-6 py-10">
      <h1 className="text-xl font-medium text-ink">Workspace settings</h1>

      {error !== null ? (
        <div className="mt-4">
          <Problem error={error} />
        </div>
      ) : null}

      <section className="mt-8 border border-rule bg-surface p-4">
        <h2 className="text-sm font-medium text-ink">Name</h2>
        <p className="mt-1 text-xs text-ink-muted">
          The address stays <code className="slug">{current.slug}</code> — a link somebody saved
          should survive a change of mind about the name.
        </p>
        <form
          className="mt-4 flex items-end gap-2"
          onSubmit={(event) => {
            event.preventDefault();
            void save();
          }}
        >
          <div className="flex-1">
            <Field label="Workspace name">
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
            {saved ? 'Saved' : 'Save'}
          </Button>
        </form>
      </section>

      {canDelete ? (
        <section className="mt-6 border border-danger/40 bg-surface p-4">
          <h2 className="text-sm font-medium text-ink">Delete this workspace</h2>
          <p className="mt-1 max-w-prose text-xs text-ink-muted">
            Every project, plan and API key in {current.name} goes with it, for everybody. Export
            anything you want to keep first — the export needs nothing from this service to be
            readable.
          </p>
          <Button variant="danger" className="mt-4" onClick={() => setDeleting(true)}>
            Delete workspace
          </Button>
        </section>
      ) : null}

      <Modal
        open={deleting}
        onOpenChange={setDeleting}
        title={`Delete ${current.name}`}
        description="This cannot be undone. Type the workspace name to confirm."
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
          <Field label={`Type "${current.name}"`}>
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
              Cancel
            </Button>
            <Button type="submit" variant="danger" disabled={confirm !== current.name}>
              Delete workspace
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
