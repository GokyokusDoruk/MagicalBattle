import { ELEMENT_NAMES } from '../battle/damage/elements';
import {
  ELEMENT_COLORS,
  ELEMENT_MATCH,
  RARITY_COLORS,
  RARITY_NAMES,
  ROLE_NAMES,
  SYNTHESIS_COUNT,
  describeWand,
  getWand,
  type WandDef,
} from '../wands/catalog';
import type { WandInventory } from '../wands/inventory';

export interface WandUiDeps {
  wands: WandInventory;
  /** Oyuncu seviyesi (asa seviye şartı) */
  level: () => number;
  /** Kuşanma, çıkarma ya da birleştirme oldu (kaydedilmemiş değişiklik) */
  onChanged?: () => void;
}

const esc = (s: string): string => s.replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]!);

const title = (w: WandDef): string =>
  `<span style="color:${ELEMENT_COLORS[w.element]}">●</span> <span style="color:${RARITY_COLORS[w.rarity]}">${esc(w.name)}</span>`;

/**
 * Asa ekranı (W): aynı anda TEK asa kuşanılır. Sahip olunan asalar listelenir; seviyesi oyuncudan yüksek olan
 * asa kuşanılamaz. Aynı asadan (element, rol, nadirlik ve seviye) 5 tane bir üst nadirlikte 1 asa olur.
 */
export class WandUi {
  readonly element: HTMLDivElement;
  private opened = false;
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

  open(): void {
    if (this.opened) return;
    this.opened = true;
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

  private equippedHtml(): string {
    const w = this.deps.wands.equippedWand;
    if (!w) return '<p class="text-sm text-slate-400" data-equipped>Kuşanılı asa yok: büyülerin asasız (etkisiz) çalışır.</p>';
    const pct = (v: number): string => `${v >= 1 ? '+' : '-'}%${Math.round(Math.abs(v - 1) * 100)}`;
    return `<div data-equipped class="flex items-start justify-between gap-2">
      <div><div class="font-bold">${title(w)} <span class="text-slate-300">Sv ${w.level}</span></div>
        <div class="text-[11px] text-slate-400">${esc(ELEMENT_NAMES[w.element])} · ${esc(ROLE_NAMES[w.role])} · ${esc(RARITY_NAMES[w.rarity])}</div>
        <ul class="mt-1 list-disc pl-4 text-xs text-slate-200">
          <li>Saldırı hasarı ${pct(w.attackMultiplier)} (${esc(ELEMENT_NAMES[w.element])} büyüsünde ${pct(w.attackMultiplier * ELEMENT_MATCH)})</li>
          <li>Savunma gücü ${pct(w.defenseMultiplier)}</li>
          <li>Büyü süresi +${w.timeBonusSec.toFixed(2)} sn</li></ul></div>
      <button type="button" data-action="unequip" class="rounded bg-slate-700 px-2 py-1 text-xs">Çıkar</button></div>`;
  }

  /** Açıksa yeniden çizer (oyuncu seviyesi değişince seviye şartları güncellenir). */
  refresh(): void {
    this.render();
  }

  private render(): void {
    if (!this.opened) return;
    const { wands } = this.deps;
    const level = this.deps.level();
    const rows = wands
      .owned()
      .map(({ id, count }) => {
        const w = getWand(id)!;
        const isEq = wands.isEquipped(id);
        const locked = w.level > level;
        const synth = wands.checkSynthesis(id);
        return `<li data-wand="${id}" class="flex flex-wrap items-center justify-between gap-2 rounded bg-slate-900 p-2">
          <div class="min-w-0">
            <div class="text-sm font-bold">${title(w)} <span class="${locked ? 'text-red-300' : 'text-slate-300'}">Sv ${w.level}</span> <span class="text-slate-400">×${count}</span>${isEq ? ' <span class="text-[11px] text-sky-300">(kuşanılı)</span>' : ''}</div>
            <div class="text-[11px] text-slate-400">${esc(describeWand(w).join(' · '))}</div>
            ${locked ? `<div class="text-[11px] text-red-300">${w.level}. seviyeye gelene kadar kullanılamaz</div>` : ''}</div>
          <div class="flex gap-1">
            ${isEq ? '' : `<button type="button" data-action="equip" data-id="${id}" ${locked ? 'disabled' : ''} class="rounded bg-sky-400 px-2 py-1 text-xs font-bold text-slate-900 disabled:opacity-40">Kuşan</button>`}
            ${w.rarity >= 6 ? '' : `<button type="button" data-action="synth" data-id="${id}" ${synth.ok ? '' : 'disabled'} class="rounded bg-amber-300 px-2 py-1 text-xs font-bold text-slate-900 disabled:opacity-40">${SYNTHESIS_COUNT}→1</button>`}
          </div></li>`;
      })
      .join('');

    this.element.innerHTML = `
      <div class="flex max-h-full w-full max-w-xl flex-col gap-3 rounded-xl border border-amber-300/40 bg-slate-950 p-4 text-amber-50 shadow-2xl">
        <div class="flex items-start justify-between gap-2">
          <div><h2 class="text-lg font-bold text-amber-300">Asalar</h2>
            <p class="text-xs italic text-slate-300" data-message>${esc(this.message || `Aynı anda tek asa kuşanılır. Asa, seviyene (${level}) gelene kadar kullanılamaz.`)}</p></div>
          <button type="button" data-action="close" class="rounded bg-white/10 px-2 py-1 text-sm hover:bg-white/20" aria-label="Kapat">✕</button>
        </div>
        <div class="rounded-lg bg-slate-900 p-3"><h3 class="mb-1 text-sm font-bold text-amber-200">Kuşanılı asa</h3>${this.equippedHtml()}</div>
        <div data-scrollable style="touch-action:pan-y" class="min-h-0 flex-1 overflow-y-auto pr-1">
          <h3 class="mb-1 text-sm font-bold text-amber-200">Asaların</h3>
          ${rows ? `<ul class="flex flex-col gap-2">${rows}</ul>` : '<p class="text-sm text-slate-400">Hiç asan yok. Tüccarlar asa satar.</p>'}
        </div>
      </div>`;
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
      case 'equip':
        if (wands.equip(id)) {
          this.message = `Kuşandın: ${getWand(id)!.name}`;
          this.deps.onChanged?.();
        } else this.message = wands.lastBlockReason ?? 'Kuşanılamadı.';
        return this.render();
      case 'unequip':
        if (wands.unequip()) {
          this.message = 'Asayı çıkardın.';
          this.deps.onChanged?.();
        } else this.message = wands.lastBlockReason ?? 'Çıkarılamadı.';
        return this.render();
      case 'synth': {
        const r = wands.synthesize(id);
        this.message = r.ok ? `Birleşti: ${getWand(r.result)!.name} (Sv ${getWand(r.result)!.level})` : r.reason;
        if (r.ok) this.deps.onChanged?.();
        return this.render();
      }
    }
  }
}
