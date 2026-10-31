import assert from 'node:assert/strict';
import { test } from 'node:test';

import { FakeOauthProviderAdapter } from '../infrastructure/fake-oauth-provider.adapter.js';
import { ListOauthProvidersUseCase } from './list-oauth-providers.use-case.js';
import type { OauthProvidersType } from './oauth-provider.port.js';

void test('lists the providers that are set up, and none when none is', (): void => {
  const none: OauthProvidersType = new Map();
  const both: OauthProvidersType = new Map([
    ['google', new FakeOauthProviderAdapter()],
    ['github', new FakeOauthProviderAdapter()],
  ]);

  assert.deepEqual(new ListOauthProvidersUseCase(none).execute(), []);
  assert.deepEqual(new ListOauthProvidersUseCase(both).execute(), ['google', 'github']);
});
