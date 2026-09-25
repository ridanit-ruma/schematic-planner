import { z } from 'zod';

/**
 * The words a project draws its plans with: which statuses a node can be in,
 * which kinds of node there are, and the tags people have been using.
 *
 * It belongs to the project rather than to a plan, so every plan in a project
 * speaks the same language, and it is stored beside the project rather than in
 * any document. Nodes keep storing ids (kind, status) and names (tags) as plain
 * strings, which is what lets a vocabulary change without a single document
 * being rewritten: a status that is renamed keeps its id, and one that is
 * removed is archived and goes on being drawn wherever it is still used.
 */

/**
 * Ten colours that read on the canvas and in the export. Named rather than
 * given as hex so that the browser can draw each one to suit its theme, and the
 * Obsidian Canvas export can map each one to a colour Obsidian knows.
 */
export const PALETTE = [
  'gray',
  'dim',
  'red',
  'orange',
  'amber',
  'green',
  'teal',
  'blue',
  'indigo',
  'purple',
] as const;
export type PaletteColor = (typeof PALETTE)[number];

/**
 * What a status means, as opposed to what it is called. Every behaviour a
 * status has hangs off this: what is ready to start, what is under way, what
 * has stopped a flow, what is finished with.
 */
export const STATUS_CATEGORIES = ['todo', 'active', 'blocked', 'done', 'cancelled'] as const;
export type StatusCategory = (typeof STATUS_CATEGORIES)[number];

/** The outlines a kind of card can be drawn with. */
export const KIND_LOOKS = ['solid', 'strong', 'dashed', 'clipped'] as const;
export type KindLook = (typeof KIND_LOOKS)[number];

/** Built in and structural: a group is drawn as the box around what it holds. */
export const GROUP_KIND = 'group';
/** What a node is when nobody said. Matches `planNodeSchema`'s defaults. */
export const DEFAULT_KIND = 'task';
export const DEFAULT_STATUS = 'idea';

const ID_PATTERN = /^[a-z0-9]+(?:[-_][a-z0-9]+)*$/;
export const VOCABULARY_ID_MAX = 40;
export const VOCABULARY_NAME_MAX = 40;

export const vocabularyIdSchema = z
  .string()
  .min(1)
  .max(VOCABULARY_ID_MAX)
  .regex(ID_PATTERN, 'must be lowercase letters and digits joined by - or _');

const nameSchema = z.string().trim().min(1).max(VOCABULARY_NAME_MAX);

export const vocabularyStatusSchema = z.object({
  id: vocabularyIdSchema,
  name: nameSchema,
  color: z.enum(PALETTE),
  category: z.enum(STATUS_CATEGORIES),
  /** Out of the pickers, still drawn wherever a node uses it. */
  archived: z.boolean().default(false),
});
export type VocabularyStatus = z.infer<typeof vocabularyStatusSchema>;

export const vocabularyKindSchema = z.object({
  id: vocabularyIdSchema,
  name: nameSchema,
  look: z.enum(KIND_LOOKS),
  /** Counts as something to do: `next_task` offers it and progress counts it. */
  work: z.boolean(),
  archived: z.boolean().default(false),
});
export type VocabularyKind = z.infer<typeof vocabularyKindSchema>;

export const vocabularyTagSchema = z.object({
  name: z.string().trim().min(1).max(40),
  color: z.enum(PALETTE),
});
export type VocabularyTag = z.infer<typeof vocabularyTagSchema>;

const listsShape = {
  statuses: z.array(vocabularyStatusSchema).min(1).max(40),
  kinds: z.array(vocabularyKindSchema).min(1).max(40),
  tags: z.array(vocabularyTagSchema).max(500).default([]),
};

/** What must hold of any vocabulary, however it arrived. */
function checkVocabulary(
  vocabulary: { statuses: VocabularyStatus[]; kinds: VocabularyKind[]; tags: VocabularyTag[] },
  ctx: z.RefinementCtx,
): void {
  const duplicate = (values: readonly string[]): string | undefined =>
    values.find((value, index) => values.indexOf(value) !== index);

  const status = duplicate(vocabulary.statuses.map((one) => one.id));
  if (status !== undefined) {
    ctx.addIssue({
      code: 'custom',
      message: `two statuses share the id "${status}"`,
      path: ['statuses'],
    });
  }
  const kind = duplicate(vocabulary.kinds.map((one) => one.id));
  if (kind !== undefined) {
    ctx.addIssue({ code: 'custom', message: `two kinds share the id "${kind}"`, path: ['kinds'] });
  }
  const tag = duplicate(vocabulary.tags.map((one) => one.name.toLowerCase()));
  if (tag !== undefined) {
    ctx.addIssue({ code: 'custom', message: `the tag "${tag}" is listed twice`, path: ['tags'] });
  }

  if (!vocabulary.statuses.some((one) => !one.archived)) {
    ctx.addIssue({
      code: 'custom',
      message: 'at least one status must stay in use',
      path: ['statuses'],
    });
  }
  const group = vocabulary.kinds.find((one) => one.id === GROUP_KIND);
  if (group === undefined || group.archived) {
    ctx.addIssue({
      code: 'custom',
      message: 'the group kind is built in and stays',
      path: ['kinds'],
    });
  }
  if (!vocabulary.kinds.some((one) => one.id !== GROUP_KIND && !one.archived)) {
    ctx.addIssue({
      code: 'custom',
      message: 'at least one kind must stay in use',
      path: ['kinds'],
    });
  }
}

