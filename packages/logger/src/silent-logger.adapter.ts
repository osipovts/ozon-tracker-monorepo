import type { LoggerPort } from './logger.port.js';

/** Drops every message; the default for components created without a logger. */
export class SilentLoggerAdapter implements LoggerPort {
  error(): void {
    /* Silent. */
  }

  warn(): void {
    /* Silent. */
  }

  info(): void {
    /* Silent. */
  }

  debug(): void {
    /* Silent. */
  }

  verbose(): void {
    /* Silent. */
  }

  child(): LoggerPort {
    return this;
  }
}

export const silentLogger: LoggerPort = new SilentLoggerAdapter();
