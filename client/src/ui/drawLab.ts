import { GRID, LOGICAL_SIZE, MIN_EXTENT, MIN_INKED_CELLS } from '../battle/gesture/config';
import { DEFAULT_POSE } from '../battle/damage/target';
import { calculateDamage, type DamageBreakdown } from '../battle/damage/calculate';
import { ELEMENT_NAMES, ELEMENTS as ELEMENT_IDS, type Element } from '../battle/damage/elements';
import type { DensityMap, DrawingResult } from '../battle/gesture/types';
import { matchDefense, type MatchResult } from '../battle/match/defense';
import { getSoundEngine } from '../audio/sfx/engine';
import { DrawingCanvas } from './drawingCanvas';
import { createSoundToggle } from './soundToggle';
import { lockTouchScroll } from './touchLock';

const ELEMENTS = [
  { id: 'fire', name: 'Ateş', color: '#ff7a3d' },
  { id: 'water', name: 'Su', color: '#4db8ff' },
  { id: 'earth', name: 'Toprak', color: '#c8a15a' },
  { id: 'air', name: 'Hava', color: '#d6efff' },
] as const;

const DEFENSE_COLOR = '#7df0c4';

type Mode = 'solo' | 'duel';

const pct = (v: number): string => `${(v * 100).toFixed(1)}%`;

function heatCanvas(): HTMLCanvasElement {
  const canvas = document.createElement('canvas');
  canvas.width = 256;
  canvas.height = 256;
  canvas.className = 'w-64 rounded border border-white/20';
  const ctx = canvas.getContext('2d')!;
  ctx.fillStyle = '#0b1020';
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  return canvas;
}

/** Tek çizimin yoğunluk ısı haritası: gri = iz var ama az vakit, sıcak renk = çok vakit harcanan yer. */
function drawHeatmap(canvas: HTMLCanvasElement, density: DensityMap): void {
  const ctx = canvas.getContext('2d')!;
  const cell = canvas.width / GRID;
  const max = Math.max(...density.cells, 1e-9);
  for (let j = 0; j < GRID; j++) {
    for (let i = 0; i < GRID; i++) {
      const idx = j * GRID + i;
      if (!density.ink[idx]) continue;
      const t = density.cells[idx] / max;
      ctx.fillStyle = `hsl(${220 - t * 220} 85% ${35 + t * 25}%)`;
      ctx.fillRect(i * cell, j * cell, cell, cell);
    }
  }
}

/** Eşleşme haritası: yeşil = savunuldu, kırmızı = hasar verecek, mavi = saldırısı olmayan yere boşa giden savunma. */
function drawMatchMap(canvas: HTMLCanvasElement, attack: DensityMap, match: MatchResult): void {
  const ctx = canvas.getContext('2d')!;
  const cell = canvas.width / GRID;
  const max = Math.max(...attack.cells, 1e-9);
  for (let j = 0; j < GRID; j++) {
    for (let i = 0; i < GRID; i++) {
      const idx = j * GRID + i;
      const x = i * cell;
      const y = j * cell;
      if (attack.cells[idx] <= 0) {
        if (match.coverage[idx] > 0.5) {
          ctx.fillStyle = 'rgba(80,140,255,0.35)';
          ctx.fillRect(x, y, cell, cell);
        }
        continue;
      }
      // Saldırı izi olan hücre: önce hafif zemin, sonra savunulan (yeşil) ve açıkta kalan (kırmızı) pay
      ctx.fillStyle = 'rgba(255,255,255,0.12)';
      ctx.fillRect(x, y, cell, cell);
      ctx.fillStyle = `rgba(239,68,68,${Math.min(1, 0.25 + (match.unblocked[idx] / max) * 1.2)})`;
      ctx.fillRect(x, y, cell, cell);
      const blockedShare = match.blocked[idx] / attack.cells[idx];
      ctx.fillStyle = `rgba(52,211,153,${blockedShare})`;
      ctx.fillRect(x, y, cell, cell);
    }
  }
}

function banner(kind: 'good' | 'warn' | 'bad', html: string): string {
  const tone = { good: 'bg-emerald-600/30 text-emerald-200', warn: 'bg-amber-500/30 text-amber-100', bad: 'bg-red-600/30 text-red-200' }[kind];
  return `<div class="w-full rounded p-3 text-center text-lg font-bold ${tone}">${html}</div>`;
}

/**
 * Çizim laboratuvarı (`?lab=draw`): büyü çizmeyi dene, sistemin çizimini nasıl ölçtüğünü gör.
 * İki mod var: tek çizim (ölçümler) ve saldırı & savunma (eşleşme). Savaş sistemi gelmeden
 * kuralları denemek ve ayarlamak içindir.
 */
