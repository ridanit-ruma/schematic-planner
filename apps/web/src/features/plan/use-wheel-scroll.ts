import { type RefObject, useEffect } from 'react';

/**
 * What a wheel's "one line" is worth in pixels.
 *
 * A guess, and unavoidably one: `deltaMode` says the number is in lines and
 * the browser never says how tall a line is. The bodies this scrolls are set in
 * text-xs with leading-snug, which comes to sixteen.
 */
export const LINE_PX = 16;

/**
 * How far a wheel event means to move this box, in pixels.
 *
 * Lines and pages, because a wheel does not always report pixels: Firefox sends
 * whole lines for a notch, and a page per notch is a setting people have. Taking
 * `deltaY` as pixels regardless moved a body three pixels for a gesture that
 * should have moved fifty.
 */
export function wheelPixels(
  event: Pick<WheelEvent, 'deltaY' | 'deltaMode'>,
  box: Pick<HTMLElement, 'clientHeight'>,
): number {
  if (event.deltaMode === 1) return event.deltaY * LINE_PX;
  if (event.deltaMode === 2) return event.deltaY * box.clientHeight;
  return event.deltaY;
}

/**
 * Whether this box takes the wheel rather than leaving it to the canvas.
 *
 * Where there is a scroll there is no zoom. It used to ask whether there was
 * room in the direction of the wheel, which handed the wheel back at the top
 * and the bottom — and reported as issue #7, that is a canvas that jumps scale
 * under somebody in the middle of reading, for no gesture they made. A scroll
 * that has run out simply stops.
 *
 * A box that does not overflow claims nothing, so the canvas is not left with
 * a dead patch wherever a card happens to be.
 *
 * Sub-pixel overflow is rounding, not something to scroll.
 */
export function takesTheWheel(
  box: Pick<HTMLElement, 'scrollHeight' | 'clientHeight'>,
): boolean {
  return box.scrollHeight - box.clientHeight > 1;
}

/**
 * A wheel anywhere over `surface` belongs to `scroller` while it can scroll.
 *
 * React Flow zooms on wheel and nothing over a card said otherwise, so a card
 * too tall to fit could be scrolled only by catching its scrollbar — which on a
 * trackpad is most of the width of a hair, and the canvas moved under you while
 * you tried.
 *
 * A native listener and not React's `onWheel`. React attaches its synthetic
 * handlers at the root of the application, which is *above* the pane, while
 * d3-zoom attaches to the pane itself — so the zoom had already happened by the
 * time a React handler on the card could ask for the event. On the element, it
 * is heard first.
 *
 * On the whole surface and not on the scrolling part of it, because the part of
 * a card or a note a pointer is most likely to be over — the title, the slug,
 * the tags — is not the part that scrolls. The body is then scrolled by hand:
 * the browser will only scroll what the pointer is directly over.
 */
export function useWheelScroll(
  surface: RefObject<HTMLElement | null>,
  scroller: RefObject<HTMLElement | null>,
): void {
  useEffect(() => {
    const listening = surface.current;
    if (listening === null) return;

    const onWheel = (event: WheelEvent): void => {
      const box = scroller.current;
      if (box === null) return;
      const by = wheelPixels(event, box);
      if (!takesTheWheel(box)) return;
      // Scrolled here rather than left to the browser. The wheel is taken
      // anywhere over the surface, including over the title and the tags, and
      // the browser only scrolls what the pointer is actually over — so on
      // every part of it except the body itself nothing would happen at all.
      event.stopPropagation();
      event.preventDefault();
      box.scrollTop += by;
    };

    listening.addEventListener('wheel', onWheel, { passive: false });
    return () => listening.removeEventListener('wheel', onWheel);
    // Both refs are read when the wheel arrives, so a body that mounts later —
    // or is replaced by an editor — needs no second subscription.
  }, [surface, scroller]);
}
