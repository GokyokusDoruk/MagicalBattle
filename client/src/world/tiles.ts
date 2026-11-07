export const TILE_SIZE = 32;

export enum Tile {
  Grass = 0,
  Water = 1,
  Forest = 2,
  Sand = 3,
}

/** Üzerinden geçilemeyen zeminler. */
export function isBlockedTile(tile: Tile): boolean {
  return tile === Tile.Water || tile === Tile.Forest;
}
