import { getSoundEngine } from '../audio/sfx/engine';
import { createArenaSounds } from '../audio/sfx/arenaSounds';
import { ArenaView, type CombatantSpec } from '../battle/arena/arenaView';
import type { SlotRef } from '../battle/arena/layout';
import { ELEMENT_COLORS } from '../battle/arena/palette';
import { elementRelation, ELEMENT_NAMES, ELEMENTS, type Element } from '../battle/damage/elements';
import type { TargetPose } from '../battle/damage/target';
import { SPECIAL_SHAPE_BONUS } from '../battle/damage/config';

/** Elementlerin simgesi: savaş ekranında element adı yazılmaz, yalnız simge ve renk görünür (Faz 1) */
const ELEMENT_ICON: Record<Element, string> = { fire: '🔥', water: '💧', earth: '⛰️', air: '🌪️' };
import { Bot } from '../battle/flow/bot';
import { ElysiaBot } from '../battle/flow/elysia';
import { EFFECT_LABELS, blockedPercent, explainDamage, spellEffect, type SpellEffect } from '../battle/damage/explain';
import type { BurnEvent } from '../battle/flow/engine';
import { runBattle, type BattleIO, type DrawExtras, type Role, type RoundChoice, type TurnElements, type TurnReport } from '../battle/flow/controller';
import type { Action, BattleEngine, Fighter, Winner } from '../battle/flow/engine';
import type { DrawingResult, Stroke } from '../battle/gesture/types';
import { DrawingCanvas } from './drawingCanvas';
import { SHAPE_LABELS, type ShapeName } from '../battle/flow/shapes';
import { templateStrokes } from '../battle/gesture/shapeMatch';
import { createSoundToggle } from './soundToggle';

const css = (hex: number): string => `#${hex.toString(16).padStart(6, '0')}`;
const sleep = (ms: number): Promise<void> => new Promise((r) => setTimeout(r, ms));
const key = (ref: SlotRef): string => `${ref.team}:${ref.index}`;
const esc = (s: string): string => s.replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]!);

/** Görünüm için varsayılan elementler (cüppe rengi). Büyü elementi her turda ayrıca seçilir. */
const LOOKS: Record<0 | 1, Element[]> = { 0: ['fire', 'air'], 1: ['water', 'earth'] };

export interface BattleScreenOptions {
  /** Bot becerisi (0-1): savunmada gelen saldırıyı ne kadar iyi kapattığı */
  botSkill: number;
  showAttackToDefender: boolean;
  /** Savaş sonu ekranında: true = tekrar oyna, false = menüye dön */
  onFinish: (playAgain: boolean) => void;
  /** Bu döngüden itibaren oyuncunun çizim tuvali bulanıklaşır (boss mekaniği: zihin kontrolü) */
  blurFromCycle?: number;
  /** Savaş sonu düğme yazıları ve görünürlüğü. Verilmezse "Tekrar oyna" ve "Menü". */
  /** Savaşın içinde Kaç ve (varsa) Rüşvet düğmeleri çıkar (Task 55); verilmezse savaştan çıkış yoktur */
  escape?: { bribe?: { cost: number; currencyName: string; balance: () => number } };
  /** Savaş başlarken ortada kısa süre gösterilen not (düşman adı, ganimet) */
  intro?: string;
  endLabels?: { again: string; menu: string; /** Yenilgide de "tekrar" düğmesi gizlenir */ noAgain?: boolean; /** Zaferde "tekrar" düğmesi gizlenir ve kalan düğmenin yazısı bu olur (boss savaşı) */ hideAgainOnWin?: boolean; winMenu?: string };
}

/**
 * Savaş ekranı: 3D arena, can çubukları, element seçimi, çizim tuvali ve duyurular.
 * `runBattle` akışının arayüz tarafıdır (BattleIO); bot kontrollü savaşçılar için anında karar verir,
 * insan kontrollü savaşçılar için sıra gelince ekranda seçim/çizim ister.
 */
