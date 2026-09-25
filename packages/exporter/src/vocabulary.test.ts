import { describe, expect, it } from 'vitest';
import {
  DEFAULT_VOCABULARY,
  planDocSchema,
  planNodeKinds,
  planNodeStatuses,
  type PlanDoc,
  type Vocabulary,
} from '@schematic/schema';

import { exportPlan } from './bundle.js';
import { samplePlan } from './fixtures.js';

/** A node of every default kind in every default status, so each colour is written once. */
function everyValue(): PlanDoc {
  const nodes = planNodeStatuses.flatMap((status, row) =>
    planNodeKinds
      .filter((kind) => kind !== 'group')
      .map((kind, column) => ({
        slug: `${kind}-${status.replace('_', '-')}`,
        title: `${kind} ${status}`,
        kind,
        status,
        position: { x: column * 300, y: row * 200 },
      })),
  );
  return planDocSchema.parse({
    id: 'every-value',
    title: 'Every value',
    updatedAt: '2026-01-01T00:00:00.000Z',
    nodes: [...nodes, { slug: 'box', title: 'Box', kind: 'group', status: 'blocked' }],
    edges: [{ id: 'contains:box>task-done', kind: 'contains', from: 'box', to: 'task-done' }],
  });
}

const files = (doc: PlanDoc, vocabulary?: Vocabulary) =>
  Object.fromEntries(
    exportPlan(doc, vocabulary === undefined ? {} : { vocabulary }).files.map((file) => [
      file.path,
      file.content,
    ]),
  );

describe('exporting a project that never touched its vocabulary', () => {
  /*
   * The snapshot was written by the exporter as it was before vocabularies
   * existed. A project nobody has edited has to export byte for byte as it
   * did, so the snapshot must never be updated to make this pass.
   */
  it('writes what it wrote before vocabularies existed', () => {
    expect(files(everyValue())).toMatchSnapshot();
    expect(files(samplePlan())).toMatchSnapshot();
  });

  it('writes the same with the default vocabulary passed explicitly', () => {
    expect(files(everyValue(), DEFAULT_VOCABULARY)).toEqual(files(everyValue()));
    expect(files(samplePlan(), DEFAULT_VOCABULARY)).toEqual(files(samplePlan()));
  });
});

describe('exporting a project with its own statuses', () => {
  const doc = planDocSchema.parse({
    id: 'custom',
    title: 'Custom',
    updatedAt: '2026-01-01T00:00:00.000Z',
    nodes: [
      { slug: 'review', title: 'Review', status: 'in-review', kind: 'spike' },
      { slug: 'recoloured', title: 'Recoloured', status: 'done' },
      { slug: 'stranger', title: 'Stranger', status: 'mystery' },
    ],
  });
  const vocabulary: Vocabulary = {
    ...DEFAULT_VOCABULARY,
    statuses: [
      ...DEFAULT_VOCABULARY.statuses.map((one) =>
        one.id === 'done' ? { ...one, name: 'Shipped', color: 'blue' as const } : one,
      ),
      { id: 'in-review', name: 'In review', color: 'orange', category: 'active', archived: false },
    ],
  };

  it('colours each card by its status colour', () => {
    const canvas = JSON.parse(files(doc, vocabulary)['plan.canvas'] ?? '{}') as {
      nodes: { id: string; color?: string }[];
    };
    const color = (id: string) => canvas.nodes.find((node) => node.id === id)?.color;
    expect(color('review')).toBe('2');
    expect(color('recoloured')).toBe('#3b82f6');
    expect(color('stranger')).toBeUndefined();
  });

  it('writes the ids to front matter, not the names', () => {
    const written = files(doc, vocabulary);
    const review = Object.values(written).find((content) => content.includes('slug: review'));
    expect(review).toContain('status: in-review');
    expect(review).toContain('kind: spike');
    expect(written['README.md']).toContain('`in-review`');
  });
});
