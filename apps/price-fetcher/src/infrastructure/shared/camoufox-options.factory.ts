import type { LaunchOptions } from 'camoufox-js';
import type { BrowserContextOptions } from 'playwright-core';
import type { ProxyEndpointEntity } from 'proxy-endpoint';

export interface CamoufoxLaunchSettingsInterface {
  headed: boolean;
  executablePath?: string;
}

/** Browser settings shared by the workers: Camoufox gives every launch its own fingerprint, so no session is kept. */
export class CamoufoxOptionsFactory {
  /** A Russian visitor: the language and the time zone are set in the browser itself, not in a context. */
  launch(settings: CamoufoxLaunchSettingsInterface): LaunchOptions {
    return {
      headless: !settings.headed,
      humanize: true,
      locale: ['ru-RU'],
      config: { timezone: 'Europe/Moscow' },
      // The option is named so by camoufox-js.
      // eslint-disable-next-line @typescript-eslint/naming-convention
      ...(settings.executablePath === undefined
        ? {}
        : { executable_path: settings.executablePath }),
    };
  }

  /** The route of a context; a null proxy is a direct connection. */
  context(proxy: ProxyEndpointEntity | null): BrowserContextOptions {
    return proxy === null
      ? {}
      : {
          proxy: {
            server: proxy.server,
            ...(proxy.username === ''
              ? {}
              : { username: proxy.username, password: proxy.password }),
          },
        };
  }
}
