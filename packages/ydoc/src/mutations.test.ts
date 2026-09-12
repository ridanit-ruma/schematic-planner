import * as Y from 'yjs';
import { describe, expect, it } from 'vitest';
import { planDocSchema } from '@schematic/schema';

import { applyOps, initializePlan, readPlanDoc } from './bind.js';
import {
  commentBodyText,
  commitCommentPosition,
  commitEdgeWaypoints,
  commitLayout,
  commitNodePosition,
  nodeBodyText,
  nudgeEdges,
} from './mutations.js';
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

/** A plan with one line between its two nodes, for bending. */
function lined() {
  const ydoc = doc();
  applyOps(ydoc, [
    { op: 'upsert_edge', edge: { kind: 'flows_to', from: 'a', to: 'b', label: 'goes' } },
  ]);
  const id = readPlanDoc(ydoc).doc.edges[0]!.id;
  return { ydoc, id };
}

describe('commitEdgeWaypoints', () => {
  it('stores the bends, rounded, in the order given', () => {
    const { ydoc, id } = lined();
    commitEdgeWaypoints(ydoc, id, [
      { x: 10.4, y: 20.6 },
      { x: 30.5, y: 40.2 },
    ]);

    expect(readPlanDoc(ydoc).doc.edges[0]?.waypoints).toEqual([
      { x: 10, y: 21 },
      { x: 31, y: 40 },
    ]);
  });

  it('straightens a line when given none', () => {
    const { ydoc, id } = lined();
    commitEdgeWaypoints(ydoc, id, [{ x: 10, y: 10 }]);
    commitEdgeWaypoints(ydoc, id, []);
    expect(readPlanDoc(ydoc).doc.edges[0]?.waypoints).toEqual([]);
  });

  it('ignores a line that is no longer there', () => {
    const { ydoc } = lined();
    expect(() => commitEdgeWaypoints(ydoc, 'gone', [{ x: 0, y: 0 }])).not.toThrow();
  });
});

/**
 * A point placed along a line is carried by the ends that moved, weighted by how
 * far along it sits. The rule has to keep agreeing with the one the writing
 * already followed, which sat at the halfway mark.
 */
describe('nudgeEdges', () => {
  it('moves a single bend by the average of both ends, as the writing does', () => {
    const { ydoc, id } = lined();
    commitEdgeWaypoints(ydoc, id, [{ x: 100, y: 100 }]);
    commitLayout(ydoc, new Map(), 'test', undefined, new Map([[id, { x: 100, y: 100 }]]));

    // Only one end moves, so both the bend and the writing go half as far.
    nudgeEdges(ydoc, new Map([['a', { x: 40, y: 0 }]]), 'test');

    const edge = readPlanDoc(ydoc).doc.edges[0];
    expect(edge?.waypoints).toEqual([{ x: 120, y: 100 }]);
    expect(edge?.labelPosition).toEqual({ x: 120, y: 100 });
  });

  it('pulls each bend towards whichever end it is nearer', () => {
    const { ydoc, id } = lined();
    commitEdgeWaypoints(ydoc, id, [
      { x: 0, y: 0 },
      { x: 0, y: 0 },
      { x: 0, y: 0 },
    ]);
    // The far end moves 400; the three bends sit a quarter, a half and three
    // quarters of the way along.
    nudgeEdges(ydoc, new Map([['b', { x: 400, y: 0 }]]), 'test');

    expect(readPlanDoc(ydoc).doc.edges[0]?.waypoints).toEqual([
      { x: 100, y: 0 },
      { x: 200, y: 0 },
      { x: 300, y: 0 },
    ]);
  });

  it('moves a bend the whole way when both ends go together', () => {
    const { ydoc, id } = lined();
    commitEdgeWaypoints(ydoc, id, [{ x: 10, y: 10 }]);
    nudgeEdges(ydoc, new Map([['a', { x: 5, y: 7 }], ['b', { x: 5, y: 7 }]]), 'test');
    expect(readPlanDoc(ydoc).doc.edges[0]?.waypoints).toEqual([{ x: 15, y: 17 }]);
  });

  /* A person put them there; nothing is entitled to decide they are stale. */
  it('never withdraws a bend', () => {
    const { ydoc, id } = lined();
    commitEdgeWaypoints(ydoc, id, [{ x: 10, y: 10 }]);
    nudgeEdges(ydoc, new Map([['a', { x: 900, y: 900 }]]), 'test');
    expect(readPlanDoc(ydoc).doc.edges[0]?.waypoints).toHaveLength(1);
  });

  it('leaves a line alone when neither of its ends moved', () => {
    const { ydoc, id } = lined();
    commitEdgeWaypoints(ydoc, id, [{ x: 10, y: 10 }]);
    nudgeEdges(ydoc, new Map([['elsewhere', { x: 50, y: 50 }]]), 'test');
    expect(readPlanDoc(ydoc).doc.edges[0]?.waypoints).toEqual([{ x: 10, y: 10 }]);
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

function plan(): Y.Doc {
  const ydoc = new Y.Doc();
  initializePlan(
    ydoc,
    planDocSchema.parse({
      id: 'plan-1',
      title: 'Plan',
      updatedAt: '2026-01-01T00:00:00.000Z',
      nodes: [{ slug: 'api', title: 'API' }],
    }),
  );
  return ydoc;
}

describe('notes in the shared document', () => {
  it('survives the round trip through the CRDT', () => {
    const doc = plan();
    applyOps(doc, [
      {
        op: 'upsert_comment',
        comment: { id: 'why-here', body: 'Why Postgres?', anchor: 'api', author: 'Ruma' },
      },
    ]);

    const [note] = readPlanDoc(doc).doc.comments;
    expect(note?.body).toBe('Why Postgres?');
    expect(note?.anchor).toBe('api');
    expect(note?.author).toBe('Ruma');
  });

  /* Two people typing into the same note merge, which is only true while the
     body stays one Y.Text rather than being replaced on each write. */
  it('keeps the body as shared text across a rewrite', () => {
    const doc = plan();
    applyOps(doc, [{ op: 'upsert_comment', comment: { id: 'n', body: 'first' } }]);
    const text = commentBodyText(doc, 'n');
    applyOps(doc, [{ op: 'upsert_comment', comment: { id: 'n', body: 'second' } }]);

    expect(commentBodyText(doc, 'n')).toBe(text);
    expect(text?.toString()).toBe('second');
  });

  it('moves where it is put, and nowhere else', () => {
    const doc = plan();
    applyOps(doc, [{ op: 'upsert_comment', comment: { id: 'n', body: 'here' } }]);
    commitCommentPosition(doc, 'n', { x: 12.4, y: -3.8 });

    expect(readPlanDoc(doc).doc.comments[0]?.position).toEqual({ x: 12, y: -4 });
  });
});
