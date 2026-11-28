import { SLOT_NAMES, getItem, type GearSlot, type ItemDef } from '../economy/items';
import type { PlayerState } from '../economy/player';
import type { WandInventory } from '../wands/inventory';
import { RARITY_NAMES, describeWand, getWand, type WandDef } from '../wands/catalog';
import { heroGearFrom } from '../battle/arena/heroGear';
import { ELEMENT_PALETTE, itemIconSvg } from './itemIcon';
import { describeItem, itemNameHtml } from './itemText';

export interface CharacterScreenDeps {
  player: PlayerState;
  wands: WandInventory;
  name: () => string;
  /** Kuşanma ya da çıkarma oldu (kaydedilmemiş değişiklik) */
  onChanged: () => void;
}

const esc = (s: string): string => s.replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]!);

/** Yuvaların yeri: sol sütun ve sağ sütun; her yuva modelin bir kemiğine çizgiyle bağlanır */
const LEFT: readonly (GearSlot | 'wand')[] = ['hat', 'necklace', 'robe', 'gloves', 'ring'];
const RIGHT: readonly (GearSlot | 'wand')[] = ['wand', 'bracelet', 'pants', 'bag', 'boots'];
const BONE: Record<GearSlot | 'wand', { bone: string; up?: number }> = {
  hat: { bone: 'head', up: 0.9 },
  necklace: { bone: 'chest', up: 0.35 },
  robe: { bone: 'chest' },
  gloves: { bone: 'handl' },
  ring: { bone: 'handl' },
  wand: { bone: 'handslotr' },
  bracelet: { bone: 'wristr' },
  pants: { bone: 'upperlegr' },
  bag: { bone: 'hips' },
  boots: { bone: 'footl' },
};

/** Asa simgesi (SVG): sap ve element renginde parlayan küre; çerçeve nadirliğe göre */
export function wandIconSvg(w: WandDef, size = 40): string {
  const p = ELEMENT_PALETTE[w.element];
  const big = w.rarity >= 4;
  return `<svg viewBox="0 0 40 40" width="${size}" height="${size}" aria-hidden="true">
    <rect x="1" y="1" width="38" height="38" rx="8" fill="${p.dark}" stroke="${p.light}" stroke-opacity="${0.25 + w.rarity * 0.12}" stroke-width="2"/>
    <line x1="12" y1="31" x2="${big ? 27 : 25}" y2="${big ? 10 : 13}" stroke="#8a5a2b" stroke-width="${big ? 3.2 : 2.4}" stroke-linecap="round"/>
    <circle cx="${big ? 28 : 26}" cy="${big ? 9 : 12}" r="${big ? 5 : 3.6}" fill="${p.light}"/><circle cx="${big ? 28 : 26}" cy="${big ? 9 : 12}" r="${big ? 8 : 6}" fill="${p.main}" opacity="0.35"/></svg>`;
}

type Picked = { kind: 'item'; id: string; equipped: boolean } | { kind: 'wand'; id: string; equipped: boolean };

/**
 * Faz 7: karakter ekranı. Sol üstte büyücünün portresi; basınca tam ekran açılır:
 * - Üstte ad, seviye ve can.
 * - Ortada büyücü (kuşandıklarıyla) kendi etrafında yavaşça döner. Ekipman yuvaları iki yanda, her biri ince bir çizgiyle
 *   ilgili vücut bölgesine bağlı (şapka başa, eldiven ele, ayakkabı ayağa...).
 * - Altta çanta: asalar ve eşyalar küçük simgeler.
 * - Bir eşyaya basınca ekranı kaplayan büyük görüntüsü ve verdiği özellikler; kuşan / çıkar.
 */
export class CharacterScreen {
  readonly portrait: HTMLButtonElement;
  readonly element: HTMLDivElement;
  private opened = false;
  private stop: (() => void) | null = null;
  private picked: Picked | null = null;

