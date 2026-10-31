import { SegmentedControl } from '@mantine/core';
import type { ReactElement } from 'react';
import { useTranslation } from 'react-i18next';

import { chooseLanguage, isLanguage, languages } from '../i18n/i18n.js';

/** The language follows the browser until the person picks one; the pick is kept by the browser. */
export function LanguageControl(): ReactElement {
  const { t, i18n } = useTranslation();

  return (
    <SegmentedControl
      size="xs"
      aria-label={t('common.language')}
      value={i18n.resolvedLanguage ?? 'en'}
      data={languages.map((language): { value: string; label: string } => ({
        value: language,
        label: language.toUpperCase(),
      }))}
      onChange={(next): void => {
        if (isLanguage(next)) void chooseLanguage(i18n, next);
      }}
    />
  );
}
