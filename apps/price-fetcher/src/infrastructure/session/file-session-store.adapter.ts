import { writeFileSync } from 'node:fs';
import { readFile, writeFile } from 'node:fs/promises';

import type { ProxyEndpointEntity } from 'proxy-endpoint';
import { sessionExportFileSchema, type SessionExportFileType } from 'queue-contract';

import type { SessionStorePort } from '../../application/session/session-store.port.js';
import type {
  BrowserSessionInterface,
  StorageStateInterface,
} from '../../domain/session/browser-session.interface.js';

/** Keeps one session in the file written by `session:create`; for the CLI. */
export class FileSessionStoreAdapter implements SessionStorePort {
  private constructor(
    private readonly path: string,
    private file: SessionExportFileType,
  ) {}

  static async load(path: string): Promise<FileSessionStoreAdapter> {
    const file = sessionExportFileSchema.parse(JSON.parse(await readFile(path, 'utf8')));
    return new FileSessionStoreAdapter(path, file);
  }

  static async save(path: string, file: SessionExportFileType): Promise<void> {
    await writeFile(path, `${JSON.stringify(file, null, 2)}\n`, { mode: 0o600 });
  }

  find(proxy: ProxyEndpointEntity | null): BrowserSessionInterface | null {
    return this.file.proxy === (proxy?.server ?? null) ? this.file.session : null;
  }

  update(sessionId: string, storageState: StorageStateInterface): void {
    if (sessionId !== this.file.session.id) return;
    this.file = { ...this.file, session: { ...this.file.session, storageState } };
    writeFileSync(this.path, `${JSON.stringify(this.file, null, 2)}\n`, { mode: 0o600 });
  }

  reject(_sessionId: string, _actualIp: string): void {
    console.error('The session was created with another exit IP and is ignored.');
  }
}
