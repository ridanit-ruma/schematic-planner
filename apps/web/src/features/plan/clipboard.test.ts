import {
  DEFAULT_VOCABULARY,
  applyPlanOps,
  normalizeEdge,
  planEdgeInputSchema,
  planNodeSchema,
  type PlanDoc,
  type PlanEdgeInput,
} from '@schematic/schema';
import { describe, expect, it } from 'vitest';

import {
  CLIPBOARD_MIME,
  adoptWords,
  clipboardForms,
  middleClickGuard,
  copyPayload,
  linesAsPayload,
  pasteOps,
  readClipboard,
  readPayload,
} from './clipboard';

const node = (slug: string, x: number, y: number, extra: Record<string, unknown> = {}) =>
  planNodeSchema.parse({ slug, title: slug.toUpperCase(), position: { x, y }, ...extra });
const edge = (input: PlanEdgeInput) => normalizeEdge(planEdgeInputSchema.parse(input));

const plan: PlanDoc = {
  id: 'plan-1',
  version: 1,
  title: 'Plan',
  description: '',
  updatedAt: new Date(0).toISOString(),
  nodes: [
    node('box', 0, 0, { kind: 'group' }),
    node('inner', 20, 40, { status: 'done', tags: ['api'], body: 'Hello' }),
    node('lone', 500, 0, { kind: 'decision', size: { width: 320, height: 90 } }),
    node('other', 900, 0),
  ],
  edges: [
    edge({ kind: 'contains', from: 'box', to: 'inner' }),
    edge({
      kind: 'flows_to',
      from: 'inner',
      to: 'lone',
      via: 'click',
      waypoints: [{ x: 300, y: 50 }],
    }),
    edge({ kind: 'flows_to', from: 'lone', to: 'other' }),
  ],
  comments: [],
} as PlanDoc;

const drawn = {
  box: { x: 0, y: 0 },
  inner: { x: 20, y: 40 },
  lone: { x: 500, y: 0 },
  other: { x: 900, y: 0 },
};

describe('copying nodes', () => {
  it('takes a box with what it holds, and only the lines inside the copy', () => {
    const payload = copyPayload(plan, ['box', 'lone'], drawn);
    expect(payload?.nodes.map((each) => each.slug)).toEqual(['box', 'inner', 'lone']);
    expect(payload?.edges.map((each) => `${each.kind}:${each.from}>${each.to}`)).toEqual([
      'contains:box>inner',
      'flows_to:inner>lone',
    ]);
    expect(payload?.plan).toBe('plan-1');
  });

  it('carries what a node says about itself', () => {
    const copied = copyPayload(plan, ['inner'], drawn)?.nodes[0];
    expect(copied).toMatchObject({ status: 'done', tags: ['api'], body: 'Hello' });
  });

  // Pasted back beside the original, a node goes back in the box it was in.
  it('remembers the box a copied node was in when the box was not copied', () => {
    expect(copyPayload(plan, ['inner'], drawn)?.holders).toEqual({ inner: 'box' });
    expect(copyPayload(plan, ['box'], drawn)?.holders).toEqual({});
  });

  it('copies nothing from an empty selection', () => {
    expect(copyPayload(plan, ['missing'], drawn)).toBeNull();
  });
});

