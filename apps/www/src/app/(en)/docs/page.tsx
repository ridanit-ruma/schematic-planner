import type { Metadata } from 'next';

import { pageMetadata } from '@/components/Document';
import { SitePage } from '@/components/SitePage';

export const metadata: Metadata = pageMetadata('docs', 'en');

export default function Docs() {
  return <SitePage page="docs" locale="en" />;
}
