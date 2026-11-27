import { Tile } from './tiles';

/**
 * Yumuşak arazi çizicisi: karo haritasını keskin kutular yerine **organik kenarlı** bir görsele çevirir.
 * Mantık karolu kalır (hareket, çarpışma, karşılaşmalar); yalnızca görünüm yumuşaktır. Phaser'dan bağımsızdır
 * (RGBA dizisi üretir), bu yüzden testlenebilir ve düğümde (Node) de çalışır.
 *
 * Yöntem: her piksel için komşu karoların türlerinden yumuşak ağırlıklar hesaplanır (bilineer), gürültüyle
 * dalgalandırılır ve baskın tür seçilir; sınırda iki tür karışır (kenar yumuşar). Türlerin dokusu (çim tutamları, su
 * dalgaları, ağaç tepeleri, çalı kümeleri, kum benekleri) piksel başına çizilir. Kıyıya köpük, yola kenar çizgisi eklenir.
 * Sur ve kapı keskin kalır (taş).
 */

export type Rgb = readonly [number, number, number];

const BASE: Record<number, Rgb> = {
  [Tile.Grass]: [70, 150, 66],
  [Tile.Water]: [44, 108, 182],
  [Tile.Forest]: [38, 104, 52],
  [Tile.Sand]: [220, 198, 140],
  [Tile.Path]: [166, 124, 82],
  [Tile.Thicket]: [104, 128, 52],
};

/** Karışımda yer alan (yumuşak) türler; sur ve kapı çimen sayılır, üzerine keskin çizilir. */
const SOFT: readonly Tile[] = [Tile.Grass, Tile.Water, Tile.Forest, Tile.Sand, Tile.Path, Tile.Thicket];
const slot = new Map<number, number>(SOFT.map((t, i) => [t, i]));

// --- Gürültü ---------------------------------------------------------------------------------

function hash(x: number, y: number, seed: number): number {
  let h = (Math.imul(x | 0, 374761393) + Math.imul(y | 0, 668265263) + Math.imul(seed | 0, 2147483647)) | 0;
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  h ^= h >>> 16;
  return (h >>> 0) / 4294967296;
}

const smooth = (t: number): number => t * t * (3 - 2 * t);

function vnoise(x: number, y: number, seed: number): number {
  const x0 = Math.floor(x);
  const y0 = Math.floor(y);
  const fx = smooth(x - x0);
  const fy = smooth(y - y0);
  const a = hash(x0, y0, seed);
  const b = hash(x0 + 1, y0, seed);
  const c = hash(x0, y0 + 1, seed);
  const d = hash(x0 + 1, y0 + 1, seed);
  return (a * (1 - fx) + b * fx) * (1 - fy) + (c * (1 - fx) + d * fx) * fy;
}

/** İki oktavlı gürültü, 0-1 */
const fbm = (x: number, y: number, seed: number): number => vnoise(x, y, seed) * 0.65 + vnoise(x * 2.3, y * 2.3, seed + 9) * 0.35;

const clamp = (v: number, lo = 0, hi = 1): number => (v < lo ? lo : v > hi ? hi : v);
const mix = (a: Rgb, b: Rgb, t: number): Rgb => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t];
const scale = (c: Rgb, k: number): Rgb => [c[0] * k, c[1] * k, c[2] * k];

// --- Tür dokuları ----------------------------------------------------------------------------
// (u, v) karo koordinatıdır (kesirli); piksel başına çağrılır.

function texGrass(u: number, v: number): Rgb {
  const n = fbm(u * 1.6, v * 1.6, 11);
  let c = scale(BASE[Tile.Grass], 0.9 + n * 0.22);
  const tuft = vnoise(u * 9, v * 9, 21);
  if (tuft > 0.78) c = mix(c, [112, 188, 92], 0.55); // açık tutam
  else if (tuft < 0.18) c = mix(c, [44, 112, 48], 0.5); // koyu gölge
  return c;
}

