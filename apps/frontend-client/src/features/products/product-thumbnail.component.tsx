import { Box } from '@mantine/core';
import { type ReactElement, useState } from 'react';
import { useTranslation } from 'react-i18next';

/** The picture of a product, or a placeholder when it has none, or the address of it no longer works. */
export function ProductThumbnail({
  url,
  alt,
  size,
}: {
  url: string | null;
  alt: string;
  size: number;
}): ReactElement {
  const { t } = useTranslation();
  // The address of a picture that failed to load is not tried again until the product gives another.
  const [failedUrl, setFailedUrl] = useState<string | null>(null);

  if (url !== null && url !== failedUrl) {
    return (
      <Box
        component="img"
        src={url}
        alt={alt}
        loading="lazy"
        w={size}
        h={size}
        style={{ objectFit: 'contain', borderRadius: 'var(--mantine-radius-sm)', flexShrink: 0 }}
        onError={(): void => {
          setFailedUrl(url);
        }}
      />
    );
  }

  return (
    <Box
      role="img"
      aria-label={t('products.noPicture')}
      w={size}
      h={size}
      c="dimmed"
      bg="var(--mantine-color-default-hover)"
      style={{
        borderRadius: 'var(--mantine-radius-sm)',
        flexShrink: 0,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      <svg
        width={size / 2}
        height={size / 2}
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden="true"
      >
        <rect x="3" y="4" width="18" height="16" rx="2" />
        <circle cx="9" cy="10" r="1.8" />
        <path d="M21 16l-5-5-8 9" />
      </svg>
    </Box>
  );
}
