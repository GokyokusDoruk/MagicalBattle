import { GRID, LOGICAL_SIZE, MIN_EXTENT, MIN_INKED_CELLS } from '../battle/gesture/config';
import type { DensityMap, DrawingResult } from '../battle/gesture/types';
import { DrawingCanvas } from './drawingCanvas';
import { lockTouchScroll } from './touchLock';

const ELEMENTS = [
  { name: 'Ateş', color: '#ff7a3d' },
  { name: 'Su', color: '#4db8ff' },
  { name: 'Toprak', color: '#c8a15a' },
  { name: 'Hava', color: '#d6efff' },
] as const;

/** Yoğunluk haritasını ısı haritası olarak çizer: gri = iz var ama az vakit, sıcak renk = çok vakit harcanan yer. */
function drawHeatmap(canvas: HTMLCanvasElement, density: DensityMap): void {
  const ctx = canvas.getContext('2d')!;
  const cell = canvas.width / GRID;
  const max = Math.max(...density.cells, 1e-9);
  ctx.fillStyle = '#0b1020';
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  for (let j = 0; j < GRID; j++) {
    for (let i = 0; i < GRID; i++) {
      const idx = j * GRID + i;
      if (!density.ink[idx]) continue;
      const t = density.cells[idx] / max; // 0-1
      // koyu mavi -> sarı -> kırmızı
      const hue = 220 - t * 220;
      ctx.fillStyle = `hsl(${hue} 85% ${35 + t * 25}%)`;
      ctx.fillRect(i * cell, j * cell, cell, cell);
    }
  }
}

/**
 * Çizim laboratuvarı (`?lab=draw`): büyü çizmeyi dene, sistemin çizimini nasıl ölçtüğünü gör.
 * Savaş sistemi gelmeden önce kuralları (minimum hacim, süre ağırlığı) denemek ve ayarlamak içindir.
 */
export function startDrawLab(root: HTMLElement): void {
  lockTouchScroll();
  root.innerHTML = '';
  const page = document.createElement('div');
  page.setAttribute('data-scrollable', '');
  page.style.touchAction = 'pan-y';
  page.className = 'fixed inset-0 overflow-y-auto bg-slate-950 text-amber-50';
  root.appendChild(page);

  let color: string = ELEMENTS[0].color;

  const render = (): void => {
    page.innerHTML = `
      <div class="mx-auto flex max-w-xl flex-col items-center gap-4 p-4">
        <h1 class="text-2xl font-bold text-amber-300">Çizim laboratuvarı</h1>
        <p class="text-center text-sm text-slate-300">
          Bir büyü çiz. Süre ilk dokunuşta başlar ve <b>3 saniyen</b> var. Bir yerde ne kadar çok durursan o yerin ağırlığı artar.
          Çok küçük çizimler büyü sayılmaz.
        </p>
        <div class="flex gap-2" data-elements></div>
        <div data-stage class="flex w-full flex-col items-center gap-3"></div>
      </div>`;

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
    void runRound(page.querySelector('[data-stage]')!);
  };

  const runRound = async (stage: HTMLElement): Promise<void> => {
    const drawing = new DrawingCanvas({ color });
    stage.appendChild(drawing.element);
    const result = await drawing.start();
    stage.appendChild(resultPanel(result, render));
  };

  render();
}

function resultPanel(result: DrawingResult, again: () => void): HTMLElement {
  const { metrics: m, validity } = result;
  const panel = document.createElement('div');
  panel.className = 'flex w-full flex-col items-center gap-3 pb-8';

  const banner = validity.valid
    ? `<div class="w-full rounded bg-emerald-600/30 p-3 text-center text-lg font-bold text-emerald-200">Büyü hazır!</div>`
    : `<div class="w-full rounded bg-red-600/30 p-3 text-center text-lg font-bold text-red-200">Büyü yapamadı! <span class="font-normal">${validity.message}</span></div>`;

  const pct = (v: number): string => `${(v * 100).toFixed(1)}%`;
  panel.innerHTML = `
    ${banner}
    <table class="w-full text-sm">
      <tr><td class="text-slate-400">Kaplanan alan</td><td class="text-right">${pct(m.coverage)} (${m.inkedCells} hücre, en az ${MIN_INKED_CELLS})</td></tr>
      <tr><td class="text-slate-400">Boyut (genişlik × yükseklik)</td><td class="text-right">${m.width.toFixed(0)} × ${m.height.toFixed(0)} (en uzun kenar en az ${MIN_EXTENT} / ${LOGICAL_SIZE})</td></tr>
      <tr><td class="text-slate-400">Çizgi uzunluğu</td><td class="text-right">${m.pathLength.toFixed(0)}</td></tr>
      <tr><td class="text-slate-400">Çizim süresi</td><td class="text-right">${m.drawTimeSec.toFixed(2)} sn</td></tr>
      <tr><td class="text-slate-400">Çizgi sayısı</td><td class="text-right">${result.strokes.length}</td></tr>
    </table>
    <p class="text-sm text-slate-300">Yoğunluk haritası (sıcak renk = orada daha çok vakit harcadın):</p>
    <canvas data-heat width="256" height="256" class="w-64 rounded border border-white/20"></canvas>
    <button type="button" data-again class="rounded bg-amber-300 px-5 py-2 font-bold text-slate-900">Tekrar çiz</button>`;

  drawHeatmap(panel.querySelector('[data-heat]')!, result.density);
  panel.querySelector('[data-again]')!.addEventListener('click', again);
  return panel;
}
