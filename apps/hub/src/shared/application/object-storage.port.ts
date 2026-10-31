export const OBJECT_STORAGE = Symbol('ObjectStoragePort');

export interface StoredObjectInterface {
  body: Uint8Array;
  contentType: string;
}

/** Files that are kept outside of the database, and handed to browsers by an address that expires. */
export interface ObjectStoragePort {
  /** False when no storage is set up: nothing is kept, and no address is given. */
  readonly enabled: boolean;
  put(key: string, object: StoredObjectInterface): Promise<void>;
  delete(key: string): Promise<void>;
  /** An address a browser loads the file from until `expiresInSeconds` have passed. */
  signedUrl(key: string, expiresInSeconds: number, now: Date): Promise<string>;
}
