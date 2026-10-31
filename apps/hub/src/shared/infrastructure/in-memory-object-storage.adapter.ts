import type {
  ObjectStoragePort,
  StoredObjectInterface,
} from '../application/object-storage.port.js';

/** For the tests and for a hub with no S3 service: the files are in memory, or nowhere. */
export class InMemoryObjectStorageAdapter implements ObjectStoragePort {
  readonly objects = new Map<string, StoredObjectInterface>();

  constructor(readonly enabled = true) {}

  put(key: string, object: StoredObjectInterface): Promise<void> {
    if (!this.enabled) return Promise.reject(new Error('No object storage is set up'));

    this.objects.set(key, object);

    return Promise.resolve();
  }

  delete(key: string): Promise<void> {
    this.objects.delete(key);

    return Promise.resolve();
  }

  signedUrl(key: string, expiresInSeconds: number, now: Date): Promise<string> {
    return Promise.resolve(
      `https://storage.test/${key}?expires=${String(Math.floor(now.getTime() / 1000) + expiresInSeconds)}`,
    );
  }
}
