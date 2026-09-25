import { Select } from '@/components/ui/select';
import { LOCALE_NAMES, LOCALES, useI18n, type Locale } from '@/i18n';

const OPTIONS = LOCALES.map((locale) => ({ value: locale, label: LOCALE_NAMES[locale] }));

/** Switches the whole application at once, and remembers it in this browser. */
export function LanguagePicker({ id, className }: { id?: string; className?: string }) {
  const locale = useI18n((state) => state.locale);
  const setLocale = useI18n((state) => state.setLocale);

  return (
    <Select<Locale>
      id={id}
      value={locale}
      options={OPTIONS}
      onChange={(next) => void setLocale(next)}
      className={className}
    />
  );
}
