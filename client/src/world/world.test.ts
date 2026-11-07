import { describe, expect, it } from 'vitest';
import { moveWithCollision } from './collision';
import { generateMap, reachableFraction, tileAt } from './generateMap';
import { TILE_SIZE, Tile, isBlockedTile } from './tiles';

describe('generateMap', () => {
  it('aynı tohumla aynı haritayı üretir', () => {
    expect(generateMap({ seed: 7 }).tiles).toEqual(generateMap({ seed: 7 }).tiles);
  });

  it('farklı tohumla farklı harita üretir', () => {
    expect(generateMap({ seed: 7 }).tiles).not.toEqual(generateMap({ seed: 8 }).tiles);
  });

  it('başlangıç noktası ve çevresi yürünebilir', () => {
    const map = generateMap();
    for (let dy = -3; dy <= 3; dy++) {
      for (let dx = -3; dx <= 3; dx++) {
        expect(isBlockedTile(tileAt(map, map.spawn.x + dx, map.spawn.y + dy))).toBe(false);
      }
    }
  });

  it('kenarlar engellidir, harita dışı da engeldir', () => {
    const map = generateMap();
    expect(isBlockedTile(map.tiles[0][0])).toBe(true);
    expect(isBlockedTile(map.tiles[map.height - 1][map.width - 1])).toBe(true);
    expect(isBlockedTile(tileAt(map, -5, 10))).toBe(true);
  });

  it('yürünebilir alanın büyük kısmına başlangıçtan ulaşılır', () => {
    expect(reachableFraction(generateMap())).toBeGreaterThan(0.6);
  });
});

// 5x5 harita: ortası boş, (3,2) karosu engel
const blocked = (tx: number, ty: number): boolean =>
  tx < 0 || ty < 0 || tx >= 5 || ty >= 5 || (tx === 3 && ty === 2);
const half = { hw: 8, hh: 8 };

describe('moveWithCollision', () => {
  it('engel yokken tam ilerler', () => {
    const p = moveWithCollision({ x: 48, y: 80 }, { x: 5, y: 0 }, half, TILE_SIZE, blocked);
    expect(p).toEqual({ x: 53, y: 80 });
  });

  it('engel karoya yaslanır ve içinden geçmez', () => {
    const p = moveWithCollision({ x: 80, y: 80 }, { x: 20, y: 0 }, half, TILE_SIZE, blocked);
    expect(p.x).toBeCloseTo(3 * TILE_SIZE - half.hw, 2);
    expect(p.y).toBe(80);
  });

  it('duvara sürtünürken diğer eksende kayar', () => {
    const p = moveWithCollision({ x: 80, y: 80 }, { x: 20, y: -5 }, half, TILE_SIZE, blocked);
    expect(p.y).toBe(75);
    expect(p.x).toBeCloseTo(3 * TILE_SIZE - half.hw, 2);
  });

  it('harita sınırını aşmaz', () => {
    const p = moveWithCollision({ x: 20, y: 20 }, { x: -50, y: -50 }, half, TILE_SIZE, blocked);
    expect(p.x).toBeCloseTo(half.hw, 2);
    expect(p.y).toBeCloseTo(half.hh, 2);
  });

  it('tek adımda çok büyük hareket etse de duvarın içinden geçmez', () => {
    const p = moveWithCollision({ x: 80, y: 80 }, { x: 400, y: 0 }, half, TILE_SIZE, blocked);
    expect(p.x).toBeCloseTo(3 * TILE_SIZE - half.hw, 2);
  });

  it('kum yürünebilir bir zemindir', () => {
    expect(isBlockedTile(Tile.Sand)).toBe(false);
  });
});
