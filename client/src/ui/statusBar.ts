import { levelProgress } from '../economy/leveling';
import { CURRENCIES, CURRENCY_ICONS, CURRENCY_NAMES, type Wallet } from '../economy/currency';

export interface StatusView {
  level: number;
  /** Mevcut can ve azami can */
  hp: number;
  maxHp: number;
  /** Dört para biriminin bakiyesi */
  wallet: Readonly<Wallet>;
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
  /** Ahlak durumu etiketi, örn. "Ak Büyücü II" */
  moralityLabel: string;
  /** İbre: -1 (tam kara büyücü) ile +1 (tam ak büyücü) arası */
  moralNeedle: number;
  /** İbrenin verdiği bonusların kısa açıklaması (dokununca/üstüne gelince görünür) */
  moralBonus: string;
  /** Oyun seviyesinin adı: Kolay, Normal, Zor */
  difficultyName: string;
}

/**
 * Kara ↔ Ak büyücü ibresi (Faz 2): solda kara, sağda ak; ibre puana göre kayar. Renkli şerit ortada griye döner.
 * `needle` -1..1. Saf HTML üretir, testlenebilir.
 */
export function moralGaugeHtml(needle: number, label: string, bonus = ''): string {
  const n = Math.max(-1, Math.min(1, needle));
  const pct = ((n + 1) / 2) * 100;
  const color = n > 0.05 ? '#fef3c7' : n < -0.05 ? '#a78bfa' : '#cbd5e1';
  return `<div class="flex items-center justify-between text-[10px] text-slate-300"><span>🌑 Kara</span><b style="color:${color}">${label}</b><span>Ak ☀️</span></div>
    <div class="relative mt-0.5 h-2 rounded-full" style="background:linear-gradient(90deg,#1e1b4b,#4c1d95 30%,#64748b 50%,#e2e8f0 70%,#fffbeb)">
      <div data-needle class="absolute -top-1 h-4 w-1.5 -translate-x-1/2 rounded-sm bg-amber-300 shadow ring-1 ring-black/60 transition-all duration-700" style="left:${pct.toFixed(1)}%"></div>
    </div>${bonus ? `<div data-bonus class="mt-1 text-[10px] leading-tight text-slate-300">${bonus}</div>` : ''}`;
}

/**
 * Sol üstte küçük durum paneli: seviye, altın, XP çubuğu, aktif görevlerin ilerlemesi ve
 * "kaydedilmedi" uyarısı (kayıt yalnızca şehirlerde yapıldığı için).
 */
export class StatusBar {
  readonly element: HTMLDivElement;
  private readonly levelEl: HTMLElement;
  private readonly walletEl: HTMLElement;
  private readonly fillEl: HTMLElement;
  private readonly hpEl: HTMLElement;
  private readonly hpFillEl: HTMLElement;
  private readonly dirtyEl: HTMLElement;
  private readonly questsEl: HTMLElement;
  private readonly skillsBtn: HTMLButtonElement;
  private readonly moralEl: HTMLElement;
  private readonly wandsBtn: HTMLButtonElement;
  private readonly bagBtn: HTMLButtonElement;
  private readonly difficultyBtn: HTMLButtonElement;

