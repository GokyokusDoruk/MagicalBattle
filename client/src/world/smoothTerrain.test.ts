import { describe, expect, it } from 'vitest';
import { generateMap, tileAt } from './generateMap';
import { renderSmoothTerrain } from './smoothTerrain';
import { Tile, isBlockedTile } from './tiles';

const grid = (rows: Tile[][]): Tile[][] => rows;

describe('yumuşak arazi çizici', () => {
  it('doğru boyutta RGBA üretir ve aynı girdide aynı sonucu verir', () => {
    const t = grid([[Tile.Grass, Tile.Water], [Tile.Sand, Tile.Forest]]);
    const a = renderSmoothTerrain(t, { pixelsPerTile: 6 });
    const b = renderSmoothTerrain(t, { pixelsPerTile: 6 });
    expect(a.width).toBe(12);
    expect(a.height).toBe(12);
    expect(a.data).toHaveLength(12 * 12 * 4);
    expect(Array.from(a.data)).toEqual(Array.from(b.data));
    for (let i = 3; i < a.data.length; i += 4) expect(a.data[i]).toBe(255); // opak
  });

  it('bölge çizimi tüm haritanın aynı bölgesiyle birebir aynıdır (parça parça çizim güvenli)', () => {
    const map = generateMap();
    const full = renderSmoothTerrain(map.tiles, { pixelsPerTile: 4, region: { x0: 60, y0: 60, x1: 76, y1: 76 } });
    const bands = [60, 68].map((y0) => renderSmoothTerrain(map.tiles, { pixelsPerTile: 4, region: { x0: 60, y0, x1: 76, y1: y0 + 8 } }));
    const joined = new Uint8ClampedArray(full.data.length);
    joined.set(bands[0].data, 0);
    joined.set(bands[1].data, bands[0].data.length);
    expect(Array.from(joined)).toEqual(Array.from(full.data));
  });

  it('türler farklı renkte: su mavi, çim yeşil, kum açık sarı, yol kahverengi, çalılık zeytin', () => {
    const solid = (t: Tile): number[] => {
      const rows = Array.from({ length: 5 }, () => Array.from({ length: 5 }, () => t));
      const img = renderSmoothTerrain(rows, { pixelsPerTile: 8 });
      const o = (20 * img.width + 20) * 4;
      return [img.data[o], img.data[o + 1], img.data[o + 2]];
    };
    const water = solid(Tile.Water);
    const grass = solid(Tile.Grass);
    const sand = solid(Tile.Sand);
    const path = solid(Tile.Path);
    expect(water[2]).toBeGreaterThan(water[0] + 40);
    expect(grass[1]).toBeGreaterThan(grass[0]);
    expect(grass[1]).toBeGreaterThan(grass[2] + 30);
    expect(sand[0]).toBeGreaterThan(180);
    expect(path[0]).toBeGreaterThan(path[2] + 40);
    const thicket = solid(Tile.Thicket);
    expect(thicket).not.toEqual(grass);
  });

  it('sınırda iki tür karışır (kutu kutu değil): su-çim sınırında bir ara renk bulunur', () => {
    const rows = Array.from({ length: 4 }, () => [Tile.Water, Tile.Water, Tile.Grass, Tile.Grass]);
    const img = renderSmoothTerrain(rows, { pixelsPerTile: 16, wobble: 0 });
    const blueish = (x: number, y: number): boolean => {
      const o = (y * img.width + x) * 4;
      return img.data[o + 2] > img.data[o + 1];
    };
    const y = 24;
    const states: boolean[] = [];
    for (let x = 0; x < img.width; x++) states.push(blueish(x, y));
    const changes = states.filter((v, i) => i > 0 && v !== states[i - 1]).length;
    expect(states[2]).toBe(true);
    expect(states[img.width - 3]).toBe(false);
    expect(changes).toBeGreaterThanOrEqual(1);
  });

  it('sur ve kapı keskin: sur karosu içinde yumuşak karışım olmaz (taş rengi gri)', () => {
    const rows = [[Tile.Grass, Tile.Wall, Tile.Grass]];
    const img = renderSmoothTerrain(rows, { pixelsPerTile: 12 });
    const o = (6 * img.width + 18) * 4; // sur karosunun ortası
    const [r, g, b] = [img.data[o], img.data[o + 1], img.data[o + 2]];
    expect(Math.abs(r - g)).toBeLessThan(25);
    expect(Math.abs(g - b)).toBeLessThan(30);
  });
});

describe('çalılık zemini', () => {
  it('geçilebilir bir zemindir ve haritada bulunur', () => {
    expect(isBlockedTile(Tile.Thicket)).toBe(false);
    const map = generateMap();
    let n = 0;
    for (let y = 0; y < map.height; y++) for (let x = 0; x < map.width; x++) if (tileAt(map, x, y) === Tile.Thicket) n++;
    expect(n).toBeGreaterThan(map.width * map.height * 0.02);
  });
});

describe('büyük harita (Task 39)', () => {
  it('136x136; başlangıç ortada; konumlar eski yerini 20 karo kaydırılmış olarak korur ve hepsine yürünür', async () => {
    const { MAP_OFFSET, LOCATIONS } = await import('./locations');
    const { reachableSet } = await import('./generateMap');
    const map = generateMap();
    expect(map.width).toBe(136);
    expect(map.height).toBe(136);
    expect(map.spawn).toEqual({ x: 68, y: 68 });
    expect(MAP_OFFSET).toBe(20);
    expect(LOCATIONS.find((l) => l.id === 'ignis')).toMatchObject({ x: 64 + MAP_OFFSET, y: 60 + MAP_OFFSET });
    const reach = reachableSet(map, map.spawn);
    for (const l of LOCATIONS) expect(reach.has(l.y * map.width + l.x), l.id).toBe(true);
    // Yeni dış halka (eski haritanın dışı) yürünebilir yerler içerir
    let outside = 0;
    for (let y = 0; y < map.height; y++) for (let x = 0; x < map.width; x++) if ((x < 20 || x >= 116 || y < 20 || y >= 116) && reach.has(y * map.width + x)) outside++;
    expect(outside).toBeGreaterThan(800);
  });
});
