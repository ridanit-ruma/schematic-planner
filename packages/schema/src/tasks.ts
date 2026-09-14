/**
 * The task lists in a body, as string work.
 *
 * A note on the canvas can ask a question and offer its answers as `- [ ]`
 * items, and a person answers by ticking one. That makes two places care about
 * the same thing: the canvas, which has to know which box was clicked and what
 * the body becomes, and the differ, which has to tell an answer apart from
 * somebody rewriting the note. Both ask here.
 *
 * Deliberately not a Markdown parse. What is needed is the position of one
 * character, and a parser would give back a tree that has forgotten it.
 */

export interface TaskItem {
  /** Index of the marker character itself — the space or the x in the brackets. */
  readonly at: number;
  readonly checked: boolean;
  readonly label: string;
}

/** A bullet or an ordered marker, then a box, then the words. */
const ITEM = /^(\s*(?:[-*+]|\d+[.)])\s+\[)([ xX])\]\s*(.*)$/;
const FENCE = /^\s*(?:```|~~~)/;

/**
 * Every task item in the body, in the order they are written.
 *
 * Line by line rather than by parsing, and fenced blocks are skipped: a list
 * inside one is a picture of a list, and ticking it would edit an example.
 */
export function taskItems(body: string): TaskItem[] {
  const items: TaskItem[] = [];
  let offset = 0;
  let fenced = false;

  for (const line of body.split('\n')) {
    if (FENCE.test(line)) {
      fenced = !fenced;
    } else if (!fenced) {
      const found = ITEM.exec(line);
      if (found !== null) {
        const before = found[1] ?? '';
        const marker = found[2] ?? ' ';
        const label = found[3] ?? '';
        items.push({ at: offset + before.length, checked: marker !== ' ', label: label.trim() });
      }
    }
    // The newline the split took off.
    offset += line.length + 1;
  }

  return items;
}

/**
 * The body with one box flipped.
 *
 * One character replaced, so `minimalEdit` sends a one-character edit to the
 * shared document and two people answering the same note merge rather than
 * overwriting each other.
 */
export function toggleTask(body: string, index: number): string {
  const item = taskItems(body)[index];
  if (item === undefined) return body;
  return `${body.slice(0, item.at)}${item.checked ? ' ' : 'x'}${body.slice(item.at + 1)}`;
}

/**
 * Whether the difference between two bodies is only which boxes are ticked.
 *
 * The history says "answered" rather than "rewrote" on the strength of this,
 * which is the only place the answer is attributable — the body records what
 * was chosen and nothing about who chose it.
 */
export function onlyTaskFlips(before: string, after: string): boolean {
  const was = taskItems(before);
  const is = taskItems(after);
  if (was.length === 0 || was.length !== is.length) return false;
  if (blankMarkers(before) !== blankMarkers(after)) return false;
  return was.some((item, at) => item.checked !== is[at]?.checked);
}

/** The body with every marker blanked, which keeps its length and its offsets. */
function blankMarkers(body: string): string {
  let blanked = body;
  for (const item of taskItems(body)) {
    blanked = `${blanked.slice(0, item.at)} ${blanked.slice(item.at + 1)}`;
  }
  return blanked;
}
