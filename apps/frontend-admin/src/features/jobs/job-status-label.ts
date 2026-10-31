import type { TFunction } from 'i18next';

/** The status of a job as the hub names it; one it does not know is shown as it is. */
export function jobStatusLabel(status: string, t: TFunction): string {
  switch (status) {
    case 'queued':
      return t('jobs.status.queued');
    case 'running':
      return t('jobs.status.running');
    case 'retrying':
      return t('jobs.status.retrying');
    case 'completed':
      return t('jobs.status.completed');
    case 'failed':
      return t('jobs.status.failed');
    default:
      return status;
  }
}
