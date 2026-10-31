import type { ProxyEndpointEntity } from 'proxy-endpoint';

import type { CityInterface } from '../domain/city.interface.js';

export interface CityLetterSourcePort {
  /** The cities whose names begin with the letter; rejects when the route does not work. */
  read(
    letter: string,
    proxy: ProxyEndpointEntity | null,
    signal: AbortSignal,
  ): Promise<CityInterface[]>;
}