  /** `onSkills` verilirse durum çubuğunda yetenek ağacını açan bir düğme çıkar (dokunmatik için). */
  constructor(onSkills?: () => void, onWands?: () => void, onBag?: () => void, onQuests?: () => void, onDifficulty?: () => void) {
    this.element = document.createElement('div');
    this.element.className =
      'pointer-events-none fixed left-3 top-14 z-40 w-48 rounded-lg bg-black/60 px-3 py-2 text-xs text-amber-50 shadow';
    this.element.innerHTML = `
      <div class="flex items-center justify-between font-bold"><span data-level></span></div>
      <div data-wallet class="mt-1 grid grid-cols-4 gap-0.5 text-center text-[10px]"></div>
      <div class="mt-1 h-1.5 overflow-hidden rounded bg-white/15"><div data-fill class="h-full bg-sky-400 transition-all duration-300"></div></div>
      <div class="mt-1 flex items-center justify-between text-[11px]"><span>❤ Can</span><b data-hp></b></div>
      <div class="h-1.5 overflow-hidden rounded bg-white/15"><div data-hpfill class="h-full bg-rose-400 transition-all duration-300"></div></div>
      <button type="button" data-quests-btn class="pointer-events-auto mt-1 w-full rounded bg-white/10 px-2 py-1 text-left text-[11px] hover:bg-white/20">📜 Görevler (J)</button>
      <button type="button" data-skills class="pointer-events-auto mt-1 w-full rounded bg-white/10 px-2 py-1 text-left text-[11px] hover:bg-white/20">✦ Yetenekler (K)</button>
      <button type="button" data-wands class="pointer-events-auto mt-1 w-full rounded bg-white/10 px-2 py-1 text-left text-[11px] hover:bg-white/20">🪄 Asalar (Q)</button>
      <button type="button" data-bag class="pointer-events-auto mt-1 w-full rounded bg-white/10 px-2 py-1 text-left text-[11px] hover:bg-white/20">🎒 Çanta (B)</button>
      <button type="button" data-difficulty class="pointer-events-auto mt-1 w-full rounded bg-white/10 px-2 py-1 text-left text-[11px] hover:bg-white/20"></button>
      <div data-moral class="pointer-events-auto mt-1.5"></div>
      <div data-dirty class="mt-1 hidden text-[10px] text-amber-300">● Kaydedilmedi: bir şehre girince kaydedilir</div>
      <div data-quests class="mt-1 flex flex-col gap-0.5 text-[11px] text-slate-200"></div>`;
    const q = <T extends HTMLElement>(sel: string): T => this.element.querySelector<T>(sel)!;
    this.levelEl = q('[data-level]');
    this.walletEl = q('[data-wallet]');
    this.fillEl = q('[data-fill]');
    this.hpEl = q('[data-hp]');
    this.hpFillEl = q('[data-hpfill]');
    this.dirtyEl = q('[data-dirty]');
    this.questsEl = q('[data-quests]');
    this.moralEl = q('[data-moral]');
    const questsBtn = q<HTMLButtonElement>('[data-quests-btn]');
    questsBtn.hidden = !onQuests;
    if (onQuests) questsBtn.addEventListener('click', onQuests);
    this.skillsBtn = q<HTMLButtonElement>('[data-skills]');
    this.skillsBtn.hidden = !onSkills;
    if (onSkills) this.skillsBtn.addEventListener('click', onSkills);
    this.bagBtn = q<HTMLButtonElement>('[data-bag]');
    this.bagBtn.hidden = !onBag;
    if (onBag) this.bagBtn.addEventListener('click', onBag);
    this.wandsBtn = q<HTMLButtonElement>('[data-wands]');
    this.wandsBtn.hidden = !onWands;
    if (onWands) this.wandsBtn.addEventListener('click', onWands);
    this.difficultyBtn = q<HTMLButtonElement>('[data-difficulty]');
    this.difficultyBtn.hidden = !onDifficulty;
    if (onDifficulty) this.difficultyBtn.addEventListener('click', onDifficulty);
  }

  update(view: StatusView): void {
    const p = levelProgress(view.xp);
    this.levelEl.textContent = `Seviye ${view.level}`;
    this.walletEl.innerHTML = CURRENCIES.map((c) => `<span title="${CURRENCY_NAMES[c]}">${CURRENCY_ICONS[c]}<br>${view.wallet[c]}</span>`).join('');
    this.fillEl.style.width = `${p.ratio * 100}%`;
    this.hpEl.textContent = `${view.hp}/${view.maxHp}`;
    this.hpEl.classList.toggle('text-amber-300', view.hp < view.maxHp);
    this.hpFillEl.style.width = `${(view.hp / view.maxHp) * 100}%`;
    this.skillsBtn.textContent = view.skillPoints > 0 ? `✦ Yetenekler (K) · ${view.skillPoints} puan!` : '✦ Yetenekler (K)';
    this.skillsBtn.classList.toggle('text-emerald-300', view.skillPoints > 0);
    this.bagBtn.textContent = `🎒 Çanta (B) · ${view.bagSummary}`;
    this.bagBtn.classList.toggle('text-amber-300', view.bagFull);
    this.difficultyBtn.textContent = `⚙ Oyun seviyesi: ${view.difficultyName}`;
    // İbre yeniden çizilirse kayma animasyonu kaybolur: yalnızca etiket değişince çiz, yoksa ibreyi kaydır
    const needle = this.moralEl.querySelector<HTMLElement>('[data-needle]');
    const key = `${view.moralityLabel}|${view.moralBonus}`;
    if (needle && this.moralEl.dataset.key === key) needle.style.left = `${(((Math.max(-1, Math.min(1, view.moralNeedle)) + 1) / 2) * 100).toFixed(1)}%`;
    else {
      this.moralEl.innerHTML = moralGaugeHtml(view.moralNeedle, view.moralityLabel, view.moralBonus);
      this.moralEl.dataset.key = key;
    }
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
