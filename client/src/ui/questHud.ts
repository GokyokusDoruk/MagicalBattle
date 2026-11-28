import { directionTo, type TrackEntry } from '../quests/tracking';

const esc = (s: string): string => s.replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]!);

/**
 * Aktif görev göstergesi (Task 41): haritanın üst ortasında takip edilen görevin özeti yazar; hedefi varsa yanında
 * hedefe dönen küçük bir ok ve karo uzaklığı görünür. Hedefe çok yaklaşınca ok "burada" olur.
 */
export class QuestHud {
  readonly element: HTMLDivElement;
  private readonly textEl: HTMLElement;
  private readonly arrowEl: HTMLElement;
  private readonly distEl: HTMLElement;

  constructor() {
    this.element = document.createElement('div');
    this.element.className = 'pointer-events-none fixed left-1/2 top-2 z-40 hidden max-w-[70vw] -translate-x-1/2 items-center gap-2 rounded-full bg-black/65 px-4 py-1.5 text-xs text-amber-50 shadow sm:text-sm mobile:top-auto mobile:bottom-[calc(var(--sab)+11.5rem)] mobile:max-w-[calc(100vw-7.5rem)] mobile:px-3 mobile:landscape:top-[calc(var(--sat)+0.5rem)] mobile:landscape:bottom-auto mobile:landscape:max-w-[calc(100vw-20rem)]';
    this.element.innerHTML = '<span data-text class="min-w-0 truncate"></span><span data-arrow class="inline-block text-lg leading-none text-amber-300 transition-transform duration-150"></span><span data-dist class="shrink-0 text-[11px] text-amber-200"></span>';
    this.textEl = this.element.querySelector('[data-text]')!;
    this.arrowEl = this.element.querySelector('[data-arrow]')!;
    this.distEl = this.element.querySelector('[data-dist]')!;
  }

  /** `entry` takip edilen görev (yoksa null: gösterge gizlenir); `player` dünya konumu (piksel). */
  update(entry: TrackEntry | null, player: { x: number; y: number }): void {
    if (!entry) {
      this.element.classList.add('hidden');
      this.element.classList.remove('flex');
      return;
    }
    this.element.classList.remove('hidden');
    this.element.classList.add('flex');
    this.textEl.innerHTML = `${entry.kind === 'main' ? '★' : '▸'} ${esc(entry.summary)}`;
    if (!entry.target) {
      this.arrowEl.textContent = '';
      this.distEl.textContent = '';
      return;
    }
    const d = directionTo(player.x, player.y, entry.target);
    if (d.tiles <= 1) {
      this.arrowEl.textContent = '📍';
      this.arrowEl.style.transform = '';
      this.distEl.textContent = 'burada';
      return;
    }
    // Ok sağa bakan bir işarettir; hedefin açısı kadar döner
    this.arrowEl.textContent = '➤';
    this.arrowEl.style.transform = `rotate(${d.degrees}deg)`;
    this.distEl.textContent = `${d.tiles} karo`;
  }
}
