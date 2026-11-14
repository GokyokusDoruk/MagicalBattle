import { levelProgress } from '../economy/leveling';

export interface StatusView {
  level: number;
  /** Mevcut can ve azami can */
  hp: number;
  maxHp: number;
  gold: number;
  xp: number;
  /** Kaydedilmemiş ilerleme var mı (son kayıt noktasından sonra bir şey değişti) */
  dirty: boolean;
  /** Takip edilen (aktif) görevler */
  quests: { title: string; value: number; target: number }[];
  /** Harcanmamış yetenek puanı */
  skillPoints: number;
  /** Çanta özeti, örn. "Asa 2/6 · Eşya 12/20 · Ekip. 1/2"; dolu kategori varsa bagFull true */
  bagSummary: string;
  bagFull: boolean;
  /** Ahlak durumu etiketi, örn. "Düzen Bekçisi II (+55)" */
  moralityLabel: string;
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
  private readonly hpEl: HTMLElement;
  private readonly hpFillEl: HTMLElement;
  private readonly dirtyEl: HTMLElement;
  private readonly questsEl: HTMLElement;
  private readonly skillsBtn: HTMLButtonElement;
  private readonly moralEl: HTMLElement;
  private readonly wandsBtn: HTMLButtonElement;
  private readonly bagBtn: HTMLButtonElement;

  /** `onSkills` verilirse durum çubuğunda yetenek ağacını açan bir düğme çıkar (dokunmatik için). */
  constructor(onSkills?: () => void, onWands?: () => void, onBag?: () => void) {
    this.element = document.createElement('div');
    this.element.className =
      'pointer-events-none fixed left-3 top-14 z-40 w-48 rounded-lg bg-black/60 px-3 py-2 text-xs text-amber-50 shadow';
    this.element.innerHTML = `
      <div class="flex items-center justify-between font-bold"><span data-level></span><span data-gold></span></div>
      <div class="mt-1 h-1.5 overflow-hidden rounded bg-white/15"><div data-fill class="h-full bg-sky-400 transition-all duration-300"></div></div>
      <div class="mt-1 flex items-center justify-between text-[11px]"><span>❤ Can</span><b data-hp></b></div>
      <div class="h-1.5 overflow-hidden rounded bg-white/15"><div data-hpfill class="h-full bg-rose-400 transition-all duration-300"></div></div>
      <button type="button" data-skills class="pointer-events-auto mt-1 w-full rounded bg-white/10 px-2 py-1 text-left text-[11px] hover:bg-white/20">✦ Yetenekler (K)</button>
      <button type="button" data-wands class="pointer-events-auto mt-1 w-full rounded bg-white/10 px-2 py-1 text-left text-[11px] hover:bg-white/20">🪄 Asalar (W)</button>
      <button type="button" data-bag class="pointer-events-auto mt-1 w-full rounded bg-white/10 px-2 py-1 text-left text-[11px] hover:bg-white/20">🎒 Çanta (B)</button>
      <div data-moral class="mt-1 text-[11px] text-purple-200"></div>
      <div data-dirty class="mt-1 hidden text-[10px] text-amber-300">● Kaydedilmedi: bir şehre girince kaydedilir</div>
      <div data-quests class="mt-1 flex flex-col gap-0.5 text-[11px] text-slate-200"></div>`;
    const q = <T extends HTMLElement>(sel: string): T => this.element.querySelector<T>(sel)!;
    this.levelEl = q('[data-level]');
    this.goldEl = q('[data-gold]');
    this.fillEl = q('[data-fill]');
    this.hpEl = q('[data-hp]');
    this.hpFillEl = q('[data-hpfill]');
    this.dirtyEl = q('[data-dirty]');
    this.questsEl = q('[data-quests]');
    this.moralEl = q('[data-moral]');
    this.skillsBtn = q<HTMLButtonElement>('[data-skills]');
    this.skillsBtn.hidden = !onSkills;
    if (onSkills) this.skillsBtn.addEventListener('click', onSkills);
    this.bagBtn = q<HTMLButtonElement>('[data-bag]');
    this.bagBtn.hidden = !onBag;
    if (onBag) this.bagBtn.addEventListener('click', onBag);
    this.wandsBtn = q<HTMLButtonElement>('[data-wands]');
    this.wandsBtn.hidden = !onWands;
    if (onWands) this.wandsBtn.addEventListener('click', onWands);
  }

  update(view: StatusView): void {
    const p = levelProgress(view.xp);
    this.levelEl.textContent = `Seviye ${view.level}`;
    this.goldEl.textContent = `🪙 ${view.gold}`;
    this.fillEl.style.width = `${p.ratio * 100}%`;
    this.hpEl.textContent = `${view.hp}/${view.maxHp}`;
    this.hpEl.classList.toggle('text-amber-300', view.hp < view.maxHp);
    this.hpFillEl.style.width = `${(view.hp / view.maxHp) * 100}%`;
    this.skillsBtn.textContent = view.skillPoints > 0 ? `✦ Yetenekler (K) · ${view.skillPoints} puan!` : '✦ Yetenekler (K)';
    this.skillsBtn.classList.toggle('text-emerald-300', view.skillPoints > 0);
    this.bagBtn.textContent = `🎒 Çanta (B) · ${view.bagSummary}`;
    this.bagBtn.classList.toggle('text-amber-300', view.bagFull);
    this.moralEl.textContent = `☯ ${view.moralityLabel}`;
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
