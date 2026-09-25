import { planDocSchema, type PlanDoc } from '@schematic/schema';
import { describe, expect, it } from 'vitest';
import * as Y from 'yjs';

import { applyOps, commentsMap, initializePlan, metaMap, nodesMap, readPlanDoc } from './bind.js';
import { migrateBodies, nodeBodyFragment, toggleNodeTask } from './body.js';

const BODIES = {
  plain: 'Postgres, behind the API.',
  // Written the way agents often write, not the way the serialiser does.
  stars: '* one\n* two\n\n__bold__ and _italic_',
  rich: '# Heading\n\n- [ ] open\n- [x] done\n\n> [!note] Heads up\n> Read this.\n\n| a | b |\n|---|---|\n| 1 | 2 |',
  toggle: '<details>\n<summary>Why</summary>\nBecause.\n</details>',
  image: 'See ![diagram](https://example.com/d.png) here.',
  empty: '',
};

function plan(): PlanDoc {
  return planDocSchema.parse({
    id: 'plan-1',
    title: 'Plan',
    updatedAt: '2026-01-01T00:00:00.000Z',
    nodes: Object.entries(BODIES).map(([slug, body]) => ({ slug, title: slug, body })),
    comments: [{ id: 'note', body: 'A note stays text.' }],
  });
}

/** A document as it was stored before bodies were fragments: every body a Y.Text. */
function legacy(source: PlanDoc): Y.Doc {
  const doc = new Y.Doc();
  initializePlan(doc, source);
  doc.transact(() => {
    for (const node of nodesMap(doc).values()) {
      const markdown = source.nodes.find((each) => each.slug === node.get('slug'))?.body ?? '';
      const text = new Y.Text();
      text.insert(0, markdown);
      node.set('body', text);
      node.delete('bodySource');
    }
  });
  return doc;
}

function sync(a: Y.Doc, b: Y.Doc): void {
  Y.applyUpdate(b, Y.encodeStateAsUpdate(a, Y.encodeStateVector(b)));
  Y.applyUpdate(a, Y.encodeStateAsUpdate(b, Y.encodeStateVector(a)));
}

function bodyOf(doc: Y.Doc, slug: string): string | undefined {
  return readPlanDoc(doc).doc.nodes.find((node) => node.slug === slug)?.body;
}

