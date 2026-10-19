import { describe, expect, it } from 'vitest';
import { DEFAULT_VOCABULARY, planDocSchema } from '@schematic/schema';

import { exportPlan } from './bundle.js';
import { READY_LISTED, d2String, planDiagram, planSummary } from './fences.js';
import { samplePlan } from './fixtures.js';

const pathsOf = (doc = samplePlan()) => exportPlan(doc).files.map((file) => file.path);
const fileAt = (path: string, doc = samplePlan()) =>
  exportPlan(doc).files.find((file) => file.path === path)?.content ?? '';

describe('exportPlan', () => {
  it('folds containment into directories and dependency order into filenames', () => {
    expect(pathsOf()).toEqual([
      'README.md',
      '01-Foundation/README.md',
      '01-Foundation/01-Database.md',
      '01-Foundation/02-Auth.md',
      '02-Editor/README.md',
      '02-Editor/Canvas.md',
      'plan.canvas',
      'plan.md',
      'plan.json',
    ]);
  });

  it('writes a nested table of contents in the overview', () => {
    const readme = fileAt('README.md');
    expect(readme).toContain('# Schematic Planner');
    expect(readme).toContain('- [Foundation](01-Foundation/README.md)');
    expect(readme).toContain('  - [Database](01-Foundation/01-Database.md) — `done`');
  });

  it('lists contents in export order, not alphabetically', () => {
    const readme = fileAt('README.md');
    expect(readme.indexOf('01-Database.md')).toBeLessThan(readme.indexOf('02-Auth.md'));
    expect(readme.indexOf('01-Foundation/README.md')).toBeLessThan(
      readme.indexOf('02-Editor/README.md'),
    );
  });

  it('carries the graph in frontmatter so the bundle is self-describing', () => {
    const auth = fileAt('01-Foundation/02-Auth.md');
    expect(auth).toContain('slug: auth');
    expect(auth).toContain('status: in_progress');
    expect(auth).toContain('depends_on:\n  - database');
    expect(auth).toContain('title: Auth');
    expect(auth).toContain('Email and password first.');

    const foundation = fileAt('01-Foundation/README.md');
    expect(foundation).toContain('contains:');
    expect(foundation).toContain('  - auth');
  });

  it('writes position only for pinned nodes', () => {
    expect(fileAt('02-Editor/Canvas.md')).toContain('pinned: true');
    expect(fileAt('01-Foundation/01-Database.md')).not.toContain('position');
  });

  it('is deterministic', () => {
    expect(exportPlan(samplePlan())).toEqual(exportPlan(samplePlan()));
  });

  it('can omit the canvas and the json original', () => {
    const paths = exportPlan(samplePlan(), { canvas: false, planJson: false }).files.map(
      (f) => f.path,
    );
    expect(paths).not.toContain('plan.canvas');
    expect(paths).not.toContain('plan.json');
  });

  it('exports an empty plan without crashing', () => {
    const empty = planDocSchema.parse({
      id: 'plan-empty',
      title: 'Empty',
      updatedAt: '2026-01-01T00:00:00.000Z',
    });
    const bundle = exportPlan(empty);
    expect(bundle.files.map((f) => f.path)).toEqual([
      'README.md',
      'plan.canvas',
      'plan.md',
      'plan.json',
    ]);
    expect(bundle.files[0]?.content).toContain('_This plan has no nodes yet._');
  });

  it('breaks a dependency cycle, warns, and still exports every node', () => {
    const doc = planDocSchema.parse({
      id: 'plan-cycle',
      title: 'Cycle',
      updatedAt: '2026-01-01T00:00:00.000Z',
      nodes: [
        { slug: 'a', title: 'A' },
        { slug: 'b', title: 'B' },
      ],
      edges: [
        { id: 'e1', kind: 'depends_on', from: 'a', to: 'b' },
        { id: 'e2', kind: 'depends_on', from: 'b', to: 'a' },
      ],
    });
    const bundle = exportPlan(doc);

    expect(bundle.warnings).toHaveLength(1);
    expect(bundle.warnings[0]).toContain('dependency cycle between a, b');
    expect(bundle.files.map((f) => f.path)).toEqual([
      'README.md',
      // Numbered even though the order had to be invented: a cycle is still a
      // dependency between these two, and the prefix is how the export says
      // which one it settled on.
      '01-A.md',
      '02-B.md',
      'plan.canvas',
      'plan.md',
      'plan.json',
    ]);
    expect(bundle.files[0]?.content).toContain('## Warnings');
  });
});

describe('plan.md', () => {
  it('quotes D2 ids and escapes what would break a string', () => {
    expect(d2String('Say "hi"\nthen \\ leave')).toBe('"Say \\"hi\\" then \\\\ leave"');
  });

  it('draws nesting as containers and names a nested node by its path', () => {
    const doc = planDocSchema.parse({
      id: 'p',
      title: 'P',
      updatedAt: '2026-01-01T00:00:00.000Z',
      nodes: [
        { slug: 'box', title: 'Box', kind: 'group' },
        { slug: 'inner', title: 'Inner "one"' },
        { slug: 'outer', title: 'Outer' },
      ],
      edges: [
        { id: 'c', kind: 'contains', from: 'box', to: 'inner' },
        { id: 'f', kind: 'flows_to', from: 'inner', to: 'outer', via: 'click' },
        { id: 'd', kind: 'depends_on', from: 'outer', to: 'inner' },
      ],
    });
    expect(planDiagram(doc).split('\n')).toEqual([
      'direction: right',
      '"box": "Box" {',
      '  "inner": "Inner \\"one\\""',
      '}',
      '"outer": "Outer"',
      '"box"."inner" -> "outer": "click"',
      '"outer" -> "box"."inner": "depends on"',
    ]);
  });

  it('says how many ready tasks it left out', () => {
    const doc = planDocSchema.parse({
      id: 'p',
      title: 'Many',
      updatedAt: '2026-01-01T00:00:00.000Z',
      nodes: Array.from({ length: READY_LISTED + 3 }, (_, i) => ({
        slug: `t-${i}`,
        title: `T ${i}`,
      })),
    });
    expect(planSummary(doc, DEFAULT_VOCABULARY)).toContain('- …and 3 more, left out here.');
  });
});
