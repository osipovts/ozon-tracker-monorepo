import { lookup, type LookupAddress, type LookupOptions } from 'node:dns';
import type { IncomingMessage } from 'node:http';
import { request as httpRequest } from 'node:http';
import { request as httpsRequest } from 'node:https';
import type { LookupFunction } from 'node:net';

import type { StoredObjectInterface } from '../../shared/application/object-storage.port.js';
import type { ImageDownloaderPort } from '../application/image-downloader.port.js';
import { isPublicAddress } from './public-address.type.js';

/** A picture of a product is some tens of kilobytes: a file a good deal bigger is not one. */
const maxBytes = 2 * 1024 * 1024;
const timeoutMs = 10_000;
const maxRedirects = 3;

export interface ImageDownloadPolicyInterface {
  protocols: readonly string[];
  /** Whether a connection to the address is allowed. */
  allows: (address: string) => boolean;
}

/** The address of a picture comes from a page of a marketplace: the hub reaches only the open internet over HTTPS. */
const publicHttps: ImageDownloadPolicyInterface = {
  protocols: ['https:'],
  allows: isPublicAddress,
};

/**
 * Downloads a picture, and keeps to the pictures: by the type the server names, and by the size read, not
 * the size announced. The address a name resolves to is checked when the connection is made, and so is
 * the one of every redirect, so that a name cannot be pointed at the network of the hub after the check.
 */
export class HttpImageDownloaderAdapter implements ImageDownloaderPort {
  constructor(private readonly policy: ImageDownloadPolicyInterface = publicHttps) {}

  async download(url: string): Promise<StoredObjectInterface | null> {
    let address: URL;
    try {
      address = new URL(url);
    } catch {
      return null;
    }

    for (let hop = 0; hop <= maxRedirects; hop += 1) {
      if (!this.policy.protocols.includes(address.protocol)) return null;

      const response = await this.get(address);
      const location = response.headers.location;
      if (
        response.statusCode !== undefined &&
        [301, 302, 303, 307, 308].includes(response.statusCode) &&
        location !== undefined
      ) {
        response.resume();
        try {
          address = new URL(location, address);
        } catch {
          return null;
        }
        continue;
      }

      return this.read(response);
    }

    return null;
  }

  private get(address: URL): Promise<IncomingMessage> {
    const request = address.protocol === 'https:' ? httpsRequest : httpRequest;

    return new Promise((resolve, reject): void => {
      const call = request(
        address,
        { lookup: this.guardedLookup(), signal: AbortSignal.timeout(timeoutMs) },
        resolve,
      );
      call.on('error', reject);
      call.end();
    });
  }

  private read(response: IncomingMessage): Promise<StoredObjectInterface | null> {
    const contentType = (response.headers['content-type'] ?? '')
      .split(';')[0]
      ?.trim()
      .toLowerCase();
    if (
      response.statusCode !== 200 ||
      contentType === undefined ||
      !contentType.startsWith('image/') ||
      contentType === 'image/svg+xml' ||
      Number(response.headers['content-length'] ?? 0) > maxBytes
    ) {
      response.resume();

      return Promise.resolve(null);
    }

    return new Promise((resolve, reject): void => {
      const chunks: Buffer[] = [];
      let size = 0;
      response.on('data', (chunk: Buffer): void => {
        size += chunk.byteLength;
        if (size > maxBytes) {
          response.destroy();
          resolve(null);

          return;
        }
        chunks.push(chunk);
      });
      response.on('end', (): void => {
        resolve(size === 0 ? null : { body: new Uint8Array(Buffer.concat(chunks)), contentType });
      });
      response.on('error', reject);
    });
  }

  /** The resolver of the connection, which leaves out the addresses the policy does not allow. */
  private guardedLookup(): LookupFunction {
    return (hostname, options, callback): void => {
      lookup(
        hostname,
        { ...options, all: true } satisfies LookupOptions,
        (error, addresses): void => {
          if (error !== null) {
            callback(error, '', 0);

            return;
          }

          const allowed: LookupAddress[] = addresses.filter(({ address }): boolean =>
            this.policy.allows(address),
          );
          const [first] = allowed;
          if (first === undefined) {
            callback(new Error(`${hostname} resolves to no address the hub may reach`), '', 0);
          } else if (options.all === true) {
            callback(null, allowed);
          } else {
            callback(null, first.address, first.family);
          }
        },
      );
    };
  }
}
