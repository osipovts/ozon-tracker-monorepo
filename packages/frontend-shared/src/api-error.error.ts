/** The hub refused a request: what it said, with the status, and how long to wait if it asked to. */
export class ApiError extends Error {
  constructor(
    readonly status: number,
    message: string,
    /** From `Retry-After` of a 429; null for the others. */
    readonly retryAfterSeconds: number | null,
  ) {
    super(message);
    this.name = 'ApiError';
  }
}
