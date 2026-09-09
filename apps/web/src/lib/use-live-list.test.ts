import { describe, expect, it } from 'vitest';

import { shouldReread } from './use-live-list';

describe('shouldReread', () => {
  it('reads again when the window comes back to the front', () => {
    expect(shouldReread('visible', 0, 5_000)).toBe(true);
  });

  it('stays quiet while the tab is in the background', () => {
    // A background tab firing visibilitychange on its way out is not somebody
    // looking at a stale list.
    expect(shouldReread('hidden', 0, 5_000)).toBe(false);
  });

  it('answers one return once, however many events it arrives as', () => {
    // focus and visibilitychange both fire when a tab is raised.
    expect(shouldReread('visible', 10_000, 10_010)).toBe(false);
  });

  it('and is ready again after the quiet period', () => {
    expect(shouldReread('visible', 10_000, 11_500)).toBe(true);
  });
});
