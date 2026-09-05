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
    <article className="mx-auto max-w-2xl px-6 py-16">
      <h1 className="text-xl font-semibold tracking-tight text-ink">{title}</h1>
      {updated !== undefined ? (
        <p className="mt-2 text-xs text-ink-faint">Last updated {updated}</p>
      ) : null}
      {lede !== undefined ? (
        <p className="mt-4 text-base leading-relaxed text-ink-muted">{lede}</p>
      ) : null}

      <div
        className={[
          'mt-10 space-y-6',
          '[&_h2]:mt-12 [&_h2]:text-base [&_h2]:font-medium [&_h2]:text-ink',
          '[&_h3]:mt-8 [&_h3]:text-sm [&_h3]:font-medium [&_h3]:text-ink',
          '[&_p]:text-sm [&_p]:leading-relaxed [&_p]:text-ink-muted',
          '[&_li]:text-sm [&_li]:leading-relaxed [&_li]:text-ink-muted',
          '[&_ul]:list-disc [&_ul]:space-y-2 [&_ul]:pl-5',
          '[&_ol]:list-decimal [&_ol]:space-y-2 [&_ol]:pl-5',
          '[&_a]:text-accent [&_a]:underline',
          '[&_strong]:font-medium [&_strong]:text-ink',
          '[&_code]:font-mono [&_code]:text-xs [&_code]:text-ink',
          '[&_pre]:overflow-x-auto [&_pre]:border [&_pre]:border-rule [&_pre]:bg-surface',
          '[&_pre]:p-4 [&_pre]:font-mono [&_pre]:text-xs [&_pre]:leading-relaxed [&_pre]:text-ink',
        ].join(' ')}
      >
        {children}
      </div>
    </article>
  );
}
