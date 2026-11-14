import type { FastifyInstance } from 'fastify';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { buildApp } from '../app.js';
import { loadConfig } from '../config.js';
import { MemorySaveRepository } from '../save/repository.js';
import { parseSave } from '../save/saveData.js';
import { MemoryUserRepository } from '../users/memoryRepository.js';
import { SESSION_COOKIE } from './auth.js';

const ORIGIN = 'http://localhost:5173';
let app: FastifyInstance;

beforeEach(async () => {
  app = await buildApp({
    config: { ...loadConfig({}), authRateLimit: 1000, corsOrigins: [ORIGIN] },
    users: new MemoryUserRepository(),
    saves: new MemorySaveRepository(),
  });
});
afterEach(() => app.close());

async function guestCookie(username: string): Promise<string> {
  const res = await app.inject({ method: 'POST', url: '/auth/guest', payload: { username, password: 'misafir-sifre' } });
  const c = res.cookies.find((x) => x.name === SESSION_COOKIE)!;
  return `${SESSION_COOKIE}=${c.value}`;
}

/** Eski (v1) biçim: ekonomi alanları yok */
const SAVE = {
  version: 1,
  playerName: 'Aylin',
  completedChapters: [1],
  savePoint: { cityId: 'ignis', tileX: 64, tileY: 62 },
};

/** v1 kaydın v6'ya yükseltilmiş hali: yeni alanlar varsayılan */
/** v1 kaydın yükseltilmiş hali: yeni alanlar varsayılan ve kayıt noktası yeni haritaya (+20 karo) kaydırılmış */
const UPGRADED = { ...SAVE, version: 9, savePoint: { cityId: 'ignis', tileX: 84, tileY: 82 }, wallet: { kor: 0, ciy: 0, tunc: 0, tuy: 0 }, xp: 0, hp: null, items: {}, equipped: {}, quests: {}, collected: [], skills: [], wands: {}, wandEquipped: null, choices: {} };

/** Güncel (v6) biçim: ekonomi, görevler, toplananlar, yetenekler, asalar ve ahlak seçimleri dolu */
const SAVE_V2 = {
  ...UPGRADED,
  wallet: { kor: 250, ciy: 40, tunc: 0, tuy: 7 },
  xp: 320,
  items: { 'sifali-ot': 4, 'bekci-cuppesi': 1, 'kucuk-canta': 1 },
  equipped: { robe: 'bekci-cuppesi', bag: 'kucuk-canta' },
  quests: { 'ash-ot-toplama': { status: 'completed', progress: 5 }, 'vine-kristal-avi': { status: 'active', progress: 1 } },
  collected: ['p-herb-0', 'p-herb-3'],
  skills: ['fire-power-1', 'fire-power-2', 'water-ward-1'],
  wands: { 'wand-fire-attack-3-12': 2, 'wand-air-defense-1-4': 7 },
  wandEquipped: 'wand-fire-attack-3-12',
  choices: { 'c1-isciler': 'good', 'c2-kervanci': 'bad' },
};

const put = (cookie: string | undefined, payload: unknown) =>
  app.inject({ method: 'PUT', url: '/save', payload: payload as object, headers: cookie ? { cookie } : {} });
const get = (cookie?: string) => app.inject({ method: 'GET', url: '/save', headers: cookie ? { cookie } : {} });

