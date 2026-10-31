export const availabilities = ['in_stock', 'out_of_stock', 'unknown'] as const;

export type AvailabilityType = (typeof availabilities)[number];

export interface PriceInterface {
  amountMinor: number;
  currency: 'RUB';
}

export interface PriceObservationInterface {
  id: string;
  trackedProductId: string;
  /** Fetch job that produced the observation. */
  jobId: string;
  title: string;
  observedAt: Date;
  availability: AvailabilityType;
  prices: PriceInterface[];
  exitIp: string | null;
}
