import assert from 'node:assert/strict';
import { test } from 'node:test';

import { OzonShortLinkParser } from './ozon-short-link.parser.js';

const parser = new OzonShortLinkParser();

void test('recognizes the short links of Ozon', (): void => {
  assert.equal(parser.isShortLink(new URL('https://ozon.ru/t/AbC-123')), true);
  assert.equal(parser.isShortLink(new URL('https://www.ozon.ru/t/AbC_123/?share=1')), true);
});

void test('rejects foreign hosts, credentials, ports and other paths', (): void => {
  for (const input of [
    'http://ozon.ru/t/abc',
    'https://ozon.ru.evil.test/t/abc',
    'https://ozon.ru@evil.test/t/abc',
    'https://ozon.ru:8080/t/abc',
    'https://ozon.ru/product/1/',
    'https://ozon.ru/t/abc/def',
  ]) {
    assert.equal(parser.isShortLink(new URL(input)), false);
  }
});
