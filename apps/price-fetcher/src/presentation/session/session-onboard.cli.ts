import { createInterface } from 'node:readline/promises';
import { parseArgs } from 'node:util';

import { ConsoleLoggerAdapter, parseLogLevel } from 'logger';
import { chromium } from 'playwright';
import { z } from 'zod';

import { OnboardSessionsUseCase } from '../../application/session/onboard-sessions.use-case.js';
import { OzonChallengeParser } from '../../infrastructure/ozon/ozon-challenge.parser.js';
import { OzonSessionCaptureAdapter } from '../../infrastructure/ozon/ozon-session-capture.adapter.js';
import { HubApiAdapter } from '../../infrastructure/session/hub-api.adapter.js';
import { ChromiumOptionsFactory } from '../../infrastructure/shared/chromium-options.factory.js';
import { GeoIpPageParser } from '../../infrastructure/shared/geo-ip-page.parser.js';
import { promptCapture } from './capture-prompt.cli.js';

/** Takes the hub proxies without a session, lets the person pass the check through each and uploads the sessions. */
export async function runSessionOnboardCli(args: string[] = process.argv.slice(2)): Promise<void> {
  const { values } = parseArgs({
    // pnpm forwards an explicit `--` separator as is.
    args: args.filter((value): boolean => value !== '--'),
    options: {
      hub: { type: 'string', default: process.env['HUB_URL'] ?? 'http://localhost:3000' },
      limit: { type: 'string', default: '5' },
      'wait-ms': { type: 'string', default: '600000' },
      'timeout-ms': { type: 'string', default: '60000' },
      'browser-path': { type: 'string' },
      help: { type: 'boolean', short: 'h' },
    },
  });

  if (values.help === true) {
    console.log(
      'Usage: pnpm session:onboard [--hub http://localhost:3000] [--limit 5] [--wait-ms 600000] [--timeout-ms 60000] [--browser-path /usr/bin/chromium]',
    );

    return;
  }

  const hubUrl = z.url({ protocol: /^https?$/ }).parse(values.hub);
  const limit = z.coerce.number().int().min(1).max(100).parse(values.limit);
  const waitMs = z.coerce.number().int().min(10_000).max(3_600_000).parse(values['wait-ms']);
  const timeoutMs = z.coerce.number().int().min(1000).max(600_000).parse(values['timeout-ms']);

  const logger = new ConsoleLoggerAdapter(
    parseLogLevel(process.env['LOG_LEVEL'], 'info'),
    'session-onboard',
  );

  const options = new ChromiumOptionsFactory();
  const browser = await chromium.launch(
    options.launch({
      headed: true,
      timeoutMs,
      ...(values['browser-path'] === undefined ? {} : { executablePath: values['browser-path'] }),
    }),
  );
  const terminal = createInterface({ input: process.stdin, output: process.stdout });
  try {
    const summary = await new OnboardSessionsUseCase(
      new HubApiAdapter(hubUrl),
      new OzonSessionCaptureAdapter(
        browser,
        options,
        new GeoIpPageParser(),
        new OzonChallengeParser(),
        timeoutMs,
        logger.child('capture'),
      ),
      logger,
    ).execute(limit, new AbortController().signal, (step) => promptCapture(terminal, step, waitMs));

    logger.info(
      `Done: ${String(summary.ready.length)} ready, ${String(summary.skipped.length)} skipped`,
    );
    for (const { server, reason } of summary.skipped) logger.info(`Skipped ${server}: ${reason}`);
  } finally {
    terminal.close();
    await browser.close();
  }
}
