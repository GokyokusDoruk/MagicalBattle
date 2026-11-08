import { describe, expect, it } from 'vitest';
import { PlayerState } from '../economy/player';
import { buyPrice, sellPrice } from '../economy/shop';
import { QuestEngine } from '../quests/engine';
import { elysiaFightsAlongside, elysiaStatus } from '../story/elysia';
import { MAX_WEIGHT, MIN_WEIGHT, MORAL_CHOICES, choicesForChapter, getChoice } from './catalog';
import { finalLines } from './final';
import { ALIGNMENT_NAMES, MAX_SCORE, MIN_SCORE, Morality, choiceDelta, effectsFor, finalPathFor, tierOf } from './morality';

describe('seçim kataloğu', () => {
  it('16 seçim, her bölümde 2, kimlikler benzersiz', () => {
    expect(MORAL_CHOICES).toHaveLength(16);
    expect(new Set(MORAL_CHOICES.map((c) => c.id)).size).toBe(16);
    for (let ch = 1; ch <= 8; ch++) expect(choicesForChapter(ch)).toHaveLength(2);
  });

  it('ağırlıklar 5-15 arasında; iyi ve kötü seçeneğin ikisi de dolu', () => {
    for (const c of MORAL_CHOICES) {
      for (const o of [c.good, c.bad]) {
        expect(o.weight).toBeGreaterThanOrEqual(MIN_WEIGHT);
        expect(o.weight).toBeLessThanOrEqual(MAX_WEIGHT);
        expect(o.label.length).toBeGreaterThan(0);
        expect(o.result.length).toBeGreaterThan(0);
      }
      expect(c.intro.length).toBeGreaterThan(0);
    }
  });

  it('hepsi iyi ya da hepsi kötü seçilirse ±100 sınırına ve III. kademeye ulaşılır', () => {
    const good = MORAL_CHOICES.reduce((n, c) => n + c.good.weight, 0);
    const bad = MORAL_CHOICES.reduce((n, c) => n + c.bad.weight, 0);
    expect(good).toBeGreaterThanOrEqual(100);
    expect(bad).toBeGreaterThanOrEqual(100);
  });
});

describe('kademeler ve etkiler', () => {
  it('kademe eşikleri: 19 yok, 20 I, 50 II, 80 III (iki yönde)', () => {
    expect([0, 19, -19].map(tierOf)).toEqual([0, 0, 0]);
    expect([20, 49, -20, -49].map(tierOf)).toEqual([1, 1, 1, 1]);
    expect([50, 79, -50, -79].map(tierOf)).toEqual([2, 2, 2, 2]);
    expect([80, 100, -80, -100].map(tierOf)).toEqual([3, 3, 3, 3]);
  });

  it('Düzen Bekçisi: tüccar indirimi %5/10/15 ve görev altını +%10/20/30', () => {
    const e = (s: number) => effectsFor(s);
    expect([e(20).buyMultiplier, e(50).buyMultiplier, e(80).buyMultiplier]).toEqual([0.95, 0.9, 0.85]);
    expect([e(20).questGoldMultiplier, e(50).questGoldMultiplier, e(80).questGoldMultiplier]).toEqual([1.1, 1.2, 1.3]);
    expect(e(80).alignment).toBe('order');
    expect(e(80).sellMultiplier).toBe(1);
    expect(e(80).dropRateMultiplier).toBe(1);
  });

  it('Karanlık Büyücü: satış değeri +%5/10/15 ve düşme oranı +%10/20/30', () => {
    const e = (s: number) => effectsFor(s);
    expect([e(-20).sellMultiplier, e(-50).sellMultiplier, e(-80).sellMultiplier]).toEqual([1.05, 1.1, 1.15]);
    expect([e(-20).dropRateMultiplier, e(-50).dropRateMultiplier, e(-80).dropRateMultiplier]).toEqual([1.1, 1.2, 1.3]);
    expect(e(-80).alignment).toBe('dark');
    expect(e(-80).buyMultiplier).toBe(1);
    expect(e(-80).questGoldMultiplier).toBe(1);
  });

  it('-19..+19 arasında hiçbir etki yok', () => {
    for (const s of [-19, -5, 0, 5, 19]) {
      expect(effectsFor(s)).toMatchObject({ alignment: 'neutral', tier: 0, buyMultiplier: 1, sellMultiplier: 1, questGoldMultiplier: 1, dropRateMultiplier: 1 });
    }
  });

  it('etiket kademeyi gösterir', () => {
    expect(effectsFor(55).label).toBe(`${ALIGNMENT_NAMES.order} II`);
    expect(effectsFor(-85).label).toBe(`${ALIGNMENT_NAMES.dark} III`);
  });

  it('final yolu: 0 ve üstü Düzen Bekçisi, altı Karanlık Büyücü', () => {
    expect(finalPathFor(0)).toBe('order');
    expect(finalPathFor(1)).toBe('order');
    expect(finalPathFor(-1)).toBe('dark');
  });
});

