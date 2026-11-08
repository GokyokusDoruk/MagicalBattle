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

export const STALL_KEY = 'stall';
export const HERB_KEY = 'pickup-herb';
export const CRYSTAL_KEY = 'pickup-crystal';

/** Tüccar tezgâhı ve toplanabilir eşyaların (ot, kristal) görselleri. */
export function createWorldItemTextures(scene: Scene): void {
  const g = scene.add.graphics();

  // Tezgâh: kırmızı-beyaz çizgili gölgelik, ahşap tezgâh, üstünde mallar
  g.fillStyle(0x5b3a1e, 1).fillRect(3, 14, 3, 22).fillRect(34, 14, 3, 22); // direkler
  for (let i = 0; i < 5; i++) g.fillStyle(i % 2 === 0 ? 0xd9534f : 0xf5e6c8, 1).fillRect(2 + i * 7.2, 6, 7.2, 10);
  g.fillStyle(0xb8453f, 1).fillRect(2, 15, 36, 2);
  g.fillStyle(0x8a5a2b, 1).fillRect(4, 26, 32, 10);
  g.fillStyle(0x6b4423, 1).fillRect(4, 33, 32, 3);
  g.fillStyle(0xe8d37a, 1).fillCircle(12, 24, 3);
  g.fillStyle(0x7fd1ff, 1).fillCircle(20, 24, 3);
  g.fillStyle(0xff8f5a, 1).fillCircle(28, 24, 3);
  g.generateTexture(STALL_KEY, 40, 38);
  g.clear();

  // Şifalı ot: iki yaprak ve sap
  g.fillStyle(0x2f7a38, 1).fillRect(9, 8, 2, 12);
  g.fillStyle(0x58c264, 1).fillCircle(6, 8, 5).fillCircle(14, 6, 5);
  g.fillStyle(0xa6f0a0, 1).fillCircle(5, 6, 1.5).fillCircle(13, 4, 1.5);
  g.generateTexture(HERB_KEY, 20, 22);
  g.clear();

  // Kristal: parlayan elmas
  g.fillStyle(0x7fe8ff, 0.25).fillCircle(10, 13, 10);
  g.fillStyle(0x7fe8ff, 1).fillTriangle(10, 2, 3, 13, 10, 24).fillTriangle(10, 2, 17, 13, 10, 24);
  g.fillStyle(0xd8fbff, 1).fillTriangle(10, 2, 6, 12, 10, 13);
  g.generateTexture(CRYSTAL_KEY, 20, 26);
  g.destroy();
}
