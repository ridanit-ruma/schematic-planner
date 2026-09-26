import {
  CARD,
  DEFAULT_KIND,
  DEFAULT_STATUS,
  kindOf,
  normalizeEdge,
  planEdgeInputSchema,
  planNodePatchSchema,
  positionSchema,
  sizeSchema,
  slugSchema,
  statusOf,
  tagOf,
  uniqueSlug,
  vocabularyKindSchema,
  vocabularyStatusSchema,
  vocabularyTagSchema,
  withTag,
  type PlanDoc,
  type PlanNodePatch,
  type PlanOp,
  type Position,
  type Vocabulary,
} from '@schematic/schema';
import { z } from 'zod';

/**
 * Copying nodes, between plans and tabs, through the system clipboard.
 *
 * The clipboard carries three things: the nodes as JSON under a type of their
 * own, the same JSON inside an HTML fragment (which is the one form that
 * survives a trip through the operating system to another browser), and a
 * plain list of titles for anything else it is pasted into.
 */

/** Marks JSON on the clipboard as nodes from this product. */
export const CLIPBOARD_TYPE = 'schematic-planner/nodes';
/** The clipboard type the JSON travels under inside one browser. */
export const CLIPBOARD_MIME = 'application/x-schematic-planner+json';
const HTML_ATTRIBUTE = 'data-schematic-planner';

/** How many lines of pasted text become nodes, at most. */
const TEXT_LINES_MAX = 100;

const clipNodeSchema = z.object({
  slug: slugSchema,
  title: z.string().min(1).max(200),
  kind: z.string().max(40),
  status: z.string().max(40),
  tags: z.array(z.string()).default([]),
  body: z.string().default(''),
  size: sizeSchema.nullable().default(null),
  pinned: z.boolean().default(false),
  /** Where it was drawn, absolute. */
  position: positionSchema,
});
export type ClipNode = z.infer<typeof clipNodeSchema>;

const payloadSchema = z.object({
  type: z.literal(CLIPBOARD_TYPE),
  v: z.literal(1),
  /** The plan it was copied from, so a paste back into it can keep a node in its box. */
  plan: z.string().nullable().default(null),
  nodes: z.array(clipNodeSchema).min(1),
  edges: z.array(planEdgeInputSchema).default([]),
  /** The box each top-level copied node was in, which the payload itself does not hold. */
  holders: z.record(z.string(), z.string()).default({}),
  /**
   * What the copied kinds, statuses and tags mean where they were copied from,
   * so a plan in another project can take them on rather than guess.
   */
  words: z
    .object({
      statuses: z.array(vocabularyStatusSchema).default([]),
      kinds: z.array(vocabularyKindSchema).default([]),
      tags: z.array(vocabularyTagSchema).default([]),
    })
    .default({ statuses: [], kinds: [], tags: [] }),
});
export type ClipboardPayload = z.infer<typeof payloadSchema>;

/**
 * What a copy of these nodes holds.
 *
 * The selection, everything inside any box in it, and every line whose two
 * ends are both copied — which includes the `contains` lines, so a copied box
 * still holds its copied contents. Notes are not copied: they are about a
 * place in one plan, not part of the drawing.
 */
