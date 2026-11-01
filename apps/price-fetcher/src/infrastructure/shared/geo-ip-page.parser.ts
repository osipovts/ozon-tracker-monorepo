import type { Page } from 'playwright-core';
import { z } from 'zod';

const geoSchema = z.object({
  ip: z.ipv4(),
  country: z
    .string()
    .regex(/^[A-Z]{2}$/)
    .optional(),
});

export interface GeoIpInterface {
  ip: string;
  /** ISO 3166-1 alpha-2 code, null if unknown. */
  country: string | null;
}

/** Reads the exit address of a browser context from a GeoIP service. */
export class GeoIpPageParser {
  /** Returns null when the service answers with an error or something unexpected. */
  async parse(page: Page): Promise<GeoIpInterface | null> {
    const response = await page.goto('https://ipinfo.io/json', { waitUntil: 'domcontentloaded' });
    if (response?.ok() !== true) return null;

    let value: unknown;
    try {
      value = JSON.parse(await page.locator('body').innerText());
    } catch {
      return null;
    }

    const geo = geoSchema.safeParse(value);

    return geo.success ? { ip: geo.data.ip, country: geo.data.country ?? null } : null;
  }
}