export function startDrawLab(root: HTMLElement): void {
  lockTouchScroll();
  root.innerHTML = '';
  const page = document.createElement('div');
  page.setAttribute('data-scrollable', '');
  page.style.touchAction = 'pan-y';
  page.className = 'fixed inset-0 overflow-y-auto bg-slate-950 text-amber-50';
  root.appendChild(page);
  root.appendChild(createSoundToggle(getSoundEngine()));

  let mode: Mode = 'solo';
  let color: string = ELEMENTS[0].color;
  const elementOf = (c: string): Element => ELEMENTS.find((e) => e.color === c)!.id;
  let showGhost = true;

  const render = (): void => {
    page.innerHTML = `
      <div class="mx-auto flex max-w-xl flex-col items-center gap-4 p-4">
        <h1 class="text-2xl font-bold text-amber-300">Çizim laboratuvarı</h1>
        <div class="flex gap-1 rounded bg-slate-900 p-1" data-modes></div>
        <p class="text-center text-sm text-slate-300" data-help></p>
        <div class="flex gap-2" data-elements></div>
        <label class="flex items-center gap-2 text-sm text-slate-300" data-ghost-row hidden>
          <input type="checkbox" data-ghost ${showGhost ? 'checked' : ''}> Savunurken saldırıyı soluk olarak göster
        </label>
        <div data-stage class="flex w-full flex-col items-center gap-3"></div>
      </div>`;

    const modes = page.querySelector('[data-modes]')!;
    for (const [m, label] of [['solo', 'Tek çizim'], ['duel', 'Saldırı & savunma']] as const) {
      const b = document.createElement('button');
      b.type = 'button';
      b.textContent = label;
      b.className = `rounded px-3 py-1 text-sm ${m === mode ? 'bg-amber-300 font-bold text-slate-900' : 'text-slate-300 hover:bg-slate-800'}`;
      b.addEventListener('click', () => {
        mode = m;
        render();
      });
      modes.appendChild(b);
    }

    page.querySelector('[data-help]')!.innerHTML =
      mode === 'solo'
        ? 'Bir büyü çiz. Süre ilk dokunuşta başlar ve <b>3 saniyen</b> var. Bir yerde ne kadar çok durursan o yerin ağırlığı artar. Çok küçük çizimler büyü sayılmaz.'
        : 'Önce <b>saldırı</b> çiz, sonra <b>savunma</b> çiz. Savunmanın kapattığı kısım savunulmuş sayılır, kapatamadığın kısım hasar verir. Her biri için 3 saniyen var.';

    const chips = page.querySelector('[data-elements]')!;
    for (const el of ELEMENTS) {
      const b = document.createElement('button');
      b.type = 'button';
      b.textContent = el.name;
      b.className = `rounded px-3 py-1 text-sm font-bold text-slate-900 ${el.color === color ? 'ring-2 ring-white' : 'opacity-70'}`;
      b.style.background = el.color;
      b.addEventListener('click', () => {
        color = el.color;
        render();
      });
      chips.appendChild(b);
    }

    const ghostRow = page.querySelector<HTMLElement>('[data-ghost-row]')!;
    ghostRow.hidden = mode !== 'duel';
    page.querySelector<HTMLInputElement>('[data-ghost]')!.addEventListener('change', (e) => {
      showGhost = (e.target as HTMLInputElement).checked;
    });

    const stage = page.querySelector<HTMLElement>('[data-stage]')!;
    void (mode === 'solo' ? runSolo(stage) : runDuel(stage));
  };

  const runSolo = async (stage: HTMLElement): Promise<void> => {
    const drawing = new DrawingCanvas({ color, drawSound: () => getSoundEngine().beginDraw(elementOf(color)) });
    stage.appendChild(drawing.element);
    stage.appendChild(soloPanel(await drawing.start(), render));
  };

  const runDuel = async (stage: HTMLElement): Promise<void> => {
    stage.insertAdjacentHTML('beforeend', '<h2 class="font-bold text-amber-200">1. Saldırı: büyünü çiz</h2>');
    const attackCanvas = new DrawingCanvas({ color, element: elementOf(color), target: DEFAULT_POSE, drawSound: () => getSoundEngine().beginDraw(elementOf(color)) });
    stage.appendChild(attackCanvas.element);
    const attack = await attackCanvas.start();

    if (!attack.validity.valid) {
      stage.appendChild(againPanel(banner('bad', `Saldırı yapılamadı! <span class="font-normal">${attack.validity.message}</span>`), render));
      return;
    }

    attackCanvas.element.style.display = 'none';
    stage.insertAdjacentHTML('beforeend', '<h2 class="font-bold text-emerald-200">2. Savunma: saldırıyı durdur</h2>');
    const defenseCanvas = new DrawingCanvas({ color: DEFENSE_COLOR, ghost: showGhost ? attack.strokes : undefined, target: DEFAULT_POSE, drawSound: () => getSoundEngine().beginDraw(elementOf(color)) });
    stage.appendChild(defenseCanvas.element);
    const defense = await defenseCanvas.start();

    stage.appendChild(duelPanel(attack, defense, elementOf(color), render));
  };

  render();
}

