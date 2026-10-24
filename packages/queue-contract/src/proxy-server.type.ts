import { z } from 'zod';

/** HTTP(S) or SOCKS5 proxy URL. HTTP(S) proxies may carry credentials in the URL. */
export const proxyServerSchema = z.url({ protocol: /^(?:https?|socks5)$/ });

export type ProxyServerType = z.infer<typeof proxyServerSchema>;
