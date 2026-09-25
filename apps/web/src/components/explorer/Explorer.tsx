import {
  Clock,
  FilePlus,
  FolderPlus,
  PanelLeftClose,
  PanelLeftOpen,
  Settings,
  SquarePlus,
  Trash2,
  Users,
} from 'lucide-react';
import {
  useCallback,
  useEffect,
  useImperativeHandle,
  useRef,
  useState,
  type ComponentType,
  type ReactNode,
  type Ref,
} from 'react';
import { NavLink, useLocation, useNavigate, useParams } from 'react-router';

import { ContextAction, ContextMenu } from '@/components/ui/context-menu';
import { Problem, Spinner } from '@/components/ui/feedback';
import { Tooltip } from '@/components/ui/tooltip';
import { useT } from '@/i18n';
import {
  canAdminister,
  downloadExport,
  folders,
  plans,
  projects,
  workspaces,
  type WorkspaceNavigation,
} from '@/lib/api';
import { useLiveList } from '@/lib/use-live-list';
import { cn } from '@/lib/utils';
import { useWorkspaces, visitWorkspace } from '@/features/workspaces/workspace-context';
import { AccountRow } from './AccountRow';
import type { ExplorerHandle } from './explorer-context';
import { IconButton } from './IconButton';
import { ResizeGrip } from './ResizeGrip';
import {
  currentProject,
  isWithin,
  planAncestors,
  projectOfPlan,
  readReveal,
  revealedIds,
  type Dragged,
  type DropTarget,
  type NavPlan,
} from './tree';
import { ExplorerTree, type Naming, type TreeActions } from './ExplorerTree';
import { isNarrow, useExplorerLayout } from './use-explorer-layout';
import { WorkspaceSwitcher } from './WorkspaceSwitcher';

const LAST_PROJECT_KEY = 'explorer-project';

function readLastProject(): string | null {
  try {
    return window.localStorage.getItem(LAST_PROJECT_KEY);
  } catch {
    return null;
  }
}

/** Once the row is drawn: after the state that opens its drawers has rendered. */
function scrollToRow(id: string): void {
  requestAnimationFrame(() =>
    requestAnimationFrame(() => {
      document
        .querySelector(`[data-tree-row="${CSS.escape(id)}"]`)
        ?.scrollIntoView({ block: 'nearest' });
    }),
  );
}

/**
 * The left of every signed-in screen: which workspace you are in, what you
 * worked on lately, and the whole workspace as a tree — projects, the folders
 * in them however deep, and the plans in those — with everything that makes,
 * renames, moves or throws away one of them on the row itself.
 *
 * It replaces the project, plan and folder screens. A list that you open to
 * find a plan and then leave to draw it was two screens for one act.
 */
