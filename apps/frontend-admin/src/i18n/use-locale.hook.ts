import { useTranslation } from 'react-i18next';

/** The language of the interface, which the dates are written in as well. */
export function useLocale(): string {
  const { i18n } = useTranslation();

  return i18n.resolvedLanguage ?? 'en';
}
