import { DEFAULT_VOCABULARY, withTag, type PaletteColor, type Vocabulary } from '@schematic/schema';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { create } from 'zustand';

import { ApiError, api, type Role } from './api';
import { useLiveList } from './use-live-list';

/** What the canvas is told about its plan's project, to draw with and to link to. */
export interface PlanVocabulary {
  project: { id: string; slug: string; name: string };
  workspace: { slug: string };
  role: Role;
  canEdit: boolean;
  vocabulary: Vocabulary;
}

const send = (body: unknown): RequestInit => ({ body: JSON.stringify(body) });

export const vocabularies = {
  read: (projectId: string) => api<Vocabulary>(`/projects/${projectId}/vocabulary`),
  replace: (projectId: string, vocabulary: Vocabulary) =>
    api<Vocabulary>(`/projects/${projectId}/vocabulary`, { method: 'PUT', ...send(vocabulary) }),
  addTag: (projectId: string, name: string, color?: PaletteColor) =>
    api<Vocabulary>(`/projects/${projectId}/vocabulary/tags`, {
      method: 'POST',
      ...send({ name, ...(color !== undefined && { color }) }),
    }),
  forPlan: (planId: string) => api<PlanVocabulary>(`/plans/${planId}/vocabulary`),
  forShare: (token: string) => api<Vocabulary>(`/share/${token}/vocabulary`),
};

/** A change, as what it does to whatever the vocabulary is by the time it is saved. */
export type VocabularyEdit = (vocabulary: Vocabulary) => Vocabulary;

export interface VocabularyRemote {
  read: (projectId: string) => Promise<Vocabulary>;
  replace: (projectId: string, vocabulary: Vocabulary) => Promise<Vocabulary>;
  addTag: (projectId: string, name: string, color?: PaletteColor) => Promise<Vocabulary>;
}

interface Entry {
  /** What the server last said. Null until it has said anything. */
  confirmed: Vocabulary | null;
  /** Edits made here and not yet saved, drawn on top of what is confirmed. */
  pending: { id: number; edit: VocabularyEdit }[];
  error: unknown;
}

interface VocabularyState {
  projects: Record<string, Entry>;
}

const EMPTY: Entry = { confirmed: null, pending: [], error: null };

function drawn(entry: Entry | null): Vocabulary {
  if (entry === null) return DEFAULT_VOCABULARY;
  return entry.pending.reduce(
    (vocabulary, one) => one.edit(vocabulary),
    entry.confirmed ?? DEFAULT_VOCABULARY,
  );
}

/** How many times an edit is replayed onto somebody else's newer save. */
const REBASES = 3;

/**
 * Every project's vocabulary this tab has seen, and the edits on their way.
 *
 * Shared, because the same words are on every card, in the inspector and in
 * the settings screen at once, and a tag made in one has to show in the others
 * without each asking the server.
 *
 * An edit is kept as a function rather than as the vocabulary it produced.
 * Saves go one at a time; each is applied to what the server last said, and
 * when somebody else saved first the server says 409 and the edit is replayed
 * onto their version. So two people renaming two different statuses both get
 * their rename — nobody overwrites anybody — and the screen shows the edit the
 * moment it is made rather than after the round trip.
 */
export function createVocabularyStore(remote: VocabularyRemote) {
  const store = create<VocabularyState>(() => ({ projects: {} }));
  const queues = new Map<string, Promise<unknown>>();
  let sequence = 0;

  const entry = (projectId: string): Entry => store.getState().projects[projectId] ?? EMPTY;
  const patch = (projectId: string, change: (current: Entry) => Partial<Entry>): void =>
    store.setState((state) => {
      const current = state.projects[projectId] ?? EMPTY;
      return { projects: { ...state.projects, [projectId]: { ...current, ...change(current) } } };
    });

  /** One save after another, per project, so a save never races its own predecessor. */
  const enqueue = <T>(projectId: string, run: () => Promise<T>): Promise<T> => {
    const next = (queues.get(projectId) ?? Promise.resolve()).then(run, run);
    queues.set(
      projectId,
      next.catch(() => undefined),
    );
    return next;
  };

  /** What the server said. A save that went through also puts away the last failure. */
  const confirm = (projectId: string, vocabulary: Vocabulary, saved = false): void => {
    patch(projectId, (current) => ({
      // A read that arrives after a newer save is older news.
      ...(current.confirmed === null || current.confirmed.version <= vocabulary.version
        ? { confirmed: vocabulary }
        : {}),
      ...(saved && { error: null }),
    }));
  };

  const reload = async (projectId: string): Promise<Vocabulary> => {
    const fresh = await remote.read(projectId);
    confirm(projectId, fresh);
    return fresh;
  };

  return {
    store,

    /** What to draw: the server's copy with this tab's unsaved edits on top. */
    current(projectId: string): Vocabulary {
      return drawn(entry(projectId));
    },

    seed: confirm,
    reload,

    /** Whether the server has said anything about this project yet. */
    has(projectId: string): boolean {
      return entry(projectId).confirmed !== null;
    },

    async edit(projectId: string, edit: VocabularyEdit): Promise<void> {
      const id = (sequence += 1);
      patch(projectId, (current) => ({ pending: [...current.pending, { id, edit }] }));
      try {
        await enqueue(projectId, async () => {
          let base = entry(projectId).confirmed ?? (await reload(projectId));
          for (let attempt = 0; ; attempt += 1) {
            try {
              confirm(projectId, await remote.replace(projectId, edit(base)), true);
              return;
            } catch (error) {
              const conflict = error instanceof ApiError && error.status === 409;
              if (!conflict || attempt >= REBASES) throw error;
              base = await reload(projectId);
            }
          }
        });
      } catch (error) {
        patch(projectId, () => ({ error }));
        // What is on the server is what is true; the edit that failed is dropped.
        await reload(projectId).catch(() => undefined);
      } finally {
        patch(projectId, (current) => ({
          pending: current.pending.filter((one) => one.id !== id),
        }));
      }
    },

    /** A tag typed into a node. Idempotent on the server, so it needs no version. */
    async addTag(projectId: string, name: string, color?: PaletteColor): Promise<void> {
      const id = (sequence += 1);
      patch(projectId, (current) => ({
        pending: [
          ...current.pending,
          { id, edit: (vocabulary) => withTag(vocabulary, name, color) },
        ],
      }));
      try {
        confirm(
          projectId,
          await enqueue(projectId, () => remote.addTag(projectId, name, color)),
          true,
        );
      } catch (error) {
        patch(projectId, () => ({ error }));
      } finally {
        patch(projectId, (current) => ({
          pending: current.pending.filter((one) => one.id !== id),
        }));
      }
    },
  };
}

