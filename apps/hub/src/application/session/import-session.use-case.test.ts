import assert from 'node:assert/strict';
import { test } from 'node:test';

import type { BrowserSessionEntity } from '../../domain/session/browser-session.entity.js';
import { InMemoryBrowserSessionRepositoryAdapter } from '../../infrastructure/session/in-memory-browser-session-repository.adapter.js';
import { DeleteSessionUseCase } from './delete-session.use-case.js';
import { ImportSessionUseCase, type SessionImportInterface } from './import-session.use-case.js';
import { RecordSessionEventUseCase } from './record-session-event.use-case.js';
import { SessionNotFoundError } from './session-not-found.error.js';

const proxyServer = 'socks5://217.71.230.103:1080';

function input(
  id: string,
  overrides: Partial<SessionImportInterface> = {},
): SessionImportInterface {
  return {
    id,
    marketplace: 'ozon',
    proxyServer,
    exitIp: '217.71.230.103',
    userAgent: 'Mozilla/5.0',
    storageState: {
      cookies: [
        {
          name: 'abt',
          value: 'v1',
          domain: '.ozon.ru',
          path: '/',
          expires: -1,
          httpOnly: true,
          secure: true,
          sameSite: 'Lax',
        },
      ],
      origins: [],
    },
    createdAt: new Date('2026-10-24T12:00:00.000Z'),
    ...overrides,
  };
}

async function listActive(
  repository: InMemoryBrowserSessionRepositoryAdapter,
): Promise<BrowserSessionEntity[]> {
  return (await repository.listByMarketplace('ozon')).filter((session): boolean => session.active);
}

const first = '3f0c9a52-7a53-4a64-9d0d-2f2f6c1f0a11';
const second = '6b1f4d1e-52f2-4d51-8a0e-0d6a9d3a7c22';

void test('a new session replaces the previous one of the same route', async (): Promise<void> => {
  const repository = new InMemoryBrowserSessionRepositoryAdapter();
  const importSession = new ImportSessionUseCase(repository);

  await importSession.execute(input(first));
  await importSession.execute(input(second));

  assert.equal(await repository.findById(first), null);
  assert.equal((await listActive(repository)).length, 1);

  // Another route of the same marketplace keeps its own session.
  await importSession.execute(input(first, { proxyServer: null }));
  assert.equal((await listActive(repository)).length, 2);
});

void test('a refreshed state is kept and a stale session is no longer offered', async (): Promise<void> => {
  const repository = new InMemoryBrowserSessionRepositoryAdapter();
  await new ImportSessionUseCase(repository).execute(input(first));
  const events = new RecordSessionEventUseCase(repository);

  await events.execute({
    type: 'refreshed',
    sessionId: first,
    at: new Date(),
    storageState: { cookies: [], origins: [] },
  });
  assert.equal((await repository.findById(first))?.snapshot.storageState.cookies.length, 0);

  await events.execute({ type: 'used', sessionId: first, at: new Date() });
  assert.notEqual((await repository.findById(first))?.snapshot.lastUsedAt, null);

  await events.execute({
    type: 'stale',
    sessionId: first,
    at: new Date(),
    reason: 'challenge_required',
  });
  assert.equal((await repository.findById(first))?.snapshot.staleReason, 'challenge_required');
  assert.deepEqual(await listActive(repository), []);
});

void test('events of a replaced session are ignored and deleting an unknown one fails', async (): Promise<void> => {
  const repository = new InMemoryBrowserSessionRepositoryAdapter();

  await new RecordSessionEventUseCase(repository).execute({
    type: 'used',
    sessionId: first,
    at: new Date(),
  });

  await assert.rejects(new DeleteSessionUseCase(repository).execute(first), SessionNotFoundError);
});
