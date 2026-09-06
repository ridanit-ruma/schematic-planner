import { Handle, Position as HandlePosition, useStore, type NodeProps } from '@xyflow/react';
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
  group: 'border-[1.5px] border-rule-strong bg-surface-2/70',
};

/*
 * Two thresholds, because a card has two things to say.
 *
 * Below DETAIL_ZOOM the body is smaller than about seven pixels and is a smear
 * rather than words, so it goes. Below MINIMAL_ZOOM the title is too, and
 * pretending otherwise leaves a grid of unreadable marks — at that distance the
 * useful thing is the shape of the graph and the colour of its states, so the
 * card becomes exactly that.
 */
const DETAIL_ZOOM = 0.62;
const MINIMAL_ZOOM = 0.38;

function Card({ data, selected }: NodeProps<PlanFlowNode>) {
  const zoom = useStore((state) => state.transform[2]);
  const detailed = zoom >= DETAIL_ZOOM;
  const legible = zoom >= MINIMAL_ZOOM;
  const { node, childCount } = data;

  // A node that holds others is drawn as the boundary around them, labelled at
  // the top edge where nothing else sits. Drawn as a card it would land on top
  // of its own first child.
  if (childCount > 0) {
    return (
      /* The body is click-through so that the nodes inside stay reachable; the
         label row and the two terminals take events back. Without this a
         container would swallow every click over its own area. */
      <div
        className={cn(
          'pointer-events-none h-full w-full rounded-[2px] border-[1.5px] border-rule-strong bg-surface-2/50',
          selected === true && 'border-accent',
        )}
      >
        <div className="pointer-events-auto flex items-center gap-2 px-3 py-2">
          <span
            aria-hidden
            className="h-3.5 w-1 shrink-0"
            style={{ background: STATUS_COLOR[node.status] }}
          />
          {legible ? (
            <>
              <span className="truncate text-xs font-medium text-ink">{node.title}</span>
              {detailed ? (
                <span className="slug truncate text-ink-faint">{node.slug}</span>
              ) : null}
              <span className="ml-auto shrink-0 text-2xs text-ink-faint">{childCount}</span>
            </>
          ) : null}
        </div>
        <Handle
          type="target"
          position={HandlePosition.Left}
          className="pointer-events-auto !size-2 !rounded-none !border !border-rule-strong !bg-surface"
        />
        <Handle
          type="source"
          position={HandlePosition.Right}
          className="pointer-events-auto !size-2 !rounded-none !border !border-rule-strong !bg-surface"
        />
      </div>
    );
  }

  const excerpt = node.body.trim().split('\n')[0] ?? '';

  return (
    <div
      className={cn(
        'relative flex min-h-[72px] w-[260px] overflow-hidden rounded-[2px] bg-surface',
        KIND_BORDER[node.kind] ?? KIND_BORDER['task'],
        selected === true && 'border-accent ring-1 ring-accent',
      )}
    >
      <span
        aria-hidden
        className={cn('shrink-0', legible ? 'w-1' : 'w-full')}
        style={{ background: STATUS_COLOR[node.status] }}
      />

      <div className={cn('min-w-0 flex-1 px-3 py-2', !legible && 'hidden')}>
        <p className="truncate text-sm leading-snug font-medium text-ink">{node.title}</p>

        {detailed ? (
          <>
            <p className="slug mt-0.5 truncate text-ink-faint">{node.slug}</p>
            {excerpt !== '' ? (
              <p className="mt-1.5 line-clamp-2 text-xs leading-snug text-ink-muted">{excerpt}</p>
            ) : null}
            {(childCount > 0 || node.tags.length > 0) && (
              <p className="mt-1.5 text-2xs text-ink-faint">
                {childCount > 0 ? `${childCount} inside` : null}
                {childCount > 0 && node.tags.length > 0 ? '   ' : null}
                {node.tags.length > 0 ? node.tags.join('  ') : null}
              </p>
            )}
          </>
        ) : null}
      </div>

      {/* Square terminals rather than dots: this is a drawing, not a flowchart. */}
      <Handle
        type="target"
        position={HandlePosition.Left}
        className="!size-2 !rounded-none !border !border-rule-strong !bg-surface"
      />
      <Handle
        type="source"
        position={HandlePosition.Right}
        className="!size-2 !rounded-none !border !border-rule-strong !bg-surface"
      />
    </div>
  );
}

export const PlanNodeCard = memo(Card);