describe('/save', () => {
  it('oturum yoksa 401', async () => {
    expect((await get()).statusCode).toBe(401);
    expect((await put(undefined, SAVE)).statusCode).toBe(401);
  });

  it('yeni hesapta kayıt yok: { save: null }', async () => {
    const res = await get(await guestCookie('yeni1'));
    expect(res.statusCode).toBe(200);
    expect(res.json()).toEqual({ save: null });
  });

  it('kaydeder ve aynen geri verir (misafir hesabı da)', async () => {
    const cookie = await guestCookie('misafir1');
    expect((await put(cookie, SAVE)).statusCode).toBe(200);
    expect((await get(cookie)).json()).toEqual({ save: UPGRADED });
  });

  it('v6 kaydı (ekonomi, görevler, toplananlar, yetenekler, seviyeli asalar, ahlak seçimleri) aynen saklar ve geri verir', async () => {
    const cookie = await guestCookie('misafir2');
    expect((await put(cookie, SAVE_V2)).statusCode).toBe(200);
    expect((await get(cookie)).json()).toEqual({ save: SAVE_V2 });
  });

  it('eski (v7) kayıttaki altın Kor olarak yükseltilir', async () => {
    const cookie = await guestCookie('misafir7');
    const { wallet: _wallet, ...rest } = SAVE_V2;
    expect((await put(cookie, { ...rest, version: 7, gold: 250, savePoint: SAVE.savePoint })).statusCode).toBe(200);
    expect((await get(cookie)).json().save.wallet).toEqual({ kor: 250, ciy: 0, tunc: 0, tuy: 0 });
  });

  it('harita büyüdü: eski (v8 ve öncesi) kayıt noktası 20 karo kaydırılır, v9 aynen kalır', async () => {
    const cookie = await guestCookie('misafir9');
    const point = { cityId: 'ignis', tileX: 64, tileY: 62 };
    expect((await put(cookie, { ...SAVE_V2, version: 8, savePoint: point })).statusCode).toBe(200);
    expect((await get(cookie)).json().save.savePoint).toEqual({ cityId: 'ignis', tileX: 84, tileY: 82 });
    expect((await put(cookie, { ...SAVE_V2, version: 9, savePoint: point })).statusCode).toBe(200);
    expect((await get(cookie)).json().save.savePoint).toEqual(point);
  });

  it('v2 alanları doğrulanır: hileli altın, bilinmeyen yer, bozuk görev, taşan liste reddedilir', async () => {
    const cookie = await guestCookie('misafir3');
    const bad = [
      { wallet: { kor: -1 } },
      { wallet: { kor: 1e9 } },
      { wallet: { ciy: 1.5 } },
      { wallet: { altin: 5 } },
      { wallet: 'çok' },
      { xp: 'çok' },
      { items: { 'sifali-ot': 0 } },
      { items: { 'sifali-ot': 5000 } },
      { items: { 'BÜYÜK HARF': 1 } },
      { items: ['sifali-ot'] },
      { equipped: { kafa: 'yun-sapka' } },
      { equipped: { hat: 42 } },
      { quests: { 'ash-ot-toplama': { status: 'bitti', progress: 1 } } },
      { quests: { 'ash-ot-toplama': { status: 'active', progress: -1 } } },
      { collected: 'hepsi' },
      { collected: Array.from({ length: 201 }, (_, i) => `p-${i}`) },
      { collected: ['İÇİNDE BOŞLUK'] },
      { skills: 'hepsi' },
      { skills: Array.from({ length: 40 }, (_, i) => `s-${i}`) },
      { skills: ['BÜYÜK HARF'] },
      { skills: [5] },
      { wands: 'hepsi' },
      { wands: { 'wand-fire-attack-1-1': 0 } },
      { wands: { 'wand-fire-attack-1-1': 1000 } },
      { wands: { 'BÜYÜK': 1 } },
      { wands: { 'wand-fire-attack-7-1': 1 } }, // nadirlik 1-6
      { wands: { 'wand-fire-attack-1-31': 1 } }, // seviye 1-30
      { wands: { 'wand-fire-attack-1-0': 1 } },
      { wands: { 'wand-wind-attack-1-1': 1 } },
      { wands: { 'w-1': 1 } },
      { wands: Object.fromEntries(Array.from({ length: 201 }, (_, i) => [`w-${i}`, 1])) },
      { wandEquipped: 5 },
      { wandEquipped: 'sahte' },
      { wandEquipped: 'wand-fire-attack-9-1' },
      { choices: 'hepsi' },
      { choices: { 'c1-isciler': 'tarafsiz' } },
      { choices: { 'c1-isciler': 1 } },
      { choices: { 'BÜYÜK': 'good' } },
      { choices: Object.fromEntries(Array.from({ length: 17 }, (_, i) => [`c-${i}`, 'good'])) },
      { choices: ['good'] },
    ];
    for (const over of bad) expect((await put(cookie, { ...SAVE_V2, ...over })).statusCode, JSON.stringify(over).slice(0, 50)).toBe(400);
    expect((await get(cookie)).json()).toEqual({ save: null }); // hiçbiri yazılmadı
  });

  it('tekrarlanan toplanan kimlikler tekilleştirilir', async () => {
    const cookie = await guestCookie('misafir4');
    await put(cookie, { ...SAVE_V2, collected: ['p-herb-0', 'p-herb-0', 'p-herb-1'] });
    expect((await get(cookie)).json().save.collected).toEqual(['p-herb-0', 'p-herb-1']);
  });

  it('eski v2 kayıt (yeteneksiz) kabul edilir ve boş yeteneklerle v3 olur', async () => {
    const cookie = await guestCookie('misafir6');
    const { wallet: _wl, skills: _s, wands: _w, wandEquipped: _e, choices: _c, ...v2 } = { ...SAVE_V2, version: 2, gold: 250, savePoint: SAVE.savePoint };
    expect((await put(cookie, v2)).statusCode).toBe(200);
    expect((await get(cookie)).json().save).toEqual({ ...SAVE_V2, wallet: { kor: 250, ciy: 0, tunc: 0, tuy: 0 }, skills: [], wands: {}, wandEquipped: null, choices: {} });
  });

  it('eski v3 kayıt (asasız) kabul edilir ve boş asalarla v4 olur', async () => {
    const cookie = await guestCookie('misafir8');
    const { wallet: _wl, wands: _w, wandEquipped: _e, choices: _c, ...v3 } = { ...SAVE_V2, version: 3, gold: 250, savePoint: SAVE.savePoint };
    expect((await put(cookie, v3)).statusCode).toBe(200);
    expect((await get(cookie)).json().save).toEqual({ ...SAVE_V2, wallet: { kor: 250, ciy: 0, tunc: 0, tuy: 0 }, wands: {}, wandEquipped: null, choices: {} });
  });

  it('eski v4 kayıt (ahlak seçimsiz) kabul edilir ve boş seçimlerle v5 olur', async () => {
    const cookie = await guestCookie('misafir9');
    const { wallet: _wl, choices: _c, ...v4 } = { ...SAVE_V2, version: 4, gold: 250, savePoint: SAVE.savePoint };
    expect((await put(cookie, v4)).statusCode).toBe(200);
    expect((await get(cookie)).json().save).toEqual({ ...SAVE_V2, wallet: { kor: 250, ciy: 0, tunc: 0, tuy: 0 }, choices: {} });
  });

  it('eski v5 kayıt (seviyesiz, 8 yuvalı asalar) yükseltilir: kimlikler seviye 1 olur, en nadir asa kuşanılır', async () => {
    const cookie = await guestCookie('misafir10');
    const { wands: _w, wandEquipped: _e, ...rest } = SAVE_V2;
    const v5 = {
      ...rest,
      version: 5,
      wands: { 'wand-fire-attack-3': 2, 'wand-air-defense-1': 7, 'wand-fire-attack-3-1': 1 },
      wandsEquipped: { 'fire-attack': 'wand-fire-attack-3', 'air-defense': 'wand-air-defense-1', 'water-attack': 'wand-water-attack-1' },
    };
    expect((await put(cookie, v5)).statusCode).toBe(200);
    const { save } = (await get(cookie)).json();
    expect(save.version).toBe(9);
    expect(save.wands).toEqual({ 'wand-fire-attack-3-1': 3, 'wand-air-defense-1-1': 7 }); // eski ve yeni aynı asa toplanır
    expect(save.wandEquipped).toBe('wand-fire-attack-3-1'); // sahip olunmayan yuva atılır, en nadir seçilir
    expect(save).not.toHaveProperty('wandsEquipped');
  });

  it('v6: kuşanılı asa sahip olunmuyorsa null olur; seviye biçimi korunur', async () => {
    const cookie = await guestCookie('misafir11');
    await put(cookie, { ...SAVE_V2, wandEquipped: 'wand-earth-defense-2-9' });
    const { save } = (await get(cookie)).json();
    expect(save.wandEquipped).toBeNull();
    expect(save.wands).toEqual({ 'wand-fire-attack-3-12': 2, 'wand-air-defense-1-4': 7 });
  });

  it('ekipman yuvaları: cüppe, şapka, pantalon, çanta, yüzük, ayakkabı kabul edilir; eski tılsım yuvası da okunur', async () => {
    const cookie = await guestCookie('misafir12');
    const equipped = { robe: 'eq-robe-fire-3', hat: 'eq-hat-water-1', pants: 'eq-pants-earth-2', bag: 'eq-bag-air-4', ring: 'eq-ring-fire-6', boots: 'eq-boots-air-2' };
    expect((await put(cookie, { ...SAVE_V2, equipped })).statusCode).toBe(200);
    expect((await get(cookie)).json().save.equipped).toEqual(equipped);
    // Eski kayıt: tılsım yuvası (istemci yüklerken yüzüğe çevirir)
    expect((await put(cookie, { ...SAVE_V2, equipped: { robe: 'cirak-cuppesi', amulet: 'tas-tilsim' } })).statusCode).toBe(200);
    expect((await put(cookie, { ...SAVE_V2, equipped: { kafa: 'x' } })).statusCode).toBe(400);
  });

  it('tekrarlanan yetenek kimlikleri tekilleştirilir', async () => {
    const cookie = await guestCookie('misafir7');
    await put(cookie, { ...SAVE_V2, skills: ['fire-power-1', 'fire-power-1'] });
    expect((await get(cookie)).json().save.skills).toEqual(['fire-power-1']);
  });

  it('üzerine yazar', async () => {
    const cookie = await guestCookie('misafir1');
    await put(cookie, SAVE);
    await put(cookie, { ...SAVE, completedChapters: [1, 2, 3], savePoint: { cityId: 'abyss', tileX: 62, tileY: 18 } });
    const { save } = (await get(cookie)).json();
    expect(save.completedChapters).toEqual([1, 2, 3]);
    expect(save.savePoint.cityId).toBe('abyss');
  });

  it('her hesabın kaydı ayrıdır', async () => {
    const a = await guestCookie('oyuncuA');
    const b = await guestCookie('oyuncuB');
    await put(a, SAVE);
    expect((await get(b)).json()).toEqual({ save: null });
  });

  it('desteklenmeyen sürüm reddedilir', async () => {
    const cookie = await guestCookie('misafir5');
    expect((await put(cookie, { ...SAVE, version: 10 })).statusCode).toBe(400);
    expect((await put(cookie, { ...SAVE, version: 0 })).statusCode).toBe(400);
  });

  it('kayıt noktası olmayan yeni oyun kaydedilebilir', async () => {
    const cookie = await guestCookie('misafir1');
    expect((await put(cookie, { ...SAVE, completedChapters: [], savePoint: null })).statusCode).toBe(200);
  });

  it('geçersiz kaydı 400 ile reddeder ve eskisini bozmaz', async () => {
    const cookie = await guestCookie('misafir1');
    await put(cookie, SAVE);
    const res = await put(cookie, { ...SAVE, completedChapters: [1, 3] });
    expect(res.statusCode).toBe(400);
    expect(res.json().code).toBe('INVALID');
    expect((await get(cookie)).json().save.completedChapters).toEqual([1]);
  });

  it('çok büyük gövdeyi reddeder', async () => {
    const cookie = await guestCookie('misafir1');
    const res = await put(cookie, { ...SAVE, playerName: 'x'.repeat(40_000) });
    expect(res.statusCode).toBeGreaterThanOrEqual(400);
    expect(res.statusCode).toBeLessThan(500);
  });
});

