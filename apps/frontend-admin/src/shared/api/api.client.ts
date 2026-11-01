import { createApiClient } from 'frontend-shared';

import type { paths } from './schema.js';

export const api = createApiClient<paths>();
