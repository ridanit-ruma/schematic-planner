import { describe, expect, it } from 'vitest';

import { moveAmong } from './VocabularyEditor';

describe('moving an entry among its peers', () => {
  const list = ['a1', 'b1', 'a2', 'b2', 'a3'];
  const isA = (one: string) => one.startsWith('a');

  it('swaps with the nearest peer, stepping over the rest', () => {
    expect(moveAmong(list, 0, 1, isA)).toEqual(['a2', 'b1', 'a1', 'b2', 'a3']);
    expect(moveAmong(list, 4, -1, isA)).toEqual(['a1', 'b1', 'a3', 'b2', 'a2']);
  });

  it('leaves the list alone at either end', () => {
    expect(moveAmong(list, 0, -1, isA)).toEqual(list);
    expect(moveAmong(list, 4, 1, isA)).toEqual(list);
  });
});
