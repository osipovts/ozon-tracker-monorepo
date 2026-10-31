import type { StoredObjectInterface } from '../../shared/application/object-storage.port.js';
import type { ImageDownloaderPort } from '../application/image-downloader.port.js';

/** A picture of a product is some tens of kilobytes: a file a good deal bigger is not one. */
const maxBytes = 2 * 1024 * 1024;
const timeoutMs = 10_000;

/** Downloads a picture over HTTP(S), and keeps to the pictures: by the type the server names, and by the size. */
export class HttpImageDownloaderAdapter implements ImageDownloaderPort {
  async download(url: string): Promise<StoredObjectInterface | null> {
    const address = new URL(url);
    if (address.protocol !== 'https:' && address.protocol !== 'http:') return null;

    const response = await fetch(address, { signal: AbortSignal.timeout(timeoutMs) });
    const contentType =
      response.headers.get('content-type')?.split(';')[0]?.trim().toLowerCase() ?? '';
    if (!response.ok || !contentType.startsWith('image/') || contentType === 'image/svg+xml') {
      return null;
    }

    const length = Number(response.headers.get('content-length') ?? 0);
    if (length > maxBytes) return null;

    const body = new Uint8Array(await response.arrayBuffer());

    return body.byteLength === 0 || body.byteLength > maxBytes ? null : { body, contentType };
  }
}
