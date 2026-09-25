import { describe, expect, it } from 'vitest';

import { tagOptions } from './tag-input';

const vocabulary = {
  tags: [
    { name: 'Auth', color: 'red' as const },
    { name: 'Billing', color: 'blue' as const },
    { name: 'Author tools', color: 'green' as const },
  ],
};

describe('what the tag field offers', () => {
  it('lists the project’s tags the node does not have yet', () => {
    expect(tagOptions(vocabulary, ['Billing'], '')).toEqual([
      { kind: 'pick', name: 'Auth' },
      { kind: 'pick', name: 'Author tools' },
    ]);
  });

  it('filters by what is typed, ignoring case, and offers to create what is new', () => {
    expect(tagOptions(vocabulary, [], 'aut')).toEqual([
      { kind: 'pick', name: 'Auth' },
      { kind: 'pick', name: 'Author tools' },
      { kind: 'create', name: 'aut' },
    ]);
  });

  it('picks the project’s tag for an exact match in another case, rather than making a twin', () => {
    expect(tagOptions(vocabulary, [], 'auth')).toEqual([
      { kind: 'pick', name: 'Auth' },
      { kind: 'pick', name: 'Author tools' },
    ]);
  });

  it('does not offer to create a tag the node already has', () => {
    expect(tagOptions({ tags: [] }, ['legacy'], 'Legacy')).toEqual([]);
  });

  it('keeps what is typed, trimmed, as the new tag’s name', () => {
    expect(tagOptions({ tags: [] }, [], '  Needs review ')).toEqual([
      { kind: 'create', name: 'Needs review' },
    ]);
  });
});
