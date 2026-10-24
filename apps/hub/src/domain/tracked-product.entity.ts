export class TrackedProductEntity {
  constructor(
    readonly id: string,
    readonly marketplace: string,
    readonly externalId: string,
    /** Canonical product URL. */
    readonly url: string,
    readonly lastStatus: string | null,
    readonly lastCheckedAt: Date | null,
  ) {}
}
