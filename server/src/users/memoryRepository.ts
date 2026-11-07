import { randomUUID } from 'node:crypto';
import { DuplicateError, type NewUser, type UserRecord, type UserRepository } from './repository.js';

/** Testler için bellekte çalışan depo. Üretimde PrismaUserRepository kullanılır. */
export class MemoryUserRepository implements UserRepository {
  private readonly users = new Map<string, UserRecord>();

  async create(user: NewUser): Promise<UserRecord> {
    for (const existing of this.users.values()) {
      if (existing.usernameKey === user.usernameKey) throw new DuplicateError('username');
      if (user.email !== null && existing.email === user.email) throw new DuplicateError('email');
    }
    const record: UserRecord = { ...user, id: randomUUID(), createdAt: new Date() };
    this.users.set(record.id, record);
    return record;
  }

  async findByUsernameKey(key: string): Promise<UserRecord | null> {
    for (const u of this.users.values()) if (u.usernameKey === key) return u;
    return null;
  }

  async findById(id: string): Promise<UserRecord | null> {
    return this.users.get(id) ?? null;
  }
}
