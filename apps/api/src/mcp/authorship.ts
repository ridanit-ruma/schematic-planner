import type { PlanOp } from '@schematic/schema';

/**
 * How a note left by an agent signs itself.
 *
 * A key acts as its owner, so the note says whose agent left it rather than
 * naming the key: a person reading the canvas wants to know who is answerable
 * for the question, not which credential carried it.
 */
export function agentAuthor(owner: string): string {
  const name = owner.trim();
  return name === '' ? 'An agent' : `${name}'s agent`;
}

/**
 * Signs the notes in a batch on the way in.
 *
 * The agent surface has no author field at all — there is nothing an agent
 * could put there that is worth trusting — so every note it left arrived
 * anonymous and was drawn as "Someone", which is what an unsigned note from a
 * person looks like too. The server knows whose key it is, so it says.
 *
 * Only ops carrying a body are signed. An upsert merges, so signing one that
 * says nothing would rewrite the name on somebody else's note the moment an
 * agent resolved it — and settling a question is not claiming to have asked it.
 * An author already present is left alone for the same reason.
 */
export function signComments(ops: readonly PlanOp[], author: string): PlanOp[] {
  return ops.map((op) =>
    op.op === 'upsert_comment' &&
    op.comment.body !== undefined &&
    op.comment.author === undefined
      ? { ...op, comment: { ...op.comment, author } }
      : op,
  );
}
