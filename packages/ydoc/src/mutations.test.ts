import * as Y from 'yjs';
import { describe, expect, it } from 'vitest';
import { WAYPOINT_MAX, planDocSchema } from '@schematic/schema';

import { applyOps, initializePlan, readPlanDoc } from './bind.js';
import {
  commentBodyText,
  commitCommentPosition,
  commitEdgeRoute,
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

describe('commitEdgeRoute', () => {
  it('stores the corners, rounded, in the order given', () => {
    const { ydoc, id } = lined();
    commitEdgeRoute(ydoc, id, [
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
    commitEdgeRoute(ydoc, id, [{ x: 10, y: 10 }]);
    commitEdgeRoute(ydoc, id, []);
    expect(readPlanDoc(ydoc).doc.edges[0]?.waypoints).toEqual([]);
  });

  it('writes the route and the writing on it in one go', () => {
    const { ydoc, id } = lined();
    commitEdgeRoute(ydoc, id, [{ x: 40, y: 0 }], { x: 44, y: 12 });

    const edge = readPlanDoc(ydoc).doc.edges[0];
    expect(edge?.waypoints).toEqual([{ x: 40, y: 0 }]);
    expect(edge?.labelPosition).toEqual({ x: 44, y: 12 });
  });

  it('leaves the writing where it is when it is not given one', () => {
    const { ydoc, id } = lined();
    commitEdgeRoute(ydoc, id, [{ x: 40, y: 0 }], { x: 44, y: 12 });
    commitEdgeRoute(ydoc, id, [{ x: 90, y: 0 }]);
    expect(readPlanDoc(ydoc).doc.edges[0]?.labelPosition).toEqual({ x: 44, y: 12 });
  });

  it('ignores a line that is no longer there', () => {
    const { ydoc } = lined();
    expect(() => commitEdgeRoute(ydoc, 'gone', [{ x: 0, y: 0 }])).not.toThrow();
  });
});

/**
 * The writing on a line is carried by the ends that moved. The route is not: a
 * run somebody placed stays where they put it, and the renderer pins the corners
 * that touch a card to the new handle heights.
 */
describe('nudgeEdges', () => {
  it('moves the writing by the average of both ends', () => {
    const { ydoc, id } = lined();
    commitLayout(ydoc, new Map(), 'test', undefined, new Map([[id, { x: 100, y: 100 }]]));

    // Only one end moves, so the writing goes half as far.
    nudgeEdges(ydoc, new Map([['a', { x: 40, y: 0 }]]), 'test');

    expect(readPlanDoc(ydoc).doc.edges[0]?.labelPosition).toEqual({ x: 120, y: 100 });
  });

  it('leaves the route alone', () => {
    const { ydoc, id } = lined();
    commitEdgeRoute(ydoc, id, [
      { x: 100, y: 0 },
      { x: 100, y: 200 },
    ]);

    nudgeEdges(ydoc, new Map([['a', { x: 400, y: 0 }]]), 'test');

    expect(readPlanDoc(ydoc).doc.edges[0]?.waypoints).toEqual([
      { x: 100, y: 0 },
      { x: 100, y: 200 },
    ]);
  });

  it('leaves a line alone when neither of its ends moved', () => {
    const { ydoc, id } = lined();
    commitEdgeRoute(ydoc, id, [{ x: 10, y: 10 }], { x: 10, y: 10 });
    nudgeEdges(ydoc, new Map([['elsewhere', { x: 50, y: 50 }]]), 'test');

    const edge = readPlanDoc(ydoc).doc.edges[0];
    expect(edge?.waypoints).toEqual([{ x: 10, y: 10 }]);
    expect(edge?.labelPosition).toEqual({ x: 10, y: 10 });
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

/**
 * An over-long list is not a drawing mistake, it is a lost edge.
 *
 * `planEdgeSchema` caps waypoints, and the projection parses the whole document:
 * write one bend too many and the edge stops parsing, disappears from the read
 * model, and the line is gone from the canvas with no way back. A UI bug did
 * exactly that — every pointer move appended instead of replacing — so the write
 * itself refuses rather than trusting its callers.
 */
describe('commitEdgeRoute against a caller that has lost count', () => {
  it('keeps the line rather than writing a list that would delete it', () => {
    const { ydoc, id } = lined();
    const far = Array.from({ length: WAYPOINT_MAX + 12 }, (_, at) => ({ x: at * 10, y: at * 10 }));
    commitEdgeRoute(ydoc, id, far);

    const edge = readPlanDoc(ydoc).doc.edges[0];
    expect(edge).toBeDefined();
    expect(edge?.waypoints).toHaveLength(WAYPOINT_MAX);
    // The ones kept are the first, so the line still runs the way it was drawn.
    expect(edge?.waypoints[0]).toEqual({ x: 0, y: 0 });
  });

  it('leaves a list within the cap exactly as given', () => {
    const { ydoc, id } = lined();
    const few = [
      { x: 10, y: 10 },
      { x: 20, y: 20 },
    ];
    commitEdgeRoute(ydoc, id, few);
    expect(readPlanDoc(ydoc).doc.edges[0]?.waypoints).toEqual(few);
  });
});
