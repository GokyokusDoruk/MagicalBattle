import { getItem } from '../economy/items';
import type { PlayerState } from '../economy/player';
import { ELEMENT_COLORS, RARITY_COLORS, getWand } from '../wands/catalog';
import type { WandInventory } from '../wands/inventory';
import type { GroundLoot } from '../world/groundLoot';
import { itemIconSvg } from './itemIcon';
import { itemNameHtml } from './itemText';

export interface GroundPileUiDeps {
  ground: GroundLoot;
  player: PlayerState;
  wands: WandInventory;
  /** Yerden bir şey alındı (kaydedilmemiş değişiklik) */
  onChanged?: () => void;
}

const esc = (s: string): string => s.replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]!);

/**
 * Yerdeki eşya ekranı: bırakılan ya da sığmayan eşyaların yığınına yaklaşınca açılır. Çantada yer olduğu kadar alınır
 * (tek tek ya da "Hepsini al"). Yığın 10 dakika sonra kaybolur; süre ekranda geri sayar.
 */
export class GroundPileUi {
  readonly element: HTMLDivElement;
  private pileId: string | null = null;
  private message = '';

  constructor(private readonly deps: GroundPileUiDeps) {
    this.element = document.createElement('div');
    this.element.className = 'fixed inset-0 z-[57] hidden items-center justify-center bg-black/70 p-3';
    this.element.setAttribute('role', 'dialog');
    this.element.setAttribute('aria-modal', 'true');
    this.element.addEventListener('click', (e) => this.onClick(e));
    window.addEventListener('keydown', (e) => {
      if (this.isOpen && e.code === 'Escape') this.close();
    });
    window.setInterval(() => this.isOpen && this.render(), 1000);
    deps.ground.onChange(() => this.isOpen && this.render());
  }

  get isOpen(): boolean {
    return this.pileId !== null;
  }

  open(pileId: string): void {
    if (this.isOpen || !this.deps.ground.get(pileId)) return;
    this.pileId = pileId;
    this.message = '';
    this.element.classList.remove('hidden');
    this.element.classList.add('flex');
    this.render();
  }

  close(): void {
    this.pileId = null;
    this.element.classList.add('hidden');
    this.element.classList.remove('flex');
    this.element.innerHTML = '';
  }

  private render(): void {
    const id = this.pileId;
    if (!id) return;
    const { ground, player, wands } = this.deps;
    const pile = ground.get(id);
    if (!pile) return this.close(); // süresi doldu ya da boşaldı
    const left = Math.ceil(ground.timeLeftMs(id) / 1000);
    const clock = `${Math.floor(left / 60)}:${String(left % 60).padStart(2, '0')}`;

    const itemRows = Object.entries(pile.items).map(([itemId, count]) => {
      const item = getItem(itemId)!;
      const can = player.roomFor(itemId) >= 1;
      return `<li data-pile-item="${itemId}" class="flex items-center justify-between gap-2 rounded bg-slate-900 p-2">
        <div class="flex min-w-0 items-center gap-2"><span class="shrink-0">${itemIconSvg(item, 32)}</span><div class="text-xs font-bold">${itemNameHtml(item)} <span class="text-slate-400">×${count}</span></div></div>
        <button type="button" data-action="take-item" data-id="${itemId}" ${can ? '' : 'disabled'} class="rounded bg-sky-400 px-3 py-1 text-xs font-bold text-slate-900 disabled:opacity-40">Al</button></li>`;
    });
    const wandRows = Object.entries(pile.wands).map(([wandId, count]) => {
      const w = getWand(wandId)!;
      const can = wands.canAdd(wandId, 1);
      return `<li data-pile-wand="${wandId}" class="flex items-center justify-between gap-2 rounded bg-slate-900 p-2">
        <div class="text-xs font-bold"><span style="color:${ELEMENT_COLORS[w.element]}">●</span> <span style="color:${RARITY_COLORS[w.rarity]}">${esc(w.name)}</span> <span class="text-slate-300">Sv ${w.level}</span> <span class="text-slate-400">×${count}</span></div>
        <button type="button" data-action="take-wand" data-id="${wandId}" ${can ? '' : 'disabled'} class="rounded bg-sky-400 px-3 py-1 text-xs font-bold text-slate-900 disabled:opacity-40">Al</button></li>`;
    });

    this.element.innerHTML = `
      <div class="flex max-h-full w-full max-w-md flex-col gap-3 rounded-xl border border-amber-300/40 bg-slate-950 p-4 text-amber-50 shadow-2xl">
        <div class="flex items-start justify-between gap-2">
          <div><h2 class="text-lg font-bold text-amber-300">Yerdeki eşyalar</h2>
            <p class="text-xs italic text-slate-300" data-message>${esc(this.message || 'Çantanda yer olduğu kadar alabilirsin.')}</p></div>
          <button type="button" data-action="close" class="rounded bg-white/10 px-2 py-1 text-sm hover:bg-white/20" aria-label="Kapat">✕</button></div>
        <p class="rounded bg-black/40 px-3 py-1 text-xs">Kaybolmasına <b data-clock class="text-amber-200">${clock}</b> var.</p>
        <div data-scrollable style="touch-action:pan-y" class="min-h-0 flex-1 overflow-y-auto"><ul class="flex flex-col gap-2">${itemRows.join('')}${wandRows.join('')}</ul></div>
        <button type="button" data-action="take-all" class="rounded bg-amber-300 px-4 py-2 font-bold text-slate-900">Hepsini al (sığdığı kadar)</button>
      </div>`;
  }

  private onClick(e: MouseEvent): void {
    if (e.target === this.element) return this.close();
    const btn = (e.target as HTMLElement).closest<HTMLElement>('[data-action]');
    const id = this.pileId;
    if (!btn || btn.hasAttribute('disabled') || !id) return;
    const { ground, player, wands } = this.deps;
    const target = btn.dataset.id ?? '';
    let taken = 0;
    switch (btn.dataset.action) {
      case 'close':
        return this.close();
      case 'take-item':
        if (player.roomFor(target) >= 1 && ground.take(id, 'item', target, 1) === 1) {
          player.addItem(target, 1);
          taken = 1;
        }
        break;
      case 'take-wand':
        if (wands.canAdd(target, 1) && ground.take(id, 'wand', target, 1) === 1) {
          wands.add(target, 1);
          taken = 1;
        }
        break;
      case 'take-all': {
        const pile = ground.get(id);
        for (const [itemId, count] of Object.entries(pile?.items ?? {})) {
          for (let i = 0; i < count && player.roomFor(itemId) >= 1; i++) if (ground.take(id, 'item', itemId, 1) === 1) { player.addItem(itemId, 1); taken++; }
        }
        for (const [wandId, count] of Object.entries(ground.get(id)?.wands ?? {})) {
          for (let i = 0; i < count && wands.canAdd(wandId, 1); i++) if (ground.take(id, 'wand', wandId, 1) === 1) { wands.add(wandId, 1); taken++; }
        }
        break;
      }
    }
    this.message = taken > 0 ? `${taken} eşya aldın.` : 'Çantanda yer yok. Önce bir şey sat ya da at.';
    if (taken > 0) this.deps.onChanged?.();
    this.render();
  }
}
