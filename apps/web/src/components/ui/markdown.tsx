import { shapeForDisplay } from '@schematic/body';
import { taskItems } from '@schematic/schema';
import { memo } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';

import { useT } from '@/i18n';
import { cn } from '@/lib/utils';

import { safeUrl } from './safe-url';
import './markdown.css';

/**
 * What a body may be drawn with: the blocks the editor makes, and nothing else.
 *
 * Headings, tables, toggles and callouts are here because the editor makes
 * them, and a card that drew them as flat lines would be drawing something
 * other than what was written. Images and raw HTML are still not: the narrow
 * subset is also the narrow surface, since a plan opens through a share link
 * with no login.
 *
 * `input` is deliberately absent. remark-gfm draws a disabled checkbox for a
 * task item; the `li` below draws its own instead, so one place owns what a
 * checkbox is and what happens when it is clicked.
 */
const ALLOWED = [
  'p',
  'strong',
  'em',
  'del',
  'code',
  'pre',
  'a',
  'ul',
  'ol',
  'li',
  'blockquote',
  'hr',
  'br',
  'h1',
  'h2',
  'h3',
  'h4',
  'h5',
  'h6',
  'table',
  'thead',
  'tbody',
  'tr',
  'th',
  'td',
  'details',
  'summary',
];

/** Toggles, callouts and line breaks, drawn the way the editor draws them. */
const remarkBody = () => (tree: Parameters<typeof shapeForDisplay>[0], file: { value: unknown }) =>
  shapeForDisplay(tree, String(file.value));

/**
 * Markdown, as React elements.
 *
 * No HTML string is built anywhere on this path, so there is no
 * `dangerouslySetInnerHTML` to get wrong — which is the whole reason this
 * library rather than a renderer that hands back markup to inject.
 *
 * `onToggleTask` is what makes a checkbox live. Without it the boxes are drawn
 * disabled, which is what a reader of a shared plan gets.
 */
function Rendered({
  body,
  onToggleTask,
  className,
}: {
  body: string;
  onToggleTask?: (index: number) => void;
  className?: string;
}) {
  const t = useT();
  const items = taskItems(body);

  return (
    <div
      className={cn(
        // A pasted URL or any run with no space in it is still broken at the
        // edge. `anywhere` rather than `break-word`: a task item is a flex row,
        // and only `anywhere` lets the words inside one shrink below their
        // longest run.
        'space-y-1.5 text-xs leading-relaxed text-ink wrap-anywhere',
        '[&_ul]:list-disc [&_ol]:list-decimal [&_ul]:pl-4 [&_ol]:pl-4 [&_li]:my-0.5',
        '[&_code]:rounded [&_code]:bg-surface-4 [&_code]:px-1 [&_code]:py-px [&_code]:text-2xs',
        '[&_pre]:overflow-x-auto [&_pre]:rounded [&_pre]:bg-surface-4 [&_pre]:p-2',
        '[&_a]:text-accent [&_a]:underline [&_a]:underline-offset-2',
        '[&_blockquote]:border-l-2 [&_blockquote]:border-rule-strong [&_blockquote]:pl-2',
        '[&_hr]:border-rule',
        'body-markdown',
        className,
      )}
    >
      <ReactMarkdown
        remarkPlugins={[remarkGfm, remarkBody]}
        allowedElements={ALLOWED}
        unwrapDisallowed
        urlTransform={(url) => safeUrl(url) ?? ''}
        components={{
          a: ({ href, children, ...rest }) =>
            // urlTransform blanks a scheme that is not allowed, and an anchor
            // with an empty href is a link back to this page — a working link to
            // somewhere the writer did not choose. So there is no anchor at all:
            // the words stay, the link does not.
            href === undefined || href === '' ? (
              <span>{children}</span>
            ) : (
              // Somebody else's plan is somebody else's link.
              <a {...rest} href={href} target="_blank" rel="noreferrer noopener nofollow">
                {children}
              </a>
            ),
          li: ({ children, className: liClass, node, ...rest }) => {
            const marked = String(liClass ?? '').includes('task-list-item');
            if (!marked) {
              return (
                <li className={liClass} {...rest}>
                  {children}
                </li>
              );
            }

            // Which box this is, by where it sits in the source. An ordinal
            // taken from render order is wrong the moment React renders twice.
            const start = node?.position?.start?.offset ?? -1;
            const index = items.findIndex((item) => item.at >= start);
            const item = index === -1 ? undefined : items[index];

            return (
              <li className={cn(liClass, '-ml-4 flex list-none items-start gap-1.5')} {...rest}>
                <input
                  type="checkbox"
                  checked={item?.checked ?? false}
                  disabled={onToggleTask === undefined || item === undefined}
                  aria-label={item?.label ?? t.ui.markdown.task}
                  // Otherwise ticking a box in a note also opens its editor, and
                  // the answer is lost under a textarea.
                  onClick={(event) => event.stopPropagation()}
                  onPointerDown={(event) => event.stopPropagation()}
                  onChange={() => {
                    if (item !== undefined) onToggleTask?.(index);
                  }}
                  className="mt-0.5 size-3 shrink-0 accent-accent"
                />
                <span className="min-w-0 flex-1">{children}</span>
              </li>
            );
          },
        }}
      >
        {body}
      </ReactMarkdown>
    </div>
  );
}

export const Markdown = memo(Rendered);

/**
 * The first line, with the syntax taken off.
 *
 * A card shows one line of a body and has never rendered it, so `**bold**` was
 * drawn with its asterisks. This is not a renderer and does not want to be — the
 * card is a label, and a label with formatting in it stops lining up with the
 * labels beside it.
 */
export function plainExcerpt(body: string): string {
  const first = body.trim().split('\n')[0] ?? '';
  return first
    .replace(/^\s*(?:[-*+]|\d+[.)])\s+(?:\[[ xX]\]\s*)?/, '')
    .replace(/^#{1,6}\s+/, '')
    .replace(/^>\s?/, '')
    .replace(/!?\[([^\]]*)\]\([^)]*\)/g, '$1')
    .replace(/`([^`]*)`/g, '$1')
    .replace(/(\*\*|__)(.*?)\1/g, '$2')
    .replace(/(\*|_)(.*?)\1/g, '$2')
    .replace(/~~(.*?)~~/g, '$1')
    .trim();
}
