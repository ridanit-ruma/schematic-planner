import { Plus } from 'lucide-react';
import { useState } from 'react';
import { Link, useNavigate } from 'react-router';

import { useExplorer } from '@/components/explorer/explorer-context';
import { revealState } from '@/components/explorer/tree';
import { Author } from '@/components/ui/author';
import { Avatar } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { Empty, Problem, Spinner } from '@/components/ui/feedback';
import { Field, Input } from '@/components/ui/field';
import { Modal } from '@/components/ui/modal';
import { Page } from '@/components/ui/page';
import { Table, TD, TH, THead, TR } from '@/components/ui/table';
import { useT } from '@/i18n';
import { plans, workspaces, type RecentPlan } from '@/lib/api';
import { formatWhen } from '@/lib/utils';
import { useWorkspaces } from '@/features/workspaces/workspace-context';
import { useLiveList } from '@/lib/use-live-list';

/**
 * Where the application opens.
 *
 * People come back to a plan, not to a workspace, and they rarely remember
 * which workspace it was filed under — so the first screen is the plans
 * themselves, newest first, with the filing shown beside each one rather than
 * standing between you and it.
 */
export function RecentPage() {
  const t = useT();
  const { all } = useWorkspaces();
  const explorer = useExplorer();
  const [list, setList] = useState<RecentPlan[] | null>(null);
  const [error, setError] = useState<unknown>(null);

  useLiveList(() => {
    plans.recent().then(setList).catch(setError);
  }, []);

  if (all.length === 0) return <FirstWorkspace />;

  if (error !== null) {
    return (
      <Page title={t.recent.title}>
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
    <Page title={t.recent.title} description={t.recent.description}>
      {list.length === 0 ? (
        <Empty
          title={t.recent.empty.title}
          body={t.recent.empty.body}
          action={
            // Named where it will live: in the tree, beside this list.
            <Button variant="primary" onClick={explorer.newProject}>
              <Plus className="size-3.5" />
              {t.explorer.newProject}
            </Button>
          }
        />
      ) : (
        <Table>
          <THead>
            <TH>{t.recent.columns.plan}</TH>
            <TH className="w-44" hide="md">
              {t.recent.columns.where}
            </TH>
            <TH className="w-40" hide="md">
              {t.recent.columns.lastTouchedBy}
            </TH>
            <TH className="w-20 sm:w-28" align="right">
              {t.recent.columns.updated}
            </TH>
          </THead>
          <tbody>
            {list.map((plan) => (
              <TR key={plan.id}>
                <TD>
                  <Link to={`/plan/${plan.id}`} className="block min-w-0">
                    <span className="block truncate font-medium text-ink">
                      {plan.title === '' ? t.recent.untitledPlan : plan.title}
                    </span>
                    {/* What the dropped columns were carrying, under the title
                        rather than beside it. */}
                    <span className="block truncate text-xs text-ink-muted md:hidden">
                      {all.length > 1 ? `${plan.workspace.name} / ` : ''}
                      {plan.project.name}
                      {plan.lastChange?.by == null ? '' : ` · ${plan.lastChange.by.name}`}
                    </span>
                  </Link>
                </TD>
                <TD className="min-w-0" hide="md">
                  {/* Shows the project in the tree rather than a list of its own. */}
                  <Link
                    to="/recent"
                    state={revealState({
                      workspace: plan.workspace.slug,
                      project: plan.project.slug,
                    })}
                    className="block truncate text-xs text-ink-muted hover:text-ink"
                  >
                    {/* The workspace only when there is more than one: repeated
                        down every row it is noise, and it takes the room the
                        project name needs. */}
                    {all.length > 1 ? `${plan.workspace.name} / ` : ''}
                    {plan.project.name}
                  </Link>
                </TD>
                {/* Who, not what: the label on a change is usually the name of
                    the thing changed, which this row already says. */}
                <TD hide="md">
                  {plan.lastChange?.by == null ? (
                    <span className="text-xs text-ink-faint">—</span>
                  ) : (
                    <span className="flex min-w-0 items-center gap-1.5">
                      <Avatar
                        src={plan.lastChange.by.avatarUrl}
                        name={plan.lastChange.by.agent ?? plan.lastChange.by.name}
                        className="size-4"
                      />
                      <Author
                        by={plan.lastChange.by}
                        className="min-w-0 flex-1 truncate text-xs text-ink-muted"
                      />
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
  const t = useT();
  const { add } = useWorkspaces();
  const navigate = useNavigate();
  const [creating, setCreating] = useState(false);
  const [name, setName] = useState('');

  return (
    <>
      <Empty
        title={t.recent.firstWorkspace.title}
        body={t.recent.firstWorkspace.body}
        action={
          <Button variant="primary" onClick={() => setCreating(true)}>
            <Plus className="size-3.5" />
            {t.recent.firstWorkspace.create}
          </Button>
        }
      />
      <Modal open={creating} onOpenChange={setCreating} title={t.recent.firstWorkspace.modalTitle}>
        <form
          className="space-y-4"
          onSubmit={(event) => {
            event.preventDefault();
            void workspaces.create(name.trim()).then((created) => {
              add(created);
              void navigate(`/workspace/${created.slug}`);
            });
          }}
        >
          <Field label={t.recent.firstWorkspace.name}>
            {(id) => (
              <Input
                id={id}
                autoFocus
                value={name}
                onChange={(event) => setName(event.target.value)}
                placeholder={t.recent.firstWorkspace.placeholder}
              />
            )}
          </Field>
          <div className="flex justify-end gap-2">
            <Button type="button" variant="ghost" onClick={() => setCreating(false)}>
              {t.common.cancel}
            </Button>
            <Button type="submit" variant="primary">
              {t.recent.firstWorkspace.submit}
            </Button>
          </div>
        </form>
      </Modal>
    </>
  );
}
