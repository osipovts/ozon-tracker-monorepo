import { type ClockPort, systemClock } from '../../shared/application/clock.port.js';
import type { UserRepositoryPort } from './user-repository.port.js';

export interface UserStatsInterface {
  total: number;
  /** The users whose email is proven to be theirs. */
  verified: number;
  joinedLastDay: number;
}

export class GetUserStatsUseCase {
  constructor(
    private readonly users: UserRepositoryPort,
    private readonly clock: ClockPort = systemClock,
  ) {}

  async execute(): Promise<UserStatsInterface> {
    const day = 24 * 60 * 60_000;
    const { total, verified, joined } = await this.users.stats(
      new Date(this.clock.now().getTime() - day),
    );

    return { total, verified, joinedLastDay: joined };
  }
}
