/**
 * Waits for `closing`, and calls `cancel` once if it takes longer than `deadlineMs`: the work in
 * progress is asked to stop, so that the process ends before the one who stops it loses patience.
 */
export async function closeWithin(
  closing: Promise<void>,
  cancel: () => void,
  deadlineMs: number,
): Promise<void> {
  const timer = setTimeout(cancel, deadlineMs);

  try {
    await closing;
  } finally {
    clearTimeout(timer);
  }
}
