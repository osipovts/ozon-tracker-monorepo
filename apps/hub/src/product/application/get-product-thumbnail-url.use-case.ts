import { type ClockPort, systemClock } from '../../shared/application/clock.port.js';
import type { ObjectStoragePort } from '../../shared/application/object-storage.port.js';

const hourMs = 3_600_000;

/** An address stays valid for at least an hour of the one it was given at. */
const addressLifetimeSeconds = 2 * 3600;

/**
 * The address a browser loads the picture of a product from. It is signed as of the start of the hour, so
 * that it is the same for a whole hour, and the browser keeps the picture instead of loading it for every list.
 */
export class GetProductThumbnailUrlUseCase {
  constructor(
    private readonly storage: Pick<ObjectStoragePort, 'enabled' | 'signedUrl'>,
    private readonly clock: ClockPort = systemClock,
  ) {}

  async execute(thumbnailKey: string | null): Promise<string | null> {
    if (thumbnailKey === null || !this.storage.enabled) return null;

    const now = this.clock.now();

    return this.storage.signedUrl(
      thumbnailKey,
      addressLifetimeSeconds,
      new Date(Math.floor(now.getTime() / hourMs) * hourMs),
    );
  }
}
