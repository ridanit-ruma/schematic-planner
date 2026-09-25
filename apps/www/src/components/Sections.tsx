import type { ReactNode } from 'react';

/** A full-width band of the landing page, ruled off from the one above. */
export function Band({ children }: { children: ReactNode }) {
  return (
    <section className="border-t border-rule">
      <div className="mx-auto max-w-5xl px-5 py-12 sm:px-6 sm:py-16">{children}</div>
    </section>
  );
}

/** One step of a numbered walkthrough. */
export function Step({ title, body }: { title: string; body: string }) {
  return (
    <li className="border-l-2 border-rule pl-4">
      <h3 className="text-sm font-medium text-ink">{title}</h3>
      <p className="mt-1 max-w-[62ch] text-base leading-[1.65] text-ink-muted">{body}</p>
    </li>
  );
}
