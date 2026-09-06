import { planEdgeKinds, type PlanEdgeKind, type PlanNodeStatus } from '@schematic/schema';
import type { Presence } from '@schematic/ydoc';
import { Clock, Download, Link2, Plus, Wand2 } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { StatusTally } from '@/components/ui/status';
import { ToggleGroup, ToggleItem } from '@/components/ui/toggle-group';
import { Tooltip } from '@/components/ui/tooltip';
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
  historyOpen,
  onHistory,
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
  historyOpen: boolean;
  onHistory: () => void;
}) {
  return (
    <header className="flex h-11 shrink-0 items-center gap-4 border-b border-rule bg-surface px-3">
      <ConnectionLight status={status} />

      <h1 className="min-w-0 flex-1 truncate text-sm font-medium text-ink">{title}</h1>

      <StatusTally counts={counts} />

      {peers.length > 0 ? (
        <div
          className="flex items-center -space-x-1"
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

      <div className="flex items-center gap-1">
        {!readOnly && (
          <>
            <Button size="sm" variant="ghost" onClick={onAddNode}>
              <Plus className="size-3.5" />
              Add node
            </Button>
            <ConnectKindControl value={connectKind} onChange={onConnectKindChange} />
            <Tooltip content="Lay out everything nobody has placed by hand">
              <Button size="sm" variant="ghost" onClick={onArrange}>
                <Wand2 className="size-3.5" />
                Arrange
              </Button>
            </Tooltip>
            <Button size="sm" variant="ghost" onClick={onShare}>
              <Link2 className="size-3.5" />
              Share
            </Button>
          </>
        )}
        <Tooltip content="Who changed what">
          <Button size="sm" variant="ghost" onClick={onHistory} aria-pressed={historyOpen}>
            <Clock className="size-3.5" />
            History
          </Button>
        </Tooltip>
        <Button size="sm" variant="quiet" onClick={onExport}>
          <Download className="size-3.5" />
          Export
        </Button>
      </div>
    </header>
  );
}

const CONNECT_LABEL: Record<PlanEdgeKind, string> = {
  flows_to: 'Flows to',
  depends_on: 'Depends on',
  contains: 'Contains',
  relates_to: 'Relates to',
};

const CONNECT_HINT: Record<PlanEdgeKind, string> = {
  flows_to: 'Drag the way it moves: this calls, sends or navigates to that.',
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
    <ToggleGroup value={value} onChange={onChange} label="What a new connection means">
      {planEdgeKinds.map((kind) => (
        <Tooltip
          key={kind}
          content={
            <>
              <span className="font-medium">{CONNECT_LABEL[kind]}</span>
              <span className="mt-0.5 block text-ink-muted">{CONNECT_HINT[kind]}</span>
            </>
          }
        >
          <ToggleItem value={kind} label={CONNECT_LABEL[kind]} selected={value === kind}>
            <svg viewBox="0 0 28 8" className="h-2 w-6" aria-hidden>
              <path
                d={kind === 'depends_on' || kind === 'flows_to' ? 'M1 4 H22' : 'M1 4 H26'}
                stroke={value === kind ? 'var(--accent)' : 'var(--ink-muted)'}
                strokeWidth="1.4"
                fill="none"
                strokeDasharray={
                  kind === 'contains' || kind === 'depends_on'
                    ? '5 3'
                    : kind === 'relates_to'
                      ? '1 3'
                      : undefined
                }
              />
              {kind === 'depends_on' || kind === 'flows_to' ? (
                <path
                  d="M22 1.5 L27 4 L22 6.5 z"
                  fill={value === kind ? 'var(--accent)' : 'var(--ink-muted)'}
                />
              ) : null}
            </svg>
          </ToggleItem>
        </Tooltip>
      ))}
    </ToggleGroup>
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