export function copyPayload(
  plan: Pick<PlanDoc, 'id' | 'nodes' | 'edges'>,
  slugs: Iterable<string>,
  /** Where each node is drawn, absolute. A box is drawn where its contents are. */
  drawnAt: Readonly<Record<string, Position>>,
  /** The copied plan's project vocabulary, whose entries for the copied values travel along. */
  vocabulary?: Vocabulary,
): ClipboardPayload | null {
  const present = new Set(plan.nodes.map((node) => node.slug));
  const chosen = new Set([...slugs].filter((slug) => present.has(slug)));

  const children = new Map<string, string[]>();
  const holderOf = new Map<string, string>();
  for (const edge of plan.edges) {
    if (edge.kind !== 'contains') continue;
    children.set(edge.from, [...(children.get(edge.from) ?? []), edge.to]);
    holderOf.set(edge.to, edge.from);
  }
  const stack = [...chosen];
  while (stack.length > 0) {
    const slug = stack.pop() as string;
    for (const child of children.get(slug) ?? []) {
      if (chosen.has(child)) continue;
      chosen.add(child);
      stack.push(child);
    }
  }
  if (chosen.size === 0) return null;

  const holders: Record<string, string> = {};
  for (const slug of chosen) {
    const holder = holderOf.get(slug);
    if (holder !== undefined && !chosen.has(holder)) holders[slug] = holder;
  }

  return {
    type: CLIPBOARD_TYPE,
    v: 1,
    plan: plan.id,
    nodes: plan.nodes
      .filter((node) => chosen.has(node.slug))
      .map((node) => ({
        slug: node.slug,
        title: node.title,
        kind: node.kind,
        status: node.status,
        tags: [...node.tags],
        body: node.body,
        size: node.size,
        pinned: node.pinned,
        position: drawnAt[node.slug] ?? node.position ?? { x: 0, y: 0 },
      })),
    edges: plan.edges
      .filter((edge) => chosen.has(edge.from) && chosen.has(edge.to))
      .map((edge) => ({
        kind: edge.kind,
        from: edge.from,
        to: edge.to,
        label: edge.label,
        via: edge.via,
        carries: edge.carries,
        labelPosition: edge.labelPosition,
        waypoints: edge.waypoints,
      })),
    holders,
    words: wordsFor(
      plan.nodes.filter((node) => chosen.has(node.slug)),
      vocabulary,
    ),
  };
}

function wordsFor(
  nodes: readonly { kind: string; status: string; tags: readonly string[] }[],
  vocabulary: Vocabulary | undefined,
): ClipboardPayload['words'] {
  if (vocabulary === undefined) return { statuses: [], kinds: [], tags: [] };
  const statuses = new Set(nodes.map((node) => node.status));
  const kinds = new Set(nodes.map((node) => node.kind));
  // Matched the way `tagOf` matches them everywhere else: whatever the case.
  const tags = new Set(nodes.flatMap((node) => node.tags.map((tag) => tagOf(vocabulary, tag))));
  return {
    statuses: vocabulary.statuses.filter((status) => statuses.has(status.id)),
    kinds: vocabulary.kinds.filter((kind) => kinds.has(kind.id)),
    tags: vocabulary.tags.filter((tag) => tags.has(tag)),
  };
}

/** How a paste's kinds and statuses land in the plan it is pasted into. */
export interface Adoption {
  kind: (id: string) => string;
  status: (id: string) => string;
  /**
   * What to add to the target project's vocabulary, or null when it already
   * has everything, or when the person pasting may not change it.
   */
  add: ((vocabulary: Vocabulary) => Vocabulary) | null;
}

/**
 * Takes the copied values into another project's vocabulary.
 *
 * A value the target already has, archived or not, stays as it is. One it
 * lacks is added, with the meaning it had where it was copied from, when the
 * person pasting may edit the vocabulary; otherwise the node falls back to the
 * default, rather than carrying a value nobody there defined. Tags are names on
 * the node either way; they only gain their colour when they may be added.
 */
export function adoptWords(
  payload: ClipboardPayload,
  target: Vocabulary,
  canEdit: boolean,
): Adoption {
  const statuses = new Map(payload.words.statuses.map((status) => [status.id, status]));
  const kinds = new Map(payload.words.kinds.map((kind) => [kind.id, kind]));
  const addStatuses = new Map<string, (typeof payload.words.statuses)[number]>();
  const addKinds = new Map<string, (typeof payload.words.kinds)[number]>();

  const status = (id: string): string => {
    if (statusOf(target, id) !== undefined) return id;
    const known = statuses.get(id);
    if (!canEdit || known === undefined) return DEFAULT_STATUS;
    addStatuses.set(id, { ...known, archived: false });
    return id;
  };
  const kind = (id: string): string => {
    if (kindOf(target, id) !== undefined) return id;
    const known = kinds.get(id);
    if (!canEdit || known === undefined) return DEFAULT_KIND;
    addKinds.set(id, { ...known, archived: false });
    return id;
  };
  for (const node of payload.nodes) {
    status(node.status);
    kind(node.kind);
  }
  const addTags = canEdit
    ? payload.words.tags.filter((tag) => tagOf(target, tag.name) === undefined)
    : [];

  const nothing = addStatuses.size === 0 && addKinds.size === 0 && addTags.length === 0;
  return {
    status,
    kind,
    add: nothing
      ? null
      : (vocabulary) => {
          const next: Vocabulary = {
            ...vocabulary,
            statuses: [
              ...vocabulary.statuses,
              ...[...addStatuses.values()].filter(
                (one) => statusOf(vocabulary, one.id) === undefined,
              ),
            ],
            kinds: [
              ...vocabulary.kinds,
              ...[...addKinds.values()].filter((one) => kindOf(vocabulary, one.id) === undefined),
            ],
          };
          return addTags.reduce((words, tag) => withTag(words, tag.name, tag.color), next);
        },
  };
}

