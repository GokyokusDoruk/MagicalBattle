import { CITY_HALF, LOCATIONS, OPEN_HALF, approachTile, gateTile, type LocationDef } from './locations';
import { valueNoise } from './rng';
import { Tile, isBlockedTile } from './tiles';

export interface GateTile {
  x: number;
  y: number;
  /** Kapının ait olduğu şehrin LocationDef.id değeri */
  cityId: string;
}

export interface WorldMap {
  width: number;
  height: number;
  /** satır satır, tiles[y][x] */
  tiles: Tile[][];
  /** Oyuncunun başlayacağı karo */
  spawn: { x: number; y: number };
  locations: readonly LocationDef[];
  gates: GateTile[];
}

export interface MapOptions {
  seed?: number;
  width?: number;
  height?: number;
}

const BORDER = 2;
const SPAWN_CLEAR_RADIUS = 5;
const ROAD_HALF_WIDTH = 1; // 3 karo genişliğinde yol
const ZONE_MARGIN = 2;

interface Rect {
  x0: number;
  y0: number;
  x1: number;
  y1: number;
}

function zoneRect(loc: LocationDef, margin: number): Rect {
  const half = loc.kind === 'city' ? CITY_HALF : OPEN_HALF;
  return { x0: loc.x - half - margin, y0: loc.y - half - margin, x1: loc.x + half + margin, y1: loc.y + half + margin };
}

function fill(tiles: Tile[][], rect: Rect, tile: Tile): void {
  for (let y = rect.y0; y <= rect.y1; y++) {
    for (let x = rect.x0; x <= rect.x1; x++) {
      if (tiles[y]?.[x] !== undefined) tiles[y][x] = tile;
    }
  }
}

type Point = { x: number; y: number };

/** İki nokta arasında "L" biçiminde iki yol adayı: önce yatay ya da önce dikey. */
function routeCandidates(a: Point, b: Point): Rect[][] {
  const hFirst = [
    { x0: Math.min(a.x, b.x), x1: Math.max(a.x, b.x), y0: a.y, y1: a.y },
    { x0: b.x, x1: b.x, y0: Math.min(a.y, b.y), y1: Math.max(a.y, b.y) },
  ];
  const vFirst = [
    { x0: a.x, x1: a.x, y0: Math.min(a.y, b.y), y1: Math.max(a.y, b.y) },
    { x0: Math.min(a.x, b.x), x1: Math.max(a.x, b.x), y0: b.y, y1: b.y },
  ];
  return [hFirst, vFirst];
}

function intersects(a: Rect, b: Rect): boolean {
  return a.x0 <= b.x1 && a.x1 >= b.x0 && a.y0 <= b.y1 && a.y1 >= b.y0;
}

function widen(r: Rect): Rect {
  return { x0: r.x0 - ROAD_HALF_WIDTH, y0: r.y0 - ROAD_HALF_WIDTH, x1: r.x1 + ROAD_HALF_WIDTH, y1: r.y1 + ROAD_HALF_WIDTH };
}

/** Yolu şehir surlarına çarpmayan yönde (yatay-dikey ya da dikey-yatay) döşer. */
function carveRoad(tiles: Tile[][], a: Point, b: Point, cityRects: Rect[]): void {
  const candidates = routeCandidates(a, b);
  const clear = candidates.find((segs) => segs.every((s) => cityRects.every((c) => !intersects(widen(s), c))));
  for (const seg of clear ?? candidates[0]) fill(tiles, widen(seg), Tile.Path);
}

/** Tohuma bağlı, tekrarlanabilir açık dünya haritası üretir. */
export function generateMap({ seed = 1337, width = 136, height = 136 }: MapOptions = {}): WorldMap {
  const spawn = { x: Math.floor(width / 2), y: Math.floor(height / 2) };
  const tiles: Tile[][] = [];

  for (let y = 0; y < height; y++) {
    const row: Tile[] = [];
    for (let x = 0; x < width; x++) {
      const water = valueNoise(seed, x / 14, y / 14) * 0.7 + valueNoise(seed + 1, x / 6, y / 6) * 0.3;
      const forest = valueNoise(seed + 2, x / 9, y / 9);
      const thicket = valueNoise(seed + 3, x / 6.5, y / 6.5);
      const nearSpawn = Math.hypot(x - spawn.x, y - spawn.y) <= SPAWN_CLEAR_RADIUS;

      let tile = Tile.Grass;
      if (water < 0.36) tile = Tile.Water;
      else if (forest > 0.66) tile = Tile.Forest;
      else if (thicket > 0.6) tile = Tile.Thicket;

      if (nearSpawn) tile = Tile.Grass;
      if (x < BORDER || y < BORDER || x >= width - BORDER || y >= height - BORDER) tile = Tile.Forest;
      row.push(tile);
    }
    tiles.push(row);
  }

  // 1) Konum alanlarını çimenle temizle
  for (const loc of LOCATIONS) fill(tiles, zoneRect(loc, ZONE_MARGIN), Tile.Grass);

  // 2) Başlangıçtan başlayıp bölüm sırasıyla konumları yollarla bağla
  const cityRects = LOCATIONS.filter((l) => l.kind === 'city').map((l) => zoneRect(l, 0));
  let previous: Point = spawn;
  for (const loc of LOCATIONS) {
    const target = approachTile(loc);
    carveRoad(tiles, previous, target, cityRects);
    previous = target;
  }

  // 3) Suya komşu çim karoları kum olur (yollar etkilenmez)
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

  // 4) Surlu şehirlerin duvarlarını ve kapılarını en son çiz
  const gates: GateTile[] = [];
  for (const loc of LOCATIONS) {
    if (loc.kind !== 'city') continue;
    const ring = zoneRect(loc, 0);
    for (let y = ring.y0; y <= ring.y1; y++) {
      for (let x = ring.x0; x <= ring.x1; x++) {
        const onRing = x === ring.x0 || x === ring.x1 || y === ring.y0 || y === ring.y1;
        if (onRing) tiles[y][x] = Tile.Wall;
        else tiles[y][x] = Tile.Grass;
      }
    }
    const g = gateTile(loc);
    tiles[g.y][g.x] = Tile.Gate;
    gates.push({ x: g.x, y: g.y, cityId: loc.id });
  }

  return { width, height, tiles, spawn, locations: LOCATIONS, gates };
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

/** `from` karosundan yürüyerek ulaşılabilen karoların anahtar kümesi (anahtar: y * genişlik + x; kapılar açık sayılır). */
export function reachableSet(map: WorldMap, from: Point): Set<number> {
  const seen = new Set<number>();
  const key = (x: number, y: number): number => y * map.width + x;
  const stack = [from];
  seen.add(key(from.x, from.y));
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
  return seen;
}

export function isReachable(map: WorldMap, from: Point, to: Point): boolean {
  return reachableSet(map, from).has(to.y * map.width + to.x);
}

/** Başlangıçtan ulaşılabilen karoların, tüm yürünebilir karolara oranı (0-1). */
export function reachableFraction(map: WorldMap): number {
  const seen = reachableSet(map, map.spawn);
  let walkable = 0;
  for (const row of map.tiles) for (const t of row) if (!isBlockedTile(t)) walkable++;
  return seen.size / walkable;
}
