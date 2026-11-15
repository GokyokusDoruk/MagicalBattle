import type * as PhaserTypes from 'phaser';

export const TILESET_KEY = 'tiles';
export const PLAYER_KEY = 'player';

type Scene = PhaserTypes.Scene;

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
export const PILE_KEY = 'ground-pile';
/** Dünya düşmanı dokusunun anahtarı (elemente göre) */
export const mineKey = (element: string): string => `mine-${element}`;
export const CHEST_KEY = 'chest';
export const ARENA_KEY = 'arena';
export const enemyKey = (element: string): string => `enemy-${element}`;

const ENEMY_COLORS: Record<string, [number, number]> = {
  fire: [0xef4444, 0xfca5a5],
  water: [0x3b82f6, 0x93c5fd],
  earth: [0x92400e, 0xd6a76b],
  air: [0xe2e8f0, 0xffffff],
};

/** Tüccar tezgâhı, yerdeki eşya çuvalı, sandık, maden ve düşman görselleri. */
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

  // Yerdeki eşya: bırakılmış bir çuval, üstünde parıltı
  g.fillStyle(0xfcd34d, 0.25).fillCircle(14, 15, 13);
  g.fillStyle(0x8a5a2b, 1).fillEllipse(14, 20, 20, 14);
  g.fillStyle(0x6b4423, 1).fillRect(11, 8, 6, 5);
  g.fillStyle(0xb98550, 1).fillTriangle(8, 12, 14, 6, 20, 12);
  g.fillStyle(0xfef3c7, 1).fillRect(11, 12, 6, 2);
  g.generateTexture(PILE_KEY, 28, 30);
  g.clear();

  // Dünya düşmanları: elementin renginde yuvarlak yaratık, kızgın gözler ve dikenler
  for (const [el, [body, light]] of Object.entries(ENEMY_COLORS)) {
    g.fillStyle(0x000000, 0.25).fillEllipse(16, 29, 22, 6);
    g.fillStyle(body, 1).fillCircle(16, 17, 12);
    g.fillTriangle(8, 9, 11, 1, 14, 8).fillTriangle(18, 8, 21, 1, 24, 9);
    g.fillStyle(light, 1).fillCircle(13, 14, 3).fillCircle(20, 14, 3);
    g.fillStyle(0x111111, 1).fillCircle(13, 15, 1.5).fillCircle(20, 15, 1.5);
    g.fillStyle(0x111111, 1).fillRect(12, 21, 9, 2);
    g.generateTexture(enemyKey(el), 32, 32);
    g.clear();
  }

  // Korumalı sandık: ahşap gövde, altın kaplama ve kilit
  g.fillStyle(0x000000, 0.25).fillEllipse(16, 27, 26, 6);
  g.fillStyle(0x7c4a1e, 1).fillRect(4, 12, 24, 14);
  g.fillStyle(0x9a5f2a, 1).fillRect(4, 8, 24, 6);
  g.fillStyle(0xfbbf24, 1).fillRect(4, 13, 24, 2).fillRect(14, 8, 4, 18);
  g.fillStyle(0x111827, 1).fillRect(15, 15, 2, 4);
  g.generateTexture(CHEST_KEY, 32, 30);
  g.clear();

  // Madenler: kayalık tepe, element renginde parlayan karanlık giriş ve kazma
  for (const [el, [body, light]] of Object.entries(ENEMY_COLORS)) {
    g.fillStyle(0x4b5563, 1).fillTriangle(2, 36, 20, 4, 38, 36);
    g.fillStyle(0x6b7280, 1).fillTriangle(12, 36, 22, 12, 32, 36);
    g.fillStyle(0x0b0b10, 1).fillRect(14, 22, 12, 14);
    g.fillStyle(body, 0.9).fillRect(16, 26, 8, 10);
    g.fillStyle(light, 1).fillCircle(20, 24, 2.5);
    g.fillStyle(0x92400e, 1).fillRect(31, 24, 2, 12);
    g.fillStyle(0xd1d5db, 1).fillRect(28, 23, 8, 2);
    g.generateTexture(mineKey(el), 40, 38);
    g.clear();
  }
  // Arena: taş halka, içinde kum ve çapraz kılıçlar
  g.fillStyle(0x57534e, 1).fillCircle(24, 24, 22);
  g.fillStyle(0xd6c28f, 1).fillCircle(24, 24, 17);
  g.lineStyle(3, 0x78716c, 1).strokeCircle(24, 24, 22);
  g.lineStyle(3, 0xe5e7eb, 1).lineBetween(14, 14, 34, 34).lineBetween(34, 14, 14, 34);
  g.fillStyle(0xb91c1c, 1).fillRect(12, 12, 5, 5).fillRect(31, 12, 5, 5);
  g.generateTexture(ARENA_KEY, 48, 48);
  g.clear();
  g.destroy();
}
