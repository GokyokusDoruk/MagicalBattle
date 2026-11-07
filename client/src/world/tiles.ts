export const TILE_SIZE = 32;

export enum Tile {
  Grass = 0,
  Water = 1,
  Forest = 2,
  Sand = 3,
  Wall = 4,
  Gate = 5,
  Path = 6,
}

export const TILE_COUNT = 7;

/**
 * Zemin türü olarak geçilemeyenler. Kapı (Gate) burada geçilebilir sayılır,
 * kilitli olup olmadığı ayrıca GateRegistry ile kontrol edilir.
 */
export function isBlockedTile(tile: Tile): boolean {
  return tile === Tile.Water || tile === Tile.Forest || tile === Tile.Wall;
}
