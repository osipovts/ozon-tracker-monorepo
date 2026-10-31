import { errorMessage } from 'logger';

import { runSessionOnboardCli } from './presentation/session/session-onboard.cli.js';

try {
  await runSessionOnboardCli();
} catch (error: unknown) {
  console.error('Session onboarding failed:', errorMessage(error), '(see --help)');
  process.exitCode ??= 1;
}
