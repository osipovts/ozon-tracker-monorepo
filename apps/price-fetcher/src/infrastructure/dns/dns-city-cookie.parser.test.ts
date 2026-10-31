import assert from 'node:assert/strict';
import { test } from 'node:test';

import { DnsCityCookieParser } from './dns-city-cookie.parser.js';

const parser = new DnsCityCookieParser();
/** What the site writes into `current_path` once a city is chosen. */
const irkutsk =
  '0a3aa1870e6a388c5e98a8c8bcdf2931714b0cb20946fae5a4264468f117fd25a%3A2%3A%7Bi%3A0%3Bs%3A12%3A%22current_path%22%3Bi%3A1%3Bs%3A121%3A%22%7B%22city%22%3A%2230b7c1f1-03fb-11dc-95ee-00151716f9f5%22%2C%22cityName%22%3A%22%5Cu0418%5Cu0440%22%2C%22method%22%3A%22manual%22%7D%22%3B%7D';

void test('takes the id of the city out of the cookie of the site', (): void => {
  assert.equal(parser.parse(irkutsk), '30b7c1f1-03fb-11dc-95ee-00151716f9f5');
});

void test('a cookie that names no city gives none', (): void => {
  assert.equal(parser.parse(''), null);
  assert.equal(parser.parse('%E0%A4%A'), null);
  assert.equal(parser.parse('abc%3A2%3A%7B%22city%22%3A%22not-an-id%22%7D'), null);
});
