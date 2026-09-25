import { planDocSchema, planOpsSchema } from '@schematic/schema';
import { applyOps, initializePlan, nodeBodyFragment, nodesMap } from '@schematic/ydoc';
import { describe, expect, it } from 'vitest';
import * as Y from 'yjs';

import { watchNodeBody } from './node-body';

function seeded() {
  const doc = new Y.Doc();
  initializePlan(
    doc,
    planDocSchema.parse({
      id: 'plan-1',
      title: 'Plan',
      updatedAt: '2026-01-01T00:00:00.000Z',
      nodes: [{ slug: 'db', title: 'Database', body: 'Holds the rows.' }],
      edges: [],
    }),
  );
  return doc;
}

const ops = (input: unknown[]) => planOpsSchema.parse(input);

describe('watchNodeBody', () => {
  it('follows a node deleted and made again under the same slug', () => {
    const doc = seeded();
    let bound: Y.XmlFragment | undefined;
    const stop = watchNodeBody(doc, 'db', (fragment) => (bound = fragment));

    applyOps(doc, ops([{ op: 'delete_node', slug: 'db' }]));
    applyOps(doc, ops([{ op: 'upsert_node', node: { slug: 'db', title: 'Database' } }]));

    expect(bound).toBeDefined();
    expect(bound).toBe(nodeBodyFragment(doc, 'db'));
    stop();
  });

  it('converts an old text body that arrives while watched, once', () => {
    const doc = seeded();
    const seen: (Y.XmlFragment | undefined)[] = [];
    const stop = watchNodeBody(doc, 'db', (fragment) => seen.push(fragment));

    doc.transact(() => nodesMap(doc).get('db')?.set('body', new Y.Text('Old words.')));

    expect(seen).toHaveLength(2);
    expect(seen[1]).toBeInstanceOf(Y.XmlFragment);
    expect(seen[1]).toBe(nodesMap(doc).get('db')?.get('body'));
    stop();
  });
});
