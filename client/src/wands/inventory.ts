import type { Element } from '../battle/damage/elements';
import {
  COMMON_WAND_PRICE,
  MAX_RARITY,
  MAX_WAND_STACK,
  SLOT_KEYS,
  SYNTHESIS_COUNT,
  WANDS,
  getWand,
  slotKey,
  wandId,
  type Rarity,
  type SlotKey,
  type WandRole,
} from './catalog';

export interface WandSnapshot {
  /** Asa kimliği → adet */
  wands: Record<string, number>;
  /** Kuşanılan asalar: yuva ("fire-attack") → asa kimliği */
  wandsEquipped: Partial<Record<SlotKey, string>>;
}

/** Bir büyü için asadan gelen birleşik etki (savaşta hasar hesabına bağlanır). */
export interface WandEffects {
  /** Taban güç çarpanı (saldırı) */
  powerMultiplier: number;
  /** Alınan hasar çarpanı (savunma) */
  takenMultiplier: number;
  /** Etkin asanın kimliği; asa yoksa null */
  wandId: string | null;
}

export type WandResolver = (element: Element, role: WandRole) => WandEffects;

export const NO_WAND_EFFECTS: WandEffects = { powerMultiplier: 1, takenMultiplier: 1, wandId: null };
export const neutralWand: WandResolver = () => NO_WAND_EFFECTS;

export type Result<T = object> = ({ ok: true } & T) | { ok: false; reason: string };

const toCount = (v: unknown): number =>
  typeof v === 'number' && Number.isFinite(v) ? Math.min(MAX_WAND_STACK, Math.max(0, Math.floor(v))) : 0;

/**
 * Oyuncunun asaları: envanter, kuşanma (element ve role göre 8 yuva) ve 5 → 1 birleştirme.
 * Asa kuşanılmamışsa büyü, Sıradan asayla aynı (etkisiz) sayılır.
 */
export class WandInventory {
  private readonly counts = new Map<string, number>();
  private equippedSlots: Partial<Record<SlotKey, string>> = {};
  private readonly listeners = new Set<() => void>();

  onChange(listener: () => void): void {
    this.listeners.add(listener);
  }

  private changed(): void {
    this.listeners.forEach((l) => l());
  }

  count(id: string): number {
    return this.counts.get(id) ?? 0;
  }

  /** Sahip olunan asalar, katalog sırasında. */
  owned(): { id: string; count: number }[] {
    return WANDS.filter((w) => this.count(w.id) > 0).map((w) => ({ id: w.id, count: this.count(w.id) }));
  }

  get equipped(): Readonly<Partial<Record<SlotKey, string>>> {
    return this.equippedSlots;
  }

  equippedFor(element: Element, role: WandRole): string | null {
    return this.equippedSlots[slotKey(element, role)] ?? null;
  }

  isEquipped(id: string): boolean {
    return Object.values(this.equippedSlots).includes(id);
  }

  /** Bilinmeyen asa eklenmez. Eklenen asa yuvası boşsa ya da daha yüksek nadirlikteyse kendiliğinden kuşanılır. */
  add(id: string, count = 1): boolean {
    const n = Math.floor(count);
    const wand = getWand(id);
    if (!wand || !(n > 0)) return false;
    this.counts.set(id, Math.min(MAX_WAND_STACK, this.count(id) + n));
    this.autoEquip(id);
    this.changed();
    return true;
  }

  private autoEquip(id: string): void {
    const wand = getWand(id)!;
    const key = slotKey(wand.element, wand.role);
    const current = this.equippedSlots[key] ? getWand(this.equippedSlots[key]!) : undefined;
    if (!current || wand.rarity > current.rarity) this.equippedSlots[key] = id;
  }

  equip(id: string): boolean {
    const wand = getWand(id);
    if (!wand || this.count(id) < 1) return false;
    this.equippedSlots[slotKey(wand.element, wand.role)] = id;
    this.changed();
    return true;
  }

  unequip(element: Element, role: WandRole): void {
    const key = slotKey(element, role);
    if (!this.equippedSlots[key]) return;
    delete this.equippedSlots[key];
    this.changed();
  }