/** What a person sends to replace a project's vocabulary, with the version it was read at. */
export const vocabularyInputSchema = z
  .object({ version: z.number().int().min(0), ...listsShape })
  .superRefine(checkVocabulary);
export type VocabularyInput = z.input<typeof vocabularyInputSchema>;

export const vocabularySchema = vocabularyInputSchema;
export type Vocabulary = z.infer<typeof vocabularySchema>;

/** What is stored in the project's JSON column: the lists, without the version. */
export const storedVocabularySchema = z.object(listsShape).superRefine(checkVocabulary);
export type StoredVocabulary = z.infer<typeof storedVocabularySchema>;

/**
 * Today's statuses and kinds, exactly. Every project starts from this and a
 * project nobody has edited is this, so every existing document, export and
 * agent keeps working unchanged: the ids are the ones nodes already store.
 */
export const DEFAULT_VOCABULARY: Vocabulary = {
  version: 0,
  statuses: [
    { id: 'idea', name: 'Idea', color: 'gray', category: 'todo', archived: false },
    { id: 'planned', name: 'Planned', color: 'indigo', category: 'todo', archived: false },
    { id: 'in_progress', name: 'In progress', color: 'amber', category: 'active', archived: false },
    { id: 'blocked', name: 'Blocked', color: 'red', category: 'blocked', archived: false },
    { id: 'done', name: 'Done', color: 'green', category: 'done', archived: false },
    { id: 'dropped', name: 'Dropped', color: 'dim', category: 'cancelled', archived: false },
  ],
  kinds: [
    { id: 'feature', name: 'Feature', look: 'strong', work: true, archived: false },
    { id: 'task', name: 'Task', look: 'solid', work: true, archived: false },
    { id: 'decision', name: 'Decision', look: 'clipped', work: true, archived: false },
    { id: 'note', name: 'Note', look: 'dashed', work: false, archived: false },
    { id: GROUP_KIND, name: 'Group', look: 'strong', work: false, archived: false },
  ],
  tags: [],
};

/** The name each default id was born with, which is what the UI translates while it is unchanged. */
export function isDefaultName(
  entry: { id: string; name: string },
  list: 'statuses' | 'kinds',
): boolean {
  const original = (DEFAULT_VOCABULARY[list] as readonly { id: string; name: string }[]).find(
    (one) => one.id === entry.id,
  );
  return original !== undefined && original.name === entry.name;
}

/**
 * The vocabulary a project has, from what its row holds.
 *
 * Null is a project nobody has edited, and means the defaults. Anything that
 * does not parse is treated the same way rather than failing every read of
 * every plan in the project: the next save writes a good one.
 */
export function readVocabulary(stored: unknown, version: number): Vocabulary {
  if (stored === null || stored === undefined) return { ...DEFAULT_VOCABULARY, version };
  const parsed = storedVocabularySchema.safeParse(stored);
  if (!parsed.success) return { ...DEFAULT_VOCABULARY, version };
  return { version, ...parsed.data };
}

export function statusOf(vocabulary: Vocabulary, id: string): VocabularyStatus | undefined {
  return vocabulary.statuses.find((one) => one.id === id);
}

export function kindOf(vocabulary: Vocabulary, id: string): VocabularyKind | undefined {
  return vocabulary.kinds.find((one) => one.id === id);
}

/** What a status means, or null for one the vocabulary has never heard of. */
export function categoryOf(vocabulary: Vocabulary, id: string): StatusCategory | null {
  return statusOf(vocabulary, id)?.category ?? null;
}

/** Finished with, one way or the other. An unknown status is not. */
export function isSettled(vocabulary: Vocabulary, id: string): boolean {
  const category = categoryOf(vocabulary, id);
  return category === 'done' || category === 'cancelled';
}

