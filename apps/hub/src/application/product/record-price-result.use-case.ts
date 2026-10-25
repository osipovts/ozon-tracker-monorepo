import { randomUUID } from 'node:crypto';

import { type LoggerPort, silentLogger } from 'logger';

import type { PriceObservationInterface } from '../../domain/product/price-observation.interface.js';
import type { PriceObservationRepositoryPort } from './price-observation-repository.port.js';
import type { TrackedProductRepositoryPort } from './tracked-product-repository.port.js';

export interface PriceResultInterface {
  jobId: string;
  trackedProductId: string;
  status: string;
  /** Present when a fetch attempt read the product card. */
  observation: Omit<PriceObservationInterface, 'id' | 'trackedProductId' | 'jobId'> | null;
}

export class RecordPriceResultUseCase {
  constructor(
    private readonly products: TrackedProductRepositoryPort,
    private readonly observations: PriceObservationRepositoryPort,
    private readonly logger: LoggerPort = silentLogger,
  ) {}

  async execute(result: PriceResultInterface): Promise<void> {
    // The product may have been deleted while the job was running.
    if ((await this.products.findById(result.trackedProductId)) === null) {
      this.logger.warn(`Ignoring a result of the unknown product ${result.trackedProductId}`);

      return;
    }

    if (result.observation !== null) {
      await this.observations.saveIfAbsent({
        ...result.observation,
        id: randomUUID(),
        trackedProductId: result.trackedProductId,
        jobId: result.jobId,
      });
    }

    await this.products.markChecked(result.trackedProductId, result.status, new Date());
    this.logger.info(
      `Product ${result.trackedProductId}: ${result.status}${result.observation === null ? ', no price recorded' : `, ${String(result.observation.prices.length)} prices recorded`} (job ${result.jobId})`,
    );
  }
}
