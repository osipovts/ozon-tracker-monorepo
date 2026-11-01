import {
  createI18n as createSharedI18n,
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

/** The person picks a language: it is used now, and kept for the next visit. */
export async function chooseLanguage(instance: i18n, language: LanguageType): Promise<void> {
  try {
    localStorage.setItem(languageStorageKey, language);
  } catch {
    // The pick is not kept; it holds until the page is closed.
  }
  await instance.changeLanguage(language);
}
