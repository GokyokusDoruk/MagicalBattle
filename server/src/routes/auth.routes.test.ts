import type { FastifyInstance } from 'fastify';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { buildApp } from '../app.js';
import { loadConfig } from '../config.js';
import { MemorySaveRepository } from '../save/repository.js';
import { MemoryUserRepository } from '../users/memoryRepository.js';
import { SESSION_COOKIE } from './auth.js';

const ORIGIN = 'http://localhost:5173';
let app: FastifyInstance;
let users: MemoryUserRepository;

async function start(authRateLimit = 1000): Promise<void> {
  users = new MemoryUserRepository();
  app = await buildApp({ config: { ...loadConfig({}), authRateLimit, corsOrigins: [ORIGIN] }, users, saves: new MemorySaveRepository() });
}

beforeEach(() => start());
afterEach(() => app.close());

const post = (url: string, payload: unknown, cookie?: string) =>
  app.inject({ method: 'POST', url, payload: payload as object, headers: cookie ? { cookie } : {} });

const REGISTER = {
  firstName: 'Doruk',
  lastName: 'Gökyokuş',
  email: 'Doruk@Example.com',
  username: 'Doruk42',
  password: 'guvenli-sifre-1',
};

function sessionCookie(res: { cookies: { name: string; value: string }[] }): string {
  const c = res.cookies.find((x) => x.name === SESSION_COOKIE);
  expect(c, 'oturum çerezi').toBeDefined();
  return `${SESSION_COOKIE}=${c!.value}`;
}

describe('POST /auth/register', () => {
  it('hesap açar, oturum çerezi verir ve hassas alanları döndürmez', async () => {
    const res = await post('/auth/register', REGISTER);
    expect(res.statusCode).toBe(201);
    const body = res.json();
    expect(body.user).toMatchObject({ username: 'Doruk42', isGuest: false, firstName: 'Doruk' });
    expect(JSON.stringify(body)).not.toMatch(/passwordHash|email|scrypt/);
    const cookie = res.cookies.find((c) => c.name === SESSION_COOKIE)!;
    expect(cookie.httpOnly).toBe(true);
    expect(cookie.sameSite).toBe('Lax');
  });

  it('şifreyi düz saklamaz, e-postayı küçük harfe çevirir', async () => {
    await post('/auth/register', REGISTER);
    const stored = await users.findByUsernameKey('doruk42');
    expect(stored?.passwordHash.startsWith('scrypt$')).toBe(true);
    expect(stored?.passwordHash).not.toContain(REGISTER.password);
    expect(stored?.email).toBe('doruk@example.com');
  });

  it('aynı kullanıcı adını (büyük/küçük harf fark etmeden) reddeder', async () => {
    await post('/auth/register', REGISTER);
    const res = await post('/auth/register', { ...REGISTER, email: 'baska@example.com', username: 'DORUK42' });
    expect(res.statusCode).toBe(409);
    expect(res.json().code).toBe('USERNAME_TAKEN');
  });

  it('aynı e-postayı reddeder', async () => {
    await post('/auth/register', REGISTER);
    const res = await post('/auth/register', { ...REGISTER, username: 'baskasi' });
    expect(res.statusCode).toBe(409);
    expect(res.json().code).toBe('EMAIL_TAKEN');
  });

  it.each([
    ['ad yok', { firstName: '' }],
    ['soyad yok', { lastName: '  ' }],
    ['geçersiz e-posta', { email: 'yanlis' }],
    ['kısa kullanıcı adı', { username: 'ab' }],
    ['kısa şifre', { password: '123' }],
  ])('%s → 400 ve Türkçe mesaj', async (_name, override) => {
    const res = await post('/auth/register', { ...REGISTER, ...override });
    expect(res.statusCode).toBe(400);
    expect(res.json().code).toBe('INVALID');
    expect(res.json().error).toMatch(/[a-zA-ZçğıöşüÇĞİÖŞÜ]/);
  });

  it('gövde olmadan 400 döner, çökmez', async () => {
    const res = await app.inject({ method: 'POST', url: '/auth/register' });
    expect(res.statusCode).toBe(400);
  });
});

describe('POST /auth/guest', () => {
  it('yalnız kullanıcı adı ve şifreyle misafir hesabı açar', async () => {
    const res = await post('/auth/guest', { username: 'misafir1', password: 'misafir-sifre' });
    expect(res.statusCode).toBe(201);
    expect(res.json().user).toMatchObject({ username: 'misafir1', isGuest: true, firstName: null });
    const stored = await users.findByUsernameKey('misafir1');
    expect(stored).toMatchObject({ isGuest: true, email: null });
  });

  it('kayıtlı bir kullanıcı adıyla çakışırsa 409 döner', async () => {
    await post('/auth/register', REGISTER);
    const res = await post('/auth/guest', { username: 'doruk42', password: 'misafir-sifre' });
    expect(res.statusCode).toBe(409);
  });

  it('misafir hesabıyla sonradan giriş yapılabilir', async () => {
    await post('/auth/guest', { username: 'misafir1', password: 'misafir-sifre' });
    const res = await post('/auth/login', { username: 'misafir1', password: 'misafir-sifre' });
    expect(res.statusCode).toBe(200);
    expect(res.json().user.isGuest).toBe(true);
  });
});

