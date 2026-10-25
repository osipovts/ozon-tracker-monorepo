import type { Interface } from 'node:readline/promises';

import type {
  CaptureDecisionType,
  CaptureStepInterface,
} from '../../application/session/onboard-sessions.use-case.js';

/**
 * Waits until the check is passed in the window, or until the person presses Enter
 * (save now) or types `s` (skip). Rejects when the time is up.
 */
export async function promptCapture(
  terminal: Interface,
  step: Pick<CaptureStepInterface, 'capture'>,
  waitMs: number,
): Promise<CaptureDecisionType> {
  const controller = new AbortController();
  const signal = AbortSignal.any([controller.signal, AbortSignal.timeout(waitMs)]);

  try {
    return await Promise.race([
      step.capture.waitUntilPassed(signal).then((): CaptureDecisionType => 'save'),
      terminal
        .question(
          'Pass the check in the window; it is saved automatically. Enter saves now, s + Enter skips: ',
          { signal },
        )
        .then((answer): CaptureDecisionType =>
          answer.trim().toLowerCase() === 's' ? 'skip' : 'save',
        ),
    ]);
  } finally {
    controller.abort();
  }
}
