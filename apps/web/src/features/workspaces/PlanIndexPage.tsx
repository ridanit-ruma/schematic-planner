import { Plus } from 'lucide-react';
import { useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router';

import { Button } from '@/components/ui/button';
import { Field, Input } from '@/components/ui/field';
import { Empty, Problem, Spinner } from '@/components/ui/feedback';
import { Modal } from '@/components/ui/modal';
import { Page } from '@/components/ui/page';
import { Table, TD, TH, THead, TR } from '@/components/ui/table';
import { plans, projects, type PlanSummary } from '@/lib/api';
import { formatWhen, plural } from '@/lib/utils';
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
  const [error, setError] = useState<unknown>(null);
  const [creating, setCreating] = useState(false);
  const [title, setTitle] = useState('');

  useEffect(() => {
    setList(null);
    setProject(null);
    projects
      .bySlug(current.id, projectSlug)
      .then(async (found) => {
        setProject(found);
        setList(await plans.list(found.id));
      })
      .catch(setError);
  }, [current.id, projectSlug]);

  const create = async (): Promise<void> => {
    const trimmed = title.trim();
    if (trimmed === '' || project === null) return;
    try {
      const plan = await plans.create(project.id, trimmed);
      void navigate(`/plan/${plan.id}`);
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
        <Button variant="primary" onClick={() => setCreating(true)}>
          <Plus className="size-3.5" />
          New plan
        </Button>
      }
    >
      {list.length === 0 ? (
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
            <TH className="w-24" align="right">
              Nodes
            </TH>
            <TH className="w-32" align="right">
              Updated
            </TH>
          </THead>
          <tbody>
            {list.map((plan) => (
              <TR key={plan.id}>
                <TD>
                  <Link to={`/plan/${plan.id}`} className="block min-w-0">
                    <span className="block truncate font-medium text-ink">{plan.title}</span>
                    {plan.description !== '' ? (
                      <span className="block truncate text-xs text-ink-muted">
                        {plan.description}
                      </span>
                    ) : null}
                  </Link>
                </TD>
                <TD align="right" className="slug text-ink-muted">
                  {plan.nodeCount}
                </TD>
                <TD align="right" className="text-xs text-ink-muted">
                  {formatWhen(plan.updatedAt)}
                </TD>
              </TR>
            ))}
          </tbody>
        </Table>
      )}

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
