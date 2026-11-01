import { expect, test } from 'vitest';

import { describeDevice } from './device-name.type.js';

test.each([
  ['Mozilla/5.0 (X11; Linux x86_64) Chrome/130.0 Safari/537.36', 'Chrome, Linux'],
  ['Mozilla/5.0 (Windows NT 10.0) Chrome/130.0 Safari/537.36 Edg/130.0', 'Edge, Windows'],
  ['Mozilla/5.0 (Windows NT 10.0) Chrome/130.0 Safari/537.36 OPR/115.0', 'Opera, Windows'],
  ['Mozilla/5.0 (Windows NT 10.0; rv:132.0) Gecko/20100101 Firefox/132.0', 'Firefox, Windows'],
  ['Mozilla/5.0 (Linux; Android 14) Chrome/130.0 Mobile Safari/537.36', 'Chrome, Android'],
  ['Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) Safari/605.1', 'Safari, iPhone'],
  ['Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) Safari/605.1.15', 'Safari, macOS'],
  ['curl/8.0', null],
  [null, null],
])('names the device of %s', (userAgent, expected): void => {
  expect(describeDevice(userAgent)).toBe(expected);
});
