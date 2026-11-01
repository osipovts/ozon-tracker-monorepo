import { SegmentedControl } from '@mantine/core';
import { isLanguage, languages } from 'frontend-shared';
import { type ReactElement, useState } from 'react';
import { useTranslation } from 'react-i18next';

import { chooseLanguage, type LanguageChoiceType, storedLanguageChoice } from '../i18n/i18n.js';

/** The language follows the browser until the person picks one; the pick is kept by the browser. */
export function LanguageControl({ size = 'sm' }: { size?: 'xs' | 'sm' }): ReactElement {
  const { t, i18n } = useTranslation();
  const [choice, setChoice] = useState<LanguageChoiceType>(storedLanguageChoice);

  return (
    <SegmentedControl
      size={size}
      aria-label={t('common.language')}
      value={choice}
      data={[
        { value: 'auto', label: t('common.auto') },
        ...languages.map((language): { value: string; label: string } => ({
          value: language,
          label: language.toUpperCase(),
        })),
      ]}
      onChange={(next): void => {
        if (next !== 'auto' && !isLanguage(next)) return;

        setChoice(next);
        void chooseLanguage(i18n, next);
      }}
    />
  );
}
