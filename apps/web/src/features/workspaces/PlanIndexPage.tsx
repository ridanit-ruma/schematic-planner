import { useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router';

import { Button } from '@/components/ui/button';
import { Field, Input } from '@/components/ui/field';
import { Empty, Problem, Spinner } from '@/components/ui/feedback';
import { Modal } from '@/components/ui/modal';
import { plans, type PlanSummary } from '@/lib/api';
import { formatWhen, plural } from '@/lib/utils';

/**
 * A drawing index rather than a wall of cards: one row per sheet, ruled, with
 * the numbers where a reader can compare them down the column.
 */
export function PlanIndexPage() {
  const { workspaceId = '' } = useParams();
  const navigate = useNavigate();

  const [list, setList] = useState<PlanSummary[] | null>(null);
  const [error, setError] = useState<unknown>(null);
  const [creating, setCreating] = useState(false);
  const [title, setTitle] = useState('');

  useEffect(() => {
    setList(null);
    plans.list(workspaceId).then(setList).catch(setError);
  }, [workspaceId]);

  const create = async (): Promise<void> => {
    const trimmed = title.trim();
    if (trimmed === '') return;
    try {
      const plan = await plans.create(workspaceId, trimmed);
      void navigate(`/plans/${plan.id}`);
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
          <h1 className="text-xl font-medium text-ink">Plans</h1>
          <p className="mt-1 text-sm text-ink-muted">
            {list.length === 0 ? 'Nothing drawn yet.' : plural(list.length, 'plan')} in this
            workspace.
          </p>
        </div>
        <Button variant="primary" onClick={() => setCreating(true)}>
          New plan
        </Button>
      </div>

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
        <table className="mt-8 w-full table-fixed border-collapse text-sm">
          <thead>
            <tr className="border-b border-rule-strong text-left text-xs text-ink-muted">
              <th className="py-2 font-medium">Plan</th>
              <th className="w-24 py-2 text-right font-medium">Nodes</th>
              <th className="w-28 py-2 text-right font-medium">Updated</th>
            </tr>
          </thead>
          <tbody>
            {list.map((plan) => (
              <tr key={plan.id} className="border-b border-rule hover:bg-surface-2">
                <td className="py-2.5 pr-4">
                  <Link to={`/plans/${plan.id}`} className="block min-w-0">
                    <span className="block truncate font-medium text-ink">{plan.title}</span>
                    {plan.description !== '' ? (
                      <span className="block truncate text-xs text-ink-muted">
                        {plan.description}
                      </span>
                    ) : null}
                  </Link>
                </td>
                <td className="py-2.5 text-right tabular-nums text-ink-muted">{plan.nodeCount}</td>
                <td className="py-2.5 text-right text-ink-muted">{formatWhen(plan.updatedAt)}</td>
              </tr>
            ))}
          </tbody>
        </table>
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
                placeholder="Billing rework"
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
    </div>
  );
}
