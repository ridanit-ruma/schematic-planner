import type { ReactNode } from 'react';

/**
 * Long-form pages. Line length is held near 68 characters and headings carry
 * their weight from size rather than colour, so a legal page and a walkthrough
 * read as the same document family.
 */
export function Prose({
  title,
  updated,
  lede,
  children,
}: {
  title: string;
  updated?: string;
  lede?: string;
  children: ReactNode;
}) {
  return (
    <article className="mx-auto max-w-2xl px-6 py-20">
      <h1 className="text-2xl font-semibold tracking-[-0.025em] text-ink">{title}</h1>
      {updated !== undefined ? (
        <p className="mt-2 text-xs text-ink-faint">Last updated {updated}</p>
      ) : null}
      {lede !== undefined ? (
        <p className="mt-4 text-base leading-relaxed text-ink-muted">{lede}</p>
      ) : null}

      <div
        className={[
          'mt-10 space-y-6',
          '[&_h2]:mt-12 [&_h2]:text-lg [&_h2]:font-medium [&_h2]:tracking-[-0.02em] [&_h2]:text-ink',
          '[&_h3]:mt-8 [&_h3]:text-base [&_h3]:font-medium [&_h3]:text-ink',
          '[&_p]:text-base [&_p]:leading-[1.65] [&_p]:text-ink-muted',
          '[&_li]:text-base [&_li]:leading-[1.65] [&_li]:text-ink-muted',
          '[&_ul]:list-disc [&_ul]:space-y-2 [&_ul]:pl-5',
          '[&_ol]:list-decimal [&_ol]:space-y-2 [&_ol]:pl-5',
          '[&_a]:text-accent [&_a]:underline [&_a]:underline-offset-2 [&_a]:decoration-accent/40 hover:[&_a]:decoration-accent',
          '[&_strong]:font-medium [&_strong]:text-ink',
          '[&_code]:rounded-sm [&_code]:border [&_code]:border-rule [&_code]:bg-surface-2 [&_code]:px-1 [&_code]:py-0.5 [&_code]:font-mono [&_code]:text-xs [&_code]:text-ink',
          '[&_pre]:overflow-x-auto [&_pre]:rounded-lg [&_pre]:border [&_pre]:border-rule [&_pre]:bg-surface-2',
          '[&_pre]:p-4 [&_pre]:font-mono [&_pre]:text-xs [&_pre]:leading-relaxed [&_pre]:text-ink',
          // A code block already has its own box; the inline treatment inside
          // one would draw a second.
          '[&_pre_code]:border-0 [&_pre_code]:bg-transparent [&_pre_code]:p-0',
        ].join(' ')}
      >
        {children}
      </div>
    </article>
  );
}
