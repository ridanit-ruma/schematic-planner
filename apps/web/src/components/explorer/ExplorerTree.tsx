import {
  ChevronDown,
  ChevronRight,
  Download,
  FilePlus,
  FileText,
  FolderClosed,
  FolderInput,
  FolderOpen,
  FolderPlus,
  Link2,
  MoreHorizontal,
  Pencil,
  Settings,
  Trash2,
} from 'lucide-react';
import {
  createContext,
  useContext,
  useEffect,
  useRef,
  useState,
  type KeyboardEvent,
  type MouseEvent,
  type ReactNode,
} from 'react';

import {
  ContextAction,
  ContextMenu,
  ContextSeparator,
  ContextSub,
} from '@/components/ui/context-menu';
import { useT } from '@/i18n';
import { cn } from '@/lib/utils';
import { IconButton } from './IconButton';
import {
  canDrop,
  childFolders,
  childPlans,
  moveTargets,
  type Dragged,
  type DropTarget,
  type Nav,
  type NavFolder,
  type NavPlan,
  type NavProject,
} from './tree';

/** A name being typed into the tree: for something new, or for a rename. */
export type Naming =
  | { kind: 'plan'; projectId: string; folderId: string | null }
  | { kind: 'folder'; projectId: string; parentId: string | null }
  | { kind: 'project' }
  | { kind: 'rename'; target: 'plan' | 'folder' | 'project'; id: string; was: string };

/** What the rows can do, carried out by the explorer that owns the tree. */
export interface TreeActions {
  openPlan: (id: string, projectId: string) => void;
  /** Remembers a project as the last one used, for the buttons at the foot. */
  touchProject: (id: string) => void;
  projectSettings: (slug: string) => void;
  planSettings: (id: string) => void;
  trashPlan: (id: string) => void;
  trashFolder: (id: string, projectId: string) => void;
  trashProject: (id: string) => void;
  share: (id: string) => void;
  exportPlan: (plan: NavPlan) => void;
  moveTo: (moving: Dragged, target: DropTarget) => void;
}

interface TreeProps {
  nav: Nav;
  openPlanId: string | undefined;
  open: ReadonlySet<string>;
  onToggle: (id: string) => void;
  naming: Naming | null;
  onStartNaming: (naming: Naming) => void;
  onCommitName: (value: string) => void;
  onCancelName: () => void;
  dragging: Dragged | null;
  onDragging: (dragged: Dragged | null) => void;
  over: string | null;
  onOver: (key: string | null) => void;
  mayEdit: boolean;
  mayAdminister: boolean;
  actions: TreeActions;
}

const Tree = createContext<TreeProps | null>(null);

function useTree(): TreeProps {
  const value = useContext(Tree);
  if (value === null) throw new Error('A tree row outside the tree');
  return value;
}

/** Left padding for a row this deep: the icons line up down each level. */
const indent = (depth: number): number => 6 + depth * 14;

/**
 * Projects, the folders in them however deep, and the plans in those. A row is
 * opened by a click, acted on from its menu — the right button, or the button
 * that appears on it — and moved by dragging it onto a project or a folder.
 */
export function ExplorerTree(props: TreeProps) {
  const t = useT();
  const { nav, naming } = props;

  return (
    <Tree.Provider value={props}>
      <div className="space-y-px">
        {nav.projects.length === 0 && naming?.kind !== 'project' ? (
          <p className="px-2 py-1 text-xs text-ink-faint">{t.explorer.noProjects}</p>
        ) : null}
        {nav.projects.map((project) => (
          <ProjectNode key={project.id} project={project} />
        ))}
        {naming?.kind === 'project' ? (
          <NameField
            depth={0}
            icon={<ChevronRight className="size-3.5 shrink-0 text-ink-faint" />}
            initial=""
            placeholder={t.explorer.nameProject}
          />
        ) : null}
      </div>
    </Tree.Provider>
  );
}

