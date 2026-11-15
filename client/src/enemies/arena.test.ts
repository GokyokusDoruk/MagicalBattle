import { describe, expect, it } from 'vitest';
import { generateMap, reachableSet, tileAt } from '../world/generateMap';
import { isBlockedTile } from '../world/tiles';
import { mulberry32 } from '../world/rng';
import { ARENA_SPOTS, ARENA_STAGES, ARENA_WIN_MULTIPLIERS, arenaFoes, arenaMoneyXp, arenaPayout } from './arena';
import { MINE_SPOTS, MineBoard } from './mines';
import { ENEMY_SPOTS } from './spots';

const map = generateMap();

describe('arena yerleşimi', () => {
  it('her şehrin yanında bir arena; yürünebilir, ulaşılabilir ve diğer yerlerden uzak', () => {
    expect(ARENA_SPOTS).toHaveLength(map.locations.filter((l) => l.kind === 'city').length);
    expect(new Set(ARENA_SPOTS.map((a) => a.id)).size).toBe(ARENA_SPOTS.length);
    const reachable = reachableSet(map, map.spawn);
    for (const a of ARENA_SPOTS) {
      expect(isBlockedTile(tileAt(map, a.tileX, a.tileY)), a.id).toBe(false);
      expect(reachable.has(a.tileY * map.width + a.tileX), a.id).toBe(true);
      for (const m of MINE_SPOTS) expect(Math.hypot(m.tileX - a.tileX, m.tileY - a.tileY), `${a.id}/${m.id}`).toBeGreaterThanOrEqual(5);
      for (const e of ENEMY_SPOTS) expect(Math.hypot(e.tileX - a.tileX, e.tileY - a.tileY), `${a.id}/${e.id}`).toBeGreaterThanOrEqual(5);
    }
  });

  it('beş rakip: kademe düşmez, en çok 4, elementler karışık', () => {
    for (const a of ARENA_SPOTS) {
      const foes = arenaFoes(map, a);
      expect(foes).toHaveLength(ARENA_STAGES);
      for (let i = 1; i < foes.length; i++) expect(foes[i].tier).toBeGreaterThanOrEqual(foes[i - 1].tier);
      for (const f of foes) expect(f.tier).toBeLessThanOrEqual(4);
      expect(new Set(foes.map((f) => f.element)).size).toBeGreaterThanOrEqual(4);
      expect(new Set(foes.map((f) => f.id)).size).toBe(ARENA_STAGES);
    }
  });
});

describe('arena ödülü', () => {
  const arena = ARENA_SPOTS[0];
  const foes = arenaFoes(map, arena);
  const level = 5;

  it('galibiyet yoksa ödeme boş; para ve XP her galibiyetle artar', () => {
    const none = arenaPayout(foes, 0, level, 1, mulberry32(1));
    expect(none).toMatchObject({ wins: 0, money: 0, xp: 0 });
    expect(Object.keys(none.loot.items)).toHaveLength(0);
    let prev = 0;
    for (let w = 1; w <= ARENA_STAGES; w++) {
      const p = arenaMoneyXp(foes, w, level);
      expect(p.money).toBeGreaterThan(prev);
      prev = p.money;
    }
  });

  it('her galibiyetin ödülü bir öncekinden büyüktür (çarpanlar artıyor)', () => {
    for (let i = 1; i < ARENA_WIN_MULTIPLIERS.length; i++) expect(ARENA_WIN_MULTIPLIERS[i]).toBeGreaterThan(ARENA_WIN_MULTIPLIERS[i - 1]);
    const gain = (w: number) => arenaMoneyXp(foes, w, level).money - arenaMoneyXp(foes, w - 1, level).money;
    for (let w = 2; w <= ARENA_STAGES; w++) expect(gain(w)).toBeGreaterThan(gain(w - 1));
  });

  it('5/5 yarım ödülden çok daha değerli: son galibiyet tek başına büyük pay alır', () => {
    const all = arenaMoneyXp(foes, 5, level).money;
    const four = arenaMoneyXp(foes, 4, level).money;
    expect(all).toBeGreaterThan(four * 1.3);
  });

  it('ganimet zarları yalnızca 2, 4 ve 5 galibiyette atılır; fazla galibiyet sayısı kırpılır', () => {
    const total = (o: Record<string, number>) => Object.values(o).reduce((a, b) => a + b, 0);
    // dropRate büyük: şanslar %100'e dayanır, zar sayısı fark yaratır
    const count = (w: number) => {
      const p = arenaPayout(foes, w, level, 50, mulberry32(7));
      return total(p.loot.items) + total(p.loot.wands);
    };
    expect(count(1)).toBe(0);
    expect(count(2)).toBeGreaterThan(0);
    expect(count(5)).toBeGreaterThanOrEqual(count(4));
    expect(count(4)).toBeGreaterThanOrEqual(count(2));
    expect(arenaPayout(foes, 99, level, 1, mulberry32(3)).wins).toBe(ARENA_STAGES);
  });

  it('aynı tohumla aynı ödül; para ve XP loot nesnesiyle tutarlı', () => {
    const a = arenaPayout(foes, 5, level, 1, mulberry32(11));
    const b = arenaPayout(foes, 5, level, 1, mulberry32(11));
    expect(a).toEqual(b);
    expect(a.loot.money).toBe(a.money);
    expect(a.loot.xp).toBe(a.xp);
  });
});

describe('arena dinlenmesi', () => {
  it('girince dinlenir, süre dolunca açılır', () => {
    let t = 0;
    const board = new MineBoard(() => t, 15 * 60 * 1000);
    expect(board.isReady('a')).toBe(true);
    board.start('a');
    expect(board.isReady('a')).toBe(false);
    t = 15 * 60 * 1000;
    expect(board.isReady('a')).toBe(true);
  });
});