  /** Aynı asadan yeterince var mı ve üst nadirlik var mı? Değilse nedeni. */
  checkSynthesis(id: string): Result<{ result: string }> {
    const wand = getWand(id);
    if (!wand) return { ok: false, reason: 'Böyle bir asa yok.' };
    if (wand.rarity >= MAX_RARITY) return { ok: false, reason: 'Bu asa en yüksek nadirlikte.' };
    if (this.count(id) < SYNTHESIS_COUNT) {
      return { ok: false, reason: `Birleştirmek için ${SYNTHESIS_COUNT} aynı asa gerekiyor (${this.count(id)}/${SYNTHESIS_COUNT}).` };
    }
    const result = wandId(wand.element, wand.role, (wand.rarity + 1) as Rarity);
    if (this.count(result) >= MAX_WAND_STACK) return { ok: false, reason: 'Sonuç asanın yığını dolu.' };
    return { ok: true, result };
  }

  /** 5 aynı asayı bir üst nadirlikte 1 asaya çevirir. Kuşanılı asa tükenirse yuva boşalır, sonra sonuç kuşanılır. */
  synthesize(id: string): Result<{ result: string }> {
    const check = this.checkSynthesis(id);
    if (!check.ok) return check;
    const left = this.count(id) - SYNTHESIS_COUNT;
    if (left > 0) this.counts.set(id, left);
    else {
      this.counts.delete(id);
      for (const key of SLOT_KEYS) if (this.equippedSlots[key] === id) delete this.equippedSlots[key];
    }
    this.counts.set(check.result, this.count(check.result) + 1);
    this.autoEquip(check.result);
    this.changed();
    return check;
  }

  /** Bir büyü için kuşanılı asanın etkisi; asa yoksa etkisiz. */
  effects(element: Element, role: WandRole): WandEffects {
    const id = this.equippedFor(element, role);
    const wand = id ? getWand(id) : undefined;
    if (!wand || this.count(wand.id) < 1) return NO_WAND_EFFECTS;
    return { powerMultiplier: wand.powerMultiplier, takenMultiplier: wand.takenMultiplier, wandId: wand.id };
  }

  /** Savaşçıya verilecek çözücü; envanter sonradan değişse bile güncel durumu okur. */
  get resolver(): WandResolver {
    return (element, role) => this.effects(element, role);
  }

  snapshot(): WandSnapshot {
    return { wands: Object.fromEntries(this.counts), wandsEquipped: { ...this.equippedSlots } };
  }

  /** Kayıttan yükler. Bilinmeyen asalar atılır, sayılar sınırlanır, sahip olunmayan ya da yuvasına uymayan asa kuşanılmaz. */
  restore(snapshot: Partial<WandSnapshot> | undefined): void {
    this.counts.clear();
    for (const [id, count] of Object.entries(snapshot?.wands ?? {})) {
      const n = toCount(count);
      if (getWand(id) && n > 0) this.counts.set(id, n);
    }
    this.equippedSlots = {};
    for (const key of SLOT_KEYS) {
      const id = snapshot?.wandsEquipped?.[key];
      const wand = id ? getWand(id) : undefined;
      if (id && wand && slotKey(wand.element, wand.role) === key && this.count(id) > 0) this.equippedSlots[key] = id;
    }
    this.changed();
  }
}

/** Tüccardan Sıradan asa satın alır. */
export function buyCommonWand(
  inventory: WandInventory,
  gold: { balance: () => number; spend: (n: number) => boolean },
  id: string,
  priceMultiplier = 1,
): Result<{ price: number }> {
  const wand = getWand(id);
  if (!wand || wand.rarity !== 1) return { ok: false, reason: 'Tüccar yalnızca Sıradan asa satar.' };
  const price = Math.max(1, Math.round(COMMON_WAND_PRICE * priceMultiplier));
  if (inventory.count(id) >= MAX_WAND_STACK) return { ok: false, reason: 'Bu asadan daha fazla taşıyamazsın.' };
  if (gold.balance() < price) return { ok: false, reason: 'Yeterli altının yok.' };
  if (!gold.spend(price)) return { ok: false, reason: 'Yeterli altının yok.' };
  inventory.add(id, 1);
  return { ok: true, price };
}