function ProjectNode({ project }: { project: NavProject }) {
  const t = useT();
  const tree = useTree();
  const expanded = tree.open.has(project.id);
  const renaming = isRenaming(tree.naming, 'project', project.id);

  return (
    <div>
      <Row
        kind="project"
        id={project.id}
        depth={0}
        label={project.name}
        strong
        icon={
          expanded ? (
            <ChevronDown className="size-3.5 shrink-0" />
          ) : (
            <ChevronRight className="size-3.5 shrink-0" />
          )
        }
        expanded={expanded}
        renaming={renaming}
        onActivate={() => {
          tree.onToggle(project.id);
          tree.actions.touchProject(project.id);
        }}
        drop={{ projectId: project.id, folderId: null }}
        create={{ projectId: project.id, folderId: null }}
        menu={
          <>
            <CreateItems projectId={project.id} folderId={null} />
            {tree.mayEdit ? (
              <ContextAction
                onSelect={() =>
                  tree.onStartNaming({
                    kind: 'rename',
                    target: 'project',
                    id: project.id,
                    was: project.name,
                  })
                }
              >
                <Pencil className="size-3.5 text-ink-faint" />
                {t.common.rename}
              </ContextAction>
            ) : null}
            <ContextAction onSelect={() => tree.actions.projectSettings(project.slug)}>
              <Settings className="size-3.5 text-ink-faint" />
              {t.explorer.menu.settings}
            </ContextAction>
            {tree.mayAdminister ? (
              <>
                <ContextSeparator />
                <ContextAction tone="danger" onSelect={() => tree.actions.trashProject(project.id)}>
                  <Trash2 className="size-3.5" />
                  {t.explorer.menu.moveToTrash}
                </ContextAction>
              </>
            ) : null}
          </>
        }
      />
      {expanded ? (
        <Children project={project} parentId={null} depth={1} empty={t.explorer.emptyProject} />
      ) : null}
    </div>
  );
}

function FolderNode({
  project,
  folder,
  depth,
}: {
  project: NavProject;
  folder: NavFolder;
  depth: number;
}) {
  const t = useT();
  const tree = useTree();
  const expanded = tree.open.has(folder.id);
  const moving: Dragged = {
    kind: 'folder',
    id: folder.id,
    projectId: project.id,
    parentId: folder.parentId,
  };

  return (
    <div>
      <Row
        kind="folder"
        id={folder.id}
        depth={depth}
        label={folder.name}
        icon={
          expanded ? (
            <FolderOpen className="size-3.5 shrink-0 text-ink-faint" />
          ) : (
            <FolderClosed className="size-3.5 shrink-0 text-ink-faint" />
          )
        }
        expanded={expanded}
        renaming={isRenaming(tree.naming, 'folder', folder.id)}
        onActivate={() => {
          tree.onToggle(folder.id);
          tree.actions.touchProject(project.id);
        }}
        drag={tree.mayEdit ? moving : undefined}
        drop={{ projectId: project.id, folderId: folder.id }}
        create={{ projectId: project.id, folderId: folder.id }}
        menu={
          <>
            <CreateItems projectId={project.id} folderId={folder.id} />
            {tree.mayEdit ? (
              <>
                <ContextAction
                  onSelect={() =>
                    tree.onStartNaming({
                      kind: 'rename',
                      target: 'folder',
                      id: folder.id,
                      was: folder.name,
                    })
                  }
                >
                  <Pencil className="size-3.5 text-ink-faint" />
                  {t.common.rename}
                </ContextAction>
                <MoveItems moving={moving} />
              </>
            ) : null}
            {tree.mayAdminister ? (
              <>
                <ContextSeparator />
                <ContextAction
                  tone="danger"
                  onSelect={() => tree.actions.trashFolder(folder.id, project.id)}
                >
                  <Trash2 className="size-3.5" />
                  {t.explorer.menu.moveToTrash}
                </ContextAction>
              </>
            ) : null}
          </>
        }
      />
      {expanded ? (
        <Children
          project={project}
          parentId={folder.id}
          depth={depth + 1}
          empty={t.explorer.emptyFolder}
        />
      ) : null}
    </div>
  );
}

