import { Plus } from 'lucide-react';
import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router';

import { Avatar } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { Empty, Problem, Spinner } from '@/components/ui/feedback';
import { Field, Input } from '@/components/ui/field';
import { Modal } from '@/components/ui/modal';
import { Page } from '@/components/ui/page';
import { Table, TD, TH, THead, TR } from '@/components/ui/table';
import { plans, workspaces, type RecentPlan } from '@/lib/api';
import { formatWhen } from '@/lib/utils';
import { useWorkspaces } from '@/features/workspaces/workspace-context';

/**
 * Where the application opens.
 *
 * People come back to a plan, not to a workspace, and they rarely remember
 * which workspace it was filed under — so the first screen is the plans
 * themselves, newest first, with the filing shown beside each one rather than
 * standing between you and it.
 */
export function RecentPage() {
  const { all } = useWorkspaces();
  const navigate = useNavigate();
  const [list, setList] = useState<RecentPlan[] | null>(null);
  const [error, setError] = useState<unknown>(null);

  useEffect(() => {
    plans.recent().then(setList).catch(setError);
  }, []);

  if (all.length === 0) return <FirstWorkspace />;

  if (error !== null) {
    return (
      <Page title="Recent">
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

  const first = all[0];

  return (
    <Page
      title="Recent"
      description="What you have been working on, across every workspace you belong to."
    >
      {list.length === 0 ? (
        <Empty
          title="Nothing drawn yet"
          body="Plans you open or an agent changes appear here, newest first."
          action={
            first === undefined ? undefined : (
              <Button variant="primary" onClick={() => void navigate(`/workspace/${first.slug}`)}>
                Open {first.name}
              </Button>
            )
          }
        />
      ) : (
        <Table>
          <THead>
            <TH>Plan</TH>
            <TH className="w-44">Where</TH>
            <TH className="hidden w-40 md:table-cell">Last touched by</TH>
            <TH className="w-28" align="right">
              Updated
            </TH>
          </THead>
          <tbody>
            {list.map((plan) => (
              <TR key={plan.id}>
                <TD>
                  <Link to={`/plan/${plan.id}`} className="block min-w-0">
                    <span className="block truncate font-medium text-ink">
                      {plan.title === '' ? 'Untitled plan' : plan.title}
                    </span>
                  </Link>
                </TD>
                <TD className="min-w-0">
                  <Link
                    to={`/workspace/${plan.workspace.slug}/project/${plan.project.slug}`}
                    className="block truncate text-xs text-ink-muted hover:text-ink"
                  >
                    {plan.workspace.name} / {plan.project.name}
                  </Link>
                </TD>
                {/* Who, not what: the label on a change is usually the name of
                    the thing changed, which this row already says. */}
                <TD className="hidden md:table-cell">
                  {plan.lastChange?.by == null ? (
                    <span className="text-xs text-ink-faint">—</span>
                  ) : (
                    <span className="flex min-w-0 items-center gap-1.5">
                      <Avatar
                        src={plan.lastChange.by.avatarUrl}
                        name={plan.lastChange.by.name}
                        className="size-4"
                      />
                      <span className="min-w-0 flex-1 truncate text-xs text-ink-muted">
                        {plan.lastChange.by.name}
                        {plan.lastChange.by.agent ? (
                          <span className="text-collab"> · agent</span>
                        ) : null}
                      </span>
                    </span>
                  )}
                </TD>
                <TD align="right" className="text-xs text-ink-muted">
                  {formatWhen(plan.updatedAt)}
                </TD>
              </TR>
            ))}
          </tbody>
        </Table>
      )}
    </Page>
  );
}

/** Everyone gets a workspace at sign-up, so this is close to unreachable. */
function FirstWorkspace() {
  const { reload } = useWorkspaces();
  const navigate = useNavigate();
  const [creating, setCreating] = useState(false);
  const [name, setName] = useState('');

  return (
    <>
      <Empty
        title="No workspace yet"
        body="A workspace holds your projects, and the keys your agents connect with."
        action={
          <Button variant="primary" onClick={() => setCreating(true)}>
            <Plus className="size-3.5" />
            Create a workspace
          </Button>
        }
      />
      <Modal open={creating} onOpenChange={setCreating} title="New workspace">
        <form
          className="space-y-4"
          onSubmit={(event) => {
            event.preventDefault();
            void workspaces.create(name.trim()).then((created) => {
              reload();
              void navigate(`/workspace/${created.slug}`);
            });
          }}
        >
          <Field label="Name">
            {(id) => (
              <Input
                id={id}
                autoFocus
                value={name}
                onChange={(event) => setName(event.target.value)}
                placeholder="Acme"
              />
            )}
          </Field>
          <div className="flex justify-end gap-2">
            <Button type="button" variant="ghost" onClick={() => setCreating(false)}>
              Cancel
            </Button>
            <Button type="submit" variant="primary">
              Create workspace
            </Button>
          </div>
        </form>
      </Modal>
    </>
  );
}
