import {
  ArrowLeft,
  ChevronDown,
  ChevronRight,
  Download,
  FolderPlus,
  FolderClosed,
  FolderOpen,
  Link2,
  PanelLeftClose,
  PanelLeftOpen,
  Pencil,
  Plus,
  Settings,
  Trash2,
} from 'lucide-react';
import { useRef, useState } from 'react';
import { Link, useNavigate } from 'react-router';

import { ContextAction, ContextMenu, ContextSeparator } from '@/components/ui/context-menu';
import { Button } from '@/components/ui/button';
import { Field, Input } from '@/components/ui/field';
import { Modal } from '@/components/ui/modal';
import { Problem, Spinner } from '@/components/ui/feedback';
import { Tooltip } from '@/components/ui/tooltip';
import { downloadExport, folders, plans, projects, type PlanNavigation } from '@/lib/api';
import { cn } from '@/lib/utils';
import { useLiveList } from '@/lib/use-live-list';

const COLLAPSED_KEY = 'plan-sidebar-collapsed';

type Project = PlanNavigation['projects'][number];
type Folder = Project['folders'][number];
type Plan = Project['plans'][number];

/** Where a dragged plan would land. A project means its own top level. */
type Drop = { project: string; folder: string | null };

/** What the naming dialog is for, and where the thing it makes should go. */
type Naming =
  | { kind: 'folder'; projectId: string }
  | { kind: 'plan'; projectId: string; folderId: string | null }
  | { kind: 'rename-folder'; folderId: string; was: string };

function readCollapsed(): boolean {
  try {
    const stored = window.localStorage.getItem(COLLAPSED_KEY);
    if (stored !== null) return stored === '1';
  } catch {
    /* A remembered preference is a convenience, not a requirement. */
  }
  // Unasked, a narrow screen starts folded: 256px of rail on a phone is most of
  // the screen, and the canvas is what the address was for.
  return window.innerWidth < 768;
}

/**
 * The rest of the workspace, beside the plan you are reading. A plan is
 * addressed on its own so that its link survives a rename, which leaves the
 * canvas with no way back to its neighbours — this is that way back.
 *
 * It is also where plans are filed. Everything that rearranges the tree happens
 * under the right button, where the pointer already is, and a plan is dragged
 * from one drawer to another rather than moved through a dialog.
 */
