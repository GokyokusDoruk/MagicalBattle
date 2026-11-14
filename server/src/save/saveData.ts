/**
 * Kayıt dosyası biçimi (sürüm 6). İstemci ile aynı alanları kullanır (client/src/save/saveData.ts);
 * sunucu burada doğrular, istemciye güvenmez. Sürüm 1 (ekonomi yok), sürüm 2 (yetenek yok) sürüm 3 (asa yok), sürüm 4 (ahlak seçimi yok) ve sürüm 5 (asalar seviyesiz, 8 yuvalı) kayıtlar
 * kabul edilir ve varsayılanlarla yükseltilir.
 */

export const SAVE_VERSION = 8;
/** Yetenek ağacındaki toplam yetenek sayısı (4 element x 3 dal x 3 kademe + 3 Taşıyıcı) */
const MAX_SKILLS = 39;
/** Asalar element, rol, nadirlik ve seviye taşır (4x2x6x30 = 1440 çeşit); çantaya sığanlar sınırlıdır, 200 çeşit yeter */
const MAX_WANDS = 200;
/** Hikâyede 16 ahlak seçimi var */
const MAX_CHOICES = 16;
const MAX_WAND_STACK = 999;
/** `wand-fire-attack-3-12`; eski kayıtlardaki seviyesiz biçim (`wand-fire-attack-3`) seviye 1 sayılır */
const WAND_ID = /^wand-(fire|water|earth|air)-(attack|defense)-([1-6])(?:-(\d{1,2}))?$/;
const MAX_WAND_LEVEL = 30;

/** Asa kimliğini yeni biçime çevirir; geçersizse null. */
export function normalizeWandId(id: string): string | null {
  const m = WAND_ID.exec(id);
  if (!m) return null;
  const level = m[4] === undefined ? 1 : Number(m[4]);
  if (level < 1 || level > MAX_WAND_LEVEL) return null;
  return `wand-${m[1]}-${m[2]}-${m[3]}-${level}`;
}
export const LAST_CHAPTER = 8;
/** Kayıt noktası olabilecek şehirler (client/src/world/locations.ts ile aynı kimlikler) */
export const SAVE_CITY_IDS = ['ignis', 'abyss', 'stone-heart', 'still-crystal'] as const;

/** Her para biriminin (Kor, Çiy, Tunç, Tüy) kaydedilebilecek en yüksek bakiyesi */
export const MAX_MONEY = 9_999_999;
export const CURRENCY_KEYS = ['kor', 'ciy', 'tunc', 'tuy'] as const;
export type Wallet = Record<(typeof CURRENCY_KEYS)[number], number>;
export const MAX_XP = 1_000_000;
/** Kaydedilebilecek en yüksek mevcut can (azami can seviyeyle artar, bunun çok altındadır) */
export const MAX_HP_SAVED = 100_000;
export const MAX_STACK = 999;
const MAX_ENTRIES = 64;
const MAX_COLLECTED = 200;
const ID_PATTERN = /^[a-z0-9-]{1,40}$/;
/** Ekipman yuvaları (Task 23). `amulet` eski kayıtlarda vardı; istemci yüklerken yüzüğe çevirir. */
const GEAR_SLOTS = ['robe', 'hat', 'pants', 'bag', 'ring', 'boots', 'amulet'] as const;

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
  /** Dört para biriminin bakiyesi (sürüm 8; eski kayıtlardaki altın Kor olur) */
  wallet: Wallet;
  xp: number;
  /** Mevcut can; null = tam dolu */
  hp: number | null;
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
  /** Kuşanılı tek asa (kimliği); yoksa null */
  wandEquipped: string | null;
  /** Yapılan ahlak seçimleri: seçim kimliği → 'good' (iyi) ya da 'bad' (kötü). Puan bunlardan hesaplanır. */
  choices: Record<string, 'good' | 'bad'>;
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
  for (const [rawId, count] of Object.entries(input)) {
    const id = normalizeWandId(rawId);
    if (!id || !isInt(count, 1, MAX_WAND_STACK)) return { ok: false, error: 'Asalar geçersiz.' };
    out[id] = Math.min(MAX_WAND_STACK, (out[id] ?? 0) + count); // eski ve yeni biçim aynı asaya çıkarsa toplanır
  }
  return { ok: true, value: out };
}

/**
 * Kuşanılı asa: v6'da tek kimlik ya da null. Eski kayıtlarda (v5 ve öncesi) `wandsEquipped` (yuva → asa) vardı;
 * en yüksek nadirlikteki sahip olunan asa seçilir.
 */