function PlanNode({ project, plan, depth }: { project: NavProject; plan: NavPlan; depth: number }) {
  const t = useT();
  const tree = useTree();
  const current = plan.id === tree.openPlanId;
  const label = plan.title === '' ? t.explorer.untitledPlan : plan.title;
  const moving: Dragged = {
    kind: 'plan',
    id: plan.id,
    projectId: project.id,
    folderId: plan.folderId,
  };

  return (
    <div>
      <Row
        kind="plan"
        id={plan.id}
        depth={depth}
        label={label}
        icon={
          <FileText
            className={cn('size-3.5 shrink-0', current ? 'text-accent' : 'text-ink-faint')}
          />
        }
        current={current}
        renaming={isRenaming(tree.naming, 'plan', plan.id)}
        onActivate={() => tree.actions.openPlan(plan.id, project.id)}
        // Moving a plan out of where it is needs an administrator, as the
        // server has it: it takes the plan away from whoever could reach it.
        drag={tree.mayAdminister ? moving : undefined}
        menu={
          <>
            <ContextAction onSelect={() => tree.actions.openPlan(plan.id, project.id)}>
              <FileText className="size-3.5 text-ink-faint" />
              {t.explorer.menu.open}
            </ContextAction>
            {tree.mayEdit ? (
              <ContextAction
                onSelect={() =>
                  tree.onStartNaming({
                    kind: 'rename',
                    target: 'plan',
                    id: plan.id,
                    was: plan.title,
                  })
                }
              >
                <Pencil className="size-3.5 text-ink-faint" />
                {t.common.rename}
              </ContextAction>
            ) : null}
            <ContextAction onSelect={() => tree.actions.planSettings(plan.id)}>
              <Settings className="size-3.5 text-ink-faint" />
              {t.explorer.menu.settings}
            </ContextAction>
            {tree.mayAdminister ? <MoveItems moving={moving} /> : null}
            <ContextSeparator />
            {tree.mayEdit ? (
              <ContextAction onSelect={() => tree.actions.share(plan.id)}>
                <Link2 className="size-3.5 text-ink-faint" />
                {t.explorer.menu.copyShareLink}
              </ContextAction>
            ) : null}
            <ContextAction onSelect={() => tree.actions.exportPlan(plan)}>
              <Download className="size-3.5 text-ink-faint" />
              {t.explorer.menu.export}
            </ContextAction>
            {tree.mayAdminister ? (
              <>
                <ContextSeparator />
                <ContextAction tone="danger" onSelect={() => tree.actions.trashPlan(plan.id)}>
                  <Trash2 className="size-3.5" />
                  {t.explorer.menu.moveToTrash}
                </ContextAction>
              </>
            ) : null}
          </>
        }
      />
    </div>
  );
}

/** What is inside a project or a folder: a field for a new name, folders, then plans. */
function Children({
  project,
  parentId,
  depth,
  empty,
}: {
  project: NavProject;
  parentId: string | null;
  depth: number;
  empty: string;
}) {
  const t = useT();
  const { naming } = useTree();
  const inner = childFolders(project, parentId);
  const held = childPlans(project, parentId);
  const newHere =
    naming !== null &&
    ((naming.kind === 'plan' && naming.projectId === project.id && naming.folderId === parentId) ||
      (naming.kind === 'folder' && naming.projectId === project.id && naming.parentId === parentId))
      ? naming.kind
      : null;

  return (
    <div>
      {newHere === null ? null : (
        <NameField
          depth={depth}
          icon={
            newHere === 'plan' ? (
              <FileText className="size-3.5 shrink-0 text-ink-faint" />
            ) : (
              <FolderClosed className="size-3.5 shrink-0 text-ink-faint" />
            )
          }
          initial=""
          placeholder={newHere === 'plan' ? t.explorer.namePlan : t.explorer.nameFolder}
        />
      )}
      {inner.map((folder) => (
        <FolderNode key={folder.id} project={project} folder={folder} depth={depth} />
      ))}
      {held.map((plan) => (
        <PlanNode key={plan.id} project={project} plan={plan} depth={depth} />
      ))}
      {newHere === null && inner.length === 0 && held.length === 0 ? (
        <p className="py-1 pr-2 text-xs text-ink-faint" style={{ paddingLeft: indent(depth) + 20 }}>
          {empty}
        </p>
      ) : null}
    </div>
  );
}

