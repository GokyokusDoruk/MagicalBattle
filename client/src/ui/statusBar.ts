import { levelProgress } from '../economy/leveling';

export interface StatusView {
  level: number;
  gold: number;
  xp: number;
  /** Kaydedilmemiş ilerleme var mı (son kayıt noktasından sonra bir şey değişti) */
  dirty: boolean;
  /** Takip edilen (aktif) görevler */
  quests: { title: string; value: number; target: number }[];
}

/**
 * Sol üstte küçük durum paneli: seviye, altın, XP çubuğu, aktif görevlerin ilerlemesi ve
 * "kaydedilmedi" uyarısı (kayıt yalnızca şehirlerde yapıldığı için).
 */
export class StatusBar {
  readonly element: HTMLDivElement;
  private readonly levelEl: HTMLElement;
  private readonly goldEl: HTMLElement;
  private readonly fillEl: HTMLElement;
  private readonly dirtyEl: HTMLElement;
  private readonly questsEl: HTMLElement;

  constructor() {
    this.element = document.createElement('div');
    this.element.className =
      'pointer-events-none fixed left-3 top-14 z-40 w-48 rounded-lg bg-black/60 px-3 py-2 text-xs text-amber-50 shadow';
    this.element.innerHTML = `
      <div class="flex items-center justify-between font-bold"><span data-level></span><span data-gold></span></div>
      <div class="mt-1 h-1.5 overflow-hidden rounded bg-white/15"><div data-fill class="h-full bg-sky-400 transition-all duration-300"></div></div>
      <div data-dirty class="mt-1 hidden text-[10px] text-amber-300">● Kaydedilmedi: bir şehre girince kaydedilir</div>
      <div data-quests class="mt-1 flex flex-col gap-0.5 text-[11px] text-slate-200"></div>`;
    const q = <T extends HTMLElement>(sel: string): T => this.element.querySelector<T>(sel)!;
    this.levelEl = q('[data-level]');
    this.goldEl = q('[data-gold]');
    this.fillEl = q('[data-fill]');
    this.dirtyEl = q('[data-dirty]');
    this.questsEl = q('[data-quests]');
  }

  update(view: StatusView): void {
    const p = levelProgress(view.xp);
    this.levelEl.textContent = `Seviye ${view.level}`;
    this.goldEl.textContent = `🪙 ${view.gold}`;
    this.fillEl.style.width = `${p.ratio * 100}%`;
    this.dirtyEl.classList.toggle('hidden', !view.dirty);
    this.questsEl.replaceChildren(
      ...view.quests.map((qv) => {
        const row = document.createElement('div');
        row.textContent = `▸ ${qv.title}: ${qv.value}/${qv.target}`;
        return row;
      }),
    );
  }
}
