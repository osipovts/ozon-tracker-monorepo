/** Whether the prices of the marketplace of the link depend on the city: the user is asked for one. */
export function linkHasCities(link: string): boolean {
  try {
    const { hostname } = new URL(link);

    return hostname === 'dns-shop.ru' || hostname === 'www.dns-shop.ru';
  } catch {
    return false;
  }
}
