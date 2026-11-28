import type { TrackEntry } from '../quests/tracking';

const esc = (s: string): string => s.replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]!);

export interface QuestLogDeps {
  /** Aktif (devam eden) ve tamamlanan görevler; her açılışta ve değişimde yeniden okunur */
  entries: () => { active: TrackEntry[]; completed: { id: string; title: string }[] };
  /** Şu an takip edilen görevin kimliği */
  tracked: () => string | null;
  /** Oyuncu bir görevi takibe aldı */
  onTrack: (id: string) => void;
}

/**
 * Görev günlüğü (Task 41): aldığın tüm görevler (ana ve yan) listelenir; birini seçince ayrıntısı görünür ve
 * "Takip et" ile aktif görev yaparsın. Aktif görev haritanın üst ortasında özetlenir ve ok oraya yönlendirir.
 */
export class QuestLogUi {
  readonly element: HTMLDivElement;
  private opened = false;
  private selected: string | null = null;

  constructor(private readonly deps: QuestLogDeps) {
    this.element = document.createElement('div');
    this.element.className = 'fixed inset-0 z-[56] hidden items-center justify-center bg-black/70 p-3 mb-sheet';
    this.element.setAttribute('role', 'dialog');
    this.element.setAttribute('aria-modal', 'true');
    this.element.addEventListener('click', (e) => this.onClick(e));
    window.addEventListener('keydown', (e) => {
      if (this.opened && e.code === 'Escape') this.close();
    });
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
    this.selected = this.deps.tracked();
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

  /** Açıkken yeniden çizer (görev ilerlerse ya da biterse). */
  refresh(): void {
    if (this.opened) this.render();
  }

  private render(): void {
    if (!this.opened) return;
    const { active, completed } = this.deps.entries();
    const tracked = this.deps.tracked();
    if (!active.some((e) => e.id === this.selected)) this.selected = tracked ?? active[0]?.id ?? null;
    const sel = active.find((e) => e.id === this.selected) ?? null;

    const row = (e: TrackEntry): string => {
      const on = e.id === this.selected;
      const isTracked = e.id === tracked;
      return `<button type="button" data-action="select" data-id="${esc(e.id)}" class="flex w-full items-center justify-between gap-2 rounded px-2 py-2 text-left text-sm ${on ? 'bg-amber-300 text-slate-900' : 'bg-slate-800 text-slate-100 hover:bg-slate-700'}">
        <span class="min-w-0 truncate">${e.kind === 'main' ? '★ ' : '▸ '}<b>${esc(e.title)}</b>${e.progress ? ` <span class="opacity-70">${e.progress.value}/${e.progress.target}</span>` : ''}</span>
        ${isTracked ? '<span class="shrink-0 text-xs font-bold">📍 takipte</span>' : ''}</button>`;
    };

    const detail = sel
      ? `<h3 class="text-base font-bold text-amber-200">${esc(sel.title)}</h3>
         <p class="mt-1 text-xs text-slate-300">${esc(sel.description)}</p>
         <p class="mt-2 text-xs text-sky-300">${esc(sel.summary)}</p>
         ${sel.target ? `<p class="mt-1 text-xs text-slate-400">Yer: ${esc(sel.target.label)}</p>` : '<p class="mt-1 text-xs text-slate-500">Haritada tek bir yer yok: yolda ya da çalılıkta savaşarak ilerle.</p>'}
         ${sel.rewardText ? `<p class="mt-1 text-xs text-emerald-300">Ödül: ${esc(sel.rewardText)}</p>` : ''}
         <button type="button" data-action="track" data-id="${esc(sel.id)}" ${sel.id === tracked ? 'disabled' : ''} class="mt-3 w-full rounded bg-amber-300 px-4 py-2 font-bold text-slate-900 disabled:opacity-50">${sel.id === tracked ? '📍 Takip ediliyor' : 'Takip et'}</button>`
      : '<p class="text-sm text-slate-400">Henüz aktif görevin yok. Şehirlerdeki hancılardan yan görev alabilirsin.</p>';

    this.element.innerHTML = `
      <div class="flex max-h-full w-full max-w-2xl flex-col gap-3 rounded-xl border border-amber-300/40 bg-slate-950 p-4 text-amber-50 shadow-2xl">
        <div class="flex items-start justify-between gap-2">
          <div><h2 class="text-lg font-bold text-amber-300">Görevler</h2>
            <p class="text-xs italic text-slate-300">Birini seçip "Takip et" de: özeti ekranın üstünde yazar, ok sana yolu gösterir.</p></div>
          <button type="button" data-action="close" class="rounded bg-white/10 px-2 py-1 text-sm hover:bg-white/20" aria-label="Kapat">✕</button>
        </div>
        <div class="grid min-h-0 flex-1 gap-3 overflow-y-auto sm:grid-cols-[1fr_1.2fr]" data-scrollable style="touch-action:pan-y">
          <div class="flex flex-col gap-1">
            <h4 class="text-xs font-bold uppercase text-slate-400">Aktif (${active.length})</h4>
            ${active.map(row).join('') || '<p class="text-sm text-slate-500">Yok</p>'}
            ${completed.length ? `<h4 class="mt-3 text-xs font-bold uppercase text-slate-400">Tamamlanan (${completed.length})</h4>${completed.map((c) => `<div class="rounded bg-slate-900 px-2 py-1 text-xs text-emerald-300">✓ ${esc(c.title)}</div>`).join('')}` : ''}
          </div>
          <div class="rounded bg-slate-900 p-3" data-detail>${detail}</div>
        </div>
      </div>`;
  }

  private onClick(e: MouseEvent): void {
    const target = e.target as HTMLElement;
    if (target === this.element) return this.close();
    const btn = target.closest<HTMLElement>('[data-action]');
    if (!btn) return;
    const id = btn.dataset.id ?? '';
    switch (btn.dataset.action) {
      case 'close':
        return this.close();
      case 'select':
        this.selected = id;
        return this.render();
      case 'track':
        this.deps.onTrack(id);
        return this.render();
    }
  }
}