/** One line of the tree, with its menu, its hover buttons and its drag and drop. */
function Row({
  kind,
  id,
  depth,
  label,
  icon,
  strong,
  expanded,
  current,
  renaming,
  onActivate,
  drag,
  drop,
  create,
  menu,
}: {
  kind: 'plan' | 'folder' | 'project';
  id: string;
  depth: number;
  label: string;
  icon: ReactNode;
  strong?: boolean;
  expanded?: boolean;
  current?: boolean;
  renaming: Naming | null;
  onActivate: () => void;
  drag?: Dragged;
  drop?: DropTarget;
  /** Where the row's own new-plan and new-folder buttons make things. */
  create?: DropTarget;
  menu: ReactNode;
}) {
  const t = useT();
  const tree = useTree();
  const key = drop === undefined ? null : `${drop.projectId}:${drop.folderId ?? ''}`;
  const accepts =
    drop !== undefined && tree.dragging !== null && canDrop(tree.nav, tree.dragging, drop);
  const lifted = tree.dragging !== null && drag !== undefined && tree.dragging.id === drag.id;

  /** The row's button opens the same menu the right button does, under itself. */
  const openMenu = (event: MouseEvent<HTMLButtonElement>): void => {
    const box = event.currentTarget.getBoundingClientRect();
    event.currentTarget.closest('[data-tree-row]')?.dispatchEvent(
      new window.MouseEvent('contextmenu', {
        bubbles: true,
        cancelable: true,
        clientX: box.left,
        clientY: box.bottom,
      }),
    );
  };

  const onKeyDown = (event: KeyboardEvent<HTMLButtonElement>): void => {
    if (event.key !== 'F2' || !tree.mayEdit) return;
    event.preventDefault();
    tree.onStartNaming({ kind: 'rename', target: kind, id, was: label });
  };

  if (renaming !== null) {
    return (
      <NameField
        depth={depth}
        icon={icon}
        initial={renaming.kind === 'rename' ? renaming.was : label}
        placeholder={label}
      />
    );
  }

  return (
    <ContextMenu menu={menu} returnFocus={false}>
      <div
        data-tree-row={id}
        data-tree-kind={kind}
        // Its own menu, not also the one for the empty space around the tree.
        onContextMenu={(event) => event.stopPropagation()}
        onDragOver={(event) => {
          if (tree.dragging === null) return;
          if (!accepts) {
            if (tree.over !== null) tree.onOver(null);
            return;
          }
          event.preventDefault();
          event.dataTransfer.dropEffect = 'move';
          if (tree.over !== key) tree.onOver(key);
        }}
        onDrop={(event) => {
          const moving = tree.dragging;
          if (moving === null || !accepts || drop === undefined) return;
          event.preventDefault();
          tree.onDragging(null);
          tree.onOver(null);
          tree.actions.moveTo(moving, drop);
        }}
        className={cn(
          'group relative flex h-7 items-center rounded-md text-sm transition-colors',
          current ? 'bg-surface-4 text-ink' : 'text-ink-muted hover:bg-surface-2 hover:text-ink',
          accepts && tree.over === key && 'bg-accent/15 text-ink ring-1 ring-accent/50',
          lifted && 'opacity-40',
        )}
      >
        <button
          type="button"
          draggable={drag !== undefined}
          onDragStart={(event) => {
            if (drag === undefined) return;
            event.dataTransfer.effectAllowed = 'move';
            // Some browsers refuse to start a drag with nothing on it.
            event.dataTransfer.setData('text/plain', label);
            tree.onDragging(drag);
          }}
          onClick={onActivate}
          onKeyDown={onKeyDown}
          aria-expanded={expanded}
          aria-current={current === true ? 'page' : undefined}
          title={label}
          style={{ paddingLeft: indent(depth) }}
          className="flex h-full min-w-0 flex-1 items-center gap-1.5 rounded-md pr-1 text-left focus:outline-none focus-visible:ring-1 focus-visible:ring-accent"
        >
          {icon}
          <span className={cn('min-w-0 flex-1 truncate', (strong ?? false) && 'font-medium')}>
            {label}
          </span>
        </button>
        {/* On a pointer that can hover, the buttons appear with it; on a
            touch screen they are always there, since nothing hovers. */}
        <span className="flex shrink-0 items-center opacity-0 transition-opacity group-focus-within:opacity-100 group-hover:opacity-100 [@media(hover:none)]:opacity-100">
          {create !== undefined && tree.mayEdit ? (
            <>
              <IconButton
                label={t.explorer.newPlanIn(label)}
                icon={FilePlus}
                className="size-6"
                onClick={() =>
                  tree.onStartNaming({
                    kind: 'plan',
                    projectId: create.projectId,
                    folderId: create.folderId,
                  })
                }
              />
              <IconButton
                label={t.explorer.newFolderIn(label)}
                icon={FolderPlus}
                className="size-6"
                onClick={() =>
                  tree.onStartNaming({
                    kind: 'folder',
                    projectId: create.projectId,
                    parentId: create.folderId,
                  })
                }
              />
            </>
          ) : null}
          <IconButton
            label={t.ui.rowMenu.actionsFor(label)}
            icon={MoreHorizontal}
            className="size-6"
            onClick={openMenu}
          />
        </span>
      </div>
    </ContextMenu>
  );
}

