import { runSessionCreateCli } from './presentation/session-create.cli.js';

try {
  await runSessionCreateCli();
} catch {
  console.error('Session creation failed. Check the options and the network (--help).');
  process.exitCode ??= 1;
}
