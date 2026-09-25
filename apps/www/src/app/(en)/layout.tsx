import type { Metadata } from 'next';
import type { ReactNode } from 'react';

import '../globals.css';

import { Document, siteMetadata } from '@/components/Document';

export const metadata: Metadata = siteMetadata('en');

export default function EnglishLayout({ children }: { children: ReactNode }) {
  return <Document locale="en">{children}</Document>;
}
