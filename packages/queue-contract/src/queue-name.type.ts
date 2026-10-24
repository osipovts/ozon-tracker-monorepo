export const queueNames = {
  priceFetchJobs: 'price-fetch.jobs',
  priceFetchResults: 'price-fetch.results',
  proxyFetchJobs: 'proxy-fetch.jobs',
  proxyFetchResults: 'proxy-fetch.results',
} as const;

export type QueueNameType = (typeof queueNames)[keyof typeof queueNames];
