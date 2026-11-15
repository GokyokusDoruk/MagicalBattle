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
  g.generateTexture(PLAYER_KEY, 26, 32);
  g.clear();
  // Asa ayrı bir dokudur (Task 61): yürürken aşağı yukarı oynar. 8x24: direk ve ucunda küre.
  g.fillStyle(0x8a5a2b, 1).fillRect(3, 6, 2, 18); // asa
  g.fillStyle(0xd7b66d, 1).fillCircle(4, 4, 3); // asa ucu
  g.generateTexture(STAFF_KEY, 8, 24);
  g.destroy();
}

export const STALL_KEY = 'stall';
/** Karakterin asası (yürürken oynayan ayrı sprite) */
export const STAFF_KEY = 'player-staff';
export const PILE_KEY = 'ground-pile';
/** Dünya düşmanı dokusunun anahtarı (elemente göre) */
export const mineKey = (element: string): string => `mine-${element}`;
export const CHEST_KEY = 'chest';
export const ARENA_KEY = 'arena';
/** Ana görev işareti: altın bayrak ve yerde parlayan halka (eskiden sarı "!" yazısıydı) */
export const QUEST_FLAG_KEY = 'quest-flag';
export const QUEST_RING_KEY = 'quest-ring';
/** Çalılıkta karakterin önüne gelen yaprak katmanı (karakterin alt yarısını örter) */
export const BUSH_KEY = 'bush-front';
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

  // Dünya düşmanları (Task 60): elementin renginde cüppeli büyücüler: sivri şapka, yüz, cüppe ve ucunda elementin küresi olan asa (34x44)
  for (const [el, [body, light]] of Object.entries(ENEMY_COLORS)) {
    g.fillStyle(0x000000, 0.25).fillEllipse(16, 40, 24, 6);
    // cüppe
    g.fillStyle(body, 1).fillTriangle(16, 16, 4, 40, 28, 40);
    g.fillStyle(0x000000, 0.18).fillTriangle(16, 16, 16, 40, 28, 40);
    g.fillStyle(light, 0.9).fillRect(9, 30, 14, 2);
    // yüz ve gözler
    g.fillStyle(0xf0c8a0, 1).fillCircle(16, 15, 6);
    g.fillStyle(0x111111, 1).fillCircle(14, 15, 1).fillCircle(18.5, 15, 1);
    // şapka (sivri uçlu, geniş kenarlı)
    g.fillStyle(body, 1).fillTriangle(16, 0, 8, 12, 24, 12);
    g.fillStyle(light, 1).fillRect(6, 11, 20, 2.5);
    g.fillStyle(0x000000, 0.2).fillTriangle(16, 0, 16, 12, 24, 12);
    // asa ve küre
    g.fillStyle(0x8a5a2b, 1).fillRect(27, 12, 2, 28);
    g.fillStyle(light, 1).fillCircle(28, 10, 3.5);
    g.fillStyle(0xffffff, 0.7).fillCircle(27, 9, 1.2);
    g.generateTexture(enemyKey(el), 34, 44);
    g.clear();
  }

  // Ana görev işareti: altın bayrak (direk, dalgalı bayrak, yıldız) ve yerde altın halka
  g.fillStyle(0x6b4423, 1).fillRect(11, 6, 2.5, 32);
  g.fillStyle(0xfbbf24, 1).fillTriangle(13.5, 7, 30, 13, 13.5, 21);
  g.fillStyle(0xf59e0b, 1).fillTriangle(13.5, 15, 30, 13, 13.5, 21);
  g.fillStyle(0xfff7c2, 1).fillCircle(12, 5, 3.2);
  g.lineStyle(1.5, 0x92400e, 1).strokeTriangle(13.5, 7, 30, 13, 13.5, 21);
  g.generateTexture(QUEST_FLAG_KEY, 34, 40);
  g.clear();
  g.lineStyle(3, 0xfde047, 0.9).strokeEllipse(20, 8, 34, 12);
  g.lineStyle(1.5, 0xffffff, 0.6).strokeEllipse(20, 8, 26, 8);
  g.generateTexture(QUEST_RING_KEY, 40, 16);
  g.clear();

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
  // Çalı ön katmanı: üstü dalgalı, altı dolu, yeşil yaprak kümeleri (40x18); karakterin alt yarısını örter
  g.fillStyle(0x3f5f1f, 1).fillEllipse(20, 12, 40, 12);
  g.fillStyle(0x56802a, 1).fillCircle(8, 9, 6).fillCircle(20, 6, 7).fillCircle(32, 9, 6);
  g.fillStyle(0x6f9a36, 1).fillCircle(13, 6, 4).fillCircle(27, 5, 4).fillCircle(20, 10, 5);
  g.fillStyle(0x84b347, 0.9).fillCircle(10, 4, 2).fillCircle(24, 3, 2).fillCircle(31, 7, 2).fillCircle(17, 8, 1.6);
  g.fillStyle(0x2f4a16, 1).fillRect(0, 14, 40, 4);
  g.generateTexture(BUSH_KEY, 40, 18);
  g.clear();
  g.destroy();
}
