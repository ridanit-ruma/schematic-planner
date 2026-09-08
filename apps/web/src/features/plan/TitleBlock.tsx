import type { Presence } from '@schematic/ydoc';
import { Clock, Download, Link2, MoreHorizontal, Plus, Settings, Wand2 } from 'lucide-react';
import { Link } from 'react-router';

import { Button } from '@/components/ui/button';
import { DropdownAction, DropdownMenu } from '@/components/ui/dropdown-menu';
import { Tooltip } from '@/components/ui/tooltip';
import { cn, plural } from '@/lib/utils';
import type { ConnectionStatus } from './use-plan-document';

/**
 * The title block of an engineering drawing: what the sheet is, what state it is
 * in, and who is working on it. It reads left to right and does not move.
 *
 * Only what is done to the drawing over and over stays on the row — adding and
 * arranging. Everything about the plan rather than the drawing is one menu, at
 * every width: a row that rearranges itself three times between a phone and a
 * desk is three rows to learn.
 */
export function TitleBlock({
  title,
  nodeCount,
  peers,
  status,
  readOnly,
  onAddNode,
  onArrange,
  onExport,
  onShare,
  historyOpen,
  onHistory,
  settingsHref,
}: {
  title: string;
  nodeCount: number;
  peers: Presence[];
  status: ConnectionStatus;
  readOnly: boolean;
  onAddNode: () => void;
  onArrange: () => void;
  onExport: () => void;
  onShare: () => void;
  historyOpen: boolean;
  onHistory: () => void;
  /** Where the plan's own settings live. The title is the way in. */
  settingsHref?: string;
}) {
  return (
    <header className="flex h-11 shrink-0 items-center gap-2 border-b border-rule bg-surface px-2 sm:gap-3 sm:px-3">
      <ConnectionLight status={status} />

      {/* The name is the control for the thing it names, the way the workspace
          name in the trail is. */}
      {settingsHref === undefined ? (
        <h1 className="min-w-0 flex-1 truncate text-sm font-medium text-ink">{title}</h1>
      ) : (
        <h1 className="min-w-0 flex-1 truncate">
          <Tooltip content="Plan settings">
            <Link
              to={settingsHref}
              className="rounded-md px-1.5 py-1 text-sm font-medium text-ink transition-colors hover:bg-surface-2"
            >
              {title}
            </Link>
          </Tooltip>
        </h1>
      )}

      <PlanSize count={nodeCount} />

      {peers.length > 0 ? (
        <div
          className="hidden items-center -space-x-1 sm:flex"
          aria-label={`${peers.length} other people here`}
        >
          {peers.slice(0, 4).map((peer) => (
            <Tooltip key={peer.userId} content={peer.name}>
              <span
                className="grid size-5 place-items-center rounded-sm border border-surface text-2xs font-medium text-white"
                style={{ background: peer.color }}
              >
                {peer.name.slice(0, 1).toUpperCase()}
              </span>
            </Tooltip>
          ))}
          {peers.length > 4 ? (
            <span className="pl-2.5 text-xs text-ink-muted">+{peers.length - 4}</span>
          ) : null}
        </div>
      ) : null}

      {readOnly ? null : (
        <div className="flex items-center gap-1">
          <Tooltip content="Add node">
            <Button size="sm" variant="ghost" onClick={onAddNode}>
              <Plus className="size-3.5" />
              <span className="hidden lg:inline">Add node</span>
            </Button>
          </Tooltip>
          <Tooltip content="Lay out everything nobody has placed by hand">
            <Button size="sm" variant="ghost" onClick={onArrange}>
              <Wand2 className="size-3.5" />
              <span className="hidden lg:inline">Arrange</span>
            </Button>
          </Tooltip>
        </div>
      )}

      <DropdownMenu
        align="end"
        trigger={
          <button
            type="button"
            aria-label="Plan actions"
            className="grid size-7 place-items-center rounded-md text-ink-muted transition-colors hover:bg-surface-2 hover:text-ink focus:outline-none"
          >
            <MoreHorizontal className="size-4" />
          </button>
        }
      >
        {readOnly ? null : (
          <DropdownAction onSelect={onShare}>
            <Link2 className="size-3.5 text-ink-faint" />
            Share
          </DropdownAction>
        )}
        <DropdownAction onSelect={onHistory}>
          <Clock className="size-3.5 text-ink-faint" />
          {historyOpen ? 'Hide history' : 'History'}
        </DropdownAction>
        <DropdownAction onSelect={onExport}>
          <Download className="size-3.5 text-ink-faint" />
          Export
        </DropdownAction>
        {settingsHref === undefined ? null : (
          <DropdownAction onSelect={() => window.location.assign(settingsHref)}>
            <Settings className="size-3.5 text-ink-faint" />
            Plan settings
          </DropdownAction>
        )}
      </DropdownMenu>
    </header>
  );
}

/**
 * How big the drawing is — one number, no breakdown. What each node is up to is
 * written on the node itself; a tally of six colours up here only competes with
 * the canvas that already says it.
 */
export function PlanSize({ count }: { count: number }) {
  if (count === 0) return null;
  return <span className="hidden shrink-0 text-xs text-ink-muted sm:inline">{plural(count, 'node')}</span>;
}

/**
 * Freshness is an indicator, not a sentence. A label that rewrote itself every
 * second would blink at the edge of vision and read as a fault.
 */
function ConnectionLight({ status }: { status: ConnectionStatus }) {
  const label = {
    connected: 'Connected',
    connecting: 'Connecting',
    disconnected: 'Not connected — changes are local until this reconnects',
  }[status];

  return (
    <Tooltip content={label}>
      <span className="flex items-center">
        <span
          className={cn(
            'size-2 rounded-full',
            status === 'connected' && 'bg-status-done',
            status === 'connecting' && 'bg-status-progress',
            status === 'disconnected' && 'bg-status-blocked',
          )}
        />
        <span className="sr-only">{label}</span>
      </span>
    </Tooltip>
  );
}
