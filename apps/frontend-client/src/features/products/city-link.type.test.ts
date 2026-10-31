import { expect, test } from 'vitest';

import { linkHasCities } from './city-link.type.js';

test('tells the links of a marketplace whose prices depend on the city', (): void => {
  expect(linkHasCities('https://www.dns-shop.ru/product/0463bb2411a1d582/156-noutbuk/')).toBe(true);
  expect(linkHasCities('https://dns-shop.ru/product/0463bb2411a1d582/')).toBe(true);
});

test('has no city for the other links, for a link that is not finished, or for a lookalike host', (): void => {
  expect(linkHasCities('https://www.ozon.ru/product/1/')).toBe(false);
  expect(linkHasCities('https://www.dns-shop.ru.evil.test/product/1/')).toBe(false);
  expect(linkHasCities('https://www.dns-sh')).toBe(false);
  expect(linkHasCities('')).toBe(false);
});