export class BattleScreen implements BattleIO {
  private readonly sfx = getSoundEngine();
  private readonly arena: ArenaView;
  private readonly root: HTMLElement;
  private readonly hud = new Map<string, { fill: HTMLElement; text: HTMLElement; card: HTMLElement }>();
  private readonly bots = new Map<string, Bot>();
  private readonly banner: HTMLElement;
  private readonly center: HTMLElement;
  private readonly calc: HTMLElement;
  private readonly modals: HTMLElement;
  private readonly abort = new AbortController();
  /** Bu döngüde herkesin seçtiği element (anahtar: takım:sıra); çizim rengi ve etiketler için */
  private roundElements = new Map<string, Element>();
  private disposed = false;
  /** Oyuncu savaştan çıktıysa nasıl: 'flee' (kaçtı) ya da 'bribe' (rüşvet verdi); aksi null */
  escaped: 'flee' | 'bribe' | null = null;
  private escapeResolve: (() => void) | null = null;

  constructor(
    parent: HTMLElement,
    private readonly engine: BattleEngine,
    private readonly options: BattleScreenOptions,
  ) {
    this.root = document.createElement('div');
    this.root.className = 'fixed inset-0 bg-black';
    parent.appendChild(this.root);

    const stage = document.createElement('div');
    stage.className = 'absolute inset-0';
    this.root.appendChild(stage);
    this.arena = new ArenaView(stage, createArenaSounds(this.sfx));
    this.root.appendChild(createSoundToggle(this.sfx));

    const specs = (team: 0 | 1): CombatantSpec[] =>
      engine.team(team).map((f) => ({ name: f.name, element: LOOKS[team][f.index] }));
    this.arena.setTeams([specs(0), specs(1)]);

    for (const f of engine.all()) {
      if (f.control !== 'bot') continue;
      const skill = f.ai?.skill ?? options.botSkill;
      this.bots.set(
        key(f),
        f.persona === 'elysia' ? new ElysiaBot(Math.random, Math.min(0.95, f.ai?.skill ?? options.botSkill + 0.1)) : new Bot(Math.random, skill, f.ai ?? {}),
      );
    }

    this.buildHud();
    this.banner = this.overlay('pointer-events-none absolute inset-x-0 top-24 z-10 flex justify-center px-2');
    this.center = this.overlay('pointer-events-none absolute inset-x-0 top-[38%] z-10 flex justify-center px-2');
    this.calc = this.overlay('pointer-events-none absolute inset-x-0 top-[20%] z-10 flex justify-center px-2');
    this.modals = this.overlay('absolute inset-0 z-20');
    this.modals.style.pointerEvents = 'none';
    if (options.escape) this.buildEscape(options.escape);
  }

  /** Savaşın içinde köşede Kaç ve Rüşvet düğmeleri: kaçarsan düşman yerinde kalır, rüşvet verirsen çekilir. */
  private buildEscape(escape: NonNullable<BattleScreenOptions['escape']>): void {
    const bar = this.overlay('absolute bottom-2 left-2 z-40 flex gap-2');
    bar.style.pointerEvents = 'auto';
    const bribe = escape.bribe;
    const canBribe = bribe ? bribe.balance() >= bribe.cost : false;
    bar.innerHTML = `<button data-flee type="button" class="rounded bg-slate-800/90 px-3 py-2 text-xs font-bold text-amber-50 hover:bg-slate-700">🏃 Kaç</button>${
      bribe ? `<button data-bribe type="button" ${canBribe ? '' : 'disabled'} class="rounded bg-emerald-300/95 px-3 py-2 text-xs font-bold text-slate-900 disabled:opacity-40">💰 Rüşvet (${bribe.cost} ${esc(bribe.currencyName)})</button>` : ''
    }`;
    const leave = (how: 'flee' | 'bribe'): void => {
      if (this.escaped || this.disposed) return;
      this.escaped = how;
      this.closeModal();
      this.abort.abort();
      this.escapeResolve?.();
    };
    bar.querySelector('[data-flee]')!.addEventListener('click', () => leave('flee'));
    bar.querySelector('[data-bribe]')?.addEventListener('click', () => leave('bribe'));
  }

  private overlay(cls: string): HTMLElement {
    const el = document.createElement('div');
    el.className = cls;
    this.root.appendChild(el);
    return el;
  }

