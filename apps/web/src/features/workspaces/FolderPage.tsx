import { FolderInput, Plus, Settings, Trash2 } from 'lucide-react';
import { useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router';

import { Button } from '@/components/ui/button';
import { DropdownAction } from '@/components/ui/dropdown-menu';
import { Empty, NotFound, Problem, Spinner } from '@/components/ui/feedback';
import { Field, Input, Textarea } from '@/components/ui/field';
import { Modal } from '@/components/ui/modal';
import { Page } from '@/components/ui/page';
import { RowMenu } from '@/components/ui/row-menu';
import { Table, TD, TH, THead, TR } from '@/components/ui/table';
import {
  canAdminister,
  folders,
  isMissing,
  plans,
  projects,
  type FolderSummary,
  type PlanSummary,
} from '@/lib/api';
import { useCrumb } from '@/lib/use-crumb';
import { useLiveList, type LoadReason } from '@/lib/use-live-list';
import { useT } from '@/i18n';
import { formatWhen } from '@/lib/utils';

import { MoveToFolder } from './MoveToFolder';
import { folderPlans } from './project-rows';
import { useWorkspace } from './workspace-context';

/**
 * One drawer of a project, opened.
 *
 * There is no endpoint for a single folder and there does not need to be: the
 * project's folders come back in one list, and the one being looked at is in it.
 * A folder that is not — thrown away, or belonging to another project — is a
 * wrong address rather than an empty room, and says so.
 */
export function FolderPage() {
  const { current } = useWorkspace();
  const { projectSlug = '', folderId = '' } = useParams();
  const navigate = useNavigate();

  const [project, setProject] = useState<{ id: string; name: string } | null>(null);
  const [folder, setFolder] = useState<FolderSummary | null>(null);
  const [drawers, setDrawers] = useState<FolderSummary[]>([]);
  const [list, setList] = useState<PlanSummary[] | null>(null);
  const [error, setError] = useState<unknown>(null);
  const [creating, setCreating] = useState(false);
  const [title, setTitle] = useState('');
  const [newDescription, setNewDescription] = useState('');
  const [deleting, setDeleting] = useState<PlanSummary | null>(null);
  const [moving, setMoving] = useState<PlanSummary | null>(null);
  const [renaming, setRenaming] = useState(false);
  const [renameTo, setRenameTo] = useState('');
  const [trashing, setTrashing] = useState(false);
  const mayDelete = canAdminister(current.role);
  const t = useT();
  const m = t.workspaces;

  useCrumb(folder?.name ?? null);

  const reload = (reason: LoadReason): void => {
    if (reason === 'first') {
      setList(null);
      setProject(null);
      setFolder(null);
    }
    projects
      .bySlug(current.id, projectSlug)
      .then(async (found) => {
        setProject(found);
        const [inside, drawn] = await Promise.all([plans.list(found.id), folders.list(found.id)]);
        setDrawers(drawn);
        setFolder(drawn.find((drawer) => drawer.id === folderId) ?? null);
        setList(inside);
      })
      .catch(setError);
  };
  useLiveList(reload, [current.id, projectSlug, folderId]);

  useEffect(() => {
    setRenameTo(folder?.name ?? '');
  }, [folder]);

  const create = async (): Promise<void> => {
    const trimmed = title.trim();
    if (trimmed === '' || project === null) return;
    try {
      const plan = await plans.create(project.id, trimmed, newDescription.trim(), folderId);
      void navigate(`/plan/${plan.id}`);
    } catch (cause) {
      setError(cause);
    }
  };

  const remove = async (plan: PlanSummary): Promise<void> => {
    try {
      await plans.remove(plan.id);
      setDeleting(null);
      reload('again');
    } catch (cause) {
      setError(cause);
    }
  };

  const rename = async (): Promise<void> => {
    const trimmed = renameTo.trim();
    if (trimmed === '') return;
    try {
      await folders.rename(folderId, trimmed);
      setRenaming(false);
      reload('again');
    } catch (cause) {
      setError(cause);
    }
  };

  const trash = async (): Promise<void> => {
    try {
      await folders.remove(folderId);
      void navigate(`/workspace/${current.slug}/project/${projectSlug}`);
    } catch (cause) {
      setError(cause);
    }
  };

  // An address that leads nowhere you can reach is not an error on a page; it
  // is the absence of the page. A drawer that is not there and a drawer in
  // somebody else's project are one answer, as they are everywhere else.
  if (isMissing(error)) return <NotFound subject="folder" />;

  if (error !== null) {
    return (
      <Page title={m.folder.title}>
        <Problem error={error} />
      </Page>
    );
  }
  if (list === null || project === null) {
    return (
      <div className="grid py-24 place-items-center">
        <Spinner />
      </div>
    );
  }
  if (folder === null) {
    return (
      <Page title={m.folder.title}>
        <Empty
          title={m.folder.missing.title}
          body={m.folder.missing.body}
          action={
            <Button
              variant="primary"
              onClick={() => void navigate(`/workspace/${current.slug}/project/${projectSlug}`)}
            >
              {m.folder.missing.back(project.name)}
            </Button>
          }
        />
      </Page>
    );
  }

  const inside = folderPlans(list, folderId);

  return (
    <Page
      title={folder.name}
      description={m.folder.description(inside.length)}
      actions={
        <>
          <RowMenu label={folder.name}>
            <DropdownAction onSelect={() => setRenaming(true)}>
              {m.list.renameFolder}
            </DropdownAction>
            {mayDelete ? (
              <DropdownAction tone="danger" onSelect={() => setTrashing(true)}>
                <Trash2 className="size-3.5" />
                {m.folder.moveFolderToTrash}
              </DropdownAction>
            ) : null}
          </RowMenu>
          <Button variant="primary" onClick={() => setCreating(true)}>
            <Plus className="size-3.5" />
            {m.newPlan.title}
          </Button>
        </>
      }
    >
      {inside.length === 0 ? (
        <Empty
          title={m.folder.empty.title}
          body={m.folder.empty.body}
          action={
            <Button variant="primary" onClick={() => setCreating(true)}>
              {m.newPlan.createFirst}
            </Button>
          }
        />
      ) : (
        <Table>
          <THead>
            <TH>{m.list.name}</TH>
            <TH className="w-24" align="right" hide="md">
              {m.list.holds}
            </TH>
            <TH className="w-20 sm:w-32" align="right">
              {m.list.updated}
            </TH>
            <TH className="w-10">
              <span className="sr-only">{m.list.actions}</span>
            </TH>
          </THead>
          <tbody>
            {inside.map((plan) => (
              <TR key={plan.id}>
                <TD>
                  <Link to={`/plan/${plan.id}`} className="block min-w-0">
                    <span className="block truncate font-medium text-ink">{plan.title}</span>
                    {plan.description !== '' ? (
                      <span className="block truncate text-xs text-ink-muted">
                        {plan.description}
                      </span>
                    ) : null}
                    <span className="block truncate text-xs text-ink-faint md:hidden">
                      {m.list.nodeCount(plan.nodeCount)}
                    </span>
                  </Link>
                </TD>
                <TD align="right" className="slug text-ink-muted" hide="md">
                  {plan.nodeCount}
                </TD>
                <TD align="right" className="text-xs text-ink-muted">
                  {formatWhen(plan.updatedAt)}
                </TD>
                <TD>
                  <RowMenu label={plan.title}>
                    <DropdownAction onSelect={() => setMoving(plan)}>
                      <FolderInput className="size-3.5 text-ink-faint" />
                      {m.list.moveToFolder}
                    </DropdownAction>
                    <DropdownAction onSelect={() => void navigate(`/plan/${plan.id}/settings`)}>
                      <Settings className="size-3.5 text-ink-faint" />
                      {m.list.settings}
                    </DropdownAction>
                    {mayDelete ? (
                      <DropdownAction tone="danger" onSelect={() => setDeleting(plan)}>
                        <Trash2 className="size-3.5" />
                        {m.list.moveToTrash}
                      </DropdownAction>
                    ) : null}
                  </RowMenu>
                </TD>
              </TR>
            ))}
          </tbody>
        </Table>
      )}

      <MoveToFolder
        plan={moving}
        projectId={project.id}
        folders={drawers}
        onDone={() => {
          setMoving(null);
          reload('again');
        }}
        onCancel={() => setMoving(null)}
      />

      <Modal
        open={deleting !== null}
        onOpenChange={(open) => !open && setDeleting(null)}
        title={m.list.confirmTrash(deleting?.title ?? '')}
        description={m.list.planTrashBody}
      >
        <div className="flex justify-end gap-2">
          <Button variant="ghost" onClick={() => setDeleting(null)}>
            {t.common.cancel}
          </Button>
          <Button
            variant="danger"
            onClick={() => {
              if (deleting !== null) void remove(deleting);
            }}
          >
            <Trash2 className="size-3.5" />
            {m.list.moveToTrash}
          </Button>
        </div>
      </Modal>

      <Modal open={renaming} onOpenChange={setRenaming} title={m.list.renameFolder}>
        <form
          className="space-y-4"
          onSubmit={(event) => {
            event.preventDefault();
            void rename();
          }}
        >
          <Field label={m.list.name}>
            {(id) => (
              <Input
                id={id}
                autoFocus
                value={renameTo}
                onChange={(event) => setRenameTo(event.target.value)}
              />
            )}
          </Field>
          <div className="flex justify-end gap-2">
            <Button type="button" variant="ghost" onClick={() => setRenaming(false)}>
              {t.common.cancel}
            </Button>
            <Button type="submit" variant="primary">
              {t.common.rename}
            </Button>
          </div>
        </form>
      </Modal>

      <Modal
        open={trashing}
        onOpenChange={setTrashing}
        title={m.list.confirmTrash(folder.name)}
        description={m.list.folderTrashBody}
      >
        <div className="flex justify-end gap-2">
          <Button variant="ghost" onClick={() => setTrashing(false)}>
            {t.common.cancel}
          </Button>
          <Button variant="danger" onClick={() => void trash()}>
            <Trash2 className="size-3.5" />
            {m.list.moveToTrash}
          </Button>
        </div>
      </Modal>

      <Modal open={creating} onOpenChange={setCreating} title={m.newPlan.title}>
        <form
          className="space-y-4"
          onSubmit={(event) => {
            event.preventDefault();
            void create();
          }}
        >
          <Field label={m.newPlan.titleLabel}>
            {(id) => (
              <Input
                id={id}
                autoFocus
                value={title}
                onChange={(event) => setTitle(event.target.value)}
                placeholder={m.newPlan.titlePlaceholder}
              />
            )}
          </Field>
          <Field label={m.newPlan.descriptionLabel} hint={m.newPlan.descriptionHint}>
            {(id) => (
              <Textarea
                id={id}
                rows={2}
                value={newDescription}
                onChange={(event) => setNewDescription(event.target.value)}
                placeholder={m.newPlan.descriptionPlaceholder}
              />
            )}
          </Field>
          <div className="flex justify-end gap-2">
            <Button type="button" variant="ghost" onClick={() => setCreating(false)}>
              {t.common.cancel}
            </Button>
            <Button type="submit" variant="primary">
              {m.newPlan.submit}
            </Button>
          </div>
        </form>
      </Modal>
    </Page>
  );
}