export function Explorer({ handle }: { handle: Ref<ExplorerHandle> }) {
  const t = useT();
  const navigate = useNavigate();
  const location = useLocation();
  const { planId, workspaceSlug } = useParams();
  const { all, resting } = useWorkspaces();
  const layout = useExplorerLayout();

  const reveal = readReveal(location.state);
  const wanted =
    (workspaceSlug === undefined
      ? undefined
      : all.find((workspace) => workspace.slug === workspaceSlug)) ??
    (reveal?.workspace === undefined
      ? undefined
      : all.find((workspace) => workspace.slug === reveal.workspace)) ??
    resting;

  const [nav, setNav] = useState<WorkspaceNavigation | null>(null);
  const [failed, setFailed] = useState(false);
  const [open, setOpen] = useState<ReadonlySet<string>>(new Set());
  const [naming, setNaming] = useState<Naming | null>(null);
  const [dragging, setDragging] = useState<Dragged | null>(null);
  const [over, setOver] = useState<string | null>(null);
  const [error, setError] = useState<unknown>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [lastProject, setLastProjectState] = useState<string | null>(readLastProject);
  const reread = useRef<() => void>(() => undefined);

  // A plan's address names no workspace, so on a plan the tree is read around
  // the plan; once the tree holds it, it is simply that workspace's tree, and
  // moving between its plans reads nothing again.
  const known = planId !== undefined && nav !== null && projectOfPlan(nav, planId) !== undefined;
  const source =
    planId !== undefined && !known
      ? ({ kind: 'plan', id: planId } as const)
      : planId !== undefined && nav !== null
        ? ({ kind: 'workspace', id: nav.workspace.id } as const)
        : wanted === undefined
          ? null
          : ({ kind: 'workspace', id: wanted.id } as const);
  const sourceKey = source === null ? 'none' : `${source.kind}:${source.id}`;

  useLiveList(() => {
    let live = true;
    const read = (): void => {
      if (source === null) return;
      const request =
        source.kind === 'plan'
          ? plans
              .navigation(source.id)
              .then((found) => {
                visitWorkspace(found.workspace.slug);
                return found as WorkspaceNavigation;
              })
              // A plan that cannot be opened still leaves the workspace to show.
              .catch((cause: unknown) => {
                if (wanted === undefined) throw cause;
                return workspaces.navigation(wanted.id);
              })
          : workspaces.navigation(source.id);
      request
        .then((next) => {
          if (!live) return;
          setNav(next);
          setFailed(false);
        })
        .catch(() => live && setFailed(true));
    };
    reread.current = read;
    read();
    return () => {
      live = false;
    };
  }, [sourceKey]);

  const setLastProject = useCallback((id: string) => {
    setLastProjectState(id);
    try {
      window.localStorage.setItem(LAST_PROJECT_KEY, id);
    } catch {
      /* A remembered place is a convenience, not a requirement. */
    }
  }, []);

  const expand = useCallback((ids: readonly string[]) => {
    setOpen((current) =>
      ids.every((id) => current.has(id)) ? current : new Set([...current, ...ids]),
    );
  }, []);

  // The plan on screen is shown in the tree: its drawers open once when it is
  // opened, and after that they stay however you leave them.
  const revealedPlan = useRef<string | null>(null);
  useEffect(() => {
    if (nav === null || planId === undefined || revealedPlan.current === planId) return;
    const above = planAncestors(nav, planId);
    if (above === null) return;
    revealedPlan.current = planId;
    expand(above);
    setLastProject(above[0] as string);
    scrollToRow(planId);
  }, [nav, planId, expand, setLastProject]);

  // An old list address lands on /recent with where it pointed opened and in view.
  const revealedAt = useRef<string | null>(null);
  const { collapsed, setCollapsed } = layout;
  useEffect(() => {
    if (reveal === null || nav === null || revealedAt.current === location.key) return;
    if (reveal.workspace !== undefined && nav.workspace.slug !== reveal.workspace) return;
    revealedAt.current = location.key;
    const found = revealedIds(nav, reveal);
    if (found === null) return;
    if (collapsed && !isNarrow()) setCollapsed(false);
    expand(found.open);
    setLastProject(found.open[0] as string);
    scrollToRow(found.target);
    // `reveal` is read out of the location, which `location.key` stands for.
  }, [nav, location.key, collapsed, setCollapsed, expand, setLastProject]);

  useEffect(() => {
    if (notice === null) return;
    const timer = window.setTimeout(() => setNotice(null), 2400);
    return () => window.clearTimeout(timer);
  }, [notice]);

  const renamePlan = useCallback((id: string, title: string) => {
    setNav((current) =>
      current === null
        ? current
        : {
            ...current,
            projects: current.projects.map((project) =>
              project.plans.some((plan) => plan.id === id && plan.title !== title)
                ? {
                    ...project,
                    plans: project.plans.map((plan) =>
                      plan.id === id ? { ...plan, title } : plan,
                    ),
                  }
                : project,
            ),
          },
    );
  }, []);

  useImperativeHandle(
    handle,
    () => ({
      reread: () => reread.current(),
      renamePlan,
      newProject: () => {
        setCollapsed(false);
        setNaming({ kind: 'project' });
      },
    }),
    [renamePlan, setCollapsed],
  );

  const summary = all.find((workspace) => workspace.id === nav?.workspace.id) ?? wanted;
  const role = nav?.workspace.role ?? summary?.role ?? 'VIEWER';
  const mayEdit = role !== 'VIEWER';
  const mayAdminister = canAdminister(role);
  const here = nav === null ? null : currentProject(nav, planId, lastProject);

  /** Runs the act, then rereads: the tree is the only view of what just changed. */
  const act = useCallback(async (work: () => Promise<unknown>): Promise<void> => {
    try {
      await work();
      setError(null);
      reread.current();
    } catch (cause) {
      setError(cause);
    }
  }, []);

  /** Starts naming something new, with the place it goes open so the field is seen. */
  const startNaming = useCallback(
    (request: Naming) => {
      if (request.kind === 'plan')
        expand([request.projectId, request.folderId ?? request.projectId]);
      if (request.kind === 'folder')
        expand([request.projectId, request.parentId ?? request.projectId]);
      if (request.kind === 'plan' || request.kind === 'folder') setLastProject(request.projectId);
      setNaming(request);
    },
    [expand, setLastProject],
  );

  const commitName = (value: string): void => {
    const request = naming;
    setNaming(null);
    const name = value.trim();
    if (request === null || name === '') return;
    if (request.kind === 'rename' && name === request.was) return;

    void act(async () => {
      switch (request.kind) {
        case 'plan': {
          const made = await plans.create(request.projectId, name, '', request.folderId);
          void navigate(`/plan/${made.id}`);
          layout.settle();
          return;
        }
        case 'folder': {
          const made = await folders.create(request.projectId, name, request.parentId);
          expand([made.id]);
          scrollToRow(made.id);
          return;
        }
        case 'project': {
          const workspace = nav?.workspace.id ?? wanted?.id;
          if (workspace === undefined) return;
          const made = await projects.create(workspace, name);
          expand([made.id]);
          setLastProject(made.id);
          scrollToRow(made.id);
          return;
        }
        case 'rename': {
          if (request.target === 'plan') {
            renamePlan(request.id, name);
            await plans.update(request.id, { title: name });
          } else if (request.target === 'folder') {
            await folders.rename(request.id, name);
          } else {
            await projects.update(request.id, { name });
          }
        }
      }
    });
  };

  /** Whether the plan on screen sits in this project, or in or below this folder. */
  const holdsOpenPlan = (projectId: string, folderId: string | null): boolean => {
    if (nav === null || planId === undefined) return false;
    const project = nav.projects.find((each) => each.id === projectId);
    const plan = project?.plans.find((each) => each.id === planId);
    if (project === undefined || plan === undefined) return false;
    if (folderId === null) return true;
    return plan.folderId !== null && isWithin(project, plan.folderId, folderId);
  };

  const actions: TreeActions = {
    openPlan: (id, projectId) => {
      setLastProject(projectId);
      if (id !== planId || location.pathname !== `/plan/${id}`) void navigate(`/plan/${id}`);
      layout.settle();
    },
    touchProject: setLastProject,
    projectSettings: (slug) => {
      if (summary === undefined) return;
      void navigate(`/workspace/${nav?.workspace.slug ?? summary.slug}/project/${slug}/settings`);
      layout.settle();
    },
    planSettings: (id) => {
      void navigate(`/plan/${id}/settings`);
      layout.settle();
    },
    // Throwing away what is on screen takes you off it as well, or the content
    // carries on showing something the rest of the product has stopped listing.
    trashPlan: (id) =>
      void act(async () => {
        await plans.remove(id);
        if (id === planId) void navigate('/recent');
      }),
    trashFolder: (id, projectId) =>
      void act(async () => {
        const leaving = holdsOpenPlan(projectId, id);
        await folders.remove(id);
        if (leaving) void navigate('/recent');
      }),
    trashProject: (id) =>
      void act(async () => {
        const leaving = holdsOpenPlan(id, null);
        await projects.remove(id);
        if (leaving) void navigate('/recent');
      }),
    share: (id) =>
      void act(async () => {
        const { token } = await plans.share(id);
        await navigator.clipboard.writeText(`${window.location.origin}/share/${token}`);
        setNotice(t.explorer.shareCopied);
      }),
    exportPlan: (plan: NavPlan) =>
      void act(() =>
        downloadExport(plan.id, `${plan.title.toLowerCase().replace(/[^a-z0-9]+/g, '-')}.zip`),
      ),
    moveTo: (moving: Dragged, target: DropTarget) =>
      void act(async () => {
        if (moving.kind === 'plan') {
          await plans.move(moving.id, target.projectId, target.folderId);
        } else {
          await folders.move(moving.id, target.folderId);
        }
        expand([target.projectId, ...(target.folderId === null ? [] : [target.folderId])]);
        setLastProject(target.projectId);
      }),
  };

  if (layout.collapsed) {
    return (
      <aside
        aria-label={t.explorer.label}
        className="flex w-9 shrink-0 flex-col items-center gap-1 border-r border-rule bg-surface py-2"
      >
        <IconButton
          label={t.explorer.expand}
          icon={PanelLeftOpen}
          side="right"
          onClick={() => setCollapsed(false)}
        />
        <Tooltip content={t.explorer.recent} side="right">
          <NavLink
            to="/recent"
            aria-label={t.explorer.recent}
            className="grid size-7 place-items-center rounded-md text-ink-muted hover:bg-surface-2 hover:text-ink [&.active]:bg-surface-4 [&.active]:text-ink"
          >
            <Clock className="size-4" />
          </NavLink>
        </Tooltip>
      </aside>
    );
  }

  return (
    <>
      {/* Narrow, the explorer floats over the content rather than taking most
          of it, and the scrim is the other way out. The strip it folds into
          keeps its place, so the content does not shift under it. */}
      <div aria-hidden className="w-9 shrink-0 border-r border-rule bg-surface md:hidden" />
      <button
        type="button"
        aria-label={t.explorer.collapse}
        onClick={() => setCollapsed(true)}
        className="absolute inset-0 z-30 bg-black/50 md:hidden"
      />
      <aside
        aria-label={t.explorer.label}
        style={{ width: layout.width }}
        className="relative flex shrink-0 flex-col border-r border-rule bg-surface max-md:absolute max-md:inset-y-0 max-md:left-0 max-md:z-40 max-md:max-w-[85vw]"
      >
        <div className="flex h-11 shrink-0 items-center gap-1 border-b border-rule px-2">
          {summary === undefined ? (
            <span className="flex-1" />
          ) : (
            <WorkspaceSwitcher current={summary} onSwitched={layout.settle} />
          )}
          <IconButton
            label={t.explorer.collapse}
            icon={PanelLeftClose}
            onClick={() => setCollapsed(true)}
          />
        </div>

        <div className="shrink-0 px-2 pt-2">
          <PinnedLink to="/recent" icon={Clock} onFollow={layout.settle}>
            {t.explorer.recent}
          </PinnedLink>
        </div>

        {error !== null ? (
          <div className="shrink-0 px-2 pt-2">
            <Problem error={error} />
          </div>
        ) : null}

        {/* The empty space below the tree is a target of its own: a right-click
            with nothing under it means "here", and here is the current project. */}
        <ContextMenu
          menu={
            <>
              {here === null || !mayEdit ? null : (
                <>
                  <ContextAction
                    onSelect={() =>
                      startNaming({ kind: 'plan', projectId: here.id, folderId: null })
                    }
                  >
                    <FilePlus className="size-3.5 text-ink-faint" />
                    {t.explorer.newPlanIn(here.name)}
                  </ContextAction>
                  <ContextAction
                    onSelect={() =>
                      startNaming({ kind: 'folder', projectId: here.id, parentId: null })
                    }
                  >
                    <FolderPlus className="size-3.5 text-ink-faint" />
                    {t.explorer.newFolderIn(here.name)}
                  </ContextAction>
                </>
              )}
              <ContextAction
                disabled={!mayEdit || nav === null}
                onSelect={() => startNaming({ kind: 'project' })}
              >
                <SquarePlus className="size-3.5 text-ink-faint" />
                {t.explorer.newProject}
              </ContextAction>
            </>
          }
        >
          <div
            className="min-h-0 flex-1 overflow-y-auto px-2 py-2"
            onDragEnd={() => {
              setDragging(null);
              setOver(null);
            }}
          >
            {nav === null ? (
              failed ? (
                <p className="px-2 py-1 text-xs text-ink-faint">{t.explorer.unavailable}</p>
              ) : source === null ? null : (
                <div className="grid place-items-center py-6">
                  <Spinner />
                </div>
              )
            ) : (
              <ExplorerTree
                nav={nav}
                openPlanId={planId}
                open={open}
                onToggle={(id) =>
                  setOpen((current) => {
                    const next = new Set(current);
                    if (!next.delete(id)) next.add(id);
                    return next;
                  })
                }
                naming={naming}
                onStartNaming={startNaming}
                onCommitName={commitName}
                onCancelName={() => setNaming(null)}
                dragging={dragging}
                onDragging={setDragging}
                over={over}
                onOver={setOver}
                mayEdit={mayEdit}
                mayAdminister={mayAdminister}
                actions={actions}
              />
            )}
          </div>
        </ContextMenu>

        {notice === null ? null : (
          <p role="status" className="shrink-0 px-4 pb-1 text-xs text-ink-muted">
            {notice}
          </p>
        )}

        {/* Always there, whatever is scrolled: the three things a tree is for
            making. Icons only; each says what it makes, and where, on hover. */}
        {!mayEdit || nav === null ? null : (
          <div className="flex shrink-0 items-center gap-0.5 border-t border-rule px-2 py-1">
            <IconButton
              label={here === null ? t.explorer.newPlan : t.explorer.newPlanIn(here.name)}
              icon={FilePlus}
              disabled={here === null}
              onClick={() =>
                here !== null && startNaming({ kind: 'plan', projectId: here.id, folderId: null })
              }
            />
            <IconButton
              label={here === null ? t.explorer.newFolder : t.explorer.newFolderIn(here.name)}
              icon={FolderPlus}
              disabled={here === null}
              onClick={() =>
                here !== null && startNaming({ kind: 'folder', projectId: here.id, parentId: null })
              }
            />
            <IconButton
              label={t.explorer.newProject}
              icon={SquarePlus}
              onClick={() => startNaming({ kind: 'project' })}
            />
          </div>
        )}

        {summary === undefined ? null : (
          <nav className="shrink-0 border-t border-rule p-2">
            <PinnedLink
              to={`/workspace/${summary.slug}/members`}
              icon={Users}
              onFollow={layout.settle}
            >
              {t.explorer.members}
              <span className="slug ml-auto text-ink-faint">{summary.memberCount}</span>
            </PinnedLink>
            <PinnedLink
              to={`/workspace/${summary.slug}/settings`}
              icon={Settings}
              onFollow={layout.settle}
            >
              {t.explorer.workspaceSettings}
            </PinnedLink>
            {mayAdminister ? (
              <PinnedLink
                to={`/workspace/${summary.slug}/trash`}
                icon={Trash2}
                onFollow={layout.settle}
              >
                {t.explorer.trash}
              </PinnedLink>
            ) : null}
          </nav>
        )}

        <AccountRow onFollow={layout.settle} />

        <ResizeGrip
          width={layout.width}
          onPreview={layout.preview}
          onCommit={layout.setWidth}
          onReset={layout.resetWidth}
        />
      </aside>
    </>
  );
}

function PinnedLink({
  to,
  icon: Icon,
  onFollow,
  children,
}: {
  to: string;
  icon: ComponentType<{ className?: string }>;
  onFollow: () => void;
  children: ReactNode;
}) {
  return (
    <NavLink
      to={to}
      onClick={onFollow}
      className={cn(
        'flex h-8 items-center gap-2 rounded-md px-2 text-sm transition-colors',
        'text-ink-muted hover:bg-surface-2 hover:text-ink',
        '[&.active]:bg-surface-4 [&.active]:text-ink',
      )}
    >
      <Icon className="size-4 shrink-0" />
      <span className="flex min-w-0 flex-1 items-center truncate">{children}</span>
    </NavLink>
  );
}