  /** Can çubukları: takım 0 solda, takım 1 sağda. */
  private buildHud(): void {
    const bar = this.overlay('pointer-events-none absolute inset-x-0 top-0 z-10 flex justify-between gap-2 p-2');
    for (const team of [0, 1] as const) {
      const col = document.createElement('div');
      col.className = `flex w-[46%] max-w-[260px] flex-col gap-1 ${team === 1 ? 'items-end' : ''}`;
      for (const f of this.engine.team(team)) {
        const card = document.createElement('div');
        card.className = 'w-full rounded bg-black/60 px-2 py-1 text-xs text-amber-50 transition-opacity';
        card.innerHTML = `<div class="flex justify-between gap-2"><b data-name></b><span data-hp></span></div>
          <div class="mt-1 h-2 overflow-hidden rounded bg-white/15"><div data-fill class="h-full transition-all duration-500"></div></div>`;
        card.querySelector('[data-name]')!.textContent = f.name + (f.control === 'human' ? ' (sen)' : '');
        col.appendChild(card);
        this.hud.set(key({ team, index: f.index }), { fill: card.querySelector('[data-fill]')!, text: card.querySelector('[data-hp]')!, card });
      }
      bar.appendChild(col);
    }
    this.updateHud();
  }

  private updateHud(): void {
    for (const f of this.engine.all()) {
      const h = this.hud.get(key({ team: f.team, index: f.index }));
      if (!h) continue;
      const ratio = f.hp / f.maxHp;
      h.fill.style.width = `${ratio * 100}%`;
      h.fill.style.background = ratio > 0.5 ? '#4ade80' : ratio > 0.25 ? '#fbbf24' : '#f87171';
      h.text.textContent = `${f.burn > 0 && f.hp > 0 ? '🔥 ' : ''}${f.hp}/${f.maxHp}`;
      h.card.style.opacity = f.hp > 0 ? '1' : '0.45';
    }
  }

  // --- Duyurular ---------------------------------------------------------------------------

  private async say(el: HTMLElement, html: string, ms: number, cls = 'bg-black/70 text-amber-50'): Promise<void> {
    el.innerHTML = `<div class="rounded-lg px-4 py-2 text-center text-sm font-bold shadow-lg sm:text-base ${cls}">${html}</div>`;
    await sleep(ms);
    if (!this.disposed) el.innerHTML = '';
  }

  private name(ref: SlotRef): string {
    return this.engine.fighter(ref).name;
  }

  private isHuman(ref: SlotRef): boolean {
    return this.engine.fighter(ref).control === 'human';
  }

  // --- BattleIO ----------------------------------------------------------------------------

  async announceTurn(action: Action, _engine: BattleEngine, elements: TurnElements): Promise<void> {
    const a = this.name(action.attacker);
    const d = this.name(action.defender);
    const text = this.isHuman(action.attacker)
      ? `Senin saldırın → ${d}`
      : this.isHuman(action.defender)
        ? `${a} saldırıyor! Savunmaya hazırlan`
        : `${a} → ${d}`;
    const involved = this.isHuman(action.attacker) || this.isHuman(action.defender);
    if (involved) this.sfx.play('turn');
    await this.say(this.banner, text, 800);
    await this.showRelation(elements.attackerElement, elements.defenderElement);
  }

  /** Bu turun element ilişkisi: saldıran üstünse hasar artar, savunan üstünse azalır. */
  private async showRelation(attackerElement: Element, defenderElement: Element): Promise<void> {
    const rel = elementRelation(attackerElement, defenderElement);
    this.sfx.play(rel === 'advantage' ? 'revealAdvantage' : rel === 'disadvantage' ? 'revealDisadvantage' : 'revealNeutral');
    // Faz 1: yazı yok, yalnız görüntü: iki elementin simgesi; arka plan rengi (yeşil/kırmızı/gri) üstünlüğü hissettirir
    const tone = rel === 'advantage' ? 'bg-emerald-700/80 text-emerald-100' : rel === 'disadvantage' ? 'bg-red-800/80 text-red-100' : 'bg-slate-700/80 text-slate-100';
    await this.say(
      this.center,
      `<span class="text-4xl" style="filter:drop-shadow(0 0 8px ${css(ELEMENT_COLORS[attackerElement].glow)})">${ELEMENT_ICON[attackerElement]}</span> <span class="text-2xl">⚔</span> <span class="text-4xl" style="filter:drop-shadow(0 0 8px ${css(ELEMENT_COLORS[defenderElement].glow)})">${ELEMENT_ICON[defenderElement]}</span>`,
      1200,
      tone,
    );
  }

  async chooseElement(ref: SlotRef): Promise<Element> {
    const bot = this.bots.get(key(ref));
    if (bot) {
      await sleep(300);
      return bot.chooseElement();
    }
    return this.pickElement(
      'Bu döngünün elementini seç',
      'Seçtiğin element bu döngüde hem saldırının hem savunmanın elementi olur. Rakip de gizlice seçiyor.',
    );
  }