export function PlanSidebar({ planId }: { planId: string }) {
  const [nav, setNav] = useState<PlanNavigation | null>(null);
  const [failed, setFailed] = useState(false);
  const [collapsed, setCollapsed] = useState(readCollapsed);
  const [open, setOpen] = useState<ReadonlySet<string>>(new Set());
  const [naming, setNaming] = useState<Naming | null>(null);
  const [name, setName] = useState('');
  const [dragging, setDragging] = useState<string | null>(null);
  const [over, setOver] = useState<string | null>(null);
  const [error, setError] = useState<unknown>(null);
  const navigate = useNavigate();
  const reread = useRef<() => void>(() => {});

  useLiveList(() => {
    let live = true;
    const read = (): void => {
      plans
        .navigation(planId)
        .then((next) => {
          if (!live) return;
          setNav(next);
          setFailed(false);
          // Only the project you are in starts open — opening all of them would
          // bury the current plan on a large workspace — and anything you opened
          // by hand stays open as you move between plans. A drawer holding the
          // plan on screen opens with it, or the rail would claim it is nowhere.
          const here = next.projects
            .flatMap((project) => project.plans)
            .find((plan) => plan.id === planId);
          setOpen((current) =>
            new Set(
              [...current, next.projectId, here?.folderId].filter(
                (key): key is string => key !== undefined && key !== null,
              ),
            ),
          );
        })
        .catch(() => live && setFailed(true));
    };
    reread.current = read;
    read();
    return () => {
      live = false;
    };
  }, [planId]);

  const toggleCollapsed = (): void => {
    const next = !collapsed;
    setCollapsed(next);
    try {
      window.localStorage.setItem(COLLAPSED_KEY, next ? '1' : '0');
    } catch {
      /* A remembered preference is a convenience, not a requirement. */
    }
  };

  const toggle = (key: string): void =>
    setOpen((current) => {
      const next = new Set(current);
      if (!next.delete(key)) next.add(key);
      return next;
    });

  /** Runs the act, then rereads: the rail is the only view of what just changed. */
  const act = async (work: () => Promise<unknown>): Promise<void> => {
    try {
      await work();
      setError(null);
      reread.current();
    } catch (cause) {
      setError(cause);
    }
  };

  const ask = (request: Naming): void => {
    setName(request.kind === 'rename-folder' ? request.was : '');
    setNaming(request);
  };

  const submitName = (): void => {
    const trimmed = name.trim();
    if (trimmed === '' || naming === null) return;
    const request = naming;
    setNaming(null);
    setName('');

    void act(async () => {
      if (request.kind === 'folder') {
        const made = await folders.create(request.projectId, trimmed);
        setOpen((current) => new Set([...current, made.id]));
        return;
      }
      if (request.kind === 'rename-folder') {
        await folders.rename(request.folderId, trimmed);
        return;
      }
      const made = await plans.create(request.projectId, trimmed, '', request.folderId);
      navigate(`/plan/${made.id}`);
    });
  };

  /**
   * Throwing away the plan on screen has to take you off it as well, or the
   * canvas carries on showing a document the rest of the product has stopped
   * listing — and the next write to it fails with nothing to explain why.
   */
  const trashPlan = (id: string): void => {
    void act(async () => {
      await plans.remove(id);
      if (id !== planId) return;
      const workspace = nav?.workspace.slug;
      navigate(workspace === undefined ? '/recent' : `/workspace/${workspace}`);
    });
  };

  const movePlan = (plan: string, to: Drop): void => {
    void act(() => plans.move(plan, to.project, to.folder));
  };

  const share = (plan: string): void => {
    void act(async () => {
      const { token } = await plans.share(plan);
      await navigator.clipboard
        .writeText(`${window.location.origin}/share/${token}`)
        .catch(() => undefined);
    });
  };

  const exportPlan = (plan: Plan): void => {
    void act(() =>
      downloadExport(plan.id, `${plan.title.toLowerCase().replace(/[^a-z0-9]+/g, '-')}.zip`),
    );
  };

  if (collapsed) {
    return (
      <aside className="flex w-9 shrink-0 flex-col items-center gap-1 border-r border-rule bg-surface py-2">
        <Tooltip content="Show plans" side="right">
          <button
            type="button"
            onClick={toggleCollapsed}
            className="grid size-7 place-items-center rounded-md text-ink-muted hover:bg-surface-2 hover:text-ink"
          >
            <PanelLeftOpen className="size-4" />
            <span className="sr-only">Show plans</span>
          </button>
        </Tooltip>
        {/* The way out stays reachable with the rail folded away. */}
        {nav === null ? null : (
          <Tooltip content={`Leave for ${nav.workspace.name}`} side="right">
            <Link
              to={`/workspace/${nav.workspace.slug}`}
              className="grid size-7 place-items-center rounded-md text-ink-muted hover:bg-surface-2 hover:text-ink"
            >
              <ArrowLeft className="size-4" />
              <span className="sr-only">{`Leave for ${nav.workspace.name}`}</span>
            </Link>
          </Tooltip>
        )}
      </aside>
    );
  }

  const here = nav?.projects.find((project) => project.id === nav.projectId) ?? null;

  return (
    <>
      {/* Narrow, the rail floats over the canvas rather than taking a quarter of
          it, and the scrim is the other way out. */}
      <button
        type="button"
        aria-label="Hide plans"
        onClick={toggleCollapsed}
        className="absolute inset-0 z-30 bg-black/50 md:hidden"
      />
      <aside className="flex w-64 shrink-0 flex-col border-r border-rule bg-surface max-md:absolute max-md:inset-y-0 max-md:left-0 max-md:z-40">
        <div className="flex h-11 shrink-0 items-center gap-1 border-b border-rule px-2">
          {nav === null ? (
            <span className="flex-1 truncate px-1 text-xs text-ink-faint">
              {failed ? 'Plans unavailable' : 'Loading'}
            </span>
          ) : (
            <Link
              to={`/workspace/${nav.workspace.slug}`}
              title={`Leave for ${nav.workspace.name}`}
              className="flex min-w-0 flex-1 items-center gap-1.5 rounded-md px-1 py-0.5 text-xs font-medium text-ink hover:bg-surface-2"
            >
              <ArrowLeft className="size-3.5 shrink-0 text-ink-muted" />
              <span className="truncate">{nav.workspace.name}</span>
            </Link>
          )}
          <Tooltip content="Hide plans">
            <button
              type="button"
              onClick={toggleCollapsed}
              className="grid size-6 shrink-0 place-items-center rounded-md text-ink-muted hover:bg-surface-2 hover:text-ink"
            >
              <PanelLeftClose className="size-4" />
              <span className="sr-only">Hide plans</span>
            </button>
          </Tooltip>
        </div>

        {error !== null ? (
          <div className="border-b border-rule px-2 py-2">
            <Problem error={error} />
          </div>
        ) : null}

        {/* The empty space below the tree is its own target: a right-click with
            nothing under it means "here", and here is the project you are in. */}
        <ContextMenu
          menu={
            here === null ? (
              <ContextAction onSelect={() => undefined} disabled>
                Nothing to add to
              </ContextAction>
            ) : (
              <>
                <ContextAction
                  onSelect={() => ask({ kind: 'folder', projectId: here.id })}
                >
                  <FolderPlus className="size-3.5 text-ink-faint" />
                  New folder
                </ContextAction>
                <ContextAction
                  onSelect={() => ask({ kind: 'plan', projectId: here.id, folderId: null })}
                >
                  <Plus className="size-3.5 text-ink-faint" />
                  New plan
                </ContextAction>
              </>
            )
          }
        >
          <div
            className="min-h-0 flex-1 overflow-y-auto px-2 py-1"
            onDragEnd={() => {
              setDragging(null);
              setOver(null);
            }}
          >
            {nav === null ? (
              failed ? null : (
                <div className="grid place-items-center py-6">
                  <Spinner />
                </div>
              )
            ) : (
              nav.projects.map((project) => (
                <ProjectRow
                  key={project.id}
                  project={project}
                  planId={planId}
                  open={open}
                  onToggle={toggle}
                  dragging={dragging}
                  over={over}
                  onOver={setOver}
                  onDragPlan={setDragging}
                  onDropPlan={movePlan}
                  onNew={ask}
                  onNavigate={(id) => navigate(`/plan/${id}`)}
                  workspaceSlug={nav.workspace.slug}
                  onTrashProject={(id) => void act(() => projects.remove(id))}
                  onTrashFolder={(id) => void act(() => folders.remove(id))}
                  onTrashPlan={trashPlan}
                  onShare={share}
                  onExport={exportPlan}
                />
              ))
            )}
          </div>
        </ContextMenu>
      </aside>

      <Modal
        open={naming !== null}
        onOpenChange={(next) => {
          if (!next) {
            setNaming(null);
            setName('');
          }
        }}
        title={
          naming?.kind === 'folder'
            ? 'New folder'
            : naming?.kind === 'rename-folder'
              ? 'Rename folder'
              : 'New plan'
        }
      >
        <form
          className="space-y-4"
          onSubmit={(event) => {
            event.preventDefault();
            submitName();
          }}
        >
          <Field label="Name">
            {(id) => (
              <Input
                id={id}
                autoFocus
                value={name}
                onChange={(event) => setName(event.target.value)}
                placeholder={naming?.kind === 'plan' ? 'Checkout flow' : 'Architecture'}
              />
            )}
          </Field>
          <div className="flex justify-end gap-2">
            <Button type="button" variant="ghost" onClick={() => setNaming(null)}>
              Cancel
            </Button>
            <Button type="submit" variant="primary">
              {naming?.kind === 'rename-folder' ? 'Rename' : 'Create'}
            </Button>
          </div>
        </form>
      </Modal>
    </>
  );
}

