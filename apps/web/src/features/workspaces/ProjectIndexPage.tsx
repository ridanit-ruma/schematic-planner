import { useEffect, useState } from 'react';
import { Link } from 'react-router';

import { Button } from '@/components/ui/button';
import { Field, Input } from '@/components/ui/field';
import { Empty, Problem, Spinner } from '@/components/ui/feedback';
import { Modal } from '@/components/ui/modal';
import { projects as api, type ProjectSummary } from '@/lib/api';
import { formatWhen, plural } from '@/lib/utils';
import { useWorkspace } from './workspace-context';

/** A workspace holds projects; a project holds plans. This is the first level. */
export function ProjectIndexPage() {
  const { current } = useWorkspace();
  const [list, setList] = useState<ProjectSummary[] | null>(null);
  const [error, setError] = useState<unknown>(null);
  const [creating, setCreating] = useState(false);
  const [name, setName] = useState('');

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

  if (error !== null) {
    return (
      <div className="mx-auto max-w-3xl px-6 py-10">
        <Problem error={error} />
      </div>
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
    <div className="mx-auto max-w-3xl px-6 py-10">
      <div className="flex items-end justify-between gap-4">
        <div>
          <h1 className="text-xl font-medium text-ink">Projects</h1>
          <p className="mt-1 text-sm text-ink-muted">
            {list.length === 0 ? 'Nothing here yet.' : plural(list.length, 'project')} in{' '}
            {current.name}.
          </p>
        </div>
        <Button variant="primary" onClick={() => setCreating(true)}>
          New project
        </Button>
      </div>

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
        <table className="mt-8 w-full table-fixed border-collapse text-sm">
          <thead>
            <tr className="border-b border-rule-strong text-left text-xs text-ink-muted">
              <th className="py-2 font-medium">Project</th>
              <th className="w-24 py-2 text-right font-medium">Plans</th>
              <th className="w-28 py-2 text-right font-medium">Updated</th>
            </tr>
          </thead>
          <tbody>
            {list.map((project) => (
              <tr key={project.id} className="border-b border-rule hover:bg-surface-2">
                <td className="py-2.5 pr-4">
                  <Link
                    to={`/workspace/${current.slug}/project/${project.slug}`}
                    className="block min-w-0"
                  >
                    <span className="block truncate font-medium text-ink">{project.name}</span>
                    <span className="slug block truncate text-ink-faint">{project.slug}</span>
                  </Link>
                </td>
                <td className="py-2.5 text-right tabular-nums text-ink-muted">
                  {project.planCount}
                </td>
                <td className="py-2.5 text-right text-ink-muted">
                  {formatWhen(project.updatedAt)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}

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
    </div>
  );
}
