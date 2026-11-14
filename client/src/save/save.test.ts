import { describe, expect, it } from 'vitest';
import { ApiClient, ApiError, REQUEST_TIMEOUT_MS, resolveApiUrl } from '../api/client';
import { Progress } from '../story/progress';
import { GateRegistry } from '../world/gates';
import { LOCATIONS, getLocation } from '../world/locations';
import { QuestTracker } from '../world/questMarkers';
import { CityEntryTracker, cityAt } from './cityEntry';
import { SAVE_VERSION, buildSave, normalizeSave, savePointForCity, validatePlayerName, type SaveData } from './saveData';
import { SaveManager } from './saveManager';

const progressWith = (...chapters: number[]) => {
  const p = new Progress(new GateRegistry(), new QuestTracker());
  chapters.forEach((c) => p.completeChapter(c));
  return p;
};

describe('oyuncu adı', () => {
  it('geçerli adları kabul eder', () => {
    expect(validatePlayerName('Aylin')).toBeNull();
    expect(validatePlayerName('Gökçe Çağrı')).toBeNull();
    expect(validatePlayerName('  Ay  ')).toBeNull();
  });

  it('kısa, uzun ve özel karakterli adları reddeder', () => {
    expect(validatePlayerName('A')).not.toBeNull();
    expect(validatePlayerName(' A ')).not.toBeNull();
    expect(validatePlayerName('x'.repeat(21))).not.toBeNull();
    expect(validatePlayerName('<b>')).not.toBeNull();
  });
});

describe('kayıt verisi', () => {
  it('buildSave adı kırpar ve diziyi kopyalar', () => {
    const chapters = [1, 2];
    const s = buildSave('  Aylin ', chapters, null);
    expect(s).toEqual({
      version: SAVE_VERSION,
      playerName: 'Aylin',
      completedChapters: [1, 2],
      savePoint: null,
      gold: 0,
      xp: 0,
      hp: null,
      items: {},
      equipped: {},
      quests: {},
      collected: [],
      skills: [],
      wands: {},
      wandEquipped: null,
      choices: {},
    });
    chapters.push(3);
    expect(s.completedChapters).toEqual([1, 2]);
  });

  it('kayıt noktası şehrin kapısının iç tarafında ve yürünebilir bölgededir', () => {
    const ignis = getLocation('ignis');
    const p = savePointForCity(ignis);
    expect(p).toEqual({ cityId: 'ignis', tileX: ignis.x, tileY: ignis.y + 4 });
    expect(cityAt(LOCATIONS, p.tileX, p.tileY)).toBe('ignis');
  });
});

describe('kayıt v2: ekonomi, görevler, toplananlar', () => {
  const extras = {
    economy: { gold: 250, xp: 320, items: { 'sifali-ot': 4 }, equipped: { robe: 'cirak-cuppesi' as const } },
    quests: { 'ash-ot-toplama': { status: 'active' as const, progress: 2 } },
    collected: ['p-herb-0'],
    skills: ['fire-power-1'],
    wands: { wands: { 'wand-fire-attack-2-5': 1 }, wandEquipped: 'wand-fire-attack-2-5' },
    choices: { 'c1-isciler': 'good' as const },
  };

  it('buildSave ekonomi alanlarını taşır ve girdiyi kopyalar', () => {
    const s = buildSave('Aylin', [1], null, extras);
    expect(s).toMatchObject({ gold: 250, xp: 320, items: { 'sifali-ot': 4 }, equipped: { robe: 'cirak-cuppesi' }, collected: ['p-herb-0'], skills: ['fire-power-1'], wands: { 'wand-fire-attack-2-5': 1 }, wandEquipped: 'wand-fire-attack-2-5', choices: { 'c1-isciler': 'good' } });
    expect(s.quests['ash-ot-toplama']).toEqual({ status: 'active', progress: 2 });
    extras.economy.items['sifali-ot'] = 99;
    extras.collected.push('x');
    expect(s.items['sifali-ot']).toBe(4);
    expect(s.collected).toEqual(['p-herb-0']);
    extras.economy.items['sifali-ot'] = 4;
    extras.collected.pop();
  });

  it('SaveManager her kayıtta güncel ekonomi durumunu okur', async () => {
    const written: SaveData[] = [];
    let gold = 10;
    const m = new SaveManager(
      { putSave: async (d) => void written.push(d) },
      progressWith(),
      'Aylin',
      () => ({ economy: { gold, xp: 0, items: {}, equipped: {} }, quests: {}, collected: [], skills: [], wands: { wands: {}, wandEquipped: null }, choices: {} }),
    );
    await m.saveAt(null);
    gold = 99;
    await m.saveAt(null);
    expect(written.map((w) => w.gold)).toEqual([10, 99]);
  });

  it('normalizeSave eksik alanları varsayılanla doldurur (eski sunucu v1 dönse bile)', () => {
    const s = normalizeSave({ playerName: 'Aylin', completedChapters: [1] });
    expect(s).toMatchObject({ version: 7, hp: null, savePoint: null, gold: 0, xp: 0, items: {}, equipped: {}, quests: {}, collected: [], skills: [], wands: {}, wandEquipped: null, choices: {} });
  });
});