function texWater(u: number, v: number, depth: number): Rgb {
  // Dalga çizgileri: gürültüyle eğilmiş yatay çizgiler
  const warp = vnoise(u * 1.3, v * 1.3, 31) * 2.2;
  const wave = Math.sin((v * 5.2 + warp + vnoise(u * 2.1, v * 0.7, 33) * 3) * 2.6);
  let c = scale(BASE[Tile.Water], 0.82 + depth * 0.24 + fbm(u * 0.8, v * 0.8, 37) * 0.1);
  if (wave > 0.86) c = mix(c, [150, 205, 245], 0.4);
  return c;
}

function texForest(u: number, v: number): Rgb {
  // Ağaç tepeleri: yarım karo büyüklüğünde hücrelerde rastgele daireler
  const cs = 0.62;
  const cx = Math.floor(u / cs);
  const cy = Math.floor(v / cs);
  let best = 0;
  let c: Rgb = scale(BASE[Tile.Forest], 0.6 + fbm(u * 1.5, v * 1.5, 41) * 0.1); // ağaçların arası koyu gölge
  for (let j = -1; j <= 1; j++) {
    for (let i = -1; i <= 1; i++) {
      const gx = cx + i;
      const gy = cy + j;
      const px = (gx + 0.2 + hash(gx, gy, 51) * 0.6) * cs;
      const py = (gy + 0.2 + hash(gx, gy, 52) * 0.6) * cs;
      const r = cs * (0.4 + hash(gx, gy, 53) * 0.2);
      const d = Math.hypot(u - px, v - py) / r;
      if (d < 1 && 1 - d > best) {
        best = 1 - d;
        // Tepe ortada açık, kenarda koyu; ışık sol üstten gelir
        const light = 0.78 + (1 - d) * 0.55 + (px - u + (py - v)) * 0.45;
        c = scale(BASE[Tile.Forest], clamp(light, 0.72, 1.7));
        if (d > 0.82) c = scale(c, 0.8);
      }
    }
  }
  return c;
}

function texThicket(u: number, v: number): Rgb {
  // Çalılık: sık, açık yeşil-zeytin yumaklar ve kırmızı meyve noktaları
  const n = fbm(u * 3.4, v * 3.4, 61);
  let c = scale(BASE[Tile.Thicket], 0.78 + n * 0.5);
  const blob = vnoise(u * 7, v * 7, 63);
  if (blob > 0.66) c = mix(c, [150, 176, 70], 0.55);
  else if (blob < 0.3) c = mix(c, [58, 78, 34], 0.55);
  const berry = hash(Math.floor(u * 11), Math.floor(v * 11), 65);
  if (berry > 0.93) c = [196, 54, 70];
  return c;
}

function texSand(u: number, v: number): Rgb {
  const n = fbm(u * 2.2, v * 2.2, 71);
  let c = scale(BASE[Tile.Sand], 0.92 + n * 0.14);
  const speck = hash(Math.floor(u * 22), Math.floor(v * 22), 73);
  if (speck > 0.94) c = mix(c, [190, 164, 104], 0.7);
  else if (speck < 0.04) c = mix(c, [246, 232, 184], 0.7);
  return c;
}

function texPath(u: number, v: number): Rgb {
  const n = fbm(u * 2.6, v * 2.6, 81);
  let c = scale(BASE[Tile.Path], 0.9 + n * 0.2);
  const peb = hash(Math.floor(u * 18), Math.floor(v * 18), 83);
  if (peb > 0.93) c = mix(c, [205, 178, 140], 0.7);
  else if (peb < 0.06) c = mix(c, [120, 86, 54], 0.6);
  return c;
}

