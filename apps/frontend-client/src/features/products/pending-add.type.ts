const storageKey = 'products.pendingAdd';
/** The hub gives up on a link in about a minute: an older record is of an add that is over. */
const maxAgeMs = 5 * 60_000;

/** The link that is being added, kept in the tab so that a reload can ask for it again: the hub joins the add in progress. */
export function rememberPendingAdd(url: string): void {
  try {
    sessionStorage.setItem(storageKey, JSON.stringify({ url, startedAt: Date.now() }));
  } catch {
    /* The storage may be blocked: the reload then forgets the add. */
  }
}

export function forgetPendingAdd(): void {
  try {
    sessionStorage.removeItem(storageKey);
  } catch {
    /* Nothing was kept. */
  }
}

/** The link whose add was cut short by a reload; null when there is none or it is too old. */
export function readPendingAdd(now: number = Date.now()): string | null {
  try {
    const raw = sessionStorage.getItem(storageKey);
    const value: unknown = raw === null ? null : JSON.parse(raw);
    if (typeof value !== 'object' || value === null || !('url' in value) || !('startedAt' in value))
      return null;

    const { url, startedAt } = value;

    return typeof url === 'string' && typeof startedAt === 'number' && now - startedAt < maxAgeMs
      ? url
      : null;
  } catch {
    return null;
  }
}