function ProjectRow({
  project,
  workspaceSlug,
  planId,
  open,
  onToggle,
  dragging,
  over,
  onOver,
  onDragPlan,
  onDropPlan,
  onNew,
  onNavigate,
  onTrashProject,
  onTrashFolder,
  onTrashPlan,
  onShare,
  onExport,
}: {
  project: Project;
  workspaceSlug: string;
  planId: string;
  open: ReadonlySet<string>;
  onToggle: (key: string) => void;
  dragging: string | null;
  over: string | null;
  onOver: (key: string | null) => void;
  onDragPlan: (id: string | null) => void;
  onDropPlan: (plan: string, to: Drop) => void;
  onNew: (naming: Naming) => void;
  onNavigate: (id: string) => void;
  onTrashProject: (id: string) => void;
  onTrashFolder: (id: string) => void;
  onTrashPlan: (id: string) => void;
  onShare: (id: string) => void;
  onExport: (plan: Plan) => void;
}) {
  const expanded = open.has(project.id);
  const loose = project.plans.filter((plan) => plan.folderId === null);
  const drop: Drop = { project: project.id, folder: null };

  return (
    <div>
      <ContextMenu
        menu={
          <>
            <ContextAction onSelect={() => onNew({ kind: 'folder', projectId: project.id })}>
              <FolderPlus className="size-3.5 text-ink-faint" />
              New folder
            </ContextAction>
            <ContextAction
              onSelect={() => onNew({ kind: 'plan', projectId: project.id, folderId: null })}
            >
              <Plus className="size-3.5 text-ink-faint" />
              New plan
            </ContextAction>
            <ContextSeparator />
            <ContextAction
              onSelect={() =>
                window.location.assign(
                  `/workspace/${workspaceSlug}/project/${project.slug}/settings`,
                )
              }
            >
              <Settings className="size-3.5 text-ink-faint" />
              Settings
            </ContextAction>
            <ContextAction tone="danger" onSelect={() => onTrashProject(project.id)}>
              <Trash2 className="size-3.5" />
              Move to trash
            </ContextAction>
          </>
        }
      >
        <button
          type="button"
          aria-expanded={expanded}
          onContextMenu={(event) => event.stopPropagation()}
          onClick={() => onToggle(project.id)}
          onDragOver={(event) => {
            if (dragging === null) return;
            event.preventDefault();
            onOver(`project:${project.id}`);
          }}
          onDrop={(event) => {
            if (dragging === null) return;
            event.preventDefault();
            onDropPlan(dragging, drop);
            onOver(null);
            onDragPlan(null);
          }}
          className={cn(
            'flex h-8 w-full items-center gap-1 rounded-md px-2 text-left text-sm text-ink-muted transition-colors hover:bg-surface-2 hover:text-ink',
            over === `project:${project.id}` && 'bg-accent/15 text-ink ring-1 ring-accent/50',
          )}
        >
          {expanded ? (
            <ChevronDown className="size-3.5 shrink-0" />
          ) : (
            <ChevronRight className="size-3.5 shrink-0" />
          )}
          <span className="min-w-0 flex-1 truncate font-medium">{project.name}</span>
          <span className="slug shrink-0 text-ink-faint">{project.plans.length}</span>
        </button>
      </ContextMenu>

      {!expanded ? null : project.folders.length === 0 && project.plans.length === 0 ? (
        <p className="py-1 pr-2 pl-7 text-xs text-ink-faint">No plans yet</p>
      ) : (
        <>
          {project.folders.map((folder) => (
            <FolderRow
              key={folder.id}
              folder={folder}
              project={project}
              planId={planId}
              expanded={open.has(folder.id)}
              onToggle={onToggle}
              dragging={dragging}
              over={over}
              onOver={onOver}
              onDragPlan={onDragPlan}
              onDropPlan={onDropPlan}
              onNew={onNew}
              onNavigate={onNavigate}
              onTrashFolder={onTrashFolder}
              onTrashPlan={onTrashPlan}
              onShare={onShare}
              onExport={onExport}
            />
          ))}
          {loose.map((plan) => (
            <PlanRow
              key={plan.id}
              plan={plan}
              current={plan.id === planId}
              depth={0}
              dragging={dragging}
              onDragPlan={onDragPlan}
              onNavigate={onNavigate}
              onTrash={onTrashPlan}
              onShare={onShare}
              onExport={onExport}
            />
          ))}
        </>
      )}
    </div>
  );
}

