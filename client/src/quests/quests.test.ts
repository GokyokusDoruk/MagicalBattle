import { describe, expect, it } from 'vitest';
import { getItem } from '../economy/items';
import { MERCHANTS } from '../economy/merchants';
import { PlayerState } from '../economy/player';
import { LOCATIONS } from '../world/locations';
import { SIDE_QUESTS, getQuest, type QuestDef } from './catalog';
import { QuestEngine } from './engine';
import { TEST_QUESTS } from './testQuests';

const make = (catalog: readonly QuestDef[] = TEST_QUESTS) => {
  const player = new PlayerState();
  return { player, quests: new QuestEngine(player, catalog) };
};

describe('görev kataloğu', () => {
  it('kimlikler benzersiz, her görev bir şehir hanında ya da köyün görev verenin elinde', () => {
    expect(new Set(SIDE_QUESTS.map((q) => q.id)).size).toBe(SIDE_QUESTS.length);
    for (const q of SIDE_QUESTS) {
      expect(MERCHANTS.some((m) => (m.kind === 'innkeeper' || m.kind === 'questgiver') && m.locationId === q.giver), q.id).toBe(true);
      expect(q.title.length).toBeGreaterThan(0);
      expect(q.description.length).toBeGreaterThan(20);
    }
  });

  it('hedefler ve ödüller geçerli: bilinen eşya/konum, pozitif sayılar', () => {
    for (const q of SIDE_QUESTS) {
      const o = q.objective;
      if (o.type === 'collect') {
        expect(getItem(o.itemId), q.id).toBeDefined();
        expect(o.count).toBeGreaterThan(0);
      }
      if (o.type === 'visit') expect(LOCATIONS.some((l) => l.id === o.locationId), q.id).toBe(true);
      expect(q.reward.money).toBeGreaterThan(0);
      expect(q.reward.xp).toBeGreaterThan(0);
      for (const it of q.reward.items ?? []) expect(getItem(it.id), `${q.id} ödülü`).toBeDefined();
    }
  });

  it('görevler şehir tüccarlarına dağıtılmış (tüccar olmayan asacıdan görev çıkmaz)', () => {
    const givers = new Set(SIDE_QUESTS.map((q) => q.giver));
    expect(givers.size).toBeGreaterThanOrEqual(4);
    expect(givers.has('still-crystal')).toBe(true);
    for (const city of ['ignis', 'abyss', 'stone-heart', 'still-crystal']) expect(SIDE_QUESTS.filter((q) => q.giver === city).length, city).toBeGreaterThanOrEqual(2);
  });

  it('getQuest kimlikle bulur', () => {
    expect(getQuest('ignis-kor-avi')?.title).toBe('Köz Avı');
    expect(getQuest('yok')).toBeUndefined();
  });
});

describe('QuestEngine: kabul', () => {
  it('görev kabul edilince aktif olur, ilerleme 0', () => {
    const { quests } = make();
    expect(quests.view('ash-ot-toplama')).toBe('available');
    expect(quests.accept('ash-ot-toplama')).toEqual({ ok: true, completion: undefined });
    expect(quests.view('ash-ot-toplama')).toBe('active');
    expect(quests.progress('ash-ot-toplama')).toEqual({ value: 0, target: 5 });
    expect(quests.active().map((q) => q.id)).toEqual(['ash-ot-toplama']);
  });

  it('ikinci kez kabul, bilinmeyen görev ve yetersiz seviye reddedilir', () => {
    const { quests, player } = make();
    quests.accept('ash-ot-toplama');
    expect(quests.accept('ash-ot-toplama')).toMatchObject({ ok: false });
    expect(quests.accept('yok')).toMatchObject({ ok: false });
    expect(quests.view('marsh-ot-sepeti')).toBe('locked');
    expect(quests.accept('marsh-ot-sepeti')).toMatchObject({ ok: false, reason: expect.stringContaining('2. seviye') });
    player.addXp(100);
    expect(quests.view('marsh-ot-sepeti')).toBe('available');
    expect(quests.accept('marsh-ot-sepeti')).toMatchObject({ ok: true });
  });

  it('köye göre görevler listelenir', () => {
    const { quests } = make();
    expect(quests.forGiver('ignis').every((q) => q.giver === 'ignis')).toBe(true);
    expect(quests.forGiver('yok')).toEqual([]);
  });
});

