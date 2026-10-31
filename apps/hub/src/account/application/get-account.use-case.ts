import type { UserInterface } from '../domain/user.entity.js';
import type { UserRepositoryPort } from './user-repository.port.js';

export class GetAccountUseCase {
  constructor(private readonly users: UserRepositoryPort) {}

  async execute(userId: string): Promise<UserInterface | null> {
    const user = await this.users.findById(userId);

    return user?.snapshot ?? null;
  }
}
