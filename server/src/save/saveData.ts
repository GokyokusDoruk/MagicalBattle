/**
 * Kayıt dosyası biçimi (sürüm 1). İstemci ile aynı alanları kullanır
 * (client/src/save/saveData.ts); sunucu burada doğrular, istemciye güvenmez.
 */

export const SAVE_VERSION = 1;
export const LAST_CHAPTER = 8;
/** Kayıt noktası olabilecek şehirler (client/src/world/locations.ts ile aynı kimlikler) */
export const SAVE_CITY_IDS = ['ignis', 'abyss', 'stone-heart', 'still-crystal'] as const;

export interface SavePoint {
  cityId: string;
  tileX: number;
  tileY: number;
}

export interface SaveData {
  version: typeof SAVE_VERSION;
  playerName: string;
  /** 1'den başlayıp aralıksız tamamlanan bölümler: [], [1], [1,2], ... */
  completedChapters: number[];
  /** Oyuna devam edilecek yer; yeni oyunda henüz kayıt noktası yoksa null */
  savePoint: SavePoint | null;
}

const NAME_PATTERN = /^[\p{L}\p{N} _.-]{2,20}$/u;
const MAX_TILE = 500;

export function validatePlayerName(value: unknown): string | null {
  if (typeof value !== 'string' || !NAME_PATTERN.test(value.trim()) || value.trim().length < 2) {
    return 'Oyuncu adı 2-20 karakter olmalı; harf, rakam, boşluk, _ . - kullanılabilir.';
  }
  return null;
}

const isTile = (n: unknown): n is number => typeof n === 'number' && Number.isInteger(n) && n >= 0 && n <= MAX_TILE;

/** Geçerliyse temizlenmiş kaydı, değilse Türkçe hata mesajını döndürür. */
export function parseSave(input: unknown): { ok: true; save: SaveData } | { ok: false; error: string } {
  const bad = (error: string) => ({ ok: false as const, error });
  if (typeof input !== 'object' || input === null) return bad('Kayıt verisi geçersiz.');
  const b = input as Record<string, unknown>;

  if (b.version !== SAVE_VERSION) return bad('Desteklenmeyen kayıt sürümü.');

  const nameError = validatePlayerName(b.playerName);
  if (nameError) return bad(nameError);

  if (!Array.isArray(b.completedChapters) || b.completedChapters.length > LAST_CHAPTER) {
    return bad('Tamamlanan bölümler geçersiz.');
  }
  const chapters = b.completedChapters as unknown[];
  // Bölümler sırayla tamamlanır: [1..n]
  if (!chapters.every((c, i) => c === i + 1)) return bad('Tamamlanan bölümler sıralı olmalı.');

  let savePoint: SavePoint | null = null;
  if (b.savePoint !== null && b.savePoint !== undefined) {
    const sp = b.savePoint as Record<string, unknown>;
    if (
      typeof sp !== 'object' ||
      typeof sp.cityId !== 'string' ||
      !(SAVE_CITY_IDS as readonly string[]).includes(sp.cityId) ||
      !isTile(sp.tileX) ||
      !isTile(sp.tileY)
    ) {
      return bad('Kayıt noktası geçersiz.');
    }
    savePoint = { cityId: sp.cityId, tileX: sp.tileX, tileY: sp.tileY };
  }

  return {
    ok: true,
    save: {
      version: SAVE_VERSION,
      playerName: (b.playerName as string).trim(),
      completedChapters: chapters as number[],
      savePoint,
    },
  };
}
