import { valueNoise } from './rng';
import { Tile, isBlockedTile } from './tiles';

export interface WorldMap {
  width: number;
  height: number;
  /** satır satır, tiles[y][x] */
  tiles: Tile[][];
  /** Oyuncunun başlayacağı karo */
  spawn: { x: number; y: number };
}

export interface MapOptions {
  seed?: number;
  width?: number;
  height?: number;
}

const BORDER = 2;
const SPAWN_CLEAR_RADIUS = 5;

/** Tohuma bağlı, tekrarlanabilir açık dünya haritası üretir. */
export function generateMap({ seed = 1337, width = 96, height = 96 }: MapOptions = {}): WorldMap {
  const spawn = { x: Math.floor(width / 2), y: Math.floor(height / 2) };
  const tiles: Tile[][] = [];

  for (let y = 0; y < height; y++) {
    const row: Tile[] = [];
    for (let x = 0; x < width; x++) {
      const water = valueNoise(seed, x / 14, y / 14) * 0.7 + valueNoise(seed + 1, x / 6, y / 6) * 0.3;
      const forest = valueNoise(seed + 2, x / 9, y / 9);
      const nearSpawn = Math.hypot(x - spawn.x, y - spawn.y) <= SPAWN_CLEAR_RADIUS;

      let tile = Tile.Grass;
      if (water < 0.36) tile = Tile.Water;
      else if (forest > 0.66) tile = Tile.Forest;

      if (nearSpawn) tile = Tile.Grass;
      if (x < BORDER || y < BORDER || x >= width - BORDER || y >= height - BORDER) tile = Tile.Forest;
      row.push(tile);
    }
    tiles.push(row);
  }

  // Suya komşu çim karoları kum olur.
  const snapshot = tiles.map((r) => r.slice());
  for (let y = 1; y < height - 1; y++) {
    for (let x = 1; x < width - 1; x++) {
      if (snapshot[y][x] !== Tile.Grass) continue;
      const nearWater =
        snapshot[y - 1][x] === Tile.Water ||
        snapshot[y + 1][x] === Tile.Water ||
        snapshot[y][x - 1] === Tile.Water ||
        snapshot[y][x + 1] === Tile.Water;
      if (nearWater) tiles[y][x] = Tile.Sand;
    }
  }

  return { width, height, tiles, spawn };
}

export function tileAt(map: WorldMap, x: number, y: number): Tile {
  // Harita dışı her zaman engel sayılır.
  if (x < 0 || y < 0 || x >= map.width || y >= map.height) return Tile.Forest;
  return map.tiles[y][x];
}

const NEIGHBORS: ReadonlyArray<readonly [number, number]> = [
  [1, 0],
  [-1, 0],
  [0, 1],
  [0, -1],
];

/** Başlangıçtan yürüyerek ulaşılabilen karoların, tüm yürünebilir karolara oranı (0-1). */
export function reachableFraction(map: WorldMap): number {
  const seen = new Set<number>();
  const key = (x: number, y: number): number => y * map.width + x;
  const stack = [map.spawn];
  seen.add(key(map.spawn.x, map.spawn.y));
  while (stack.length > 0) {
    const { x, y } = stack.pop()!;
    for (const [dx, dy] of NEIGHBORS) {
      const nx = x + dx;
      const ny = y + dy;
      if (isBlockedTile(tileAt(map, nx, ny)) || seen.has(key(nx, ny))) continue;
      seen.add(key(nx, ny));
      stack.push({ x: nx, y: ny });
    }
  }
  let walkable = 0;
  for (const row of map.tiles) for (const t of row) if (!isBlockedTile(t)) walkable++;
  return seen.size / walkable;
}
