import { ARMOR_CAP } from '../battle/damage/config';
import { GEAR_SLOTS, getItem, type GearSlot } from './items';
import { levelForXp } from './leveling';

export const MAX_GOLD = 9_999_999;
export const MAX_XP = 1_000_000;
export const MAX_STACK = 999;

export interface EconomySnapshot {
  gold: number;
  xp: number;
  items: Record<string, number>;
  equipped: Partial<Record<GearSlot, string>>;
}

const toInt = (v: unknown, max: number): number =>
  typeof v === 'number' && Number.isFinite(v) ? Math.min(max, Math.max(0, Math.floor(v))) : 0;

/**
 * Oyuncunun ekonomisi: altın, XP/seviye, çanta ve kuşanılan ekipman. Arayüzden bağımsızdır;
 * değişince `onChange` dinleyicilerini çağırır (durum çubuğu, tüccar ekranı).
 */
export class PlayerState {
  private goldValue = 0;
  private xpValue = 0;
  private readonly items = new Map<string, number>();
  private equippedSlots: Partial<Record<GearSlot, string>> = {};
  private readonly listeners = new Set<() => void>();

  get gold(): number {
    return this.goldValue;
  }

  get xp(): number {
    return this.xpValue;
  }

  get level(): number {
    return levelForXp(this.xpValue);
  }

  get equipped(): Readonly<Partial<Record<GearSlot, string>>> {
    return this.equippedSlots;
  }

  /** Kuşanılan ekipmanların toplam zırhı (tek bir hasar azaltma yüzdesi, üst sınırlı). */
  get armor(): number {
    let total = 0;
    for (const id of Object.values(this.equippedSlots)) total += getItem(id)?.armor ?? 0;
    return Math.min(ARMOR_CAP, total);
  }

  onChange(listener: () => void): void {
    this.listeners.add(listener);
  }

  private changed(): void {
    this.listeners.forEach((l) => l());
  }

  count(id: string): number {
    return this.items.get(id) ?? 0;
  }

  /** Çantadaki eşyalar (ad sırasına göre). */
  inventory(): { id: string; count: number }[] {
    return [...this.items.entries()].map(([id, count]) => ({ id, count })).sort((a, b) => a.id.localeCompare(b.id));
  }

  addGold(amount: number): void {
    const n = Math.floor(amount);
    if (!(n > 0)) return;
    this.goldValue = Math.min(MAX_GOLD, this.goldValue + n);
    this.changed();
  }

  /** Yeterli altın varsa harcar. */
  spendGold(amount: number): boolean {
    const n = Math.floor(amount);
    if (!(n >= 0) || n > this.goldValue) return false;
    this.goldValue -= n;
    this.changed();
    return true;
  }

  /** XP ekler; kaç seviye atlandığını döndürür. */
  addXp(amount: number): number {
    const n = Math.floor(amount);
    if (!(n > 0)) return 0;
    const before = this.level;
    this.xpValue = Math.min(MAX_XP, this.xpValue + n);
    this.changed();
    return this.level - before;
  }

  /** Bilinmeyen eşya eklenmez. Yığın sınırı MAX_STACK. */
  addItem(id: string, count = 1): boolean {
    const n = Math.floor(count);
    if (!getItem(id) || !(n > 0)) return false;
    this.items.set(id, Math.min(MAX_STACK, this.count(id) + n));
    this.changed();
    return true;
  }

  removeItem(id: string, count = 1): boolean {
    const n = Math.floor(count);
    if (!(n > 0) || this.count(id) < n) return false;
    const left = this.count(id) - n;
    if (left === 0) this.items.delete(id);
    else this.items.set(id, left);
    this.changed();
    return true;
  }

  /** Çantadaki bir ekipmanı kuşanır (aynı yerdekinin yerine). */
  equip(id: string): boolean {
    const item = getItem(id);
    if (!item?.slot || this.count(id) < 1) return false;
    this.equippedSlots[item.slot] = id;
    this.changed();
    return true;
  }

  unequip(slot: GearSlot): void {
    if (!this.equippedSlots[slot]) return;
    delete this.equippedSlots[slot];
    this.changed();
  }

  isEquipped(id: string): boolean {
    return Object.values(this.equippedSlots).includes(id);
  }

  snapshot(): EconomySnapshot {
    return {
      gold: this.goldValue,
      xp: this.xpValue,
      items: Object.fromEntries(this.items),
      equipped: { ...this.equippedSlots },
    };
  }

  /** Kayıttan yükler. Bilinmeyen eşyalar atılır, sayılar sınırlara çekilir, sahip olunmayan ekipman kuşanılmaz. */
  restore(snapshot: Partial<EconomySnapshot> | undefined): void {
    this.goldValue = toInt(snapshot?.gold, MAX_GOLD);
    this.xpValue = toInt(snapshot?.xp, MAX_XP);
    this.items.clear();
    for (const [id, count] of Object.entries(snapshot?.items ?? {})) {
      const n = toInt(count, MAX_STACK);
      if (getItem(id) && n > 0) this.items.set(id, n);
    }
    this.equippedSlots = {};
    for (const slot of GEAR_SLOTS) {
      const id = snapshot?.equipped?.[slot];
      const item = id ? getItem(id) : undefined;
      if (id && item?.slot === slot && this.count(id) > 0) this.equippedSlots[slot] = id;
    }
    this.changed();
  }
}
