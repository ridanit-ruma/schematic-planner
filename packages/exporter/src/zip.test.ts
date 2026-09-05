import JSZip from 'jszip';
import { describe, expect, it } from 'vitest';

import { exportFileName, exportPlanToZip } from './zip.js';
import { samplePlan } from './fixtures.js';

describe('exportPlanToZip', () => {
  it('produces a readable archive containing the bundle', async () => {
    const bytes = await exportPlanToZip(samplePlan());
    const zip = await JSZip.loadAsync(bytes);

    const paths = Object.values(zip.files)
      .filter((entry) => !entry.dir)
      .map((entry) => entry.name)
      .sort();

    expect(paths).toEqual([
      '01-foundation/01-database.md',
      '01-foundation/02-auth.md',
      '01-foundation/README.md',
      '02-editor/01-canvas.md',
      '02-editor/README.md',
      'README.md',
      'plan.canvas',
      'plan.json',
    ]);

    const auth = await zip.file('01-foundation/02-auth.md')?.async('string');
    expect(auth).toContain('title: Auth');
  });

  it('produces identical bytes for the same plan', async () => {
    const [a, b] = await Promise.all([
      exportPlanToZip(samplePlan()),
      exportPlanToZip(samplePlan()),
    ]);
    expect(Buffer.from(a).equals(Buffer.from(b))).toBe(true);
  });
});

describe('exportFileName', () => {
  it('derives a safe filename from the title', () => {
    expect(exportFileName({ title: 'Schematic Planner!' })).toBe('schematic-planner.zip');
    expect(exportFileName({ title: '한글 제목' })).toBe('plan.zip');
  });
});
