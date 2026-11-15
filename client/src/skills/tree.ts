import type { Element } from '../battle/damage/elements';
import { CARRY_SKILLS, MAX_SKILL_LEVEL, SKILLS, SKILL_POINT_COST, SP_PER_LEVEL, getCarrySkill, getSkill, type SpellRole } from './catalog';
import { resolvePassives, resolveSpell, type Passives, type SpellEffects, type SpellResolver } from './resolver';

/** Yetenekleri sıfırlamanın toplam bedeli: seviye başına bu kadar değer; dört para biriminden her biri dörtte birini öder (hiç yetenek yoksa bedava) */
export const RESET_COST_PER_LEVEL = 25;

export type LearnCheck = { ok: true } | { ok: false; reason: string };

/**
 * Oyuncunun yetenek ağacı. Puan, karakter seviyesinden gelir (2. seviyeden itibaren seviye başına 2 puan).
 * Element yeteneklerinin her biri 3 seviyelidir; açmak ve her seviyeyi artırmak 1 puandır. Taşıyıcı dalı (3 kademe)
 * sırayla alınır. Arayüzden bağımsızdır.
 */
export class SkillTree {
  private readonly levelMap = new Map<string, number>();
  private readonly carryIds = new Set<string>();
  private readonly listeners = new Set<() => void>();

  constructor(private readonly levelOf: () => number) {}

  /** Element yeteneklerinin seviyeleri (id → 1-3) */
  get levels(): ReadonlyMap<string, number> {
    return this.levelMap;
  }

  get owned(): ReadonlySet<string> {
    return this.carryIds;
  }

  onChange(listener: () => void): void {
    this.listeners.add(listener);
  }

  private changed(): void {
    this.listeners.forEach((l) => l());
  }

  get pointsTotal(): number {
    return SP_PER_LEVEL * Math.max(0, Math.floor(this.levelOf()) - 1);
  }

  get pointsSpent(): number {
    let spent = 0;
    for (const lv of this.levelMap.values()) spent += lv * SKILL_POINT_COST;
    for (const id of this.carryIds) spent += getCarrySkill(id)?.cost ?? 0;
    return spent;
  }

  get pointsFree(): number {
    return Math.max(0, this.pointsTotal - this.pointsSpent);
  }

  /** Sahip olunan seviye (0 = hiç alınmadı) */
  level(id: string): number {
    return this.levelMap.get(id) ?? 0;
  }

  has(id: string): boolean {
    return this.carryIds.has(id) || this.level(id) > 0;
  }

  /** Yetenek alınabilir ya da bir seviye artırılabilir mi? Değilse nedeni (Türkçe). */
  check(id: string): LearnCheck {
    const carry = getCarrySkill(id);
    if (carry) {
      if (this.carryIds.has(id)) return { ok: false, reason: 'Bu yeteneği zaten aldın.' };
      if (carry.tier > 1 && !this.carryIds.has(`carry-${carry.tier - 1}`)) return { ok: false, reason: 'Önce bir önceki kademeyi almalısın.' };
      if (carry.cost > this.pointsFree) return { ok: false, reason: `${carry.cost} yetenek puanı gerekiyor.` };
      return { ok: true };
    }
    const skill = getSkill(id);
    if (!skill) return { ok: false, reason: 'Böyle bir yetenek yok.' };
    if (skill.passive) return { ok: false, reason: 'Bu pasif yetenek puanla alınmaz: ilgili elementin asasını kuşan, asanın seviyesiyle gelişir.' };
    if (this.level(id) >= MAX_SKILL_LEVEL) return { ok: false, reason: 'Bu yetenek zaten en üst seviyede.' };
    if (SKILL_POINT_COST > this.pointsFree) return { ok: false, reason: `${SKILL_POINT_COST} yetenek puanı gerekiyor.` };
    return { ok: true };
  }

  /** Yeteneği açar ya da bir seviye artırır. */
  learn(id: string): boolean {
    if (!this.check(id).ok) return false;
    if (getCarrySkill(id)) this.carryIds.add(id);
    else this.levelMap.set(id, this.level(id) + 1);
    this.changed();
    return true;
  }

