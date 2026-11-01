import i18next, { type i18n, type Resource } from 'i18next';
import LanguageDetector from 'i18next-browser-languagedetector';
import { initReactI18next } from 'react-i18next';

export const languages = ['en', 'ru'] as const;
export type LanguageType = (typeof languages)[number];

/** Where the language a person picked is kept; what the browser asked for is not kept, so that it is followed. */
export const languageStorageKey = 'language';

export function isLanguage(value: string): value is LanguageType {
  return languages.some((language): boolean => language === value);
}

/**
 * The language of the interface: the one given, else the one the person picked before, else the one the
 * browser asks for (the languages of its `Accept-Language`), else English.
 */
export function createI18n(resources: Resource, language?: LanguageType): i18n {
  const instance = i18next.createInstance();
  if (language === undefined) instance.use(LanguageDetector);

  void instance.use(initReactI18next).init({
    resources,
    ...(language === undefined ? {} : { lng: language }),
    fallbackLng: 'en',
    supportedLngs: languages,
    nonExplicitSupportedLngs: true,
    load: 'languageOnly',
    detection: {
      order: ['localStorage', 'navigator'],
      lookupLocalStorage: languageStorageKey,
      caches: [],
    },
    interpolation: { escapeValue: false },
    initAsync: false,
  });
  const showLanguage = (): void => {
    document.documentElement.lang = instance.resolvedLanguage ?? 'en';
  };
  showLanguage();
  instance.on('languageChanged', showLanguage);

  return instance;
}
