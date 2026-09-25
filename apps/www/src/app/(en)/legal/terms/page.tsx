import type { Metadata } from 'next';

import { pageMetadata } from '@/components/Document';
import { SitePage } from '@/components/SitePage';

export const metadata: Metadata = pageMetadata('terms', 'en');

export default function Terms() {
  return <SitePage page="terms" locale="en" />;
}