  /** Kör seçim: oyuncu seçer, rakibinin ne seçtiğini görmez; herkes seçince birlikte açılır. */
  private pickElement(title: string, hint: string): Promise<Element> {
    return new Promise((resolve) => {
      this.modals.style.pointerEvents = 'auto';
      this.modals.innerHTML = `<div class="flex h-full flex-col items-center justify-center gap-4 bg-slate-950/80 p-4">
        <h2 class="text-lg font-bold text-amber-200">${title}</h2>
        <p class="text-center text-sm text-slate-300">${hint}</p>
        <div class="grid w-full max-w-sm grid-cols-2 gap-3" data-grid></div></div>`;
      const grid = this.modals.querySelector('[data-grid]')!;
      for (const e of ELEMENTS) {
        const b = document.createElement('button');
        b.type = 'button';
        // Faz 1: kartta yazı yok (ne adı ne de neye üstün olduğu), yalnız elementin simgesi ve rengi
        b.innerHTML = `<span class="block text-5xl leading-none" aria-hidden="true">${ELEMENT_ICON[e]}</span>`;
        b.setAttribute('aria-label', ELEMENT_NAMES[e]);
        b.dataset.element = e;
        b.className = 'flex h-28 items-center justify-center rounded-xl text-slate-900 shadow-lg active:scale-95';
        b.style.background = css(ELEMENT_COLORS[e].main);
        b.addEventListener('click', () => {
          this.sfx.play('pick');
          this.closeModal();
          resolve(e);
        });
        grid.appendChild(b);
      }
    });
  }

  private closeModal(): void {
    this.modals.innerHTML = '';
    this.modals.style.pointerEvents = 'none';
  }

  /** Herkes seçince elementler birlikte açılır; bu döngü boyunca geçerlidir. */
  async revealRound(round: readonly RoundChoice[]): Promise<void> {
    this.roundElements = new Map(round.map((c) => [key(c.ref), c.element]));
    this.sfx.play('turn');
    const rows = round
      .map((c) => `<span style="color:${css(ELEMENT_COLORS[c.element].glow)}">${esc(this.name(c.ref))} <span class="text-xl">${ELEMENT_ICON[c.element]}</span></span>`)
      .join('<br>');
    await this.say(this.center, `Bu döngünün elementleri<br><span class="text-sm font-normal">${rows}</span>`, 1800, 'bg-slate-800/85 text-slate-100');
  }

  async draw(ref: SlotRef, role: Role, ghost?: readonly Stroke[], limitSec?: number, extras?: DrawExtras): Promise<DrawingResult> {
    const bot = this.bots.get(key(ref));
    if (bot) {
      await sleep(this.arenaPause(role));
      return role === 'attack' ? bot.drawAttack(extras?.specialShape, extras?.target) : bot.drawDefense(extras?.target);
    }
    // Saldırı ve savunma, bu döngüde seçilen TEK elementle çizilir
    return this.drawByHand(role, this.roundElements.get(key(ref)) ?? 'fire', ghost, limitSec, role === 'attack' ? extras?.scars : undefined, role === 'attack' ? extras?.shake : undefined, role === 'defense' ? extras?.fog : undefined, role === 'defense' ? extras?.mud : undefined, role === 'attack' ? extras?.specialShape : undefined, extras?.target);
  }

  /** Botun "düşünme" süresi: çizim süresine yakın, böylece sıra hissi oluşur. */
  private arenaPause(role: Role): number {
    return role === 'attack' ? 900 : 700;
  }