describe('POST /auth/login', () => {
  beforeEach(async () => {
    await post('/auth/register', REGISTER);
  });

  it('doğru bilgiyle giriş yapar, kullanıcı adı büyük/küçük harfe duyarsız', async () => {
    const res = await post('/auth/login', { username: 'doruk42', password: REGISTER.password });
    expect(res.statusCode).toBe(200);
    expect(res.json().user.username).toBe('Doruk42');
    sessionCookie(res);
  });

  it('yanlış şifre ve olmayan kullanıcı aynı cevabı verir', async () => {
    const wrongPass = await post('/auth/login', { username: 'Doruk42', password: 'yanlis-sifre-1' });
    const noUser = await post('/auth/login', { username: 'yokboyle', password: 'yanlis-sifre-1' });
    expect(wrongPass.statusCode).toBe(401);
    expect(noUser.statusCode).toBe(401);
    expect(wrongPass.json()).toEqual(noUser.json());
    expect(wrongPass.cookies.find((c) => c.name === SESSION_COOKIE)).toBeUndefined();
  });

  it('eksik alanda 400 döner', async () => {
    expect((await post('/auth/login', { username: 'Doruk42' })).statusCode).toBe(400);
  });
});

describe('oturum', () => {
  it('/auth/me çerezle kullanıcıyı döndürür', async () => {
    const reg = await post('/auth/register', REGISTER);
    const res = await app.inject({ method: 'GET', url: '/auth/me', headers: { cookie: sessionCookie(reg) } });
    expect(res.statusCode).toBe(200);
    expect(res.json().user.username).toBe('Doruk42');
  });

  it('çerez yoksa 401', async () => {
    expect((await app.inject({ method: 'GET', url: '/auth/me' })).statusCode).toBe(401);
  });

  it('kurcalanmış çerez 401', async () => {
    const reg = await post('/auth/register', REGISTER);
    const tampered = sessionCookie(reg).slice(0, -3) + 'abc';
    const res = await app.inject({ method: 'GET', url: '/auth/me', headers: { cookie: tampered } });
    expect(res.statusCode).toBe(401);
  });

  it('logout çerezi siler', async () => {
    const res = await post('/auth/logout', {});
    expect(res.statusCode).toBe(200);
    const c = res.cookies.find((x) => x.name === SESSION_COOKIE);
    expect(c?.value).toBe('');
  });
});

describe('güvenlik', () => {
  it('giriş denemeleri sınırlanır (429)', async () => {
    await app.close();
    await start(3);
    const codes: number[] = [];
    for (let i = 0; i < 5; i++) codes.push((await post('/auth/login', { username: 'x', password: 'y' })).statusCode);
    expect(codes.slice(0, 3)).toEqual([401, 401, 401]);
    expect(codes.slice(3)).toEqual([429, 429]);
    const blocked = await post('/auth/login', { username: 'x', password: 'y' });
    expect(blocked.json().code).toBe('RATE_LIMITED');
    expect(blocked.json().error).toMatch(/Çok fazla/);
  });

  it('CORS: izinli adrese çerezli istek izni verir, yabancıya vermez', async () => {
    const allowed = await app.inject({ method: 'GET', url: '/health', headers: { origin: ORIGIN } });
    expect(allowed.headers['access-control-allow-origin']).toBe(ORIGIN);
    expect(allowed.headers['access-control-allow-credentials']).toBe('true');
    const foreign = await app.inject({ method: 'GET', url: '/health', headers: { origin: 'https://kotu.example' } });
    expect(foreign.headers['access-control-allow-origin']).toBeUndefined();
  });

  it('veritabanı hatasında iç ayrıntıları sızdırmaz (500, genel mesaj)', async () => {
    await app.close();
    const broken = {
      create: async () => {
        throw new Error('SECRET: C:\\sunucu\\dosya.ts connection refused postgres://kullanici:sifre@db');
      },
      findByUsernameKey: async () => {
        throw new Error('SECRET: sorgu hatası');
      },
      findById: async () => null,
    };
    app = await buildApp({ config: { ...loadConfig({}), authRateLimit: 1000 }, users: broken, saves: new MemorySaveRepository() });
    const res = await post('/auth/login', { username: 'Doruk42', password: 'guvenli-sifre-1' });
    expect(res.statusCode).toBe(500);
    expect(res.json()).toEqual({ code: 'SERVER_ERROR', error: 'Sunucu hatası. Lütfen biraz sonra tekrar dene.' });
    expect(res.body).not.toMatch(/SECRET|postgres|dosya/);
    const reg = await post('/auth/register', REGISTER);
    expect(reg.statusCode).toBe(500);
    expect(reg.body).not.toMatch(/SECRET|postgres|dosya/);
  });

  it('bozuk JSON gövdesi 400 ve genel mesaj verir', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/auth/login',
      headers: { 'content-type': 'application/json' },
      payload: '{bozuk json',
    });
    expect(res.statusCode).toBe(400);
    expect(res.json().code).toBe('BAD_REQUEST');
  });

  it('/health çalışır', async () => {
    const res = await app.inject({ method: 'GET', url: '/health' });
    expect(res.json()).toEqual({ status: 'ok', game: 'MagicalBattle' });
  });
});
