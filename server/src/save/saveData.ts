/**
 * Kayıt dosyası biçimi (sürüm 4). İstemci ile aynı alanları kullanır (client/src/save/saveData.ts);
 * sunucu burada doğrular, istemciye güvenmez. Sürüm 1 (ekonomi yok), sürüm 2 (yetenek yok) ve sürüm 3 (asa yok) kayıtlar
 * kabul edilir ve varsayılanlarla yükseltilir.
 */

export const SAVE_VERSION = 4;
/** Yetenek ağacındaki toplam yetenek sayısı (4 element x 3 dal x 3 kademe) */
const MAX_SKILLS = 36;
/** Asa kataloğunda 48 asa var; kuşanma yuvaları element-rol çiftleridir */
const MAX_WANDS = 48;
const MAX_WAND_STACK = 999;
const WAND_SLOTS = ['fire', 'water', 'earth', 'air'].flatMap((e) => ['attack', 'defense'].map((r) => `${e}-${r}`));
export const LAST_CHAPTER = 8;
/** Kayıt noktası olabilecek şehirler (client/src/world/locations.ts ile aynı kimlikler) */
export const SAVE_CITY_IDS = ['ignis', 'abyss', 'stone-heart', 'still-crystal'] as const;

export const MAX_GOLD = 9_999_999;
export const MAX_XP = 1_000_000;
export const MAX_STACK = 999;
const MAX_ENTRIES = 64;
const MAX_COLLECTED = 200;
const ID_PATTERN = /^[a-z0-9-]{1,40}$/;
const GEAR_SLOTS = ['robe', 'hat', 'amulet'] as const;

export interface SavePoint {
  cityId: string;
  tileX: number;
  tileY: number;
}

export interface QuestRecord {
  status: 'active' | 'completed';
  progress: number;
}

