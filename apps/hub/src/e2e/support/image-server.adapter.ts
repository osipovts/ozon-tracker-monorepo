import { createServer, type Server } from 'node:http';

/** A one-pixel PNG: a picture of a product, as far as the hub can tell. */
export const onePixelPng = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==',
  'base64',
);

/**
 * The part of a marketplace that serves the picture of a product, over real HTTP: the hub downloads it
 * from here as it does from the CDN of the marketplace.
 */
export class ImageServerAdapter {
  private server: Server | null = null;
  /** What was asked of it, by path. */
  readonly requests: string[] = [];
  /** What it answers with, by path: a path not in it is not found. */
  private readonly answers = new Map<string, { type: string; body: Buffer }>();

  serve(path: string, type: string, body: Buffer): void {
    this.answers.set(path, { type, body });
  }

  async start(): Promise<string> {
    const server = createServer((request, response): void => {
      const path = request.url ?? '/';
      this.requests.push(path);
      const answer = this.answers.get(path);
      if (answer === undefined) {
        response.writeHead(404).end();

        return;
      }

      response.writeHead(200, { 'content-type': answer.type }).end(answer.body);
    });
    this.server = server;
    await new Promise<void>((resolve): void => {
      server.listen(0, '127.0.0.1', resolve);
    });
    const address = server.address();
    if (address === null || typeof address === 'string') throw new Error('No port');

    return `http://127.0.0.1:${String(address.port)}`;
  }

  async stop(): Promise<void> {
    const server = this.server;
    if (server === null) return;

    await new Promise<void>((resolve): void => {
      server.close((): void => {
        resolve();
      });
    });
  }
}
