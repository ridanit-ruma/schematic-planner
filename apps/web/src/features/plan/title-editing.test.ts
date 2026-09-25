import { describe, expect, it } from 'vitest';

import { draftSlug } from './title-editing';

describe('draftSlug', () => {
  it('gives two people adding a node at once different slugs', () => {
    expect(draftSlug(1, [])).not.toBe(draftSlug(2, []));
  });

  it('stays clear of a slug already taken', () => {
    const first = draftSlug(7, []);
    expect(draftSlug(7, [first])).not.toBe(first);
  });
});