function againPanel(bannerHtml: string, again: () => void): HTMLElement {
  const panel = document.createElement('div');
  panel.className = 'flex w-full flex-col items-center gap-3 pb-8';
  panel.innerHTML = `${bannerHtml}<button type="button" data-again class="rounded bg-amber-300 px-5 py-2 font-bold text-slate-900">Tekrar dene</button>`;
  panel.querySelector('[data-again]')!.addEventListener('click', again);
  return panel;
}

function soloPanel(result: DrawingResult, again: () => void): HTMLElement {
  const { metrics: m, validity } = result;
  const panel = document.createElement('div');
  panel.className = 'flex w-full flex-col items-center gap-3 pb-8';
  panel.innerHTML = `
    ${validity.valid ? banner('good', 'Büyü hazır!') : banner('bad', `Büyü yapamadı! <span class="font-normal">${validity.message}</span>`)}
    <table class="w-full text-sm">
      <tr><td class="text-slate-400">Kaplanan alan</td><td class="text-right">${pct(m.coverage)} (${m.inkedCells} hücre, en az ${MIN_INKED_CELLS})</td></tr>
      <tr><td class="text-slate-400">Boyut (genişlik × yükseklik)</td><td class="text-right">${m.width.toFixed(0)} × ${m.height.toFixed(0)} (en uzun kenar en az ${MIN_EXTENT} / ${LOGICAL_SIZE})</td></tr>
      <tr><td class="text-slate-400">Çizgi uzunluğu</td><td class="text-right">${m.pathLength.toFixed(0)}</td></tr>
      <tr><td class="text-slate-400">Çizim süresi</td><td class="text-right">${m.drawTimeSec.toFixed(2)} sn</td></tr>
      <tr><td class="text-slate-400">Çizgi sayısı</td><td class="text-right">${result.strokes.length}</td></tr>
    </table>
    <p class="text-sm text-slate-300">Yoğunluk haritası (sıcak renk = orada daha çok vakit harcadın):</p>
    <div data-heat></div>
    <button type="button" data-again class="rounded bg-amber-300 px-5 py-2 font-bold text-slate-900">Tekrar çiz</button>`;

  const heat = heatCanvas();
  drawHeatmap(heat, result.density);
  panel.querySelector('[data-heat]')!.appendChild(heat);
  panel.querySelector('[data-again]')!.addEventListener('click', again);
  return panel;
}

