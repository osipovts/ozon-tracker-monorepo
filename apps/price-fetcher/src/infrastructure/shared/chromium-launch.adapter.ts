import type { BrowserContextOptions, LaunchOptions } from 'playwright';
import type { ProxyEndpointEntity } from 'proxy-endpoint';

export interface ChromiumLaunchSettingsInterface {
  headed: boolean;
  timeoutMs: number;
  executablePath?: string;
}

/** Browser settings shared by the worker and the session onboarding. */
export class ChromiumLaunchAdapter {
  launchOptions(settings: ChromiumLaunchSettingsInterface): LaunchOptions {
    return {
      channel: 'chromium',
      headless: !settings.headed,
      args: ['--disable-blink-features=AutomationControlled'],
      ignoreDefaultArgs: ['--enable-automation'],
      timeout: settings.timeoutMs,
      ...(settings.executablePath === undefined ? {} : { executablePath: settings.executablePath }),
    };
  }

  proxyOptions(proxy: ProxyEndpointEntity | null): Pick<BrowserContextOptions, 'proxy'> {
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
