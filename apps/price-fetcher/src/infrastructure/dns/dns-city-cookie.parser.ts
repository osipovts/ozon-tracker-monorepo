const cityPattern = /"city":"([\da-f]{8}-[\da-f]{4}-[\da-f]{4}-[\da-f]{4}-[\da-f]{12})"/;

/** Reads the city the site has chosen for a visitor out of its cookie `current_path`. */
export class DnsCityCookieParser {
  /** Returns null when the cookie names no city. */
  parse(value: string): string | null {
    try {
      return cityPattern.exec(decodeURIComponent(value))?.[1] ?? null;
    } catch {
      return null;
    }
  }
}
