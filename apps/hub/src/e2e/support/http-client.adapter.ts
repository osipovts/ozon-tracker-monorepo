import { parseSetCookie } from 'cookie';

export interface ReplyInterface {
  status: number;
  headers: Headers;
  /** The JSON body, or null if it has none. */
  body: unknown;
  /** Where a redirect leads, or null. */
  location: string | null;
}

export interface RequestInterface {
  method?: string;
  json?: unknown;
  headers?: Record<string, string>;
}

/**
 * A browser, as far as the hub can tell: it keeps the cookies the hub gives it and sends them back, says
 * where it comes from on a write, and follows redirects only when asked to. It talks over a socket.
 */
export class HttpClientAdapter {
  private readonly cookies = new Map<string, string>();
  private readonly hubOrigin: string;

  constructor(
    private readonly baseUrl: string,
    /** The Origin the browser would send with a write; the hub itself unless said otherwise. */
    private readonly origin: string = baseUrl,
  ) {
    this.hubOrigin = new URL(baseUrl).origin;
  }

  cookie(name: string): string | undefined {
    return this.cookies.get(name);
  }

  request(path: string, init: RequestInterface = {}): Promise<ReplyInterface> {
    return this.send(new URL(path, this.baseUrl), init);
  }

  /** Follows the redirects from a path to a page that is not one, wherever they lead, as a browser does. */
  async browse(path: string): Promise<ReplyInterface> {
    let url = new URL(path, this.baseUrl);
    let reply = await this.send(url, {});
    for (let hops = 0; reply.location !== null && hops < 10; hops += 1) {
      url = new URL(reply.location, url);
      reply = await this.send(url, {});
    }

    return reply;
  }

  private async send(url: URL, init: RequestInterface): Promise<ReplyInterface> {
    const method = init.method ?? (init.json === undefined ? 'GET' : 'POST');
    // Cookies belong to the hub: another host, such as a provider of a login, is not given them.
    const cookie =
      url.origin === this.hubOrigin
        ? Array.from(this.cookies, ([name, value]): string => `${name}=${value}`).join('; ')
        : '';
    const response = await fetch(url, {
      method,
      redirect: 'manual',
      headers: {
        ...(cookie === '' ? {} : { cookie }),
        ...(method === 'GET' ? {} : { origin: this.origin }),
        ...(init.json === undefined ? {} : { 'content-type': 'application/json' }),
        ...init.headers,
      },
      ...(init.json === undefined ? {} : { body: JSON.stringify(init.json) }),
    });

    if (url.origin === this.hubOrigin) this.keep(response.headers.getSetCookie());
    const text = await response.text();
    const isJson = (response.headers.get('content-type') ?? '').includes('json');
    const body: unknown = isJson && text !== '' ? JSON.parse(text) : null;

    return {
      status: response.status,
      headers: response.headers,
      body,
      location: response.headers.get('location'),
    };
  }

  private keep(setCookies: string[]): void {
    for (const header of setCookies) {
      const cookie = parseSetCookie(header);
      const value = cookie.value ?? '';
      const expired = cookie.expires !== undefined && cookie.expires.getTime() <= Date.now();
      if (value === '' || expired || cookie.maxAge === 0) this.cookies.delete(cookie.name);
      else this.cookies.set(cookie.name, value);
    }
  }
}
