import type { Element } from '../battle/damage/elements';
import { MAX_WAND_STACK, getWand, normalizeWandId, wandEffect, type WandDef, type WandRole } from './catalog';

export interface WandSnapshot {
  /** Asa kimliği → adet (kimlik element, rol, nadirlik ve seviyeyi taşır) */
  wands: Record<string, number>;
  /** Kuşanılı tek asa; yoksa null */
  wandEquipped: string | null;
}

/** Bir büyü için asadan gelen birleşik etki (savaşta hasar ve çizim süresine bağlanır). */
export interface WandEffects {
  /** Taban güç (hasar) çarpanı */
  powerMultiplier: number;
  /** Alınan hasar çarpanı */
  takenMultiplier: number;
  /** Çizim süresine eklenen saniye */
  timeBonusSec: number;
  /** Etkin asanın kimliği; asa yoksa null */
  wandId: string | null;
  /** Faz 6: asanın alan gücü (hücre); asa yoksa 0 */
  areaCells?: number;
}

/** (büyünün elementi, aşama): saldırı çizerken 'attack', savunma çizerken 'defense' */
export type WandResolver = (element: Element, phase: WandRole) => WandEffects;

export const NO_WAND_EFFECTS: WandEffects = { powerMultiplier: 1, takenMultiplier: 1, timeBonusSec: 0, wandId: null };
export const neutralWand: WandResolver = () => NO_WAND_EFFECTS;

export type Result<T = object> = ({ ok: true } & T) | { ok: false; reason: string };

const toCount = (v: unknown): number =>
  typeof v === 'number' && Number.isFinite(v) ? Math.min(MAX_WAND_STACK, Math.max(0, Math.floor(v))) : 0;

/**
 * Oyuncunun asaları: envanter, TEK kuşanılı asa, ve seviye şartı.
 *  - Asa, oyuncu seviyesi asanın seviyesine ulaşana kadar kuşanılamaz (yüksek seviye oyuncu düşük seviye asayı kullanabilir).
 *  - Kuşanılı asa çantada yer kaplamaz, taşınanlar kaplar.
 *  - Asa kuşanılmamışsa büyü etkisizdir (x1).
 */
export class WandInventory {
  private readonly counts = new Map<string, number>();
  private equippedId: string | null = null;
  private readonly listeners = new Set<() => void>();
  private limit: ((carried: number) => boolean) | null = null;
  private levelOf: () => number = () => 99;
  /** Son engellenen kuşanma/çıkarma işleminin nedeni (arayüz gösterir) */
  lastBlockReason: string | null = null;

  onChange(listener: () => void): void {
    this.listeners.add(listener);
  }

  private changed(): void {
    this.listeners.forEach((l) => l());
  }

  /** Kapasite kuralı: taşınan (kuşanılmamış) asa sayısı `carried` olursa izin var mı? Verilmezse sınır yoktur. */
  setLimit(limit: ((carried: number) => boolean) | null): void {
    this.limit = limit;
  }

  /** Oyuncu seviyesi (asa seviye şartı için). Verilmezse şart yoktur. */
  setLevelProvider(levelOf: () => number): void {
    this.levelOf = levelOf;
  }

  count(id: string): number {
    return this.counts.get(id) ?? 0;
  }

  /** Taşınan asa sayısı: toplam asa eksi kuşanılı olan (kuşanılı asa çantada yer kaplamaz). */
  get carried(): number {
    let total = 0;
    for (const n of this.counts.values()) total += n;
    return total - (this.equippedId ? 1 : 0);
  }

  /** Sahip olunan asalar: kuşanılan önce, sonra nadirlik ve seviyeye göre yüksekten düşüğe. */
  owned(): { id: string; count: number }[] {
    return [...this.counts.entries()]
      .map(([id, count]) => ({ id, count }))
      .sort((a, b) => {
        if (a.id === this.equippedId) return -1;
        if (b.id === this.equippedId) return 1;
        const wa = getWand(a.id)!;
        const wb = getWand(b.id)!;
        return wb.rarity - wa.rarity || wb.level - wa.level || a.id.localeCompare(b.id);
      });
  }

  get equipped(): string | null {
    return this.equippedId;
  }

  get equippedWand(): WandDef | null {
    return this.equippedId ? (getWand(this.equippedId) ?? null) : null;
  }

  isEquipped(id: string): boolean {
    return this.equippedId === id;
  }

  /** Oyuncunun seviyesi bu asayı kullanmaya yetiyor mu? */
  usable(id: string): boolean {
    const wand = getWand(id);
    return !!wand && wand.level <= this.levelOf();
  }

  /** Bu asa kuşanılabilir mi? Değilse nedeni (Türkçe). */
  checkEquip(id: string): string | null {
    const wand = getWand(id);
    if (!wand) return 'Böyle bir asa yok.';
    if (this.count(id) < 1) return 'Bu asaya sahip değilsin.';
    if (wand.level > this.levelOf()) return `Bu asayı kullanmak için ${wand.level}. seviye gerekiyor.`;
    return null;
  }

