import {
  ChevronRight,
  ChevronsUpDown,
  FolderKanban,
  KeyRound,
  LogOut,
  Plus,
  Settings,
  UserRound,
  Users,
} from 'lucide-react';
import { useState, type ComponentType, type ReactNode } from 'react';
import { Link, NavLink, Outlet, useNavigate, useParams } from 'react-router';

import { Mark } from './Mark';
import { Avatar } from './ui/avatar';
import { Button } from './ui/button';
import { Field, Input } from './ui/field';
import { Modal } from './ui/modal';
import { DropdownAction, DropdownItem, DropdownMenu, DropdownSeparator } from './ui/dropdown-menu';
import { Tooltip } from './ui/tooltip';
import { workspaces } from '@/lib/api';
import { useAuth } from '@/lib/auth-store';
import { useWorkspaces } from '@/features/workspaces/workspace-context';
import { cn } from '@/lib/utils';

type Workspace = ReturnType<typeof useWorkspaces>['all'][number];

/**
 * The workbench: a rail you navigate from, and a pane you work in.
 *
 * Everything that says *where you are* lives in the rail; the bar above the
 * pane says *what you are looking at*. A workspace's own sections used to be a
 * second row of tabs under the header, which put three bands of chrome above
 * the content and left no single place to look for navigation.
 */
export function AppShell() {
  const { workspaceSlug } = useParams();
  const { all } = useWorkspaces();
  const current = all.find((workspace) => workspace.slug === workspaceSlug) ?? all[0];

  return (
    <div className="flex h-dvh min-h-0 bg-ground">
      <Rail current={current} />
      <div className="flex min-w-0 flex-1 flex-col">
        <TopBar current={current} />
        <main className="min-h-0 flex-1 overflow-y-auto">
          <Outlet />
        </main>
      </div>
    </div>
  );
}

function Rail({ current }: { current: Workspace | undefined }) {
  const user = useAuth((state) => state.user);
  const signOut = useAuth((state) => state.signOut);

  return (
    <aside className="flex w-64 shrink-0 flex-col border-r border-rule bg-surface">
      <WorkspaceSwitcher current={current} />

      <nav className="min-h-0 flex-1 overflow-y-auto px-2 py-1">
        {current === undefined ? null : (
          <Section title="Workspace">
            <RailLink to={`/workspace/${current.slug}`} icon={FolderKanban} end>
              Projects
            </RailLink>
            <RailLink to={`/workspace/${current.slug}/members`} icon={Users}>
              Members
              <span className="slug ml-auto text-ink-faint">{current.memberCount}</span>
            </RailLink>
            <RailLink to={`/workspace/${current.slug}/settings`} icon={Settings}>
              Settings
            </RailLink>
          </Section>
        )}

        <Section title="Account">
          <RailLink to="/settings" icon={UserRound} end>
            Profile
          </RailLink>
          <RailLink to="/settings/agents" icon={KeyRound}>
            Agent keys
          </RailLink>
        </Section>
      </nav>

      <div className="flex items-center gap-1 border-t border-rule p-2">
        <Link
          to="/settings"
          className="flex min-w-0 flex-1 items-center gap-2 rounded-md px-1.5 py-1 hover:bg-surface-2"
        >
          <Avatar src={user?.avatarUrl} name={user?.name ?? '?'} className="size-6 rounded-sm" />
          <span className="min-w-0 flex-1 truncate text-xs text-ink">{user?.name ?? 'You'}</span>
        </Link>
        <Tooltip content="Sign out">
          <Button variant="ghost" size="icon" onClick={() => void signOut()} aria-label="Sign out">
            <LogOut className="size-4" />
          </Button>
        </Tooltip>
      </div>
    </aside>
  );
}

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div className="mb-3">
      <p className="rail-heading px-2 py-1.5">{title}</p>
      {children}
    </div>
  );
}

function RailLink({
  to,
  icon: Icon,
  end,
  children,
}: {
  to: string;
  icon: ComponentType<{ className?: string }>;
  end?: boolean;
  children: ReactNode;
}) {
  return (
    <NavLink
      to={to}
      // `end` on an index route so that only the longest match lights up; a
      // prefix comparison leaves two rows active at once.
      end={end ?? false}
      className={({ isActive }) =>
        cn(
          'flex h-8 items-center gap-2 rounded-md px-2 text-sm transition-colors',
          isActive ? 'bg-surface-4 text-ink' : 'text-ink-muted hover:bg-surface-2 hover:text-ink',
        )
      }
    >
      <Icon className="size-4 shrink-0" />
      {children}
    </NavLink>
  );
}

/** Where you are, as a path. Reads left to right and never wraps. */
function TopBar({ current }: { current: Workspace | undefined }) {
  const { projectSlug } = useParams();

  const crumbs = [
    current === undefined ? null : { label: current.name, to: `/workspace/${current.slug}` },
    projectSlug === undefined || current === undefined
      ? null
      : { label: projectSlug, to: `/workspace/${current.slug}/project/${projectSlug}` },
  ].filter((crumb) => crumb !== null);

  return (
    <header className="flex h-11 shrink-0 items-center gap-1 border-b border-rule bg-surface px-3">
      {crumbs.map((crumb, index) => (
        <span key={crumb.to} className="flex min-w-0 items-center gap-1">
          {index > 0 ? <ChevronRight className="size-3.5 shrink-0 text-ink-faint" /> : null}
          <Link
            to={crumb.to}
            className={cn(
              'truncate rounded-md px-1.5 py-1 text-sm hover:bg-surface-2',
              index === crumbs.length - 1 ? 'text-ink' : 'text-ink-muted',
            )}
          >
            {crumb.label}
          </Link>
        </span>
      ))}
    </header>
  );
}

function WorkspaceSwitcher({ current }: { current: Workspace | undefined }) {
  const { all, reload } = useWorkspaces();
  const navigate = useNavigate();

  const [creating, setCreating] = useState(false);
  const [name, setName] = useState('');

  return (
    <>
      <div className="border-b border-rule p-2">
        {/* A menu rather than a field: switching workspace and making one are
            two different acts, and a select made "New workspace…" read as a
            place you could already be. */}
        <DropdownMenu
          trigger={
            <button
              type="button"
              className="flex w-full items-center gap-2 rounded-md px-1.5 py-1.5 text-left hover:bg-surface-2 focus:outline-none"
            >
              <Mark className="size-6 shrink-0" />
              <span className="min-w-0 flex-1 truncate text-sm font-medium text-ink">
                {current?.name ?? 'Schematic Planner'}
              </span>
              <ChevronsUpDown aria-hidden className="size-3.5 shrink-0 text-ink-faint" />
            </button>
          }
        >
          {all.map((workspace) => (
            <DropdownItem
              key={workspace.id}
              selected={workspace.slug === current?.slug}
              onSelect={() => void navigate(`/workspace/${workspace.slug}`)}
            >
              {workspace.name}
            </DropdownItem>
          ))}
          <DropdownSeparator />
          <DropdownAction onSelect={() => setCreating(true)}>
            <Plus className="size-3.5 text-ink-faint" />
            New workspace
          </DropdownAction>
        </DropdownMenu>
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
