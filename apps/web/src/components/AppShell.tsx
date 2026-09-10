import {
  ChevronDown,
  ChevronRight,
  ChevronsUpDown,
  Clock,
  FolderKanban,
  KeyRound,
  LogOut,
  Plus,
  Settings,
  Trash2,
  UserRound,
  Users,
} from 'lucide-react';
import { useState, type ComponentType, type ReactNode } from 'react';
import { Link, NavLink, Outlet, useLocation, useNavigate, useParams } from 'react-router';

import { Mark } from './Mark';
import { Avatar } from './ui/avatar';
import { Button } from './ui/button';
import { Field, Input } from './ui/field';
import { Modal } from './ui/modal';
import {
  DropdownAction,
  DropdownItem,
  DropdownLabel,
  DropdownMenu,
  DropdownSeparator,
} from './ui/dropdown-menu';
import { Tooltip } from './ui/tooltip';
import { canAdminister, workspaces } from '@/lib/api';
import { useAuth } from '@/lib/auth-store';
import { useWorkspaces } from '@/features/workspaces/workspace-context';
import { cn } from '@/lib/utils';

type Workspace = ReturnType<typeof useWorkspaces>['all'][number];

/**
 * The workbench: a rail you navigate from, and a pane you work in.
 *
 * Everything that says *where you are* lives in the rail; the bar above the
 * pane says *what you are looking at*. The rail is read top to bottom as three
 * bands — the product, then you, then the workspace you happen to be in — so
 * that switching workspace never moves the things that are not part of one.
 */
export function AppShell() {
  const { workspaceSlug } = useParams();
  const { all, resting } = useWorkspaces();
  // The account screens and the recent list name no workspace. Showing the
  // first in the list there moved people somewhere they had not asked to be.
  const current =
    all.find((workspace) => workspace.slug === workspaceSlug) ?? resting;

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
  // Below a wide desktop the rail keeps its rows but drops its words: the names
  // move to tooltips and the pane gets back 200px, which is the difference
  // between a usable table and a scrolling one.
  return (
    <aside className="flex w-14 shrink-0 flex-col border-r border-rule bg-surface lg:w-64">
      <div className="flex h-11 shrink-0 items-center border-b border-rule px-2">
        <Link
          to="/recent"
          className="flex min-w-0 items-center gap-2 rounded-md px-1.5 py-1 hover:bg-surface-2"
        >
          <Mark className="size-6 shrink-0" />
          <span className="hidden truncate text-sm font-semibold tracking-tight text-ink lg:block">
            Schematic Planner
          </span>
        </Link>
      </div>

      <nav className="min-h-0 flex-1 overflow-y-auto px-2 py-2">
        {/* Yours, not a workspace's — so it sits above the workspace band with
            air between them rather than under a heading that would file it
            under whichever workspace you happen to be in. */}
        <RailLink to="/recent" icon={Clock} label="Recent">
          Recent
        </RailLink>

        {current === undefined ? null : (
          // Narrow, the heading that separates the two bands is gone, so a
          // hairline does its job: without it the workspace rows read as more
          // of the account's own.
          <div className="mt-3 border-t border-rule pt-3 lg:mt-5 lg:border-t-0 lg:pt-0">
            <p className="rail-heading hidden truncate px-2 pb-1 lg:block">{current.name}</p>
            <div>
              <RailLink to={`/workspace/${current.slug}`} icon={FolderKanban} label="Projects" end>
                Projects
              </RailLink>
              <RailLink to={`/workspace/${current.slug}/members`} icon={Users} label="Members">
                Members
                <span className="slug ml-auto text-ink-faint">{current.memberCount}</span>
              </RailLink>
              <RailLink to={`/workspace/${current.slug}/settings`} icon={Settings} label="Settings">
                Settings
              </RailLink>
              {canAdminister(current.role) ? (
                <RailLink to={`/workspace/${current.slug}/trash`} icon={Trash2} label="Trash">
                  Trash
                </RailLink>
              ) : null}
            </div>
          </div>
        )}
      </nav>

      <AccountRow />
    </aside>
  );
}

