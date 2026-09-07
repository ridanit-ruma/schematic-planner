import { RotateCcw, Trash2 } from 'lucide-react';
import { useEffect, useState } from 'react';

import { Button } from '@/components/ui/button';
import { Empty, Problem, Spinner } from '@/components/ui/feedback';
import { DropdownAction } from '@/components/ui/dropdown-menu';
import { Modal } from '@/components/ui/modal';
import { Page } from '@/components/ui/page';
import { RowMenu } from '@/components/ui/row-menu';
import { Table, TD, TH, THead, TR } from '@/components/ui/table';
import { trash, type TrashItem } from '@/lib/api';
import { formatWhen, plural } from '@/lib/utils';
import { useWorkspace } from './workspace-context';

/**
 * What has been thrown away, and the two ways out.
 *
 * Deleting a plan is the one action here that can lose somebody else's work, so
 * it does not destroy anything — it moves it here. Destroying is a second act,
 * asked for by name, from this screen only.
 */
export function TrashPage() {
  const { current, reload: reloadWorkspaces } = useWorkspace();
  const [list, setList] = useState<TrashItem[] | null>(null);
  const [error, setError] = useState<unknown>(null);
  const [purging, setPurging] = useState<TrashItem | null>(null);
  const [emptying, setEmptying] = useState(false);

  const reload = (): void => {
    trash.list(current.id).then(setList).catch(setError);
  };
  useEffect(reload, [current.id]);

  const restore = async (item: TrashItem): Promise<void> => {
    try {
      await trash.restore(item.kind, item.id);
      reload();
      reloadWorkspaces();
    } catch (cause) {
      setError(cause);
    }
  };

  const purge = async (item: TrashItem): Promise<void> => {
    try {
      await trash.purge(item.kind, item.id);
      setPurging(null);
      reload();
    } catch (cause) {
      setError(cause);
    }
  };

  const empty = async (): Promise<void> => {
    try {
      await trash.empty(current.id);
      setEmptying(false);
      reload();
    } catch (cause) {
      setError(cause);
    }
  };

  if (list === null && error === null) {
    return (
      <div className="grid py-24 place-items-center">
        <Spinner />
      </div>
    );
  }

  const items = list ?? [];

  return (
    <Page
      title="Trash"
      description="Deleted plans and projects wait here. Nothing leaves on its own — restore it, or remove it for good."
      actions={
        items.length === 0 ? undefined : (
          <Button variant="danger" onClick={() => setEmptying(true)}>
            Empty trash
          </Button>
        )
      }
    >
      {error !== null ? (
        <div className="mb-4">
          <Problem error={error} />
        </div>
      ) : null}

      {items.length === 0 ? (
        <Empty
          title="Nothing in the trash"
          body="Deleted plans and projects appear here instead of disappearing."
        />
      ) : (
        <Table>
          <THead>
            <TH>Item</TH>
            <TH className="w-44" hide="md">
              Was in
            </TH>
            <TH className="w-24 sm:w-32" align="right">
              Deleted
            </TH>
            <TH className="w-10 md:w-44" align="right">
              <span className="sr-only">Actions</span>
            </TH>
          </THead>
          <tbody>
            {items.map((item) => (
              <TR key={`${item.kind}-${item.id}`}>
                <TD>
                  <span className="flex min-w-0 items-center gap-2">
                    <span className="rail-heading shrink-0 rounded-sm border border-rule px-1 py-0.5">
                      {item.kind}
                    </span>
                    <span className="min-w-0 flex-1 truncate font-medium text-ink">
                      {item.name}
                    </span>
                  </span>
                  <span className="block truncate text-xs text-ink-muted md:hidden">
                    {item.where}
                  </span>
                </TD>
                <TD className="truncate text-xs text-ink-muted" hide="md">
                  {item.where}
                </TD>
                <TD align="right" className="text-xs text-ink-muted">
                  {formatWhen(item.deletedAt)}
                  {item.by === null ? null : (
                    <span className="block truncate text-2xs text-ink-faint">
                      by {item.by.name}
                    </span>
                  )}
                </TD>
                <TD align="right">
                  {/* Two labelled buttons need room this row does not have on a
                      phone; the same two acts go behind the row's own menu. */}
                  <span className="hidden justify-end gap-1 md:flex">
                    <Button size="sm" variant="ghost" onClick={() => void restore(item)}>
                      <RotateCcw className="size-3.5" />
                      Restore
                    </Button>
                    <Button size="sm" variant="ghost" onClick={() => setPurging(item)}>
                      Delete
                    </Button>
                  </span>
                  <span className="flex justify-end md:hidden">
                    <RowMenu label={item.name}>
                      <DropdownAction onSelect={() => void restore(item)}>
                        <RotateCcw className="size-3.5 text-ink-faint" />
                        Restore
                      </DropdownAction>
                      <DropdownAction tone="danger" onSelect={() => setPurging(item)}>
                        <Trash2 className="size-3.5" />
                        Delete for good
                      </DropdownAction>
                    </RowMenu>
                  </span>
                </TD>
              </TR>
            ))}
          </tbody>
        </Table>
      )}

      <Modal
        open={purging !== null}
        onOpenChange={(open) => !open && setPurging(null)}
        title={`Delete ${purging?.name ?? ''} for good?`}
        description={
          purging?.kind === 'project'
            ? 'The project and every plan inside it go with it. This cannot be undone.'
            : 'The plan, its history and its share link go with it. This cannot be undone.'
        }
      >
        <div className="flex justify-end gap-2">
          <Button variant="ghost" onClick={() => setPurging(null)}>
            Cancel
          </Button>
          <Button
            variant="danger"
            onClick={() => {
              if (purging !== null) void purge(purging);
            }}
          >
            Delete for good
          </Button>
        </div>
      </Modal>

      <Modal
        open={emptying}
        onOpenChange={setEmptying}
        title="Empty the trash?"
        description={`${plural(items.length, 'item')} will be removed for good. This cannot be undone.`}
      >
        <div className="flex justify-end gap-2">
          <Button variant="ghost" onClick={() => setEmptying(false)}>
            Cancel
          </Button>
          <Button variant="danger" onClick={() => void empty()}>
            Empty trash
          </Button>
        </div>
      </Modal>
    </Page>
  );
}
