import type { Metadata } from 'next';

import { pageMetadata } from '@/components/Document';
import { SitePage } from '@/components/SitePage';

export const metadata: Metadata = pageMetadata('home', 'en');

export default function Home() {
  return <SitePage page="home" locale="en" />;
}
