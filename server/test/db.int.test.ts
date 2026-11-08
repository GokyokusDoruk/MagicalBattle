import { execFileSync } from 'node:child_process';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import EmbeddedPostgres from 'embedded-postgres';
import type { FastifyInstance } from 'fastify';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { buildApp } from '../src/app.js';
import { loadConfig } from '../src/config.js';
import { createPrisma } from '../src/db.js';
import type { PrismaClient } from '../src/generated/prisma/client.js';
import { PrismaSaveRepository } from '../src/save/prismaRepository.js';
import { PrismaUserRepository } from '../src/users/prismaRepository.js';
import { DuplicateError } from '../src/users/repository.js';

/**
 * Gerçek bir PostgreSQL'e karşı çalışır (Docker gerekmez; `embedded-postgres` geçici bir küme başlatır).
 * Çalıştırmak için: npm run test:db
 */
const PORT = 54329;
const DB = 'mb_test';
const URL = `postgresql://postgres:test@localhost:${PORT}/${DB}`;

let pg: EmbeddedPostgres;
let dir: string;
let prisma: PrismaClient;
let repo: PrismaUserRepository;
let app: FastifyInstance;

beforeAll(async () => {
  dir = mkdtempSync(join(tmpdir(), 'mb-pg-'));
  pg = new EmbeddedPostgres({
    databaseDir: dir,
    user: 'postgres',
    password: 'test',
    port: PORT,
    persistent: false,
    // Türkçe Windows'ta yerel ayar adı ASCII olmadığı için initdb çöküyor; sabit ayar ver
    initdbFlags: ['--locale=C', '--encoding=UTF8'],
  });
  await pg.initialise();
  await pg.start();
  await pg.createDatabase(DB);

  // Üretimdeki gibi migrasyonları uygula
  execFileSync('npx', ['prisma', 'migrate', 'deploy'], {
    cwd: join(import.meta.dirname, '..'),
    env: { ...process.env, DATABASE_URL: URL },
    stdio: 'pipe',
    shell: true,
  });

  // Migrasyon dosyaları schema.prisma ile birebir aynı sonucu vermeli (unutulmuş migrasyon yakalanır)
  await pg.createDatabase(`${DB}_shadow`);
  execFileSync(
    'npx',
    [
      'prisma', 'migrate', 'diff',
      '--from-migrations', 'prisma/migrations',
      '--to-schema', 'prisma/schema.prisma',
      '--exit-code',
    ],
    {
      cwd: join(import.meta.dirname, '..'),
      env: { ...process.env, DATABASE_URL: URL, SHADOW_DATABASE_URL: URL.replace(`/${DB}`, `/${DB}_shadow`) },
      stdio: 'pipe',
      shell: true,
    },
  );

  prisma = createPrisma(URL);
  repo = new PrismaUserRepository(prisma);
  app = await buildApp({ config: { ...loadConfig({}), authRateLimit: 1000 }, users: repo, saves: new PrismaSaveRepository(prisma) });
}, 180_000);

afterAll(async () => {
  await app?.close();
  await prisma?.$disconnect();
  await pg?.stop();
  rmSync(dir, { recursive: true, force: true });
}, 60_000);

const base = (n: string) => ({
  username: `Kisi_${n}`,
  usernameKey: `kisi_${n}`,
  passwordHash: 'scrypt$x',
  isGuest: false,
  firstName: 'Ad',
  lastName: 'Soyad',
  email: `${n}@example.com`,
});

describe('PrismaUserRepository (gerçek PostgreSQL)', () => {
  it('kullanıcı oluşturur ve kimlikle/anahtarla bulur', async () => {
    const created = await repo.create(base('a'));
    expect(created.id).toMatch(/^[0-9a-f-]{36}$/);
    expect((await repo.findById(created.id))?.username).toBe('Kisi_a');
    expect((await repo.findByUsernameKey('kisi_a'))?.id).toBe(created.id);
    expect(await repo.findByUsernameKey('yok')).toBeNull();
  });

  it('aynı kullanıcı adı DuplicateError(username) fırlatır', async () => {
    await repo.create(base('b'));
    const err = await repo.create({ ...base('b'), email: 'farkli@example.com' }).catch((e) => e);
    expect(err).toBeInstanceOf(DuplicateError);
    expect(err.field).toBe('username');
  });

  it('aynı e-posta DuplicateError(email) fırlatır', async () => {
    await repo.create(base('c'));
    const err = await repo.create({ ...base('d'), email: 'c@example.com' }).catch((e) => e);
    expect(err).toBeInstanceOf(DuplicateError);
    expect(err.field).toBe('email');
  });

  it('misafirler e-postasız birden çok kez oluşturulabilir (NULL çakışmaz)', async () => {
    const guest = (n: string) => ({ ...base(n), isGuest: true, firstName: null, lastName: null, email: null });
    await repo.create(guest('g1'));
    await repo.create(guest('g2'));
    expect((await repo.findByUsernameKey('kisi_g2'))?.isGuest).toBe(true);
  });
});

