import type { Interface } from 'node:readline/promises';

import type {
  CaptureDecisionType,
  CaptureStepInterface,
} from '../application/onboard-sessions.use-case.js';

/**
 * Waits until the check is passed in the window, or until the person presses Enter
 * (save now) or types `s` (skip, when allowed). Rejects when the time is up.
 */
export async function promptCapture(
  terminal: Interface,
  step: Pick<CaptureStepInterface, 'capture'>,
  waitMs: number,
  allowSkip: boolean,
): Promise<CaptureDecisionType> {
  const controller = new AbortController();
  const signal = AbortSignal.any([controller.signal, AbortSignal.timeout(waitMs)]);
  try {
    return await Promise.race([
      step.capture.waitUntilPassed(signal).then((): CaptureDecisionType => 'save'),
      terminal
        .question(
          allowSkip
            ? 'Pass the check in the window; it is saved automatically. Enter saves now, s + Enter skips: '
            : 'Pass the check in the window; it is saved automatically. Enter saves now: ',
          { signal },
        )
        .then((answer): CaptureDecisionType =>
          allowSkip && answer.trim().toLowerCase() === 's' ? 'skip' : 'save',
        ),
    ]);
  } finally {
    controller.abort();
  }
}