function texWall(px: number, py: number, S: number): Rgb {
  // Taş duvar: kesin taş dokusu (sıralı tuğla)
  const brickH = S / 4;
  const row = Math.floor(py / brickH);
  const offset = row % 2 === 0 ? 0 : S / 4;
  const x = (px + offset) % (S / 2);
  const y = py % brickH;
  let c: Rgb = scale([126, 126, 138], 0.92 + hash(Math.floor((px + offset) / (S / 2)), row, 91) * 0.16);
  if (y < 1 || x < 1) c = scale(c, 0.72);
  else if (y > brickH - 2) c = scale(c, 0.92);
  return c;
}

function texGate(px: number, py: number, S: number): Rgb {
  const x = px / S;
  const y = py / S;
  const inDoor = x > 0.15 && x < 0.85 && y > 0.2;
  if (!inDoor) return texWall(px, py, S);
  let c: Rgb = [92, 58, 30];
  if (Math.abs(x - 0.5) < 0.03 || Math.abs(y - 0.45) < 0.03 || Math.abs(y - 0.75) < 0.03) c = [60, 37, 18];
  if (x > 0.4 && x < 0.46 && y > 0.55 && y < 0.65) c = [215, 182, 109];
  return c;
}

// --- Çizici ----------------------------------------------------------------------------------

export interface RenderOptions {
  /** Karo başına piksel sayısı (görsel çözünürlük) */
  pixelsPerTile: number;
  /** Kenar gürültüsü: sınırların ne kadar dalgalı olduğu (varsayılan 0.34) */
  wobble?: number;
  /**
   * Karo karo görünüm (Faz 1): her karo kendi alanını tam doldurur, komşu türler birbirine taşmaz. Karolar belli olur
   * ama ızgara çizgisi çizilmez (aynı türün dokusu karo sınırında kesintisiz akar). Suyun kıyıya değen kenarında ince köpük kalır.
   */
  tileAligned?: boolean;
  /** Çizilecek bölge (karo, yarı açık); verilmezse tüm harita */
  region?: { x0: number; y0: number; x1: number; y1: number };
}

export interface RenderedImage {
  width: number;
  height: number;
  /** RGBA, satır satır */
  data: Uint8ClampedArray;
}