  /** Bu asadan `count` tane eklenebilir mi (kapasite)? Kuşanılacaksa çantada yer kaplamaz. */
  canAdd(id: string, count = 1): boolean {
    const n = Math.floor(count);
    if (!getWand(id) || !(n > 0)) return false;
    if (!this.limit) return true;
    const willEquip = this.equippedId === null && this.usable(id);
    return this.limit(this.carried + n - (willEquip ? 1 : 0));
  }

  /** Bilinmeyen asa eklenmez, kapasite yetmezse hiçbiri eklenmez. Elde asa yoksa kullanılabilir olan kendiliğinden kuşanılır. */
  add(id: string, count = 1): boolean {
    const n = Math.floor(count);
    if (!getWand(id) || !(n > 0)) return false;
    if (!this.canAdd(id, n)) return false;
    const wasEmpty = this.equippedId === null;
    this.counts.set(id, Math.min(MAX_WAND_STACK, this.count(id) + n));
    if (wasEmpty && this.usable(id)) this.equippedId = id;
    this.changed();
    return true;
  }

  /** Çantadan asa çıkarır (bırakmak için). Kuşanılı asanın son kopyası çıkarılamaz. Başarılıysa true. */
  remove(id: string, count = 1): boolean {
    const n = Math.floor(count);
    if (!(n > 0) || this.count(id) < n) return false;
    if (this.equippedId === id && this.count(id) - n < 1) return false;
    const left = this.count(id) - n;
    if (left > 0) this.counts.set(id, left);
    else this.counts.delete(id);
    this.changed();
    return true;
  }

  /** Asayı kuşanır (öncekinin yerine). Seviye yetmiyorsa false, neden `lastBlockReason`. */
  equip(id: string): boolean {
    this.lastBlockReason = this.checkEquip(id);
    if (this.lastBlockReason) return false;
    this.equippedId = id;
    this.changed();
    return true;
  }

  /** Asayı çıkarır; çantada yer yoksa false. */
  unequip(): boolean {
    this.lastBlockReason = null;
    if (!this.equippedId) return false;
    if (this.limit && !this.limit(this.carried + 1)) {
      this.lastBlockReason = 'Çantanda asa için yer yok.';
      return false;
    }
    this.equippedId = null;
    this.changed();
    return true;
  }

  /** Bir büyü için kuşanılı asanın etkisi; asa yoksa ya da seviye yetmiyorsa etkisiz. */
  effects(element: Element, phase: WandRole): WandEffects {
    const wand = this.equippedWand;
    if (!wand || wand.level > this.levelOf()) return NO_WAND_EFFECTS;
    const e = wandEffect(wand, element, phase);
    return { powerMultiplier: e.powerMultiplier, takenMultiplier: e.takenMultiplier, timeBonusSec: e.timeBonusSec, wandId: wand.id, areaCells: e.areaCells };
  }

  /** Savaşçıya verilecek çözücü; envanter sonradan değişse bile güncel durumu okur. */
  get resolver(): WandResolver {
    return (element, phase) => this.effects(element, phase);
  }

  snapshot(): WandSnapshot {
    return { wands: Object.fromEntries(this.counts), wandEquipped: this.equippedId };
  }

  /**
   * Kayıttan yükler. Bilinmeyen asalar atılır, sayılar sınırlanır, sahip olunmayan asa kuşanılmaz. Eski (v5 ve öncesi)
   * kayıtlarda seviyesiz kimlikler seviye 1 olur ve 8 yuvalı kuşanma listesinden en nadir asa seçilir.
   */
  restore(snapshot: (Partial<WandSnapshot> & { wandsEquipped?: Record<string, string> }) | undefined): void {
    this.counts.clear();
    for (const [rawId, count] of Object.entries(snapshot?.wands ?? {})) {
      const id = normalizeWandId(rawId);
      const n = toCount(count);
      if (id && n > 0) this.counts.set(id, Math.min(MAX_WAND_STACK, this.count(id) + n));
    }
    let equipped: string | null = null;
    if (typeof snapshot?.wandEquipped === 'string') equipped = normalizeWandId(snapshot.wandEquipped);
    else if (snapshot?.wandsEquipped) {
      // Eski biçim: yuva → asa. En yüksek nadirlikteki sahip olunan asa seçilir.
      let best: WandDef | null = null;
      for (const rawId of Object.values(snapshot.wandsEquipped)) {
        const id = normalizeWandId(rawId);
        const w = id ? getWand(id) : undefined;
        if (w && this.count(w.id) > 0 && (!best || w.rarity > best.rarity)) best = w;
      }
      equipped = best?.id ?? null;
    }
    this.equippedId = equipped && this.count(equipped) > 0 ? equipped : null;
    this.changed();
  }
}
