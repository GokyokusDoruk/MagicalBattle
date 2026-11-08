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

/** v1 kaydın v5'e yükseltilmiş hali: yeni alanlar varsayılan */
const UPGRADED = { ...SAVE, version: 5, gold: 0, xp: 0, items: {}, equipped: {}, quests: {}, collected: [], skills: [], wands: {}, wandsEquipped: {}, choices: {} };

/** Güncel (v5) biçim: ekonomi, görevler, toplananlar, yetenekler, asalar ve ahlak seçimleri dolu */
const SAVE_V2 = {
  ...UPGRADED,
  gold: 250,
  xp: 320,
  items: { 'sifali-ot': 4, 'bekci-cuppesi': 1, 'kucuk-canta': 1 },
  equipped: { robe: 'bekci-cuppesi', bag: 'kucuk-canta' },
  quests: { 'ash-ot-toplama': { status: 'completed', progress: 5 }, 'vine-kristal-avi': { status: 'active', progress: 1 } },
  collected: ['p-herb-0', 'p-herb-3'],
  skills: ['fire-power-1', 'fire-power-2', 'water-ward-1'],
  wands: { 'wand-fire-attack-3': 2, 'wand-air-defense-1': 7 },
  wandsEquipped: { 'fire-attack': 'wand-fire-attack-3' },
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

  it('v5 kaydı (ekonomi, görevler, toplananlar, yetenekler, asalar, ahlak seçimleri) aynen saklar ve geri verir', async () => {
    const cookie = await guestCookie('misafir2');
    expect((await put(cookie, SAVE_V2)).statusCode).toBe(200);
    expect((await get(cookie)).json()).toEqual({ save: SAVE_V2 });
  });

  it('v2 alanları doğrulanır: hileli altın, bilinmeyen yer, bozuk görev, taşan liste reddedilir', async () => {
    const cookie = await guestCookie('misafir3');
    const bad = [
      { gold: -1 },
      { gold: 1e9 },
      { gold: 1.5 },
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
      { wands: { 'wand-fire-attack-1': 0 } },
      { wands: { 'wand-fire-attack-1': 1000 } },
      { wands: { 'BÜYÜK': 1 } },
      { wands: Object.fromEntries(Array.from({ length: 49 }, (_, i) => [`w-${i}`, 1])) },
      { wandsEquipped: { 'fire-ruh': 'wand-fire-attack-1' } },
      { wandsEquipped: { 'fire-attack': 5 } },
      { wandsEquipped: ['x'] },
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
    const { skills: _s, wands: _w, wandsEquipped: _e, choices: _c, ...v2 } = { ...SAVE_V2, version: 2 };
    expect((await put(cookie, v2)).statusCode).toBe(200);
    expect((await get(cookie)).json().save).toEqual({ ...SAVE_V2, skills: [], wands: {}, wandsEquipped: {}, choices: {} });
  });

  it('eski v3 kayıt (asasız) kabul edilir ve boş asalarla v4 olur', async () => {
    const cookie = await guestCookie('misafir8');
    const { wands: _w, wandsEquipped: _e, choices: _c, ...v3 } = { ...SAVE_V2, version: 3 };
    expect((await put(cookie, v3)).statusCode).toBe(200);
    expect((await get(cookie)).json().save).toEqual({ ...SAVE_V2, wands: {}, wandsEquipped: {}, choices: {} });
  });

  it('eski v4 kayıt (ahlak seçimsiz) kabul edilir ve boş seçimlerle v5 olur', async () => {
    const cookie = await guestCookie('misafir9');
    const { choices: _c, ...v4 } = { ...SAVE_V2, version: 4 };
    expect((await put(cookie, v4)).statusCode).toBe(200);
    expect((await get(cookie)).json().save).toEqual({ ...SAVE_V2, choices: {} });
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
    expect((await put(cookie, { ...SAVE, version: 6 })).statusCode).toBe(400);
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
    ['sürüm yanlış', { version: 6 }],
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
