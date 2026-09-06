import { useEffect, useRef, useState } from 'react';

import { Button } from '@/components/ui/button';

/** What is written, and what the picture is framed in while it is being set. */
const OUTPUT = 512;
const FRAME = 260;

interface Placement {
  /** Multiple of the scale at which the image just fills the frame. */
  zoom: number;
  /** Offset of the image centre from the frame centre, in frame pixels. */
  x: number;
  y: number;
}

/**
 * Picks the square that will be kept, before anything is uploaded.
 *
 * The finished square is drawn here and sent as PNG bytes, so the server never
 * decodes an image it was given — it stores what this produced.
 */
export function AvatarEditor({
  file,
  onCancel,
  onDone,
}: {
  file: File;
  onCancel: () => void;
  onDone: (png: Blob) => void | Promise<void>;
}) {
  const [image, setImage] = useState<HTMLImageElement | null>(null);
  const [placement, setPlacement] = useState<Placement>({ zoom: 1, x: 0, y: 0 });
  const [failed, setFailed] = useState(false);
  const [busy, setBusy] = useState(false);
  const canvas = useRef<HTMLCanvasElement>(null);
  const dragging = useRef<{ x: number; y: number } | null>(null);

  useEffect(() => {
    const url = URL.createObjectURL(file);
    const element = new Image();
    element.onload = () => {
      setImage(element);
      setPlacement({ zoom: 1, x: 0, y: 0 });
    };
    element.onerror = () => setFailed(true);
    element.src = url;
    return () => URL.revokeObjectURL(url);
  }, [file]);

  // The frame is a preview of the file that will be written, drawn at the size
  // it is shown rather than at output size.
  useEffect(() => {
    const context = canvas.current?.getContext('2d');
    if (context === null || context === undefined || image === null) return;
    paint(context, image, placement, FRAME);
  }, [image, placement]);

  const clamp = (next: Placement): Placement => {
    // The frame must stay covered: panning can never expose an empty corner.
    const cover = coverScale(image, FRAME) * next.zoom;
    const width = (image?.naturalWidth ?? 0) * cover;
    const height = (image?.naturalHeight ?? 0) * cover;
    const room = { x: Math.max(0, (width - FRAME) / 2), y: Math.max(0, (height - FRAME) / 2) };
    return {
      zoom: next.zoom,
      x: Math.min(Math.max(next.x, -room.x), room.x),
      y: Math.min(Math.max(next.y, -room.y), room.y),
    };
  };

  const save = async (): Promise<void> => {
    if (image === null) return;
    const output = document.createElement('canvas');
    output.width = OUTPUT;
    output.height = OUTPUT;
    const context = output.getContext('2d');
    if (context === null) return;
    paint(context, image, placement, OUTPUT);

    setBusy(true);
    const png = await new Promise<Blob | null>((resolve) => output.toBlob(resolve, 'image/png'));
    if (png === null) {
      setBusy(false);
      setFailed(true);
      return;
    }
    await onDone(png);
    setBusy(false);
  };

  if (failed) {
    return (
      <div className="space-y-4">
        <p className="text-sm text-danger">That file could not be read as an image.</p>
        <div className="flex justify-end">
          <Button variant="ghost" onClick={onCancel}>
            Close
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex justify-center">
        <div
          className="relative cursor-grab touch-none overflow-hidden rounded-full border border-rule bg-surface-2 active:cursor-grabbing"
          style={{ width: FRAME, height: FRAME }}
          onPointerDown={(event) => {
            dragging.current = { x: event.clientX, y: event.clientY };
            event.currentTarget.setPointerCapture(event.pointerId);
          }}
          onPointerMove={(event) => {
            const from = dragging.current;
            if (from === null) return;
            dragging.current = { x: event.clientX, y: event.clientY };
            setPlacement((current) =>
              clamp({
                ...current,
                x: current.x + (event.clientX - from.x),
                y: current.y + (event.clientY - from.y),
              }),
            );
          }}
          onPointerUp={() => {
            dragging.current = null;
          }}
          onWheel={(event) => {
            setPlacement((current) =>
              clamp({ ...current, zoom: zoomStep(current.zoom, event.deltaY < 0 ? 1 : -1) }),
            );
          }}
        >
          <canvas ref={canvas} width={FRAME} height={FRAME} className="block" />
        </div>
      </div>

      <label className="flex items-center gap-3">
        <span className="text-xs text-ink-muted">Zoom</span>
        <input
          type="range"
          min={100}
          max={400}
          value={Math.round(placement.zoom * 100)}
          onChange={(event) =>
            setPlacement((current) => clamp({ ...current, zoom: Number(event.target.value) / 100 }))
          }
          className="flex-1 accent-[var(--accent)]"
        />
      </label>

      <p className="text-2xs text-ink-faint">
        Drag the picture to move it. It is saved as a {OUTPUT}×{OUTPUT} square.
      </p>

      <div className="flex justify-end gap-2">
        <Button type="button" variant="ghost" onClick={onCancel} disabled={busy}>
          Cancel
        </Button>
        <Button type="button" variant="primary" onClick={() => void save()} disabled={busy || image === null}>
          {busy ? 'Saving…' : 'Save picture'}
        </Button>
      </div>
    </div>
  );
}

/** The scale at which the image just covers a square of the given size. */
function coverScale(image: HTMLImageElement | null, size: number): number {
  if (image === null || image.naturalWidth === 0 || image.naturalHeight === 0) return 1;
  return Math.max(size / image.naturalWidth, size / image.naturalHeight);
}

function zoomStep(zoom: number, direction: 1 | -1): number {
  return Math.min(4, Math.max(1, zoom * (direction === 1 ? 1.1 : 1 / 1.1)));
}

function paint(
  context: CanvasRenderingContext2D,
  image: HTMLImageElement,
  placement: Placement,
  size: number,
): void {
  const scale = coverScale(image, size) * placement.zoom;
  const width = image.naturalWidth * scale;
  const height = image.naturalHeight * scale;
  // The offset is held in frame pixels so that dragging feels the same whatever
  // the output size is.
  const ratio = size / FRAME;

  context.clearRect(0, 0, size, size);
  context.drawImage(
    image,
    (size - width) / 2 + placement.x * ratio,
    (size - height) / 2 + placement.y * ratio,
    width,
    height,
  );
}