describe('uygulama + gerçek veritabanı', () => {
  it('kayıt → çıkış → giriş → /auth/me akışı', async () => {
    const reg = await app.inject({
      method: 'POST',
      url: '/auth/register',
      payload: { firstName: 'Doruk', lastName: 'G', email: 'e2e@example.com', username: 'E2E_User', password: 'guvenli-sifre-1' },
    });
    expect(reg.statusCode).toBe(201);

    const dup = await app.inject({
      method: 'POST',
      url: '/auth/register',
      payload: { firstName: 'X', lastName: 'Y', email: 'baska@example.com', username: 'e2e_user', password: 'guvenli-sifre-1' },
    });
    expect(dup.statusCode).toBe(409);

    const login = await app.inject({ method: 'POST', url: '/auth/login', payload: { username: 'e2e_USER', password: 'guvenli-sifre-1' } });
    expect(login.statusCode).toBe(200);
    const cookie = login.cookies.find((c) => c.name === 'mb_session')!;

    const me = await app.inject({ method: 'GET', url: '/auth/me', headers: { cookie: `mb_session=${cookie.value}` } });
    expect(me.statusCode).toBe(200);
    expect(me.json().user.username).toBe('E2E_User');
  });

  it('misafir hesabı veritabanında saklanır ve giriş yapabilir', async () => {
    const g = await app.inject({ method: 'POST', url: '/auth/guest', payload: { username: 'Misafir9', password: 'misafir-sifre' } });
    expect(g.statusCode).toBe(201);
    const row = await prisma.user.findUnique({ where: { usernameKey: 'misafir9' } });
    expect(row).toMatchObject({ isGuest: true, email: null, firstName: null });
    expect(row?.passwordHash.startsWith('scrypt$')).toBe(true);
    const login = await app.inject({ method: 'POST', url: '/auth/login', payload: { username: 'misafir9', password: 'misafir-sifre' } });
    expect(login.statusCode).toBe(200);
  });
});

describe('PrismaSaveRepository (gerçek PostgreSQL)', () => {
  const saves = () => new PrismaSaveRepository(prisma);
  const data = {
    version: 4 as const,
    playerName: 'Aylin',
    completedChapters: [1, 2],
    savePoint: { cityId: 'ignis', tileX: 64, tileY: 62 },
    gold: 320,
    xp: 150,
    items: { 'sifali-ot': 3, 'cirak-cuppesi': 1 },
    equipped: { robe: 'cirak-cuppesi' },
    quests: { 'ash-ot-toplama': { status: 'completed' as const, progress: 5 } },
    collected: ['p-herb-1', 'p-herb-2'],
    skills: ['fire-power-1', 'earth-ward-1'],
    wands: { 'wand-fire-attack-2': 1 },
    wandsEquipped: { 'fire-attack': 'wand-fire-attack-2' },
  };

  it('kaydı yazar, okur ve üzerine yazar', async () => {
    const user = await repo.create(base('s1'));
    expect(await saves().get(user.id)).toBeNull();
    await saves().put(user.id, data);
    expect(await saves().get(user.id)).toEqual(data);
    await saves().put(user.id, { ...data, completedChapters: [1, 2, 3] });
    expect((await saves().get(user.id))?.completedChapters).toEqual([1, 2, 3]);
    expect(await prisma.saveGame.count({ where: { userId: user.id } })).toBe(1);
  });

  it('hesap silinince kaydı da silinir (CASCADE)', async () => {
    const user = await repo.create(base('s2'));
    await saves().put(user.id, data);
    await prisma.user.delete({ where: { id: user.id } });
    expect(await prisma.saveGame.count({ where: { userId: user.id } })).toBe(0);
  });

  it('veritabanındaki eski (v1) kayıt, yeni alanlar varsayılanla doldurularak okunur', async () => {
    const user = await repo.create(base('s4'));
    await prisma.saveGame.create({
      data: { userId: user.id, data: { version: 1, playerName: 'Eski', completedChapters: [1], savePoint: null } },
    });
    expect(await saves().get(user.id)).toEqual({
      version: 4,
      playerName: 'Eski',
      completedChapters: [1],
      savePoint: null,
      gold: 0,
      xp: 0,
      items: {},
      equipped: {},
      quests: {},
      collected: [],
      skills: [],
      wands: {},
      wandsEquipped: {},
    });
  });

  it('veritabanındaki bozuk kayıt yokmuş gibi davranılır', async () => {
    const user = await repo.create(base('s3'));
    await prisma.saveGame.create({ data: { userId: user.id, data: { version: 1, hile: true } } });
    expect(await saves().get(user.id)).toBeNull();
  });

  it('uygulama üzerinden: kayıt → oturum → /save yaz-oku', async () => {
    const g = await app.inject({ method: 'POST', url: '/auth/guest', payload: { username: 'SaveGuest', password: 'misafir-sifre' } });
    const cookie = `mb_session=${g.cookies.find((c) => c.name === 'mb_session')!.value}`;
    const w = await app.inject({ method: 'PUT', url: '/save', payload: data, headers: { cookie } });
    expect(w.statusCode).toBe(200);
    const r = await app.inject({ method: 'GET', url: '/save', headers: { cookie } });
    expect(r.json().save).toEqual(data);
  });
});
