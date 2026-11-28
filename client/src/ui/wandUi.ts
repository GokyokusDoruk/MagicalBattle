import { ELEMENT_NAMES } from '../battle/damage/elements';
import { describePassive } from '../wands/passives';
import {
  RARITY_COLORS,
  RARITY_NAMES,
  ROLE_NAMES,
  describeWand,
  getWand,
  type WandDef,
} from '../wands/catalog';
import type { WandInventory } from '../wands/inventory';

export interface WandUiDeps {
  wands: WandInventory;
  /** Oyuncu seviyesi (asa seviye şartı) */
  level: () => number;
  /** Kuşanma ya da çıkarma oldu (kaydedilmemiş değişiklik) */
  onChanged?: () => void;
}

const esc = (s: string): string => s.replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]!);

/**
 * Asanın yazı rengi elementini, arka fonu okunurluğu belirler (Task 59): ateş kırmızı, su mavi, hava beyaz, toprak kahverengi.
 * Kahverengi koyu fonda okunmadığı için toprak asaları açık krem fonda, diğerleri koyu fonda gösterilir.
 */
export const WAND_TEXT: Record<WandDef['element'], { text: string; sub: string; bg: string }> = {
  fire: { text: '#f87171', sub: '#fca5a5', bg: '#2a1215' },
  water: { text: '#60a5fa', sub: '#93c5fd', bg: '#0f1f3d' },
  air: { text: '#f8fafc', sub: '#cbd5e1', bg: '#1f2937' },
  earth: { text: '#7c3f06', sub: '#92571a', bg: '#f3e9d2' },
};

/** Nadirliğe göre çerçeve: rengi nadirlik rengidir; yüksek nadirlikte hafif parıltı */
const frame = (w: WandDef): string => `border:2px solid ${RARITY_COLORS[w.rarity]};${w.rarity >= 4 ? `box-shadow:0 0 8px ${RARITY_COLORS[w.rarity]}66;` : ''}`;

/**
 * Asa ekranı (Q): aynı anda TEK asa kuşanılır. Sahip olunan asalar listelenir; seviyesi oyuncudan yüksek olan
 * asa kuşanılamaz.
 */
export class WandUi {
  readonly element: HTMLDivElement;
  private opened = false;
  private message = '';

  constructor(private readonly deps: WandUiDeps) {
    this.element = document.createElement('div');
    this.element.className = 'fixed inset-0 z-[56] hidden items-center justify-center bg-black/70 p-3 mb-sheet';
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

  /** Bir asa satırı: ad (elementin renginde), solda; seviye sağda. Çerçeve nadirlik renginde, arka fon okunurluğa göre. */
  private rowHtml(w: WandDef, extra: string, locked: boolean, count?: number): string {
    const c = WAND_TEXT[w.element];
    return `<li data-wand="${w.id}" title="${esc(describeWand(w).join(' · '))}" class="flex items-center gap-2 rounded-lg px-3 py-2 ${locked ? 'opacity-60' : ''}" style="background:${c.bg};${frame(w)}">
      <div class="min-w-0 flex-1">
        <div class="truncate text-sm font-bold" style="color:${c.text}">${esc(w.name)}${count && count > 1 ? ` <span style="color:${c.sub}">×${count}</span>` : ''}</div>
        <div class="truncate text-[11px]" style="color:${c.sub}">${esc(ELEMENT_NAMES[w.element])} · ${esc(ROLE_NAMES[w.role])} · ${esc(RARITY_NAMES[w.rarity])}</div></div>
      <div class="shrink-0 text-right text-sm font-bold" style="color:${locked ? '#ef4444' : c.text}" data-level>Sv ${w.level}</div>
      ${extra}</li>`;
  }

  /** Açıksa yeniden çizer (oyuncu seviyesi değişince seviye şartları güncellenir). */
  refresh(): void {
    this.render();
  }

  private render(): void {
    if (!this.opened) return;
    const { wands } = this.deps;
    const level = this.deps.level();
    const eq = wands.equippedWand;
    const equipped = eq
      ? `<ul data-equipped>${this.rowHtml(eq, '<button type="button" data-action="unequip" class="shrink-0 rounded bg-slate-700 px-2 py-1 text-xs font-bold text-amber-50">Çıkar</button>', false)}</ul>
         <p class="mt-1 text-[11px] text-emerald-300" data-passive>Pasif: ${esc(describePassive(eq.element))}${wands.usable(eq.id) ? '' : ' (seviyen yetmiyor)'}</p>`
      : '<p class="text-sm text-slate-400" data-equipped>Kuşanılan asa yok: büyülerin asasız (etkisiz) çalışır.</p>';
    const others = wands
      .owned()
      .filter(({ id }) => !wands.isEquipped(id))
      .map(({ id, count }) => {
        const w = getWand(id)!;
        const locked = w.level > level;
        const button = `<button type="button" data-action="equip" data-id="${id}" ${locked ? 'disabled' : ''} class="shrink-0 rounded bg-sky-400 px-2 py-1 text-xs font-bold text-slate-900 disabled:opacity-40">Kuşan</button>`;
        return this.rowHtml(w, button, locked, count);
      })
      .join('');

    this.element.innerHTML = `
      <div class="flex max-h-full w-full max-w-md flex-col gap-3 rounded-xl border border-amber-300/40 bg-slate-950 p-4 text-amber-50 shadow-2xl">
        <div class="flex items-start justify-between gap-2">
          <div><h2 class="text-lg font-bold text-amber-300">Asalar</h2>
            <p class="text-xs italic text-slate-300" data-message>${esc(this.message || `Asanın seviyesi senin seviyenden (${level}) büyük olamaz.`)}</p></div>
          <button type="button" data-action="close" class="rounded bg-white/10 px-2 py-1 text-sm hover:bg-white/20" aria-label="Kapat">✕</button>
        </div>
        <section><h3 class="mb-1 text-sm font-bold text-amber-200">Kuşanılan asa</h3>${equipped}</section>
        <section data-scrollable style="touch-action:pan-y" class="min-h-0 flex-1 overflow-y-auto pr-1">
          <h3 class="mb-1 text-sm font-bold text-amber-200">Sahip olduğun diğer asalar</h3>
          ${others ? `<ul class="flex flex-col gap-2">${others}</ul>` : '<p class="text-sm text-slate-400">Başka asan yok. Tüccarlar asa satar.</p>'}
        </section>
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
    }
  }
}
