import { describe, expect, it } from 'vitest';
import { ApiError, type ApiUser } from '../api/client';
import { checkEntry, enterWithName, type EnterApi } from './authScreen';

/** Bellekte hesap tutan sahte sunucu: giriş ve "misafir" (ad + şifre) hesap açma. */
function fakeApi(accounts: Record<string, string> = {}, opts: { down?: boolean } = {}) {
  const calls: string[] = [];
  const user = (name: string): ApiUser => ({ id: name, username: name, isGuest: true, firstName: null });
  const api: EnterApi = {
    async login(username, password) {
      calls.push(`login:${username}`);
      if (opts.down) throw new ApiError(0, 'NETWORK', 'Sunucuya ulaşılamadı.');
      const key = username.toLowerCase();
      if (accounts[key] !== password) throw new ApiError(401, 'BAD_CREDENTIALS', 'hatalı');
      return user(username);
    },
    async guest(username, password) {
      calls.push(`guest:${username}`);
      const key = username.toLowerCase();
      if (key in accounts) throw new ApiError(409, 'USERNAME_TAKEN', 'alınmış');
      accounts[key] = password;
      return user(username);
    },
  };
  return { api, calls, accounts };
}

describe('tek adımda giriş: büyücü adı + şifre (Faz 1)', () => {
  it('yeni ad: giriş tutmaz, aynı ad ve şifreyle hesap açılır', async () => {
    const f = fakeApi();
    const r = await enterWithName(f.api, 'Doruk', 'gizli-sifre');
    expect(r.created).toBe(true);
    expect(r.user.username).toBe('Doruk');
    expect(f.calls).toEqual(['login:Doruk', 'guest:Doruk']);
    expect(f.accounts.doruk).toBe('gizli-sifre');
  });

  it('var olan ad + doğru şifre: hesap açılmadan giriş yapılır', async () => {
    const f = fakeApi({ doruk: 'gizli-sifre' });
    const r = await enterWithName(f.api, 'doruk', 'gizli-sifre');
    expect(r.created).toBe(false);
    expect(f.calls).toEqual(['login:doruk']);
  });

  it('var olan ad + yanlış şifre: "şifre hatalı" mesajı, yeni hesap açılmaz', async () => {
    const f = fakeApi({ doruk: 'gizli-sifre' });
    await expect(enterWithName(f.api, 'Doruk', 'yanlis-sifre')).rejects.toThrow(/şifre hatalı/);
    expect(f.accounts.doruk).toBe('gizli-sifre');
  });

  it('sunucuya ulaşılamazsa hesap açmaya çalışmaz, bağlantı hatası iletilir', async () => {
    const f = fakeApi({}, { down: true });
    await expect(enterWithName(f.api, 'Doruk', 'gizli-sifre')).rejects.toThrow(/ulaşılamadı/);
    expect(f.calls).toEqual(['login:Doruk']);
  });

  it('baştaki ve sondaki boşluklar addan atılır', async () => {
    const f = fakeApi();
    const r = await enterWithName(f.api, '  Doruk ', 'gizli-sifre');
    expect(r.user.username).toBe('Doruk');
  });

  it('form denetimi: boş ad, geçersiz ad ve kısa şifre anlaşılır mesaj verir', () => {
    expect(checkEntry('', 'gizli-sifre')).toMatch(/adını yaz/);
    expect(checkEntry('ab', 'gizli-sifre')).toMatch(/3-20/);
    expect(checkEntry('çağrı', 'gizli-sifre')).toMatch(/harf/);
    expect(checkEntry('Doruk', 'kisa')).toMatch(/en az 8/);
    expect(checkEntry('Doruk_42', 'gizli-sifre')).toBeNull();
  });
});
