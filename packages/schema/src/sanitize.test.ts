import { describe, expect, it } from 'vitest';

import { planDocSchema } from './plan.js';
import { sanitizePlanDoc } from './sanitize.js';

const node = (slug: string) => ({ slug, title: slug });

describe('sanitizePlanDoc', () => {
  it('keeps a healthy document intact', () => {
    const { doc, dropped } = sanitizePlanDoc({
      id: 'p1',
      title: 'Plan',
      nodes: [node('a'), node('b')],
      edges: [{ id: 'e1', kind: 'depends_on', from: 'a', to: 'b', label: null }],
    });

    expect(dropped).toEqual([]);
    expect(planDocSchema.safeParse(doc).success).toBe(true);
  });

  it('drops an edge left dangling by a concurrent node delete', () => {
    const { doc, dropped } = sanitizePlanDoc({
      id: 'p1',
      title: 'Plan',
      nodes: [node('a')],
      edges: [{ id: 'e1', kind: 'depends_on', from: 'a', to: 'gone', label: null }],
    });

    expect(doc.edges).toEqual([]);
    expect(dropped[0]).toContain('endpoint missing');
  });

  it('keeps the first parent when two clients nest the same node', () => {
    const { doc, dropped } = sanitizePlanDoc({
      id: 'p1',
      title: 'Plan',
      nodes: [node('a'), node('b'), node('c')],
      edges: [
        { id: 'e1', kind: 'contains', from: 'a', to: 'c', label: null },
        { id: 'e2', kind: 'contains', from: 'b', to: 'c', label: null },
      ],
    });

    expect(doc.edges.map((e) => e.id)).toEqual(['e1']);
    expect(dropped[0]).toContain('already inside');
  });

  it('breaks a containment cycle assembled concurrently', () => {
    const { doc } = sanitizePlanDoc({
      id: 'p1',
      title: 'Plan',
      nodes: [node('a'), node('b')],
      edges: [
        { id: 'e1', kind: 'contains', from: 'a', to: 'b', label: null },
        { id: 'e2', kind: 'contains', from: 'b', to: 'a', label: null },
      ],
    });

    expect(doc.edges.map((e) => e.id)).toEqual(['e1']);
    expect(planDocSchema.safeParse(doc).success).toBe(true);
  });

  it('always returns something a strict parse accepts', () => {
    const { doc } = sanitizePlanDoc({
      id: 'p1',
      title: '',
      nodes: [node('a'), node('a'), { slug: 'NOT A SLUG', title: 'x' }],
      edges: [{ nonsense: true }],
    });

    expect(doc.title).toBe('Untitled plan');
    expect(doc.nodes).toHaveLength(1);
    expect(planDocSchema.safeParse(doc).success).toBe(true);
  });
});