describe('QuestEngine: ilerleme ve otomatik ödül', () => {
  it('eşya toplayınca ilerler, hedefe varınca ödül KENDİLİĞİNDEN yatar (teslim yok)', () => {
    const { quests, player } = make();
    quests.accept('ash-ot-toplama');
    player.addItem('tas-cevheri', 3);
    expect(quests.onEvent({ type: 'collect' })).toEqual([]);
    expect(quests.progress('ash-ot-toplama').value).toBe(3);
    expect(player.balance('kor')).toBe(0);

    player.addItem('tas-cevheri', 2);
    const done = quests.onEvent({ type: 'collect' });
    expect(done).toHaveLength(1);
    expect(done[0]).toMatchObject({ money: 60, xp: 40 });
    expect(player.balance('kor')).toBe(60);
    expect(player.xp).toBe(40);
    expect(quests.view('ash-ot-toplama')).toBe('completed');
  });

  it('görev eşyaları tüketmez: toplanan ot çantada kalır, satılabilir', () => {
    const { quests, player } = make();
    quests.accept('ash-ot-toplama');
    player.addItem('tas-cevheri', 5);
    quests.onEvent({ type: 'collect' });
    expect(player.count('tas-cevheri')).toBe(5);
  });

  it('ilerleme geri gitmez: eşyayı satmak biriken ilerlemeyi silmez', () => {
    const { quests, player } = make();
    quests.accept('ash-ot-toplama');
    player.addItem('tas-cevheri', 4);
    quests.onEvent({ type: 'collect' });
    player.removeItem('tas-cevheri', 4);
    quests.onEvent({ type: 'collect' });
    expect(quests.progress('ash-ot-toplama').value).toBe(4);
    player.addItem('tas-cevheri', 1); // satıştan sonra toplanan yeni ot sayılır: 4 + 1
    expect(quests.onEvent({ type: 'collect' })).toHaveLength(1);
  });

  it('aynı otu satıp tekrar toplamak ilerlemeyi şişirmez: yalnızca gerçek artış sayılır', () => {
    const { quests, player } = make();
    quests.accept('ash-ot-toplama');
    player.addItem('tas-cevheri', 2);
    quests.onEvent({ type: 'collect' });
    expect(quests.progress('ash-ot-toplama').value).toBe(2);
    quests.onEvent({ type: 'collect' }); // aynı çanta, ikinci olay: ilerleme artmaz
    quests.onEvent({ type: 'collect' });
    expect(quests.progress('ash-ot-toplama').value).toBe(2);
  });

  it('kabul etmeden önce toplanan eşya sayılır: çantada yeterli varsa kabul anında tamamlanır', () => {
    const { quests, player } = make();
    player.addItem('tas-cevheri', 6);
    const r = quests.accept('ash-ot-toplama');
    expect(r).toMatchObject({ ok: true, completion: { money: 60 } });
    expect(player.balance('kor')).toBe(60);
    expect(quests.view('ash-ot-toplama')).toBe('completed');
  });

  it('ödül eşyaları da yatar, seviye atlanırsa bildirilir', () => {
    const { quests, player } = make();
    player.addXp(90);
    quests.accept('ash-ignis-yolu');
    const [c] = quests.onEvent({ type: 'visit', locationId: 'ignis' });
    expect(player.count('kor-baharati')).toBe(2);
    expect(c.items).toEqual([{ id: 'kor-baharati', count: 2 }]);
    expect(c.levelsGained).toBe(1);
    expect(player.level).toBe(2);
  });

  it('konum görevi yalnızca doğru konuma varınca ve aktifken tamamlanır', () => {
    const { quests } = make();
    expect(quests.onEvent({ type: 'visit', locationId: 'ignis' })).toEqual([]); // kabul edilmemiş
    quests.accept('ash-ignis-yolu');
    expect(quests.onEvent({ type: 'visit', locationId: 'abyss' })).toEqual([]);
    expect(quests.onEvent({ type: 'visit', locationId: 'ignis' })).toHaveLength(1);
  });

  it('tamamlanan görev bir daha ödül vermez, tekrar kabul edilemez', () => {
    const { quests, player } = make();
    quests.accept('ash-ignis-yolu');
    quests.onEvent({ type: 'visit', locationId: 'ignis' });
    const gold = player.balance('kor');
    expect(quests.onEvent({ type: 'visit', locationId: 'ignis' })).toEqual([]);
    expect(player.balance('kor')).toBe(gold);
    expect(quests.accept('ash-ignis-yolu')).toMatchObject({ ok: false });
  });

  it('aynı olayla birden çok görev birlikte tamamlanabilir', () => {
    const catalog: QuestDef[] = [
      { id: 'a', title: 'A', giver: 'ignis', description: 'x'.repeat(30), objective: { type: 'visit', locationId: 'ignis' }, reward: { money: 10, xp: 5 } },
      { id: 'b', title: 'B', giver: 'ignis', description: 'x'.repeat(30), objective: { type: 'visit', locationId: 'ignis' }, reward: { money: 20, xp: 5 } },
    ];
    const { quests, player } = make(catalog);
    quests.accept('a');
    quests.accept('b');
    expect(quests.onEvent({ type: 'visit', locationId: 'ignis' })).toHaveLength(2);
    expect(player.balance('kor')).toBe(30);
  });

  it('savaş görevi: her zaferde ilerler', () => {
    const catalog: QuestDef[] = [
      { id: 'w', title: 'W', giver: 'ash', description: 'x'.repeat(30), objective: { type: 'battleWon', count: 2 }, reward: { money: 50, xp: 10 } },
    ];
    const { quests } = make(catalog);
    quests.accept('w');
    expect(quests.onEvent({ type: 'battleWon' })).toEqual([]);
    expect(quests.progress('w').value).toBe(1);
    expect(quests.onEvent({ type: 'battleWon' })).toHaveLength(1);
  });

  it('ahlak altın çarpanı yalnızca altını etkiler', () => {
    const { quests, player } = make();
    quests.moneyMultiplier = 1.5;
    quests.accept('ash-ignis-yolu');
    const [c] = quests.onEvent({ type: 'visit', locationId: 'ignis' });
    expect(c.money).toBe(135);
    expect(c.xp).toBe(60);
    expect(player.balance(c.currency)).toBe(135);
  });

  it('dinleyiciler değişimde çağrılır', () => {
    const { quests } = make();
    let n = 0;
    quests.onChange(() => n++);
    quests.accept('ash-ot-toplama');
    quests.onEvent({ type: 'collect' });
    expect(n).toBe(2);
  });
});

