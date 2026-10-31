import type { Page } from 'playwright';

import type { OzonPageInterface } from './ozon-page.interface.js';

/** Reads the parts of a rendered Ozon page that the product and challenge parsers need. */
export class OzonPageParser {
  async parse(browserPage: Page): Promise<OzonPageInterface> {
    // Wait for product data or a challenge, rather than networkidle (analytics may never idle).
    await browserPage
      .locator(
        '[data-widget^="webPrice"], [data-widget^="webAddToCart"], [data-widget^="webOutOfStock"], [class*="captcha"], iframe[src*="captcha"]',
      )
      .first()
      .waitFor({ state: 'visible' })
      .catch((): void => {
        /* Inspect the final document on timeout as well. */
      });

    return browserPage.evaluate((): OzonPageInterface => {
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
              Math.abs(Number.parseFloat(decoration.top) + lineHeight / 2 - bounds.height / 2) <= 2;

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
        url: window.location.href,
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
        outOfStockText:
          window.document.querySelector<HTMLElement>('[data-widget^="webOutOfStock"]')?.innerText ??
          '',
        imageUrl:
          window.document.querySelector('meta[property="og:image"]')?.getAttribute('content') ?? '',
        structuredData: Array.from(
          window.document.querySelectorAll('script[type="application/ld+json"]'),
        ).map((element): string => element.textContent),
      };
    });
  }
}
