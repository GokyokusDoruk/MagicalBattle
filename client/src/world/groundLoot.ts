/**
 * Yerdeki eşya: şehirden çıkarken bırakılan ya da çantaya sığmayan ganimet yere düşer ve **10 dakika** (oyun süresiyle,
 * oyun açıkken) kalır, sonra kaybolur. Oyuncu çantasını boşaltıp (şehirde satıp) geri gelip alabilir. Yalnızca oturumda
 * tutulur (kayda yazılmaz).
 */

export const GROUND_TTL_MS = 10 * 60 * 1000;

export interface GroundLootContent {
  /** Ticari eşya, iksir ve ekipman: eşya kimliği → adet */
  items?: Record<string, number>;
  /** Asalar: asa kimliği → adet */
  wands?: Record<string, number>;
}

export interface GroundPile {
  id: string;
  tileX: number;
  tileY: number;
  items: Record<string, number>;
  wands: Record<string, number>;
  /** Kaybolacağı an (oyun saati, ms) */
  expiresAt: number;
}

const clean = (m: Record<string, number> | undefined): Record<string, number> => {
  const out: Record<string, number> = {};
  for (const [id, n] of Object.entries(m ?? {})) {
    const c = Math.floor(n);
    if (c > 0) out[id] = c;
  }
  return out;
};

const total = (p: Pick<GroundPile, 'items' | 'wands'>): number =>
  Object.values(p.items).reduce((a, b) => a + b, 0) + Object.values(p.wands).reduce((a, b) => a + b, 0);

export class GroundLoot {
  private readonly list = new Map<string, GroundPile>();
  private readonly listeners = new Set<() => void>();
  private nextId = 1;

  constructor(
    private readonly now: () => number,
    private readonly ttlMs = GROUND_TTL_MS,
  ) {}

  onChange(listener: () => void): void {
    this.listeners.add(listener);
  }

  private changed(): void {
    this.listeners.forEach((l) => l());
  }

  /** Süresi dolanları siler; bir şey silindiyse dinleyicilere haber verir. */
  private prune(): void {
    let removed = false;
    for (const [id, p] of this.list) {
      if (p.expiresAt <= this.now()) {
        this.list.delete(id);
        removed = true;
      }
    }
    if (removed) this.changed();
  }

  /**
   * Eşyaları bir karoya bırakır. Aynı karoda zaten bir yığın varsa ona eklenir ve süre yenilenir. Boş bırakma yok sayılır.
   * Yığını (ya da null) döndürür.
   */
  drop(tileX: number, tileY: number, content: GroundLootContent): GroundPile | null {
    this.prune();
    const items = clean(content.items);
    const wands = clean(content.wands);
    if (total({ items, wands }) === 0) return null;
    let pile = [...this.list.values()].find((p) => p.tileX === tileX && p.tileY === tileY);
    if (!pile) {
      pile = { id: `yer-${this.nextId++}`, tileX, tileY, items: {}, wands: {}, expiresAt: 0 };
      this.list.set(pile.id, pile);
    }
    for (const [id, n] of Object.entries(items)) pile.items[id] = (pile.items[id] ?? 0) + n;
    for (const [id, n] of Object.entries(wands)) pile.wands[id] = (pile.wands[id] ?? 0) + n;
    pile.expiresAt = this.now() + this.ttlMs;
    this.changed();
    return pile;
  }

  /** Şu an yerdeki yığınlar (süresi dolanlar elenir). */
  piles(): GroundPile[] {
    this.prune();
    return [...this.list.values()];
  }

  get(id: string): GroundPile | undefined {
    this.prune();
    return this.list.get(id);
  }

  /** Yığının kaybolmasına kalan süre (ms); yığın yoksa 0. */
  timeLeftMs(id: string): number {
    const p = this.get(id);
    return p ? Math.max(0, p.expiresAt - this.now()) : 0;
  }

  /** Yığından bir eşya ya da asa alır (çantaya koymak çağıranın işi). Alınan adedi döndürür. Boşalan yığın silinir. */
  take(id: string, kind: 'item' | 'wand', contentId: string, count = 1): number {
    const p = this.get(id);
    if (!p) return 0;
    const bucket = kind === 'item' ? p.items : p.wands;
    const n = Math.min(Math.floor(count), bucket[contentId] ?? 0);
    if (!(n > 0)) return 0;
    bucket[contentId] -= n;
    if (bucket[contentId] === 0) delete bucket[contentId];
    if (total(p) === 0) this.list.delete(id);
    this.changed();
    return n;
  }
}
