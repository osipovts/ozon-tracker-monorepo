import { z } from 'zod';

export const proxySourceSchema = z.enum(['github-free-proxy-list', 'proxifly', 'proxyscrape']);

export type ProxySourceType = z.infer<typeof proxySourceSchema>;
