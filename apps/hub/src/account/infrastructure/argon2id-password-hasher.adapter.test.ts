import assert from 'node:assert/strict';
import { test } from 'node:test';

import { Argon2idPasswordHasherAdapter } from './argon2id-password-hasher.adapter.js';

const hasher = new Argon2idPasswordHasherAdapter();

void test('verifies the password a hash was made of and no other', async (): Promise<void> => {
  const hash = await hasher.hash('correct horse battery staple');

  assert.equal(await hasher.verify(hash, 'correct horse battery staple'), true);
  assert.equal(await hasher.verify(hash, 'correct horse battery stapler'), false);
});

void test('salts the hash: one password never hashes the same way twice', async (): Promise<void> => {
  const [first, second] = await Promise.all([hasher.hash('password-1'), hasher.hash('password-1')]);

  assert.notEqual(first, second);
});

void test('stores the cost in the hash so that raising it keeps old hashes valid', async (): Promise<void> => {
  const cheap = new Argon2idPasswordHasherAdapter({ memoryKib: 64, passes: 1, parallelism: 1 });
  const old = await cheap.hash('password-1');

  assert.match(old, /^\$argon2id\$v=19\$m=64,t=1,p=1\$/);
  assert.equal(await hasher.verify(old, 'password-1'), true);
  assert.equal(await hasher.verify(old, 'password-2'), false);
});

void test('treats a hash it cannot read as no match', async (): Promise<void> => {
  assert.equal(await hasher.verify('not a hash', 'password-1'), false);
  assert.equal(await hasher.verify('$argon2id$v=19$m=x,t=1,p=1$c2FsdHNhbHQ$aGFzaA', 'p'), false);
  assert.equal(await hasher.verify('$argon2i$v=19$m=64,t=1,p=1$c2FsdHNhbHQ$aGFzaA', 'p'), false);
});

void test('treats a stored cost the machine cannot run as no match instead of throwing', async (): Promise<void> => {
  // 1 KiB of memory is below what argon2 allows: the derivation itself refuses it.
  assert.equal(
    await hasher.verify('$argon2id$v=19$m=1,t=1,p=1$c2FsdHNhbHQ$aGFzaGhhc2g', 'p'),
    false,
  );
});
