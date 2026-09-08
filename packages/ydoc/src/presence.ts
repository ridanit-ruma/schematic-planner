import type { Position } from '@schematic/schema';

/**
 * What a peer publishes over the Yjs awareness channel. Awareness state is
 * ephemeral — it never enters the document and leaves no history.
 *
 * `dragging` is the reason this matters: a drag in progress is broadcast here
 * and only committed to the document on drag stop. Writing every frame into the
 * CRDT instead would produce sixty updates a second and inflate the document
 * for every future reader.
 */
export interface Presence {
  readonly userId: string;
  readonly name: string;
  /** CSS color used for this peer's cursor and selection outline. */
  readonly color: string;
  readonly cursor?: Position | null;
  readonly selection?: readonly string[];
  readonly dragging?: Readonly<Record<string, Position>>;
}

/**
 * An agent walking a plan, published on the same ephemeral channel as cursors.
 *
 * Reading is not part of the document and leaves no history, so it belongs
 * here: it appears on every open canvas while it happens and is gone
 * afterwards, exactly like somebody else's pointer. A plan nobody is watching
 * costs nothing — the server has no one to tell.
 */
export interface Reading {
  /** Who is reading. An agent acts as its owner, so this is a person's name. */
  readonly by: string;
  readonly agent: boolean;
  /** The node the walk started from. */
  readonly from: string;
  /** The walk in the order it was taken, each hop naming the line it came along. */
  readonly hops: readonly { readonly node: string; readonly edge: string | null }[];
  /** When it was published, so a stale entry can be ignored. */
  readonly at: number;
}

/**
 * How long one hop of a walk is held on screen. The server sizes its
 * announcement from the same number, so what it says it is doing and what the
 * canvas draws cannot drift apart.
 */
export const READING_STEP_MS = 420;

const PRESENCE_COLORS = [
  '#e11d48',
  '#ea580c',
  '#ca8a04',
  '#16a34a',
  '#0891b2',
  '#4f46e5',
  '#9333ea',
] as const;

/** Stable per user, so someone keeps the same color across sessions. */
export function presenceColor(userId: string): string {
  let hash = 0;
  for (let i = 0; i < userId.length; i += 1) {
    hash = (hash * 31 + userId.charCodeAt(i)) | 0;
  }
  const index = Math.abs(hash) % PRESENCE_COLORS.length;
  return PRESENCE_COLORS[index] ?? '#4f46e5';
}
