import { runSessionOnboardCli } from './presentation/session-onboard.cli.js';

try {
  await runSessionOnboardCli();
} catch (error: unknown) {
  console.error(
    'Session onboarding failed:',
    error instanceof Error ? error.message : 'unknown error',
    '(see --help)',
  );
  process.exitCode ??= 1;
}