/**
 * You, at the bottom left, where every tool of this kind keeps you. Your
 * settings and the keys your agents hold are behind it: both belong to the
 * account rather than to a workspace, and putting them in the rail filed them
 * under whichever workspace was open.
 */
function AccountRow() {
  const user = useAuth((state) => state.user);
  const signOut = useAuth((state) => state.signOut);
  const navigate = useNavigate();

  return (
    <div className="border-t border-rule p-2">
      <DropdownMenu
        align="start"
        trigger={
          <button
            type="button"
            className="flex w-full items-center justify-center gap-2 rounded-md py-1 hover:bg-surface-2 focus:outline-none lg:justify-start lg:px-1.5"
            aria-label="Account"
          >
            <Avatar src={user?.avatarUrl} name={user?.name ?? '?'} className="size-6 rounded-sm" />
            <span className="hidden min-w-0 flex-1 truncate text-left text-xs text-ink lg:block">
              {user?.name ?? 'You'}
            </span>
            <ChevronsUpDown
              aria-hidden
              className="hidden size-3.5 shrink-0 text-ink-faint lg:block"
            />
          </button>
        }
      >
        <DropdownLabel>
          <span className="block truncate text-xs font-medium text-ink">{user?.name ?? 'You'}</span>
          <span className="block truncate text-2xs text-ink-muted">{user?.email ?? ''}</span>
        </DropdownLabel>
        <DropdownSeparator />
        <DropdownAction onSelect={() => void navigate('/settings')}>
          <UserRound className="size-3.5 text-ink-faint" />
          Account settings
        </DropdownAction>
        <DropdownAction onSelect={() => void navigate('/settings/agents')}>
          <KeyRound className="size-3.5 text-ink-faint" />
          Agent keys
        </DropdownAction>
        <DropdownSeparator />
        <DropdownAction tone="danger" onSelect={() => void signOut()}>
          <LogOut className="size-3.5" />
          Sign out
        </DropdownAction>
      </DropdownMenu>
    </div>
  );
}

function RailLink({
  to,
  icon: Icon,
  label,
  end,
  children,
}: {
  to: string;
  icon: ComponentType<{ className?: string }>;
  /** Shown as a tooltip when the rail is narrow enough to have dropped its words. */
  label: string;
  end?: boolean;
  children: ReactNode;
}) {
  return (
    <Tooltip content={label} side="right">
      <NavLink
        to={to}
        // `end` on an index route so that only the longest match lights up; a
        // prefix comparison leaves two rows active at once.
        end={end ?? false}
        // A string rather than the function form React Router also accepts:
        // the tooltip wraps this with `asChild`, and merging a function into a
        // className leaves the row with no styling at all. React Router adds
        // its own `active` class, which does the same job.
        className={cn(
          'flex h-8 items-center gap-2 rounded-md text-sm transition-colors',
          'justify-center lg:justify-start lg:px-2',
          'text-ink-muted hover:bg-surface-2 hover:text-ink',
          '[&.active]:bg-surface-4 [&.active]:text-ink',
        )}
      >
        <Icon className="size-4 shrink-0" />
        <span className="hidden min-w-0 flex-1 items-center lg:flex">{children}</span>
      </NavLink>
    </Tooltip>
  );
}

const SECTION_LABEL: { suffix: string; label: string }[] = [
  { suffix: '/members', label: 'Members' },
  { suffix: '/settings', label: 'Settings' },
  { suffix: '/trash', label: 'Trash' },
];

/**
 * Where you are, as a path — and the workspace you are in, as the control that
 * changes it.
 *
 * The name at the head of the trail is the switcher: that is where a reader
 * looks to find out which workspace they are in, so it is where they reach for
 * when they want another. Screens that belong to the account rather than to a
 * workspace keep it, separated by a rule instead of a chevron, because the
 * chevron would claim they sit inside it.
 */
