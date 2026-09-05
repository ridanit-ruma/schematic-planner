import * as Y from 'yjs';
import { describe, expect, it } from 'vitest';
import { planDocSchema } from '@schematic/schema';

import { initializePlan, readPlanDoc } from './bind.js';
import { commitLayout, commitNodePosition, nodeBodyText } from './mutations.js';
import { presenceColor } from './presence.js';

function doc() {
  const ydoc = new Y.Doc();
  initializePlan(
    ydoc,
    planDocSchema.parse({
      id: 'plan-1',
      title: 'Plan',
      updatedAt: '2026-01-01T00:00:00.000Z',
      nodes: [
        { slug: 'a', title: 'A' },
        { slug: 'b', title: 'B' },
      ],
    }),
  );
  return ydoc;
}

describe('commitNodePosition', () => {
  it('stores rounded coordinates and pins the node', () => {
    const ydoc = doc();
    commitNodePosition(ydoc, 'a', { x: 10.4, y: 20.6 });

    const node = readPlanDoc(ydoc).doc.nodes.find((n) => n.slug === 'a');
    expect(node?.position).toEqual({ x: 10, y: 21 });
    expect(node?.pinned).toBe(true);
  });

  it('ignores a node that is no longer there', () => {
    const ydoc = doc();
    expect(() => commitNodePosition(ydoc, 'gone', { x: 0, y: 0 })).not.toThrow();
  });
});

describe('commitLayout', () => {
  it('writes every position in one update', () => {
    const ydoc = doc();
    let updates = 0;
    ydoc.on('update', () => {
      updates += 1;
    });

    commitLayout(
      ydoc,
      new Map([
        ['a', { x: 0, y: 0 }],
        ['b', { x: 100, y: 0 }],
      ]),
      'layout',
    );

    expect(updates).toBe(1);
    expect(readPlanDoc(ydoc).doc.nodes.find((n) => n.slug === 'b')?.position).toEqual({
      x: 100,
      y: 0,
    });
  });

  it('does not pin what it placed, so the next layout may move it again', () => {
    const ydoc = doc();
    commitLayout(ydoc, new Map([['a', { x: 5, y: 5 }]]), 'layout');
    expect(readPlanDoc(ydoc).doc.nodes.find((n) => n.slug === 'a')?.pinned).toBe(false);
  });
});

describe('nodeBodyText', () => {
  it('returns the shared text so edits merge', () => {
    const ydoc = doc();
    const text = nodeBodyText(ydoc, 'a');
    text?.insert(0, 'hello');
    expect(readPlanDoc(ydoc).doc.nodes.find((n) => n.slug === 'a')?.body).toBe('hello');
  });
});

describe('presenceColor', () => {
  it('is stable for a user and spread across the palette', () => {
    expect(presenceColor('user-1')).toBe(presenceColor('user-1'));
    const colors = new Set(['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h'].map(presenceColor));
    expect(colors.size).toBeGreaterThan(1);
  });
});