  constructor(private readonly deps: CharacterScreenDeps) {
    this.portrait = document.createElement('button');
    this.portrait.type = 'button';
    this.portrait.setAttribute('aria-label', 'Karakter ekranı');
    this.portrait.className = 'pointer-events-auto relative h-12 w-12 shrink-0 overflow-hidden rounded-full border-2 border-amber-300/80 bg-slate-800 shadow-lg';
    this.portrait.innerHTML = '<span class="flex h-full items-center justify-center text-2xl">🧙</span>';
    this.portrait.addEventListener('click', () => this.open());
    this.element = document.createElement('div');
    this.element.className = 'fixed inset-0 z-[58] hidden flex-col bg-gradient-to-b from-slate-950 via-[#151a33] to-slate-950 text-amber-50';
    this.element.setAttribute('data-scrollable', '');
    void this.refreshPortrait();
  }

  get isOpen(): boolean {
    return this.opened;
  }

  private gear() {
    return heroGearFrom(this.deps.player.equipped, this.deps.wands.equipped);
  }

  /** Portreyi (kuşandıklarıyla) yeniden çizer; ekipman değişince çağrılır. */
  async refreshPortrait(): Promise<void> {
    try {
      const { renderHeroPortrait } = await import('../battle/arena/heroPortrait');
      const url = await renderHeroPortrait(this.gear());
      this.portrait.innerHTML = `<img src="${url}" alt="" class="h-full w-full object-cover">`;
    } catch {
      // 3D yoksa simge kalır
    }
  }

  open(): void {
    if (this.opened) return;
    this.opened = true;
    this.element.classList.remove('hidden');
    this.element.classList.add('flex');
    this.render();
  }

  close(): void {
    this.opened = false;
    this.stop?.();
    this.stop = null;
    this.element.classList.add('hidden');
    this.element.classList.remove('flex');
    this.element.innerHTML = '';
  }

  toggle(): void {
    if (this.opened) this.close();
    else this.open();
  }

  private slotHtml(slot: GearSlot | 'wand', side: 'left' | 'right'): string {
    const { player, wands } = this.deps;
    let icon = '<span class="flex h-11 w-11 items-center justify-center rounded-lg border border-dashed border-slate-600 text-[10px] text-slate-500">boş</span>';
    let label = slot === 'wand' ? 'Asa' : SLOT_NAMES[slot];
    if (slot === 'wand') {
      const w = wands.equippedWand;
      if (w) {
        icon = wandIconSvg(w, 44);
        label = RARITY_NAMES[w.rarity];
      }
    } else {
      const id = player.equipped[slot];
      const item = id ? getItem(id) : undefined;
      if (item) {
        icon = itemIconSvg(item, 44);
        label = item.rarity ? RARITY_NAMES[item.rarity] : label;
      }
    }
    return `<button type="button" data-slot="${slot}" class="pointer-events-auto flex ${side === 'right' ? 'flex-row-reverse text-right' : ''} items-center gap-1.5 rounded-xl bg-slate-900/70 p-1 pr-2 ring-1 ring-white/10 active:scale-95">
      ${icon}<span class="max-w-[64px] text-[10px] leading-tight text-slate-300">${esc(slot === 'wand' ? 'Asa' : SLOT_NAMES[slot])}<br><span class="text-slate-500">${esc(label === (slot === 'wand' ? 'Asa' : SLOT_NAMES[slot]) ? '' : label)}</span></span></button>`;
  }

  private bagHtml(): string {
    const { player, wands } = this.deps;
    const wandCells = wands
      .owned()
      .filter(({ id }) => id !== wands.equipped)
      .map(({ id, count }) => {
        const w = getWand(id)!;
        return `<button type="button" data-wand="${id}" class="relative rounded-lg active:scale-95" title="${esc(w.name)}">${wandIconSvg(w, 46)}${count > 1 ? `<span class="absolute -right-1 -top-1 rounded-full bg-slate-700 px-1 text-[9px]">${count}</span>` : ''}</button>`;
      });
    const itemCells = player
      .inventory()
      .map(({ id, count }) => ({ id, count: count - (player.isEquipped(id) ? 1 : 0) }))
      .filter(({ count }) => count > 0)
      .map(({ id, count }) => {
        const item = getItem(id);
        if (!item) return '';
        return `<button type="button" data-item="${id}" class="relative rounded-lg active:scale-95" title="${esc(item.name)}">${itemIconSvg(item, 46)}${count > 1 ? `<span class="absolute -right-1 -top-1 rounded-full bg-slate-700 px-1 text-[9px]">${count}</span>` : ''}</button>`;
      });
    const cells = [...wandCells, ...itemCells].filter(Boolean);
    return cells.length ? cells.join('') : '<p class="col-span-full text-center text-sm text-slate-500">Çantan boş.</p>';
  }

