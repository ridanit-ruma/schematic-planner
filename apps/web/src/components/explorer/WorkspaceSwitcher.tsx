import { ChevronDown, Plus } from 'lucide-react';
import { useState } from 'react';
import { useNavigate } from 'react-router';

import { Button } from '@/components/ui/button';
import {
  DropdownAction,
  DropdownItem,
  DropdownMenu,
  DropdownSeparator,
} from '@/components/ui/dropdown-menu';
import { Field, Input } from '@/components/ui/field';
import { Modal } from '@/components/ui/modal';
import { useT } from '@/i18n';
import { workspaces, type WorkspaceSummary } from '@/lib/api';
import { useWorkspaces } from '@/features/workspaces/workspace-context';

/**
 * The workspace you are in, as the control that changes it — at the head of
 * the explorer, where a reader looks to find out which one this is.
 *
 * A menu rather than a field: switching workspace and making one are two
 * different acts, and a select made "New workspace…" read as a place you could
 * already be. The chevron is not decoration — without it the name reads as a
 * label, and nobody presses a label.
 */
export function WorkspaceSwitcher({
  current,
  onSwitched,
}: {
  current: WorkspaceSummary;
  onSwitched: () => void;
}) {
  const t = useT();
  const { all, add } = useWorkspaces();
  const navigate = useNavigate();

  const [creating, setCreating] = useState(false);
  const [name, setName] = useState('');

  // A workspace's own address opens its tree, with nothing else on screen.
  const go = (slug: string): void => {
    void navigate(`/workspace/${slug}`);
    onSwitched();
  };

  return (
    <>
      <DropdownMenu
        trigger={
          <button
            type="button"
            className="flex min-w-0 flex-1 items-center gap-1 rounded-md px-1.5 py-1 text-left transition-colors hover:bg-surface-2 focus:outline-none"
            aria-label={t.shell.workspaceSwitcher.label(current.name)}
          >
            <span className="min-w-0 truncate text-sm font-medium text-ink">{current.name}</span>
            <ChevronDown aria-hidden className="size-3.5 shrink-0 text-ink-faint" />
          </button>
        }
      >
        {all.map((workspace) => (
          <DropdownItem
            key={workspace.id}
            selected={workspace.id === current.id}
            onSelect={() => go(workspace.slug)}
          >
            {workspace.name}
          </DropdownItem>
        ))}
        <DropdownSeparator />
        <DropdownAction onSelect={() => setCreating(true)}>
          <Plus className="size-3.5 text-ink-faint" />
          {t.shell.workspaceSwitcher.newWorkspace}
        </DropdownAction>
      </DropdownMenu>

      <Modal
        open={creating}
        onOpenChange={setCreating}
        title={t.shell.workspaceSwitcher.newWorkspace}
      >
        <form
          className="space-y-4"
          onSubmit={(event) => {
            event.preventDefault();
            void workspaces.create(name.trim()).then((created) => {
              setName('');
              setCreating(false);
              // Into the list first: the route resolves the slug against it, and
              // sends anything it cannot find to a 404.
              add(created);
              go(created.slug);
            });
          }}
        >
          <Field label={t.shell.workspaceSwitcher.name} hint={t.shell.workspaceSwitcher.hint}>
            {(id) => (
              <Input
                id={id}
                autoFocus
                value={name}
                onChange={(event) => setName(event.target.value)}
                placeholder={t.shell.workspaceSwitcher.placeholder}
              />
            )}
          </Field>
          <div className="flex justify-end gap-2">
            <Button type="button" variant="ghost" onClick={() => setCreating(false)}>
              {t.common.cancel}
            </Button>
            <Button type="submit" variant="primary">
              <Plus className="size-3.5" />
              {t.shell.workspaceSwitcher.create}
            </Button>
          </div>
        </form>
      </Modal>
    </>
  );
}
