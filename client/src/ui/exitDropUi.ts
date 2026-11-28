import { getItem } from '../economy/items';
import { CATEGORIES, CATEGORY_NAMES } from '../inventory/carry';
import { remaining, resolves, selectedByCategory, suggestDrop, type DropCandidate, type DropSelection } from '../inventory/exitDrop';
import type { CarryBonus } from '../economy/items';
import { ELEMENT_COLORS, RARITY_COLORS, getWand } from '../wands/catalog';
import { itemIconSvg } from './itemIcon';
import { itemNameHtml } from './itemText';

export type ExitDropResult = { action: 'drop'; selection: DropSelection } | { action: 'return' };

export interface ExitDropAsk {
  /** Çıkılan konumun adı */
  locationName: string;
  /** Kategori başına bırakılması gereken adet */
  overflow: CarryBonus;
  candidates: readonly DropCandidate[];
  /** Çıkınca geçerli kapasite ve şu anki kullanım (bilgi için) */
  capacity: CarryBonus;
  usage: CarryBonus;
}

const esc = (s: string): string => s.replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]!);

/**
 * "Çantan küçülüyor" ekranı: şehirden çıkarken kendi elementinin çantasındaki %50 bonus gider ve eldekiler sığmazsa oyuncu
 * hangilerini bırakacağını seçer (en ucuzlar önceden seçilir). Fazlalık karşılanınca "Bırak ve çık" açılır. "Şehre geri
 * dön" seçeneği satıp boşaltmak içindir. Seçim zorunludur: Esc ya da dışarı tıklama kapatmaz.
 */
export class ExitDropUi {
  readonly element: HTMLDivElement;
  private ask: ExitDropAsk | null = null;
  private selection: DropSelection = {};
  private resolve: ((r: ExitDropResult) => void) | null = null;

  constructor() {
    this.element = document.createElement('div');
    this.element.className = 'fixed inset-0 z-[63] hidden items-center justify-center bg-black/80 p-3 mb-sheet';
    this.element.setAttribute('role', 'dialog');
    this.element.setAttribute('aria-modal', 'true');
    this.element.addEventListener('click', (e) => this.onClick(e));
  }

  get isOpen(): boolean {
    return this.ask !== null;
  }

  /** Ekranı açar; oyuncu seçince çözülür. Zaten açıksa iptal sayılır ('return'). */
  prompt(ask: ExitDropAsk): Promise<ExitDropResult> {
    if (this.ask) return Promise.resolve({ action: 'return' });
    this.ask = ask;
    this.selection = suggestDrop(ask.overflow, ask.candidates);
    this.element.classList.remove('hidden');
    this.element.classList.add('flex');
    this.render();
    return new Promise((resolve) => {
      this.resolve = resolve;
    });
  }

  private finish(result: ExitDropResult): void {
    this.ask = null;
    this.element.classList.add('hidden');
    this.element.classList.remove('flex');
    this.element.innerHTML = '';
    const done = this.resolve;
    this.resolve = null;
    done?.(result);
  }

  private rowHtml(c: DropCandidate): string {
    const n = Math.min(c.max, Math.floor(this.selection[c.key] ?? 0));
    let label: string;
    let icon = '';
    if (c.kind === 'item') {
      const item = getItem(c.id)!;
      icon = `<span class="shrink-0">${itemIconSvg(item, 30)}</span>`;
      label = itemNameHtml(item);
    } else {
      const w = getWand(c.id)!;
      label = `<span style="color:${ELEMENT_COLORS[w.element]}">●</span> <span style="color:${RARITY_COLORS[w.rarity]}">${esc(w.name)}</span> <span class="text-slate-300">Sv ${w.level}</span>`;
    }
    return `<li data-candidate="${esc(c.key)}" class="flex items-center justify-between gap-2 rounded bg-slate-900 p-2">
      <div class="flex min-w-0 items-center gap-2">${icon}<div class="min-w-0 text-xs"><div class="truncate font-bold">${label}</div><div class="text-[10px] text-slate-400">elinde ${c.max}</div></div></div>
      <div class="flex shrink-0 items-center gap-1">
        <button type="button" data-action="minus" data-key="${esc(c.key)}" ${n <= 0 ? 'disabled' : ''} class="h-7 w-7 rounded bg-slate-700 font-bold disabled:opacity-30">−</button>
        <span data-count class="w-6 text-center text-sm font-bold ${n > 0 ? 'text-red-300' : 'text-slate-400'}">${n}</span>
        <button type="button" data-action="plus" data-key="${esc(c.key)}" ${n >= c.max ? 'disabled' : ''} class="h-7 w-7 rounded bg-slate-700 font-bold disabled:opacity-30">+</button>
      </div></li>`;
  }

