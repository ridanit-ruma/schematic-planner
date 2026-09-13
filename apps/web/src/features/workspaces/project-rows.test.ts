import { describe, expect, it } from 'vitest';

import { folderPlans, projectRows } from './project-rows';
import type { FolderSummary, PlanSummary } from '@/lib/api';

const folder = (id: string, name: string, planCount = 0): FolderSummary => ({
  id,
  name,
  planCount,
  updatedAt: '2026-09-14T00:00:00.000Z',
});

const plan = (id: string, title: string, folderId: string | null): PlanSummary => ({
  id,
  title,
  description: '',
  nodeCount: 0,
  updatedAt: '2026-09-14T00:00:00.000Z',
  folderId,
});

describe('what a project screen shows', () => {
  it('puts every folder above the plans that are in no folder', () => {
    const rows = projectRows(
      [folder('f1', 'Architecture'), folder('f2', 'Ledger')],
      [plan('p1', 'Loose', null), plan('p2', 'Filed', 'f1')],
    );

    expect(rows.map((row) => (row.kind === 'folder' ? row.folder.name : row.plan.title))).toEqual([
      'Architecture',
      'Ledger',
      'Loose',
    ]);
  });

  /* A folder somebody made is a place, whether or not anything is in it yet. */
  it('shows a folder with nothing in it', () => {
    expect(projectRows([folder('f1', 'Spikes')], [])).toEqual([
      { kind: 'folder', folder: folder('f1', 'Spikes') },
    ]);
  });

  it('never shows a plan twice', () => {
    const rows = projectRows([folder('f1', 'Architecture')], [plan('p2', 'Filed', 'f1')]);
    expect(rows.filter((row) => row.kind === 'plan')).toEqual([]);
  });

  it('keeps the order the server gave, which is by name for folders and recency for plans', () => {
    const rows = projectRows(
      [folder('f2', 'Zebra'), folder('f1', 'Alpha')],
      [plan('p2', 'Newer', null), plan('p1', 'Older', null)],
    );
    expect(rows.map((row) => (row.kind === 'folder' ? row.folder.name : row.plan.title))).toEqual([
      'Zebra',
      'Alpha',
      'Newer',
      'Older',
    ]);
  });
});

describe('what a folder screen shows', () => {
  it('is the plans filed in it, and nothing else', () => {
    const inside = folderPlans(
      [plan('p1', 'Loose', null), plan('p2', 'Filed', 'f1'), plan('p3', 'Elsewhere', 'f2')],
      'f1',
    );
    expect(inside.map((found) => found.title)).toEqual(['Filed']);
  });

  it('is empty for a folder nothing is in', () => {
    expect(folderPlans([plan('p1', 'Loose', null)], 'f1')).toEqual([]);
  });
});
