import { errorMessage, type LoggerPort, silentLogger } from 'logger';
import type { Browser, BrowserContext, Page, Response } from 'playwright';
import { marketplaceExitCountries, type ProductReferenceEntity } from 'product-reference';
import type { ProxyEndpointEntity } from 'proxy-endpoint';

import type { ProductReaderPort } from '../../application/product/product-reader.port.js';
import type { SessionStorePort } from '../../application/session/session-store.port.js';
import type { ReadProductResultType } from '../../domain/product/product-snapshot.interface.js';
import type { BrowserSessionInterface } from '../../domain/session/browser-session.interface.js';
import type { ChromiumOptionsFactory } from '../shared/chromium-options.factory.js';
import type { GeoIpPageParser } from '../shared/geo-ip-page.parser.js';
import type { OzonChallengeParser } from './ozon-challenge.parser.js';
import type { OzonPageParser } from './ozon-page.parser.js';
import type { OzonProductParser } from './ozon-product.parser.js';

export interface OzonReaderParsersInterface {
  geoIp: GeoIpPageParser;
  pages: OzonPageParser;
  challenges: OzonChallengeParser;
  products: OzonProductParser;
}

export class OzonPlaywrightProductReaderAdapter implements ProductReaderPort {
  constructor(
    private readonly browser: Pick<Browser, 'newContext'>,
    private readonly options: ChromiumOptionsFactory,
    private readonly parsers: OzonReaderParsersInterface,
    private readonly timeoutMs: number,
    private readonly sessions?: SessionStorePort,
    private readonly logger: LoggerPort = silentLogger,
  ) {}

  async read(
    reference: ProductReferenceEntity,
    proxy: ProxyEndpointEntity | null,
    signal: AbortSignal,
  ): Promise<ReadProductResultType> {
    signal.throwIfAborted();
    const route = proxy?.server ?? 'direct connection';
    const session = this.sessions?.find(proxy) ?? null;
    this.logger.debug(
      `Opening a browser context via ${route}, ${session === null ? 'no session' : `session ${session.id}`}`,
    );

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
      return await this.readPage(reference, proxy, session, context);
    } catch (error: unknown) {
      signal.throwIfAborted();
      this.logger.warn(`Browser error via ${route}: ${errorMessage(error).split('\n')[0] ?? ''}`);

      return { status: 'network_error' };
    } finally {
      signal.removeEventListener('abort', abort);
      await context.close();
    }
  }

  private async readPage(
    reference: ProductReferenceEntity,
    proxy: ProxyEndpointEntity | null,
    session: BrowserSessionInterface | null,
    context: BrowserContext,
  ): Promise<ReadProductResultType> {
    const page = await context.newPage();
    let activeSession = session;
    let exitIp: string | null = null;

    if (proxy !== null) {
      const exit = await this.parsers.geoIp.parse(page);
      const country = marketplaceExitCountries[reference.marketplace];
      if (exit?.country !== country) {
        this.logger.warn(`GeoIP did not confirm an exit in ${country} through ${proxy.server}`);

        return { status: 'proxy_rejected' };
      }

      exitIp = exit.ip;
      this.logger.debug(`Exit IP through ${proxy.server} is ${exitIp} (${country})`);
      activeSession = await this.checkSession(activeSession, exitIp, context);
    }

    const lastResponse = await this.open(page, reference);
    const document = await this.parsers.pages.parse(page);
    const response = lastResponse();
    if (this.parsers.challenges.isChallenge(document.title, document.body)) {
      this.logger.warn(
        `The site check appeared via ${proxy?.server ?? 'direct connection'}${activeSession === null ? '' : ` despite the session ${activeSession.id}`}`,
      );

      return { status: 'challenge_required' };
    }

    if (response === null) return { status: 'network_error' };
    if (!response.ok()) {
      this.logger.warn(`HTTP ${String(response.status())} instead of the product page`);

      return { status: 'http_error', httpStatus: response.status() };
    }

    const snapshot = this.parsers.products.parse(reference, document);
    if (snapshot === null) {
      this.logger.warn('The product card could not be parsed');

      return { status: 'parse_error' };
    }

    this.logger.debug(
      `Parsed "${snapshot.title.slice(0, 60)}": ${String(snapshot.prices.length)} prices, ${snapshot.availability}`,
    );
    if (activeSession !== null)
      this.sessions?.update(activeSession.id, await context.storageState());

    return {
      // A card without a price is read too: the product may be out of stock.
      status: snapshot.prices.length > 0 ? 'success' : 'partial',
      snapshot,
      exitIp,
    };
  }

  /** A session is only valid on the exit address it was created with; returns the usable one. */
  private async checkSession(
    session: BrowserSessionInterface | null,
    exitIp: string,
    context: BrowserContext,
  ): Promise<BrowserSessionInterface | null> {
    if (session === null || session.exitIp === exitIp) return session;

    this.logger.warn(
      `Session ${session.id} was created at ${session.exitIp}, the exit is ${exitIp}: ignoring the session`,
    );
    this.sessions?.reject(session.id, exitIp);
    await context.setStorageState({ cookies: [], origins: [] });

    return null;
  }

  /**
   * Opens the product page. The result gives the response of the last main-frame navigation
   * at the time it is called: a challenge may redirect after the page has loaded.
   */
  private async open(
    page: Page,
    reference: ProductReferenceEntity,
  ): Promise<() => Response | null> {
    let response: Response | null = null;
    page.on('response', (received): void => {
      if (received.request().isNavigationRequest() && received.frame() === page.mainFrame())
        response = received;
    });

    response = await page.goto(reference.url, { waitUntil: 'domcontentloaded' });
    this.logger.debug(
      `Opened ${reference.url}: HTTP ${String(response?.status() ?? 'none')}, final URL ${page.url()}`,
    );

    return (): Response | null => response;
  }
}
