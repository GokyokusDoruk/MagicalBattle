import { ELEMENTS, ELEMENT_NAMES, type Element } from '../battle/damage/elements';
import {
  MAX_RARITY,
  RARITIES,
  RARITY_COLORS,
  RARITY_NAMES,
  ROLES,
  ROLE_NAMES,
  SYNTHESIS_COUNT,
  describeWand,
  getWand,
  wandId,
  type WandRole,
} from '../wands/catalog';
import type { WandInventory } from '../wands/inventory';

export interface WandUiDeps {
  wands: WandInventory;
  /** Kuşanma ya da birleştirme oldu (kaydedilmemiş değişiklik) */
  onChanged?: () => void;
}

const ELEMENT_ICON: Record<Element, string> = { fire: '🔥', water: '💧', earth: '⛰️', air: '🌪️' };
const esc = (s: string): string => s.replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]!);

/**
 * Asa ekranı: element sekmeleri; her elementte Saldırı ve Savunma asaları. Sahip olunan asayı kuşan,
 * aynı asadan 5 tane varsa bir üst nadirlikte 1 asaya birleştir.
 */
export class WandUi {
  readonly element: HTMLDivElement;
  private opened = false;
  private selected: Element = 'fire';
  private message = '';

  constructor(private readonly deps: WandUiDeps) {
    this.element = document.createElement('div');
    this.element.className = 'fixed inset-0 z-[56] hidden items-center justify-center bg-black/70 p-3';
    this.element.setAttribute('role', 'dialog');
    this.element.setAttribute('aria-modal', 'true');
    this.element.addEventListener('click', (e) => this.onClick(e));
    window.addEventListener('keydown', (e) => {
      if (this.isOpen && e.code === 'Escape') this.close();
    });
    deps.wands.onChange(() => this.isOpen && this.render());
  }

  get isOpen(): boolean {
    return this.opened;
  }

  toggle(): void {
    if (this.opened) this.close();
    else this.open();
  }

  open(element?: Element): void {
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

  private render(): void {
    if (!this.opened) return;
    const tabs = ELEMENTS.map((el) => {
      const active = el === this.selected;
      return `<button type="button" role="tab" data-action="element" data-id="${el}" aria-selected="${active}" class="flex-1 rounded px-1 py-2 text-xs sm:text-sm ${active ? 'bg-amber-300 font-bold text-slate-900' : 'bg-slate-800 text-slate-200'}">${ELEMENT_ICON[el]} ${ELEMENT_NAMES[el]}</button>`;
    }).join('');

    this.element.innerHTML = `
      <div class="flex max-h-full w-full max-w-2xl flex-col gap-3 rounded-xl border border-amber-300/40 bg-slate-950 p-4 text-amber-50 shadow-2xl">
        <div class="flex items-start justify-between gap-2">
          <div><h2 class="text-lg font-bold text-amber-300">Asalar</h2>
            <p class="text-xs italic text-slate-300" data-message>${esc(this.message || `Aynı asadan ${SYNTHESIS_COUNT} tane bir üst nadirlikte 1 asa olur. Sıradan asaları tüccardan alırsın.`)}</p></div>
          <button type="button" data-action="close" class="rounded bg-white/10 px-2 py-1 text-sm hover:bg-white/20" aria-label="Kapat">✕</button>
        </div>
        <div role="tablist" class="flex gap-2">${tabs}</div>
        <div data-scrollable style="touch-action:pan-y" class="min-h-0 flex-1 overflow-y-auto pr-1">
          <div class="grid gap-3 sm:grid-cols-2">${ROLES.map((r) => this.roleHtml(this.selected, r)).join('')}</div>
        </div>
      </div>`;
  }

  private roleHtml(element: Element, role: WandRole): string {
    const { wands } = this.deps;
    const equippedId = wands.equippedFor(element, role);
    const equipped = equippedId ? getWand(equippedId) : undefined;
    const status = equipped
      ? `<span style="color:${RARITY_COLORS[equipped.rarity]}">${esc(equipped.name)}</span> <span class="text-slate-400">· ${esc(describeWand(equipped))}</span>`
      : '<span class="text-slate-400">Kuşanılı asa yok (etkisiz)</span>';

    const rows = RARITIES.map((rarity) => {
      const id = wandId(element, role, rarity);
      const wand = getWand(id)!;
      const count = wands.count(id);
      const isEq = equippedId === id;
      const synth = wands.checkSynthesis(id);
      const canSynth = synth.ok;
      const top = rarity === MAX_RARITY;
      return `<li data-wand="${id}" class="flex flex-wrap items-center justify-between gap-1 rounded bg-slate-800 p-2 ${count === 0 ? 'opacity-50' : ''}">
        <div class="min-w-0"><div class="text-xs font-bold" style="color:${RARITY_COLORS[rarity]}">${RARITY_NAMES[rarity]} <span class="text-slate-300">×${count}</span>${isEq ? ' <span class="text-[10px] text-sky-300">(kuşanılı)</span>' : ''}</div>
          <div class="text-[10px] text-slate-400">${esc(describeWand(wand))}</div></div>
        <div class="flex gap-1">
          <button type="button" data-action="${isEq ? 'unequip' : 'equip'}" data-id="${id}" data-role="${role}" ${count === 0 ? 'disabled' : ''} class="rounded bg-sky-400 px-2 py-1 text-[11px] font-bold text-slate-900 disabled:opacity-40">${isEq ? 'Çıkar' : 'Kuşan'}</button>
          ${top ? '' : `<button type="button" data-action="synth" data-id="${id}" ${canSynth ? '' : 'disabled'} class="rounded bg-amber-300 px-2 py-1 text-[11px] font-bold text-slate-900 disabled:opacity-40">${SYNTHESIS_COUNT}→1</button>`}
        </div></li>`;
    }).join('');

    return `<section class="flex flex-col gap-2 rounded-lg bg-slate-900 p-2" data-role-section="${element}-${role}">
      <h3 class="text-sm font-bold text-amber-200">${ROLE_NAMES[role]}</h3>
      <p class="text-[11px]">${status}</p><ul class="flex flex-col gap-1">${rows}</ul></section>`;
  }

  private onClick(e: MouseEvent): void {
    const target = e.target as HTMLElement;
    if (target === this.element) return this.close();
    const btn = target.closest<HTMLElement>('[data-action]');
    if (!btn || btn.hasAttribute('disabled')) return;
    const id = btn.dataset.id ?? '';
    const { wands } = this.deps;
    switch (btn.dataset.action) {
      case 'close':
        return this.close();
      case 'element':
        if ((ELEMENTS as readonly string[]).includes(id)) this.selected = id as Element;
        this.message = '';
        return this.render();
      case 'equip':
        if (wands.equip(id)) {
          this.message = `Kuşandın: ${getWand(id)!.name}`;
          this.deps.onChanged?.();
        }
        return this.render();
      case 'unequip': {
        const w = getWand(id);
        if (w) wands.unequip(w.element, w.role);
        this.message = `Çıkardın: ${w?.name ?? id}`;
        this.deps.onChanged?.();
        return this.render();
      }
      case 'synth': {
        const r = wands.synthesize(id);
        this.message = r.ok ? `Birleşti: ${getWand(r.result)!.name}` : r.reason;
        if (r.ok) this.deps.onChanged?.();
        return this.render();
      }
    }
  }
}