function parseWandEquipped(b: Record<string, unknown>, wands: Record<string, number>): Parsed<string | null> {
  const bad = { ok: false as const, error: 'Kuşanılan asa geçersiz.' };
  if (b.wandEquipped !== undefined && b.wandEquipped !== null) {
    if (typeof b.wandEquipped !== 'string') return bad;
    const id = normalizeWandId(b.wandEquipped);
    if (!id) return bad;
    return { ok: true, value: id in wands ? id : null };
  }
  if (b.wandEquipped === undefined && b.wandsEquipped !== undefined) {
    if (!isPlainObject(b.wandsEquipped)) return bad;
    let best: string | null = null;
    let bestRarity = 0;
    for (const raw of Object.values(b.wandsEquipped)) {
      const id = typeof raw === 'string' ? normalizeWandId(raw) : null;
      if (!id) return bad;
      const rarity = Number(id.split('-')[3]);
      if (id in wands && rarity > bestRarity) {
        best = id;
        bestRarity = rarity;
      }
    }
    return { ok: true, value: best };
  }
  return { ok: true, value: null };
}

function parseChoices(input: unknown): Parsed<Record<string, 'good' | 'bad'>> {
  if (input === undefined) return { ok: true, value: {} };
  if (!isPlainObject(input) || Object.keys(input).length > MAX_CHOICES) return { ok: false, error: 'Ahlak seçimleri geçersiz.' };
  const out: Record<string, 'good' | 'bad'> = {};
  for (const [id, side] of Object.entries(input)) {
    if (!isId(id) || (side !== 'good' && side !== 'bad')) return { ok: false, error: 'Ahlak seçimleri geçersiz.' };
    out[id] = side;
  }
  return { ok: true, value: out };
}

/** Cüzdan: sürüm 8'de dört birimli nesne; eski sürümlerde tek `gold` alanı Kor'a çevrilir. */
function parseWallet(b: Record<string, unknown>): { ok: true; value: Wallet } | { ok: false; error: string } {
  const bad = { ok: false as const, error: 'Para bakiyesi geçersiz.' };
  const wallet: Wallet = { kor: 0, ciy: 0, tunc: 0, tuy: 0 };
  if (b.version === SAVE_VERSION) {
    const raw = b.wallet ?? {};
    if (!isPlainObject(raw)) return bad;
    for (const key of Object.keys(raw)) if (!(CURRENCY_KEYS as readonly string[]).includes(key)) return bad;
    for (const key of CURRENCY_KEYS) {
      const v = (raw as Record<string, unknown>)[key] ?? 0;
      if (!isInt(v, 0, MAX_MONEY)) return bad;
      wallet[key] = v;
    }
    return { ok: true, value: wallet };
  }
  const gold = b.gold ?? 0;
  if (!isInt(gold, 0, MAX_MONEY)) return bad;
  wallet.kor = gold;
  return { ok: true, value: wallet };
}

/** Geçerliyse temizlenmiş (ve v5'e yükseltilmiş) kaydı, değilse Türkçe hata mesajını döndürür. */
export function parseSave(input: unknown): { ok: true; save: SaveData } | { ok: false; error: string } {
  const bad = (error: string) => ({ ok: false as const, error });
  if (!isPlainObject(input)) return bad('Kayıt verisi geçersiz.');
  const b = input;

  if (b.version !== 1 && b.version !== 2 && b.version !== 3 && b.version !== 4 && b.version !== 5 && b.version !== 6 && b.version !== 7 && b.version !== SAVE_VERSION) return bad('Desteklenmeyen kayıt sürümü.');

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
  const xp = b.xp ?? 0;
  if (!isInt(xp, 0, MAX_XP)) return bad('XP geçersiz.');
  const wallet = parseWallet(b);
  if (!wallet.ok) return bad(wallet.error);
  const hp = b.hp ?? null;
  if (hp !== null && !isInt(hp, 1, MAX_HP_SAVED)) return bad('Can geçersiz.');
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
  const wandEquipped = parseWandEquipped(b, wands.value);
  if (!wandEquipped.ok) return bad(wandEquipped.error);
  const choices = parseChoices(b.choices);
  if (!choices.ok) return bad(choices.error);

  return {
    ok: true,
    save: {
      version: SAVE_VERSION,
      playerName: (b.playerName as string).trim(),
      completedChapters: chapters as number[],
      savePoint,
      wallet: wallet.value,
      xp,
      hp,
      items: items.value,
      equipped: equipped.value,
      quests: quests.value,
      collected: collected.value,
      skills: skills.value,
      wands: wands.value,
      wandEquipped: wandEquipped.value,
      choices: choices.value,
    },
  };
}
