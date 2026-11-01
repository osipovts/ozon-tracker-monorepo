import { expect, test } from 'vitest';

import { isHttpLink } from './http-link.type.js';

test.each([
  ['https://www.ozon.ru/product/1/', true],
  ['http://example.com/item', true],
  ['javascript:alert(1)', false],
  ['data:text/html,<script>alert(1)</script>', false],
  ['/relative/path', false],
  ['', false],
])('takes %s as a link to open: %s', (link, expected): void => {
  expect(isHttpLink(link)).toBe(expected);
});
