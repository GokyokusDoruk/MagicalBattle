import { ELEMENTS, ELEMENT_NAMES, type Element } from '../battle/damage/elements';
import { CARRY_SKILLS, MAX_SKILL_LEVEL, SKILL_POINT_COST, describeEffect, effectAt, getCarrySkill, getSkill, skillsOf, type SkillDef, type Tier } from '../skills/catalog';
import type { SkillTree } from '../skills/tree';
import { passiveTierForWandLevel } from '../skills/catalog';
import { describePassive, wandPassiveSteps } from '../wands/passives';
import type { WandInventory } from '../wands/inventory';

export interface SkillTreeUiDeps {
  tree: SkillTree;
  /** Karakter seviyesi (başlıkta gösterilir) */
  level: () => number;
  /** Sıfırlama bedeli: dört para biriminden her biri `each` kadar öder; verilmezse sıfırlama bedavadır */
  money?: { canPay: (each: number) => boolean; pay: (each: number) => boolean };
  /** Pasifler bölümünde kuşanılı asaya göre "aktif" gösterimi için (verilmezse hiçbir pasif aktif görünmez) */
  wands?: WandInventory;
  /** Yetenek alındı ya da ağaç sıfırlandı (kaydedilmemiş değişiklik) */
  onChanged?: () => void;
}

const TIER_LABEL: Record<Tier, string> = { 1: 'Seviye 1', 2: 'Seviye 2', 3: 'Ustalık' };
const ELEMENT_ICON: Record<Element, string> = { fire: '🔥', water: '💧', earth: '⛰️', air: '🌪️' };
const esc = (s: string): string => s.replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]!);

/**
 * Yetenek ağacı ekranı: 4 element sekmesi ve Taşıyıcı. Her element yeteneği 3 seviyelidir; açmak ve her seviye
 * 1 puandır. Kartta şu anki ve bir sonraki seviyenin etkisi görünür. Henüz yazılmamış elementler "yakında" der.
 */
export class SkillTreeUi {
  readonly element: HTMLDivElement;
  private opened = false;
  private selected: Element | 'carry' = 'fire';
  private message = '';