describe('QuestEngine: kayıt', () => {
  it('snapshot/restore ilerlemeyi ve tamamlananları korur, ödülü ikinci kez vermez', () => {
    const a = make();
    a.player.addItem('tas-cevheri', 2);
    a.quests.accept('ash-ot-toplama');
    a.quests.onEvent({ type: 'collect' });
    a.quests.accept('ash-ignis-yolu');
    a.quests.onEvent({ type: 'visit', locationId: 'ignis' });
    const saved = a.quests.snapshot();

    const b = make();
    b.player.restore(a.player.snapshot()); // önce oyuncu, sonra görevler
    const goldBefore = b.player.balance('kor');
    b.quests.restore(saved);
    expect(b.quests.view('ash-ot-toplama')).toBe('active');
    expect(b.quests.progress('ash-ot-toplama').value).toBe(2);
    expect(b.quests.view('ash-ignis-yolu')).toBe('completed');
    expect(b.player.balance('kor')).toBe(goldBefore); // restore ödülü ikinci kez yatırmaz
  });

  it('restore bozuk kaydı temizler: bilinmeyen görev, geçersiz durum, taşan ilerleme', () => {
    const { quests } = make();
    quests.restore({
      'ash-ot-toplama': { status: 'active', progress: 99 },
      'sahte-gorev': { status: 'active', progress: 1 },
      'ash-ignis-yolu': { status: 'bitti' as never, progress: 1 },
      'vine-kristal-avi': { status: 'active', progress: -4 },
    });
    expect(quests.progress('ash-ot-toplama').value).toBe(5);
    expect(quests.view('sahte-gorev')).not.toBe('active');
    expect(quests.view('ash-ignis-yolu')).toBe('available');
    expect(quests.progress('vine-kristal-avi').value).toBe(0);
    quests.restore(undefined);
    expect(quests.snapshot()).toEqual({});
  });
});

