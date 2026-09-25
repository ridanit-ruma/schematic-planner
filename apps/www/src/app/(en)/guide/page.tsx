import type { Metadata } from 'next';

import { pageMetadata } from '@/components/Document';
import { SitePage } from '@/components/SitePage';

export const metadata: Metadata = pageMetadata('guide', 'en');

export default function Guide() {
  return <SitePage page="guide" locale="en" />;
}
