import { errorMessage, type LoggerPort, silentLogger } from 'logger';
import type { Browser } from 'playwright';
import type { ProxyEndpointEntity } from 'proxy-endpoint';

import type { LinkExpanderPort } from '../../application/link/link-expander.port.js';
import type { SessionStorePort } from '../../application/session/session-store.port.js';
import type { ChromiumOptionsFactory } from '../shared/chromium-options.factory.js';

/** Follows the redirect of a short link of Ozon in a browser: the site lets only a browser with a session through. */
export class OzonPlaywrightLinkExpanderAdapter implements LinkExpanderPort {
  constructor(
    private readonly browser: Pick<Browser, 'newContext'>,
    private readonly options: ChromiumOptionsFactory,
    private readonly timeoutMs: number,
    private readonly sessions: SessionStorePort,
    private readonly logger: LoggerPort = silentLogger,
  ) {}

  async expand(
    url: URL,
    proxy: ProxyEndpointEntity | null,
    signal: AbortSignal,
  ): Promise<string | null> {
    signal.throwIfAborted();
    const session = this.sessions.find(proxy);
    const context = await this.browser.newContext({
      ...this.options.context(proxy),
      ...(session === null
        ? {}
        : { userAgent: session.userAgent, storageState: session.storageState }),
      acceptDownloads: false,
    });
    const abort = (): void => {
      void context.close().catch((): void => {
        /* Already closed by browser shutdown. */
      });
    };
    signal.addEventListener('abort', abort, { once: true });
    context.setDefaultTimeout(this.timeoutMs);
    context.setDefaultNavigationTimeout(this.timeoutMs);

    try {
      const page = await context.newPage();
      await page.goto(url.href, { waitUntil: 'domcontentloaded' });
      // The redirect may be made by the page, after it has loaded.
      await page.waitForURL((current): boolean => current.pathname.startsWith('/product/'));

      return page.url();
    } catch (error: unknown) {
      signal.throwIfAborted();
      this.logger.warn(
        `The short link was not followed via ${proxy?.server ?? 'direct connection'}: ${errorMessage(error).split('\n')[0] ?? ''}`,
      );

      return null;
    } finally {
      signal.removeEventListener('abort', abort);
      await context.close();
    }
  }
}
