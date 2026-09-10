import type { Presence } from '@schematic/ydoc';
import { ViewportPortal, useStore as useFlowStore } from '@xyflow/react';
import { useStore } from 'zustand';

import type { PlanStore } from './plan-store';

/**
 * Everybody else's pointer, drawn where it is on the plan.
 *
 * A name in the title block says somebody is here; this says where. On a canvas
 * that is the difference between knowing you are not alone and being able to
 * work at the same time as somebody without both reaching for the same node.
 *
 * The arrow is drawn at a constant size on screen, so it stays a pointer at
 * every zoom rather than growing into a shape.
 */
export function PeerCursors({ store }: { store: PlanStore['store'] }) {
  const peers = useStore(store, (state) => state.peers);
  const zoom = useFlowStore((state) => state.transform[2]);
  const showing = peers.filter((peer) => peer.cursor != null);
  if (showing.length === 0) return null;

  return (
    <ViewportPortal>
      {showing.map((peer) => (
        <Cursor key={peer.userId} peer={peer} zoom={zoom} />
      ))}
    </ViewportPortal>
  );
}

function Cursor({ peer, zoom }: { peer: Presence; zoom: number }) {
  const at = peer.cursor;
  if (at == null) return null;

  return (
    <div
      className="pointer-events-none absolute top-0 left-0 z-50"
      style={{
        transform: `translate(${at.x}px, ${at.y}px) scale(${1 / zoom})`,
        transformOrigin: '0 0',
      }}
    >
      <svg width="14" height="18" viewBox="0 0 14 18" fill="none" aria-hidden>
        <path
          d="M1 1L1 14.5L4.6 11.2L7 16.8L9.6 15.7L7.2 10.3L12 10.1L1 1Z"
          fill={peer.color}
          stroke="var(--surface)"
          strokeWidth="1.2"
          strokeLinejoin="round"
        />
      </svg>
      <span
        className="absolute top-4 left-3 rounded-sm px-1.5 py-0.5 text-2xs font-medium whitespace-nowrap text-white"
        style={{ background: peer.color }}
      >
        {peer.name}
      </span>
    </div>
  );
}