describe('Morality', () => {
  it('puan 0 ile başlar ve seçime göre ağırlığı kadar değişir', () => {
    const m = new Morality();
    expect(m.score).toBe(0);
    m.choose('c1-isciler', 'good');
    expect(m.score).toBe(getChoice('c1-isciler')!.good.weight);
    m.choose('c1-nobetci', 'bad');
    expect(m.score).toBe(getChoice('c1-isciler')!.good.weight - getChoice('c1-nobetci')!.bad.weight);
  });

  it('her seçim yalnız bir kez yapılır, bilinmeyen kimlik kabul edilmez', () => {
    const m = new Morality();
    expect(m.choose('c1-isciler', 'good')).toBe(true);
    expect(m.choose('c1-isciler', 'bad')).toBe(false);
    expect(m.decided('c1-isciler')).toBe('good');
    expect(m.choose('yok', 'good')).toBe(false);
    expect(m.choose('c1-nobetci', 'tarafsiz' as 'good')).toBe(false);
  });

  it('tüm seçimler iyi: +100 sınırında kalır; tüm kötü: -100', () => {
    const good = new Morality();
    const bad = new Morality();
    for (const c of MORAL_CHOICES) {
      good.choose(c.id, 'good');
      bad.choose(c.id, 'bad');
    }
    expect(good.score).toBe(MAX_SCORE);
    expect(bad.score).toBe(MIN_SCORE);
    expect(good.effects.tier).toBe(3);
    expect(bad.finalPath).toBe('dark');
  });

  it('tarafsız seçim yoktur: her seçim puanı sıfırdan farklı kılar', () => {
    for (const c of MORAL_CHOICES) {
      expect(choiceDelta(c.id, 'good')).toBeGreaterThan(0);
      expect(choiceDelta(c.id, 'bad')).toBeLessThan(0);
    }
  });

  it('daha çok iyi seçim daha güçlü etki verir', () => {
    const m = new Morality();
    const tiers: number[] = [];
    for (const c of MORAL_CHOICES) {
      m.choose(c.id, 'good');
      tiers.push(m.effects.tier);
    }
    expect(tiers).toEqual([...tiers].sort((a, b) => a - b)); // azalmaz
    expect(tiers[tiers.length - 1]).toBe(3);
  });

  it('bekleyen seçimler bölüm bölüm listelenir', () => {
    const m = new Morality();
    expect(m.pending(3)).toEqual(['c3-bekci', 'c3-emanet']);
    m.choose('c3-bekci', 'good');
    expect(m.pending(3)).toEqual(['c3-emanet']);
  });

  it('kayıt bire bir geri yüklenir; bozuk kayıt temizlenir', () => {
    const m = new Morality();
    m.choose('c2-koyluler', 'good');
    m.choose('c4-aile', 'bad');
    const other = new Morality();
    other.restore(m.snapshot());
    expect(other.snapshot()).toEqual(m.snapshot());
    expect(other.score).toBe(m.score);

    other.restore({ 'c1-isciler': 'good', sahte: 'good', 'c1-nobetci': 'belki' });
    expect(other.snapshot()).toEqual({ 'c1-isciler': 'good' });
    other.restore(undefined);
    expect(other.snapshot()).toEqual({});
  });

  it('değişince dinleyicilere haber verir', () => {
    const m = new Morality();
    let n = 0;
    m.onChange(() => n++);
    m.choose('c1-isciler', 'good');
    m.choose('c1-isciler', 'bad'); // reddedilir, haber yok
    expect(n).toBe(1);
  });
});

describe('final ve Elysia', () => {
  it('final satırları yola ve kademeye göre değişir', () => {
    const texts = [-90, -60, -30, -5, 0, 30, 60, 90].map((s) => finalLines(s)[0].text);
    expect(new Set(texts).size).toBe(8);
    expect(finalLines(10)[1].text).toContain('2v2');
    expect(finalLines(-10)[1].text).toContain('tek başına');
  });

  it('Elysia seyri: 3. bölümde katılır, 4-6 yok, 7 kurtarılır, 8 yola göre', () => {
    expect(elysiaStatus(1)).toBe('meeting');
    expect(elysiaStatus(3)).toBe('ally');
    expect(elysiaStatus(5)).toBe('captured');
    expect(elysiaStatus(7)).toBe('rescued');
    expect(elysiaStatus(8, 'order')).toBe('ally');
    expect(elysiaStatus(8, 'dark')).toBe('betrayed');
  });

  it('2v2 yalnız 3. bölümde ve Düzen Bekçisi yolunda 8. bölümde', () => {
    const fights = [1, 2, 3, 4, 5, 6, 7].filter((c) => elysiaFightsAlongside(c));
    expect(fights).toEqual([3]);
    expect(elysiaFightsAlongside(8, 'order')).toBe(true);
    expect(elysiaFightsAlongside(8, 'dark')).toBe(false);
  });
});

describe('ekonomi ve görevlere bağlantı', () => {
  it('Düzen Bekçisi indirimi tüccar alış fiyatını düşürür, görev altını artırır', () => {
    const m = new Morality();
    for (const c of MORAL_CHOICES.slice(0, 8)) m.choose(c.id, 'good');
    const e = m.effects;
    expect(e.tier).toBeGreaterThanOrEqual(2);
    expect(buyPrice(100, e.buyMultiplier)).toBeLessThan(100);
    expect(sellPrice(100, e.sellMultiplier)).toBe(sellPrice(100)); // satış değişmez

    const player = new PlayerState();
    const quests = new QuestEngine(player);
    quests.goldMultiplier = e.questGoldMultiplier;
    quests.accept('ash-ignis-yolu');
    const [c] = quests.onEvent({ type: 'visit', locationId: 'ignis' });
    expect(c.gold).toBe(Math.round(90 * e.questGoldMultiplier));
    expect(c.xp).toBe(60);
  });

  it('Karanlık Büyücü satış değerini artırır, alış fiyatı ve görev altını değişmez', () => {
    const m = new Morality();
    for (const c of MORAL_CHOICES.slice(0, 8)) m.choose(c.id, 'bad');
    const e = m.effects;
    expect(e.alignment).toBe('dark');
    expect(sellPrice(100, e.sellMultiplier)).toBeGreaterThan(sellPrice(100));
    expect(buyPrice(100, e.buyMultiplier)).toBe(100);
    expect(e.questGoldMultiplier).toBe(1);
    expect(e.dropRateMultiplier).toBeGreaterThan(1);
  });
});
