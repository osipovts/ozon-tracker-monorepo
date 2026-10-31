import { SegmentedControl, useMantineColorScheme } from '@mantine/core';
import type { ReactElement } from 'react';

type ColorSchemeType = 'auto' | 'light' | 'dark';

function isColorScheme(value: string): value is ColorSchemeType {
  return value === 'auto' || value === 'light' || value === 'dark';
}

/** The theme follows the system until the person picks one; the pick is kept by the browser. */
export function ColorSchemeControl(): ReactElement {
  const { colorScheme, setColorScheme } = useMantineColorScheme();

  return (
    <SegmentedControl
      size="xs"
      aria-label="Theme"
      value={colorScheme}
      data={[
        { value: 'auto', label: 'Auto' },
        { value: 'light', label: 'Light' },
        { value: 'dark', label: 'Dark' },
      ]}
      onChange={(next): void => {
        if (isColorScheme(next)) setColorScheme(next);
      }}
    />
  );
}
