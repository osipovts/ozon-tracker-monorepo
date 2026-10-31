import assert from 'node:assert/strict';
import { test } from 'node:test';

import { InMemoryAuthSessionRepositoryAdapter } from '../infrastructure/in-memory-auth-session-repository.adapter.js';
import { AuthSessionNotFoundError } from './auth-session-not-found.error.js';
import { ListAuthSessionsUseCase } from './list-auth-sessions.use-case.js';
import { ResolveAuthSessionUseCase } from './resolve-auth-session.use-case.js';
import { RevokeAuthSessionUseCase } from './revoke-auth-session.use-case.js';
import { RevokeOtherAuthSessionsUseCase } from './revoke-other-auth-sessions.use-case.js';
import { StartAuthSessionUseCase } from './start-auth-session.use-case.js';

const policy = { idleTtlMs: 60_000, absoluteTtlMs: 120_000 };
const jane = '6b1f4d1e-52f2-4d51-8a0e-0d6a9d3a7c22';
const sam = '9a2d0f3c-0a44-4b6a-b8c2-7e7e2f3b1d33';

async function setup(): Promise<{
  tokens: string[];
  ids: string[];
  samId: string;
  revoke: RevokeAuthSessionUseCase;
  revokeOthers: RevokeOtherAuthSessionsUseCase;
  resolve: ResolveAuthSessionUseCase;
  list: ListAuthSessionsUseCase;
}> {
  const sessions = new InMemoryAuthSessionRepositoryAdapter();
  const begin = new StartAuthSessionUseCase(sessions, policy);
  const resolve = new ResolveAuthSessionUseCase(sessions, policy);
  const tokens: string[] = [];
  const ids: string[] = [];
  for (const userId of [jane, jane, jane]) {
    const { token } = await begin.execute({ userId, userAgent: null, ip: null });
    tokens.push(token);
    ids.push((await resolve.execute(token))?.sessionId ?? '');
  }
  const samToken = (await begin.execute({ userId: sam, userAgent: null, ip: null })).token;

  return {
    tokens,
    ids,
    samId: (await resolve.execute(samToken))?.sessionId ?? '',
    revoke: new RevokeAuthSessionUseCase(sessions),
    revokeOthers: new RevokeOtherAuthSessionsUseCase(sessions),
    resolve,
    list: new ListAuthSessionsUseCase(sessions),
  };
}

void test('ends one session of the user, and only theirs', async (): Promise<void> => {
  const { tokens, ids, samId, revoke, resolve } = await setup();

  await revoke.execute(jane, ids[1] ?? '');

  assert.equal(await resolve.execute(tokens[1] ?? ''), null);
  assert.notEqual(await resolve.execute(tokens[0] ?? ''), null);
  await assert.rejects(revoke.execute(jane, samId), AuthSessionNotFoundError);
  await assert.rejects(revoke.execute(jane, ids[1] ?? ''), AuthSessionNotFoundError);
  await assert.rejects(revoke.execute(jane, 'unknown'), AuthSessionNotFoundError);
});

void test('ends every session of the user but the one in hand, and says how many', async (): Promise<void> => {
  const { tokens, ids, revokeOthers, resolve, list } = await setup();

  assert.equal(await revokeOthers.execute(jane, ids[0] ?? ''), 2);

  assert.notEqual(await resolve.execute(tokens[0] ?? ''), null);
  assert.equal(await resolve.execute(tokens[1] ?? ''), null);
  assert.equal(await resolve.execute(tokens[2] ?? ''), null);
  assert.equal((await list.execute(jane)).length, 1);
  assert.equal(await revokeOthers.execute(jane, ids[0] ?? ''), 0);
});
