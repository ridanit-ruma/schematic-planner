import { describe, expect, it } from 'vitest';
import type { PlanOp } from '@schematic/schema';

import { agentAuthor, signComments } from './authorship.js';

describe('how a note left by an agent signs itself', () => {
  it("is the owner's name and whose agent it is", () => {
    expect(agentAuthor('Ruma')).toBe("Ruma's agent");
  });

  it('trims what it is given', () => {
    expect(agentAuthor('  Ruma  ')).toBe("Ruma's agent");
  });

  /* A key whose owner has no name still says an agent wrote it, rather than
     leaving the note to read as "Someone", which is what it did before. */
  it('says an agent wrote it even with no name to use', () => {
    expect(agentAuthor('')).toBe('An agent');
    expect(agentAuthor('   ')).toBe('An agent');
  });
});

describe('signing the notes in a batch', () => {
  const note = (comment: Record<string, unknown>): PlanOp =>
    ({ op: 'upsert_comment', comment }) as PlanOp;

  it('signs a note that says something', () => {
    const [signed] = signComments([note({ id: 'why', body: 'Why here?' })], "Ruma's agent");
    expect(signed).toEqual({
      op: 'upsert_comment',
      comment: { id: 'why', body: 'Why here?', author: "Ruma's agent" },
    });
  });

  /* An upsert merges, so signing one that carries no body would rewrite the
     name on somebody else's note the moment an agent resolved it. */
  it('leaves a note alone when the op only settles it', () => {
    const ops = [note({ id: 'why', resolved: true })];
    expect(signComments(ops, "Ruma's agent")).toEqual(ops);
  });

  it('never overwrites an author that is already there', () => {
    const ops = [note({ id: 'why', body: 'Mine', author: 'Ruma' })];
    expect(signComments(ops, "Ruma's agent")).toEqual(ops);
  });

  it('leaves every other kind of operation untouched', () => {
    const ops = [
      { op: 'set_plan', title: 'Ledger' },
      { op: 'delete_comment', id: 'why' },
    ] as PlanOp[];
    expect(signComments(ops, "Ruma's agent")).toEqual(ops);
  });

  it('signs each note in a batch of several', () => {
    const signed = signComments(
      [note({ id: 'a', body: 'one' }), note({ id: 'b', body: 'two' })],
      "Ruma's agent",
    );
    expect(signed.every((op) => op.op === 'upsert_comment' && op.comment.author === "Ruma's agent")).toBe(true);
  });
});
