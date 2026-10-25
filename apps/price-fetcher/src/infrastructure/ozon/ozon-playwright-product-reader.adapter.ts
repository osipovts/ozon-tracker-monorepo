import { type LoggerPort, silentLogger } from 'logger';
import type { Browser, Response } from 'playwright';
import type { ProductReferenceEntity } from 'product-reference';
import { OzonReferenceParser } from 'product-reference';
import type { ProxyEndpointEntity } from 'proxy-endpoint';
import { z } from 'zod';

import type { ProductReaderPort } from '../../application/product/product-reader.port.js';
import type { SessionStorePort } from '../../application/session/session-store.port.js';
import type { ReadProductResultType } from '../../domain/product/product-snapshot.interface.js';
import type { BrowserSessionInterface } from '../../domain/session/browser-session.interface.js';
import { ChromiumLaunchAdapter } from '../shared/chromium-launch.adapter.js';
import type { OzonPageInterface } from './ozon-page.interface.js';
import type { OzonProductParser } from './ozon-product.parser.js';

const exitSchema = z.object({ ip: z.ipv4(), country: z.literal('RU') });

export class OzonPlaywrightProductReaderAdapter implements ProductReaderPort {
  private readonly references = new OzonReferenceParser();
  private readonly chromium = new ChromiumLaunchAdapter();

  constructor(
    private readonly browser: Pick<Browser, 'newContext'>,
    private readonly parser: OzonProductParser,
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
    const session = this.sessions?.find(proxy) ?? null;
    this.logger.debug(
      `Opening a browser context via ${proxy?.server ?? 'direct connection'}, ${session === null ? 'no session' : `session ${session.id}`}`,
    );
    let activeSession: BrowserSessionInterface | null = session;
    const context = await this.browser.newContext({
      locale: 'ru-RU',
      timezoneId: 'Europe/Moscow',
      ...(session === null
        ? {}
        : { userAgent: session.userAgent, storageState: session.storageState }),
      ...this.chromium.proxyOptions(proxy),
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
      let exitIp: string | null = null;
      if (proxy !== null) {
        const geoResponse = await page.goto('https://ipinfo.io/json', {
          waitUntil: 'domcontentloaded',
        });
        if (geoResponse?.ok() !== true) {
          this.logger.warn(
            `GeoIP check through ${proxy.server} failed: HTTP ${String(geoResponse?.status() ?? 'none')}`,
          );
          return { status: 'proxy_rejected' };
        }
        let geoValue: unknown;
        try {
          geoValue = JSON.parse(await page.locator('body').innerText());
        } catch {
          this.logger.warn(`GeoIP answer through ${proxy.server} is not JSON`);
          return { status: 'proxy_rejected' };
        }
        const geo = exitSchema.safeParse(geoValue);
        if (!geo.success) {
          this.logger.warn(`GeoIP did not confirm a Russian exit through ${proxy.server}`);
          return { status: 'proxy_rejected' };
        }
        exitIp = geo.data.ip;
        this.logger.debug(`Exit IP through ${proxy.server} is ${exitIp} (RU)`);
        // A session is only valid on the exit address it was created with.
        if (activeSession !== null && activeSession.exitIp !== exitIp) {
          this.logger.warn(
            `Session ${activeSession.id} was created at ${activeSession.exitIp}, the exit is ${exitIp}: ignoring the session`,
          );
          this.sessions?.reject(activeSession.id, exitIp);
          await context.setStorageState({ cookies: [], origins: [] });
          activeSession = null;
        }
      }

      let response: Response | null = null;
      page.on('response', (received): void => {
        if (received.request().isNavigationRequest() && received.frame() === page.mainFrame())
          response = received;
      });
      response = await page.goto(reference.url, { waitUntil: 'domcontentloaded' });
      this.logger.debug(
        `Opened ${reference.url}: HTTP ${String(response?.status() ?? 'none')}, final URL ${page.url()}`,
      );
      // Wait for product data or a challenge, rather than networkidle (analytics may never idle).
      await page
        .locator(
          '[data-widget^="webPrice"], [data-widget^="webAddToCart"], [data-widget^="webOutOfStock"], [class*="captcha"], iframe[src*="captcha"]',
        )
        .first()
        .waitFor({ state: 'visible' })
        .catch((): void => {
          /* Inspect the final document on timeout as well. */
        });
      const document = await page.evaluate((): OzonPageInterface => {
        const price = window.document.querySelector('[data-widget^="webPrice"]');
        const priceParts: string[] = [];
        if (price !== null) {
          const walker = window.document.createTreeWalker(price, NodeFilter.SHOW_TEXT);
          let node = walker.nextNode();
          while (node !== null) {
            let parent = node.parentElement;
            let visible = true;
            while (parent !== null && price.contains(parent)) {
              const style = window.getComputedStyle(parent);
              // Ozon also strikes old prices with a positioned CSS pseudo-element.
              const decoration = window.getComputedStyle(parent, '::after');
              const bounds = parent.getBoundingClientRect();
              const lineHeight = Number.parseFloat(decoration.height);
              const struckByPseudoElement =
                style.position === 'relative' &&
                decoration.content !== 'none' &&
                decoration.position === 'absolute' &&
                lineHeight > 0 &&
                lineHeight <= 2 &&
                Number.parseFloat(decoration.width) >= bounds.width * 0.9 &&
                Math.abs(Number.parseFloat(decoration.top) + lineHeight / 2 - bounds.height / 2) <=
                  2;
              if (
                ['S', 'DEL', 'STRIKE'].includes(parent.tagName) ||
                style.textDecorationLine.includes('line-through') ||
                struckByPseudoElement ||
                style.display === 'none' ||
                style.visibility === 'hidden'
              )
                visible = false;
              parent = parent.parentElement;
            }
            if (visible && node.textContent !== null) priceParts.push(node.textContent.trim());
            node = walker.nextNode();
          }
        }
        return {
          title: window.document.title,
          heading: Array.from(window.document.querySelectorAll<HTMLElement>('h1'))
            .map((element): string => element.innerText)
            .join('\n'),
          body: window.document.body.innerText.slice(0, 8000),
          priceText: priceParts.join('\n'),
          purchaseText: Array.from(
            window.document.querySelectorAll<HTMLElement>(
              '[data-widget^="webAddToCart"], [data-widget^="webOutOfStock"], [data-widget^="webPrice"]',
            ),
          )
            .map((element): string => element.innerText)
            .join('\n'),
          structuredData: Array.from(
            window.document.querySelectorAll('script[type="application/ld+json"]'),
          ).map((element): string => element.textContent),
        };
      });
      if (this.parser.isChallenge(document)) {
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
      try {
        if (this.references.parse(new URL(page.url()))?.id !== reference.id)
          return { status: 'parse_error' };
      } catch {
        return { status: 'parse_error' };
      }
      const snapshot = this.parser.parse(reference, document);
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
    } catch (error: unknown) {
      signal.throwIfAborted();
      this.logger.warn(
        `Browser error via ${proxy?.server ?? 'direct connection'}: ${error instanceof Error ? (error.message.split('\n')[0] ?? '') : 'unknown error'}`,
      );
      return { status: 'network_error' };
    } finally {
      signal.removeEventListener('abort', abort);
      await context.close();
    }
  }
}
