import assert from 'node:assert/strict';
import { test } from 'node:test';

import type { ClockPort } from '../../shared/application/clock.port.js';
import { InMemoryAuthSessionRepositoryAdapter } from '../infrastructure/in-memory-auth-session-repository.adapter.js';
import { EndAuthSessionUseCase } from './end-auth-session.use-case.js';
import { ResolveAuthSessionUseCase } from './resolve-auth-session.use-case.js';
import { StartAuthSessionUseCase } from './start-auth-session.use-case.js';

const minute = 60_000;
const start = new Date('2026-10-31T10:00:00Z');
const policy = { idleTtlMs: 30 * minute, absoluteTtlMs: 60 * minute };
const userId = '6b1f4d1e-52f2-4d51-8a0e-0d6a9d3a7c22';

async function setup(): Promise<{
  token: string;
  resolve: ResolveAuthSessionUseCase;
  end: EndAuthSessionUseCase;
  at: (minutes: number) => void;
}> {
  let current = start;
  const clock: ClockPort = { now: (): Date => current };
  const sessions = new InMemoryAuthSessionRepositoryAdapter();
  const { token } = await new StartAuthSessionUseCase(sessions, policy, clock).execute({
    userId,
    userAgent: null,
    ip: null,
  });

  return {
    token,
    resolve: new ResolveAuthSessionUseCase(sessions, policy, clock),
    end: new EndAuthSessionUseCase(sessions, clock),
    at: (minutes): void => {
      current = new Date(start.getTime() + minutes * minute);
    },
  };
}

void test('tells the user of a live session and nobody of an unknown token', async (): Promise<void> => {
  const { token, resolve, at } = await setup();
  at(5);

  const identity = await resolve.execute(token);

  assert.equal(identity?.userId, userId);
  assert.equal(await resolve.execute('not-a-token'), null);
});

void test('keeps a session that is used and drops one that idles', async (): Promise<void> => {
  const { token, resolve, at } = await setup();

  at(20);
  assert.notEqual(await resolve.execute(token), null);
  at(45);
  assert.notEqual(await resolve.execute(token), null);

  at(80);
  assert.equal(await resolve.execute(token), null);
});

void test('ends a session at the absolute limit however active it is', async (): Promise<void> => {
  const { token, resolve, at } = await setup();

  at(25);
  assert.notEqual(await resolve.execute(token), null);
  at(50);
  assert.notEqual(await resolve.execute(token), null);

  at(60);
  assert.equal(await resolve.execute(token), null);
});

void test('a session that was ended is gone, and ending it again or an unknown one is harmless', async (): Promise<void> => {
  const { token, resolve, end, at } = await setup();
  at(5);

  await end.execute(token);
  await end.execute(token);
  await end.execute('not-a-token');

  assert.equal(await resolve.execute(token), null);
});
