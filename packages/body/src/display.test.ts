import type * as M from 'mdast';
import { describe, expect, it } from 'vitest';

import { shapeForDisplay } from './display.js';
import { parseMarkdown } from './parse.js';

function shaped(markdown: string): M.Root {
  const tree = parseMarkdown(markdown);
  shapeForDisplay(tree, markdown);
  return tree;
}

/** The tree without positions, which are noise here. */
function plain(node: unknown): unknown {
  return JSON.parse(
    JSON.stringify(node, (key, value: unknown) => (key === 'position' ? undefined : value)),
  );
}

describe('shapeForDisplay', () => {
  it('makes a toggle into details and summary elements', () => {
    const tree = shaped('<details>\n<summary>Why</summary>\n\nBecause.\n\n</details>\n\nAfter.');
    expect(plain(tree.children)).toEqual([
      {
        type: 'blockquote',
        data: { hName: 'details' },
        children: [
          {
            type: 'paragraph',
            data: { hName: 'summary' },
            children: [{ type: 'text', value: 'Why' }],
          },
          { type: 'paragraph', children: [{ type: 'text', value: 'Because.' }] },
        ],
      },
      { type: 'paragraph', children: [{ type: 'text', value: 'After.' }] },
    ]);
  });

  it('marks a callout and sets its title apart', () => {
    const tree = shaped('> [!Warning] Mind the gap\n> Step over it.');
    expect(plain(tree.children[0])).toEqual({
      type: 'blockquote',
      data: { hProperties: { dataCallout: 'warning' } },
      children: [
        {
          type: 'paragraph',
          data: { hProperties: { dataCalloutTitle: '' } },
          children: [{ type: 'text', value: 'Mind the gap' }],
        },
        { type: 'paragraph', children: [{ type: 'text', value: 'Step over it.' }] },
      ],
    });
  });

  it('draws a callout with no title as its body alone', () => {
    const tree = shaped('> [!tip]\n> Body.');
    const quote = tree.children[0] as M.Blockquote;
    expect(quote.children).toHaveLength(1);
    expect(plain(quote.children[0])).toEqual({
      type: 'paragraph',
      children: [{ type: 'text', value: 'Body.' }],
    });
  });

  it('draws a quote that starts with an escaped marker as a quote', () => {
    const tree = shaped('> \\[!note] hello');
    expect(tree.children[0]?.data).toBeUndefined();
  });

  it('marks a callout inside a toggle written as one HTML block', () => {
    const tree = shaped('<details><summary>More</summary>\n> [!note] Inside\n</details>');
    const toggle = tree.children[0] as M.Blockquote;
    expect(toggle.children[1]?.data).toEqual({ hProperties: { dataCallout: 'note' } });
  });

  it('breaks lines where the source does', () => {
    const tree = shaped('one\ntwo');
    expect(plain(tree.children[0])).toEqual({
      type: 'paragraph',
      children: [{ type: 'text', value: 'one' }, { type: 'break' }, { type: 'text', value: 'two' }],
    });
  });

  it('leaves an unclosed toggle as it was written', () => {
    const tree = shaped('<details>\n<summary>Open</summary>\n\nstill here');
    expect(tree.children[0]?.type).toBe('html');
  });
});
