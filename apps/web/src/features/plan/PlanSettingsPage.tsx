import { ArrowRight, Trash2 } from 'lucide-react';
import { useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router';

import { useExplorer } from '@/components/explorer/explorer-context';
import { revealState } from '@/components/explorer/tree';
import { Button } from '@/components/ui/button';
import { Field, Input, Textarea } from '@/components/ui/field';
import { NotFound, Problem, Spinner } from '@/components/ui/feedback';
import { Modal } from '@/components/ui/modal';
import { Page, Panel } from '@/components/ui/page';
import { Select } from '@/components/ui/select';
import { useT } from '@/i18n';
import { isMissing, plans, projects as projectsApi, type PlanNavigation } from '@/lib/api';
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
  const explorer = useExplorer();
  const t = useT();

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

  // An address that leads nowhere you can reach is not an error on a page;
  // it is the absence of the page.
  if (isMissing(error)) return <NotFound subject="plan" />;

  if (error !== null && nav === null) {
    return (
      <Page title={t.plan.settings.title} width="narrow">
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
      explorer.renamePlan(planId, trimmed);
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
      explorer.reread();
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
      explorer.reread();
      void navigate('/recent');
    } catch (cause) {
      setError(cause);
    }
  };

  const leavingWorkspace = workspaceId !== nav.workspace.id;
  const project = nav.projects.find((each) => each.id === nav.projectId);

  return (
    <Page
      title={title === '' ? t.plan.page.untitled : title}
      description={t.plan.settings.description}
      width="narrow"
      actions={
        <Button variant="quiet" onClick={() => void navigate(`/plan/${planId}`)}>
          {t.plan.settings.openCanvas}
        </Button>
      }
    >
      <div className="space-y-6">
        {error !== null ? <Problem error={error} /> : null}

        <Panel title={t.plan.settings.name.title} description={t.plan.settings.name.description}>
          <form
            className="space-y-3"
            onSubmit={(event) => {
              event.preventDefault();
              void save();
            }}
          >
            <Field label={t.plan.settings.name.titleField}>
              {(id) => (
                <Input id={id} value={title} onChange={(event) => setTitle(event.target.value)} />
              )}
            </Field>
            <Field
              label={t.plan.settings.name.descriptionField}
              hint={t.plan.settings.name.descriptionHint}
            >
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
                {t.common.save}
              </Button>
              {saved ? <span className="text-xs text-status-done">{t.common.saved}</span> : null}
            </div>
          </form>
        </Panel>

        <Panel
          title={t.plan.settings.location.title}
          description={t.plan.settings.location.description}
        >
          <div className="space-y-3">
            <Field label={t.plan.settings.location.workspace}>
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
            <Field label={t.plan.settings.location.project}>
              {(id) =>
                options === null ? (
                  <div className="flex h-8 items-center">
                    <Spinner />
                  </div>
                ) : options.length === 0 ? (
                  <p className="text-xs text-ink-muted">{t.plan.settings.location.noProject}</p>
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
                {t.plan.settings.location.leaving(nav.workspace.name)}
              </p>
            ) : null}

            <Button
              variant="primary"
              disabled={moving || target === '' || target === nav.projectId}
              onClick={() => void move()}
            >
              <ArrowRight className="size-3.5" />
              {t.plan.settings.location.move}
            </Button>
          </div>
        </Panel>

        <Panel
          title={t.plan.settings.trash.title}
          tone="danger"
          description={t.plan.settings.trash.description}
        >
          <Button variant="danger" onClick={() => setDeleting(true)}>
            <Trash2 className="size-3.5" />
            {t.plan.settings.trash.moveToTrash}
          </Button>
        </Panel>

        <p className="text-xs text-ink-faint">
          {t.plan.settings.in(
            <Link
              to="/recent"
              state={revealState({
                workspace: nav.workspace.slug,
                ...(project === undefined ? {} : { project: project.slug }),
              })}
              className="text-accent underline"
            >
              {nav.workspace.name}
            </Link>,
          )}
        </p>
      </div>

      <Modal
        open={deleting}
        onOpenChange={setDeleting}
        title={t.plan.settings.trash.confirmTitle(title)}
        description={t.plan.settings.trash.confirmDescription}
      >
        <div className="flex justify-end gap-2">
          <Button variant="ghost" onClick={() => setDeleting(false)}>
            {t.common.cancel}
          </Button>
          <Button variant="danger" onClick={() => void remove()}>
            <Trash2 className="size-3.5" />
            {t.plan.settings.trash.moveToTrash}
          </Button>
        </div>
      </Modal>
    </Page>
  );
}
