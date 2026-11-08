import type { Element } from '../battle/damage/elements';
import { CARRY_SKILLS, SKILLS, SP_PER_LEVEL, TIERS, getCarrySkill, getSkill, skillId, type BranchKind, type SkillDef, type SpellRole } from './catalog';
import { resolveSpell, type SpellEffects, type SpellResolver } from './resolver';

/** Yetenekleri sıfırlamanın bedeli: seviye başına bu kadar altın (hiç yetenek yoksa bedava) */
export const RESET_GOLD_PER_LEVEL = 25;

export type LearnCheck = { ok: true } | { ok: false; reason: string };

/**
 * Oyuncunun yetenek ağacı. Puan, karakter seviyesinden gelir (2. seviyeden itibaren seviye başına 2 puan).
 * Her dalda kademeler sırayla alınır (Seviye 1 → Seviye 2 → Ustalık). Arayüzden bağımsızdır.
 */
export class SkillTree {
  private readonly ownedIds = new Set<string>();
  private readonly listeners = new Set<() => void>();

  constructor(private readonly levelOf: () => number) {}

  get owned(): ReadonlySet<string> {
    return this.ownedIds;
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
    for (const id of this.ownedIds) spent += getSkill(id)?.cost ?? getCarrySkill(id)?.cost ?? 0;
    return spent;
  }

  get pointsFree(): number {
    return Math.max(0, this.pointsTotal - this.pointsSpent);
  }

  has(id: string): boolean {
    return this.ownedIds.has(id);
  }

  /** Dalda sahip olunan kademe sayısı (0-3) */
  rank(element: Element, branch: BranchKind): number {
    let rank = 0;
    for (const tier of TIERS) {
      if (!this.ownedIds.has(skillId(element, branch, tier))) break;
      rank = tier;
    }
    return rank;
  }

  /** Yetenek alınabilir mi? Değilse nedeni (Türkçe). */
  check(id: string): LearnCheck {
    const carry = getCarrySkill(id);
    if (carry) {
      if (this.ownedIds.has(id)) return { ok: false, reason: 'Bu yeteneği zaten aldın.' };
      if (carry.tier > 1 && !this.ownedIds.has(`carry-${carry.tier - 1}`)) return { ok: false, reason: 'Önce bir önceki kademeyi almalısın.' };
      if (carry.cost > this.pointsFree) return { ok: false, reason: `${carry.cost} yetenek puanı gerekiyor.` };
      return { ok: true };
    }
    const skill = getSkill(id);
    if (!skill) return { ok: false, reason: 'Böyle bir yetenek yok.' };
    if (this.ownedIds.has(id)) return { ok: false, reason: 'Bu yeteneği zaten aldın.' };
    if (skill.tier > 1 && !this.ownedIds.has(skillId(skill.element, skill.branch, (skill.tier - 1) as 1 | 2))) {
      return { ok: false, reason: 'Önce bir önceki kademeyi almalısın.' };
    }
    if (skill.cost > this.pointsFree) return { ok: false, reason: `${skill.cost} yetenek puanı gerekiyor.` };
    return { ok: true };
  }

  learn(id: string): boolean {
    if (!this.check(id).ok) return false;
    this.ownedIds.add(id);
    this.changed();
    return true;
  }

  /** Sıfırlamanın altın bedeli; hiç yetenek yoksa 0. */
  get resetCost(): number {
    return this.ownedIds.size === 0 ? 0 : RESET_GOLD_PER_LEVEL * Math.max(1, Math.floor(this.levelOf()));
  }

  /** Tüm yetenekleri geri verir (altın bedelini çağıran öder). */
  reset(): void {
    if (this.ownedIds.size === 0) return;
    this.ownedIds.clear();
    this.changed();
  }

  /** Taşıyıcı yeteneklerinin kapasiteye kattığı toplam (asa, eşya, kuşanılabilir). */
  get carryBonus(): { wands: number; goods: number; gear: number } {
    const total = { wands: 0, goods: 0, gear: 0 };
    for (const s of CARRY_SKILLS) {
      if (!this.ownedIds.has(s.id)) continue;
      total.wands += s.bonus.wands;
      total.goods += s.bonus.goods;
      total.gear += s.bonus.gear;
    }
    return total;
  }

  /** Bir büyü için birleşik etki (hasar hesabına bağlanır). */
  resolve(element: Element, role: SpellRole): SpellEffects {
    return resolveSpell(this.ownedIds, element, role);
  }

  /** Savaşçıya verilecek çözücü; ağaç sonradan değişse bile güncel durumu okur. */
  get resolver(): SpellResolver {
    return (element, role) => this.resolve(element, role);
  }

  /** Kayıt için: alınan yetenek kimlikleri, katalog sırasında. */
  snapshot(): string[] {
    return [...SKILLS.filter((s) => this.ownedIds.has(s.id)).map((s) => s.id), ...CARRY_SKILLS.filter((s) => this.ownedIds.has(s.id)).map((s) => s.id)];
  }

  /**
   * Kayıttan yükler. Bilinmeyen kimlikler, sırasız (önceki kademesi olmayan) kademeler ve puanı aşan
   * yetenekler atılır; ucuz kademeler önce işlenir, bu yüzden geçerli bir kayıt bire bir geri gelir.
   */
  restore(ids: readonly string[] | undefined): void {
    this.ownedIds.clear();
    const wanted = new Set(ids ?? []);
    const ordered: { id: string; tier: number }[] = [
      ...SKILLS.filter((s: SkillDef) => wanted.has(s.id)),
      ...CARRY_SKILLS.filter((s) => wanted.has(s.id)),
    ].sort((a, b) => a.tier - b.tier);
    for (const skill of ordered) {
      if (this.check(skill.id).ok) this.ownedIds.add(skill.id);
    }
    this.changed();
  }
}
