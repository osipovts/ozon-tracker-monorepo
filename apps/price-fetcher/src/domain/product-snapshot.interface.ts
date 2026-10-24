import type { MarketplaceType } from 'product-reference';

export interface PriceObservationInterface {
  amountMinor: number;
  currency: 'RUB';
}

export interface ProductSnapshotInterface {
  productId: string;
  url: string;
  title: string;
  observedAt: string;
  deliveryContext: 'site_default';
  prices: PriceObservationInterface[];
  availability: 'in_stock' | 'out_of_stock' | 'unknown';
}

export type ReadProductResultType =
  | { status: 'success' | 'partial'; snapshot: ProductSnapshotInterface; exitIp: string | null }
  | {
      status:
        'challenge_required' | 'network_error' | 'proxy_rejected' | 'parse_error' | 'http_error';
      httpStatus?: number;
    };

export interface ProductAttemptInterface {
  proxy: string | null;
  result: ReadProductResultType;
}

export interface TrackingResultInterface {
  marketplace: MarketplaceType;
  productId: string;
  url: string;
  status: ReadProductResultType['status'] | 'no_proxies';
  attempts: ProductAttemptInterface[];
}
