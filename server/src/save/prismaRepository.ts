import type { PrismaClient } from '../generated/prisma/client.js';
import type { SaveRepository } from './repository.js';
import { parseSave, type SaveData } from './saveData.js';

export class PrismaSaveRepository implements SaveRepository {
  constructor(private readonly prisma: PrismaClient) {}

  async get(userId: string): Promise<SaveData | null> {
    const row = await this.prisma.saveGame.findUnique({ where: { userId } });
    if (!row) return null;
    // Veritabanındaki içerik de doğrulanır; bozuksa yokmuş gibi davranılır (oyuncu yeni başlar)
    const parsed = parseSave(row.data);
    return parsed.ok ? parsed.save : null;
  }

  async put(userId: string, data: SaveData): Promise<void> {
    const json = JSON.parse(JSON.stringify(data));
    await this.prisma.saveGame.upsert({
      where: { userId },
      create: { userId, data: json },
      update: { data: json },
    });
  }
}
