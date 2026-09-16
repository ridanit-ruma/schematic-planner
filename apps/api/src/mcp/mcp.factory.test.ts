import { describe, expect, it } from 'vitest';
import { planDocSchema, planOpsSchema } from '@schematic/schema';

import { doubledFlows } from './mcp.factory.js';

/**
 * The one write that quietly draws the wrong thing: a flow is identified by
 * what sets it off, so redrawing a pair with a corrected trigger adds a second
 * line instead of changing the first.
 */
describe('a batch that leaves two flows between one pair', () => {
  const twice = planDocSchema.parse({
    id: 'p1',
    title: 'Twice',
    updatedAt: '2026-01-01T00:00:00.000Z',
    nodes: [
      { slug: 'form', title: 'Form' },
      { slug: 'api', title: 'API' },
    ],
    edges: [
      { id: 'a', kind: 'flows_to', from: 'form', to: 'api', via: 'click Save' },
      { id: 'b', kind: 'flows_to', from: 'form', to: 'api', via: 'click Submit' },
    ],
  });

  const drew = (via: string) =>
    planOpsSchema.parse([
      { op: 'upsert_edge', edge: { kind: 'flows_to', from: 'form', to: 'api', via } },
    ]);

  it('says so, naming both triggers', () => {
    const said = doubledFlows(twice, drew('click Submit'));
    expect(said).toContain('form --> api');
    expect(said).toContain('"click Save"');
    expect(said).toContain('"click Submit"');
    expect(said).toContain('delete_edge');
  });

  it('says nothing about a pair with one flow', () => {
    const once = planDocSchema.parse({
      id: 'p2',
      title: 'Once',
      updatedAt: '2026-01-01T00:00:00.000Z',
      nodes: [
        { slug: 'form', title: 'Form' },
        { slug: 'api', title: 'API' },
      ],
      edges: [{ id: 'a', kind: 'flows_to', from: 'form', to: 'api', via: 'click Save' }],
    });
    expect(doubledFlows(once, drew('click Save'))).toBe('');
  });

  it('says nothing about a pair this batch did not draw', () => {
    const elsewhere = planOpsSchema.parse([
      { op: 'upsert_node', node: { slug: 'form', title: 'Form' } },
    ]);
    expect(doubledFlows(twice, elsewhere)).toBe('');
  });

  it('names a flow with no trigger as having none', () => {
    const bare = planDocSchema.parse({
      id: 'p3',
      title: 'Bare',
      updatedAt: '2026-01-01T00:00:00.000Z',
      nodes: [
        { slug: 'form', title: 'Form' },
        { slug: 'api', title: 'API' },
      ],
      edges: [
        { id: 'a', kind: 'flows_to', from: 'form', to: 'api', via: null },
        { id: 'b', kind: 'flows_to', from: 'form', to: 'api', via: 'click Save' },
      ],
    });
    expect(doubledFlows(bare, drew('click Save'))).toContain('no trigger');
  });
});
