import type { Element } from '../battle/damage/elements';
import { LEGACY_SLOTS, migrateItemId } from './equipment';
import { bootsSpeed, bootsSpeedIn, gearEffects, type GearEffects, type GearResolver } from './gearEffects';
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

/** Kapasite kuralları (envanter): kimin sınır koyduğunu PlayerState bilmez, dışarıdan bağlanır. */
export interface PlayerGuards {
  /** Bu eşyadan en çok kaç tane daha eklenebilir (sınırsız = Infinity) */
  room: (id: string) => number;
  /** Ekipman değiştirmek (kuşan ya da çıkar) kapasiteye uyuyor mu? Uymuyorsa nedeni (Türkçe), uyuyorsa null. */
  canChangeGear: (slot: GearSlot, newId: string | null) => string | null;
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
  private guards: PlayerGuards | null = null;
  /** Son engellenen ekipman değişikliğinin nedeni (arayüz gösterir) */
  lastBlockReason: string | null = null;

  /** Kapasite kurallarını bağlar (envanter). Verilmezse sınır yoktur. */
  setGuards(guards: PlayerGuards | null): void {
    this.guards = guards;
  }

  /** Bu eşyadan kaç tane daha taşınabilir. */
  roomFor(id: string): number {
    return this.guards ? this.guards.room(id) : Infinity;
  }

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

  /** Kuşanılan zırh parçalarının toplam zırhı (taban değer: element bonusu yok). Üst sınırlıdır. */
  get armor(): number {
    return gearEffects(this.equippedSlots).armor;
  }

  /** Seçilen büyünün elementine göre ekipman etkisi (aynı elementteki zırh ve yüzük %50 daha güçlü). */
  gearFor(element?: Element): GearEffects {
    return gearEffects(this.equippedSlots, element);
  }

  /** Savaşçıya verilecek çözücü; ekipman sonradan değişse bile güncel durumu okur. */
  get gearResolver(): GearResolver {
    return (element) => this.gearFor(element);
  }

  /** Ayakkabıdan gelen yürüme hızı bonusu (0.1 = +%10), şehir bonusu hariç. */
  get speedBonus(): number {
    return bootsSpeed(this.equippedSlots);
  }

  /** Verilen konum elementlerinde (şehir ya da köy) yürüme hızı bonusu: kendi elementinin ayakkabısı %50 daha hızlı. */
  speedBonusIn(elements: readonly Element[]): number {
    return bootsSpeedIn(this.equippedSlots, elements);
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

  /**
   * Bilinmeyen eşya eklenmez. Yığın sınırı MAX_STACK. Kapasite yetmiyorsa hiçbiri eklenmez (false).
   */
  addItem(id: string, count = 1): boolean {
    const n = Math.floor(count);
    if (!getItem(id) || !(n > 0)) return false;
    if (n > this.roomFor(id)) return false;
    this.items.set(id, Math.min(MAX_STACK, this.count(id) + n));
    this.changed();
    return true;
  }

  /** Kapasitenin yettiği kadarını ekler; eklenen adedi döndürür (ödül ve ganimet için, fazlası çağırana kalır). */
  addItemPartial(id: string, count = 1): number {
    const n = Math.floor(count);
    if (!getItem(id) || !(n > 0)) return 0;
    const room = this.roomFor(id);
    const add = Math.max(0, Math.min(n, room, MAX_STACK - this.count(id)));
    if (add === 0) return 0;
    this.items.set(id, this.count(id) + add);
    this.changed();
    return add;
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

  /** Çantadaki bir ekipmanı kuşanır (aynı yerdekinin yerine). Kapasiteye uymuyorsa false (neden `lastBlockReason`). */
  equip(id: string): boolean {
    const item = getItem(id);
    this.lastBlockReason = null;
    if (!item?.slot || this.count(id) < 1) return false;
    const reason = this.guards?.canChangeGear(item.slot, id) ?? null;
    if (reason) {
      this.lastBlockReason = reason;
      return false;
    }
    this.equippedSlots[item.slot] = id;
    this.changed();
    return true;
  }

  /** Ekipmanı çıkarır; çanta o eşyayı taşıyacak kadar yer yoksa false (neden `lastBlockReason`). */
  unequip(slot: GearSlot): boolean {
    this.lastBlockReason = null;
    if (!this.equippedSlots[slot]) return false;
    const reason = this.guards?.canChangeGear(slot, null) ?? null;
    if (reason) {
      this.lastBlockReason = reason;
      return false;
    }
    delete this.equippedSlots[slot];
    this.changed();
    return true;
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
    // Eski ekipman kimlikleri yeni eşyalara dönüşür (aynı eşyaya düşenler toplanır)
    for (const [rawId, count] of Object.entries(snapshot?.items ?? {})) {
      const id = migrateItemId(rawId);
      const n = toInt(count, MAX_STACK);
      if (getItem(id) && n > 0) this.items.set(id, Math.min(MAX_STACK, this.count(id) + n));
    }
    this.equippedSlots = {};
    const saved = (snapshot?.equipped ?? {}) as Record<string, string | undefined>;
    for (const [rawSlot, rawId] of Object.entries(saved)) {
      const slot = (GEAR_SLOTS as readonly string[]).includes(rawSlot) ? (rawSlot as GearSlot) : LEGACY_SLOTS[rawSlot];
      const id = rawId ? migrateItemId(rawId) : undefined;
      const item = id ? getItem(id) : undefined;
      if (slot && id && item?.slot === slot && this.count(id) > 0 && !this.equippedSlots[slot]) this.equippedSlots[slot] = id;
    }
    this.changed();
  }
}
