import { SitePage } from '@/components/SitePage';
import { localizedMetadata, routeLocale, type LocaleParams } from '@/lib/localized-route';

export const generateMetadata = localizedMetadata('privacy');

export default async function LocalizedPrivacy(props: LocaleParams) {
  return <SitePage page="privacy" locale={await routeLocale(props)} />;
}