describe('pasting nodes', () => {
  const payload = copyPayload(plan, ['box', 'lone'], drawn)!;

  it('gives every copy a fresh slug and keeps the layout, with the top-left at the point', () => {
    const pasted = pasteOps(
      payload,
      plan.nodes.map((each) => each.slug),
      { at: { x: 1000, y: 1000 } },
    );
    expect(pasted.slugs).toEqual(['box-2', 'inner-2', 'lone-2']);
    const result = applyPlanOps(plan, pasted.ops);
    const placed = Object.fromEntries(
      result.nodes
        .filter((each) => pasted.slugs.includes(each.slug))
        .map((each) => [each.slug, each.position]),
    );
    expect(placed).toEqual({
      'box-2': { x: 1000, y: 1000 },
      'inner-2': { x: 1020, y: 1040 },
      'lone-2': { x: 1500, y: 1000 },
    });
  });

  it('draws the copied lines between the copies, with their bends moved along', () => {
    const pasted = pasteOps(
      payload,
      plan.nodes.map((each) => each.slug),
      { offset: { x: 20, y: 20 } },
    );
    const result = applyPlanOps(plan, pasted.ops);
    const flow = result.edges.find((each) => each.from === 'inner-2');
    expect(flow).toMatchObject({ to: 'lone-2', via: 'click', waypoints: [{ x: 320, y: 70 }] });
    expect(result.edges.some((each) => each.kind === 'contains' && each.to === 'inner-2')).toBe(
      true,
    );
    // What the originals are connected to is not copied.
    expect(result.edges.some((each) => each.from === 'lone-2')).toBe(false);
    expect(pasted.roots).toEqual(['box-2', 'lone-2']);
  });

  it('keeps kind, status, tags, body, size and pin', () => {
    const pasted = pasteOps(payload, [], { offset: { x: 0, y: 0 } });
    const result = applyPlanOps({ ...plan, nodes: [], edges: [] }, pasted.ops);
    expect(result.nodes.find((each) => each.slug === 'lone')).toMatchObject({
      kind: 'decision',
      size: { width: 320, height: 90 },
    });
    expect(result.nodes.find((each) => each.slug === 'inner')).toMatchObject({
      status: 'done',
      tags: ['api'],
      body: 'Hello',
    });
  });

  // A value this plan does not know is left to the default, not a failed paste.
  it('keeps a kind or status the schema takes when nothing says otherwise', () => {
    const odd = readPayload({
      type: 'schematic-planner/nodes',
      v: 1,
      nodes: [
        { slug: 'x', title: 'X', kind: 'spaceship', status: 'someday', position: { x: 0, y: 0 } },
      ],
    })!;
    const result = applyPlanOps(
      { ...plan, nodes: [], edges: [] },
      pasteOps(odd, [], { offset: { x: 0, y: 0 } }).ops,
    );
    expect(result.nodes[0]).toMatchObject({ kind: 'spaceship', status: 'someday' });
  });
});

describe('pasting into another project', () => {
  const source = {
    ...DEFAULT_VOCABULARY,
    statuses: [
      ...DEFAULT_VOCABULARY.statuses,
      { id: 'in-review', name: 'In review', color: 'purple', category: 'active', archived: false },
    ],
    kinds: [
      ...DEFAULT_VOCABULARY.kinds,
      { id: 'screen', name: 'Screen', look: 'strong', work: true, archived: false },
    ],
    tags: [{ name: 'api', color: 'teal' }],
  } as typeof DEFAULT_VOCABULARY;
  const copied: PlanDoc = {
    ...plan,
    nodes: [
      node('a', 0, 0, { kind: 'screen', status: 'in-review', tags: ['api'] }),
      node('b', 300, 0),
    ],
    edges: [],
  };
  const payload = copyPayload(copied, ['a', 'b'], {}, source)!;

  it('carries what the copied values mean, and only those', () => {
    expect(payload.words.statuses.map((status) => status.id).sort()).toEqual(['idea', 'in-review']);
    expect(payload.words.kinds.map((kind) => kind.id).sort()).toEqual(['screen', 'task']);
    expect(payload.words.tags).toEqual([{ name: 'api', color: 'teal' }]);
  });

  it('carries a tag written in another case, as the vocabulary matches it everywhere', () => {
    const upper = copyPayload(
      { ...copied, nodes: [node('a', 0, 0, { tags: ['API'] })] },
      ['a'],
      {},
      source,
    )!;
    expect(upper.words.tags).toEqual([{ name: 'api', color: 'teal' }]);
  });

  it('adds what the target lacks when the person may edit its vocabulary', () => {
    const adoption = adoptWords(payload, DEFAULT_VOCABULARY, true);
    const added = adoption.add!(DEFAULT_VOCABULARY);
    expect(added.statuses.find((status) => status.id === 'in-review')).toMatchObject({
      name: 'In review',
      category: 'active',
    });
    expect(added.kinds.find((kind) => kind.id === 'screen')).toMatchObject({ look: 'strong' });
    expect(added.tags).toEqual([{ name: 'api', color: 'teal' }]);

    const result = applyPlanOps(
      { ...plan, nodes: [], edges: [] },
      pasteOps(payload, [], { offset: { x: 0, y: 0 } }, adoption).ops,
    );
    expect(result.nodes.find((one) => one.slug === 'a')).toMatchObject({
      kind: 'screen',
      status: 'in-review',
    });
  });

  it('falls back to the defaults when the person may not edit it', () => {
    const adoption = adoptWords(payload, DEFAULT_VOCABULARY, false);
    expect(adoption.add).toBeNull();
    const result = applyPlanOps(
      { ...plan, nodes: [], edges: [] },
      pasteOps(payload, [], { offset: { x: 0, y: 0 } }, adoption).ops,
    );
    expect(result.nodes.find((one) => one.slug === 'a')).toMatchObject({
      kind: 'task',
      status: 'idea',
      tags: ['api'],
    });
  });

  it('asks for nothing when the target already has every value', () => {
    expect(adoptWords(payload, source, true).add).toBeNull();
  });
});