function FolderRow({
  folder,
  project,
  planId,
  expanded,
  onToggle,
  dragging,
  over,
  onOver,
  onDragPlan,
  onDropPlan,
  onNew,
  onNavigate,
  onTrashFolder,
  onTrashPlan,
  onShare,
  onExport,
}: {
  folder: Folder;
  project: Project;
  planId: string;
  expanded: boolean;
  onToggle: (key: string) => void;
  dragging: string | null;
  over: string | null;
  onOver: (key: string | null) => void;
  onDragPlan: (id: string | null) => void;
  onDropPlan: (plan: string, to: Drop) => void;
  onNew: (naming: Naming) => void;
  onNavigate: (id: string) => void;
  onTrashFolder: (id: string) => void;
  onTrashPlan: (id: string) => void;
  onShare: (id: string) => void;
  onExport: (plan: Plan) => void;
}) {
  const held = project.plans.filter((plan) => plan.folderId === folder.id);
  const target = `folder:${folder.id}`;

  return (
    <>
      <ContextMenu
        menu={
          <>
            <ContextAction
              onSelect={() => onNew({ kind: 'plan', projectId: project.id, folderId: folder.id })}
            >
              <Plus className="size-3.5 text-ink-faint" />
              New plan here
            </ContextAction>
            <ContextAction
              onSelect={() =>
                onNew({ kind: 'rename-folder', folderId: folder.id, was: folder.name })
              }
            >
              <Pencil className="size-3.5 text-ink-faint" />
              Rename
            </ContextAction>
            <ContextSeparator />
            <ContextAction tone="danger" onSelect={() => onTrashFolder(folder.id)}>
              <Trash2 className="size-3.5" />
              Move to trash
            </ContextAction>
          </>
        }
      >
        <button
          type="button"
          aria-expanded={expanded}
          onContextMenu={(event) => event.stopPropagation()}
          onClick={() => onToggle(folder.id)}
          onDragOver={(event) => {
            if (dragging === null) return;
            event.preventDefault();
            onOver(target);
          }}
          onDrop={(event) => {
            if (dragging === null) return;
            event.preventDefault();
            onDropPlan(dragging, { project: project.id, folder: folder.id });
            onOver(null);
            onDragPlan(null);
          }}
          className={cn(
            'flex h-7 w-full items-center gap-1.5 rounded-md pr-2 pl-5 text-left text-sm text-ink-muted transition-colors hover:bg-surface-2 hover:text-ink',
            over === target && 'bg-accent/15 text-ink ring-1 ring-accent/50',
          )}
        >
          {expanded ? (
            <FolderOpen className="size-3.5 shrink-0 text-ink-faint" />
          ) : (
            <FolderClosed className="size-3.5 shrink-0 text-ink-faint" />
          )}
          <span className="min-w-0 flex-1 truncate">{folder.name}</span>
          <span className="slug shrink-0 text-ink-faint">{held.length}</span>
        </button>
      </ContextMenu>

      {!expanded ? null : held.length === 0 ? (
        <p className="py-1 pr-2 pl-10 text-xs text-ink-faint">Empty</p>
      ) : (
        held.map((plan) => (
          <PlanRow
            key={plan.id}
            plan={plan}
            current={plan.id === planId}
            depth={1}
            dragging={dragging}
            onDragPlan={onDragPlan}
            onNavigate={onNavigate}
            onTrash={onTrashPlan}
            onShare={onShare}
            onExport={onExport}
          />
        ))
      )}
    </>
  );
}

