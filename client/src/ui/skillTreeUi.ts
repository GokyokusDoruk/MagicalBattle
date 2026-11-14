import { ELEMENTS, ELEMENT_NAMES, type Element } from '../battle/damage/elements';
import { BRANCH_KINDS, BRANCH_ROLE_NAMES, CARRY_SKILLS, SKILLS, TIERS, describeStats, getBranch, getCarrySkill, getSkill, skillId, type BranchKind, type Tier } from '../skills/catalog';
import { SYNERGY, synergyLevel } from '../skills/resolver';
import type { SkillTree } from '../skills/tree';

export interface SkillTreeUiDeps {
  tree: SkillTree;
  /** Karakter seviyesi (başlıkta gösterilir) */
  level: () => number;
  /** Sıfırlama bedeli: dört para biriminden her biri `each` kadar öder; verilmezse sıfırlama bedavadır */
  money?: { canPay: (each: number) => boolean; pay: (each: number) => boolean };
  /** Yetenek alındı ya da ağaç sıfırlandı (kaydedilmemiş değişiklik) */
  onChanged?: () => void;
}

const TIER_LABEL: Record<Tier, string> = { 1: 'Seviye 1', 2: 'Seviye 2', 3: 'Ustalık' };
const ELEMENT_ICON: Record<Element, string> = { fire: '🔥', water: '💧', earth: '⛰️', air: '🌪️' };
const esc = (s: string): string => s.replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]!);

/**
 * Yetenek ağacı ekranı: 4 element sekmesi, her elementte 3 dal (Güç, Hassasiyet, Kalkan), her dalda
 * 3 kademe (Seviye 1, Seviye 2, Ustalık). Alınabilen yeteneğe dokununca öğrenilir.
 */
export class SkillTreeUi {
  readonly element: HTMLDivElement;
  private opened = false;
  private selected: Element | 'carry' = 'fire';
  private message = '';

  constructor(private readonly deps: SkillTreeUiDeps) {
    this.element = document.createElement('div');
    this.element.className = 'fixed inset-0 z-[56] hidden items-center justify-center bg-black/70 p-3';
    this.element.setAttribute('role', 'dialog');
    this.element.setAttribute('aria-modal', 'true');
    this.element.addEventListener('click', (e) => this.onClick(e));
    window.addEventListener('keydown', (e) => {
      if (this.isOpen && e.code === 'Escape') this.close();
    });
    deps.tree.onChange(() => this.isOpen && this.render());
  }

  get isOpen(): boolean {
    return this.opened;
  }

  /** Açıkken kapatır, kapalıyken açar. */
  toggle(): void {
    if (this.opened) this.close();
    else this.open();
  }

  open(element?: Element | 'carry'): void {
    if (this.opened) return;
    this.opened = true;
    if (element) this.selected = element;
    this.message = '';
    this.element.classList.remove('hidden');
    this.element.classList.add('flex');
    this.render();
  }

  close(): void {
    this.opened = false;
    this.element.classList.add('hidden');
    this.element.classList.remove('flex');
    this.element.innerHTML = '';
  }

  // --- Çizim -------------------------------------------------------------------------------