export interface SaveData {
  version: typeof SAVE_VERSION;
  playerName: string;
  /** 1'den başlayıp aralıksız tamamlanan bölümler: [], [1], [1,2], ... */
  completedChapters: number[];
  /** Oyuna devam edilecek yer; yeni oyunda henüz kayıt noktası yoksa null */
  savePoint: SavePoint | null;
  gold: number;
  xp: number;
  /** Çanta: eşya kimliği → adet */
  items: Record<string, number>;
  /** Kuşanılan ekipman: yer → eşya kimliği */
  equipped: Partial<Record<(typeof GEAR_SLOTS)[number], string>>;
  /** Yan görevler: görev kimliği → durum */
  quests: Record<string, QuestRecord>;
  /** Toplanmış, bir daha çıkmayacak dünya eşyalarının kimlikleri */
  collected: string[];
  /** Alınan yetenekler (yetenek ağacı kimlikleri) */
  skills: string[];
  /** Asa envanteri: asa kimliği → adet */
  wands: Record<string, number>;
  /** Kuşanılan asalar: yuva ("fire-attack") → asa kimliği */
  wandsEquipped: Record<string, string>;
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
const isInt = (n: unknown, min: number, max: number): n is number => typeof n === 'number' && Number.isInteger(n) && n >= min && n <= max;
const isId = (s: unknown): s is string => typeof s === 'string' && ID_PATTERN.test(s);
const isPlainObject = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null && !Array.isArray(v);

type Parsed<T> = { ok: true; value: T } | { ok: false; error: string };

function parseItems(input: unknown): Parsed<Record<string, number>> {
  if (input === undefined) return { ok: true, value: {} };
  if (!isPlainObject(input) || Object.keys(input).length > MAX_ENTRIES) return { ok: false, error: 'Çanta geçersiz.' };
  const out: Record<string, number> = {};
  for (const [id, count] of Object.entries(input)) {
    if (!isId(id) || !isInt(count, 1, MAX_STACK)) return { ok: false, error: 'Çanta geçersiz.' };
    out[id] = count;
  }
  return { ok: true, value: out };
}

function parseEquipped(input: unknown): Parsed<SaveData['equipped']> {
  if (input === undefined) return { ok: true, value: {} };
  if (!isPlainObject(input)) return { ok: false, error: 'Ekipman geçersiz.' };
  const out: SaveData['equipped'] = {};
  for (const [slot, id] of Object.entries(input)) {
    if (!(GEAR_SLOTS as readonly string[]).includes(slot) || !isId(id)) return { ok: false, error: 'Ekipman geçersiz.' };
    out[slot as (typeof GEAR_SLOTS)[number]] = id;
  }
  return { ok: true, value: out };
}

function parseQuests(input: unknown): Parsed<Record<string, QuestRecord>> {
  if (input === undefined) return { ok: true, value: {} };
  if (!isPlainObject(input) || Object.keys(input).length > MAX_ENTRIES) return { ok: false, error: 'Görevler geçersiz.' };
  const out: Record<string, QuestRecord> = {};
  for (const [id, rec] of Object.entries(input)) {
    if (!isId(id) || !isPlainObject(rec)) return { ok: false, error: 'Görevler geçersiz.' };
    if ((rec.status !== 'active' && rec.status !== 'completed') || !isInt(rec.progress, 0, 9999)) return { ok: false, error: 'Görevler geçersiz.' };
    out[id] = { status: rec.status, progress: rec.progress };
  }
  return { ok: true, value: out };
}

function parseCollected(input: unknown): Parsed<string[]> {
  if (input === undefined) return { ok: true, value: [] };
  if (!Array.isArray(input) || input.length > MAX_COLLECTED || !input.every(isId)) return { ok: false, error: 'Toplanan eşyalar geçersiz.' };
  return { ok: true, value: [...new Set(input as string[])] };
}

function parseSkills(input: unknown): Parsed<string[]> {
  if (input === undefined) return { ok: true, value: [] };
  if (!Array.isArray(input) || input.length > MAX_SKILLS || !input.every(isId)) return { ok: false, error: 'Yetenekler geçersiz.' };
  return { ok: true, value: [...new Set(input as string[])] };
}

function parseWands(input: unknown): Parsed<Record<string, number>> {
  if (input === undefined) return { ok: true, value: {} };
  if (!isPlainObject(input) || Object.keys(input).length > MAX_WANDS) return { ok: false, error: 'Asalar geçersiz.' };
  const out: Record<string, number> = {};
  for (const [id, count] of Object.entries(input)) {
    if (!isId(id) || !isInt(count, 1, MAX_WAND_STACK)) return { ok: false, error: 'Asalar geçersiz.' };
    out[id] = count;
  }
  return { ok: true, value: out };
}

function parseWandsEquipped(input: unknown): Parsed<Record<string, string>> {
  if (input === undefined) return { ok: true, value: {} };
  if (!isPlainObject(input)) return { ok: false, error: 'Kuşanılan asalar geçersiz.' };
  const out: Record<string, string> = {};
  for (const [slot, id] of Object.entries(input)) {
    if (!WAND_SLOTS.includes(slot) || !isId(id)) return { ok: false, error: 'Kuşanılan asalar geçersiz.' };
    out[slot] = id;
  }
  return { ok: true, value: out };
}

/** Geçerliyse temizlenmiş (ve v4'e yükseltilmiş) kaydı, değilse Türkçe hata mesajını döndürür. */
export function parseSave(input: unknown): { ok: true; save: SaveData } | { ok: false; error: string } {
  const bad = (error: string) => ({ ok: false as const, error });
  if (!isPlainObject(input)) return bad('Kayıt verisi geçersiz.');
  const b = input;

  if (b.version !== 1 && b.version !== 2 && b.version !== 3 && b.version !== SAVE_VERSION) return bad('Desteklenmeyen kayıt sürümü.');

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

  // Ekonomi alanları: v1'de yoktur (varsayılan), v2'de verilenler doğrulanır
  const gold = b.gold ?? 0;
  const xp = b.xp ?? 0;
  if (!isInt(gold, 0, MAX_GOLD) || !isInt(xp, 0, MAX_XP)) return bad('Altın ya da XP geçersiz.');
  const items = parseItems(b.items);
  if (!items.ok) return bad(items.error);
  const equipped = parseEquipped(b.equipped);
  if (!equipped.ok) return bad(equipped.error);
  const quests = parseQuests(b.quests);
  if (!quests.ok) return bad(quests.error);
  const collected = parseCollected(b.collected);
  if (!collected.ok) return bad(collected.error);
  const skills = parseSkills(b.skills);
  if (!skills.ok) return bad(skills.error);
  const wands = parseWands(b.wands);
  if (!wands.ok) return bad(wands.error);
  const wandsEquipped = parseWandsEquipped(b.wandsEquipped);
  if (!wandsEquipped.ok) return bad(wandsEquipped.error);

  return {
    ok: true,
    save: {
      version: SAVE_VERSION,
      playerName: (b.playerName as string).trim(),
      completedChapters: chapters as number[],
      savePoint,
      gold,
      xp,
      items: items.value,
      equipped: equipped.value,
      quests: quests.value,
      collected: collected.value,
      skills: skills.value,
      wands: wands.value,
      wandsEquipped: wandsEquipped.value,
    },
  };
}
