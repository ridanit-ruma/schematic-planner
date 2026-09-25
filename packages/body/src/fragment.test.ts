import { prosemirrorToYXmlFragment } from '@tiptap/y-tiptap';
import { describe, expect, it } from 'vitest';
import * as Y from 'yjs';

import { applyMarkdown, fragmentToJSON, fragmentToMarkdown } from './fragment.js';
import { markdownToDoc } from './parse.js';
import { bodySchema } from './schema.js';

function bodyIn(doc: Y.Doc): Y.XmlFragment {
  const node = doc.getMap<unknown>('nodes');
  let fragment = node.get('body');
  if (!(fragment instanceof Y.XmlFragment)) {
    fragment = new Y.XmlFragment();
    node.set('body', fragment);
  }
  return fragment as Y.XmlFragment;
}

function sync(a: Y.Doc, b: Y.Doc): void {
  Y.applyUpdate(b, Y.encodeStateAsUpdate(a, Y.encodeStateVector(b)));
  Y.applyUpdate(a, Y.encodeStateAsUpdate(b, Y.encodeStateVector(a)));
}

/** The Y.XmlText of the nth top-level paragraph, where a person's typing lands. */
function paragraphText(fragment: Y.XmlFragment, index: number): Y.XmlText {
  const paragraph = fragment.get(index) as Y.XmlElement;
  return paragraph.get(0) as Y.XmlText;
}

const BODY = [
  '# Heading',
  'First paragraph with **bold**.',
  '- [ ] a task\n- [x] done',
  '> [!note] Callout\n> Inside.',
  '| a | b |\n| - | - |\n| 1 | 2 |',
  '<details>\n<summary>More</summary>\n\nHidden.\n\n</details>',
  '![image](a.png)',
].join('\n\n');

describe('a body fragment', () => {
  it('holds what the Markdown says and gives it back', () => {
    const doc = new Y.Doc();
    const fragment = bodyIn(doc);
    applyMarkdown(fragment, BODY);
    expect(fragmentToMarkdown(fragment)).toBe(BODY);
  });

  it('reads the same JSON the editor binding writes', () => {
    const doc = new Y.Doc();
    const fragment = bodyIn(doc);
    const pm = markdownToDoc(BODY);
    doc.transact(() => prosemirrorToYXmlFragment(pm, fragment));
    // Attributes left at null are not stored, and come back as their defaults.
    expect(bodySchema.nodeFromJSON(fragmentToJSON(fragment)).eq(pm)).toBe(true);
  });

  it('reads an empty fragment as an empty body', () => {
    const doc = new Y.Doc();
    expect(fragmentToMarkdown(bodyIn(doc))).toBe('');
  });

  it('writes nothing when the Markdown already matches', () => {
    const doc = new Y.Doc();
    const fragment = bodyIn(doc);
    applyMarkdown(fragment, BODY);
    const before = Y.encodeStateVector(doc);
    applyMarkdown(fragment, BODY);
    expect(Y.encodeStateVector(doc)).toEqual(before);
  });

  it('changes only the block that changed', () => {
    const doc = new Y.Doc();
    const fragment = bodyIn(doc);
    applyMarkdown(fragment, 'One.\n\nTwo.\n\nThree.');
    const [first, second, third] = fragment.toArray();
    applyMarkdown(fragment, 'One.\n\nTwo, edited.\n\nThree.');
    const after = fragment.toArray();
    expect(after[0]).toBe(first);
    expect(after[1]).toBe(second);
    expect(after[2]).toBe(third);
    expect(fragmentToMarkdown(fragment)).toBe('One.\n\nTwo, edited.\n\nThree.');
  });

  it('toggles a task as an attribute, not a new item', () => {
    const doc = new Y.Doc();
    const fragment = bodyIn(doc);
    applyMarkdown(fragment, '- [ ] a\n- [ ] b');
    const list = fragment.get(0) as Y.XmlElement;
    const item = list.get(1) as Y.XmlElement;
    applyMarkdown(fragment, '- [ ] a\n- [x] b');
    expect(list.get(1)).toBe(item);
    expect(item.getAttribute('checked')).toBe(true);
  });
});

describe('the Markdown cache', () => {
  it('follows an edit made inside the fragment', () => {
    const doc = new Y.Doc();
    const fragment = bodyIn(doc);
    applyMarkdown(fragment, 'Hello.');
    expect(fragmentToMarkdown(fragment)).toBe('Hello.');
    paragraphText(fragment, 0).insert(5, ', world');
    expect(fragmentToMarkdown(fragment)).toBe('Hello, world.');
  });

  it('follows an edit that arrives from a peer', () => {
    const server = new Y.Doc();
    const browser = new Y.Doc();
    applyMarkdown(bodyIn(server), 'Hello.');
    sync(server, browser);
    expect(fragmentToMarkdown(bodyIn(server))).toBe('Hello.');
    paragraphText(bodyIn(browser), 0).format(0, 5, { bold: {} });
    sync(browser, server);
    expect(fragmentToMarkdown(bodyIn(server))).toBe('**Hello**.');
  });

  it('is already fresh inside an observer registered before it', () => {
    const doc = new Y.Doc();
    const seen: string[] = [];
    // The projection a canvas makes on every change: registered first, on a
    // parent of the body, so it runs before anything the body registers.
    doc.getMap('nodes').observeDeep(() => seen.push(fragmentToMarkdown(bodyIn(doc))));
    const fragment = bodyIn(doc);
    applyMarkdown(fragment, 'One.');
    expect(fragmentToMarkdown(fragment)).toBe('One.');
    paragraphText(fragment, 0).insert(3, ' more');
    expect(seen[seen.length - 1]).toBe('One more.');
  });

  it('is not trusted inside a transaction', () => {
    const doc = new Y.Doc();
    const fragment = bodyIn(doc);
    applyMarkdown(fragment, 'One.');
    expect(fragmentToMarkdown(fragment)).toBe('One.');
    doc.transact(() => {
      paragraphText(fragment, 0).insert(3, '!');
      expect(fragmentToMarkdown(fragment)).toBe('One!.');
    });
  });
});

describe('an agent writing while a person types', () => {
  it('keeps the words the person typed, and the agent’s change', () => {
    const server = new Y.Doc();
    const browser = new Y.Doc();
    applyMarkdown(bodyIn(server), 'Intro.\n\nNotes:');
    sync(server, browser);

    // Neither has seen the other's change yet.
    paragraphText(bodyIn(browser), 1).insert('Notes:'.length, ' typed while the agent wrote');
    applyMarkdown(bodyIn(server), 'Intro, rewritten by the agent.\n\nNotes:\n\n- [ ] a new task');

    sync(server, browser);
    const expected =
      'Intro, rewritten by the agent.\n\nNotes: typed while the agent wrote\n\n- [ ] a new task';
    expect(fragmentToMarkdown(bodyIn(server))).toBe(expected);
    expect(fragmentToMarkdown(bodyIn(browser))).toBe(expected);
  });

  it('keeps a person’s edit inside the very paragraph the agent changed', () => {
    const server = new Y.Doc();
    const browser = new Y.Doc();
    applyMarkdown(bodyIn(server), 'The quick fox.');
    sync(server, browser);

    paragraphText(bodyIn(browser), 0).insert('The quick'.length, ' brown');
    applyMarkdown(bodyIn(server), 'The quick fox jumps.');

    sync(server, browser);
    expect(fragmentToMarkdown(bodyIn(server))).toBe('The quick brown fox jumps.');
    expect(fragmentToMarkdown(bodyIn(browser))).toBe('The quick brown fox jumps.');
  });
});