describe('cityAt ve CityEntryTracker', () => {
  const ignis = getLocation('ignis');

  it('sur içini şehir sayar, duvarı ve dışını saymaz', () => {
    expect(cityAt(LOCATIONS, ignis.x, ignis.y)).toBe('ignis');
    expect(cityAt(LOCATIONS, ignis.x + 5, ignis.y + 5)).toBe('ignis');
    expect(cityAt(LOCATIONS, ignis.x + 6, ignis.y)).toBeNull(); // duvar karosu
    expect(cityAt(LOCATIONS, ignis.x, ignis.y + 9)).toBeNull(); // kapının önü
  });

  it('köyler kayıt noktası değildir', () => {
    const ash = getLocation('ash');
    expect(cityAt(LOCATIONS, ash.x, ash.y)).toBeNull();
  });

  it('yalnızca şehre yeni girildiği anı bildirir', () => {
    const t = new CityEntryTracker();
    expect(t.update(null)).toBeNull();
    expect(t.update('ignis')).toBe('ignis');
    expect(t.update('ignis')).toBeNull();
    expect(t.update(null)).toBeNull();
    expect(t.update('ignis')).toBe('ignis'); // çıkıp tekrar girince yine
  });

  it('şehrin içinde başlanırsa ilk karede giriş sayılmaz', () => {
    const t = new CityEntryTracker('ignis');
    expect(t.update('ignis')).toBeNull();
  });
});

describe('SaveManager', () => {
  const point = { cityId: 'ignis', tileX: 64, tileY: 62 };

  it('ilerlemeyi ve kayıt noktasını yazar', async () => {
    const written: SaveData[] = [];
    const m = new SaveManager({ putSave: async (d) => void written.push(d) }, progressWith(1), 'Aylin');
    expect(await m.saveAt(point)).toBe('saved');
    expect(written).toEqual([
      { version: 7, playerName: 'Aylin', completedChapters: [1], savePoint: point, gold: 0, xp: 0, hp: null, items: {}, equipped: {}, quests: {}, collected: [], skills: [], wands: {}, wandEquipped: null, choices: {} },
    ]);
  });

  it('api yoksa (kayıtsız mod) hiçbir şey yazmaz', async () => {
    const m = new SaveManager(null, progressWith(), 'Aylin');
    expect(m.enabled).toBe(false);
    expect(await m.saveAt(point)).toBe('disabled');
  });

  it('yazma hatasında failed döner ve sonraki kayıt yine çalışır', async () => {
    let fail = true;
    const m = new SaveManager(
      {
        putSave: async () => {
          if (fail) throw new Error('ağ');
        },
      },
      progressWith(),
      'Aylin',
    );
    expect(await m.saveAt(point)).toBe('failed');
    fail = false;
    expect(await m.saveAt(point)).toBe('saved');
  });

  it('eşzamanlı kayıtlar sırayla yazılır (sonraki, öncekini ezmez)', async () => {
    const order: string[] = [];
    const p = progressWith();
    const m = new SaveManager(
      {
        putSave: async (d) => {
          await new Promise((r) => setTimeout(r, d.completedChapters.length === 0 ? 30 : 1));
          order.push(`yazıldı:${d.completedChapters.length}`);
        },
      },
      p,
      'Aylin',
    );
    const first = m.saveAt(point); // yavaş, 0 bölüm
    p.completeChapter(1);
    const second = m.saveAt(point); // hızlı, 1 bölüm
    await Promise.all([first, second]);
    expect(order).toEqual(['yazıldı:0', 'yazıldı:1']);
  });
});

