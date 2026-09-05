import { describe, expect, it } from 'vitest';
import { buildPlanGraph } from '@schematic/schema';

import { toCanvas, type Canvas } from './canvas.js';
import { exportPlan } from './bundle.js';
import { assignPaths } from './paths.js';
import { samplePlan } from './fixtures.js';

function canvasOf(): Canvas {
  const doc = samplePlan();
  const graph = buildPlanGraph(doc);
  return toCanvas(doc, graph, assignPaths(doc, graph).fileOf);
}

describe('toCanvas', () => {
  it('emits one file node per plan node, pointing at the exported markdown', () => {
    const canvas = canvasOf();
    expect(canvas.nodes).toHaveLength(5);
    expect(canvas.nodes.find((n) => n.id === 'auth')).toMatchObject({
      type: 'file',
      file: '01-foundation/02-auth.md',
      color: '3',
    });
  });

  it('keeps coordinates that already exist and places the rest deterministically', () => {
    const canvas = canvasOf();
    expect(canvas.nodes.find((n) => n.id === 'canvas')).toMatchObject({ x: 120, y: 40 });

    const unplaced = canvas.nodes.filter((n) => n.id !== 'canvas');
    expect(unplaced.every((n) => Number.isFinite(n.x) && Number.isFinite(n.y))).toBe(true);
    expect(new Set(unplaced.map((n) => `${n.x},${n.y}`)).size).toBe(unplaced.length);
  });

  it('draws dependency edges in build order', () => {
    const edge = canvasOf().edges.find((e) => e.id === 'depends_on:auth>database');
    expect(edge).toMatchObject({ fromNode: 'database', toNode: 'auth' });
  });

  it('draws containment top to bottom', () => {
    const edge = canvasOf().edges.find((e) => e.id === 'contains:foundation>auth');
    expect(edge).toMatchObject({ fromSide: 'bottom', toSide: 'top' });
  });

  it('is valid JSON in the bundle', () => {
    const content = exportPlan(samplePlan()).files.find((f) => f.path === 'plan.canvas')?.content;
    expect(() => JSON.parse(content ?? '')).not.toThrow();
  });
});