  private render(): void {
    if (!this.opened) return;
    const { tree } = this.deps;
    const tabs = ELEMENTS.map((el) => {
      const spent = SKILLS.filter((s) => s.element === el && tree.has(s.id)).reduce((n, s) => n + s.cost, 0);
      const active = el === this.selected;
      return `<button type="button" role="tab" data-action="element" data-id="${el}" aria-selected="${active}" class="flex-1 rounded px-1 py-2 text-xs sm:text-sm ${active ? 'bg-amber-300 font-bold text-slate-900' : 'bg-slate-800 text-slate-200'}">${ELEMENT_ICON[el]} ${ELEMENT_NAMES[el]}${spent > 0 ? ` <span class="opacity-70">(${spent})</span>` : ''}</button>`;
    }).join('');
    const carryActive = this.selected === 'carry';
    const carryTab = `<button type="button" role="tab" data-action="element" data-id="carry" aria-selected="${carryActive}" class="flex-1 rounded px-1 py-2 text-xs sm:text-sm ${carryActive ? 'bg-amber-300 font-bold text-slate-900' : 'bg-slate-800 text-slate-200'}">🎒 Taşıyıcı</button>`;

    const level = this.deps.level();
    const hasSkills = tree.owned.size > 0;
    // Para bağlı değilse (deneme ekranı) sıfırlama bedavadır
    const resetCost = this.deps.money ? tree.resetCostEach : 0;
    const canPay = !this.deps.money || this.deps.money.canPay(resetCost);

    this.element.innerHTML = `
      <div class="flex max-h-full w-full max-w-3xl flex-col gap-3 rounded-xl border border-amber-300/40 bg-slate-950 p-4 text-amber-50 shadow-2xl">
        <div class="flex items-start justify-between gap-2">
          <div><h2 class="text-lg font-bold text-amber-300">Yetenek Ağacı</h2>
            <p class="text-xs italic text-slate-300" data-message>${esc(this.message || 'Her seviye 2 yetenek puanı verir. Kademeler sırayla alınır.')}</p></div>
          <button type="button" data-action="close" class="rounded bg-white/10 px-2 py-1 text-sm hover:bg-white/20" aria-label="Kapat">✕</button>
        </div>
        <div class="flex flex-wrap items-center justify-between gap-2 rounded bg-black/40 px-3 py-1 text-sm">
          <span>Seviye <b>${level}</b></span>
          <span data-points>Boş puan <b class="${tree.pointsFree > 0 ? 'text-emerald-300' : ''}">${tree.pointsFree}</b> / ${tree.pointsTotal}</span>
          <button type="button" data-action="reset" ${!hasSkills || !canPay ? 'disabled' : ''} class="rounded bg-slate-700 px-2 py-1 text-xs disabled:opacity-40">Sıfırla${resetCost > 0 ? ` (her birimden ${resetCost})` : ''}</button>
        </div>
        <div role="tablist" class="flex gap-2">${tabs}${carryTab}</div>
        <div data-scrollable style="touch-action:pan-y" class="min-h-0 flex-1 overflow-y-auto pr-1">
          ${this.selected === 'carry' ? this.carryHtml() : this.synergyHtml(this.selected) + `<div class="grid gap-3 sm:grid-cols-3">${BRANCH_KINDS.map((k) => this.branchHtml(this.selected as Element, k)).join('')}</div>`}
        </div>
      </div>`;
  }

  /** Taşıyıcı dalı: taşıma kapasitesini artırır (asa, eşya, kuşanılabilir). */
  private carryHtml(): string {
    const { tree } = this.deps;
    const cards = CARRY_SKILLS.map((s) => {
      const owned = tree.has(s.id);
      const learnable = tree.check(s.id).ok;
      const state = owned ? 'owned' : learnable ? 'learnable' : 'locked';
      const style =
        state === 'owned' ? 'border-emerald-400 bg-emerald-900/40' : state === 'learnable' ? 'border-amber-300 bg-slate-800 hover:bg-slate-700' : 'border-slate-700 bg-slate-900 opacity-60';
      return `<button type="button" data-action="learn" data-id="${s.id}" data-state="${state}" class="rounded border p-2 text-left text-xs ${style}">
        <div class="flex items-center justify-between gap-1"><b>${esc(s.name)}</b><span class="text-[10px] text-slate-300">${TIER_LABEL[s.tier]}</span></div>
        <ul class="mt-1 list-disc pl-4 text-slate-200"><li>+${s.bonus.wands} asa</li><li>+${s.bonus.goods} eşya</li><li>+${s.bonus.gear} kuşanılabilir eşya</li></ul>
        <div class="mt-1 text-[10px] ${owned ? 'text-emerald-300' : 'text-slate-400'}">${owned ? '✓ Alındı' : `${s.cost} puan`}</div></button>`;
    }).join('');
    return `<p class="mb-3 rounded bg-slate-900 px-3 py-2 text-xs text-slate-300">Çantanda taşıyabileceğin asa, ticari eşya ve ekipman sayısını artırır. Kademeler sırayla alınır.</p>
      <section class="grid gap-2 sm:grid-cols-3" data-branch="carry">${cards}</section>`;
  }

