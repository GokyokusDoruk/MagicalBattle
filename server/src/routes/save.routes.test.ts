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

const SAVE = {
  version: 1,
  playerName: 'Aylin',
  completedChapters: [1],
  savePoint: { cityId: 'ignis', tileX: 64, tileY: 62 },
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
    expect((await get(cookie)).json()).toEqual({ save: SAVE });
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
    const res = await put(cookie, { ...SAVE, playerName: 'x'.repeat(10_000) });
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
    ['sürüm yanlış', { version: 2 }],
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
