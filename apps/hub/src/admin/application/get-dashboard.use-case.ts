import type { GetUserStatsUseCase, UserStatsInterface } from '../../account/application/index.js';
import type {
  BrowserSessionStatsInterface,
  GetSessionStatsUseCase,
} from '../../browser-session/application/index.js';
import type { GetJobStatsUseCase, JobStatsInterface } from '../../job/application/index.js';
import type {
  GetProductStatsUseCase,
  ProductStatsInterface,
} from '../../product/application/index.js';
import type { GetProxyStatsUseCase, ProxyStatsInterface } from '../../proxy/application/index.js';
import { type ClockPort, systemClock } from '../../shared/application/clock.port.js';

export interface DashboardInterface {
  generatedAt: Date;
  users: UserStatsInterface;
  products: ProductStatsInterface;
  proxies: ProxyStatsInterface;
  sessions: BrowserSessionStatsInterface;
  jobs: JobStatsInterface;
}

/** What an administrator sees first: the figures every context keeps about its own business, on one page. */
export class GetDashboardUseCase {
  constructor(
    private readonly users: Pick<GetUserStatsUseCase, 'execute'>,
    private readonly products: Pick<GetProductStatsUseCase, 'execute'>,
    private readonly proxies: Pick<GetProxyStatsUseCase, 'execute'>,
    private readonly sessions: Pick<GetSessionStatsUseCase, 'execute'>,
    private readonly jobs: Pick<GetJobStatsUseCase, 'execute'>,
    private readonly clock: ClockPort = systemClock,
  ) {}

  async execute(): Promise<DashboardInterface> {
    const [users, products, proxies, sessions, jobs] = await Promise.all([
      this.users.execute(),
      this.products.execute(),
      this.proxies.execute(),
      this.sessions.execute(),
      this.jobs.execute(),
    ]);

    return { generatedAt: this.clock.now(), users, products, proxies, sessions, jobs };
  }
}
