import { MantineProvider } from '@mantine/core';
import { fireEvent, render, screen } from '@testing-library/react';
import { expect, test } from 'vitest';

import { ProductThumbnail } from './product-thumbnail.component.js';

function show(url: string | null): void {
  render(
    <MantineProvider>
      <ProductThumbnail url={url} alt="Notebook" size={88} />
    </MantineProvider>,
  );
}

test('shows the picture at its address', () => {
  show('https://files.example.com/thumbnails/1?X-Amz-Signature=abc');

  expect(screen.getByRole('img', { name: 'Notebook' })).toHaveAttribute(
    'src',
    'https://files.example.com/thumbnails/1?X-Amz-Signature=abc',
  );
});

test('shows a placeholder for a product with no picture', () => {
  show(null);

  expect(screen.getByRole('img', { name: 'No picture' })).toBeInTheDocument();
  expect(screen.queryByAltText('Notebook')).not.toBeInTheDocument();
});

test('shows the placeholder when the picture does not load', () => {
  show('https://files.example.com/thumbnails/1?X-Amz-Signature=expired');

  fireEvent.error(screen.getByAltText('Notebook'));

  expect(screen.getByRole('img', { name: 'No picture' })).toBeInTheDocument();
  expect(screen.queryByAltText('Notebook')).not.toBeInTheDocument();
});
