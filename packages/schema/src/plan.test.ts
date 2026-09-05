import { describe, expect, it } from 'vitest';

import { makeDoc } from './fixtures.js';
import { edgeId, normalizeEdge, planDocSchema, planEdgeInputSchema } from './plan.js';

/** Issue messages joined, so assertions read the human text rather than JSON. */
function messages(result: { success: boolean; error?: { issues: { message: string }[] } }) {
  return (result.error?.issues ?? []).map((issue) => issue.message).join(' | ');
}

function parseDoc(nodes: unknown[], edges: unknown[] = []) {
  return planDocSchema.safeParse({
    id: 'plan-test',
    title: 'Test plan',
    updatedAt: '2026-01-01T00:00:00.000Z',
    nodes,
    edges,
  });
}

describe('planDocSchema', () => {
  it('applies defaults to a minimal node', () => {
    const doc = makeDoc([{ slug: 'db', title: 'Database' }]);
    expect(doc.nodes[0]).toMatchObject({
      kind: 'task',
      status: 'idea',
      position: null,
      pinned: false,
      tags: [],
    });
  });

  it('rejects duplicate slugs', () => {
    const result = parseDoc([
      { slug: 'db', title: 'One' },
      { slug: 'db', title: 'Two' },
    ]);
    expect(result.success).toBe(false);
    expect(messages(result)).toContain('duplicate node slug');
  });

  it('rejects an edge pointing at a node that does not exist', () => {
    const result = parseDoc(
      [{ slug: 'db', title: 'Database' }],
      [{ id: 'e1', kind: 'depends_on', from: 'db', to: 'ghost' }],
    );
    expect(result.success).toBe(false);
    expect(messages(result)).toContain('unknown node "ghost"');
  });

  it('rejects a self edge', () => {
    const result = parseDoc(
      [{ slug: 'db', title: 'Database' }],
      [{ id: 'e1', kind: 'depends_on', from: 'db', to: 'db' }],
    );
    expect(result.success).toBe(false);
    expect(messages(result)).toContain('to itself');
  });

  it('rejects a node contained by two parents', () => {
    const result = parseDoc(
      [
        { slug: 'a', title: 'A' },
        { slug: 'b', title: 'B' },
        { slug: 'c', title: 'C' },
      ],
      [
        { id: 'e1', kind: 'contains', from: 'a', to: 'c' },
        { id: 'e2', kind: 'contains', from: 'b', to: 'c' },
      ],
    );
    expect(result.success).toBe(false);
    expect(messages(result)).toContain('already contained by');
  });

  it('rejects a containment cycle', () => {
    const result = parseDoc(
      [
        { slug: 'a', title: 'A' },
        { slug: 'b', title: 'B' },
      ],
      [
        { id: 'e1', kind: 'contains', from: 'a', to: 'b' },
        { id: 'e2', kind: 'contains', from: 'b', to: 'a' },
      ],
    );
    expect(result.success).toBe(false);
    expect(messages(result)).toContain('containment cycle');
  });

  it('accepts a dependency cycle, which export breaks rather than rejects', () => {
    const result = parseDoc(
      [
        { slug: 'a', title: 'A' },
        { slug: 'b', title: 'B' },
      ],
      [
        { id: 'e1', kind: 'depends_on', from: 'a', to: 'b' },
        { id: 'e2', kind: 'depends_on', from: 'b', to: 'a' },
      ],
    );
    expect(result.success).toBe(true);
  });

  it('rejects a slug that is not lowercase-hyphenated', () => {
    expect(parseDoc([{ slug: 'Auth Service', title: 'x' }]).success).toBe(false);
  });
});

describe('edge identity', () => {
  it('derives the same id for the same relationship', () => {
    const a = normalizeEdge(planEdgeInputSchema.parse({ from: 'auth', to: 'db' }));
    const b = normalizeEdge(planEdgeInputSchema.parse({ from: 'auth', to: 'db' }));
    expect(a.id).toBe(b.id);
    expect(a.id).toBe(edgeId('depends_on', 'auth', 'db'));
  });

  it('keeps an explicit id when one is supplied', () => {
    const edge = normalizeEdge(planEdgeInputSchema.parse({ id: 'custom', from: 'a', to: 'b' }));
    expect(edge.id).toBe('custom');
  });
});
