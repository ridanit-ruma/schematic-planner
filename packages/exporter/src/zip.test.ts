import JSZip from 'jszip';
import { afterEach, describe, expect, it, vi } from 'vitest';

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

  it('produces identical bytes for the same plan, whatever the clock says', async () => {
    // Two exports in the same second would agree by accident. Moving the clock
    // a year between them is what actually proves nothing observes it.
    // Only Date is faked: JSZip's generateAsync waits on real timers, and
    // freezing those would hang instead of testing anything.
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(new Date('2026-01-01T00:00:00Z'));
    const first = await exportPlanToZip(samplePlan());

    vi.setSystemTime(new Date('2027-06-15T12:34:56Z'));
    const second = await exportPlanToZip(samplePlan());

    expect(Buffer.from(first).equals(Buffer.from(second))).toBe(true);
  });

  it('stamps every entry, directories included, with the fixed date', async () => {
    const zip = await JSZip.loadAsync(await exportPlanToZip(samplePlan()));
    const dates = new Set(Object.values(zip.files).map((entry) => entry.date.getUTCFullYear()));

    expect([...dates]).toEqual([1980]);
    expect(Object.values(zip.files).some((entry) => entry.dir)).toBe(true);
  });
});

afterEach(() => {
  vi.useRealTimers();
});

describe('exportFileName', () => {
  it('derives a safe filename from the title', () => {
    expect(exportFileName({ title: 'Schematic Planner!' })).toBe('schematic-planner.zip');
    expect(exportFileName({ title: '한글 제목' })).toBe('plan.zip');
  });
});
