import { describe, expect, it } from 'vitest';

import { MAX_TITLE_PX, MIN_TITLE_PX, titleSize } from './title-size';

describe('titleSize', () => {
  it('leaves the title alone while it is already legible', () => {
    expect(titleSize(14, 1)).toBe(14);
    expect(titleSize(14, 0.9)).toBe(14);
  });

  it('holds the on-screen size as the view pulls back', () => {
    for (const zoom of [0.6, 0.5, 0.38, 0.33]) {
      expect(titleSize(14, zoom) * zoom).toBeCloseTo(MIN_TITLE_PX, 5);
    }
  });

  it('never grows past what a card can hold', () => {
    expect(titleSize(14, 0.05)).toBe(MAX_TITLE_PX);
    expect(titleSize(14, 0)).toBe(MAX_TITLE_PX);
  });

  it('grows a container label from its own smaller base', () => {
    expect(titleSize(12, 1)).toBe(12);
    expect(titleSize(12, 0.5)).toBe(22);
  });
});
