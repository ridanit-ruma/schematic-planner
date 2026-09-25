import { Trash2 } from 'lucide-react';
import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router';

import { Button } from '@/components/ui/button';
import { Field, Input, Textarea } from '@/components/ui/field';
import { NotFound, Problem, Spinner } from '@/components/ui/feedback';
import { Modal } from '@/components/ui/modal';
import { Page, Panel } from '@/components/ui/page';
import { useT } from '@/i18n';
import { canAdminister, isMissing, projects } from '@/lib/api';
import { useWorkspace } from './workspace-context';

/** What a project is called, and getting rid of it. The plans inside are the project's own screen. */
export function ProjectSettingsPage() {
  const { current } = useWorkspace();
  const { projectSlug = '' } = useParams();
  const navigate = useNavigate();

  const [id, setId] = useState<string | null>(null);
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<unknown>(null);
  const [deleting, setDeleting] = useState(false);
  const t = useT();
  const m = t.workspaces;

  useEffect(() => {
    let live = true;
    projects
      .bySlug(current.id, projectSlug)
      .then((found) => projects.read(found.id))
      .then((project) => {
        if (!live) return;
        setId(project.id);
        setName(project.name);
        setDescription(project.description);
      })
      .catch(setError);
    return () => {
      live = false;
    };
  }, [current.id, projectSlug]);

  // An address that leads nowhere you can reach is not an error on a page;
  // it is the absence of the page.
  if (isMissing(error)) return <NotFound subject="project" />;

  if (error !== null && id === null) {
    return (
      <Page title={m.projectSettings.title} width="narrow">
        <Problem error={error} />
      </Page>
    );
  }
  if (id === null) {
    return (
      <div className="grid py-24 place-items-center">
        <Spinner />
      </div>
    );
  }

  const save = async (): Promise<void> => {
    const trimmed = name.trim();
    if (trimmed === '') return;
    try {
      await projects.update(id, { name: trimmed, description });
      setSaved(true);
      window.setTimeout(() => setSaved(false), 1600);
    } catch (cause) {
      setError(cause);
    }
  };

  const remove = async (): Promise<void> => {
    try {
      await projects.remove(id);
      void navigate(`/workspace/${current.slug}`);
    } catch (cause) {
      setError(cause);
    }
  };

  return (
    <Page
      title={name}
      description={m.projectSettings.description}
      width="narrow"
      actions={
        <Button
          variant="quiet"
          onClick={() => void navigate(`/workspace/${current.slug}/project/${projectSlug}`)}
        >
          {m.projectSettings.openPlans}
        </Button>
      }
    >
      <div className="space-y-6">
        {error !== null ? <Problem error={error} /> : null}

        <Panel title={m.projectSettings.name.title} description={m.projectSettings.name.body}>
          <form
            className="space-y-3"
            onSubmit={(event) => {
              event.preventDefault();
              void save();
            }}
          >
            <Field label={m.projectSettings.name.label}>
              {(fieldId) => (
                <Input
                  id={fieldId}
                  value={name}
                  onChange={(event) => setName(event.target.value)}
                />
              )}
            </Field>
            <Field label={m.projectSettings.name.description}>
              {(fieldId) => (
                <Textarea
                  id={fieldId}
                  rows={2}
                  value={description}
                  onChange={(event) => setDescription(event.target.value)}
                />
              )}
            </Field>
            <div className="flex items-center gap-3">
              <Button type="submit" variant="primary" disabled={name.trim() === ''}>
                {t.common.save}
              </Button>
              {saved ? <span className="text-xs text-status-done">{t.common.saved}</span> : null}
              <span className="slug ml-auto text-ink-faint">{projectSlug}</span>
            </div>
          </form>
        </Panel>

        {canAdminister(current.role) ? (
          <Panel
            title={m.projectSettings.delete.title}
            tone="danger"
            description={m.projectSettings.delete.body}
          >
            <Button variant="danger" onClick={() => setDeleting(true)}>
              <Trash2 className="size-3.5" />
              {m.list.moveToTrash}
            </Button>
          </Panel>
        ) : null}
      </div>

      <Modal
        open={deleting}
        onOpenChange={setDeleting}
        title={m.list.confirmTrash(name)}
        description={m.projects.trashBody}
      >
        <div className="flex justify-end gap-2">
          <Button variant="ghost" onClick={() => setDeleting(false)}>
            {t.common.cancel}
          </Button>
          <Button variant="danger" onClick={() => void remove()}>
            <Trash2 className="size-3.5" />
            {m.list.moveToTrash}
          </Button>
        </div>
      </Modal>
    </Page>
  );
}
