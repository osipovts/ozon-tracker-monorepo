import { z } from 'zod';

export const jobAcceptedResponseSchema = z.object({ jobId: z.uuid() });

export type JobAcceptedResponseType = z.infer<typeof jobAcceptedResponseSchema>;
