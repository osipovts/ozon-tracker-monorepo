import assert from 'node:assert/strict';
import { test } from 'node:test';

import { addressKeyOf } from './address-key.type.js';

void test('keeps an IPv4 address as it is', (): void => {
  assert.equal(addressKeyOf('203.0.113.7'), '203.0.113.7');
});

void test('sees an IPv4 address behind its IPv6 form as the same address', (): void => {
  assert.equal(addressKeyOf('::ffff:203.0.113.7'), '203.0.113.7');
});

void test('counts a whole /64 of IPv6 as one address: a client holds billions of them', (): void => {
  const key = addressKeyOf('2001:db8:abcd:12:ffff:ffff:ffff:ffff');

  assert.equal(key, '2001:db8:abcd:12::/64');
  assert.equal(addressKeyOf('2001:0DB8:abcd:0012:1:2:3:4'), key);
  assert.notEqual(addressKeyOf('2001:db8:abcd:13::1'), key);
});

void test('reads the compressed forms of IPv6', (): void => {
  assert.equal(addressKeyOf('2001:db8::1'), '2001:db8:0:0::/64');
  assert.equal(addressKeyOf('::1'), '0:0:0:0::/64');
  assert.equal(addressKeyOf('2001:db8:1:2::'), '2001:db8:1:2::/64');
  assert.equal(addressKeyOf('fe80::1%eth0'), 'fe80:0:0:0::/64');
});

void test('leaves what it cannot read as it is, instead of merging unrelated clients', (): void => {
  assert.equal(addressKeyOf('not-an-address'), 'not-an-address');
  assert.equal(addressKeyOf('zzzz::1'), 'zzzz::1');
});
