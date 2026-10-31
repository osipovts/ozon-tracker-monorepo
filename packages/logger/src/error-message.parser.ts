/** The message of an error for a log line, whatever was thrown. */
export function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : 'unknown error';
}
