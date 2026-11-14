import { emptyWallet, sanitizeWallet } from '../economy/currency';
import type { EconomySnapshot } from '../economy/player';
import type { QuestSnapshot } from '../quests/engine';
import type { Side } from '../morality/catalog';
import type { WandSnapshot } from '../wands/inventory';
import { CITY_HALF, type LocationDef } from '../world/locations';

/**
 * Kayıt dosyası biçimi (sürüm 8: dört para birimi (cüzdan); sürüm 6: asalar seviyeli ve tek kuşanılı; sürüm 5: ahlak seçimleri; sürüm 4: asa envanteri; sürüm 3: yetenek ağacı; sürüm 2: ekonomi, görevler, toplananlar). Sunucu da
 * aynı alanları doğrular ve eski (v1-v5) kayıtları yükseltir (server/src/save/saveData.ts).
 */
export const SAVE_VERSION = 8;

export interface SavePoint {
  cityId: string;
  tileX: number;
  tileY: number;
}

export interface SaveData extends EconomySnapshot, WandSnapshot {
  version: typeof SAVE_VERSION;
  playerName: string;
  /** 1'den başlayıp aralıksız tamamlanan bölümler */
  completedChapters: number[];
  /** Devam edilecek yer; henüz hiçbir şehre girilmediyse null */
  savePoint: SavePoint | null;
  quests: QuestSnapshot;
  /** Toplanmış, bir daha çıkmayacak dünya eşyalarının kimlikleri */
  collected: string[];
  /** Yapılan ahlak seçimleri (puan bunlardan hesaplanır) */
  choices: Record<string, Side>;
  /** Alınan yetenekler (yetenek ağacı kimlikleri) */
  skills: string[];
}

/** Ekonomi, görevler ve toplananlar: bölüm ilerlemesi ve konumdan ayrı, oyun durumundan okunan kısım. */
export interface SaveExtras {
  economy: EconomySnapshot;
  quests: QuestSnapshot;
  collected: readonly string[];
  skills: readonly string[];
  wands: WandSnapshot;
  choices: Readonly<Record<string, Side>>;
}

const EMPTY_EXTRAS: SaveExtras = { economy: { wallet: emptyWallet(), xp: 0, items: {}, equipped: {} }, quests: {}, collected: [], skills: [], wands: { wands: {}, wandEquipped: null }, choices: {} };

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
  extras: SaveExtras = EMPTY_EXTRAS,
): SaveData {
  return {
    version: SAVE_VERSION,
    playerName: playerName.trim(),
    completedChapters: [...completedChapters],
    savePoint,
    wallet: { ...extras.economy.wallet },
    xp: extras.economy.xp,
    hp: extras.economy.hp ?? null,
    items: { ...extras.economy.items },
    equipped: { ...extras.economy.equipped },
    quests: Object.fromEntries(Object.entries(extras.quests).map(([id, r]) => [id, { ...r }])),
    collected: [...extras.collected],
    skills: [...extras.skills],
    wands: { ...extras.wands.wands },
    wandEquipped: extras.wands.wandEquipped,
    choices: { ...extras.choices },
  };
}

/**
 * Sunucudan gelen kaydı güvenle kullanılabilir hale getirir: eksik alanları varsayılanla doldurur
 * (eski bir sunucu v1 döndürse bile oyun çökmez).
 */
export function normalizeSave(raw: Partial<SaveData> & Pick<SaveData, 'playerName' | 'completedChapters'>): SaveData {
  return {
    version: SAVE_VERSION,
    playerName: raw.playerName,
    completedChapters: raw.completedChapters,
    savePoint: raw.savePoint ?? null,
    // Eski kayıtlarda (sürüm 7 ve öncesi) tek altın vardı: Kor'a çevrilir
    wallet: raw.wallet ? sanitizeWallet(raw.wallet) : sanitizeWallet({ kor: (raw as { gold?: number }).gold }),
    xp: raw.xp ?? 0,
    hp: raw.hp ?? null,
    items: raw.items ?? {},
    equipped: raw.equipped ?? {},
    quests: raw.quests ?? {},
    collected: raw.collected ?? [],
    skills: raw.skills ?? [],
    wands: raw.wands ?? {},
    wandEquipped: raw.wandEquipped ?? null,
    choices: raw.choices ?? {},
  };
}
