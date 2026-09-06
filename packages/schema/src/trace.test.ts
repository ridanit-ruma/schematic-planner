import { describe, expect, it } from 'vitest';

import { applyPlanOps } from './ops.js';
import { emptyPlanDoc } from './plan.js';
import { findNode, tracePlan } from './trace.js';
import type { PlanDoc } from './plan.js';

/** A request that reaches a store and comes back, which is the ordinary shape. */
function system(): PlanDoc {
  return applyPlanOps(emptyPlanDoc('p', 'System'), [
    { op: 'upsert_node', node: { slug: 'login-page', title: 'Login page', tags: ['ui'] } },
    { op: 'upsert_node', node: { slug: 'login-api', title: 'POST /api/login' } },
    { op: 'upsert_node', node: { slug: 'users', title: 'users table' } },
    { op: 'upsert_node', node: { slug: 'workspace-page', title: 'Workspace page' } },
    {
      op: 'upsert_edge',
      edge: { kind: 'flows_to', from: 'login-page', to: 'login-api', label: null, via: 'click Sign in', carries: '{ email, password }' },
    },
    { op: 'upsert_edge', edge: { kind: 'flows_to', from: 'login-api', to: 'users', label: null, via: 'select by email', carries: null } },
    { op: 'upsert_edge', edge: { kind: 'flows_to', from: 'users', to: 'login-api', label: null, via: null, carries: '{ id, hash }' } },
    { op: 'upsert_edge', edge: { kind: 'flows_to', from: 'login-api', to: 'login-page', label: null, via: null, carries: '{ token }' } },
    { op: 'upsert_edge', edge: { kind: 'flows_to', from: 'login-page', to: 'workspace-page', label: null, via: 'navigate', carries: null } },
  ]);
}

const start = (doc: PlanDoc, slug: string) => doc.nodes.find((node) => node.slug === slug)!;

describe('findNode', () => {
  it('takes a slug first', () => {
    expect(findNode(system(), 'login-api')?.slug).toBe('login-api');
  });

  it('then an exact title', () => {
    expect(findNode(system(), 'POST /api/login')?.slug).toBe('login-api');
  });

  it('then part of a title, or a tag', () => {
    expect(findNode(system(), 'workspace')?.slug).toBe('workspace-page');
    expect(findNode(system(), 'ui')?.slug).toBe('login-page');
  });

  it('reports nothing rather than guessing', () => {
    expect(findNode(system(), 'nothing like this')).toBeNull();
  });
});

describe('tracePlan', () => {
  it('follows the flow out of a node', () => {
    const doc = system();
    const result = tracePlan(doc, start(doc, 'login-page'));
    const reached = result.reached.map((node) => node.slug);
    expect(reached).toContain('login-api');
    expect(reached).toContain('users');
    expect(reached).toContain('workspace-page');
  });

  it('carries what set each step off and what it took along', () => {
    const doc = system();
    const [path] = tracePlan(doc, start(doc, 'login-page'), { depth: 1 }).paths;
    const step = path?.steps[1];
    expect(step?.along?.via).toBe('click Sign in');
    expect(step?.along?.carries).toBe('{ email, password }');
  });

  it('stops a branch that comes back on itself, without dropping it', () => {
    const doc = system();
    const result = tracePlan(doc, start(doc, 'login-page'));
    const revisiting = result.paths
      .flatMap((path) => path.steps)
      .filter((step) => step.revisits)
      .map((step) => step.node.slug);
    expect(revisiting).toContain('login-page');
  });

  it('walks the other way when asked', () => {
    const doc = system();
    const result = tracePlan(doc, start(doc, 'users'), { direction: 'upstream' });
    expect(result.reached.map((node) => node.slug)).toContain('login-page');
  });

  it('says so when it stopped at its budget', () => {
    const doc = system();
    expect(tracePlan(doc, start(doc, 'login-page'), { budget: 2 }).truncated).toBe(true);
    expect(tracePlan(doc, start(doc, 'login-page')).truncated).toBe(false);
  });

  it('ignores everything that is not a flow', () => {
    const doc = applyPlanOps(system(), [
      { op: 'upsert_node', node: { slug: 'unrelated', title: 'Unrelated' } },
      { op: 'upsert_edge', edge: { kind: 'depends_on', from: 'login-page', to: 'unrelated', label: null, via: null, carries: null } },
      { op: 'upsert_edge', edge: { kind: 'contains', from: 'login-page', to: 'unrelated', label: null, via: null, carries: null } },
    ]);
    const result = tracePlan(doc, start(doc, 'login-page'));
    expect(result.reached.map((node) => node.slug)).not.toContain('unrelated');
  });
});
