export type LogLevelType = 'error' | 'warn' | 'info' | 'debug' | 'verbose';

export interface LoggerPort {
  error(message: string): void;
  warn(message: string): void;
  info(message: string): void;
  debug(message: string): void;
  verbose(message: string): void;
  /** A logger of a sub-component; its context is appended to the parent one. */
  child(context: string): LoggerPort;
}