/** Karo haritasını arazi görseline çevirir (varsayılan yumuşak kenarlı, `tileAligned` ile karo karo). */
export function renderSmoothTerrain(tiles: readonly (readonly Tile[])[], opts: RenderOptions): RenderedImage {
  const H = tiles.length;
  const W = tiles[0]?.length ?? 0;
  const S = opts.pixelsPerTile;
  const wobble = opts.wobble ?? 0.34;
  const r = opts.region ?? { x0: 0, y0: 0, x1: W, y1: H };
  const width = (r.x1 - r.x0) * S;
  const height = (r.y1 - r.y0) * S;
  const data = new Uint8ClampedArray(width * height * 4);

  const tileAt = (x: number, y: number): Tile => tiles[Math.min(H - 1, Math.max(0, y))][Math.min(W - 1, Math.max(0, x))];
  /** Yumuşak tür dizini: sur ve kapı çimen sayılır */
  const softIndex = (x: number, y: number): number => {
    const t = tileAt(x, y);
    return slot.get(t) ?? 0;
  };
  const w = new Float32Array(SOFT.length);

  for (let py = 0; py < height; py++) {
    for (let px = 0; px < width; px++) {
      const u = r.x0 + px / S;
      const v = r.y0 + py / S;
      const tx = Math.floor(u);
      const ty = Math.floor(v);
      const t = tileAt(tx, ty);
      let rgb: Rgb;

      if (t === Tile.Wall) rgb = texWall(Math.floor((u - tx) * S), Math.floor((v - ty) * S), S);
      else if (t === Tile.Gate) rgb = texGate(Math.floor((u - tx) * S), Math.floor((v - ty) * S), S);
      else if (opts.tileAligned) {
        w.fill(0);
        w[softIndex(tx, ty)] = 1;
        rgb = texture(t, u, v, w);
        if (t === Tile.Water) {
          // Kıyı köpüğü yalnızca su karosunun içinde, kara komşusuna bakan kenarda
          const fu = u - tx;
          const fv = v - ty;
          const land = (dx: number, dy: number): boolean => tileAt(tx + dx, ty + dy) !== Tile.Water;
          const edge = Math.min(land(-1, 0) ? fu : 1, land(1, 0) ? 1 - fu : 1, land(0, -1) ? fv : 1, land(0, 1) ? 1 - fv : 1);
          const foam = Math.exp(-Math.pow(edge / 0.09, 2)) * (0.45 + 0.55 * vnoise(u * 8, v * 8, 121));
          rgb = mix(rgb, [236, 246, 252], clamp(foam * 0.8));
        }
      } else {
        // Karo merkezlerine göre bilineer ağırlıklar
        const fu = u - 0.5;
        const fv = v - 0.5;
        const x0 = Math.floor(fu);
        const y0 = Math.floor(fv);
        const ax = smooth(fu - x0);
        const ay = smooth(fv - y0);
        w.fill(0);
        w[softIndex(x0, y0)] += (1 - ax) * (1 - ay);
        w[softIndex(x0 + 1, y0)] += ax * (1 - ay);
        w[softIndex(x0, y0 + 1)] += (1 - ax) * ay;
        w[softIndex(x0 + 1, y0 + 1)] += ax * ay;
        // Her türe farklı gürültü: sınırlar dalgalanır
        for (let k = 0; k < SOFT.length; k++) w[k] += (fbm(u * 2.4, v * 2.4, 100 + k * 7) - 0.5) * wobble;

        let i1 = 0;
        for (let k = 1; k < SOFT.length; k++) if (w[k] > w[i1]) i1 = k;
        let i2 = i1 === 0 ? 1 : 0;
        for (let k = 0; k < SOFT.length; k++) if (k !== i1 && w[k] > w[i2]) i2 = k;
        const margin = w[i1] - w[i2];
        const a = smooth(clamp((margin + 0.05) / 0.1));
        const t1 = SOFT[i1];
        const t2 = SOFT[i2];
        const c1 = texture(t1, u, v, w);
        rgb = a >= 1 ? c1 : mix(texture(t2, u, v, w), c1, a);

        // Kıyı köpüğü: su ile kum/çimen sınırında beyaz çizgi
        if ((t1 === Tile.Water || t2 === Tile.Water) && (t1 !== Tile.Water || t2 !== Tile.Water)) {
          const foam = Math.exp(-Math.pow(margin / 0.07, 2)) * (0.45 + 0.55 * vnoise(u * 8, v * 8, 121));
          rgb = mix(rgb, [236, 246, 252], clamp(foam * 0.85));
        }
        // Yol kenarı: toprağın çimenle buluştuğu yerde koyu kenar çizgisi
        if ((t1 === Tile.Path) !== (t2 === Tile.Path) && (t1 === Tile.Path || t2 === Tile.Path)) {
          const rim = Math.exp(-Math.pow((margin - 0.04) / 0.09, 2));
          rgb = mix(rgb, [112, 78, 46], clamp(rim * 0.5));
        }
      }

      const o = (py * width + px) * 4;
      data[o] = rgb[0];
      data[o + 1] = rgb[1];
      data[o + 2] = rgb[2];
      data[o + 3] = 255;
    }
  }
  return { width, height, data };
}

function texture(t: Tile, u: number, v: number, w: Float32Array): Rgb {
  switch (t) {
    case Tile.Water:
      return texWater(u, v, clamp(w[slot.get(Tile.Water)!] - 0.4, 0, 1));
    case Tile.Forest:
      return texForest(u, v);
    case Tile.Thicket:
      return texThicket(u, v);
    case Tile.Sand:
      return texSand(u, v);
    case Tile.Path:
      return texPath(u, v);
    default:
      return texGrass(u, v);
  }
}
