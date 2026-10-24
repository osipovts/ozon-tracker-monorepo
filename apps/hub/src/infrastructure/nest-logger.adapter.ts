import type { LoggerService } from '@nestjs/common';
import type { LoggerPort } from 'logger';

/** Sends the messages of Nest itself through the logger of the application. */
export class NestLoggerAdapter implements LoggerService {
  constructor(private readonly logger: LoggerPort) {}

  log(message: unknown, ...optionalParams: unknown[]): void {
    this.contextual(optionalParams).info(this.format(message));
  }

  error(message: unknown, ...optionalParams: unknown[]): void {
    const details = optionalParams.filter((param): boolean => typeof param === 'string');
    // Nest appends the stack trace and the context as strings.
    const context = details.length > 1 ? details.at(-1) : undefined;
    this.contextual(context === undefined ? [] : [context]).error(
      [this.format(message), ...details.slice(0, context === undefined ? undefined : -1)].join(
        '\n',
      ),
    );
  }

  warn(message: unknown, ...optionalParams: unknown[]): void {
    this.contextual(optionalParams).warn(this.format(message));
  }

  debug(message: unknown, ...optionalParams: unknown[]): void {
    this.contextual(optionalParams).debug(this.format(message));
  }

  verbose(message: unknown, ...optionalParams: unknown[]): void {
    this.contextual(optionalParams).verbose(this.format(message));
  }

  private contextual(optionalParams: unknown[]): LoggerPort {
    const context = optionalParams.at(-1);
    return typeof context === 'string' ? this.logger.child(context) : this.logger;
  }

  private format(message: unknown): string {
    if (typeof message === 'string') return message;
    return message instanceof Error ? message.message : JSON.stringify(message);
  }
}
