import { describe, expect, it } from 'vitest';
import { CHEST_SPOTS } from '../enemies/chests';
import { MINE_SPOTS } from '../enemies/mines';
import { LOCATIONS } from '../world/locations';
import { MAIN_QUEST_MARKERS } from '../world/questMarkers';
import { TILE_SIZE } from '../world/tiles';
import { SIDE_QUESTS, type QuestDef } from './catalog';
import { directionTo, mainEntry, objectiveText, pickTracked, rewardText, sideEntry, sideTarget, type SideTargetContext } from './tracking';

const ctx = (over: Partial<SideTargetContext> = {}): SideTargetContext => ({ playerPx: 68 * TILE_SIZE, playerPy: 68 * TILE_SIZE, mines: MINE_SPOTS, chests: CHEST_SPOTS, chestOpen: () => false, ...over });
const quest = (id: string): QuestDef => SIDE_QUESTS.find((q) => q.id === id)!;

describe('görev takibi', () => {
  it('ana görev girişi işaretin yerini ve adını verir', () => {
    const e = mainEntry(MAIN_QUEST_MARKERS[0]);
    expect(e.kind).toBe('main');
    expect(e.summary).toContain(MAIN_QUEST_MARKERS[0].title);
    expect(e.target).toMatchObject({ px: MAIN_QUEST_MARKERS[0].px, py: MAIN_QUEST_MARKERS[0].py });
    expect(e.progress).toBeNull();
  });

  it('konum ve teslimat görevlerinin hedefi şehirdir', () => {
    const t = sideTarget(quest('crystal-tas-haberi'), ctx())!;
    const stone = LOCATIONS.find((l) => l.id === 'stone-heart')!;
    expect(t).toMatchObject({ px: stone.x * TILE_SIZE + TILE_SIZE / 2, py: stone.y * TILE_SIZE + TILE_SIZE / 2, label: stone.name });
    expect(sideTarget(quest('ignis-baharat-teslimat'), ctx())!.label).toBe(LOCATIONS.find((l) => l.id === 'abyss')!.name);
  });

  it('maden görevi en yakın madene, sandık görevi en yakın kapalı sandığa yönlendirir', () => {
    const m = sideTarget(quest('stone-maden'), ctx())!;
    const nearestMine = [...MINE_SPOTS].sort((a, b) => Math.hypot(a.tileX - 68, a.tileY - 68) - Math.hypot(b.tileX - 68, b.tileY - 68))[0];
    expect(m.px).toBe(nearestMine.tileX * TILE_SIZE + TILE_SIZE / 2);
    const c1 = sideTarget(quest('abyss-sandik'), ctx())!;
    const nearestChest = [...CHEST_SPOTS].sort((a, b) => Math.hypot(a.tileX - 68, a.tileY - 68) - Math.hypot(b.tileX - 68, b.tileY - 68))[0];
    expect(c1.px).toBe(nearestChest.tileX * TILE_SIZE + TILE_SIZE / 2);
    // En yakın sandık açıldıysa bir sonrakine geçer
    const c2 = sideTarget(quest('abyss-sandik'), ctx({ chestOpen: (id) => id === nearestChest.id }))!;
    expect(c2.px === c1.px && c2.py === c1.py).toBe(false);
    // Hepsi açıksa hedef yok
    expect(sideTarget(quest('abyss-sandik'), ctx({ chestOpen: () => true }))).toBeNull();
  });

  it('savaş kazanma görevinde hedef yoktur (ok çıkmaz), özet ilerlemeyi gösterir', () => {
    const e = sideEntry(quest('ignis-kor-avi'), { value: 1, target: 3 }, ctx());
    expect(e.target).toBeNull();
    expect(e.summary).toContain('3 savaş kazan');
    expect(e.summary).toContain('(1/3)');
    expect(e.rewardText).toMatch(/Kor/);
  });

  it('hedef ve ödül metinleri her gerçek görevde dolu', () => {
    for (const q of SIDE_QUESTS) {
      expect(objectiveText(q).length, q.id).toBeGreaterThan(3);
      expect(rewardText(q), q.id).toMatch(/XP/);
    }
  });

  it('takip edilen: seçilen geçerliyse o; değilse ana görev; o da yoksa ilk yan görev; yoksa null', () => {
    const main = mainEntry(MAIN_QUEST_MARKERS[0]);
    const side = sideEntry(quest('crystal-tas-haberi'), { value: 0, target: 1 }, ctx());
    expect(pickTracked([main, side], side.id)).toBe(side);
    expect(pickTracked([main, side], 'yok')).toBe(main);
    expect(pickTracked([main, side], null)).toBe(main);
    expect(pickTracked([side], 'main-ch1')).toBe(side);
    expect(pickTracked([], null)).toBeNull();
  });

  it('yön oku: sağ, aşağı, sol-yukarı ve uzaklık karo olarak', () => {
    expect(directionTo(0, 0, { px: 320, py: 0 })).toMatchObject({ arrow: '→', tiles: 10, degrees: 0 });
    expect(directionTo(0, 0, { px: 0, py: 320 })).toMatchObject({ arrow: '↓', degrees: 90 });
    expect(directionTo(0, 0, { px: -320, py: -320 }).arrow).toBe('↖');
    expect(directionTo(100, 100, { px: 100, py: 100 }).tiles).toBe(0);
  });
});
