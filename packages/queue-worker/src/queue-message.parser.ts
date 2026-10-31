import { UnrecoverableError } from 'bullmq';
import type { LoggerPort } from 'logger';
import type { z } from 'zod';

const maxReasonLength = 200;

/** Validates a queue message; a malformed one fails for good since redelivery cannot fix it. */
export class QueueMessageParser {
  constructor(private readonly logger: LoggerPort) {}

  parse<OutputType>(schema: z.ZodType<OutputType>, data: unknown, description: string): OutputType {
    const parsed = schema.safeParse(data);
    if (!parsed.success) {
      this.logger.warn(
        `Dropping a malformed ${description}: ${parsed.error.message.slice(0, maxReasonLength)}`,
      );
      throw new UnrecoverableError(`Malformed ${description}`);
    }

    return parsed.data;
  }
}
