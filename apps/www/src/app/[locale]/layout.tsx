import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import type { ReactNode } from 'react';

import '../globals.css';

import { Document, siteMetadata } from '@/components/Document';
import { localeOf, PREFIXED } from '@/i18n/locales';

// Every language is built ahead of time; an unknown prefix is not a page.
export const dynamicParams = false;

export function generateStaticParams(): { locale: string }[] {
  return Object.keys(PREFIXED).map((locale) => ({ locale }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const locale = localeOf((await params).locale);
  return locale === null ? {} : siteMetadata(locale);
}

export default async function LocalizedLayout({
  params,
  children,
}: {
  params: Promise<{ locale: string }>;
  children: ReactNode;
}) {
  const locale = localeOf((await params).locale);
  if (locale === null) notFound();
  return <Document locale={locale}>{children}</Document>;
}
