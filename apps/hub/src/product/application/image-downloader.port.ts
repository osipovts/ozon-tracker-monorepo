import type { StoredObjectInterface } from '../../shared/application/object-storage.port.js';

export const IMAGE_DOWNLOADER = Symbol('ImageDownloaderPort');

export interface ImageDownloaderPort {
  /** The picture at the address; null when there is none, or it is no picture, or it is too big. */
  download(url: string): Promise<StoredObjectInterface | null>;
}
