import type * as PhaserTypes from 'phaser';
import { mulberry32 } from './rng';
import { TILE_COUNT, TILE_SIZE, Tile } from './tiles';

export const TILESET_KEY = 'tiles';
export const PLAYER_KEY = 'player';

type Scene = PhaserTypes.Scene;

/** Zemin karolarını koda çizer (telifsiz). Karo sırası Tile enum'u ile aynıdır. */
export function createTilesetTexture(scene: Scene): void {
  const g = scene.add.graphics();
  const rand = mulberry32(42);
  const S = TILE_SIZE;
  const origin = (tile: Tile): number => tile * S;

  const speckles = (tile: Tile, color: number, count: number, size = 2): void => {
    g.fillStyle(color, 1);
    for (let i = 0; i < count; i++) {
      g.fillRect(origin(tile) + Math.floor(rand() * (S - size)), Math.floor(rand() * (S - size)), size, size);
    }
  };

  // Çim
  g.fillStyle(0x3f8f3f, 1).fillRect(origin(Tile.Grass), 0, S, S);
  speckles(Tile.Grass, 0x347a34, 14);
  speckles(Tile.Grass, 0x58a84f, 8);

  // Su
  g.fillStyle(0x2f6fb5, 1).fillRect(origin(Tile.Water), 0, S, S);
  g.fillStyle(0x4d8fd4, 1);
  for (let i = 0; i < 4; i++) {
    g.fillRect(origin(Tile.Water) + 3 + Math.floor(rand() * 14), 4 + i * 8, 10, 2);
  }

  // Orman (çim üstünde ağaç)
  g.fillStyle(0x347a34, 1).fillRect(origin(Tile.Forest), 0, S, S);
  g.fillStyle(0x5b3a1e, 1).fillRect(origin(Tile.Forest) + 14, 20, 5, 10);
  g.fillStyle(0x1f5a2a, 1).fillCircle(origin(Tile.Forest) + 16, 14, 11);
  g.fillStyle(0x2f7a38, 1).fillCircle(origin(Tile.Forest) + 12, 11, 6);

  // Kum
  g.fillStyle(0xd9c38a, 1).fillRect(origin(Tile.Sand), 0, S, S);
  speckles(Tile.Sand, 0xc4ad72, 12);
  speckles(Tile.Sand, 0xeedaa4, 6);

  // Sur (taş duvar)
  g.fillStyle(0x7d7d88, 1).fillRect(origin(Tile.Wall), 0, S, S);
  g.fillStyle(0x5e5e69, 1);
  for (let row = 0; row < 4; row++) {
    g.fillRect(origin(Tile.Wall), row * 8 + 7, S, 1);
    const offset = row % 2 === 0 ? 8 : 16;
    g.fillRect(origin(Tile.Wall) + offset, row * 8, 1, 8);
    g.fillRect(origin(Tile.Wall) + offset + 16, row * 8, 1, 8);
  }
  g.fillStyle(0x9a9aa6, 1).fillRect(origin(Tile.Wall), 0, S, 2);

  // Kapı (taş kemer içinde ahşap kapı)
  g.fillStyle(0x7d7d88, 1).fillRect(origin(Tile.Gate), 0, S, S);
  g.fillStyle(0x5b3a1e, 1).fillRect(origin(Tile.Gate) + 4, 6, 24, 26);
  g.fillStyle(0x3d2512, 1);
  g.fillRect(origin(Tile.Gate) + 15, 6, 2, 26);
  g.fillRect(origin(Tile.Gate) + 4, 14, 24, 2);
  g.fillRect(origin(Tile.Gate) + 4, 24, 24, 2);
  g.fillStyle(0xd7b66d, 1).fillRect(origin(Tile.Gate) + 12, 19, 2, 3);

  // Yol
  g.fillStyle(0xa67c52, 1).fillRect(origin(Tile.Path), 0, S, S);
  speckles(Tile.Path, 0x8d6841, 12);
  speckles(Tile.Path, 0xc09a6b, 8);

  g.generateTexture(TILESET_KEY, S * TILE_COUNT, S);
  g.destroy();
}

/** Küçük büyücü karakteri. */
export function createPlayerTexture(scene: Scene): void {
  const g = scene.add.graphics();
  g.fillStyle(0x3a3f9e, 1).fillTriangle(12, 14, 3, 31, 21, 31); // cüppe
  g.fillStyle(0xf0c8a0, 1).fillCircle(12, 11, 5); // yüz
  g.fillStyle(0x6a2fa0, 1).fillTriangle(12, 0, 5, 9, 19, 9); // şapka
  g.fillStyle(0x6a2fa0, 1).fillRect(4, 8, 16, 2); // şapka kenarı
  g.fillStyle(0x8a5a2b, 1).fillRect(22, 10, 2, 21); // asa
  g.fillStyle(0xd7b66d, 1).fillCircle(23, 9, 3); // asa ucu
  g.generateTexture(PLAYER_KEY, 26, 32);
  g.destroy();
}
