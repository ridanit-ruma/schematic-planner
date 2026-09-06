import { Plus, Trash2 } from 'lucide-react';
import { useEffect, useState } from 'react';
import { Link } from 'react-router';

import { Button } from '@/components/ui/button';
import { Field, Input } from '@/components/ui/field';
import { Empty, Problem, Spinner } from '@/components/ui/feedback';
import { DropdownAction } from '@/components/ui/dropdown-menu';
import { Modal } from '@/components/ui/modal';
import { Page } from '@/components/ui/page';
import { RowMenu } from '@/components/ui/row-menu';
import { Table, TD, TH, THead, TR } from '@/components/ui/table';
import { canAdminister, projects as api, type ProjectSummary } from '@/lib/api';
import { formatWhen, plural } from '@/lib/utils';
import { useWorkspace } from './workspace-context';

/** A workspace holds projects; a project holds plans. This is the first level. */
export function ProjectIndexPage() {
  const { current } = useWorkspace();
  const [list, setList] = useState<ProjectSummary[] | null>(null);
  const [error, setError] = useState<unknown>(null);
  const [creating, setCreating] = useState(false);
  const [name, setName] = useState('');
  const [deleting, setDeleting] = useState<ProjectSummary | null>(null);
  const mayDelete = canAdminister(current.role);

  const reload = (): void => {
    api.list(current.id).then(setList).catch(setError);
  };
  useEffect(reload, [current.id]);

  const create = async (): Promise<void> => {
    const trimmed = name.trim();
    if (trimmed === '') return;
    try {
      await api.create(current.id, trimmed);
      setName('');
      setCreating(false);
      reload();
    } catch (cause) {
      setError(cause);
    }
  };

  const remove = async (project: ProjectSummary): Promise<void> => {
    try {
      await api.remove(project.id);
      setDeleting(null);
      reload();
    } catch (cause) {
      setError(cause);
    }
  };

  if (error !== null) {
    return (
      <Page title="Projects">
        <Problem error={error} />
      </Page>
    );
  }
  if (list === null) {
    return (
      <div className="grid py-24 place-items-center">
        <Spinner />
      </div>
    );
  }

  return (
    <Page
      title="Projects"
      description={`${
        list.length === 0 ? 'Nothing here yet' : plural(list.length, 'project')
      } in ${current.name}.`}
      actions={
        <Button variant="primary" onClick={() => setCreating(true)}>
          <Plus className="size-3.5" />
          New project
        </Button>
      }
    >
      {list.length === 0 ? (
        <Empty
          title="No projects yet"
          body="A project groups the plans for one thing you are building. Most workspaces start with one."
          action={
            <Button variant="primary" onClick={() => setCreating(true)}>
              Create the first project
            </Button>
          }
        />
      ) : (
        <Table>
          <THead>
            <TH>Project</TH>
            <TH className="w-24" align="right">
              Plans
            </TH>
            <TH className="w-32" align="right">
              Updated
            </TH>
            {mayDelete ? (
              <TH className="w-10">
                <span className="sr-only">Actions</span>
              </TH>
            ) : null}
          </THead>
          <tbody>
            {list.map((project) => (
              <TR key={project.id}>
                <TD>
                  <Link
                    to={`/workspace/${current.slug}/project/${project.slug}`}
                    className="block min-w-0"
                  >
                    <span className="block truncate font-medium text-ink">{project.name}</span>
                    <span className="slug block truncate text-ink-faint">{project.slug}</span>
                  </Link>
                </TD>
                <TD align="right" className="slug text-ink-muted">
                  {project.planCount}
                </TD>
                <TD align="right" className="text-xs text-ink-muted">
                  {formatWhen(project.updatedAt)}
                </TD>
                {mayDelete ? (
                  <TD>
                    <RowMenu label={project.name}>
                      <DropdownAction tone="danger" onSelect={() => setDeleting(project)}>
                        <Trash2 className="size-3.5" />
                        Move to trash
                      </DropdownAction>
                    </RowMenu>
                  </TD>
                ) : null}
              </TR>
            ))}
          </tbody>
        </Table>
      )}

      <Modal
        open={deleting !== null}
        onOpenChange={(open) => !open && setDeleting(null)}
        title={`Move ${deleting?.name ?? ''} to the trash?`}
        description="The plans inside go with it. You can bring the whole project back from the trash."
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

      <Modal open={creating} onOpenChange={setCreating} title="New project">
        <form
          className="space-y-4"
          onSubmit={(event) => {
            event.preventDefault();
            void create();
          }}
        >
          <Field label="Name" hint="The address is derived from this and does not change later.">
            {(id) => (
              <Input
                id={id}
                autoFocus
                value={name}
                onChange={(event) => setName(event.target.value)}
                placeholder="Billing rework"
              />
            )}
          </Field>
          <div className="flex justify-end gap-2">
            <Button type="button" variant="ghost" onClick={() => setCreating(false)}>
              Cancel
            </Button>
            <Button type="submit" variant="primary">
              Create project
            </Button>
          </div>
        </form>
      </Modal>
    </Page>
  );
}