function TopBar({ current }: { current: Workspace | undefined }) {
  const { projectSlug } = useParams();
  const { pathname } = useLocation();

  // A plan is addressed on its own, so its settings screen is not under a
  // workspace path even though the plan is in one.
  const inWorkspace = pathname.startsWith('/workspace/');

  const crumbs: { label: string; to?: string }[] = !inWorkspace
    ? [
        {
          label: pathname.startsWith('/plan/')
            ? 'Plan settings'
            : pathname === '/recent'
              ? 'Recent'
              : 'Account',
        },
      ]
    : current === undefined
      ? []
      : [
          projectSlug !== undefined
            ? { label: projectSlug, to: `/workspace/${current.slug}/project/${projectSlug}` }
            : {
                label:
                  SECTION_LABEL.find((section) => pathname.endsWith(section.suffix))?.label ??
                  'Projects',
              },
          // A project's own settings sit one further along the same trail.
          ...(projectSlug !== undefined && pathname.endsWith('/settings')
            ? [{ label: 'Settings' }]
            : []),
        ];

  return (
    <header className="flex h-11 shrink-0 items-center gap-1 border-b border-rule bg-surface px-2 sm:px-3">
      {current === undefined ? null : (
        <>
          <WorkspaceSwitcher current={current} />
          {inWorkspace ? (
            <ChevronRight aria-hidden className="size-3.5 shrink-0 text-ink-faint" />
          ) : (
            <span aria-hidden className="mx-1.5 h-4 w-px shrink-0 bg-rule-strong" />
          )}
        </>
      )}

      {crumbs.map((crumb, index) => (
        <span key={crumb.label} className="flex min-w-0 items-center gap-1">
          {index > 0 ? <ChevronRight className="size-3.5 shrink-0 text-ink-faint" /> : null}
          {crumb.to === undefined ? (
            <span
              className={cn(
                'truncate px-1.5 py-1 text-sm',
                index === crumbs.length - 1 ? 'text-ink' : 'text-ink-muted',
              )}
            >
              {crumb.label}
            </span>
          ) : (
            <Link
              to={crumb.to}
              className="truncate rounded-md px-1.5 py-1 text-sm text-ink-muted hover:bg-surface-2 hover:text-ink"
            >
              {crumb.label}
            </Link>
          )}
        </span>
      ))}
    </header>
  );
}

function WorkspaceSwitcher({ current }: { current: Workspace }) {
  const { all, add } = useWorkspaces();
  const navigate = useNavigate();

  const [creating, setCreating] = useState(false);
  const [name, setName] = useState('');

  return (
    <>
      {/* A menu rather than a field: switching workspace and making one are two
          different acts, and a select made "New workspace…" read as a place you
          could already be. The chevron is not decoration — without it the name
          reads as a label, and nobody presses a label. */}
      <DropdownMenu
        trigger={
          <button
            type="button"
            className="flex min-w-0 items-center gap-1 rounded-md px-1.5 py-1 text-left transition-colors hover:bg-surface-2 focus:outline-none"
            aria-label={`${current.name} — switch workspace`}
          >
            <span className="min-w-0 truncate text-sm font-medium text-ink">{current.name}</span>
            <ChevronDown aria-hidden className="size-3.5 shrink-0 text-ink-faint" />
          </button>
        }
      >
        {all.map((workspace) => (
          <DropdownItem
            key={workspace.id}
            selected={workspace.slug === current.slug}
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

      <Modal open={creating} onOpenChange={setCreating} title="New workspace">
        <form
          className="space-y-4"
          onSubmit={(event) => {
            event.preventDefault();
            void workspaces.create(name.trim()).then((created) => {
              setName('');
              setCreating(false);
              // Into the list first: the route resolves the slug against it, and
              // sends anything it cannot find back where it came from.
              add(created);
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
