import type { CamoufoxOptionsFactory } from 'camoufox-options';
import { errorMessage, type LoggerPort, silentLogger } from 'logger';
import type { Browser, BrowserContext, Page, Response } from 'playwright-core';
import { marketplaceExitCountries, type ProductReferenceEntity } from 'product-reference';
import type { ProxyEndpointEntity } from 'proxy-endpoint';

import type { ProductReaderPort } from '../../application/product/product-reader.port.js';
import type { ReadProductResultType } from '../../domain/product/product-snapshot.interface.js';
import type { GeoIpPageParser } from '../shared/geo-ip-page.parser.js';
import { ProxyExitChecker } from '../shared/proxy-exit.checker.js';
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
    private readonly options: CamoufoxOptionsFactory,
    private readonly parsers: OzonReaderParsersInterface,
    private readonly timeoutMs: number,
    private readonly logger: LoggerPort = silentLogger,
    private readonly exits: ProxyExitChecker = new ProxyExitChecker(),
  ) {}

  async read(
    reference: ProductReferenceEntity,
    proxy: ProxyEndpointEntity,
    signal: AbortSignal,
  ): Promise<ReadProductResultType> {
    signal.throwIfAborted();
    const route = proxy.server;
    this.logger.debug(`Opening a browser context via ${route}`);

    const context = await this.browser.newContext({
      ...this.options.context(proxy),
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
      return await this.readPage(reference, proxy, context);
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
    proxy: ProxyEndpointEntity,
    context: BrowserContext,
  ): Promise<ReadProductResultType> {
    const page = await context.newPage();
    const country = marketplaceExitCountries[reference.marketplace];
    const exit = await this.exits.check(proxy, country, () => this.parsers.geoIp.parse(page));
    if (exit.status === 'unavailable') {
      this.logger.warn(`GeoIP gave no answer through ${proxy.server}`);

      return { status: 'network_error' };
    }
    if (exit.status === 'rejected') {
      this.logger.warn(`GeoIP did not confirm an exit in ${country} through ${proxy.server}`);

      return { status: 'proxy_rejected' };
    }

    const exitIp = exit.exitIp;
    this.logger.debug(`Exit IP through ${proxy.server} is ${exitIp} (${country})`);

    const lastResponse = await this.open(page, reference);
    const document = await this.parsers.pages.parse(page);
    const response = lastResponse();
    if (this.parsers.challenges.isChallenge(document.title, document.body)) {
      this.logger.warn(`The site check appeared via ${proxy.server}`);

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

    return {
      // A card without a price is read too: the product may be out of stock.
      status: snapshot.prices.length > 0 ? 'success' : 'partial',
      snapshot,
      exitIp,
    };
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