/** New plan and new folder, in a project's or a folder's menu. */
function CreateItems({ projectId, folderId }: DropTarget) {
  const t = useT();
  const tree = useTree();
  if (!tree.mayEdit) return null;
  return (
    <>
      <ContextAction onSelect={() => tree.onStartNaming({ kind: 'plan', projectId, folderId })}>
        <FilePlus className="size-3.5 text-ink-faint" />
        {t.explorer.newPlan}
      </ContextAction>
      <ContextAction
        onSelect={() => tree.onStartNaming({ kind: 'folder', projectId, parentId: folderId })}
      >
        <FolderPlus className="size-3.5 text-ink-faint" />
        {t.explorer.newFolder}
      </ContextAction>
      <ContextSeparator />
    </>
  );
}

/** The same moves a drag can make, for a hand that would rather not drag. */
function MoveItems({ moving }: { moving: Dragged }) {
  const t = useT();
  const tree = useTree();
  const targets = moveTargets(tree.nav, moving);
  return (
    <ContextSub
      label={
        <>
          <FolderInput className="size-3.5 text-ink-faint" />
          {t.explorer.menu.moveTo}
        </>
      }
    >
      {targets.length === 0 ? (
        <ContextAction onSelect={() => undefined} disabled>
          {t.explorer.menu.nowhereToMove}
        </ContextAction>
      ) : (
        targets.map((target) => (
          <ContextAction
            key={`${target.projectId}:${target.folderId ?? ''}`}
            onSelect={() => tree.actions.moveTo(moving, target)}
          >
            {target.folderId === null ? (
              <ChevronRight className="size-3.5 text-ink-faint" />
            ) : (
              <FolderClosed className="size-3.5 text-ink-faint" />
            )}
            <span className="max-w-72 truncate">{target.path.join(' / ')}</span>
          </ContextAction>
        ))
      )}
    </ContextSub>
  );
}

/**
 * A name typed where the thing will be. Enter or leaving the field keeps it,
 * Escape or an empty name drops it.
 *
 * Keys typed here stay here: the canvas beside the tree listens on the window
 * for Delete, undo and copying, and a name is not a node.
 */
function NameField({
  depth,
  icon,
  initial,
  placeholder,
}: {
  depth: number;
  icon: ReactNode;
  initial: string;
  placeholder: string;
}) {
  const tree = useTree();
  const [value, setValue] = useState(initial);
  const field = useRef<HTMLInputElement>(null);
  const done = useRef(false);

  useEffect(() => {
    const input = field.current;
    if (input === null) return;
    input.focus();
    input.select();
    input.scrollIntoView({ block: 'nearest' });
  }, []);

  const finish = (keep: boolean): void => {
    if (done.current) return;
    done.current = true;
    if (keep) tree.onCommitName(value);
    else tree.onCancelName();
  };

  return (
    <div
      className="flex h-7 items-center gap-1.5 rounded-md bg-surface-2 pr-1 ring-1 ring-accent/60"
      style={{ paddingLeft: indent(depth) }}
    >
      {icon}
      <input
        ref={field}
        value={value}
        aria-label={placeholder}
        placeholder={placeholder}
        onChange={(event) => setValue(event.target.value)}
        onKeyDown={(event) => {
          event.stopPropagation();
          if (event.key === 'Enter') {
            event.preventDefault();
            finish(true);
          } else if (event.key === 'Escape') {
            event.preventDefault();
            finish(false);
          }
        }}
        onBlur={() => finish(value.trim() !== '')}
        className="min-w-0 flex-1 bg-transparent text-sm text-ink outline-none placeholder:text-ink-faint"
      />
    </div>
  );
}

function isRenaming(
  naming: Naming | null,
  target: 'plan' | 'folder' | 'project',
  id: string,
): Naming | null {
  return naming?.kind === 'rename' && naming.target === target && naming.id === id ? naming : null;
}
