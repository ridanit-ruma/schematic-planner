import { planDocSchema } from '@schematic/schema';
import * as Y from 'yjs';
import { describe, expect, it } from 'vitest';

import { applyOps, initializePlan } from './bind.js';
import { commitNodePosition } from './mutations.js';
import { planRevision, planRevisionFromUpdate } from './revision.js';

function doc() {
  const ydoc = new Y.Doc();
  initializePlan(
    ydoc,
    planDocSchema.parse({
      id: 'plan-1',
      title: 'Plan',
      updatedAt: '2026-01-01T00:00:00.000Z',
      nodes: [{ slug: 'a', title: 'A' }],
    }),
  );
  return ydoc;
}

describe('planRevision', () => {
  it('is the same answer for a document nobody has touched', () => {
    const ydoc = doc();
    expect(planRevision(ydoc)).toBe(planRevision(ydoc));
  });

  it('moves when the plan does', () => {
    const ydoc = doc();
    const was = planRevision(ydoc);
    applyOps(ydoc, [{ op: 'upsert_node', node: { slug: 'b', title: 'B' } }]);
    expect(planRevision(ydoc)).not.toBe(was);
  });

  it('moves for a change nothing reads back, which is the safe direction', () => {
    const ydoc = doc();
    const was = planRevision(ydoc);
    commitNodePosition(ydoc, 'a', { x: 10, y: 20 });
    expect(planRevision(ydoc)).not.toBe(was);
  });

  it('holds still for a transaction that writes nothing', () => {
    const ydoc = doc();
    const was = planRevision(ydoc);
    Y.transact(ydoc, () => {});
    expect(planRevision(ydoc)).toBe(was);
  });

  it('is carried by whoever received the document, not by who wrote it', () => {
    const one = doc();
    const two = new Y.Doc();
    Y.applyUpdate(two, Y.encodeStateAsUpdate(one));
    expect(planRevision(two)).toBe(planRevision(one));
  });
});

describe('planRevisionFromUpdate', () => {
  it('agrees with the live document it was encoded from', () => {
    const ydoc = doc();
    expect(planRevisionFromUpdate(Y.encodeStateAsUpdate(ydoc))).toBe(planRevision(ydoc));
  });

  it('answers for a plan that was never materialised', () => {
    expect(planRevisionFromUpdate(null)).toBe('');
  });
});
