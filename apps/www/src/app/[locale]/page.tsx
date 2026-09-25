import { SitePage } from '@/components/SitePage';
import { localizedMetadata, routeLocale, type LocaleParams } from '@/lib/localized-route';

export const generateMetadata = localizedMetadata('home');

export default async function LocalizedHome(props: LocaleParams) {
  return <SitePage page="home" locale={await routeLocale(props)} />;
}
