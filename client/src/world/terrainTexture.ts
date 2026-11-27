import type { WorldMap } from './generateMap';
import { renderSmoothTerrain } from './smoothTerrain';
import { Tile } from './tiles';
import grassUrl from '../assets/world/ground_grass.jpg';
import pathUrl from '../assets/world/ground_path.jpg';
import sandUrl from '../assets/world/ground_sand.jpg';
import wallUrl from '../assets/world/ground_wall.jpg';
import gateUrl from '../assets/world/ground_gate.jpg';
import tree1 from '../assets/world/tree_1.png';
import tree2 from '../assets/world/tree_2.png';
import tree3 from '../assets/world/tree_3.png';
import tree4 from '../assets/world/tree_4.png';
import tree5 from '../assets/world/tree_5.png';
import bush1 from '../assets/world/bush_1.png';
import bush2 from '../assets/world/bush_2.png';
import bush3 from '../assets/world/bush_3.png';
import bush4 from '../assets/world/bush_4.png';

/**
 * Harita görseli: karo karo (Faz 1) ve **gerçek dokularla** (harita kalitesi):
 * - Zemin: çim, arnavut kaldırımı patika, sahil kumu, taş sur ve ahşap kapı (Poly Haven, CC0). Doku karolar boyunca kesintisiz akar.
 * - Ağaçlar ve çalılar: KayKit Forest (CC0) modellerinin 3D render'ları, her karoya oturur (çeşit karoya göre değişir).
 * - Su: işlemsel dalgalı su ve kıyı köpüğü (renderSmoothTerrain).
 * Surlarda ön yüzde gölge, üstte ışık (hafif 3D). Görseller yüklenemezse eski işlemsel çizim kalır.
 */

/** Arazi görselinin karo başına piksel sayısı (oyunda 32 piksellik karoya büyütülür) */
export const TERRAIN_PIXELS_PER_TILE = 20;
/** Bir seferde çizilen karo satırı sayısı (arayüz donmasın diye parça parça) */
const BAND_ROWS = 6;

const nextFrame = (): Promise<void> => new Promise((r) => setTimeout(r, 0));

/** Görselleri yükler (biri bile gelmezse null: işlemsel çizime dönülür) */
async function loadArt(): Promise<{ ground: Record<'grass' | 'path' | 'sand' | 'wall' | 'gate', HTMLImageElement>; trees: HTMLImageElement[]; bushes: HTMLImageElement[] } | null> {
  const load = (url: string): Promise<HTMLImageElement> =>
    new Promise((resolve, reject) => {
      const img = new Image();
      img.onload = () => resolve(img);
      img.onerror = reject;
      img.src = url;
    });
  try {
    const [grass, path, sand, wall, gate, ...rest] = await Promise.all([grassUrl, pathUrl, sandUrl, wallUrl, gateUrl, tree1, tree2, tree3, tree4, tree5, bush1, bush2, bush3, bush4].map(load));
    return { ground: { grass, path, sand, wall, gate }, trees: rest.slice(0, 5), bushes: rest.slice(5) };
  } catch {
    return null;
  }
}

/** Karoya göre sabit sözde rastgele sayı (0-1) */
function hash(x: number, y: number, k = 0): number {
  let h = Math.imul(x * 374761393 + y * 668265263 + k * 2246822519, 1274126177);
  h ^= h >>> 15;
  h = Math.imul(h, 2246822519);
  h ^= h >>> 13;
  return (h >>> 0) / 4294967296;
}

/**
 * Haritanın arazi görselini bir tuvale çizer. İşi parçalara böler ve araya boşluk bırakır, böylece
 * "Dünya oluşturuluyor" yazısı canlı kalır. `onProgress` 0-1 arası ilerlemeyi bildirir.
 */