describe('ApiClient', () => {
  const json = (status: number, body: unknown) =>
    Promise.resolve(new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } }));

  it('adresi çözer: ortam değişkeni, dorukplays.com, yerel', () => {
    expect(resolveApiUrl('localhost')).toBe('http://localhost:3000');
    expect(resolveApiUrl('magicalbattle.dorukplays.com')).toBe('https://api.dorukplays.com');
    expect(resolveApiUrl('dorukplays.com')).toBe('https://api.dorukplays.com');
    expect(resolveApiUrl('kotudorukplays.com')).toBe('http://localhost:3000');
    expect(resolveApiUrl('x.com', 'https://api.test/')).toBe('https://api.test');
  });

  it('çerezli ve JSON gövdeli istek gönderir', async () => {
    let seen: { url: string; init?: RequestInit } | undefined;
    const api = new ApiClient('https://api.test', (url, init) => {
      seen = { url, init };
      return json(200, { user: { id: '1', username: 'a', isGuest: true, firstName: null } });
    });
    await api.guest('misafir1', 'misafir-sifre');
    expect(seen?.url).toBe('https://api.test/auth/guest');
    expect(seen?.init?.credentials).toBe('include');
    expect(seen?.init?.method).toBe('POST');
    expect(JSON.parse(seen!.init!.body as string)).toEqual({ username: 'misafir1', password: 'misafir-sifre' });
  });

  it('me(): 401 → null, diğer hatalar fırlatılır', async () => {
    const noSession = new ApiClient('x', () => json(401, { code: 'NO_SESSION', error: 'yok' }));
    expect(await noSession.me()).toBeNull();
    const broken = new ApiClient('x', () => json(500, { code: 'SERVER_ERROR', error: 'hata' }));
    await expect(broken.me()).rejects.toMatchObject({ status: 500 });
  });

  it('sunucunun Türkçe hata mesajını ve kodunu taşır', async () => {
    const api = new ApiClient('x', () => json(409, { code: 'USERNAME_TAKEN', error: 'Bu kullanıcı adı alınmış.' }));
    const err = await api.login('a', 'b').catch((e) => e);
    expect(err).toBeInstanceOf(ApiError);
    expect(err).toMatchObject({ status: 409, code: 'USERNAME_TAKEN', message: 'Bu kullanıcı adı alınmış.' });
  });

  it('ağ hatasında status 0 ve anlaşılır mesaj verir', async () => {
    const api = new ApiClient('x', () => Promise.reject(new TypeError('Failed to fetch')));
    const err = (await api.getSave().catch((e) => e)) as ApiError;
    expect(err.isNetwork).toBe(true);
    expect(err.message).toMatch(/ulaşılamadı/);
  });

  it('cevap vermeyen sunucuda zaman aşımıyla ağ hatası verir (boş ekranda kalmaz)', async () => {
    let signal: AbortSignal | undefined;
    // Hiç dönmeyen istek: yalnızca iptal sinyaliyle biter
    const api = new ApiClient('x', (_url, init) => {
      signal = init?.signal ?? undefined;
      return new Promise((_resolve, reject) => signal?.addEventListener('abort', () => reject(new DOMException('zaman aşımı', 'TimeoutError'))));
    });
    const started = Date.now();
    const err = (await api.me().catch((e) => e)) as ApiError;
    expect(signal).toBeDefined();
    expect(err.isNetwork).toBe(true);
    expect(Date.now() - started).toBeLessThan(REQUEST_TIMEOUT_MS + 2000);
  }, 15000);

  it('getSave kaydı ya da null döndürür', async () => {
    const api = new ApiClient('x', () => json(200, { save: null }));
    expect(await api.getSave()).toBeNull();
  });
});
