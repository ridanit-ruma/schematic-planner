import { describe, expect, it } from 'vitest';

import { diffPlans } from './changes.js';
import { applyPlanOps } from './ops.js';
import { emptyPlanDoc } from './plan.js';
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
