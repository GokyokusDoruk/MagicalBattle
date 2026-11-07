import { CITY_HALF, type LocationDef } from '../world/locations';

/**
 * Kayıt dosyası biçimi (sürüm 1). Sunucu da aynı alanları doğrular (server/src/save/saveData.ts).
 */
export const SAVE_VERSION = 1;

export interface SavePoint {
  cityId: string;
  tileX: number;
  tileY: number;
}

export interface SaveData {
  version: typeof SAVE_VERSION;
  playerName: string;
  /** 1'den başlayıp aralıksız tamamlanan bölümler */
  completedChapters: number[];
  /** Devam edilecek yer; henüz hiçbir şehre girilmediyse null */
  savePoint: SavePoint | null;
}

const NAME_PATTERN = /^[\p{L}\p{N} _.-]{2,20}$/u;

/** Oyuncu adı geçerliyse null, değilse Türkçe hata mesajı. */
export function validatePlayerName(value: string): string | null {
  const name = value.trim();
  if (name.length < 2 || !NAME_PATTERN.test(name)) {
    return 'Ad 2-20 karakter olmalı; harf, rakam, boşluk, _ . - kullanılabilir.';
  }
  return null;
}

/** Şehirde oyuncunun doğacağı nokta: kapının iki karo içi. */
export function savePointForCity(city: LocationDef): SavePoint {
  return { cityId: city.id, tileX: city.x, tileY: city.y + CITY_HALF - 2 };
}

export function buildSave(
  playerName: string,
  completedChapters: number[],
  savePoint: SavePoint | null,
): SaveData {
  return { version: SAVE_VERSION, playerName: playerName.trim(), completedChapters: [...completedChapters], savePoint };
}
