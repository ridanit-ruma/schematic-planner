import { ArrowRight, Trash2 } from 'lucide-react';
import { useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router';

import { Button } from '@/components/ui/button';
import { Field, Input, Textarea } from '@/components/ui/field';
import { Problem, Spinner } from '@/components/ui/feedback';
import { Modal } from '@/components/ui/modal';
import { Page, Panel } from '@/components/ui/page';
import { Select } from '@/components/ui/select';
import { plans, projects as projectsApi, type PlanNavigation } from '@/lib/api';
import { useWorkspaces } from '@/features/workspaces/workspace-context';

/**
 * Everything about a plan that is not the drawing: what it is called, where it
 * lives, and getting rid of it. A page rather than a panel because it is where
 * the settings a plan grows will go, and because the row menu that opens it is
 * a long way from the canvas.
 */
export function PlanSettingsPage() {
  const { planId = '' } = useParams();
  const navigate = useNavigate();
  const { all } = useWorkspaces();

  const [nav, setNav] = useState<PlanNavigation | null>(null);
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<unknown>(null);
  const [deleting, setDeleting] = useState(false);

  // Where it should go. The workspace decides which projects are on offer, so
  // picking one has to fetch that workspace's projects.
  const [workspaceId, setWorkspaceId] = useState('');
  const [options, setOptions] = useState<{ id: string; name: string }[] | null>(null);
  const [target, setTarget] = useState('');
  const [moving, setMoving] = useState(false);

  useEffect(() => {
    let live = true;
    Promise.all([plans.read(planId), plans.navigation(planId)])
      .then(([doc, tree]) => {
        if (!live) return;
        setTitle(doc.title);
        setDescription(doc.description);
        setNav(tree);
        setWorkspaceId(tree.workspace.id);
      })
      .catch(setError);
    return () => {
      live = false;
    };
  }, [planId]);

  useEffect(() => {
    if (workspaceId === '') return;
    let live = true;
    setOptions(null);
    projectsApi
      .list(workspaceId)
      .then((list) => {
        if (!live) return;
        setOptions(list.map((project) => ({ id: project.id, name: project.name })));
        setTarget(list.find((project) => project.id === nav?.projectId)?.id ?? list[0]?.id ?? '');
      })
      .catch(setError);
    return () => {
      live = false;
    };
  }, [workspaceId, nav?.projectId]);

  if (error !== null && nav === null) {
    return (
      <Page title="Plan settings" width="narrow">
        <Problem error={error} />
      </Page>
    );
  }
  if (nav === null) {
    return (
      <div className="grid py-24 place-items-center">
        <Spinner />
      </div>
    );
  }

  const save = async (): Promise<void> => {
    const trimmed = title.trim();
    if (trimmed === '') return;
    try {
      await plans.update(planId, { title: trimmed, description });
      setSaved(true);
      window.setTimeout(() => setSaved(false), 1600);
    } catch (cause) {
      setError(cause);
    }
  };

  const move = async (): Promise<void> => {
    if (target === '' || target === nav.projectId) return;
    setMoving(true);
    try {
      await plans.move(planId, target);
      void navigate(`/plan/${planId}`);
    } catch (cause) {
      setError(cause);
    } finally {
      setMoving(false);
    }
  };

  const remove = async (): Promise<void> => {
    try {
      await plans.remove(planId);
      void navigate(`/workspace/${nav.workspace.slug}`);
    } catch (cause) {
      setError(cause);
    }
  };

  const leavingWorkspace = workspaceId !== nav.workspace.id;

  return (
    <Page
      title={title === '' ? 'Untitled plan' : title}
      description="Everything about this plan except the drawing."
      width="narrow"
      actions={
        <Button variant="quiet" onClick={() => void navigate(`/plan/${planId}`)}>
          Open the canvas
        </Button>
      }
    >
      <div className="space-y-6">
        {error !== null ? <Problem error={error} /> : null}

        <Panel title="Name" description="What it is called in every list, and on the canvas.">
          <form
            className="space-y-3"
            onSubmit={(event) => {
              event.preventDefault();
              void save();
            }}
          >
            <Field label="Title">
              {(id) => (
                <Input id={id} value={title} onChange={(event) => setTitle(event.target.value)} />
              )}
            </Field>
            <Field label="Description" hint="One line, shown under the title in a list.">
              {(id) => (
                <Textarea
                  id={id}
                  rows={2}
                  value={description}
                  onChange={(event) => setDescription(event.target.value)}
                />
              )}
            </Field>
            <div className="flex items-center gap-3">
              <Button type="submit" variant="primary" disabled={title.trim() === ''}>
                Save
              </Button>
              {saved ? <span className="text-xs text-status-done">Saved</span> : null}
            </div>
          </form>
        </Panel>

        <Panel
          title="Where it lives"
          description="A plan keeps its address when it moves, so every link to it survives."
        >
          <div className="space-y-3">
            <Field label="Workspace">
              {(id) => (
                <Select
                  id={id}
                  value={workspaceId}
                  onChange={setWorkspaceId}
                  options={all.map((workspace) => ({
                    value: workspace.id,
                    label: workspace.name,
                  }))}
                />
              )}
            </Field>
            <Field label="Project">
              {(id) =>
                options === null ? (
                  <div className="flex h-8 items-center">
                    <Spinner />
                  </div>
                ) : options.length === 0 ? (
                  <p className="text-xs text-ink-muted">
                    That workspace has no project to put it in.
                  </p>
                ) : (
                  <Select
                    id={id}
                    value={target}
                    onChange={setTarget}
                    options={options.map((project) => ({
                      value: project.id,
                      label: project.name,
                    }))}
                  />
                )
              }
            </Field>

            {leavingWorkspace ? (
              <p className="text-xs text-status-progress">
                Moving it out of {nav.workspace.name} takes it away from everyone there, and drops
                its share link — that link was handed out on the understanding of who could reach
                the plan.
              </p>
            ) : null}

            <Button
              variant="primary"
              disabled={moving || target === '' || target === nav.projectId}
              onClick={() => void move()}
            >
              <ArrowRight className="size-3.5" />
              Move it
            </Button>
          </div>
        </Panel>

        <Panel
          title="Delete this plan"
          tone="danger"
          description="It goes to the workspace trash, where it can be restored or removed for good."
        >
          <Button variant="danger" onClick={() => setDeleting(true)}>
            <Trash2 className="size-3.5" />
            Move to trash
          </Button>
        </Panel>

        <p className="text-xs text-ink-faint">
          In{' '}
          <Link to={`/workspace/${nav.workspace.slug}`} className="text-accent underline">
            {nav.workspace.name}
          </Link>
          .
        </p>
      </div>

      <Modal
        open={deleting}
        onOpenChange={setDeleting}
        title={`Move ${title} to the trash?`}
        description="It stops appearing everywhere it is listed. You can bring it back from the trash."
      >
        <div className="flex justify-end gap-2">
          <Button variant="ghost" onClick={() => setDeleting(false)}>
            Cancel
          </Button>
          <Button variant="danger" onClick={() => void remove()}>
            <Trash2 className="size-3.5" />
            Move to trash
          </Button>
        </div>
      </Modal>
    </Page>
  );
}
