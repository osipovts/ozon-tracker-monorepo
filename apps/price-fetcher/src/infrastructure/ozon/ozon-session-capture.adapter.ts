import { randomUUID } from 'node:crypto';
import { setTimeout } from 'node:timers/promises';

import { type LoggerPort, silentLogger } from 'logger';
import type { Browser, BrowserContext, Page } from 'playwright';
import type { ProxyEndpointEntity } from 'proxy-endpoint';
import { z } from 'zod';

import type {
  SessionCaptureInterface,
  SessionCapturePort,
} from '../../application/session/session-capture.port.js';
import type { CapturedSessionInterface } from '../../domain/session/captured-session.interface.js';
import { ChromiumLaunchAdapter } from '../shared/chromium-launch.adapter.js';
import type { OzonProductParser } from './ozon-product.parser.js';

const geoSchema = z.object({ ip: z.ipv4(), country: z.string().optional() });
const pollIntervalMs = 1000;
/** Lets the site finish setting its cookies after the check. */
const settleMs = 2000;

/** Opens Ozon in a window and recognizes when the person has passed the site check. */
export class OzonSessionCaptureAdapter implements SessionCapturePort {
  private readonly chromium = new ChromiumLaunchAdapter();

  constructor(
    private readonly browser: Pick<Browser, 'newContext' | 'version'>,
    private readonly parser: OzonProductParser,
    private readonly navigationTimeoutMs: number,
    private readonly logger: LoggerPort = silentLogger,
  ) {}

  async open(proxy: ProxyEndpointEntity | null): Promise<SessionCaptureInterface> {
    const context = await this.browser.newContext({
      locale: 'ru-RU',
      timezoneId: 'Europe/Moscow',
      viewport: null,
      ...this.chromium.proxyOptions(proxy),
    });
    context.setDefaultNavigationTimeout(this.navigationTimeoutMs);
    try {
      const page = await context.newPage();
      await page.goto('https://ipinfo.io/json', { waitUntil: 'domcontentloaded' });
      const geo = geoSchema.parse(JSON.parse(await page.locator('body').innerText()));
      this.logger.debug(`Exit IP ${geo.ip} ${geo.country ?? '??'}`);
      // The workers only accept Russian exits through a proxy.
      if (proxy !== null && geo.country !== 'RU')
        throw new Error(`the exit ${geo.ip} is not in Russia (${geo.country ?? 'unknown'})`);
      await page.goto('https://www.ozon.ru/', { waitUntil: 'domcontentloaded' });
      return this.capture(context, page, proxy, geo.ip);
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
      exitIp,
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
        marketplace: 'ozon',
        proxy: proxy?.server ?? null,
        session: {
          id: randomUUID(),
          exitIp,
          userAgent: await page.evaluate((): string => window.navigator.userAgent),
          platform: process.platform,
          browserVersion: this.browser.version(),
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
      return (
        state.widgets > 0 &&
        !this.parser.isChallenge({
          title: state.title,
          heading: '',
          body: state.body,
          priceText: '',
          purchaseText: '',
          structuredData: [],
        })
      );
    } catch {
      // The page is navigating: look again on the next poll.
      return false;
    }
  }
}