  private drawByHand(role: Role, element: Element, ghost?: readonly Stroke[], limitSec?: number, scars?: number, shake?: number, fog?: number, mud?: number, special?: ShapeName, target?: TargetPose): Promise<DrawingResult> {
    this.modals.style.pointerEvents = 'auto';
    this.modals.innerHTML = `<div class="flex h-full flex-col items-center justify-center gap-3 bg-slate-950/85 p-3">
      <h2 class="text-lg font-bold ${role === 'attack' ? 'text-amber-200' : 'text-emerald-200'}">${role === 'attack' ? 'Saldırı: büyünü çiz' : 'Savunma: saldırıyı durdur'}</h2>
      <p class="text-center text-xs text-slate-300">${role === 'attack' ? 'Rakibin silüetine çiz. Şekil ne kadar doğruysa büyü o kadar güçlü; silüetin dışına giden büyü çok az vurur.' : 'Silüetini koru: rakibin büyüsü oraya gelecek.'}</p>
      ${special ? this.specialPreview(special) : ''}
      <div data-canvas class="flex w-full justify-center"></div></div>`;
    const canvas = new DrawingCanvas({
      color: role === 'attack' ? css(ELEMENT_COLORS[element].main) : '#7df0c4',
      ghost,
      target,
      targetTone: role === 'attack' ? 'enemy' : 'self',
      // Asa çizim süresini uzatabilir (varsayılan 3 sn)
      drawTimeMs: limitSec ? Math.round(limitSec * 1000) : undefined,
      scars,
      shake,
      fog,
      mud,
      drawSound: () => this.sfx.beginDraw(element),
    });
    // Boss mekaniği (zihin kontrolü): belirli döngüden sonra çizim tuvali bulanıklaşır
    if (this.options.blurFromCycle !== undefined && this.engine.cycle >= this.options.blurFromCycle) {
      canvas.element.style.filter = 'blur(2.5px)';
    }
    this.modals.querySelector('[data-canvas]')!.appendChild(canvas.element);
    return canvas.start().then((result) => {
      this.closeModal();
      return result;
    });
  }

  /** Sarsıntı: sersemleyen savaşçının sırası atlanır. */
  async announceStun(ref: SlotRef): Promise<void> {
    await this.say(this.center, `💫 ${esc(this.name(ref))} sersemlemiş, sırasını kaçırdı`, 1200, 'bg-amber-800/85 text-amber-50');
  }

  /** Şifa Kabarcıkları: can çubuğunun üstünde yeşil kabarcıklar yükselir. */
  private bubbleHeal(ref: SlotRef): void {
    const card = this.hud.get(key(ref))?.card;
    if (!card) return;
    const wrap = document.createElement('div');
    wrap.className = 'pointer-events-none absolute inset-0 overflow-visible';
    wrap.innerHTML = Array.from({ length: 6 }, (_, i) => `<span style="position:absolute;left:${10 + i * 15}%;bottom:0;font-size:14px;opacity:0.9;transition:transform 900ms ease-out,opacity 900ms ease-out">🫧</span>`).join('');
    card.style.position = 'relative';
    card.appendChild(wrap);
    requestAnimationFrame(() => wrap.querySelectorAll<HTMLElement>('span').forEach((el, i) => {
      el.style.transform = `translateY(-${24 + (i % 3) * 8}px)`;
      el.style.opacity = '0';
    }));
    window.setTimeout(() => wrap.remove(), 1000);
  }

  /** Döngü başında yanan savaşçılar yanma hasarı yer. */
  async announceBurn(events: readonly BurnEvent[]): Promise<void> {
    this.updateHud();
    const text = events.map((e) => `🔥 ${esc(this.name(e.ref))} yanıyor −${e.damage}`).join('<br>');
    await this.say(this.center, text, 1100, 'bg-orange-800/85 text-orange-50');
    for (const e of events) if (e.defeated) this.arena.defeat(e.ref);
  }

  /**
   * Özel büyü şekli önizlemesi: yalnızca şeklin kendisi ve adı gösterilir; nereye çizileceği gösterilmez (tuvale hiçbir şey çizilmez).
   * Şekle ne kadar benzerse büyü o kadar güçlü; tutarsa ayrıca ×1.5 (Faz 3).
   */
  private specialPreview(shape: ShapeName): string {
    const strokes = templateStrokes(shape);
    const pts = strokes.flat();
    const minX = Math.min(...pts.map((p) => p.x));
    const maxX = Math.max(...pts.map((p) => p.x));
    const minY = Math.min(...pts.map((p) => p.y));
    const maxY = Math.max(...pts.map((p) => p.y));
    const k = 80 / Math.max(maxX - minX, maxY - minY, 1);
    const ox = 10 + (80 - (maxX - minX) * k) / 2;
    const oy = 10 + (80 - (maxY - minY) * k) / 2;
    const paths = strokes
      .map((s) => `<polyline fill="none" stroke="#f0abfc" stroke-width="3" stroke-linecap="round" stroke-linejoin="round" points="${s.map((p) => `${(ox + (p.x - minX) * k).toFixed(1)},${(oy + (p.y - minY) * k).toFixed(1)}`).join(' ')}"/>`)
      .join('');
    return `<div class="flex items-center gap-3 rounded-lg bg-fuchsia-950/80 px-3 py-1" data-special="${shape}">
      <svg viewBox="0 0 100 100" width="56" height="56" aria-hidden="true">${paths}</svg>
      <div class="text-xs leading-tight text-fuchsia-100"><b class="text-sm text-fuchsia-300">Özel büyü: ${esc(SHAPE_LABELS[shape])}</b><br>Bu şekli çiz: ne kadar doğruysa o kadar güçlü, tutarsa <b>×${SPECIAL_SHAPE_BONUS}</b></div></div>`;
  }