function duelPanel(attack: DrawingResult, defense: DrawingResult, attackerElement: Element, again: () => void): HTMLElement {
  const defended = defense.validity.valid;
  const match = matchDefense(attack.density, defended ? defense.density : null);
  const ratio = match.defendedRatio;

  const head = !defended
    ? banner('bad', `Savunma yapılamadı! <span class="font-normal">${defense.validity.message} Saldırının tamamı hasar verir.</span>`)
    : ratio >= 0.8
      ? banner('good', `%${(ratio * 100).toFixed(0)} savunuldu`)
      : ratio >= 0.4
        ? banner('warn', `%${(ratio * 100).toFixed(0)} savunuldu`)
        : banner('bad', `Sadece %${(ratio * 100).toFixed(0)} savunuldu`);

  const panel = document.createElement('div');
  panel.className = 'flex w-full flex-col items-center gap-3 pb-8';
  panel.innerHTML = `
    ${head}
    <div class="flex h-4 w-full overflow-hidden rounded bg-red-500/70" title="yeşil: savunulan, kırmızı: hasar verecek">
      <div class="h-full bg-emerald-400" style="width:${(ratio * 100).toFixed(1)}%"></div>
    </div>
    <table class="w-full text-sm">
      <tr><td class="text-slate-400">Savunulan</td><td class="text-right">${pct(ratio)}</td></tr>
      <tr><td class="text-slate-400">Hasar verecek</td><td class="text-right">${pct(1 - ratio)} (saldırı ağırlığı ${match.unblockedWeight.toFixed(2)} / ${match.totalAttackWeight.toFixed(2)} sn)</td></tr>
      <tr><td class="text-slate-400">Saldırı alanı</td><td class="text-right">${pct(attack.metrics.coverage)}</td></tr>
      <tr><td class="text-slate-400">Savunma alanı</td><td class="text-right">${defended ? pct(defense.metrics.coverage) : '-'}</td></tr>
    </table>
    <p class="text-sm text-slate-300"><span class="text-emerald-300">Yeşil</span>: savunuldu · <span class="text-red-300">kırmızı</span>: hasar verecek · <span class="text-blue-300">mavi</span>: boşa giden savunma</p>
    <div data-map></div>
    <h3 class="mt-2 font-bold text-amber-200">Hasar hesabı</h3>
    <div class="grid w-full grid-cols-2 gap-2 text-sm" data-controls>
      <label class="text-slate-300">Savunanın elementi
        <select data-f="defElement" class="mt-1 w-full rounded bg-slate-800 px-2 py-1">${ELEMENT_IDS.map((e) => `<option value="${e}" ${e === attackerElement ? 'selected' : ''}>${ELEMENT_NAMES[e]}</option>`).join('')}</select></label>
      <label class="text-slate-300">Büyü taban gücü
        <input data-f="base" type="number" value="100" min="0" class="mt-1 w-full rounded bg-slate-800 px-2 py-1"></label>
      <label class="text-slate-300">Verilen hasar (skill/ekipman) %
        <input data-f="dealt" type="number" value="0" class="mt-1 w-full rounded bg-slate-800 px-2 py-1"></label>
      <label class="text-slate-300">Alınan hasar (skill/ekipman) %
        <input data-f="taken" type="number" value="0" class="mt-1 w-full rounded bg-slate-800 px-2 py-1"></label>
      <label class="col-span-2 text-slate-300">Toplam zırh (hasar azaltma) %
        <input data-f="armor" type="number" value="0" min="0" max="100" class="mt-1 w-full rounded bg-slate-800 px-2 py-1"></label>
    </div>
    <div data-damage class="w-full"></div>
    <button type="button" data-again class="rounded bg-amber-300 px-5 py-2 font-bold text-slate-900">Tekrar dene</button>`;

  const map = heatCanvas();
  drawMatchMap(map, attack.density, match);
  panel.querySelector('[data-map]')!.appendChild(map);
  panel.querySelector('[data-again]')!.addEventListener('click', again);

  // Hasar hesabı: alanlar değişince anında yeniden hesaplanır (yeniden çizmeye gerek yok)
  const field = (name: string): HTMLInputElement | HTMLSelectElement => panel.querySelector(`[data-f=${name}]`)!;
  const num = (name: string, fallback = 0): number => {
    const v = Number((field(name) as HTMLInputElement).value);
    return Number.isFinite(v) ? v : fallback;
  };
  const recompute = (): void => {
    const defenderElement = (field('defElement') as HTMLSelectElement).value as Element;
    const breakdown = calculateDamage({
      basePower: num('base', 100),
      attack,
      defense: defended ? defense.density : null,
      attackerElement,
      defenderElement,
      attackerDealtMultiplier: 1 + num('dealt') / 100,
      defenderTakenMultiplier: 1 + num('taken') / 100,
      defenderArmor: num('armor') / 100,
    });
    panel.querySelector('[data-damage]')!.innerHTML = damageTable(breakdown, attackerElement, defenderElement);
  };
  panel.querySelectorAll('[data-controls] [data-f]').forEach((el) => el.addEventListener('input', recompute));
  recompute();
  return panel;
}

const RELATION_TEXT = { advantage: 'üstünlük', disadvantage: 'dezavantaj', neutral: 'etkisiz' } as const;

function damageTable(b: DamageBreakdown, attacker: Element, defender: Element): string {
  const n = (v: number): string => v.toFixed(1);
  const row = (label: string, formula: string, value: string): string =>
    `<tr class="border-t border-white/10"><td class="py-1 pr-2 text-slate-400">${label}</td><td class="py-1 pr-2 text-xs text-slate-300">${formula}</td><td class="py-1 text-right font-bold">${value}</td></tr>`;
  return `
    <div class="mb-2 rounded bg-amber-400/20 p-3 text-center text-2xl font-bold text-amber-200">Hasar: ${b.finalDamage}</div>
    <table class="w-full text-sm">
      ${row('1. Çizim gücü', `boyut ${b.powerFactor.size.toFixed(2)} × efor ${b.powerFactor.effort.toFixed(2)} = ×${b.powerFactor.total.toFixed(2)}`, n(b.power))}
      ${row('2. Savunma + bölge', `geçen %${(b.unblockedRatio * 100).toFixed(0)}, bunun %${(b.headShare * 100).toFixed(0)}'i başa (×${b.weightedUnblockedRatio.toFixed(2)})`, n(b.afterRegion))}
      ${row('3. Element', `${ELEMENT_NAMES[attacker]} → ${ELEMENT_NAMES[defender]}: ${RELATION_TEXT[b.elementRelation]} ×${b.elementMultiplier}`, n(b.afterElement))}
      ${row('4. Skill/ekipman', `×${b.skillMultiplier.toFixed(2)}`, n(b.afterSkills))}
      ${row('5. Zırh', `−%${(b.armorReduction * 100).toFixed(0)}`, n(b.afterArmor))}
    </table>`;
}
