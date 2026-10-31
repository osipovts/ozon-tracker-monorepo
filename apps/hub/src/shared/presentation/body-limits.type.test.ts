import assert from 'node:assert/strict';
import { after, before, test } from 'node:test';

import { Body, Controller, Post } from '@nestjs/common';
import type { NestExpressApplication } from '@nestjs/platform-express';
import { Test } from '@nestjs/testing';

import { applyBodyLimits } from './body-limits.type.js';

@Controller()
class ProbeController {
  @Post('auth/login')
  login(@Body() body: unknown): { received: boolean } {
    return { received: typeof body === 'object' };
  }

  @Post('sessions')
  importSession(@Body() body: unknown): { received: boolean } {
    return { received: typeof body === 'object' };
  }
}

let app: NestExpressApplication;
let baseUrl: string;

before(async (): Promise<void> => {
  const moduleRef = await Test.createTestingModule({ controllers: [ProbeController] }).compile();
  app = moduleRef.createNestApplication<NestExpressApplication>({ bodyParser: false });
  applyBodyLimits(app);
  await app.listen(0);
  baseUrl = await app.getUrl();
});

after(async (): Promise<void> => {
  await app.close();
});

async function post(path: string, bytes: number): Promise<number> {
  const response = await fetch(`${baseUrl}${path}`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ filler: 'x'.repeat(bytes) }),
  });

  return response.status;
}

void test('reads a small body anywhere and refuses a large one before anything asks who sent it', async (): Promise<void> => {
  assert.equal(await post('/auth/login', 50 * 1024), 201);
  assert.equal(await post('/auth/login', 200 * 1024), 413);
  assert.equal(await post('/auth/login', 2 * 1024 * 1024), 413);
});

void test('lets the import of a browser session carry the cookies and the storage it has, up to 10 MB', async (): Promise<void> => {
  assert.equal(await post('/sessions', 5 * 1024 * 1024), 201);
  assert.equal(await post('/sessions', 11 * 1024 * 1024), 413);
});
