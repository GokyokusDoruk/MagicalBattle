export interface Vec2 {
  x: number;
  y: number;
}

/** Karakterin çarpışma kutusunun yarı genişliği/yüksekliği (merkezden). */
export interface HalfSize {
  hw: number;
  hh: number;
}

const EPS = 0.001;

function overlapsBlocked(
  x: number,
  y: number,
  half: HalfSize,
  tileSize: number,
  isBlocked: (tx: number, ty: number) => boolean,
): boolean {
  const x0 = Math.floor((x - half.hw) / tileSize);
  const x1 = Math.floor((x + half.hw - EPS) / tileSize);
  const y0 = Math.floor((y - half.hh) / tileSize);
  const y1 = Math.floor((y + half.hh - EPS) / tileSize);
  for (let ty = y0; ty <= y1; ty++) {
    for (let tx = x0; tx <= x1; tx++) if (isBlocked(tx, ty)) return true;
  }
  return false;
}

/**
 * Konumu `delta` kadar ilerletir. Büyük hareketler (düşük FPS) yarım karodan
 * küçük adımlara bölünür, böylece duvarın içinden geçilemez.
 */
export function moveWithCollision(
  pos: Vec2,
  delta: Vec2,
  half: HalfSize,
  tileSize: number,
  isBlocked: (tx: number, ty: number) => boolean,
): Vec2 {
  const steps = Math.max(1, Math.ceil(Math.max(Math.abs(delta.x), Math.abs(delta.y)) / (tileSize / 2)));
  let current = pos;
  for (let i = 0; i < steps; i++) {
    current = stepWithCollision(current, { x: delta.x / steps, y: delta.y / steps }, half, tileSize, isBlocked);
  }
  return current;
}

/**
 * Tek bir küçük adım (en fazla yarım karo). Eksenler ayrı çözülür, böylece duvara
 * çapraz sürtünürken kayarak devam edilir. Engel karoya yaslanır (boşluk kalmaz).
 */
function stepWithCollision(
  pos: Vec2,
  delta: Vec2,
  half: HalfSize,
  tileSize: number,
  isBlocked: (tx: number, ty: number) => boolean,
): Vec2 {
  let { x, y } = pos;

  if (delta.x !== 0) {
    const nx = x + delta.x;
    if (!overlapsBlocked(nx, y, half, tileSize, isBlocked)) {
      x = nx;
    } else if (delta.x > 0) {
      x = Math.floor((nx + half.hw - EPS) / tileSize) * tileSize - half.hw;
    } else {
      x = (Math.floor((nx - half.hw) / tileSize) + 1) * tileSize + half.hw;
    }
  }

  if (delta.y !== 0) {
    const ny = y + delta.y;
    if (!overlapsBlocked(x, ny, half, tileSize, isBlocked)) {
      y = ny;
    } else if (delta.y > 0) {
      y = Math.floor((ny + half.hh - EPS) / tileSize) * tileSize - half.hh;
    } else {
      y = (Math.floor((ny - half.hh) / tileSize) + 1) * tileSize + half.hh;
    }
  }

  return { x, y };
}
