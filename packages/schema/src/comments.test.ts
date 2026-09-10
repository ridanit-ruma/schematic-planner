import { describe, expect, it } from 'vitest';

import { diffPlans } from './changes.js';
import { makeDoc } from './fixtures.js';
import { applyPlanOps } from './ops.js';
import { planSpecSchema } from './plan.js';
import { sanitizePlanDoc } from './sanitize.js';

const plan = makeDoc([{ slug: 'api' }, { slug: 'web' }]);

function withNote(body: string, anchor: string | null = 'api') {
  return applyPlanOps(plan, [
    { op: 'upsert_comment', comment: { id: 'why-here', body, anchor, author: 'Ruma' } },
  ]);
}

describe('comments', () => {
  it('is upserted by its id, so saying the same thing twice says it once', () => {
    const once = withNote('Why Postgres and not Redis?');
    const twice = applyPlanOps(once, [
      { op: 'upsert_comment', comment: { id: 'why-here', body: 'Why Postgres and not Redis?' } },
    ]);
    expect(twice.comments).toHaveLength(1);
  });

  it('merges into what is there rather than replacing it', () => {
    const answered = applyPlanOps(withNote('Why here?'), [
      { op: 'upsert_comment', comment: { id: 'why-here', resolved: true } },
    ]);
    const [note] = answered.comments;
    expect(note?.body).toBe('Why here?');
    expect(note?.author).toBe('Ruma');
    expect(note?.resolved).toBe(true);
  });

  it('outlives the node it was about, unanchored', () => {
    const after = applyPlanOps(withNote('This should be two services'), [
      { op: 'delete_node', slug: 'api' },
    ]);
    expect(after.comments).toHaveLength(1);
    expect(after.comments[0]?.anchor).toBeNull();
  });

  it('is let go of on purpose, and only then', () => {
    const after = applyPlanOps(withNote('Never mind'), [
      { op: 'delete_comment', id: 'why-here' },
    ]);
    expect(after.comments).toHaveLength(0);
  });

  it('keeps a note whose anchor has gone missing in the raw document', () => {
    const { doc, dropped } = sanitizePlanDoc({
      id: 'plan-test',
      title: 'Test plan',
      nodes: [{ slug: 'web', title: 'Web' }],
      edges: [],
      comments: [{ id: 'orphan', body: 'Still asking', anchor: 'api' }],
    });
    expect(doc.comments).toHaveLength(1);
    expect(doc.comments[0]?.anchor).toBeNull();
    expect(dropped).toHaveLength(0);
  });

  /* A plan is opened empty and notes are left on it afterwards, by whoever has
     something to say about what is there. */
  it('is not part of the spec a plan can be created from', () => {
    const spec = planSpecSchema.parse({
      title: 'Anything',
      comments: [{ id: 'smuggled', body: 'hello' }],
    });
    expect(spec).not.toHaveProperty('comments');
  });
});

describe('what the history says about a note', () => {
  it('records leaving one, resolving it, and removing it', () => {
    const left = withNote('Why here?');
    expect(diffPlans(plan, left).map((entry) => entry.kind)).toEqual(['note.added']);

    const resolved = applyPlanOps(left, [
      { op: 'upsert_comment', comment: { id: 'why-here', resolved: true } },
    ]);
    expect(diffPlans(left, resolved).map((entry) => entry.kind)).toEqual(['note.resolved']);

    const gone = applyPlanOps(resolved, [{ op: 'delete_comment', id: 'why-here' }]);
    expect(diffPlans(resolved, gone).map((entry) => entry.kind)).toEqual(['note.removed']);
  });

  it('names a note by what it is about', () => {
    const [entry] = diffPlans(plan, withNote('Why here?'));
    expect(entry?.label).toBe('api');
  });

  /* Opening a note and typing into it is one act to the person doing it. */
  it('does not report the first words written into an empty note', () => {
    const empty = withNote('');
    const written = applyPlanOps(empty, [
      { op: 'upsert_comment', comment: { id: 'why-here', body: 'Why here?' } },
    ]);
    expect(diffPlans(empty, written)).toHaveLength(0);
  });
});