/** A field kept only if this plan's schema takes it, and left to the default otherwise. */
function accepted<K extends keyof PlanNodePatch>(key: K, value: unknown): Partial<PlanNodePatch> {
  const field = planNodePatchSchema.shape[key];
  const parsed = field.safeParse(value);
  return parsed.success && parsed.data !== undefined ? { [key]: parsed.data } : {};
}

export interface Pasted {
  ops: PlanOp[];
  /** The new slugs, in the order the payload listed the nodes. */
  slugs: string[];
  /** Old slug to new slug. */
  renamed: Map<string, string>;
  /** New slugs of the copies that no other copy holds. */
  roots: string[];
}

/**
 * The operations that paste a payload.
 *
 * Every copy gets a fresh slug made from the old one, so pasting into the plan
 * it came from never collides and pasting twice gives two copies. The copies
 * keep their layout relative to each other: with `at`, the top-left of the
 * whole payload lands there; with `offset`, everything moves by that much
 * from where it was copied.
 *
 * A kind, status or tag the schema does not take is left to its default rather
 * than failing the paste; `words` says what the target project calls the copied
 * kinds and statuses (see `adoptWords`).
 */
export function pasteOps(
  payload: ClipboardPayload,
  taken: Iterable<string>,
  placement: { at: Position } | { offset: Position },
  words?: Pick<Adoption, 'kind' | 'status'>,
): Pasted {
  const used = new Set(taken);
  const renamed = new Map<string, string>();
  for (const node of payload.nodes) {
    const slug = uniqueSlug(node.slug, used);
    used.add(slug);
    renamed.set(node.slug, slug);
  }

  const originX = Math.min(...payload.nodes.map((node) => node.position.x));
  const originY = Math.min(...payload.nodes.map((node) => node.position.y));
  const delta =
    'at' in placement
      ? { x: placement.at.x - originX, y: placement.at.y - originY }
      : placement.offset;
  const moved = (point: Position): Position => ({
    x: Math.round(point.x + delta.x),
    y: Math.round(point.y + delta.y),
  });

  const ops: PlanOp[] = [];
  for (const node of payload.nodes) {
    ops.push({
      op: 'upsert_node',
      node: {
        slug: renamed.get(node.slug) as string,
        title: node.title,
        ...accepted('kind', words === undefined ? node.kind : words.kind(node.kind)),
        ...accepted('status', words === undefined ? node.status : words.status(node.status)),
        ...accepted('tags', node.tags),
        ...accepted('body', node.body),
        ...accepted('size', node.size),
        pinned: node.pinned,
        position: moved(node.position),
      },
    });
  }

  const held = new Set<string>();
  for (const edge of payload.edges) {
    const from = renamed.get(edge.from);
    const to = renamed.get(edge.to);
    if (from === undefined || to === undefined) continue;
    if (edge.kind === 'contains') held.add(to);
    ops.push({
      op: 'upsert_edge',
      edge: normalizeEdge(
        planEdgeInputSchema.parse({
          ...edge,
          id: undefined,
          from,
          to,
          labelPosition: edge.labelPosition == null ? null : moved(edge.labelPosition),
          waypoints: (edge.waypoints ?? []).map(moved),
        }),
      ),
    });
  }

  const slugs = payload.nodes.map((node) => renamed.get(node.slug) as string);
  return { ops, slugs, renamed, roots: slugs.filter((slug) => !held.has(slug)) };
}

