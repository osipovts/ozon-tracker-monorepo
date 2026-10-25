import { randomUUID } from 'node:crypto';
import { setTimeout } from 'node:timers/promises';

import { type LoggerPort, silentLogger } from 'logger';
import type { Browser, BrowserContext, Page } from 'playwright';
import { marketplaceExitCountries, type MarketplaceType } from 'product-reference';
import type { ProxyEndpointEntity } from 'proxy-endpoint';

import type {
  SessionCaptureInterface,
  SessionCapturePort,
} from '../../application/session/session-capture.port.js';
import type { CapturedSessionInterface } from '../../domain/session/captured-session.interface.js';
import type { ChromiumOptionsFactory } from '../shared/chromium-options.factory.js';
import type { GeoIpPageParser } from '../shared/geo-ip-page.parser.js';
import type { OzonChallengeParser } from './ozon-challenge.parser.js';

const pollIntervalMs = 1000;
/** Lets the site finish setting its cookies after the check. */
const settleMs = 2000;

/** Opens Ozon in a window and recognizes when the person has passed the site check. */
export class OzonSessionCaptureAdapter implements SessionCapturePort {
  readonly marketplace: MarketplaceType = 'ozon';

  constructor(
    private readonly browser: Pick<Browser, 'newContext'>,
    private readonly options: ChromiumOptionsFactory,
    private readonly geoIp: GeoIpPageParser,
    private readonly challenges: OzonChallengeParser,
    private readonly navigationTimeoutMs: number,
    private readonly logger: LoggerPort = silentLogger,
  ) {}

  async open(proxy: ProxyEndpointEntity | null): Promise<SessionCaptureInterface> {
    const context = await this.browser.newContext({
      ...this.options.context(proxy),
      viewport: null,
    });
    context.setDefaultNavigationTimeout(this.navigationTimeoutMs);

    try {
      const page = await context.newPage();
      const exit = await this.geoIp.parse(page);
      if (exit === null) throw new Error('the GeoIP service did not tell the exit address');

      this.logger.debug(`Exit IP ${exit.ip} ${exit.country ?? '??'}`);
      // The workers only accept exits in the country of the marketplace through a proxy.
      const country = marketplaceExitCountries[this.marketplace];
      if (proxy !== null && exit.country !== country)
        throw new Error(`the exit ${exit.ip} is not in ${country} (${exit.country ?? 'unknown'})`);

      await page.goto('https://www.ozon.ru/', { waitUntil: 'domcontentloaded' });

      return this.capture(context, page, proxy, exit.ip);
    } catch (error: unknown) {
      await context.close();
      throw error;
    }
  }

  private capture(
    context: BrowserContext,
    page: Page,
    proxy: ProxyEndpointEntity | null,
    exitIp: string,
  ): SessionCaptureInterface {
    return {
      waitUntilPassed: async (signal): Promise<void> => {
        for (;;) {
          signal.throwIfAborted();
          if (page.isClosed()) throw new Error('the window was closed');

          if (await this.passed(page)) {
            this.logger.debug('The site shows its pages: the check is passed');
            await setTimeout(settleMs, undefined, { signal });

            return;
          }

          await setTimeout(pollIntervalMs, undefined, { signal });
        }
      },
      export: async (): Promise<CapturedSessionInterface> => ({
        marketplace: this.marketplace,
        proxy: proxy?.server ?? null,
        session: {
          id: randomUUID(),
          exitIp,
          userAgent: await page.evaluate((): string => window.navigator.userAgent),
          storageState: await context.storageState(),
        },
        createdAt: new Date().toISOString(),
      }),
      close: async (): Promise<void> => {
        await context.close();
      },
    };
  }

  /** Ozon pages are made of widgets; a check page has none of them. */
  private async passed(page: Page): Promise<boolean> {
    try {
      const state = await page.evaluate((): { title: string; body: string; widgets: number } => ({
        title: window.document.title,
        body: window.document.body.innerText.slice(0, 4000),
        widgets: window.document.querySelectorAll('[data-widget]').length,
      }));

      return state.widgets > 0 && !this.challenges.isChallenge(state.title, state.body);
    } catch {
      // The page is navigating: look again on the next poll.
      return false;
    }
  }
}
