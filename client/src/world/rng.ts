/** Aynı tohum her zaman aynı diziyi verir (harita ve ileride sunucu için tekrarlanabilirlik). */
export function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Izgara noktası için 0-1 arası sabit değer. */
function lattice(seed: number, x: number, y: number): number {
  let h = Math.imul(x, 374761393) ^ Math.imul(y, 668265263) ^ Math.imul(seed, 2246822519);
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
}

const smooth = (t: number): number => t * t * (3 - 2 * t);

/** Yumuşak "value noise": (x, y) için 0-1 arası değer. */
export function valueNoise(seed: number, x: number, y: number): number {
  const x0 = Math.floor(x);
  const y0 = Math.floor(y);
  const fx = smooth(x - x0);
  const fy = smooth(y - y0);
  const top = lattice(seed, x0, y0) * (1 - fx) + lattice(seed, x0 + 1, y0) * fx;
  const bottom = lattice(seed, x0, y0 + 1) * (1 - fx) + lattice(seed, x0 + 1, y0 + 1) * fx;
  return top * (1 - fy) + bottom * fy;
}