  async play(report: TurnReport): Promise<void> {
    const { action } = report;
    if (report.attackFailed) {
      void this.say(this.center, `Büyü yapamadı! <span class="font-normal">(${this.name(action.attacker)})</span>`, 1400, 'bg-red-900/80 text-red-100');
      await this.arena.fizzle(action.attacker);
      return;
    }

    // Özel büyü şekli: çizim şekle uydu mu?
    if (report.specialShape) {
      const label = SHAPE_LABELS[report.specialShape];
      const who = this.isHuman(action.attacker) ? '' : `${this.name(action.attacker)}: `;
      await this.say(
        this.center,
        report.specialOk ? `✨ ${who}Özel büyü başarılı! <span class="font-normal">${esc(label)} ×${SPECIAL_SHAPE_BONUS}</span>` : `${who}Özel büyü başarısız <span class="font-normal">(${esc(label)})</span>`,
        1000,
        report.specialOk ? 'bg-fuchsia-800/90 text-fuchsia-50' : 'bg-slate-700/90 text-slate-200',
      );
    }

    const defense = report.defense;
    if (!report.defenseFailed && defense) {
      await this.arena.showShield(action.defender, action.attacker, defense.strokes as Stroke[], report.defenderElement);
    } else {
      void this.say(this.center, `Savunma yapılamadı! <span class="font-normal">(${this.name(action.defender)})</span>`, 1200, 'bg-red-900/80 text-red-100');
    }
    await this.arena.castSpell(action.attacker, action.defender, report.attack.strokes as Stroke[], report.attackerElement);
    await this.arena.impact(action.defender, action.attacker, {
      damage: report.damage,
      blockedRatio: report.breakdown?.defendedRatio ?? 0,
      head: (report.breakdown?.headShare ?? 0) > 0.5,
      element: report.attackerElement,
    });
    await this.showEffect(report);
    // Ateş yetenekleri: kısa duyurular
    const notes: string[] = [];
    if (report.chainStacks) notes.push(`⛓️ Alev Zinciri ×${report.chainStacks}`);
    if (report.scatter) notes.push('✨ Kıvılcımlar savunmayı aştı');
    if (report.shieldBroken) notes.push('🛡️💥 Kalkan kırıldı!');
    if (report.mudded && !report.defenseFailed) notes.push('🟤 Çamur Yaması');
    if (report.armorGained) notes.push(`🪨 ${this.name(action.defender)} kalıcı zırh kazandı (+%${Math.round(report.armorGained * 100)})`);
    if (report.rebounded) notes.push(`💨 Geri Esen Rüzgâr: ${this.name(action.attacker)} -${report.rebounded}`);
    if (report.stunned) notes.push(`💫 ${this.name(action.defender)} sersemledi!`);
    if (report.fogged && !report.defenseFailed) notes.push('🌫️ Sis Perdesi');
    if (report.chilled) notes.push(`❄️ ${this.name(action.defender)} yavaşladı`);
    if (report.ignited) notes.push(`🔥 ${this.name(action.defender)} tutuştu!`);
    if (notes.length > 0) void this.say(this.calc, notes.join('<br>'), 1500, 'bg-orange-800/85 text-orange-50');
    // Kişilikli botlar (Elysia) hasar yiyince tepki verir
    this.bots.get(key(action.defender))?.onDamaged(report.damage, this.engine.fighter(action.defender).maxHp);
    if (report.reflected > 0) this.bots.get(key(action.attacker))?.onDamaged(report.reflected, this.engine.fighter(action.attacker).maxHp);
    this.updateHud();
    if (report.healed > 0) {
      void this.say(this.center, `🫧 ${this.name(action.attacker)} <span class="text-emerald-300">+${report.healed} HP</span>`, 1100, 'bg-emerald-900/80 text-emerald-100');
      this.bubbleHeal(action.attacker);
    }
    if (report.reflected > 0) {
      await this.say(this.center, `🌊 Yansıyan dalga! ${this.name(action.attacker)} -${report.reflected}`, 1200, 'bg-sky-900/80 text-sky-100');
    }
    if (report.defeated) {
      // Savaşı insan tarafı kazandıysa: bitiriş büyüsü (rakip dev bir büyüyle yıkılır); aksi halde sade yenilgi
      const playerWon = this.engine.winner === action.attacker.team && this.engine.all().some((f: Fighter) => f.control === 'human' && f.team === action.attacker.team);
      if (playerWon) await this.arena.finisher(action.attacker, action.defender, report.attack.strokes as Stroke[], report.attackerElement);
      else this.arena.defeat(action.defender);
      await this.say(this.center, `${this.name(action.defender)} yenildi!`, 1400, 'bg-amber-700/80 text-amber-50');
    }
    if (report.attackerDefeated) {
      this.arena.defeat(action.attacker);
      await this.say(this.center, `${this.name(action.attacker)} yansımayla yenildi!`, 1400, 'bg-amber-700/80 text-amber-50');
    }
  }

