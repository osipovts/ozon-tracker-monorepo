export interface PriceObservationInterface {
  amountMinor: number;
  currency: 'RUB';
}

export interface ProductSnapshotInterface {
  title: string;
  observedAt: string;
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
  status: ReadProductResultType['status'] | 'no_proxies';
  attempts: ProductAttemptInterface[];
}