  constructor(private readonly deps: SkillTreeUiDeps) {
    this.element = document.createElement('div');
    this.element.className = 'fixed inset-0 z-[56] hidden items-center justify-center bg-black/70 p-3 mb-sheet';
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
      const spent = skillsOf(el).reduce((n, s) => n + tree.level(s.id) * SKILL_POINT_COST, 0);
      const active = el === this.selected;
      return `<button type="button" role="tab" data-action="element" data-id="${el}" aria-selected="${active}" class="flex-1 rounded px-1 py-2 text-xs sm:text-sm ${active ? 'bg-amber-300 font-bold text-slate-900' : 'bg-slate-800 text-slate-200'}">${ELEMENT_ICON[el]} ${ELEMENT_NAMES[el]}${spent > 0 ? ` <span class="opacity-70">(${spent})</span>` : ''}</button>`;
    }).join('');
    const carryActive = this.selected === 'carry';
    const carryTab = `<button type="button" role="tab" data-action="element" data-id="carry" aria-selected="${carryActive}" class="flex-1 rounded px-1 py-2 text-xs sm:text-sm ${carryActive ? 'bg-amber-300 font-bold text-slate-900' : 'bg-slate-800 text-slate-200'}">🎒 Taşıyıcı</button>`;

    const level = this.deps.level();
    const hasSkills = tree.levels.size > 0 || tree.owned.size > 0;
    // Para bağlı değilse (deneme ekranı) sıfırlama bedavadır
    const resetCost = this.deps.money ? tree.resetCostEach : 0;
    const canPay = !this.deps.money || this.deps.money.canPay(resetCost);

    this.element.innerHTML = `
      <div class="flex max-h-full w-full max-w-3xl flex-col gap-3 rounded-xl border border-amber-300/40 bg-slate-950 p-4 text-amber-50 shadow-2xl">
        <div class="flex items-start justify-between gap-2">
          <div><h2 class="text-lg font-bold text-amber-300">Yetenek Ağacı</h2>
            <p class="text-xs italic text-slate-300" data-message>${esc(this.message || 'Her seviye 2 yetenek puanı verir. Bir yeteneği açmak ve her seviyesi 1 puandır (en çok 3 seviye).')}</p></div>
          <button type="button" data-action="close" class="rounded bg-white/10 px-2 py-1 text-sm hover:bg-white/20" aria-label="Kapat">✕</button>
        </div>
        <div class="flex flex-wrap items-center justify-between gap-2 rounded bg-black/40 px-3 py-1 text-sm">
          <span>Seviye <b>${level}</b></span>
          <span data-points>Boş puan <b class="${tree.pointsFree > 0 ? 'text-emerald-300' : ''}">${tree.pointsFree}</b> / ${tree.pointsTotal}</span>
          <button type="button" data-action="reset" ${!hasSkills || !canPay ? 'disabled' : ''} class="rounded bg-slate-700 px-2 py-1 text-xs disabled:opacity-40">Sıfırla${resetCost > 0 ? ` (her birimden ${resetCost})` : ''}</button>
        </div>
        <div role="tablist" class="flex gap-2">${tabs}${carryTab}</div>
        <div data-scrollable style="touch-action:pan-y" class="min-h-0 flex-1 overflow-y-auto pr-1">
          ${this.selected === 'carry' ? this.carryHtml() : this.elementHtml(this.selected)}
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

  private elementHtml(element: Element): string {
    const skills = skillsOf(element).filter((s) => !s.passive);
    const grid = skills.length ? `<div class="grid gap-3 sm:grid-cols-2" data-element="${element}">${skills.map((s) => this.skillHtml(s)).join('')}</div>` : '';
    return grid + this.passivesHtml(element);
  }

  /**
   * Pasifler (Task 63): o elementin asa pasifi ve (ateş, hava) yetenek puanıyla alınmayan, asa seviyesine bağlı savaş pasifi. Kuşanılı asa o
   * elementten ve kullanılabilirse "AKTİF" yazar; hangi asa seviyesinde hangi kademe işlediği tabloda görünür.
   */
  private passivesHtml(element: Element): string {
    const wands = this.deps.wands;
    const wand = wands?.equippedWand ?? null;
    const active = Boolean(wand && wands!.usable(wand.id) && wand.element === element);
    const badge = (on: boolean): string => (on ? '<span class="rounded bg-emerald-400 px-1.5 py-0.5 text-[10px] font-bold text-slate-900">AKTİF</span>' : '<span class="rounded bg-slate-700 px-1.5 py-0.5 text-[10px] text-slate-300">pasif</span>');
    let html = `<h3 class="mb-1 mt-4 text-sm font-bold text-sky-300">Pasifler (puan harcamaz, asayla gelir)</h3>
      <div class="rounded-lg border border-sky-400/30 bg-slate-900 p-3 text-xs" data-passive-wand="${element}">
        <div class="flex items-center justify-between gap-2"><b class="text-amber-200">Asa pasifi</b>${badge(active)}</div>
        <p class="mt-1 text-slate-200">${esc(describePassive(element))}</p>
        <p class="mt-1 text-[11px] text-slate-400">Kuşanılı ${esc(ELEMENT_NAMES[element])} asası kullanılabiliyorsa (seviyen yetiyorsa) geçerlidir.</p></div>`;
    const passive = skillsOf(element).find((s) => s.passive);
    if (passive) {
      const tier = active && wand ? passiveTierForWandLevel(wand.level) : 0;
      const rows = wandPassiveSteps()
        .map((st) => {
          const fx = describeEffect(effectAt(passive, st.tier)).join(', ');
          const range = st.to === null ? `Asa Sv ${st.from}+` : `Asa Sv ${st.from}-${st.to}`;
          return `<li class="flex justify-between gap-2 ${tier === st.tier ? 'font-bold text-emerald-300' : 'text-slate-300'}"><span>${range}</span><span class="text-right">Kademe ${st.tier}: ${esc(fx)}</span></li>`;
        })
        .join('');
      html += `<div class="mt-2 rounded-lg border border-sky-400/30 bg-slate-900 p-3 text-xs" data-passive-skill="${passive.id}">
        <div class="flex items-center justify-between gap-2"><b class="text-amber-200">${esc(passive.name)}</b>${badge(tier > 0)}</div>
        <p class="mt-1 text-slate-200">${esc(passive.summary)}</p>
        <ul class="mt-2 flex flex-col gap-0.5">${rows}</ul></div>`;
    }
    return html;
  }

  private skillHtml(skill: SkillDef): string {
    const { tree } = this.deps;
    const level = tree.level(skill.id);
    const maxed = level >= MAX_SKILL_LEVEL;
    const check = tree.check(skill.id);
    const state = maxed ? 'maxed' : level > 0 ? 'owned' : check.ok ? 'learnable' : 'locked';
    const border = maxed ? 'border-amber-300 bg-amber-900/20' : level > 0 ? 'border-emerald-400 bg-emerald-900/30' : 'border-slate-700 bg-slate-900';
    const dots = Array.from({ length: MAX_SKILL_LEVEL }, (_, i) => `<span class="inline-block h-2.5 w-2.5 rounded-full ${i < level ? 'bg-amber-300' : 'bg-slate-700'}"></span>`).join('');
    const now = level > 0 ? describeEffect(effectAt(skill, level)).map((l) => `<li>${esc(l)}</li>`).join('') : '';
    const next = !maxed ? describeEffect(effectAt(skill, level + 1)).map((l) => `<li>${esc(l)}</li>`).join('') : '';
    const button = maxed
      ? '<div class="mt-2 text-center text-xs font-bold text-amber-300">✓ En üst seviye</div>'
      : `<button type="button" data-action="learn" data-id="${skill.id}" data-state="${state}" ${check.ok ? '' : 'disabled'} class="mt-2 w-full rounded px-2 py-1.5 text-xs font-bold ${check.ok ? 'bg-amber-300 text-slate-900' : 'bg-slate-700 text-slate-400'}">${level === 0 ? 'Aç' : 'Geliştir'} (${SKILL_POINT_COST} puan)</button>`;
    return `<section class="flex flex-col rounded-lg border p-3 text-xs ${border}" data-skill="${skill.id}" data-level="${level}">
      <div class="flex items-center justify-between gap-2"><b class="text-sm text-amber-200">${esc(skill.name)}${skill.passive ? ' <span class="text-[10px] font-normal text-sky-300">(pasif)</span>' : ''}</b><span class="flex gap-1" aria-label="Seviye ${level}/${MAX_SKILL_LEVEL}">${dots}</span></div>
      <p class="mt-1 text-slate-300">${esc(skill.summary)}</p>
      ${now ? `<div class="mt-2 text-[11px] font-bold text-emerald-300">Şimdi (Sv ${level})</div><ul class="list-disc pl-4 text-slate-200">${now}</ul>` : ''}
      ${next ? `<div class="mt-2 text-[11px] font-bold text-slate-400">Sonraki (Sv ${level + 1})</div><ul class="list-disc pl-4 text-slate-300">${next}</ul>` : ''}
      ${button}</section>`;
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
        const lv = this.deps.tree.level(id);
        this.message = getSkill(id) ? `${skill.name} seviye ${lv} oldu.` : `${skill.name} öğrenildi.`;
        this.deps.onChanged?.();
        return this.render();
      }
      case 'reset': {
        const { tree, money } = this.deps;
        if (tree.levels.size === 0 && tree.owned.size === 0) return;
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
