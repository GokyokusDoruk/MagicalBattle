import type { PrismaClient } from '../generated/prisma/client.js';
import { DuplicateError, type NewUser, type UserRecord, type UserRepository } from './repository.js';

function isUniqueViolation(err: unknown): err is { code: string; meta?: { target?: unknown } } {
  return typeof err === 'object' && err !== null && (err as { code?: string }).code === 'P2002';
}

export class PrismaUserRepository implements UserRepository {
  constructor(private readonly prisma: PrismaClient) {}

  async create(user: NewUser): Promise<UserRecord> {
    try {
      return await this.prisma.user.create({ data: user });
    } catch (err) {
      if (isUniqueViolation(err)) {
        // Hangi alanın çakıştığını hata bilgisinden, bulunamazsa tekrar sorgulayarak bul
        const target = JSON.stringify(err.meta ?? {}).toLowerCase();
        if (target.includes('email')) throw new DuplicateError('email');
        if (target.includes('usernamekey') || target.includes('username')) throw new DuplicateError('username');
        const byName = await this.findByUsernameKey(user.usernameKey);
        throw new DuplicateError(byName ? 'username' : 'email');
      }
      throw err;
    }
  }

  findByUsernameKey(key: string): Promise<UserRecord | null> {
    return this.prisma.user.findUnique({ where: { usernameKey: key } });
  }

  findById(id: string): Promise<UserRecord | null> {
    return this.prisma.user.findUnique({ where: { id } });
  }
}
