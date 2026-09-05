import type { Metadata } from 'next';

import { SiteChrome } from '@/components/SiteChrome';

export const metadata: Metadata = { title: 'Privacy' };

export default function Privacy() {
  return (
    <SiteChrome>
      <article className="mx-auto max-w-2xl px-6 py-16">
        <h1 className="text-xl font-semibold tracking-tight text-ink">Privacy</h1>
        <p className="mt-4 text-sm leading-relaxed text-ink-muted">
          This page is a placeholder. Replace it before opening the service to the public.
        </p>
        <p className="mt-4 text-sm leading-relaxed text-ink-muted">
          What a self-hosted instance stores is described in the repository: accounts, workspaces,
          plans, and the API keys used to connect agents. Nothing is sent anywhere else.
        </p>
      </article>
    </SiteChrome>
  );
}