  private synergyHtml(element: Element): string {
    const level = synergyLevel(this.deps.tree.owned, element);
    const bonus = Math.round((level === 'full' ? SYNERGY.basic + SYNERGY.full : level === 'basic' ? SYNERGY.basic : 0) * 100);
    const text =
      level === 'none'
        ? `Uyum: ${ELEMENT_NAMES[element]} elementinin üç dalında da en az Seviye 1 alırsan +%${Math.round(SYNERGY.basic * 100)} verilen ve -%${Math.round(SYNERGY.basic * 100)} alınan hasar; üçü de Ustalık olursa +%${Math.round((SYNERGY.basic + SYNERGY.full) * 100)}.`
        : `Uyum aktif: +%${bonus} verilen, -%${bonus} alınan hasar${level === 'full' ? ' (tam uyum)' : ''}.`;
    return `<p class="mb-3 rounded px-3 py-2 text-xs ${level === 'none' ? 'bg-slate-900 text-slate-400' : 'bg-emerald-900/50 text-emerald-100'}" data-synergy="${level}">${text}</p>`;
  }

  private branchHtml(element: Element, kind: BranchKind): string {
    const branch = getBranch(element, kind);
    const cards = TIERS.map((tier) => this.skillHtml(skillId(element, kind, tier))).join('');
    return `<section class="flex flex-col gap-2 rounded-lg bg-slate-900 p-2" data-branch="${element}-${kind}">
      <h3 class="text-sm font-bold text-amber-200">${esc(branch.name)}</h3>
      <p class="text-[11px] text-slate-400">${BRANCH_ROLE_NAMES[kind]}</p>${cards}</section>`;
  }

  private skillHtml(id: string): string {
    const skill = getSkill(id)!;
    const { tree } = this.deps;
    const owned = tree.has(id);
    const check = tree.check(id);
    const learnable = check.ok;
    const state = owned ? 'owned' : learnable ? 'learnable' : 'locked';
    const style =
      state === 'owned'
        ? 'border-emerald-400 bg-emerald-900/40'
        : state === 'learnable'
          ? 'border-amber-300 bg-slate-800 hover:bg-slate-700'
          : 'border-slate-700 bg-slate-900 opacity-60';
    const lines = describeStats(skill.stats).map((l) => `<li>${esc(l)}</li>`).join('');
    return `<button type="button" data-action="learn" data-id="${id}" data-state="${state}" class="rounded border p-2 text-left text-xs ${style}">
      <div class="flex items-center justify-between gap-1"><b>${esc(skill.name)}</b><span class="text-[10px] ${skill.tier === 3 ? 'text-amber-300' : 'text-slate-300'}">${TIER_LABEL[skill.tier]}</span></div>
      <ul class="mt-1 list-disc pl-4 text-slate-200">${lines}</ul>
      <div class="mt-1 text-[10px] ${owned ? 'text-emerald-300' : 'text-slate-400'}">${owned ? '✓ Alındı' : `${skill.cost} puan`}</div>
    </button>`;
  }

  // --- Etkileşim ---------------------------------------------------------------------------

  private onClick(e: MouseEvent): void {
    const target = e.target as HTMLElement;
    if (target === this.element) return this.close();
    const btn = target.closest<HTMLElement>('[data-action]');
    if (!btn) return;
    const id = btn.dataset.id ?? '';
    switch (btn.dataset.action) {
      case 'close':
        return this.close();
      case 'element':
        if (id === 'carry' || (ELEMENTS as readonly string[]).includes(id)) this.selected = id as Element | 'carry';
        this.message = '';
        return this.render();
      case 'learn': {
        const check = this.deps.tree.check(id);
        if (!check.ok) {
          this.message = check.reason;
          return this.render();
        }
        const skill = getSkill(id) ?? getCarrySkill(id)!;
        this.deps.tree.learn(id);
        this.message = `${skill.name} öğrenildi.`;
        this.deps.onChanged?.();
        return this.render();
      }
      case 'reset': {
        const { tree, money } = this.deps;
        if (tree.owned.size === 0) return;
        const cost = money ? tree.resetCostEach : 0;
        if (money && cost > 0 && !money.pay(cost)) {
          this.message = `Sıfırlamak için dört birimden her birinde ${cost} paran olmalı.`;
          return this.render();
        }
        tree.reset();
        this.message = 'Yetenekler sıfırlandı, puanların geri döndü.';
        this.deps.onChanged?.();
        return this.render();
      }
    }
  }
}
