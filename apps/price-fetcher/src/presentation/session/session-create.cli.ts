import { createInterface } from 'node:readline/promises';
import { parseArgs } from 'node:util';

import { ConsoleLoggerAdapter, parseLogLevel } from 'logger';
import { chromium } from 'playwright';
import { ProxyEndpointEntity } from 'proxy-endpoint';
import { sessionExportFileSchema } from 'queue-contract';
import { z } from 'zod';

import { OzonProductParser } from '../../infrastructure/ozon/ozon-product.parser.js';
import { OzonSessionCaptureAdapter } from '../../infrastructure/ozon/ozon-session-capture.adapter.js';
import { FileSessionStoreAdapter } from '../../infrastructure/session/file-session-store.adapter.js';
import { ChromiumLaunchAdapter } from '../../infrastructure/shared/chromium-launch.adapter.js';
import { promptCapture } from './capture-prompt.cli.js';

/** Opens a browser window, lets the person pass the site check and exports the session. */
export async function runSessionCreateCli(args: string[] = process.argv.slice(2)): Promise<void> {
  const { values } = parseArgs({
    // pnpm forwards an explicit `--` separator as is.
    args: args.filter((value): boolean => value !== '--'),
    options: {
      proxy: { type: 'string' },
      direct: { type: 'boolean' },
      out: { type: 'string', default: 'session.json' },
      'browser-path': { type: 'string' },
      'timeout-ms': { type: 'string', default: '60000' },
      'wait-ms': { type: 'string', default: '600000' },
      help: { type: 'boolean', short: 'h' },
    },
  });
  if (values.help === true) {
    console.log(
      'Usage: pnpm session:create (--proxy socks5://IP:PORT | --direct) [--out session.json] [--browser-path /usr/bin/chromium] [--timeout-ms 60000] [--wait-ms 600000]',
    );
    return;
  }
  if ((values.proxy === undefined) === (values.direct !== true))
    throw new Error('Provide exactly one of --proxy or --direct');
  const proxy = values.proxy === undefined ? null : new ProxyEndpointEntity(values.proxy);
  const timeoutMs = z.coerce.number().int().min(1000).max(600_000).parse(values['timeout-ms']);
  const waitMs = z.coerce.number().int().min(10_000).max(3_600_000).parse(values['wait-ms']);
  const logger = new ConsoleLoggerAdapter(
    parseLogLevel(process.env['LOG_LEVEL'], 'info'),
    'session-create',
  );
  const browser = await chromium.launch(
    new ChromiumLaunchAdapter().launchOptions({
      headed: true,
      timeoutMs,
      ...(values['browser-path'] === undefined ? {} : { executablePath: values['browser-path'] }),
    }),
  );
  const terminal = createInterface({ input: process.stdin, output: process.stdout });
  try {
    const capture = await new OzonSessionCaptureAdapter(
      browser,
      new OzonProductParser(),
      timeoutMs,
      logger,
    ).open(proxy);
    logger.info(`Exit IP: ${capture.exitIp}`);
    try {
      await promptCapture(terminal, { capture }, waitMs, false);
      const file = sessionExportFileSchema.parse(await capture.export());
      await FileSessionStoreAdapter.save(values.out, file);
      logger.info(`Session ${file.session.id} saved to ${values.out}`);
    } finally {
      await capture.close();
    }
  } finally {
    terminal.close();
    await browser.close();
  }
}
