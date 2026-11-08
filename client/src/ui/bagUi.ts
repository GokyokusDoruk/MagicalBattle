import { SLOT_NAMES, getItem, type ItemDef } from '../economy/items';
import type { PlayerState } from '../economy/player';
import { CATEGORIES, CATEGORY_NAMES, type Carry } from '../inventory/carry';
import type { WandInventory } from '../wands/inventory';

export interface BagUiDeps {
  player: PlayerState;
  wands: WandInventory;
  carry: Carry;
  /** Kuşanma, çıkarma ya da atma oldu (kaydedilmemiş değişiklik) */
  onChanged?: () => void;
}

const esc = (s: string): string => s.replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]!);
const pct = (v: number): string => `%${Math.round(v * 100)}`;

/** Eşyanın kısa açıklaması: çanta kapasitesi, zırh ya da iksir etkisi */
export function describeItem(item: ItemDef): string {
  if (item.carry) return `+${item.carry.wands} asa, +${item.carry.goods} eşya, +${item.carry.gear} kuşanılabilir`;
  if (item.slot) return `${SLOT_NAMES[item.slot]} · +${pct(item.armor ?? 0)} zırh`;
  if (item.heal) return `+${item.heal} can`;
  return 'Ticari eşya';
}

/**
 * Çanta ekranı (B): kapasite çubukları (asa, eşya, kuşanılabilir), kuşanılan çanta, ticari eşyalar ve iksirler,
 * çantada taşınan ekipman. Altın ağırlık yapmaz. Eşyaları atabilir (geri alınamaz, iki tıkla onaylanır).
 */
export class BagUi {
  readonly element: HTMLDivElement;
  private opened = false;
  private message = '';
  /** Atmak için bir kez tıklanan eşya (ikinci tıklama onaylar) */
  private pendingDrop: string | null = null;

