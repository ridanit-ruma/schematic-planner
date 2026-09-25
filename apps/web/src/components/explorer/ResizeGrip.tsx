import { useRef } from 'react';

import { useT } from '@/i18n';
import { EXPLORER_WIDTH } from './tree';

/** How far one press of an arrow key moves the edge. */
const STEP = 16;

/**
 * The explorer's right edge, as a handle: dragged to resize, double-clicked to
 * go back to the default, and moved with the arrow keys when focused. The width
 * is written down once, when the edge is let go, not at every pixel on the way.
 */
export function ResizeGrip({
  width,
  onPreview,
  onCommit,
  onReset,
}: {
  width: number;
  onPreview: (width: number) => void;
  onCommit: (width: number) => void;
  onReset: () => void;
}) {
  const t = useT();
  const held = useRef<{ x: number; width: number } | null>(null);

  const release = (): void => {
    held.current = null;
    document.body.style.removeProperty('cursor');
    document.body.style.removeProperty('user-select');
  };

  return (
    <div
      role="separator"
      aria-orientation="vertical"
      aria-label={t.explorer.resize}
      aria-valuemin={EXPLORER_WIDTH.min}
      aria-valuemax={EXPLORER_WIDTH.max}
      aria-valuenow={width}
      tabIndex={0}
      title={t.explorer.resize}
      onPointerDown={(event) => {
        if (event.button !== 0) return;
        event.preventDefault();
        event.currentTarget.setPointerCapture(event.pointerId);
        held.current = { x: event.clientX, width };
        // The pointer leaves the grip as soon as it moves faster than the
        // edge, and text under it would be selected on the way.
        document.body.style.cursor = 'col-resize';
        document.body.style.userSelect = 'none';
      }}
      onPointerMove={(event) => {
        const start = held.current;
        if (start === null) return;
        onPreview(start.width + event.clientX - start.x);
      }}
      onPointerUp={(event) => {
        const start = held.current;
        if (start === null) return;
        onCommit(start.width + event.clientX - start.x);
        release();
      }}
      onPointerCancel={() => {
        const start = held.current;
        if (start === null) return;
        onCommit(width);
        release();
      }}
      onDoubleClick={onReset}
      onKeyDown={(event) => {
        if (event.key === 'ArrowLeft') onCommit(width - STEP);
        else if (event.key === 'ArrowRight') onCommit(width + STEP);
        else if (event.key === 'Home' || event.key === 'Enter') onReset();
        else return;
        event.preventDefault();
      }}
      className="absolute inset-y-0 -right-1 z-20 w-2 cursor-col-resize touch-none transition-colors outline-none hover:bg-accent/40 focus-visible:bg-accent/60 max-md:hidden"
    />
  );
}
