import { describe, expect, it } from 'vitest';

import { diffPlans } from './changes.js';
import { applyPlanOps } from './ops.js';
import { emptyPlanDoc, planDocSchema } from './plan.js';
import type { PlanDoc } from './plan.js';

function plan(): PlanDoc {
  return applyPlanOps(emptyPlanDoc('p', 'Plan'), [
    { op: 'upsert_node', node: { slug: 'alpha', title: 'Alpha', position: { x: 0, y: 0 } } },
    { op: 'upsert_node', node: { slug: 'beta', title: 'Beta', position: { x: 10, y: 0 } } },
    { op: 'upsert_edge', edge: { kind: 'depends_on', from: 'beta', to: 'alpha', label: null, via: null, carries: null } },
  ]);
}

const kinds = (before: PlanDoc, after: PlanDoc): string[] =>
  diffPlans(before, after).map((entry) => entry.kind);

describe('diffPlans', () => {
  it('reports nothing when nothing changed', () => {
    expect(diffPlans(plan(), plan())).toEqual([]);
  });

  it('names what was added and what went', () => {
    const after = applyPlanOps(plan(), [
      { op: 'upsert_node', node: { slug: 'gamma', title: 'Gamma' } },
      { op: 'delete_node', slug: 'beta' },
    ]);
    const entries = diffPlans(plan(), after);
    expect(entries).toContainEqual({ kind: 'node.added', subject: 'gamma', label: 'Gamma', detail: null });
    expect(entries).toContainEqual({ kind: 'node.removed', subject: 'beta', label: 'Beta', detail: null });
  });

  it('keeps the name a node had when it was renamed', () => {
    const after = applyPlanOps(plan(), [
      { op: 'upsert_node', node: { slug: 'alpha', title: 'Alpha prime' } },
    ]);
    expect(diffPlans(plan(), after)).toContainEqual({
      kind: 'node.renamed',
      subject: 'alpha',
      label: 'Alpha prime',
      detail: 'Alpha',
    });
  });

  it('says what a status became', () => {
    const after = applyPlanOps(plan(), [
      { op: 'upsert_node', node: { slug: 'alpha', title: 'Alpha', status: 'done' } },
    ]);
    expect(diffPlans(plan(), after)).toContainEqual({
      kind: 'node.status',
      subject: 'alpha',
      label: 'Alpha',
      detail: 'idea → done',
    });
  });

  it('reads a connection by the names at either end', () => {
    const after = applyPlanOps(plan(), [
      { op: 'delete_edge', kind: 'depends_on', from: 'beta', to: 'alpha' },
    ]);
    const [entry] = diffPlans(plan(), after);
    expect(entry?.kind).toBe('edge.removed');
    expect(entry?.label).toBe('Beta → Alpha');
  });

  it('summarises moving rather than listing every coordinate', () => {
    const before = plan();
    const after: PlanDoc = {
      ...before,
      nodes: before.nodes.map((node) => ({ ...node, position: { x: 500, y: 500 } })),
    };
    expect(diffPlans(before, after)).toEqual([
      { kind: 'plan.arranged', subject: '', label: 'Plan', detail: '2' },
    ]);
  });

  it('does not call an edit a move', () => {
    const after = applyPlanOps(plan(), [
      { op: 'upsert_node', node: { slug: 'alpha', title: 'Alpha', body: 'Now with a body.' } },
    ]);
    expect(kinds(plan(), after)).toEqual(['node.body']);
  });
});

/** The plan with one note on it, asking something. */
const asked = (body: string): PlanDoc =>
  applyPlanOps(plan(), [{ op: 'upsert_comment', comment: { id: 'ask', body, anchor: 'alpha' } }]);

describe('a note whose boxes were ticked', () => {
  it('is recorded as answered rather than rewritten', () => {
    const before = asked('- [ ] Postgres\n- [ ] Redis');
    const after = applyPlanOps(before, [
      { op: 'upsert_comment', comment: { id: 'ask', body: '- [x] Postgres\n- [ ] Redis' } },
    ]);
    expect(kinds(before, after)).toEqual(['note.answered']);
  });

  it('is still an edit when the words changed as well', () => {
    const before = asked('- [ ] Postgres');
    const after = applyPlanOps(before, [
      { op: 'upsert_comment', comment: { id: 'ask', body: '- [x] Postgres, probably' } },
    ]);
    expect(kinds(before, after)).toEqual(['note.edited']);
  });
});

describe('changing a node identifier', () => {
  const plan = (slug: string) =>
    planDocSchema.parse({
      id: 'p',
      title: 'P',
      updatedAt: '2026-01-01T00:00:00.000Z',
      nodes: [{ slug, title: 'Auth', body: 'signs people in' }],
    });

  it('reads as a readdressing rather than as a loss', () => {
    const entries = diffPlans(plan('old'), plan('fresh'));

    expect(entries).toEqual([
      { kind: 'node.identifier', subject: 'fresh', label: 'Auth', detail: 'old' },
    ]);
  });

  it('is still a removal when the node did not come back', () => {
    const gone = planDocSchema.parse({
      id: 'p',
      title: 'P',
      updatedAt: '2026-01-01T00:00:00.000Z',
      nodes: [],
    });
    expect(diffPlans(plan('old'), gone).map((entry) => entry.kind)).toEqual(['node.removed']);
  });

  it('is a removal and an addition when the node also changed', () => {
    const changed = planDocSchema.parse({
      id: 'p',
      title: 'P',
      updatedAt: '2026-01-01T00:00:00.000Z',
      nodes: [{ slug: 'fresh', title: 'Sessions', body: 'signs people in' }],
    });
    expect(diffPlans(plan('old'), changed).map((entry) => entry.kind).sort()).toEqual([
      'node.added',
      'node.removed',
    ]);
  });
});
