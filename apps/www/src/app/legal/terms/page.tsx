import type { Metadata } from 'next';

import { SiteChrome } from '@/components/SiteChrome';

export const metadata: Metadata = { title: 'Terms' };

export default function Terms() {
  return (
    <SiteChrome>
      <article className="mx-auto max-w-2xl px-6 py-16">
        <h1 className="text-xl font-semibold tracking-tight text-ink">Terms of service</h1>
        <p className="mt-4 text-sm leading-relaxed text-ink-muted">
          This page is a placeholder. Replace it before opening the service to the public; the
          operator of an instance is responsible for its own terms.
        </p>
        <p className="mt-4 text-sm leading-relaxed text-ink-muted">
          The software itself is licensed under the GNU Affero General Public License v3.0. Running a
          modified version as a network service requires publishing that version&rsquo;s source.
        </p>
      </article>
    </SiteChrome>
  );
}
