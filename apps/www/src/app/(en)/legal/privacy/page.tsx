import type { Metadata } from 'next';

import { pageMetadata } from '@/components/Document';
import { SitePage } from '@/components/SitePage';

export const metadata: Metadata = pageMetadata('privacy', 'en');

export default function Privacy() {
  return <SitePage page="privacy" locale="en" />;
}
