import type { UserRepositoryPort } from '../application/user-repository.port.js';
import type { UserEntity } from '../domain/user.entity.js';

export class InMemoryUserRepositoryAdapter implements UserRepositoryPort {
  private readonly users = new Map<string, UserEntity>();

  add(user: UserEntity): Promise<boolean> {
    const taken = Array.from(this.users.values()).some(
      ({ snapshot }): boolean => snapshot.email === user.snapshot.email,
    );
    if (!taken) this.users.set(user.snapshot.id, user);

    return Promise.resolve(!taken);
  }

  markEmailVerified(userId: string, at: Date): Promise<void> {
    const user = this.users.get(userId);
    if (user !== undefined) this.users.set(userId, user.verified(at));

    return Promise.resolve();
  }

  findById(id: string): Promise<UserEntity | null> {
    return Promise.resolve(this.users.get(id) ?? null);
  }

  findByEmail(email: string): Promise<UserEntity | null> {
    const user = Array.from(this.users.values()).find(
      ({ snapshot }): boolean => snapshot.email === email,
    );

    return Promise.resolve(user ?? null);
  }
}
