import {
  createI18n as createSharedI18n,
  isLanguage,
  languageStorageKey,
  type LanguageType,
} from 'frontend-shared';
import { type i18n } from 'i18next';

import { en } from './en.js';
import { ru } from './ru.js';

/** The language of the interface; see `createI18n` of the shared package. */
export function createI18n(language?: LanguageType): i18n {
  return createSharedI18n({ en: { translation: en }, ru: { translation: ru } }, language);
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
