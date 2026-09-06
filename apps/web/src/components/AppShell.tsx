import { ChevronsUpDown, LogOut, Plus, User } from 'lucide-react';
import { useState } from 'react';
import { Link, Outlet, useNavigate, useParams } from 'react-router';

import { Wordmark } from './Wordmark';
import { Button } from './ui/button';
import { Field, Input } from './ui/field';
import { Modal } from './ui/modal';
import { ThemeToggle } from './ui/theme';
import { workspaces } from '@/lib/api';
import { useAuth } from '@/lib/auth-store';
import { useWorkspaces } from '@/features/workspaces/workspace-context';

export function AppShell() {
  const { signOut } = useAuth();

  return (
    <div className="flex min-h-dvh flex-col">
      <header className="flex h-11 shrink-0 items-center gap-4 border-b border-rule bg-surface px-4">
        <Link to="/" className="text-ink">
          <Wordmark />
        </Link>

        <WorkspaceSwitcher />

        <div className="flex-1" />

        <Link
          to="/settings"
          className="flex items-center gap-1.5 text-xs text-ink-muted hover:text-ink"
        >
          <User className="size-3.5" />
          Account
        </Link>
        <ThemeToggle />
        <Button variant="ghost" size="icon" onClick={() => void signOut()} aria-label="Sign out">
          <LogOut className="size-4" />
        </Button>
      </header>

      <main className="min-h-0 flex-1">
        <Outlet />
      </main>
    </div>
  );
}

function WorkspaceSwitcher() {
  const { all, reload } = useWorkspaces();
  const { workspaceSlug } = useParams();
  const navigate = useNavigate();

  const [creating, setCreating] = useState(false);
  const [name, setName] = useState('');
  const current = all.find((workspace) => workspace.slug === workspaceSlug);

  if (all.length === 0) return null;

  return (
    <>
      <div className="relative flex items-center">
        <ChevronsUpDown
          aria-hidden
          className="pointer-events-none absolute right-1.5 size-3 text-ink-faint"
        />
        <select
          aria-label="Switch workspace"
          className="appearance-none rounded-[2px] border border-rule bg-surface py-1 pr-6 pl-2 text-xs text-ink focus:border-accent focus:outline-none"
          value={current?.slug ?? ''}
          onChange={(event) => {
            if (event.target.value === '__new') {
              setCreating(true);
              return;
            }
            void navigate(`/workspace/${event.target.value}`);
          }}
        >
          {current === undefined ? <option value="">Choose a workspace</option> : null}
          {all.map((workspace) => (
            <option key={workspace.id} value={workspace.slug}>
              {workspace.name}
            </option>
          ))}
          <option value="__new">+ New workspace…</option>
        </select>
      </div>

      <Modal open={creating} onOpenChange={setCreating} title="New workspace">
        <form
          className="space-y-4"
          onSubmit={(event) => {
            event.preventDefault();
            void workspaces.create(name.trim()).then((created) => {
              setName('');
              setCreating(false);
              reload();
              void navigate(`/workspace/${created.slug}`);
            });
          }}
        >
          <Field label="Name" hint="A workspace holds projects, and a project holds plans.">
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
              <Plus className="size-3.5" />
              Create workspace
            </Button>
          </div>
        </form>
      </Modal>
    </>
  );
}
