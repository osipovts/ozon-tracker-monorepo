import i18next, { type i18n } from 'i18next';
import LanguageDetector from 'i18next-browser-languagedetector';
import { initReactI18next } from 'react-i18next';

import { en } from './en.js';
import { ru } from './ru.js';

export const languages = ['en', 'ru'] as const;
export type LanguageType = (typeof languages)[number];

/** Where the language a person picked is kept; what the browser asked for is not kept, so that it is followed. */
const languageStorageKey = 'language';

export function isLanguage(value: string): value is LanguageType {
  return languages.some((language): boolean => language === value);
}

/**
 * The language of the interface: the one given, else the one the person picked before, else the one the
 * browser asks for (the languages of its `Accept-Language`), else English.
 */
export function createI18n(language?: LanguageType): i18n {
  const instance = i18next.createInstance();
  if (language === undefined) instance.use(LanguageDetector);

  void instance.use(initReactI18next).init({
    resources: { en: { translation: en }, ru: { translation: ru } },
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

/** A language to use, or `auto`: whatever the browser asks for. */
export type LanguageChoiceType = LanguageType | 'auto';

/** The first language the browser asks for that the interface has words in; else English. */
export function browserLanguage(): LanguageType {
  for (const tag of navigator.languages) {
    const base = tag.split('-')[0]?.toLowerCase() ?? '';
    if (isLanguage(base)) return base;
  }

  return 'en';
}

/** What the person picked before; `auto` when they have not, or have asked to follow the browser. */
export function storedLanguageChoice(): LanguageChoiceType {
  try {
    const stored = localStorage.getItem(languageStorageKey);

    return stored !== null && isLanguage(stored) ? stored : 'auto';
  } catch {
    return 'auto';
  }
}

/** The person picks a language: it is used now, and kept for the next visit. `auto` forgets the pick. */
export async function chooseLanguage(instance: i18n, choice: LanguageChoiceType): Promise<void> {
  try {
    if (choice === 'auto') localStorage.removeItem(languageStorageKey);
    else localStorage.setItem(languageStorageKey, choice);
  } catch {
    // The pick is not kept; it holds until the page is closed.
  }
  await instance.changeLanguage(choice === 'auto' ? browserLanguage() : choice);
}
