import { beforeEach, expect, test } from 'vitest';

import { forgetPendingAdd, readPendingAdd, rememberPendingAdd } from './pending-add.type.js';

beforeEach((): void => {
  sessionStorage.clear();
});

test('gives back the link that is being added, until it is forgotten', (): void => {
  expect(readPendingAdd()).toBeNull();

  rememberPendingAdd('https://ozon.ru/t/AbC');
  expect(readPendingAdd()).toBe('https://ozon.ru/t/AbC');

  forgetPendingAdd();
  expect(readPendingAdd()).toBeNull();
});

test('ignores a record that is too old or malformed', (): void => {
  rememberPendingAdd('https://ozon.ru/t/AbC');
  expect(readPendingAdd(Date.now() + 10 * 60_000)).toBeNull();

  sessionStorage.setItem('products.pendingAdd', 'not json');
  expect(readPendingAdd()).toBeNull();
});