  constructor(private readonly deps: BagUiDeps) {
    this.element = document.createElement('div');
    this.element.className = 'fixed inset-0 z-[56] hidden items-center justify-center bg-black/70 p-3';
    this.element.setAttribute('role', 'dialog');
    this.element.setAttribute('aria-modal', 'true');
    this.element.addEventListener('click', (e) => this.onClick(e));
    window.addEventListener('keydown', (e) => {
      if (this.isOpen && e.code === 'Escape') this.close();
    });
    deps.player.onChange(() => this.isOpen && this.render());
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
    this.pendingDrop = null;
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

  private bars(): string {
    const { carry } = this.deps;
    const cap = carry.capacity();
    const use = carry.usage();
    return CATEGORIES.map((c) => {
      const over = use[c] > cap[c];
      const full = use[c] >= cap[c];
      const ratio = cap[c] > 0 ? Math.min(1, use[c] / cap[c]) : 1;
      return `<div data-capacity="${c}">
        <div class="flex justify-between text-xs"><span>${CATEGORY_NAMES[c]}</span><b class="${over ? 'text-red-300' : full ? 'text-amber-300' : ''}">${use[c]} / ${cap[c]}</b></div>
        <div class="mt-0.5 h-1.5 overflow-hidden rounded bg-white/15"><div class="h-full ${over ? 'bg-red-400' : full ? 'bg-amber-400' : 'bg-emerald-400'}" style="width:${ratio * 100}%"></div></div></div>`;
    }).join('');
  }

  private render(): void {
    if (!this.opened) return;
    const { player } = this.deps;
    const bagId = player.equipped.bag;
    const bag = bagId ? getItem(bagId) : undefined;
    const inv = player.inventory();

    const goods = inv.filter(({ id }) => !getItem(id)?.slot);
    const carriedGear = inv.filter(({ id }) => getItem(id)?.slot && !player.isEquipped(id));

    const row = (id: string, count: number, actions: string): string => {
      const item = getItem(id)!;
      return `<li data-item="${id}" class="flex flex-wrap items-center justify-between gap-2 rounded bg-slate-900 p-2">
        <div class="min-w-0"><span class="font-bold">${esc(item.name)}</span> ${count > 1 ? `<span class="text-slate-400">×${count}</span>` : ''}
          <div class="text-[11px] text-slate-400">${esc(describeItem(item))}</div></div>
        <div class="flex gap-1">${actions}</div></li>`;
    };
    const drop = (id: string, all: boolean): string => {
      const key = `${id}${all ? ':all' : ''}`;
      const sure = this.pendingDrop === key;
      return `<button type="button" data-action="drop" data-id="${id}" data-all="${all}" class="rounded px-2 py-1 text-xs ${sure ? 'bg-red-500 font-bold text-white' : 'bg-slate-700'}">${sure ? 'Emin misin?' : all ? 'Hepsini at' : 'At'}</button>`;
    };

    const goodsHtml = goods
      .map(({ id, count }) => row(id, count, `${drop(id, false)}${count > 1 ? drop(id, true) : ''}`))
      .join('');
    const gearHtml = carriedGear
      .map(({ id, count }) => {
        return row(id, count, `<button type="button" data-action="equip" data-id="${id}" class="rounded bg-sky-400 px-2 py-1 text-xs font-bold text-slate-900">Kuşan</button>${drop(id, false)}`);
      })
      .join('');

    this.element.innerHTML = `
      <div class="flex max-h-full w-full max-w-lg flex-col gap-3 rounded-xl border border-amber-300/40 bg-slate-950 p-4 text-amber-50 shadow-2xl">
        <div class="flex items-start justify-between gap-2">
          <div><h2 class="text-lg font-bold text-amber-300">Çanta</h2>
            <p class="text-xs italic text-slate-300" data-message>${esc(this.message || 'Altın ağırlık yapmaz. Giyilen ekipman ve kuşanılı asalar yer kaplamaz.')}</p></div>
          <button type="button" data-action="close" class="rounded bg-white/10 px-2 py-1 text-sm hover:bg-white/20" aria-label="Kapat">✕</button>
        </div>
        <div class="grid gap-2 rounded bg-black/40 p-3 sm:grid-cols-3" data-bars>${this.bars()}</div>
        <div data-scrollable style="touch-action:pan-y" class="min-h-0 flex-1 overflow-y-auto pr-1">
          <h3 class="mb-1 text-sm font-bold text-amber-200">Kuşanılan çanta</h3>
          <div class="mb-3 flex items-center justify-between gap-2 rounded bg-slate-900 p-2" data-bag>
            ${
              bag
                ? `<div><b>${esc(bag.name)}</b><div class="text-[11px] text-slate-400">${esc(describeItem(bag))}</div></div>
                   <button type="button" data-action="unequip-bag" class="rounded bg-slate-700 px-2 py-1 text-xs">Çıkar</button>`
                : '<span class="text-sm text-slate-400">Çanta yok (başlangıç kapasitesi). Tüccardan çanta alabilirsin.</span>'
            }
          </div>
          <h3 class="mb-1 text-sm font-bold text-amber-200">Ticari eşyalar ve iksirler</h3>
          ${goodsHtml ? `<ul class="mb-3 flex flex-col gap-2">${goodsHtml}</ul>` : '<p class="mb-3 text-sm text-slate-400">Hiç eşyan yok.</p>'}
          <h3 class="mb-1 text-sm font-bold text-amber-200">Çantadaki ekipman</h3>
          ${gearHtml ? `<ul class="mb-3 flex flex-col gap-2">${gearHtml}</ul>` : '<p class="mb-3 text-sm text-slate-400">Çantanda giyilmeyen ekipman yok.</p>'}
          <p class="text-xs text-slate-400">Asalar için <b>W</b> tuşu. Can iksirleri, savaşlarda can kalıcı olunca kullanılabilecek.</p>
        </div>
      </div>`;
  }

  private onClick(e: MouseEvent): void {
    const target = e.target as HTMLElement;
    if (target === this.element) return this.close();
    const btn = target.closest<HTMLElement>('[data-action]');
    if (!btn) return;
    const { player } = this.deps;
    const id = btn.dataset.id ?? '';
    switch (btn.dataset.action) {
      case 'close':
        return this.close();
      case 'equip': {
        if (player.equip(id)) {
          this.message = `Kuşandın: ${getItem(id)!.name}`;
          this.deps.onChanged?.();
        } else this.message = player.lastBlockReason ?? 'Kuşanılamadı.';
        this.pendingDrop = null;
        return this.render();
      }
      case 'unequip-bag': {
        if (player.unequip('bag')) {
          this.message = 'Çantayı çıkardın.';
          this.deps.onChanged?.();
        } else this.message = player.lastBlockReason ?? 'Çıkarılamadı.';
        this.pendingDrop = null;
        return this.render();
      }
      case 'drop': {
        const all = btn.dataset.all === 'true';
        const key = `${id}${all ? ':all' : ''}`;
        if (this.pendingDrop !== key) {
          this.pendingDrop = key;
          this.message = 'Atılan eşya geri gelmez. Onaylamak için tekrar bas.';
          return this.render();
        }
        const n = all ? player.count(id) : 1;
        if (player.removeItem(id, n)) {
          this.message = `Attın: ${getItem(id)?.name ?? id}${n > 1 ? ` ×${n}` : ''}`;
          this.deps.onChanged?.();
        }
        this.pendingDrop = null;
        return this.render();
      }
    }
  }
}

