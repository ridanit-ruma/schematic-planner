import { describe, expect, it } from 'vitest';

import { onlyTaskFlips, taskItems, toggleTask } from './tasks.js';

describe('finding the task items in a body', () => {
  it('finds one under every list marker there is', () => {
    const body = ['- [ ] dash', '* [ ] star', '+ [ ] plus', '1. [ ] ordered', '2) [ ] also'].join(
      '\n',
    );
    expect(taskItems(body).map((item) => item.label)).toEqual([
      'dash',
      'star',
      'plus',
      'ordered',
      'also',
    ]);
  });

  it('reads both spellings of a ticked box', () => {
    expect(taskItems('- [x] lower\n- [X] upper').map((item) => item.checked)).toEqual([true, true]);
  });

  it('points at the marker character itself', () => {
    const body = '- [ ] first';
    const [item] = taskItems(body);
    expect(item?.at).toBe(3);
    expect(body[item!.at]).toBe(' ');
  });

  it('finds an item that is indented under another', () => {
    expect(taskItems('- [ ] outer\n  - [ ] inner')).toHaveLength(2);
  });

  /* A fenced block is a picture of markup, not markup. */
  it('ignores a list inside a fenced code block', () => {
    const body = ['- [ ] real', '```', '- [ ] shown, not asked', '```', '- [ ] also real'].join(
      '\n',
    );
    expect(taskItems(body).map((item) => item.label)).toEqual(['real', 'also real']);
  });

  it('ignores brackets that sit inside a code span', () => {
    expect(taskItems('- `[ ]` is how you write one')).toEqual([]);
  });

  it('finds nothing in a body with no list at all', () => {
    expect(taskItems('Just a sentence.\n\nAnd another.')).toEqual([]);
  });
});

describe('ticking a box', () => {
  it('flips the one asked for and nothing else', () => {
    const body = '- [ ] one\n- [ ] two';
    expect(toggleTask(body, 1)).toBe('- [ ] one\n- [x] two');
  });

  it('unticks one that was ticked', () => {
    expect(toggleTask('- [x] one', 0)).toBe('- [ ] one');
  });

  /* One character, so the shared document sees a one-character edit and two
     people answering the same note merge instead of overwriting. */
  it('changes exactly one character', () => {
    const body = '- [ ] one\n- [ ] two\n- [ ] three';
    const after = toggleTask(body, 2);
    expect(after).toHaveLength(body.length);
    expect([...body].filter((char, at) => char !== after[at])).toHaveLength(1);
  });

  it('leaves the body alone for an item that is not there', () => {
    const body = '- [ ] one';
    expect(toggleTask(body, 7)).toBe(body);
    expect(toggleTask('nothing here', 0)).toBe('nothing here');
  });
});

describe('telling an answer from an edit', () => {
  it('is an answer when only a box changed', () => {
    expect(onlyTaskFlips('- [ ] one\n- [ ] two', '- [ ] one\n- [x] two')).toBe(true);
  });

  it('is not an answer when a word changed as well', () => {
    expect(onlyTaskFlips('- [ ] one', '- [x] one and a half')).toBe(false);
  });

  it('is not an answer when an item was added', () => {
    expect(onlyTaskFlips('- [ ] one', '- [ ] one\n- [x] two')).toBe(false);
  });

  it('is not an answer when nothing changed', () => {
    expect(onlyTaskFlips('- [ ] one', '- [ ] one')).toBe(false);
  });

  it('is not an answer when there were never any boxes', () => {
    expect(onlyTaskFlips('a note', 'a different note')).toBe(false);
  });
});
