export class OzonShortLinkParser {
  /** Whether the URL is a short link of Ozon, which redirects to the page of a product. */
  isShortLink(url: URL): boolean {
    return (
      url.protocol === 'https:' &&
      ['ozon.ru', 'www.ozon.ru'].includes(url.hostname) &&
      url.port === '' &&
      url.username === '' &&
      url.password === '' &&
      /^\/t\/[\w-]+\/?$/.test(url.pathname)
    );
  }
}