/** Reads a payload back, or nothing if this is not one. */
export function readPayload(value: unknown): ClipboardPayload | null {
  const parsed = payloadSchema.safeParse(value);
  return parsed.success ? parsed.data : null;
}

function toBase64(text: string): string {
  let binary = '';
  for (const byte of new TextEncoder().encode(text)) binary += String.fromCharCode(byte);
  return btoa(binary);
}

function fromBase64(encoded: string): string {
  const binary = atob(encoded);
  return new TextDecoder().decode(Uint8Array.from(binary, (char) => char.charCodeAt(0)));
}

const escapeHtml = (text: string): string =>
  text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

/** The three forms a copy is written to the clipboard in. */
export function clipboardForms(payload: ClipboardPayload): Record<string, string> {
  const json = JSON.stringify(payload);
  const titles = payload.nodes.map((node) => node.title);
  return {
    [CLIPBOARD_MIME]: json,
    'text/html': `<div ${HTML_ATTRIBUTE}="${toBase64(json)}">${titles.map(escapeHtml).join('<br>')}</div>`,
    'text/plain': titles.join('\n'),
  };
}

/**
 * Whatever the clipboard holds, as nodes to paste.
 *
 * Nodes copied from a plan come back as they were, from whichever form
 * survived the trip. Anything else that is text becomes one new node per
 * line, stacked where it is pasted.
 */
export function readClipboard(read: (type: string) => string): ClipboardPayload | null {
  const parse = (text: string): ClipboardPayload | null => {
    try {
      return readPayload(JSON.parse(text));
    } catch {
      return null;
    }
  };

  const own = read(CLIPBOARD_MIME);
  if (own !== '') {
    const payload = parse(own);
    if (payload !== null) return payload;
  }
  const html = read('text/html');
  const embedded = new RegExp(`${HTML_ATTRIBUTE}="([A-Za-z0-9+/=]*)"`).exec(html)?.[1];
  if (embedded !== undefined) {
    try {
      const payload = parse(fromBase64(embedded));
      if (payload !== null) return payload;
    } catch {
      // Not base64 after all; fall through to the text.
    }
  }
  const text = read('text/plain');
  return parse(text) ?? linesAsPayload(text);
}

/** Plain text, one node per non-empty line. */
export function linesAsPayload(text: string): ClipboardPayload | null {
  const lines = text
    .split(/\r?\n/)
    .map((line) => line.trim().slice(0, 200))
    .filter((line) => line !== '')
    .slice(0, TEXT_LINES_MAX);
  if (lines.length === 0) return null;
  const used = new Set<string>();
  return {
    type: CLIPBOARD_TYPE,
    v: 1,
    plan: null,
    nodes: lines.map((title, index) => {
      const slug = uniqueSlug(title, used);
      used.add(slug);
      return {
        slug,
        title,
        kind: DEFAULT_KIND,
        status: DEFAULT_STATUS,
        tags: [],
        body: '',
        size: null,
        pinned: true,
        position: { x: 0, y: index * (CARD.minHeight + 20) },
      };
    }),
    edges: [],
    holders: {},
    words: { statuses: [], kinds: [], tags: [] },
  };
}

/** How long after the middle button a paste is taken to be its doing, in ms. */
const MIDDLE_PASTE_MS = 500;

/**
 * Tells a paste the middle button made from one somebody asked for.
 *
 * On Linux a middle click pastes the primary selection: whatever text was last
 * dragged over, in any window, often by accident. The canvas makes nodes out of
 * pasted text, and the middle button is how it pans — so a click meant to move
 * the view made a node out of half a sentence. The browser gives such a paste
 * nothing that marks it, only the button that came just before it; noted on
 * press and on release, because some browsers paste when a drag ends.
 */
export function middleClickGuard(): {
  note: (event: { button: number; timeStamp: number }) => void;
  pasting: (now: number) => boolean;
} {
  let last = Number.NEGATIVE_INFINITY;
  return {
    note: (event) => {
      if (event.button === 1) last = event.timeStamp;
    },
    pasting: (now) => now - last < MIDDLE_PASTE_MS,
  };
}