  private render(): void {
    const { player } = this.deps;
    const hpRatio = Math.max(0, Math.min(1, player.hp / player.maxHp));
    this.element.innerHTML = `
      <div class="flex items-center gap-3 px-4 pb-2 pt-3">
        <div class="min-w-0 flex-1">
          <div class="truncate text-lg font-bold text-amber-200">${esc(this.deps.name())} <span class="text-sm font-normal text-slate-300">· Seviye ${player.level}</span></div>
          <div class="mt-1 flex items-center gap-2 text-xs"><span>❤</span><div class="h-2 flex-1 overflow-hidden rounded bg-white/15"><div class="h-full bg-rose-400" style="width:${hpRatio * 100}%"></div></div><b class="tabular-nums">${player.hp}/${player.maxHp}</b></div>
        </div>
        <button type="button" data-close class="rounded-lg bg-white/10 px-3 py-2 text-sm">Kapat</button>
      </div>
      <div data-stage class="relative min-h-0 flex-[1.4]">
        <canvas data-view class="absolute inset-0 h-full w-full"></canvas>
        <svg data-lines class="pointer-events-none absolute inset-0 h-full w-full"></svg>
        <div class="pointer-events-none absolute inset-y-2 left-2 flex flex-col justify-between">${LEFT.map((s) => this.slotHtml(s, 'left')).join('')}</div>
        <div class="pointer-events-none absolute inset-y-2 right-2 flex flex-col justify-between">${RIGHT.map((s) => this.slotHtml(s, 'right')).join('')}</div>
      </div>
      <div class="flex min-h-0 flex-1 flex-col border-t border-white/10 bg-black/30 px-3 pb-3 pt-2">
        <div class="mb-2 text-sm font-bold text-amber-200">🎒 Çanta</div>
        <div class="grid min-h-0 grid-cols-[repeat(auto-fill,minmax(52px,1fr))] gap-2 overflow-y-auto" style="touch-action:pan-y" data-scrollable>${this.bagHtml()}</div>
      </div>
      <div data-detail></div>`;
    this.element.querySelector('[data-close]')!.addEventListener('click', () => this.close());
    this.element.querySelectorAll<HTMLElement>('[data-slot]').forEach((b) =>
      b.addEventListener('click', () => {
        const slot = b.dataset.slot as GearSlot | 'wand';
        if (slot === 'wand') {
          if (this.deps.wands.equipped) this.showDetail({ kind: 'wand', id: this.deps.wands.equipped, equipped: true });
        } else {
          const id = player.equipped[slot];
          if (id) this.showDetail({ kind: 'item', id, equipped: true });
        }
      }),
    );
    this.element.querySelectorAll<HTMLElement>('[data-item]').forEach((b) => b.addEventListener('click', () => this.showDetail({ kind: 'item', id: b.dataset.item!, equipped: false })));
    this.element.querySelectorAll<HTMLElement>('[data-wand]').forEach((b) => b.addEventListener('click', () => this.showDetail({ kind: 'wand', id: b.dataset.wand!, equipped: false })));
    void this.startView();
    if (this.picked) this.showDetail(this.picked);
  }

