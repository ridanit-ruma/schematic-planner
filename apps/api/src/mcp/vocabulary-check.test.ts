import { DEFAULT_VOCABULARY, planOpsSchema, type Vocabulary } from '@schematic/schema';
import { describe, expect, it } from 'vitest';

import { agentOpSchema } from './mcp.schemas.js';
import { checkVocabulary } from './vocabulary-check.js';

const vocabulary: Vocabulary = {
  ...DEFAULT_VOCABULARY,
  statuses: [
    ...DEFAULT_VOCABULARY.statuses.map((one) =>
      one.id === 'planned' ? { ...one, archived: true } : one,
    ),
    { id: 'in-review', name: 'In review', color: 'purple', category: 'active', archived: false },
  ],
  kinds: [
    ...DEFAULT_VOCABULARY.kinds,
    { id: 'spike', name: 'Spike', look: 'dashed', work: true, archived: false },
  ],
};

const doc = {
  nodes: [
    { slug: 'old', title: 'Old', kind: 'task', status: 'planned' },
    { slug: 'legacy', title: 'Legacy', kind: 'epic', status: 'shipped' },
  ].map((node) => ({
    ...node,
    body: '',
    position: null,
    pinned: false,
    size: null,
    tags: [],
    meta: {},
  })),
};

const ops = (...raw: unknown[]) => planOpsSchema.parse(raw);

describe('what an agent may write as a kind or status', () => {
  it('accepts any string at the tool boundary, leaving the check to the project', () => {
    const parsed = agentOpSchema.safeParse({
      op: 'upsert_node',
      node: { slug: 'a', kind: 'spike', status: 'in-review' },
    });
    expect(parsed.success).toBe(true);
  });

  it('takes the ids the project has', () => {
    const checked = checkVocabulary(
      ops({ op: 'upsert_node', node: { slug: 'a', kind: 'spike', status: 'in-review' } }),
      doc,
      vocabulary,
    );
    expect(checked.ok).toBe(true);
  });

  it('writes a name as the id it belongs to', () => {
    const checked = checkVocabulary(
      ops({ op: 'upsert_node', node: { slug: 'a', kind: 'Spike', status: 'in review' } }),
      doc,
      vocabulary,
    );
    expect(checked.ok && checked.ops[0]).toMatchObject({
      node: { kind: 'spike', status: 'in-review' },
    });
  });

  it('refuses a word the project does not have, naming the valid ones, and applies nothing', () => {
    const checked = checkVocabulary(
      ops(
        { op: 'upsert_node', node: { slug: 'fine', title: 'Fine' } },
        { op: 'upsert_node', node: { slug: 'a', status: 'shipped' } },
      ),
      doc,
      vocabulary,
    );
    expect(checked.ok).toBe(false);
    if (!checked.ok) {
      expect(checked.message).toContain('Nothing was applied');
      expect(checked.message).toContain('a: The status "shipped"');
      expect(checked.message).toContain('in-review (In review)');
      expect(checked.message).not.toContain('planned');
    }
  });

  it('refuses an archived value for a node that does not already have it', () => {
    const checked = checkVocabulary(
      ops({ op: 'upsert_node', node: { slug: 'a', status: 'planned' } }),
      doc,
      vocabulary,
    );
    expect(checked.ok).toBe(false);
  });

  it('lets a node keep what it already carries, archived or unknown', () => {
    const checked = checkVocabulary(
      ops(
        { op: 'upsert_node', node: { slug: 'old', status: 'planned' } },
        { op: 'upsert_node', node: { slug: 'legacy', kind: 'epic', status: 'shipped' } },
      ),
      doc,
      vocabulary,
    );
    expect(checked.ok).toBe(true);
  });

  it('follows a node through a rename in the same batch', () => {
    const checked = checkVocabulary(
      ops(
        { op: 'rename_node', from: 'old', to: 'renamed' },
        { op: 'upsert_node', node: { slug: 'renamed', status: 'planned' } },
      ),
      doc,
      vocabulary,
    );
    expect(checked.ok).toBe(true);
  });
});
