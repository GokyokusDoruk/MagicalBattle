import type { WorldMap } from './generateMap';
import { renderSmoothTerrain } from './smoothTerrain';

/** Arazi görselinin karo başına piksel sayısı (oyunda 32 piksellik karoya yumuşakça büyütülür) */
export const TERRAIN_PIXELS_PER_TILE = 12;
/** Bir seferde çizilen karo satırı sayısı (arayüz donmasın diye parça parça) */
const BAND_ROWS = 6;

const nextFrame = (): Promise<void> => new Promise((r) => setTimeout(r, 0));

/**
 * Haritanın yumuşak arazi görselini bir tuvale çizer. İşi parçalara böler ve araya boşluk bırakır, böylece
 * "Dünya oluşturuluyor" yazısı canlı kalır. `onProgress` 0-1 arası ilerlemeyi bildirir.
 */
export async function buildTerrainCanvas(map: WorldMap, onProgress?: (ratio: number) => void): Promise<HTMLCanvasElement> {
  const S = TERRAIN_PIXELS_PER_TILE;
  const canvas = document.createElement('canvas');
  canvas.width = map.width * S;
  canvas.height = map.height * S;
  const ctx = canvas.getContext('2d')!;
  for (let y0 = 0; y0 < map.height; y0 += BAND_ROWS) {
    const y1 = Math.min(map.height, y0 + BAND_ROWS);
    const img = renderSmoothTerrain(map.tiles, { pixelsPerTile: S, region: { x0: 0, y0, x1: map.width, y1 } });
    ctx.putImageData(new ImageData(img.data as unknown as Uint8ClampedArray<ArrayBuffer>, img.width, img.height), 0, y0 * S);
    onProgress?.(y1 / map.height);
    await nextFrame();
  }
  return canvas;
}
