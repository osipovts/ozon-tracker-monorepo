import assert from 'node:assert/strict';
import { test } from 'node:test';

import { InMemoryBrowserSessionRepositoryAdapter } from '../infrastructure/in-memory-browser-session-repository.adapter.js';
import { GetSessionStatsUseCase } from './get-session-stats.use-case.js';
import { ImportSessionUseCase } from './import-session.use-case.js';
import { RecordSessionEventUseCase } from './record-session-event.use-case.js';

void test('counts the browser sessions that still get through and those that went stale', async (): Promise<void> => {
  const sessions = new InMemoryBrowserSessionRepositoryAdapter();
  const importSession = new ImportSessionUseCase(sessions);
  for (const [n, id] of [
    [1, '3f0c9a52-7a53-4a64-9d0d-2f2f6c1f0a11'],
    [2, '3f0c9a52-7a53-4a64-9d0d-2f2f6c1f0a12'],
    [3, '3f0c9a52-7a53-4a64-9d0d-2f2f6c1f0a13'],
  ] as const) {
    await importSession.execute({
      id,
      marketplace: 'ozon',
      proxyServer: `socks5://217.71.230.${String(n)}:1080`,
      exitIp: `217.71.230.${String(n)}`,
      userAgent: 'Mozilla/5.0',
      storageState: { cookies: [], origins: [] },
      createdAt: new Date(),
    });
  }
  await new RecordSessionEventUseCase(sessions).execute({
    type: 'stale',
    sessionId: '3f0c9a52-7a53-4a64-9d0d-2f2f6c1f0a13',
    reason: 'challenge_required',
    at: new Date(),
  });

  assert.deepEqual(await new GetSessionStatsUseCase(sessions).execute(), { active: 2, stale: 1 });
});
