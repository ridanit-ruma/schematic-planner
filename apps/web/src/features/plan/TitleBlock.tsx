import { planEdgeKinds, type PlanEdgeKind, type PlanNodeStatus } from '@schematic/schema';
import type { Presence } from '@schematic/ydoc';
import { Download, Link2, Plus, Wand2 } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { StatusTally } from '@/components/ui/status';
import { ThemeToggle } from '@/components/ui/theme';
import { cn } from '@/lib/utils';
import type { ConnectionStatus } from './use-plan-document';

/**
 * The title block of an engineering drawing: what the sheet is, what state it is
 * in, and who is working on it. It reads left to right and does not move.
 */
export function TitleBlock({
  title,
  counts,
  peers,
  status,
  readOnly,
  connectKind,
  onConnectKindChange,
  onAddNode,
  onArrange,
  onExport,
  onShare,
}: {
  title: string;
  counts: Partial<Record<PlanNodeStatus, number>>;
  peers: Presence[];
  status: ConnectionStatus;
  readOnly: boolean;
  connectKind: PlanEdgeKind;
  onConnectKindChange: (kind: PlanEdgeKind) => void;
  onAddNode: () => void;
  onArrange: () => void;
  onExport: () => void;
  onShare: () => void;
}) {
  return (
    <header className="flex h-11 shrink-0 items-center gap-4 border-b border-rule bg-surface px-3">
      <ConnectionLight status={status} />

      <h1 className="min-w-0 flex-1 truncate text-sm font-medium text-ink">{title}</h1>

      <StatusTally counts={counts} />

      {peers.length > 0 ? (
        <div className="flex items-center -space-x-1.5" aria-label={`${peers.length} other people here`}>
          {peers.slice(0, 4).map((peer) => (
            <span
              key={peer.userId}
              title={peer.name}
              className="grid size-5 place-items-center rounded-full border border-surface text-2xs font-medium text-white"
              style={{ background: peer.color }}
            >
              {peer.name.slice(0, 1).toUpperCase()}
            </span>
          ))}
          {peers.length > 4 ? (
            <span className="pl-2.5 text-xs text-ink-muted">+{peers.length - 4}</span>
          ) : null}
        </div>
      ) : null}

      <div className="flex items-center gap-1">
        {!readOnly && (
          <>
            <Button size="sm" variant="ghost" onClick={onAddNode}>
              <Plus className="size-3.5" />
              Add node
            </Button>
            <ConnectKindControl value={connectKind} onChange={onConnectKindChange} />
            <Button size="sm" variant="ghost" onClick={onArrange} title="Arrange unpinned nodes">
              <Wand2 className="size-3.5" />
              Arrange
            </Button>
            <Button size="sm" variant="ghost" onClick={onShare}>
              <Link2 className="size-3.5" />
              Share
            </Button>
          </>
        )}
        <Button size="sm" variant="quiet" onClick={onExport}>
          <Download className="size-3.5" />
          Export
        </Button>
        <ThemeToggle />
      </div>
    </header>
  );
}

const CONNECT_LABEL: Record<PlanEdgeKind, string> = {
  depends_on: 'Depends on',
  contains: 'Contains',
  relates_to: 'Relates to',
};

const CONNECT_HINT: Record<PlanEdgeKind, string> = {
  depends_on: 'Drag right to left: this needs that. Becomes file order on export.',
  contains: 'Drag parent to child: nesting. Becomes a directory on export.',
  relates_to: 'A plain association, carrying no structure.',
};

/**
 * What the next line drawn will mean. The button shows the line itself rather
 * than an icon standing in for it, because the line style is already the
 * vocabulary everywhere else on the canvas.
 */
function ConnectKindControl({
  value,
  onChange,
}: {
  value: PlanEdgeKind;
  onChange: (kind: PlanEdgeKind) => void;
}) {
  return (
    <div className="flex items-center rounded-[2px] border border-rule" role="group" aria-label="What a new connection means">
      {planEdgeKinds.map((kind) => (
        <button
          key={kind}
          type="button"
          title={`${CONNECT_LABEL[kind]} — ${CONNECT_HINT[kind]}`}
          aria-pressed={value === kind}
          onClick={() => onChange(kind)}
          className={cn(
            'flex h-7 w-9 items-center justify-center border-r border-rule last:border-r-0',
            value === kind ? 'bg-accent-soft' : 'hover:bg-surface-2',
          )}
        >
          <svg viewBox="0 0 28 8" className="h-2 w-6" aria-hidden>
            <path
              d={kind === 'depends_on' ? 'M1 4 H22' : 'M1 4 H26'}
              stroke={value === kind ? 'var(--accent)' : 'var(--ink-muted)'}
              strokeWidth="1.4"
              fill="none"
              strokeDasharray={kind === 'contains' ? '5 3' : kind === 'relates_to' ? '1 3' : undefined}
            />
            {kind === 'depends_on' ? (
              <path d="M22 1.5 L27 4 L22 6.5 z" fill={value === kind ? 'var(--accent)' : 'var(--ink-muted)'} />
            ) : null}
          </svg>
          <span className="sr-only">{CONNECT_LABEL[kind]}</span>
        </button>
      ))}
    </div>
  );
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
    <span className="flex items-center" title={label}>
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
  );
}
