import assert from 'node:assert/strict';
import { test } from 'node:test';

import { ProxyEndpointEntity } from 'proxy-endpoint';

import type { CityInterface } from '../domain/city.interface.js';
import type { CityLetterSourcePort } from './city-letter-source.port.js';
import { FetchCitiesUseCase } from './fetch-cities.use-case.js';

const first = new ProxyEndpointEntity('socks5://217.71.230.1:1080');
const second = new ProxyEndpointEntity('socks5://217.71.230.2:1080');
const city = (id: string, name: string): CityInterface => ({ id, name, region: null });
const never = new AbortController().signal;
const listener = (
  progress: Array<[number, number]> = [],
): { onProgress: (done: number, total: number) => Promise<void> } => ({
  onProgress: (done, total): Promise<void> => {
    progress.push([done, total]);

    return Promise.resolve();
  },
});

void test('gathers the cities of every letter once, by name, and reports the letters done', async (): Promise<void> => {
  const source: CityLetterSourcePort = {
    read: (letter): Promise<CityInterface[]> =>
      Promise.resolve(
        letter === 'А'
          ? [city('2', 'Бор'), city('1', 'Абакан')]
          : [city('2', 'Бор'), city('3', 'Волгоград')],
      ),
  };
  const progress: Array<[number, number]> = [];

  const cities = await new FetchCitiesUseCase(source, ['А', 'Б']).execute(
    [first],
    never,
    listener(progress),
  );

  assert.deepEqual(cities, [city('1', 'Абакан'), city('2', 'Бор'), city('3', 'Волгоград')]);
  assert.deepEqual(progress, [
    [0, 2],
    [1, 2],
    [2, 2],
  ]);
});

void test('goes on to the next route when one fails, and stays with the one that works', async (): Promise<void> => {
  const calls: Array<[string, string | undefined]> = [];
  const source: CityLetterSourcePort = {
    read: (letter, proxy): Promise<CityInterface[]> => {
      calls.push([letter, proxy?.server]);

      return proxy === first
        ? Promise.reject(new Error('timeout'))
        : Promise.resolve([city(letter, letter)]);
    },
  };

  await new FetchCitiesUseCase(source, ['А', 'Б']).execute([first, second], never, listener());

  assert.deepEqual(calls, [
    ['А', first.server],
    ['А', second.server],
    ['Б', second.server],
  ]);
});

void test('fails, and gives none of the cities, when no route can read a letter', async (): Promise<void> => {
  const source: CityLetterSourcePort = {
    read: (letter): Promise<CityInterface[]> =>
      letter === 'Б'
        ? Promise.reject(new Error('timeout'))
        : Promise.resolve([city('1', 'Абакан')]),
  };

  await assert.rejects(
    new FetchCitiesUseCase(source, ['А', 'Б']).execute([first, second], never, listener()),
    /Б/,
  );
  await assert.rejects(
    new FetchCitiesUseCase(source, ['А']).execute([], never, listener()),
    /route/,
  );
});

void test('stops when the job is aborted, instead of trying the other routes', async (): Promise<void> => {
  const controller = new AbortController();
  let calls = 0;
  const source: CityLetterSourcePort = {
    read: (): Promise<CityInterface[]> => {
      calls += 1;
      controller.abort();

      return Promise.reject(new Error('aborted'));
    },
  };

  await assert.rejects(
    new FetchCitiesUseCase(source, ['А']).execute([first, second], controller.signal, listener()),
  );
  assert.equal(calls, 1);
});