export async function buildTerrainCanvas(map: WorldMap, onProgress?: (ratio: number) => void): Promise<HTMLCanvasElement> {
  const S = TERRAIN_PIXELS_PER_TILE;
  const canvas = document.createElement('canvas');
  canvas.width = map.width * S;
  canvas.height = map.height * S;
  const ctx = canvas.getContext('2d')!;
  const art = await loadArt();
  // 1) İşlemsel taban (su, kıyı köpüğü; dokular gelmezse her şey)
  for (let y0 = 0; y0 < map.height; y0 += BAND_ROWS) {
    const y1 = Math.min(map.height, y0 + BAND_ROWS);
    const img = renderSmoothTerrain(map.tiles, { pixelsPerTile: S, tileAligned: true, region: { x0: 0, y0, x1: map.width, y1 } });
    ctx.putImageData(new ImageData(img.data as unknown as Uint8ClampedArray<ArrayBuffer>, img.width, img.height), 0, y0 * S);
    onProgress?.((y1 / map.height) * (art ? 0.4 : 1));
    await nextFrame();
  }
  if (!art) return canvas;

  const at = (x: number, y: number): Tile => (x < 0 || y < 0 || x >= map.width || y >= map.height ? Tile.Water : map.tiles[y][x]);
  // Doku desenleri: bir doku kaç karoya yayılır (çim 3, patika 2, kum 3, sur 1.5, kapı 1)
  const pattern = (img: HTMLImageElement, tiles: number): CanvasPattern => {
    const p = ctx.createPattern(img, 'repeat')!;
    p.setTransform(new DOMMatrix().scale((S * tiles) / img.width));
    return p;
  };
  const pat = {
    grass: pattern(art.ground.grass, 3),
    path: pattern(art.ground.path, 2),
    sand: pattern(art.ground.sand, 3),
    wall: pattern(art.ground.wall, 1.5),
    gate: pattern(art.ground.gate, 1),
  };

  // 2) Zemin dokuları (su işlemsel kalır)
  for (let y = 0; y < map.height; y++) {
    for (let x = 0; x < map.width; x++) {
      const t = at(x, y);
      if (t === Tile.Water) continue;
      const px = x * S;
      const py = y * S;
      ctx.fillStyle = t === Tile.Path ? pat.path : t === Tile.Sand ? pat.sand : t === Tile.Wall ? pat.wall : t === Tile.Gate ? pat.gate : pat.grass;
      ctx.fillRect(px, py, S, S);
      if (t === Tile.Forest) {
        // Orman zemini: ağaçların gölgesinde koyu çim
        ctx.fillStyle = 'rgba(10,40,10,0.35)';
        ctx.fillRect(px, py, S, S);
      }
      if (t === Tile.Path || t === Tile.Sand) {
        // Kenar: patika ve kum, komşu zeminle buluştuğu yerde hafif gölgeyle ayrılır (çizgi değil, yumuşak geçiş)
        const edge = (dx: number, dy: number): boolean => at(x + dx, y + dy) !== t && at(x + dx, y + dy) !== Tile.Gate;
        const shade = (sx: number, sy: number, w: number, h: number, horizontal: boolean, flip: boolean): void => {
          const g = horizontal ? ctx.createLinearGradient(sx, 0, sx + w, 0) : ctx.createLinearGradient(0, sy, 0, sy + h);
          g.addColorStop(flip ? 1 : 0, 'rgba(30,20,10,0.32)');
          g.addColorStop(flip ? 0 : 1, 'rgba(30,20,10,0)');
          ctx.fillStyle = g;
          ctx.fillRect(sx, sy, w, h);
        };
        const e = Math.max(2, Math.round(S * 0.18));
        if (edge(-1, 0)) shade(px, py, e, S, true, false);
        if (edge(1, 0)) shade(px + S - e, py, e, S, true, true);
        if (edge(0, -1)) shade(px, py, S, e, false, false);
        if (edge(0, 1)) shade(px, py + S - e, S, e, false, true);
      }
      if (t === Tile.Wall || t === Tile.Gate) {
        // Sur: üstte ışık, önü (altında sur yoksa) gölgede: hafif 3D
        ctx.fillStyle = 'rgba(255,255,255,0.14)';
        ctx.fillRect(px, py, S, Math.round(S * 0.18));
        if (at(x, y + 1) !== Tile.Wall && at(x, y + 1) !== Tile.Gate) {
          ctx.fillStyle = 'rgba(0,0,0,0.38)';
          ctx.fillRect(px, py + Math.round(S * 0.62), S, S - Math.round(S * 0.62));
        }
        if (t === Tile.Gate) {
          ctx.strokeStyle = 'rgba(40,24,10,0.9)';
          ctx.lineWidth = 2;
          ctx.strokeRect(px + 1, py + 1, S - 2, S - 2);
          ctx.fillStyle = '#c9a24a';
          ctx.beginPath();
          ctx.arc(px + S * 0.62, py + S * 0.55, S * 0.06, 0, Math.PI * 2);
          ctx.fill();
        }
      }
    }
    if (y % 12 === 11) {
      onProgress?.(0.4 + (y / map.height) * 0.3);
      await nextFrame();
    }
  }

  // 3) Ağaçlar ve çalılar (yukarıdan aşağı: alttakiler öndekileri örter)
  for (let y = 0; y < map.height; y++) {
    for (let x = 0; x < map.width; x++) {
      const t = at(x, y);
      if (t !== Tile.Forest && t !== Tile.Thicket) continue;
      const cx = x * S + S / 2 + (hash(x, y, 1) - 0.5) * S * 0.16;
      const bottom = (y + 1) * S + (t === Tile.Forest ? S * 0.12 : S * 0.02);
      const list = t === Tile.Forest ? art.trees : art.bushes;
      const img = list[Math.floor(hash(x, y, 2) * list.length) % list.length];
      const w = S * (t === Tile.Forest ? 1.35 + hash(x, y, 3) * 0.25 : 1.05 + hash(x, y, 3) * 0.15);
      const h = (img.height / img.width) * w;
      // Gölge
      ctx.fillStyle = 'rgba(0,0,0,0.22)';
      ctx.beginPath();
      ctx.ellipse(cx + S * 0.08, bottom - S * 0.1, w * 0.42, S * 0.16, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.drawImage(img, cx - w / 2, bottom - h, w, h);
    }
    if (y % 12 === 11) {
      onProgress?.(0.7 + (y / map.height) * 0.3);
      await nextFrame();
    }
  }
  onProgress?.(1);
  return canvas;
}