describe('node bodies', () => {
  it('are stored as fragments and read back exactly as written', () => {
    const doc = new Y.Doc();
    initializePlan(doc, plan());
    for (const [slug, body] of Object.entries(BODIES)) {
      expect(nodesMap(doc).get(slug)?.get('body')).toBeInstanceOf(Y.XmlFragment);
      expect(bodyOf(doc, slug)).toBe(body);
    }
  });

  it('keep notes as plain shared text', () => {
    const doc = new Y.Doc();
    initializePlan(doc, plan());
    expect(commentsMap(doc).get('note')?.get('body')).toBeInstanceOf(Y.Text);
  });

  it('read as the fragment says once somebody edits it', () => {
    const doc = new Y.Doc();
    initializePlan(doc, plan());
    const fragment = nodeBodyFragment(doc, 'stars')!;
    const list = fragment.get(0) as Y.XmlElement;
    const text = ((list.get(1) as Y.XmlElement).get(0) as Y.XmlElement).get(0) as Y.XmlText;
    text.insert(3, ' more');
    expect(bodyOf(doc, 'stars')).toBe('- one\n- two more\n\n**bold** and *italic*');
  });

  it('write nothing when an agent sends the body that is already there', () => {
    const doc = new Y.Doc();
    initializePlan(doc, plan());
    let touched = 0;
    for (const node of nodesMap(doc).values()) {
      (node.get('body') as Y.XmlFragment).observeDeep(() => (touched += 1));
    }
    applyOps(doc, [{ op: 'upsert_node', node: { slug: 'stars', body: BODIES.stars } }]);
    applyOps(doc, [{ op: 'upsert_node', node: { slug: 'rich', title: 'Renamed title' } }]);
    expect(touched).toBe(0);
    expect(bodyOf(doc, 'rich')).toBe(BODIES.rich);
  });

  it('keep what a person is typing when an agent rewrites another part', () => {
    const server = new Y.Doc();
    initializePlan(server, plan());
    const browser = new Y.Doc();
    sync(server, browser);

    const typing = nodeBodyFragment(browser, 'plain')!;
    const paragraph = (typing.get(0) as Y.XmlElement).get(0) as Y.XmlText;
    paragraph.insert(paragraph.length, ' Typed by a person.');
    applyOps(server, [
      {
        op: 'upsert_node',
        node: { slug: 'plain', body: `${BODIES.plain}\n\n- [ ] added by an agent` },
      },
    ]);
    sync(server, browser);

    const expected = 'Postgres, behind the API. Typed by a person.\n\n- [ ] added by an agent';
    expect(bodyOf(server, 'plain')).toBe(expected);
    expect(bodyOf(browser, 'plain')).toBe(expected);
  });

  it('move with a renamed node, blocks and spelling intact', () => {
    const doc = new Y.Doc();
    initializePlan(doc, plan());
    applyOps(doc, [{ op: 'rename_node', from: 'stars', to: 'renamed' }]);
    expect(bodyOf(doc, 'renamed')).toBe(BODIES.stars);
    expect(nodesMap(doc).get('renamed')?.get('body')).toBeInstanceOf(Y.XmlFragment);
  });
});

describe('toggleNodeTask', () => {
  it('ticks one box and changes nothing else', () => {
    const doc = new Y.Doc();
    initializePlan(doc, plan());
    toggleNodeTask(doc, 'rich', 0);
    expect(bodyOf(doc, 'rich')).toBe(BODIES.rich.replace('- [ ] open', '- [x] open'));
  });

  it('keeps the spelling of a body written some other way', () => {
    const doc = new Y.Doc();
    initializePlan(
      doc,
      planDocSchema.parse({
        id: 'p',
        title: 'P',
        updatedAt: '2026-01-01T00:00:00.000Z',
        nodes: [{ slug: 'q', title: 'Q', body: '* [ ] yes\n* [ ] no' }],
      }),
    );
    toggleNodeTask(doc, 'q', 1);
    expect(bodyOf(doc, 'q')).toBe('* [ ] yes\n* [x] no');
  });
});

describe('migrateBodies', () => {
  it('converts every text body once and reads the plan exactly as before', () => {
    const doc = legacy(plan());
    const before = readPlanDoc(doc).doc;
    expect(nodesMap(doc).get('rich')?.get('body')).toBeInstanceOf(Y.Text);

    expect(migrateBodies(doc)).toBe(Object.keys(BODIES).length);
    for (const node of nodesMap(doc).values()) {
      expect(node.get('body')).toBeInstanceOf(Y.XmlFragment);
    }
    expect(readPlanDoc(doc).doc).toEqual(before);

    const settled = Y.encodeStateVector(doc);
    expect(migrateBodies(doc)).toBe(0);
    expect(Y.encodeStateVector(doc)).toEqual(settled);
  });

  it('is one transaction with its own origin', () => {
    const doc = legacy(plan());
    const origins: unknown[] = [];
    doc.on('afterTransaction', (transaction: Y.Transaction) => origins.push(transaction.origin));
    migrateBodies(doc);
    expect(origins).toEqual(['migrate']);
  });

  it('leaves the plan’s other fields alone', () => {
    const doc = legacy(plan());
    const title = metaMap(doc).get('title');
    migrateBodies(doc);
    expect(metaMap(doc).get('title')).toBe(title);
    expect(commentsMap(doc).get('note')?.get('body')).toBeInstanceOf(Y.Text);
  });
});
