/** Whether a link opens a web page: the address of a product is not followed to anywhere else. */
export function isHttpLink(link: string): boolean {
  try {
    const { protocol } = new URL(link);

    return protocol === 'https:' || protocol === 'http:';
  } catch {
    return false;
  }
}
