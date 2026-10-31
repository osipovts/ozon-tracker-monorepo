import { SegmentedControl, useMantineColorScheme } from '@mantine/core';
import type { ReactElement } from 'react';
import { useTranslation } from 'react-i18next';

type ColorSchemeType = 'auto' | 'light' | 'dark';

function isColorScheme(value: string): value is ColorSchemeType {
  return value === 'auto' || value === 'light' || value === 'dark';
}

/** The theme follows the system until the person picks one; the pick is kept by the browser. */
export function ColorSchemeControl({ size = 'sm' }: { size?: 'xs' | 'sm' }): ReactElement {
  const { t } = useTranslation();
  const { colorScheme, setColorScheme } = useMantineColorScheme();

  return (
    <SegmentedControl
      size={size}
      aria-label={t('common.theme')}
      value={colorScheme}
      data={[
        { value: 'auto', label: t('common.auto') },
        { value: 'light', label: t('common.light') },
        { value: 'dark', label: t('common.dark') },
      ]}
      onChange={(next): void => {
        if (isColorScheme(next)) setColorScheme(next);
      }}
    />
  );
}
