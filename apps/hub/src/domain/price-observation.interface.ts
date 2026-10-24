export interface PriceInterface {
  amountMinor: number;
  currency: 'RUB';
}

export interface PriceObservationInterface {
  id: string;
  trackedProductId: string;
  /** Fetch job that produced the observation. */
  jobId: string;
  status: string;
  title: string;
  observedAt: Date;
  availability: 'in_stock' | 'out_of_stock' | 'unknown';
  prices: PriceInterface[];
  exitIp: string | null;
}
