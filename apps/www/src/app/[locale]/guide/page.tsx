import { SitePage } from '@/components/SitePage';
import { localizedMetadata, routeLocale, type LocaleParams } from '@/lib/localized-route';

export const generateMetadata = localizedMetadata('guide');

export default async function LocalizedGuide(props: LocaleParams) {
  return <SitePage page="guide" locale={await routeLocale(props)} />;
}
