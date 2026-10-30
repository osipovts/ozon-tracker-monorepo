import { createServer, type IncomingHttpHeaders, type Server } from 'node:http';
import type { AddressInfo } from 'node:net';

export interface FakeRequestInterface {
  method: string;
  path: string;
  headers: IncomingHttpHeaders;
  body: string;
}

export interface FakeReplyInterface {
  status: number;
  body: unknown;
}

/** A provider the adapters can talk to over a real socket: it answers what it is told and notes what it is asked. */
export class FakeHttpServerAdapter {
  readonly requests: FakeRequestInterface[] = [];
  private readonly replies = new Map<string, FakeReplyInterface>();
  private readonly server: Server = createServer((request, response): void => {
    let body = '';
    request.setEncoding('utf8');
    request.on('data', (chunk: string): void => {
      body += chunk;
    });
    request.on('end', (): void => {
      const path = new URL(request.url ?? '/', 'http://fake').pathname;
      this.requests.push({ method: request.method ?? '', path, headers: request.headers, body });

      const reply = this.replies.get(`${request.method ?? ''} ${path}`) ?? {
        status: 404,
        body: { error: 'not found' },
      };
      response.statusCode = reply.status;
      response.setHeader('content-type', 'application/json');
      response.end(JSON.stringify(reply.body));
    });
  });

  reply(method: string, path: string, reply: FakeReplyInterface): void {
    this.replies.set(`${method} ${path}`, reply);
  }

  async start(): Promise<string> {
    await new Promise<void>((resolve): void => {
      this.server.listen(0, '127.0.0.1', resolve);
    });
    const address: AddressInfo | string | null = this.server.address();
    if (address === null || typeof address === 'string')
      throw new Error('The fake server did not start');

    return `http://127.0.0.1:${String(address.port)}`;
  }

  async stop(): Promise<void> {
    await new Promise<void>((resolve): void => {
      this.server.close((): void => {
        resolve();
      });
    });
  }
}
