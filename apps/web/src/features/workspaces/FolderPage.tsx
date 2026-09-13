import { FolderInput, Plus, Settings, Trash2 } from 'lucide-react';
import { useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router';

import { Button } from '@/components/ui/button';
import { DropdownAction } from '@/components/ui/dropdown-menu';
import { Empty, Problem, Spinner } from '@/components/ui/feedback';
import { Field, Input, Textarea } from '@/components/ui/field';
import { Modal } from '@/components/ui/modal';
import { Page } from '@/components/ui/page';
import { RowMenu } from '@/components/ui/row-menu';
import { Table, TD, TH, THead, TR } from '@/components/ui/table';
import {
  canAdminister,
  folders,
  plans,
  projects,
  type FolderSummary,
  type PlanSummary,
} from '@/lib/api';
import { useCrumb } from '@/lib/use-crumb';
import { useLiveList, type LoadReason } from '@/lib/use-live-list';
import { formatWhen, plural } from '@/lib/utils';

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

  if (error !== null) {
    return (
      <Page title="Folder">
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
      <Page title="Folder">
        <Empty
          title="No such folder"
          body="It may have been thrown away, or it belongs to another project."
          action={
            <Button
              variant="primary"
              onClick={() => void navigate(`/workspace/${current.slug}/project/${projectSlug}`)}
            >
              Back to {project.name}
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
      description={`${
        inside.length === 0 ? 'Nothing filed here yet' : plural(inside.length, 'plan')
      } in this folder.`}
      actions={
        <>
          <RowMenu label={folder.name}>
            <DropdownAction onSelect={() => setRenaming(true)}>Rename folder</DropdownAction>
            {mayDelete ? (
              <DropdownAction tone="danger" onSelect={() => setTrashing(true)}>
                <Trash2 className="size-3.5" />
                Move folder to trash
              </DropdownAction>
            ) : null}
          </RowMenu>
          <Button variant="primary" onClick={() => setCreating(true)}>
            <Plus className="size-3.5" />
            New plan
          </Button>
        </>
      }
    >
      {inside.length === 0 ? (
        <Empty
          title="Nothing in this folder"
          body="Draw a plan here, or move one in from the project."
          action={
            <Button variant="primary" onClick={() => setCreating(true)}>
              Create the first plan
            </Button>
          }
        />
      ) : (
        <Table>
          <THead>
            <TH>Name</TH>
            <TH className="w-24" align="right" hide="md">
              Holds
            </TH>
            <TH className="w-20 sm:w-32" align="right">
              Updated
            </TH>
            <TH className="w-10">
              <span className="sr-only">Actions</span>
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
                      {plural(plan.nodeCount, 'node')}
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
                      Move to folder…
                    </DropdownAction>
                    <DropdownAction onSelect={() => void navigate(`/plan/${plan.id}/settings`)}>
                      <Settings className="size-3.5 text-ink-faint" />
                      Settings
                    </DropdownAction>
                    {mayDelete ? (
                      <DropdownAction tone="danger" onSelect={() => setDeleting(plan)}>
                        <Trash2 className="size-3.5" />
                        Move to trash
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
        title={`Move ${deleting?.title ?? ''} to the trash?`}
        description="It stops appearing everywhere it is listed. You can bring it back from the trash."
      >
        <div className="flex justify-end gap-2">
          <Button variant="ghost" onClick={() => setDeleting(null)}>
            Cancel
          </Button>
          <Button
            variant="danger"
            onClick={() => {
              if (deleting !== null) void remove(deleting);
            }}
          >
            <Trash2 className="size-3.5" />
            Move to trash
          </Button>
        </div>
      </Modal>

      <Modal open={renaming} onOpenChange={setRenaming} title="Rename folder">
        <form
          className="space-y-4"
          onSubmit={(event) => {
            event.preventDefault();
            void rename();
          }}
        >
          <Field label="Name">
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
              Cancel
            </Button>
            <Button type="submit" variant="primary">
              Rename
            </Button>
          </div>
        </form>
      </Modal>

      <Modal
        open={trashing}
        onOpenChange={setTrashing}
        title={`Move ${folder.name} to the trash?`}
        description="The plans in it go with it, and come back with it."
      >
        <div className="flex justify-end gap-2">
          <Button variant="ghost" onClick={() => setTrashing(false)}>
            Cancel
          </Button>
          <Button variant="danger" onClick={() => void trash()}>
            <Trash2 className="size-3.5" />
            Move to trash
          </Button>
        </div>
      </Modal>

      <Modal open={creating} onOpenChange={setCreating} title="New plan">
        <form
          className="space-y-4"
          onSubmit={(event) => {
            event.preventDefault();
            void create();
          }}
        >
          <Field label="Title">
            {(id) => (
              <Input
                id={id}
                autoFocus
                value={title}
                onChange={(event) => setTitle(event.target.value)}
                placeholder="Ledger migration"
              />
            )}
          </Field>
          <Field label="Description" hint="What this plan draws. One line, shown in the list.">
            {(id) => (
              <Textarea
                id={id}
                rows={2}
                value={newDescription}
                onChange={(event) => setNewDescription(event.target.value)}
                placeholder="How an invoice gets from the ledger to a PDF."
              />
            )}
          </Field>
          <div className="flex justify-end gap-2">
            <Button type="button" variant="ghost" onClick={() => setCreating(false)}>
              Cancel
            </Button>
            <Button type="submit" variant="primary">
              Create plan
            </Button>
          </div>
        </form>
      </Modal>
    </Page>
  );
}
