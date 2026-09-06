import { Handle, Position as HandlePosition, type NodeProps } from '@xyflow/react';
import { memo } from 'react';

import { STATUS_COLOR } from '@/components/ui/status';
import { cn } from '@/lib/utils';
import type { PlanFlowNode } from './types';

/**
 * Kind is carried by the border treatment rather than a badge, the way a
 * schematic distinguishes component classes by their outline. Nothing here is
 * decorative: the rail is status, the border is kind, the dashes are certainty.
 */
const KIND_BORDER: Record<string, string> = {
  feature: 'border border-rule-strong',
  task: 'border border-rule',
  decision: 'border border-rule-strong [clip-path:polygon(0_0,calc(100%-10px)_0,100%_10px,100%_100%,0_100%)]',
  note: 'border border-dashed border-rule',
  group: 'border border-rule-strong bg-surface-3/70',
};

/*
 * A card does not read the zoom and does not change with it. It is drawn once,
 * at one size, and the canvas scales the whole drawing — so a node looks the
 * same at every distance, only nearer or further away. Two earlier attempts
 * made the card react to the zoom, first dropping text below a threshold and
 * then regrowing it; both traded a drawing you can predict for a moving one.
 */
function Card({ data, selected }: NodeProps<PlanFlowNode>) {
  const { node, childCount } = data;

  // A node that holds others is drawn as the boundary around them, labelled at
  // the top edge where nothing else sits. Drawn as a card it would land on top
  // of its own first child.
  if (childCount > 0) {
    return (
      /* Takes events across its whole area, so a group can be picked up
         anywhere on it. What it holds is drawn above it and is hit first, so
         this does not swallow clicks meant for the nodes inside. */
      <div
        className={cn(
          'h-full w-full rounded-lg border border-rule-strong bg-surface/60',
          selected === true && 'border-accent',
        )}
      >
        <div className="flex items-center gap-2 px-3 py-2">
          <span
            aria-hidden
            className="h-3.5 w-1 shrink-0"
            style={{ background: STATUS_COLOR[node.status] }}
          />
          <span className="truncate text-xs font-medium text-ink">{node.title}</span>
          <span className="slug truncate text-ink-faint">{node.slug}</span>
          <span className="ml-auto shrink-0 text-2xs text-ink-faint">{childCount}</span>
        </div>
        <Handle
          type="target"
          position={HandlePosition.Left}
          className="!size-2 !rounded-none !border !border-rule-strong !bg-surface-2"
        />
        <Handle
          type="source"
          position={HandlePosition.Right}
          className="!size-2 !rounded-none !border !border-rule-strong !bg-surface-2"
        />
      </div>
    );
  }

  const excerpt = node.body.trim().split('\n')[0] ?? '';

  return (
    <div
      className={cn(
        'relative flex min-h-[72px] w-[260px] overflow-hidden rounded-md bg-surface-2',
        KIND_BORDER[node.kind] ?? KIND_BORDER['task'],
        selected === true && 'border-accent ring-1 ring-accent',
      )}
    >
      <span aria-hidden className="w-1 shrink-0" style={{ background: STATUS_COLOR[node.status] }} />

      <div className="min-w-0 flex-1 px-3 py-2">
        <p className="truncate text-sm leading-snug font-medium text-ink">{node.title}</p>
        <p className="slug mt-0.5 truncate text-ink-faint">{node.slug}</p>
        {excerpt !== '' ? (
          <p className="mt-1.5 line-clamp-2 text-xs leading-snug text-ink-muted">{excerpt}</p>
        ) : null}
        {node.tags.length > 0 ? (
          <p className="mt-1.5 truncate text-2xs text-ink-faint">{node.tags.join('  ')}</p>
        ) : null}
      </div>

      {/* Square terminals rather than dots: this is a drawing, not a flowchart. */}
      <Handle
        type="target"
        position={HandlePosition.Left}
        className="!size-2 !rounded-none !border !border-rule-strong !bg-surface-2"
      />
      <Handle
        type="source"
        position={HandlePosition.Right}
        className="!size-2 !rounded-none !border !border-rule-strong !bg-surface-2"
      />
    </div>
  );
}

export const PlanNodeCard = memo(Card);
