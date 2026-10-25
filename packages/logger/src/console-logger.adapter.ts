import type { LoggerPort, LogLevelType } from './logger.port.js';

const levels: readonly LogLevelType[] = ['error', 'warn', 'info', 'debug', 'verbose'];
const severities: Record<LogLevelType, number> = {
  error: 0,
  warn: 1,
  info: 2,
  debug: 3,
  verbose: 4,
};

export function parseLogLevel(value: string | undefined, fallback: LogLevelType): LogLevelType {
  const normalized = value?.trim().toLowerCase();

  return levels.find((level): boolean => level === normalized) ?? fallback;
}

/** Writes `time LEVEL [context] message` lines; errors and warnings go to stderr. */
export class ConsoleLoggerAdapter implements LoggerPort {
  constructor(
    private readonly level: LogLevelType,
    private readonly context: string,
  ) {}

  error(message: string): void {
    this.write('error', message);
  }

  warn(message: string): void {
    this.write('warn', message);
  }

  info(message: string): void {
    this.write('info', message);
  }

  debug(message: string): void {
    this.write('debug', message);
  }

  verbose(message: string): void {
    this.write('verbose', message);
  }

  child(context: string): LoggerPort {
    return new ConsoleLoggerAdapter(this.level, `${this.context}:${context}`);
  }

  private write(level: LogLevelType, message: string): void {
    if (severities[level] > severities[this.level]) return;

    const line = `${new Date().toISOString()} ${level.toUpperCase().padEnd(7)} [${this.context}] ${message}`;
    if (severities[level] <= severities.warn) console.error(line);
    else console.log(line);
  }
}
