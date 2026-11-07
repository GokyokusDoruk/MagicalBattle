import { describe, expect, it } from 'vitest';
import { loadConfig } from '../config.js';
import { hashPassword, verifyPassword } from './password.js';
import { normalizeEmail, usernameKey, validateEmail, validateName, validatePassword, validateUsername } from './validation.js';

describe('şifre hash', () => {
  it('doğru şifreyi kabul, yanlışı reddeder', async () => {
    const hash = await hashPassword('guvenli-sifre-1');
    expect(await verifyPassword('guvenli-sifre-1', hash)).toBe(true);
    expect(await verifyPassword('guvenli-sifre-2', hash)).toBe(false);
  });

  it('aynı şifre her seferinde farklı hash üretir (tuz)', async () => {
    expect(await hashPassword('ayni-sifre-123')).not.toBe(await hashPassword('ayni-sifre-123'));
  });

  it('hash düz şifreyi içermez ve scrypt biçimindedir', async () => {
    const hash = await hashPassword('gizli-sifre-99');
    expect(hash.startsWith('scrypt$')).toBe(true);
    expect(hash).not.toContain('gizli-sifre-99');
  });

  it('bozuk ya da tanınmayan hash için false döner', async () => {
    expect(await verifyPassword('x', '')).toBe(false);
    expect(await verifyPassword('x', 'bcrypt$a$b')).toBe(false);
    expect(await verifyPassword('x', 'scrypt$16384$8$1$AAAA$')).toBe(false);
  });

  it('Türkçe karakterli şifreyle çalışır', async () => {
    const hash = await hashPassword('şifreÇğüİıö123');
    expect(await verifyPassword('şifreÇğüİıö123', hash)).toBe(true);
  });
});

describe('doğrulama', () => {
  it('kullanıcı adı: 3-20 karakter, harf/rakam/alt çizgi', () => {
    expect(validateUsername('doruk_42')).toBeNull();
    expect(validateUsername('ab')).not.toBeNull();
    expect(validateUsername('a'.repeat(21))).not.toBeNull();
    expect(validateUsername('boşluk var')).not.toBeNull();
    expect(validateUsername('türkçeİ')).not.toBeNull();
    expect(validateUsername(123)).not.toBeNull();
  });

  it('şifre: en az 8, en fazla 72 karakter', () => {
    expect(validatePassword('12345678')).toBeNull();
    expect(validatePassword('1234567')).not.toBeNull();
    expect(validatePassword('a'.repeat(73))).not.toBeNull();
    expect(validatePassword(undefined)).not.toBeNull();
  });

  it('e-posta biçimini denetler', () => {
    expect(validateEmail('a@b.com')).toBeNull();
    expect(validateEmail('a@b')).not.toBeNull();
    expect(validateEmail('a b@c.com')).not.toBeNull();
    expect(validateEmail(null)).not.toBeNull();
  });

  it('ad ve soyad boş olamaz', () => {
    expect(validateName('Doruk', 'Ad')).toBeNull();
    expect(validateName('   ', 'Ad')).not.toBeNull();
    expect(validateName('', 'Soyad')).toContain('Soyad');
  });

  it('kullanıcı adı anahtarı ve e-posta küçük harfe çevrilir', () => {
    expect(usernameKey('DoRuK')).toBe('doruk');
    expect(normalizeEmail('  A@B.Com ')).toBe('a@b.com');
  });
});

describe('yapılandırma', () => {
  it('geliştirmede varsayılanlarla çalışır', () => {
    const c = loadConfig({});
    expect(c.isProduction).toBe(false);
    expect(c.jwtSecret.length).toBeGreaterThan(0);
  });

  it('üretimde zayıf ya da eksik ayarı reddeder', () => {
    const base = { NODE_ENV: 'production', DATABASE_URL: 'postgres://x', CORS_ORIGINS: 'https://a.com' };
    expect(() => loadConfig({ ...base })).toThrow(/JWT_SECRET/);
    expect(() => loadConfig({ ...base, JWT_SECRET: 'kisa' })).toThrow(/JWT_SECRET/);
    expect(() => loadConfig({ ...base, JWT_SECRET: 'x'.repeat(32), DATABASE_URL: '' })).toThrow(/DATABASE_URL/);
    expect(() => loadConfig({ ...base, JWT_SECRET: 'x'.repeat(32), CORS_ORIGINS: '' })).toThrow(/CORS_ORIGINS/);
  });

  it('üretimde doğru ayarla çalışır ve CORS listesini ayırır', () => {
    const c = loadConfig({
      NODE_ENV: 'production',
      JWT_SECRET: 'x'.repeat(32),
      DATABASE_URL: 'postgres://x',
      CORS_ORIGINS: 'https://a.com, https://b.com',
      COOKIE_DOMAIN: '.dorukplays.com',
    });
    expect(c.corsOrigins).toEqual(['https://a.com', 'https://b.com']);
    expect(c.cookieDomain).toBe('.dorukplays.com');
  });
});
