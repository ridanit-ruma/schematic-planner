import { SitePage } from '@/components/SitePage';
import { localizedMetadata, routeLocale, type LocaleParams } from '@/lib/localized-route';

export const generateMetadata = localizedMetadata('docs');

export default async function LocalizedDocs(props: LocaleParams) {
  return <SitePage page="docs" locale={await routeLocale(props)} />;
}
