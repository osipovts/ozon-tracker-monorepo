import { type LoggerPort, silentLogger } from 'logger';
import type { ProxyEndpointEntity } from 'proxy-endpoint';

import type { CityInterface } from '../domain/city.interface.js';
import type { CityLetterSourcePort } from './city-letter-source.port.js';

export interface FetchCitiesListenerInterface {
  /** Called with how many letters are done of all, first before the first one. */
  onProgress(done: number, total: number): Promise<void>;
}

/** Reads the cities of a marketplace letter by letter, and gives them by name. */
export class FetchCitiesUseCase {
  constructor(
    private readonly source: CityLetterSourcePort,
    private readonly letters: readonly string[],
    private readonly logger: LoggerPort = silentLogger,
  ) {}

  /** A letter that no route can read fails the whole read: part of the cities would pass for all. */
  async execute(
    routes: ReadonlyArray<ProxyEndpointEntity | null>,
    signal: AbortSignal,
    listener: FetchCitiesListenerInterface,
  ): Promise<CityInterface[]> {
    if (routes.length === 0) throw new Error('No route to read the cities through');

    const cities = new Map<string, CityInterface>();
    // The route that worked is the first to try for the next letter.
    let current = 0;
    await listener.onProgress(0, this.letters.length);

    for (const [index, letter] of this.letters.entries()) {
      current = await this.readLetter(letter, routes, current, signal, cities);
      await listener.onProgress(index + 1, this.letters.length);
    }

    this.logger.info(`Read ${String(cities.size)} cities`);

    return Array.from(cities.values()).toSorted((a, b): number =>
      a.name.localeCompare(b.name, 'ru'),
    );
  }

  /** Returns the index of the route that read the letter. */
  private async readLetter(
    letter: string,
    routes: ReadonlyArray<ProxyEndpointEntity | null>,
    first: number,
    signal: AbortSignal,
    cities: Map<string, CityInterface>,
  ): Promise<number> {
    for (let attempt = 0; attempt < routes.length; attempt += 1) {
      const index = (first + attempt) % routes.length;
      signal.throwIfAborted();

      try {
        for (const city of await this.source.read(letter, routes[index] ?? null, signal))
          cities.set(city.id, city);

        return index;
      } catch {
        signal.throwIfAborted();
        this.logger.warn(
          `The letter ${letter} was not read via ${routes[index]?.server ?? 'direct connection'}`,
        );
      }
    }

    throw new Error(`No route could read the cities of the letter ${letter}`);
  }
}
