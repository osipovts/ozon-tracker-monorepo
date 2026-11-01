import assert from 'node:assert/strict';
import { test } from 'node:test';

import { isPublicAddress } from './public-address.type.js';

void test('takes the addresses of the open internet', (): void => {
  for (const address of ['93.184.216.34', '8.8.8.8', '2606:4700:4700::1111'])
    assert.equal(isPublicAddress(address), true, address);
});

void test('refuses the machine itself, private networks and reserved ranges, in any spelling', (): void => {
  for (const address of [
    '127.0.0.1',
    '10.1.2.3',
    '172.16.0.1',
    '172.31.255.255',
    '192.168.1.1',
    '169.254.169.254',
    '100.64.0.1',
    '0.0.0.0',
    '224.0.0.1',
    '::1',
    '::',
    'fc00::1',
    'fd12:3456::1',
    'fe80::1',
    '::ffff:127.0.0.1',
    '::ffff:10.0.0.1',
    'not an address',
    '',
  ])
    assert.equal(isPublicAddress(address), false, address);
});