/**
 * Whether a node of this kind is something to do.
 *
 * A kind nobody has defined counts as work: a node somebody drew with a word
 * the project does not know is more likely a task than a remark, and leaving
 * it out of `next_task` would hide it.
 */
export function isWorkKind(vocabulary: Vocabulary, id: string): boolean {
  if (id === GROUP_KIND) return false;
  return kindOf(vocabulary, id)?.work ?? true;
}

/** What the pickers offer: everything not archived, plus whatever the node already has. */
export function pickable<T extends { id: string; archived: boolean }>(
  entries: readonly T[],
  current?: string,
): T[] {
  return entries.filter((one) => !one.archived || one.id === current);
}

/**
 * A readable id for a new status or kind, made from its first name.
 *
 * It stays when the name changes later, which is why it is only made once.
 * A name with nothing Latin in it — `검토 중` — gets the fallback instead.
 */
export function vocabularyId(name: string, taken: Iterable<string>, fallback: string): string {
  const used = new Set(taken);
  const base =
    name
      .normalize('NFKD')
      .replace(/[̀-ͯ]/g, '')
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '')
      .slice(0, VOCABULARY_ID_MAX - 4)
      .replace(/-+$/, '') || fallback;

  if (!used.has(base)) return base;
  for (let n = 2; ; n += 1) {
    const candidate = `${base}-${n}`;
    if (!used.has(candidate)) return candidate;
  }
}

/** The tag of that name, however it is capitalised. */
export function tagOf(
  vocabulary: Pick<Vocabulary, 'tags'>,
  name: string,
): VocabularyTag | undefined {
  const wanted = name.trim().toLowerCase();
  return vocabulary.tags.find((one) => one.name.toLowerCase() === wanted);
}

/** A colour for a tag nobody chose one for. The two greys are left for statuses. */
export function randomTagColor(random: () => number = Math.random): PaletteColor {
  const bright = PALETTE.filter((color) => color !== 'gray' && color !== 'dim');
  return bright[Math.floor(random() * bright.length) % bright.length] ?? 'blue';
}

/** The vocabulary with this tag in it. Unchanged when a tag of that name is already there. */
export function withTag<T extends Pick<Vocabulary, 'tags'>>(
  vocabulary: T,
  name: string,
  color?: PaletteColor,
): T {
  const trimmed = name.trim();
  if (trimmed === '' || tagOf(vocabulary, trimmed) !== undefined) return vocabulary;
  return {
    ...vocabulary,
    tags: [...vocabulary.tags, { name: trimmed, color: color ?? randomTagColor() }],
  };
}

/**
 * Statuses and kinds that a replacement would take out altogether.
 *
 * Removing is archiving: nodes still store the id, and a vocabulary that forgot
 * it would draw them as unknown. So a save may archive anything but may not
 * drop an id it was given.
 */
export function droppedIds(
  before: Vocabulary,
  after: Pick<Vocabulary, 'statuses' | 'kinds'>,
): string[] {
  const keeps = (list: readonly { id: string }[], id: string) => list.some((one) => one.id === id);
  return [
    ...before.statuses
      .filter((one) => !keeps(after.statuses, one.id))
      .map((one) => `status "${one.id}"`),
    ...before.kinds.filter((one) => !keeps(after.kinds, one.id)).map((one) => `kind "${one.id}"`),
  ];
}

export type VocabularyMatch = { ok: true; id: string } | { ok: false; message: string };

/**
 * What an agent's word for a status or kind means in this project.
 *
 * The id is what is stored, and it is what an agent reads back, so it is tried
 * first. The name a person gave it is tried next, ignoring case, because that
 * is the word on the screen. An archived value is refused unless the node
 * already has it — writing back what a node already carries is not a choice.
 */
export function matchVocabulary(
  entries: readonly { id: string; name: string; archived: boolean }[],
  value: string,
  current: string | undefined,
  what: 'status' | 'kind',
): VocabularyMatch {
  const lowered = value.trim().toLowerCase();
  const found =
    entries.find((one) => one.id === value) ??
    entries.find((one) => one.id === lowered || one.name.toLowerCase() === lowered);

  if (found !== undefined && (!found.archived || found.id === current)) {
    return { ok: true, id: found.id };
  }
  if (value === current) return { ok: true, id: value };

  const valid = entries
    .filter((one) => !one.archived)
    .map((one) => (one.name.toLowerCase() === one.id ? one.id : `${one.id} (${one.name})`))
    .join(', ');
  const why =
    found === undefined ? 'is not one this project has' : 'has been retired in this project';
  return { ok: false, message: `The ${what} "${value}" ${why}. Use one of: ${valid}.` };
}
