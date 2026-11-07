import type { SaveData } from './saveData.js';

export interface SaveRepository {
  /** Hesabın kaydını döndürür; yoksa null. */
  get(userId: string): Promise<SaveData | null>;
  /** Kaydı oluşturur ya da üzerine yazar. */
  put(userId: string, data: SaveData): Promise<void>;
}

/** Testler için bellekte çalışan depo. */
export class MemorySaveRepository implements SaveRepository {
  private readonly saves = new Map<string, SaveData>();

  async get(userId: string): Promise<SaveData | null> {
    const s = this.saves.get(userId);
    return s ? structuredClone(s) : null;
  }

  async put(userId: string, data: SaveData): Promise<void> {
    this.saves.set(userId, structuredClone(data));
  }
}
