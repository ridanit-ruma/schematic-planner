import * as Y from 'yjs';

/**
 * What a plan is at, right now.
 *
 * Nothing is stored and no column is added: the state vector *is* the
 * document's own clock, so it is already atomic with every write, and it is
 * already right during the window in which the stored row is not. Plans persist
 * on a debounce, so `Plan.updatedAt` and anything kept beside it lag the live
 * document by seconds — a token taken from the row would report agreement where
 * there is none, which is the one failure a concurrency check may not have.
 *
 * Opaque on purpose. It answers "is this still what I read", never "which of
 * these is newer".
 */
export function planRevision(doc: Y.Doc): string {
  return Buffer.from(Y.encodeStateVector(doc)).toString('base64');
}

/** A batch written against a revision the plan has since moved past. */
export class StaleRevisionError extends Error {
  constructor(
    readonly expected: string,
    readonly current: string,
  ) {
    super('the plan has changed since that revision');
    this.name = 'StaleRevisionError';
  }
}

/**
 * The same value, from stored bytes rather than from a live document.
 *
 * A listing would otherwise have to materialise every plan to say what each
 * one is at. Yjs can read a state vector straight out of an encoded update, so
 * a stored plan costs a decode and no document.
 */
export function planRevisionFromUpdate(update: Uint8Array | null): string {
  if (update === null || update.length === 0) return '';
  return Buffer.from(Y.encodeStateVectorFromUpdate(update)).toString('base64');
}
