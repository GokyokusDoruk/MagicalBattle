import { describe, expect, it } from 'vitest';
import { GridMover, STEP_MS } from './gridMove';
import { TILE_SIZE } from './tiles';

const free = () => false;
const none = { x: 0, y: 0 };

describe('kare kare hareket', () => {
  it('girdi yokken durur; ışınlanınca anında karo değişir', () => {
    const m = new GridMover({ x: 5, y: 5 }, free);
    m.update(1000, none);
    expect(m.tile).toEqual({ x: 5, y: 5 });
    expect(m.position()).toEqual({ x: 5 * TILE_SIZE + TILE_SIZE / 2, y: 5 * TILE_SIZE + TILE_SIZE / 2 });
    m.teleport({ x: 9, y: 2 });
    expect(m.tile).toEqual({ x: 9, y: 2 });
    expect(m.moving).toBe(false);
  });

  it('yalnızca dört yöne gider; çapraz girdide baskın eksen seçilir (eşitlikte yatay)', () => {
    const diag = new GridMover({ x: 5, y: 5 }, free);
    diag.update(STEP_MS / 2, { x: 0.7, y: 0.7 });
    expect(diag.target).toEqual({ x: 6, y: 5 }); // eşit: yatay
    const up = new GridMover({ x: 5, y: 5 }, free);
    up.update(STEP_MS / 2, { x: 0.2, y: -0.9 });
    expect(up.target).toEqual({ x: 5, y: 4 }); // dikey baskın, yukarı
    expect(up.facing).toBe('up');
    up.update(1000, { x: 0, y: 0 });
    expect(up.tile).toEqual({ x: 5, y: 4 });
  });

  it('bir adım yaklaşık STEP_MS sürer; adım ortasında iki karo arasındadır', () => {
    const m = new GridMover({ x: 0, y: 0 }, free);
    m.update(STEP_MS / 2, { x: 1, y: 0 });
    expect(m.moving).toBe(true);
    const p = m.position();
    expect(p.x).toBeGreaterThan(TILE_SIZE / 2);
    expect(p.x).toBeLessThan(TILE_SIZE * 1.5);
    expect(p.y).toBe(TILE_SIZE / 2);
    m.update(STEP_MS / 2 + 1, { x: 0, y: 0 });
    expect(m.tile).toEqual({ x: 1, y: 0 });
  });

  it('tuşa basılı tutulunca adımlar peş peşe devam eder; birakılınca son karoda durur', () => {
    const m = new GridMover({ x: 0, y: 0 }, free);
    const arrivals: number[] = [];
    const mm = new GridMover({ x: 0, y: 0 }, free, (t) => arrivals.push(t.x));
    for (let i = 0; i < 30; i++) mm.update(STEP_MS / 3, { x: 1, y: 0 });
    expect(mm.tile.x + (mm.moving ? 1 : 0)).toBeGreaterThanOrEqual(9);
    expect(arrivals).toEqual([...arrivals].sort((a, b) => a - b));
    mm.update(5000, { x: 0, y: 0 });
    expect(mm.moving).toBe(false);
    expect(m.tile).toEqual({ x: 0, y: 0 });
  });

  it('engel yürümeyi engeller ama yönü çevirir', () => {
    const m = new GridMover({ x: 3, y: 3 }, (x, y) => x === 4 && y === 3);
    m.update(1000, { x: 1, y: 0 });
    expect(m.tile).toEqual({ x: 3, y: 3 });
    expect(m.facing).toBe('right');
    m.update(STEP_MS, { x: 0, y: 1 });
    expect(m.tile).toEqual({ x: 3, y: 4 });
  });

  it('hız çarpanı adımı kısaltır: +%25 hız, aynı sürede daha çok karo', () => {
    const count = (speed: number): number => {
      const m = new GridMover({ x: 0, y: 0 }, free);
      for (let i = 0; i < 100; i++) m.update(16, { x: 1, y: 0 }, speed);
      return m.tile.x;
    };
    expect(count(1.25)).toBeGreaterThan(count(1));
    expect(count(2)).toBeGreaterThan(count(1.25));
  });

  it('düşük FPS: büyük kare süresinde de geride kalmaz, varış sırayla bildirilir', () => {
    const seen: string[] = [];
    const m = new GridMover({ x: 0, y: 0 }, free, (t) => seen.push(`${t.x},${t.y}`));
    for (let i = 0; i < 20; i++) m.update(400, { x: 1, y: 0 }); // kare başına 250 ms ile sınırlanır
    expect(seen.length).toBeGreaterThan(5);
    expect(seen[0]).toBe('1,0');
  });

  it('ölü bölge: çok küçük girdi hareket ettirmez', () => {
    const m = new GridMover({ x: 0, y: 0 }, free);
    m.update(1000, { x: 0.1, y: -0.2 });
    expect(m.moving).toBe(false);
  });
});
