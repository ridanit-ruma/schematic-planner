import { describe, expect, it } from 'vitest';
import { planDocSchema } from '@schematic/schema';

import { exportPlan } from './bundle.js';
import { samplePlan } from './fixtures.js';

const pathsOf = (doc = samplePlan()) => exportPlan(doc).files.map((file) => file.path);
const fileAt = (path: string, doc = samplePlan()) =>
  exportPlan(doc).files.find((file) => file.path === path)?.content ?? '';

describe('exportPlan', () => {
  it('folds containment into directories and dependency order into filenames', () => {
    expect(pathsOf()).toEqual([
      'README.md',
      '01-foundation/README.md',
      '01-foundation/01-database.md',
      '01-foundation/02-auth.md',
      '02-editor/README.md',
      '02-editor/01-canvas.md',
      'plan.canvas',
      'plan.json',
    ]);
  });

  it('writes a nested table of contents in the overview', () => {
    const readme = fileAt('README.md');
    expect(readme).toContain('# Schematic Planner');
    expect(readme).toContain('- [Foundation](01-foundation/README.md)');
    expect(readme).toContain('  - [Database](01-foundation/01-database.md) — `done`');
  });

  it('lists contents in export order, not alphabetically', () => {
    const readme = fileAt('README.md');
    expect(readme.indexOf('01-database.md')).toBeLessThan(readme.indexOf('02-auth.md'));
    expect(readme.indexOf('01-foundation/README.md')).toBeLessThan(
      readme.indexOf('02-editor/README.md'),
    );
  });

  it('carries the graph in frontmatter so the bundle is self-describing', () => {
    const auth = fileAt('01-foundation/02-auth.md');
    expect(auth).toContain('slug: auth');
    expect(auth).toContain('status: in_progress');
    expect(auth).toContain('depends_on:\n  - database');
    expect(auth).toContain('# Auth');
    expect(auth).toContain('Email and password first.');

    const foundation = fileAt('01-foundation/README.md');
    expect(foundation).toContain('contains:');
    expect(foundation).toContain('  - auth');
  });

  it('writes position only for pinned nodes', () => {
    expect(fileAt('02-editor/01-canvas.md')).toContain('pinned: true');
    expect(fileAt('01-foundation/01-database.md')).not.toContain('position');
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
    expect(bundle.files.map((f) => f.path)).toEqual(['README.md', 'plan.canvas', 'plan.json']);
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
      '01-a.md',
      '02-b.md',
      'plan.canvas',
      'plan.json',
    ]);
    expect(bundle.files[0]?.content).toContain('## Warnings');
  });
});