  /** Detay ekranı: hasarın neyden ne kadar geldiği (bloklanmayan kısım, element, ekipman, yetenek, zırh...). Devam'a basınca kapanır. */
  private showDetail(report: TurnReport): Promise<void> {
    const b = report.breakdown;
    const color = css(ELEMENT_COLORS[report.attackerElement].glow);
    const rows = b
      ? explainDamage(b, report.attackerElement, report.defenseFailed)
          .map(
            (r) =>
              `<div class="flex justify-between gap-4"><span${r.element ? ` style="color:${color}"` : ''}>${esc(r.label)}${r.factor ? ` <b>${esc(r.factor)}</b>` : ''}</span><b class="tabular-nums">${r.value}</b></div>`,
          )
          .join('')
      : '';
    const blocked = b ? blockedPercent(b, report.defenseFailed) : 0;
    const panel = this.overlay('absolute inset-0 z-30 flex items-center justify-center bg-black/60 p-3');
    panel.style.pointerEvents = 'auto';
    panel.innerHTML = `<div class="w-full max-w-xs rounded-lg bg-slate-900/95 p-4 text-sm text-slate-50 shadow-xl">
      <div class="mb-2 text-center font-bold" style="color:${color}">${ELEMENT_NAMES[report.attackerElement]} büyüsü: detay</div>
      <div class="mb-2 text-center text-xs text-slate-300">Büyünün <b>%${100 - blocked}</b> kadarı bloklanmadı (%${blocked} bloklandı)</div>
      ${rows}
      <div class="mt-2 flex justify-between border-t border-white/30 pt-2 text-base font-bold"><span>Hasar</span><span class="tabular-nums">${report.damage}</span></div>
      <button data-next type="button" class="mt-3 w-full rounded bg-amber-300 px-4 py-2 font-bold text-slate-900">Devam</button></div>`;
    return new Promise((resolve) => {
      panel.querySelector('[data-next]')!.addEventListener('click', () => {
        panel.remove();
        resolve();
      });
    });
  }

  /** Hasar sayısından sonra: Detay ya da Devam. Dokunulmazsa kısa süre sonra kendiliğinden devam eder. */
  private resultPrompt(report: TurnReport): Promise<void> {
    return new Promise((resolve) => {
      const box = this.overlay('absolute inset-x-0 bottom-8 z-20 flex justify-center gap-3 px-2');
      box.style.pointerEvents = 'auto';
      box.innerHTML = `<button data-detail type="button" class="rounded bg-slate-700/90 px-5 py-2 text-sm font-bold text-amber-50">Detay</button>
        <button data-next type="button" class="rounded bg-amber-300 px-5 py-2 text-sm font-bold text-slate-900">Devam</button>`;
      let timer = 0;
      const done = (): void => {
        window.clearTimeout(timer);
        box.remove();
        resolve();
      };
      timer = window.setTimeout(done, 2500);
      box.querySelector('[data-next]')!.addEventListener('click', done);
      box.querySelector('[data-detail]')!.addEventListener('click', () => {
        window.clearTimeout(timer);
        box.remove();
        void this.showDetail(report).then(resolve);
      });
    });
  }

