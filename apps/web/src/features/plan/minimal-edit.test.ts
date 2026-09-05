import { describe, expect, it } from 'vitest';

import { minimalEdit } from './minimal-edit';

function apply(current: string, next: string): string {
  const edit = minimalEdit(current, next);
  if (edit === null) return current;
  return current.slice(0, edit.at) + edit.insert + current.slice(edit.at + edit.remove);
}

describe('minimalEdit', () => {
  it('reports nothing when the text is unchanged', () => {
    expect(minimalEdit('hello', 'hello')).toBeNull();
  });

  it('touches only the characters that changed', () => {
    expect(minimalEdit('hello world', 'hello brave world')).toEqual({
      at: 6,
      remove: 0,
      insert: 'brave ',
    });
  });

  it('describes a deletion without an insert', () => {
    expect(minimalEdit('hello world', 'hello')).toEqual({ at: 5, remove: 6, insert: '' });
  });

  it('describes a replacement in the middle', () => {
    expect(minimalEdit('one two three', 'one four three')).toEqual({
      at: 4,
      remove: 3,
      insert: 'four',
    });
  });

  it('round-trips arbitrary pairs', () => {
    const pairs: [string, string][] = [
      ['', 'a'],
      ['a', ''],
      ['abc', 'abc'],
      ['abcabc', 'abc'],
      ['the plan', 'the whole plan'],
      ['aaa', 'aa'],
      ['line one\nline two', 'line one\nline 2'],
    ];
    for (const [current, next] of pairs) expect(apply(current, next)).toBe(next);
  });
});
