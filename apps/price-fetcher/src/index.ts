import { runTrackerCli } from './presentation/product/tracker.cli.js';

try {
  await runTrackerCli();
} catch (error: unknown) {
  // Never print a proxy URL with credentials or raw browser navigation errors.
  console.error(
    error instanceof Error && error.name === 'AbortError'
      ? 'Cancelled'
      : 'Tracker failed. Check the URL, options, network and installed browser (--help).',
  );
  process.exitCode ??= 1;
}
