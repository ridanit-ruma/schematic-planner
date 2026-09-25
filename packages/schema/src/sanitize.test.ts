import { describe, expect, it } from 'vitest';

import { planDocSchema } from './plan.js';
import { planDocFromSnapshot, sanitizePlanDoc } from './sanitize.js';

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

describe('a kind or status the project does not know', () => {
  const plan = (kind: string, status: string) => ({
    id: 'p1',
    title: 'Plan',
    nodes: [{ slug: 'a', title: 'A', kind, status }, node('b')],
    edges: [{ id: 'e1', kind: 'depends_on', from: 'a', to: 'b', label: null }],
  });

  it('is kept by sanitize rather than discarding the node', () => {
    const { doc, dropped } = sanitizePlanDoc(plan('spike', 'in-review'));
    expect(dropped).toEqual([]);
    expect(doc.nodes[0]).toMatchObject({ slug: 'a', kind: 'spike', status: 'in-review' });
    expect(doc.edges).toHaveLength(1);
  });

  it('passes the strict schema, so a stored snapshot is not read as empty', () => {
    const parsed = planDocSchema.safeParse({
      ...plan('spike', 'in-review'),
      updatedAt: new Date(0).toISOString(),
    });
    expect(parsed.success).toBe(true);
  });
});

describe('planDocFromSnapshot', () => {
  const fallback = { id: 'p1', title: 'Stored', description: 'kept' };

  it('reads a valid snapshot as it is', () => {
    const doc = planDocFromSnapshot(
      { id: 'p1', title: 'Plan', updatedAt: 'x', nodes: [node('a')], edges: [] },
      fallback,
    );
    expect(doc.title).toBe('Plan');
    expect(doc.nodes.map((one) => one.slug)).toEqual(['a']);
  });

  it('repairs a snapshot one bad node away from valid instead of emptying it', () => {
    const doc = planDocFromSnapshot(
      { title: 'Plan', nodes: [node('a'), { slug: 'Not A Slug', title: 'x' }], edges: [] },
      fallback,
    );
    expect(doc.nodes.map((one) => one.slug)).toEqual(['a']);
    expect(doc.description).toBe('kept');
  });

  it('falls back to an empty plan with the stored title for something unreadable', () => {
    const doc = planDocFromSnapshot(null, fallback);
    expect(doc).toMatchObject({ id: 'p1', title: 'Stored', nodes: [], edges: [] });
  });
});
