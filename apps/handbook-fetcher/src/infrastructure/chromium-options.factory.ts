import type { BrowserContextOptions, LaunchOptions } from 'playwright';
import type { ProxyEndpointEntity } from 'proxy-endpoint';

export interface ChromiumLaunchSettingsInterface {
  headed: boolean;
  timeoutMs: number;
  executablePath?: string;
}

/** Browser settings shared by the worker and the session onboarding. */
export class ChromiumOptionsFactory {
  launch(settings: ChromiumLaunchSettingsInterface): LaunchOptions {
    return {
      channel: 'chromium',
      headless: !settings.headed,
      args: ['--disable-blink-features=AutomationControlled'],
      ignoreDefaultArgs: ['--enable-automation'],
      timeout: settings.timeoutMs,
      ...(settings.executablePath === undefined ? {} : { executablePath: settings.executablePath }),
    };
  }

  /** A Russian visitor coming through the route; a null proxy is a direct connection. */
  context(proxy: ProxyEndpointEntity | null): BrowserContextOptions {
    return {
      locale: 'ru-RU',
      timezoneId: 'Europe/Moscow',
      ...(proxy === null
        ? {}
        : {
            proxy: {
              server: proxy.server,
              ...(proxy.username === ''
                ? {}
                : { username: proxy.username, password: proxy.password }),
            },
          }),
    };
  }
}
