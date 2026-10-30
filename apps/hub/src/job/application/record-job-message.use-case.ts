import type { JobLifecycleType, JobProgressType } from 'queue-contract';

import type { JobEventInterface } from './job-event.interface.js';
import type { RecordJobEventUseCase } from './record-job-event.use-case.js';

/** Records the messages every worker reports about its job. */
export class RecordJobMessageUseCase {
  constructor(private readonly recordJobEvent: RecordJobEventUseCase) {}

  execute(message: JobLifecycleType | JobProgressType, at: Date): Promise<void> {
    return this.recordJobEvent.execute(this.toEvent(message, at));
  }

  private toEvent(message: JobLifecycleType | JobProgressType, at: Date): JobEventInterface {
    const { jobId } = message;
    switch (message.type) {
      case 'job_started':
        return { type: 'started', jobId, at };
      case 'job_progress':
        return {
          type: 'progress',
          jobId,
          at,
          progress: {
            processed: message.processed,
            total: message.total,
            succeeded: message.succeeded,
          },
        };
      case 'job_done':
        return { type: 'completed', jobId, at };
      case 'job_failed':
        return {
          type: 'failed',
          jobId,
          at,
          reason: message.reason,
          willRetry: message.willRetry,
        };
    }
  }
}
