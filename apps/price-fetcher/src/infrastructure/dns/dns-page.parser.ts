import type { Page } from 'playwright';

import type { DnsPageInterface } from './dns-page.interface.js';

/** Reads the parts of a rendered DNS card that the product parser needs. */
export class DnsPageParser {
  async parse(browserPage: Page): Promise<DnsPageInterface> {
    // The buying block is drawn by the page after it has loaded.
    await browserPage
      .locator('.product-buy__price')
      .first()
      .waitFor({ state: 'visible' })
      .catch((): void => {
        /* Inspect the final document on timeout as well. */
      });

    return browserPage.evaluate((): DnsPageInterface => {
      const buy = window.document.querySelector('.product-buy');
      const structured = Array.from(
        window.document.querySelectorAll('script[type="application/ld+json"]'),
      ).flatMap((element): unknown[] => {
        try {
          const value: unknown = JSON.parse(element.textContent);

          return Array.isArray(value) ? value : [value];
        } catch {
          return [];
        }
      });
      const product = structured.find(
        (value): value is { image?: unknown } =>
          typeof value === 'object' &&
          value !== null &&
          '@type' in value &&
          value['@type'] === 'Product',
      );
      const image: unknown = Array.isArray(product?.image) ? product.image[0] : product?.image;

      return {
        url: window.location.href,
        heading: window.document.querySelector('h1')?.innerText.trim() ?? '',
        priceText: buy?.querySelector<HTMLElement>('.product-buy__price')?.innerText ?? '',
        hasBuyButton: buy?.querySelector('.buy-btn') != null,
        hasNotifyButton: buy?.querySelector('.notify-btn') != null,
        imageUrl:
          typeof image === 'string'
            ? image
            : (window.document
                .querySelector('meta[property="og:image"]')
                ?.getAttribute('content') ?? ''),
      };
    });
  }
}