describe('the clipboard', () => {
  const payload = copyPayload(plan, ['lone'], drawn)!;
  const forms = clipboardForms(payload);

  it('reads back its own type', () => {
    expect(readClipboard((type) => (type === CLIPBOARD_MIME ? forms[type]! : ''))).toEqual(payload);
  });

  // The one form that survives a trip through the operating system.
  it('reads the copy out of the HTML when its own type did not survive', () => {
    expect(readClipboard((type) => (type === 'text/html' ? forms[type]! : ''))).toEqual(payload);
  });

  it('gives anything else a list of titles', () => {
    expect(forms['text/plain']).toBe('LONE');
  });

  it('survives titles in any script', () => {
    const korean = copyPayload(
      { ...plan, nodes: [node('k', 0, 0, { title: '결제 흐름' })], edges: [] },
      ['k'],
      {},
    )!;
    const html = clipboardForms(korean)['text/html']!;
    expect(readClipboard((type) => (type === 'text/html' ? html : ''))?.nodes[0]?.title).toBe(
      '결제 흐름',
    );
  });

  it('turns plain text into one node per line', () => {
    const pasted = readClipboard((type) =>
      type === 'text/plain' ? 'Sign in\n\n  Checkout  \n' : '',
    );
    expect(pasted?.nodes.map((each) => each.title)).toEqual(['Sign in', 'Checkout']);
    expect(pasted?.nodes[1]?.position.y).toBeGreaterThan(pasted?.nodes[0]?.position.y ?? 0);
  });

  it('has nothing to paste from an empty clipboard', () => {
    expect(readClipboard(() => '')).toBeNull();
    expect(linesAsPayload('  \n ')).toBeNull();
  });
});

/*
 * On Linux the middle button pastes the primary selection — whatever text was
 * last dragged over, anywhere. The canvas turns pasted text into nodes, so a
 * middle click meant to pan made a node out of half a sentence.
 */
describe('a paste after the middle button', () => {
  it('is the middle button pasting, for a moment after it is pressed', () => {
    const guard = middleClickGuard();
    guard.note({ button: 1, timeStamp: 1000 });
    expect(guard.pasting(1200)).toBe(true);
  });

  it('is an ordinary paste once that moment has passed', () => {
    const guard = middleClickGuard();
    guard.note({ button: 1, timeStamp: 1000 });
    expect(guard.pasting(3000)).toBe(false);
  });

  it('is not caused by the other buttons', () => {
    const guard = middleClickGuard();
    guard.note({ button: 0, timeStamp: 1000 });
    guard.note({ button: 2, timeStamp: 1000 });
    expect(guard.pasting(1100)).toBe(false);
  });
});