  /** Büyük görüntü ve özellikler; kuşan / çıkar. */
  private showDetail(p: Picked): void {
    this.picked = p;
    const host = this.element.querySelector<HTMLElement>('[data-detail]')!;
    const { player, wands } = this.deps;
    let icon = '';
    let title = '';
    let lines: string[] = [];
    let action = '';
    if (p.kind === 'wand') {
      const w = getWand(p.id)!;
      icon = wandIconSvg(w, 160);
      title = `${esc(w.name)} <span class="text-slate-400">Sv ${w.level}</span>`;
      lines = describeWand(w);
      action = p.equipped ? 'unequip-wand' : 'equip-wand';
    } else {
      const item: ItemDef | undefined = getItem(p.id);
      if (!item) return;
      icon = itemIconSvg(item, 160);
      title = itemNameHtml(item);
      lines = [describeItem(item), ...(item.description ? [item.description] : [])];
      if (item.slot) action = p.equipped ? 'unequip' : 'equip';
    }
    const label = action === 'equip' || action === 'equip-wand' ? 'Kuşan' : action ? 'Çıkar' : '';
    host.innerHTML = `<div class="fixed inset-0 z-[59] flex items-center justify-center bg-black/75 p-4" data-detail-bg>
      <div class="flex w-full max-w-sm flex-col items-center gap-3 rounded-2xl bg-slate-900 p-5 text-center shadow-2xl ring-1 ring-amber-200/20">
        <div class="drop-shadow-[0_0_24px_rgba(251,191,36,0.25)]">${icon}</div>
        <div class="text-lg font-bold">${title}</div>
        <ul class="space-y-1 text-sm text-slate-200">${lines.map((l) => `<li>${esc(l)}</li>`).join('')}</ul>
        <p data-detail-msg class="min-h-[1rem] text-xs text-red-300"></p>
        <div class="flex w-full gap-2">
          ${label ? `<button type="button" data-act="${action}" class="flex-1 rounded-lg bg-amber-300 py-2 font-bold text-slate-900">${label}</button>` : ''}
          <button type="button" data-dismiss class="flex-1 rounded-lg bg-white/10 py-2">Kapat</button>
        </div></div></div>`;
    const dismiss = (): void => {
      this.picked = null;
      host.innerHTML = '';
    };
    host.querySelector('[data-dismiss]')!.addEventListener('click', dismiss);
    host.querySelector('[data-detail-bg]')!.addEventListener('click', (e) => e.target === e.currentTarget && dismiss());
    host.querySelector('[data-act]')?.addEventListener('click', () => {
      let ok = true;
      if (action === 'equip') ok = player.equip(p.id);
      else if (action === 'unequip') ok = player.unequip(getItem(p.id)!.slot!);
      else if (action === 'equip-wand') ok = wands.equip(p.id);
      else if (action === 'unequip-wand') ok = wands.unequip();
      if (!ok) {
        host.querySelector('[data-detail-msg]')!.textContent = 'Olmadı: seviye yetersiz ya da çantada yer yok.';
        return;
      }
      this.picked = null;
      this.deps.onChanged();
      void this.refreshPortrait();
      this.stop?.();
      this.render();
    });
  }

  /** Ortadaki dönen büyücü ve yuvalardan vücuda çizgiler. */
  private async startView(): Promise<void> {
    const canvas = this.element.querySelector<HTMLCanvasElement>('[data-view]');
    const svg = this.element.querySelector<SVGSVGElement>('[data-lines]');
    const stage = this.element.querySelector<HTMLElement>('[data-stage]');
    if (!canvas || !svg || !stage) return;
    try {
      const { startHeroViewer } = await import('../battle/arena/heroPortrait');
      if (!this.opened) return;
      this.stop = await startHeroViewer(canvas, this.gear(), (project) => {
        const rect = stage.getBoundingClientRect();
        const out: string[] = [];
        for (const [slot, a] of Object.entries(BONE) as [GearSlot | 'wand', { bone: string; up?: number }][]) {
          const btn = stage.querySelector<HTMLElement>(`[data-slot="${slot}"]`);
          const pt = project(a.bone, a.up ?? 0);
          if (!btn || !pt) continue;
          const b = btn.getBoundingClientRect();
          const left = LEFT.includes(slot);
          const x1 = (left ? b.right : b.left) - rect.left;
          const y1 = b.top + b.height / 2 - rect.top;
          const equipped = slot === 'wand' ? !!this.deps.wands.equipped : !!this.deps.player.equipped[slot as GearSlot];
          out.push(`<line x1="${x1}" y1="${y1}" x2="${pt.x}" y2="${pt.y}" stroke="${equipped ? 'rgba(252,211,77,0.7)' : 'rgba(148,163,184,0.25)'}" stroke-width="1.2"/><circle cx="${pt.x}" cy="${pt.y}" r="2.5" fill="${equipped ? '#fcd34d' : '#64748b'}"/>`);
        }
        svg.innerHTML = out.join('');
      });
    } catch {
      // 3D yoksa yalnızca yuvalar görünür
    }
  }
}