describe('parseSave', () => {
  const ok = (over: object = {}) => parseSave({ ...SAVE, ...over });

  it('geçerli kaydı temizleyip kabul eder (ad kırpılır, fazla alan atılır)', () => {
    const r = parseSave({ ...SAVE, playerName: '  Aylin  ', hile: 'altin: 9999' });
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.save.playerName).toBe('Aylin');
      expect(r.save).not.toHaveProperty('hile');
    }
  });

  it.each([
    ['sürüm yanlış', { version: 10 }],
    ['ad çok kısa', { playerName: 'A' }],
    ['ad çok uzun', { playerName: 'x'.repeat(21) }],
    ['addaki özel karakter', { playerName: '<script>' }],
    ['bölümler sıralı değil', { completedChapters: [2] }],
    ['bölümler tekrarlı', { completedChapters: [1, 1] }],
    ['bölüm sayısı fazla', { completedChapters: [1, 2, 3, 4, 5, 6, 7, 8, 9] }],
    ['bölümler dizi değil', { completedChapters: 'hepsi' }],
    ['bilinmeyen şehir', { savePoint: { cityId: 'baska', tileX: 1, tileY: 1 } }],
    ['karo negatif', { savePoint: { cityId: 'ignis', tileX: -1, tileY: 1 } }],
    ['karo kesirli', { savePoint: { cityId: 'ignis', tileX: 1.5, tileY: 1 } }],
    ['karo çok büyük', { savePoint: { cityId: 'ignis', tileX: 9999, tileY: 1 } }],
  ])('%s → reddeder', (_n, over) => {
    expect(ok(over).ok).toBe(false);
  });

  it('Türkçe harfli adı kabul eder', () => {
    expect(ok({ playerName: 'Gökçe Çağrı' }).ok).toBe(true);
  });

  it('nesne olmayan girdiyi reddeder', () => {
    expect(parseSave(null).ok).toBe(false);
    expect(parseSave('x').ok).toBe(false);
  });
});
