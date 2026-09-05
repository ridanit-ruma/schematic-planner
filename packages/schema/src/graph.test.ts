import { describe, expect, it } from 'vitest';

import { buildPlanGraph, containmentDepth, topologicalOrder } from './graph.js';
import { makeDoc } from './fixtures.js';

describe('buildPlanGraph', () => {
  it('separates containment from dependency', () => {
    const doc = makeDoc(
      [{ slug: 'root' }, { slug: 'db' }, { slug: 'auth' }],
      [
        { kind: 'contains', from: 'root', to: 'db' },
        { kind: 'contains', from: 'root', to: 'auth' },
        { kind: 'depends_on', from: 'auth', to: 'db' },
      ],
    );
    const graph = buildPlanGraph(doc);

    expect(graph.roots).toEqual(['root']);
    expect(graph.childrenOf.get('root')).toEqual(['auth', 'db']);
    expect(graph.dependenciesOf.get('auth')).toEqual(['db']);
    expect(graph.dependentsOf.get('db')).toEqual(['auth']);
    expect(graph.parentOf.get('db')).toBe('root');
  });

  it('reports containment depth', () => {
    const doc = makeDoc(
      [{ slug: 'a' }, { slug: 'b' }, { slug: 'c' }],
      [
        { kind: 'contains', from: 'a', to: 'b' },
        { kind: 'contains', from: 'b', to: 'c' },
      ],
    );
    const graph = buildPlanGraph(doc);

    expect(containmentDepth(graph, 'a')).toBe(0);
    expect(containmentDepth(graph, 'c')).toBe(2);
  });
});

describe('topologicalOrder', () => {
  it('places dependencies before the nodes that need them', () => {
    const doc = makeDoc(
      [{ slug: 'auth' }, { slug: 'db' }, { slug: 'ui' }],
      [
        { kind: 'depends_on', from: 'auth', to: 'db' },
        { kind: 'depends_on', from: 'ui', to: 'auth' },
      ],
    );
    const { order, cycles } = topologicalOrder(
      ['auth', 'db', 'ui'],
      buildPlanGraph(doc).dependenciesOf,
    );

    expect(order).toEqual(['db', 'auth', 'ui']);
    expect(cycles).toEqual([]);
  });

  it('breaks ties alphabetically so exports are reproducible', () => {
    const doc = makeDoc([{ slug: 'zebra' }, { slug: 'apple' }, { slug: 'mango' }]);
    const { order } = topologicalOrder(
      ['zebra', 'apple', 'mango'],
      buildPlanGraph(doc).dependenciesOf,
    );

    expect(order).toEqual(['apple', 'mango', 'zebra']);
  });

  it('ignores dependencies that point outside the requested scope', () => {
    const doc = makeDoc(
      [{ slug: 'a' }, { slug: 'b' }, { slug: 'outside' }],
      [
        { kind: 'depends_on', from: 'a', to: 'outside' },
        { kind: 'depends_on', from: 'b', to: 'a' },
      ],
    );
    const { order } = topologicalOrder(['a', 'b'], buildPlanGraph(doc).dependenciesOf);

    expect(order).toEqual(['a', 'b']);
  });

  it('still emits every node when a cycle is present, and names the cycle', () => {
    const doc = makeDoc(
      [{ slug: 'a' }, { slug: 'b' }, { slug: 'safe' }],
      [
        { kind: 'depends_on', from: 'a', to: 'b' },
        { kind: 'depends_on', from: 'b', to: 'a' },
      ],
    );
    const { order, cycles } = topologicalOrder(
      ['a', 'b', 'safe'],
      buildPlanGraph(doc).dependenciesOf,
    );

    expect(order).toEqual(['safe', 'a', 'b']);
    expect(cycles).toEqual([['a', 'b']]);
  });
});