  private render(): void {
    const ask = this.ask;
    if (!ask) return;
    const keep = this.element.querySelector<HTMLElement>('[data-scrollable]')?.scrollTop ?? 0;
    const left = remaining(ask.overflow, ask.candidates, this.selection);
    const ok = resolves(ask.overflow, ask.candidates, this.selection);
    const sel = selectedByCategory(ask.candidates, this.selection);

    const status = CATEGORIES.filter((c) => ask.overflow[c] > 0)
      .map((c) => {
        const done = left[c] === 0;
        return `<div data-status="${c}" class="rounded px-2 py-1 text-xs ${done ? 'bg-emerald-900/50 text-emerald-200' : 'bg-red-900/50 text-red-200'}">
          <b>${CATEGORY_NAMES[c]}</b>: ${ask.usage[c]} taşıyorsun, sığan ${ask.capacity[c]}. ${done ? '✓ Yeterince seçtin' : `<b>${left[c]}</b> tane daha seç`} (seçilen ${sel[c]})</div>`;
      })
      .join('');

    const groups = CATEGORIES.map((cat) => {
      const rows = ask.candidates.filter((c) => c.category === cat).map((c) => this.rowHtml(c)).join('');
      return rows ? `<h4 class="mb-1 mt-2 text-xs font-bold text-amber-200">${CATEGORY_NAMES[cat]}</h4><ul class="flex flex-col gap-1">${rows}</ul>` : '';
    }).join('');

    this.element.innerHTML = `
      <div class="flex max-h-full w-full max-w-lg flex-col gap-3 rounded-xl border border-red-400/60 bg-slate-950 p-4 text-amber-50 shadow-2xl">
        <div><h2 class="text-lg font-bold text-red-300">Çantan küçülüyor</h2>
          <p class="text-xs text-slate-300">${esc(ask.locationName)} alanından çıkıyorsun. Buradaki şehir bonusu çıkınca gider; taşıdıkların sığmıyor. Hangilerini bırakmak istiyorsun? Bıraktıkların çıkış noktasında yerde 10 dakika kalır.</p></div>
        <div class="flex flex-col gap-1">${status}</div>
        <div data-scrollable style="touch-action:pan-y" class="min-h-0 flex-1 overflow-y-auto pr-1">${groups}</div>
        <div class="flex gap-2">
          <button type="button" data-action="drop" ${ok ? '' : 'disabled'} class="flex-1 rounded bg-red-400 px-3 py-3 font-bold text-slate-900 disabled:opacity-40">Seçilenleri bırak ve çık</button>
          <button type="button" data-action="return" class="flex-1 rounded bg-slate-700 px-3 py-3 font-bold">Geri dön (satıp boşalt)</button>
        </div>
      </div>`;
    const list = this.element.querySelector<HTMLElement>('[data-scrollable]');
    if (list) list.scrollTop = keep;
  }

  private onClick(e: MouseEvent): void {
    const ask = this.ask;
    if (!ask) return;
    const btn = (e.target as HTMLElement).closest<HTMLElement>('[data-action]');
    if (!btn || btn.hasAttribute('disabled')) return;
    const key = btn.dataset.key ?? '';
    const cand = ask.candidates.find((c) => c.key === key);
    switch (btn.dataset.action) {
      case 'plus':
        if (cand) this.selection[key] = Math.min(cand.max, (this.selection[key] ?? 0) + 1);
        return this.render();
      case 'minus':
        if (cand) this.selection[key] = Math.max(0, (this.selection[key] ?? 0) - 1);
        return this.render();
      case 'drop':
        if (resolves(ask.overflow, ask.candidates, this.selection)) this.finish({ action: 'drop', selection: { ...this.selection } });
        return;
      case 'return':
        return this.finish({ action: 'return' });
    }
  }
}