function PlanRow({
  plan,
  current,
  depth,
  dragging,
  onDragPlan,
  onNavigate,
  onTrash,
  onShare,
  onExport,
}: {
  plan: Plan;
  current: boolean;
  /** 0 at the project's top level, 1 inside a folder. */
  depth: number;
  dragging: string | null;
  onDragPlan: (id: string | null) => void;
  onNavigate: (id: string) => void;
  onTrash: (id: string) => void;
  onShare: (id: string) => void;
  onExport: (plan: Plan) => void;
}) {
  return (
    <ContextMenu
      menu={
        <>
          <ContextAction onSelect={() => onShare(plan.id)}>
            <Link2 className="size-3.5 text-ink-faint" />
            Share
          </ContextAction>
          <ContextAction onSelect={() => onExport(plan)}>
            <Download className="size-3.5 text-ink-faint" />
            Export
          </ContextAction>
          <ContextAction onSelect={() => window.location.assign(`/plan/${plan.id}/settings`)}>
            <Settings className="size-3.5 text-ink-faint" />
            Plan settings
          </ContextAction>
          <ContextSeparator />
          <ContextAction tone="danger" onSelect={() => onTrash(plan.id)}>
            <Trash2 className="size-3.5" />
            Move to trash
          </ContextAction>
        </>
      }
    >
      <button
        type="button"
        draggable
        aria-current={current ? 'page' : undefined}
        onDragStart={(event) => {
          event.dataTransfer.effectAllowed = 'move';
          // Some browsers refuse to start a drag with nothing on the clipboard.
          event.dataTransfer.setData('text/plain', plan.id);
          onDragPlan(plan.id);
        }}
        onContextMenu={(event) => event.stopPropagation()}
        onClick={() => !current && onNavigate(plan.id)}
        title={plan.title}
        className={cn(
          'flex h-7 w-full items-center gap-2 rounded-md pr-2 text-left text-sm transition-colors',
          depth === 0 ? 'pl-7' : 'pl-10',
          dragging === plan.id && 'opacity-40',
          current
            ? 'bg-surface-4 font-medium text-ink'
            : 'text-ink-muted hover:bg-surface-2 hover:text-ink',
        )}
      >
        <span
          aria-hidden
          className={cn('h-3 w-0.5 shrink-0', current ? 'bg-accent' : 'bg-transparent')}
        />
        <span className="min-w-0 flex-1 truncate">
          {plan.title === '' ? 'Untitled plan' : plan.title}
        </span>
      </button>
    </ContextMenu>
  );
}
