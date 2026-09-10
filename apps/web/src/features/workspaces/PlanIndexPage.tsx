import { FolderClosed, FolderPlus, Plus, Settings, Trash2 } from 'lucide-react';
import { Fragment, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router';

import { Button } from '@/components/ui/button';
import { Field, Input, Textarea } from '@/components/ui/field';
import { Empty, Problem, Spinner } from '@/components/ui/feedback';
import { DropdownAction } from '@/components/ui/dropdown-menu';
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
import { formatWhen, plural } from '@/lib/utils';
import { useLiveList, type LoadReason } from '@/lib/use-live-list';
import { useWorkspace } from './workspace-context';

/**
 * A drawing index rather than a wall of cards: one row per sheet, ruled, with
 * the numbers where a reader can compare them down the column.
 */
export function PlanIndexPage() {
  const { current } = useWorkspace();
  const { projectSlug = '' } = useParams();
  const navigate = useNavigate();

  const [project, setProject] = useState<{ id: string; name: string } | null>(null);
  const [list, setList] = useState<PlanSummary[] | null>(null);
  const [drawers, setDrawers] = useState<FolderSummary[]>([]);
  const [addingFolder, setAddingFolder] = useState(false);
  const [folderName, setFolderName] = useState('');
  const [error, setError] = useState<unknown>(null);
  const [creating, setCreating] = useState(false);
  const [title, setTitle] = useState('');
  const [newDescription, setNewDescription] = useState('');
  const [deleting, setDeleting] = useState<PlanSummary | null>(null);
  const mayDelete = canAdminister(current.role);

  const reload = (reason: LoadReason): void => {
    // Cleared on the way in, so the previous project's plans are not shown
    // under this one's name. Coming back to the window is not that: the list
    // on screen is this project's, and blanking it would flash a spinner at
    // somebody who only looked away.
    if (reason === 'first') {
      setList(null);
      setProject(null);
    }
    projects
      .bySlug(current.id, projectSlug)
      .then(async (found) => {
        setProject(found);
        const [inside, drawn] = await Promise.all([plans.list(found.id), folders.list(found.id)]);
        setList(inside);
        setDrawers(drawn);
      })
      .catch(setError);
  };
  useLiveList(reload, [current.id, projectSlug]);

  const create = async (): Promise<void> => {
    const trimmed = title.trim();
    if (trimmed === '' || project === null) return;
    try {
      const plan = await plans.create(project.id, trimmed, newDescription.trim());
      void navigate(`/plan/${plan.id}`);
    } catch (cause) {
      setError(cause);
    }
  };

  const addFolder = async (): Promise<void> => {
    const trimmed = folderName.trim();
    if (trimmed === '' || project === null) return;
    try {
      await folders.create(project.id, trimmed);
      setAddingFolder(false);
      setFolderName('');
      reload('again');
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

  if (error !== null) {
    return (
      <Page title="Plans">
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

  return (
    <Page
      title={project.name}
      description={`${
        list.length === 0 ? 'Nothing drawn yet' : plural(list.length, 'plan')
      } in this project.`}
      actions={
        <>
          <Button variant="ghost" onClick={() => setAddingFolder(true)}>
            <FolderPlus className="size-3.5" />
            New folder
          </Button>
          <Button variant="primary" onClick={() => setCreating(true)}>
            <Plus className="size-3.5" />
            New plan
          </Button>
        </>
      }
    >
      {list.length === 0 && drawers.length === 0 ? (
        <Empty
          title="No plans yet"
          body="Draw one here, or point an AI agent at this workspace and let it create the first plan for you."
          action={
            <Button variant="primary" onClick={() => setCreating(true)}>
              Create the first plan
            </Button>
          }
        />
      ) : (
        <Table>
          <THead>
            <TH>Plan</TH>
            <TH className="w-24" align="right" hide="md">
              Nodes
            </TH>
            <TH className="w-20 sm:w-32" align="right">
              Updated
            </TH>
            <TH className="w-10">
              <span className="sr-only">Actions</span>
            </TH>
          </THead>
          <tbody>
            {grouped(list, drawers).map(({ folder, held }) => (
              <Fragment key={folder?.id ?? 'loose'}>
                {folder === null ? null : (
                  <tr>
                    <td colSpan={4} className="border-t border-rule pt-4 pb-1">
                      <span className="rail-heading flex items-center gap-1.5 text-ink-faint">
                        <FolderClosed className="size-3" />
                        {folder.name}
                      </span>
                    </td>
                  </tr>
                )}
                {held.map((plan) => (
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
              </Fragment>
            ))}
          </tbody>
        </Table>
      )}

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

      <Modal open={addingFolder} onOpenChange={setAddingFolder} title="New folder">
        <form
          className="space-y-4"
          onSubmit={(event) => {
            event.preventDefault();
            void addFolder();
          }}
        >
          <Field label="Name" hint="A drawer inside this project. Folders do not nest.">
            {(id) => (
              <Input
                id={id}
                autoFocus
                value={folderName}
                onChange={(event) => setFolderName(event.target.value)}
                placeholder="Architecture"
              />
            )}
          </Field>
          <div className="flex justify-end gap-2">
            <Button type="button" variant="ghost" onClick={() => setAddingFolder(false)}>
              Cancel
            </Button>
            <Button type="submit" variant="primary">
              Create folder
            </Button>
          </div>
        </form>
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

/**
 * Plans by the drawer they are filed in, top level first. An empty folder is
 * still listed: it is a place somebody made, and a folder that vanishes when
 * you leave the page reads as a folder that was never created.
 */
function grouped(
  list: readonly PlanSummary[],
  drawers: readonly FolderSummary[],
): { folder: FolderSummary | null; held: PlanSummary[] }[] {
  const loose = list.filter((plan) => plan.folderId === null);
  return [
    ...(loose.length === 0 ? [] : [{ folder: null, held: loose }]),
    ...drawers.map((folder) => ({
      folder,
      held: list.filter((plan) => plan.folderId === folder.id),
    })),
  ];
}