export const vocabularyStore = createVocabularyStore(vocabularies);

export interface ProjectVocabulary {
  vocabulary: Vocabulary;
  /** False until the server has answered once. */
  loaded: boolean;
  error: unknown;
  edit: (edit: VocabularyEdit) => Promise<void>;
  addTag: (name: string, color?: PaletteColor) => Promise<void>;
}

/**
 * A project's vocabulary, read now and again whenever the window comes back to
 * the front — somebody else may have added a status meanwhile, and there is no
 * socket for a project the way there is for a plan.
 */
export function useProjectVocabulary(projectId: string | null): ProjectVocabulary {
  useLiveList(
    (reason) => {
      if (projectId === null) return;
      // Somebody already read it for this screen (the plan page does, with
      // the plan). Coming back to the window is still worth a read.
      if (reason === 'first' && vocabularyStore.has(projectId)) return;
      void vocabularyStore.reload(projectId).catch(() => undefined);
    },
    [projectId],
  );

  const entry = vocabularyStore.store((state) =>
    projectId === null ? null : (state.projects[projectId] ?? null),
  );
  const vocabulary = useMemo(() => drawn(entry), [entry]);

  const edit = useCallback(
    (change: VocabularyEdit) =>
      projectId === null ? Promise.resolve() : vocabularyStore.edit(projectId, change),
    [projectId],
  );
  const addTag = useCallback(
    (name: string, color?: PaletteColor) =>
      projectId === null ? Promise.resolve() : vocabularyStore.addTag(projectId, name, color),
    [projectId],
  );

  return {
    vocabulary,
    loaded: projectId === null || (entry?.confirmed ?? null) !== null,
    error: entry?.error ?? null,
    edit,
    addTag,
  };
}

/** A plan's words, as the panels beside its canvas use them. */
export interface PlanWords extends ProjectVocabulary {
  plan: PlanVocabulary | null;
  /** Whether this reader may change the project's words. */
  canEdit: boolean;
  /** Where the project's vocabulary is edited, once it is known. */
  editHref: string | null;
}

/** For a panel shown with no project behind it: the defaults, and nothing to edit. */
export const DEFAULT_WORDS: PlanWords = {
  vocabulary: DEFAULT_VOCABULARY,
  loaded: true,
  error: null,
  edit: () => Promise.resolve(),
  addTag: () => Promise.resolve(),
  plan: null,
  canEdit: false,
  editHref: null,
};

/**
 * The vocabulary of the project a plan is in, and what the canvas needs to
 * offer editing it. Until the answer arrives — or if it never does — the plan
 * is drawn with the defaults, which is what every plan was drawn with before.
 */
export function usePlanVocabulary(planId: string): PlanWords {
  const [plan, setPlan] = useState<PlanVocabulary | null>(null);

  useEffect(() => {
    let live = true;
    vocabularies
      .forPlan(planId)
      .then((found) => {
        if (!live) return;
        vocabularyStore.seed(found.project.id, found.vocabulary);
        setPlan(found);
      })
      .catch(() => undefined);
    return () => {
      live = false;
    };
  }, [planId]);

  const project = useProjectVocabulary(plan?.project.id ?? null);
  return {
    ...project,
    // With no project known yet the defaults stand in, which is not the same
    // as having read this plan's words.
    loaded: plan !== null && project.loaded,
    plan,
    canEdit: plan?.canEdit ?? false,
    editHref:
      plan === null
        ? null
        : `/workspace/${plan.workspace.slug}/project/${plan.project.slug}/settings#vocabulary`,
  };
}

/** What a shared plan is drawn with. Read once: a shared link is a snapshot. */
export function useSharedVocabulary(token: string): Vocabulary {
  const [vocabulary, setVocabulary] = useState<Vocabulary>(DEFAULT_VOCABULARY);
  useEffect(() => {
    let live = true;
    vocabularies
      .forShare(token)
      .then((found) => live && setVocabulary(found))
      .catch(() => undefined);
    return () => {
      live = false;
    };
  }, [token]);
  return vocabulary;
}