  private get isEmpty(): boolean {
    return this.levelMap.size === 0 && this.carryIds.size === 0;
  }

  /** Sıfırlamanın toplam bedeli; hiç yetenek yoksa 0. */
  get resetCost(): number {
    return this.isEmpty ? 0 : RESET_COST_PER_LEVEL * Math.max(1, Math.floor(this.levelOf()));
  }

  /** Her para biriminden alınacak miktar (toplam bedelin dörtte biri, yukarı yuvarlanır). */
  get resetCostEach(): number {
    return Math.ceil(this.resetCost / 4);
  }

  /** Tüm yetenekleri geri verir (bedeli çağıran öder). */
  reset(): void {
    if (this.isEmpty) return;
    this.levelMap.clear();
    this.carryIds.clear();
    this.changed();
  }

  /** Taşıyıcı yeteneklerinin kapasiteye kattığı toplam (asa, eşya, kuşanılabilir). */
  get carryBonus(): { wands: number; goods: number; gear: number } {
    const total = { wands: 0, goods: 0, gear: 0 };
    for (const s of CARRY_SKILLS) {
      if (!this.carryIds.has(s.id)) continue;
      total.wands += s.bonus.wands;
      total.goods += s.bonus.goods;
      total.gear += s.bonus.gear;
    }
    return total;
  }

  /** Bir büyü için birleşik etki (hasar hesabına bağlanır). */
  resolve(element: Element, role: SpellRole): SpellEffects {
    return resolveSpell(this.levelMap, element, role);
  }

  /** Puanla alınan pasif yok (Yanık İzi ve Sarsıntılı Rüzgâr asa seviyesine bağlıdır: bkz. `wandBattlePassives`). Her zaman boş. */
  get passives(): Passives {
    return resolvePassives(this.levelMap);
  }

  /** Savaşçıya verilecek çözücü; ağaç sonradan değişse bile güncel durumu okur. */
  get resolver(): SpellResolver {
    return (element, role) => this.resolve(element, role);
  }

  /** Kayıt için: `<yetenek>-<seviye>` (örn. `fire-burn-2`) ve taşıyıcı kimlikleri, katalog sırasında. */
  snapshot(): string[] {
    return [
      ...SKILLS.filter((s) => this.level(s.id) > 0).map((s) => `${s.id}-${this.level(s.id)}`),
      ...CARRY_SKILLS.filter((s) => this.carryIds.has(s.id)).map((s) => s.id),
    ];
  }

  /**
   * Kayıttan yükler. Bilinmeyen kimlikler (eski yetenekler dahil; puanları otomatik iade olur), sırasız taşıyıcı
   * kademeleri ve puanı aşan yetenekler atılır.
   */
  restore(ids: readonly string[] | undefined): void {
    this.levelMap.clear();
    this.carryIds.clear();
    const wantedLevels = new Map<string, number>();
    const wantedCarry = new Set<string>();
    for (const raw of ids ?? []) {
      if (getCarrySkill(raw)) {
        wantedCarry.add(raw);
        continue;
      }
      const m = /^(.+)-([1-3])$/.exec(raw);
      // Pasifler artık asa seviyesine bağlı: eski kayıttaki puanları iade olur
      if (!m || !getSkill(m[1]) || getSkill(m[1])!.passive) continue;
      wantedLevels.set(m[1], Math.max(wantedLevels.get(m[1]) ?? 0, Number(m[2])));
    }
    for (const c of CARRY_SKILLS) {
      if (wantedCarry.has(c.id) && this.check(c.id).ok) this.carryIds.add(c.id);
    }
    for (const s of SKILLS) {
      const want = wantedLevels.get(s.id) ?? 0;
      for (let i = 0; i < want && this.check(s.id).ok; i++) this.levelMap.set(s.id, this.level(s.id) + 1);
    }
    this.changed();
  }
}