  /**
   * Vuruştan sonra: önce "%X bloklandı" ve hasara göre etki seviyesi (çok etkisiz, etkisiz, normal, etkili, çok etkili), 2 saniye sonra hasar sayısı,
   * sonra Detay / Devam.
   */
  private async showEffect(report: TurnReport): Promise<void> {
    if (!report.breakdown) return;
    const effect = spellEffect(report.breakdown);
    const tones: Record<SpellEffect, string> = {
      veryWeak: 'bg-slate-700/90 text-slate-200',
      weak: 'bg-slate-600/90 text-slate-100',
      normal: 'bg-amber-700/90 text-amber-50',
      effective: 'bg-orange-700/90 text-orange-50',
      veryEffective: 'bg-red-800/90 text-red-50',
    };
    const blocked = blockedPercent(report.breakdown, report.defenseFailed);
    await this.say(
      this.center,
      `<span class="text-base font-normal">%${blocked} bloklandı</span><br>${report.critical ? '💥 KRİTİK! ' : ''}${EFFECT_LABELS[effect]}`,
      2000,
      tones[effect],
    );
    const q = report.attack.quality.total;
    if (q < 0.95 && this.isHuman(report.action.attacker)) {
      void this.say(this.calc, `✏️ Çizim kalitesi ×${q.toFixed(2)}: ${report.attack.quality.scribble < 0.95 ? 'karalama gücü düşürdü' : 'büyü tuvalin küçük bir yerine yığıldı'}`, 1800, 'bg-slate-800/90 text-amber-100');
    }
    await this.say(this.center, report.damage > 0 ? `<span class="text-4xl">-${report.damage}</span><br><span class="text-sm font-normal">hasar</span>` : 'hasar yok', 1200, tones[effect]);
    await this.resultPrompt(report);
  }

  async announceEnd(winner: Winner, engine: BattleEngine): Promise<void> {
    const human = engine.all().find((f: Fighter) => f.control === 'human');
    const mine = human?.team ?? 0;
    const [title, tone] =
      winner === 'draw' || winner === null
        ? ['BERABERE', 'text-slate-200']
        : winner === mine
          ? ['ZAFER!', 'text-amber-300']
          : ['YENİLGİ', 'text-red-300'];
    const labels = this.options.endLabels ?? { again: 'Tekrar oyna', menu: 'Menü' };
    const hideAgain = (Boolean(this.options.endLabels?.hideAgainOnWin) && winner === mine) || (Boolean(this.options.endLabels?.noAgain) && winner !== mine);
    this.sfx.play(winner === mine ? 'victory' : winner === 'draw' || winner === null ? 'revealNeutral' : 'lose');
    this.modals.style.pointerEvents = 'auto';
    this.modals.innerHTML = `<div class="flex h-full flex-col items-center justify-center gap-4 bg-slate-950/70 p-4">
      <h1 class="text-4xl font-bold ${tone}">${title}</h1>
      <div class="flex gap-3">
        ${hideAgain ? '' : `<button data-again type="button" class="rounded bg-amber-300 px-5 py-3 font-bold text-slate-900">${labels.again}</button>`}
        <button data-menu type="button" class="rounded ${hideAgain ? 'bg-amber-300 text-slate-900' : 'bg-slate-700 text-amber-50'} px-5 py-3 font-bold">${hideAgain ? (this.options.endLabels?.winMenu ?? labels.menu) : labels.menu}</button>
      </div></div>`;
    await new Promise<void>((resolve) => {
      const done = (again: boolean): void => {
        this.options.onFinish(again);
        resolve();
      };
      this.modals.querySelector('[data-again]')?.addEventListener('click', () => done(true));
      this.modals.querySelector('[data-menu]')!.addEventListener('click', () => done(false));
    });
  }

  // --- Yaşam döngüsü -----------------------------------------------------------------------

  /** Savaşı başlatır; bitince kazananı verir. */
  async run(): Promise<Winner> {
    if (this.options.intro) void this.say(this.center, this.options.intro, 2800, 'bg-slate-800/90 text-amber-100');
    const escape = new Promise<'escaped'>((resolve) => {
      this.escapeResolve = () => resolve('escaped');
    });
    const result = await Promise.race([runBattle(this.engine, this, { showAttackToDefender: this.options.showAttackToDefender, signal: this.abort.signal }), escape]);
    // Çıkıldıysa kazanan yoktur (savaş yarıda kaldı)
    return result === 'escaped' ? this.engine.winner : result;
  }

  dispose(): void {
    this.disposed = true;
    this.abort.abort();
    this.arena.dispose();
    this.root.remove();
  }
}
