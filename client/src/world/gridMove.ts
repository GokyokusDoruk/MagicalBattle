import { TILE_SIZE } from './tiles';

export interface TilePos {
  x: number;
  y: number;
}

export type Facing = 'up' | 'down' | 'left' | 'right';

/** Bir karo adımının süresi (ms), hız çarpanı 1 iken. Eski sürekli hareketin hızına yakındır (~5 karo/sn). */
export const STEP_MS = 190;
/** Tek karede işlenen en uzun süre (ms): sekme uykudan dönünce karakter ışınlanmasın */
const MAX_FRAME_MS = 250;

/**
 * Kare kare hareket (Task 39): karakter karo karo, yalnızca yukarı, aşağı, sağ ve sol gider. Tuşa basılı tutulunca
 * adımlar peş peşe devam eder (kesintisiz akar). Hedef karo engelse karakter dönmeye devam eder ama yürümez.
 * Hız çarpanı (ayakkabı, hava asası) adım süresini kısaltır. Phaser'dan bağımsızdır, testlenebilir.
 */
export class GridMover {
  /** Son varılan (mantıksal) karo */
  tile: TilePos;
  /** Yürüme sürüyorsa hedef karo */
  target: TilePos | null = null;
  /** Adımın ilerlemesi (0-1) */
  progress = 0;
  facing: Facing = 'down';

  constructor(
    start: TilePos,
    private readonly isBlocked: (x: number, y: number) => boolean,
    /** Bir adım tamamlanıp yeni karoya varıldığında */
    private readonly onArrive?: (tile: TilePos) => void,
  ) {
    this.tile = { ...start };
  }

  get moving(): boolean {
    return this.target !== null;
  }

  /** Karoyu anında değiştirir (ışınlanma, kayıttan yükleme): adım iptal olur, varış bildirilmez. */
  teleport(tile: TilePos): void {
    this.tile = { ...tile };
    this.target = null;
    this.progress = 0;
  }

  /** Dünya koordinatında (piksel) konum: adım sırasında iki karo merkezi arasında yumuşakça ilerler. */
  position(): { x: number; y: number } {
    const cx = this.tile.x * TILE_SIZE + TILE_SIZE / 2;
    const cy = this.tile.y * TILE_SIZE + TILE_SIZE / 2;
    if (!this.target) return { x: cx, y: cy };
    const e = this.progress < 0.5 ? 2 * this.progress * this.progress : 1 - Math.pow(-2 * this.progress + 2, 2) / 2; // easeInOut
    const k = this.linear ? this.progress : e;
    return {
      x: cx + (this.target.x - this.tile.x) * TILE_SIZE * k,
      y: cy + (this.target.y - this.tile.y) * TILE_SIZE * k,
    };
  }

  /** Peş peşe adımlarda hız sabit kalsın diye hareket sürerken doğrusal ilerler. */
  private linear = false;

  /**
   * `axis` yön girdisidir (-1..1); baskın eksen seçilir (eşitlikte yatay). Geçen süre `dtMs`, hız çarpanı `speed`.
   * Kare süresi uzunsa birden fazla adım atılabilir (düşük FPS'te geride kalmaz).
   */
  update(dtMs: number, axis: { x: number; y: number }, speed = 1): void {
    const stepMs = STEP_MS / Math.max(0.1, speed);
    let left = Math.min(dtMs, MAX_FRAME_MS);
    let guard = 0;
    while (guard++ < 8) {
      if (!this.target) {
        const dir = this.pick(axis);
        if (!dir) return;
        this.facing = dir.facing;
        const next = { x: this.tile.x + dir.dx, y: this.tile.y + dir.dy };
        if (this.isBlocked(next.x, next.y)) return; // engel: yürümez
        this.target = next;
        this.progress = 0;
      }
      const need = (1 - this.progress) * stepMs;
      if (left < need) {
        this.progress += left / stepMs;
        // Hareket sürüyor: yeni adım hemen başlayacaksa doğrusal akış; bırakılırsa duruş yumuşar
        this.linear = this.pick(axis) !== null;
        return;
      }
      left -= need;
      const arrived = this.target;
      this.tile = arrived;
      this.target = null;
      this.progress = 0;
      this.onArrive?.(arrived);
      if (left <= 0 && !this.pick(axis)) return;
    }
  }

  private pick(axis: { x: number; y: number }): { dx: number; dy: number; facing: Facing } | null {
    const ax = Math.abs(axis.x);
    const ay = Math.abs(axis.y);
    if (ax < 0.3 && ay < 0.3) return null; // ölü bölge
    if (ax >= ay) return axis.x > 0 ? { dx: 1, dy: 0, facing: 'right' } : { dx: -1, dy: 0, facing: 'left' };
    return axis.y > 0 ? { dx: 0, dy: 1, facing: 'down' } : { dx: 0, dy: -1, facing: 'up' };
  }
}