describe('yeni hedefler: teslimat, maden, sandık', () => {
  const deliver: QuestDef = { id: 'd', title: 'D', giver: 'ignis', description: 'x'.repeat(30), objective: { type: 'deliver', itemId: 'kor-baharati', count: 3, locationId: 'abyss' }, reward: { money: 50, xp: 10 } };

  it('teslimat: yeterli malla hedef şehre varınca mal alınır ve görev biter', () => {
    const { quests, player } = make([deliver]);
    quests.accept('d');
    player.addItem('kor-baharati', 4);
    expect(quests.onEvent({ type: 'visit', locationId: 'ignis' })).toHaveLength(0); // yanlış şehir
    const done = quests.onEvent({ type: 'visit', locationId: 'abyss' });
    expect(done).toHaveLength(1);
    expect(player.count('kor-baharati')).toBe(1); // 3 teslim edildi
    expect(player.balance('kor')).toBe(50); // ödül görevi veren şehrin (Ignis) biriminde
  });

  it('teslimat: mal yetmiyorsa varınca bir şey olmaz, sonra malla gelince biter', () => {
    const { quests, player } = make([deliver]);
    quests.accept('d');
    player.addItem('kor-baharati', 2);
    expect(quests.onEvent({ type: 'visit', locationId: 'abyss' })).toHaveLength(0);
    expect(player.count('kor-baharati')).toBe(2); // alınmadı
    expect(quests.progress('d').value).toBe(0);
    player.addItem('kor-baharati', 1);
    expect(quests.onEvent({ type: 'visit', locationId: 'abyss' })).toHaveLength(1);
    expect(player.count('kor-baharati')).toBe(0);
  });

  it('maden ve sandık görevleri ilgili olayla ilerler, başka olayla ilerlemez', () => {
    const catalog: QuestDef[] = [
      { id: 'm', title: 'M', giver: 'stone-heart', description: 'x'.repeat(30), objective: { type: 'mine', count: 2 }, reward: { money: 10, xp: 5 } },
      { id: 'c', title: 'C', giver: 'abyss', description: 'x'.repeat(30), objective: { type: 'chest', count: 1 }, reward: { money: 10, xp: 5 } },
    ];
    const { quests, player } = make(catalog);
    quests.accept('m');
    quests.accept('c');
    expect(quests.onEvent({ type: 'battleWon' })).toHaveLength(0);
    expect(quests.onEvent({ type: 'mineCleared' })).toHaveLength(0);
    expect(quests.progress('m')).toEqual({ value: 1, target: 2 });
    expect(quests.onEvent({ type: 'chestOpened' }).map((c) => c.quest.id)).toEqual(['c']);
    expect(quests.onEvent({ type: 'mineCleared' }).map((c) => c.quest.id)).toEqual(['m']);
    expect(player.balance('tunc')).toBe(10);
    expect(player.balance('tuy')).toBe(10);
  });

  it('gerçek katalog: teslimat görevlerinde mal ve hedef şehir geçerli, hedef verenden farklı', () => {
    const delivers = SIDE_QUESTS.filter((q) => q.objective.type === 'deliver');
    expect(delivers.length).toBeGreaterThanOrEqual(3);
    for (const q of delivers) {
      const o = q.objective as Extract<QuestDef['objective'], { type: 'deliver' }>;
      expect(getItem(o.itemId), q.id).toBeDefined();
      expect(LOCATIONS.some((l) => l.id === o.locationId && l.kind === 'city'), q.id).toBe(true);
      expect(o.locationId).not.toBe(q.giver);
    }
    expect(SIDE_QUESTS.some((q) => q.objective.type === 'mine')).toBe(true);
    expect(SIDE_QUESTS.some((q) => q.objective.type === 'chest')).toBe(true);
  });
});
