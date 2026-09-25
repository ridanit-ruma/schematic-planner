import { SitePage } from '@/components/SitePage';
import { localizedMetadata, routeLocale, type LocaleParams } from '@/lib/localized-route';

export const generateMetadata = localizedMetadata('terms');

export default async function LocalizedTerms(props: LocaleParams) {
  return <SitePage page="terms" locale={await routeLocale(props)} />;
}
