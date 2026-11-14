import { ELEMENT_NAMES } from '../battle/damage/elements';
import { enemyStats } from '../enemies/catalog';
import type { EnemySpot } from '../enemies/spots';
import { MINE_STAGES } from '../enemies/mines';
import type { MineSpot } from '../enemies/mines';

const esc = (s: string): string => s.replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]!);

/** Maden girişi paneli: true = gir, false = vazgeç. */
export function confirmMine(mine: MineSpot, foes: readonly EnemySpot[], hp: number, maxHp: number): Promise<boolean> {
  const panel = document.createElement('div');
  panel.className = 'fixed inset-0 z-[71] flex items-center justify-center bg-black/85 p-4';
  panel.setAttribute('role', 'dialog');
  panel.innerHTML = `
    <div class="flex w-full max-w-sm flex-col gap-3 rounded-xl border border-amber-400/50 bg-slate-950 p-5 text-amber-50 shadow-2xl">
      <h2 class="text-xl font-bold text-amber-300">⛏ ${esc(mine.name)}</h2>
      <p class="text-sm text-slate-300">${ELEMENT_NAMES[mine.element]} elementi. İçeride <b>${MINE_STAGES} düşman</b> peş peşe saldırır; can savaşlar arasında yenilenmez, her zaferde ganimet düşer, sonuncusu en güçlüsüdür.</p>
      <p class="text-sm text-slate-300">Düşman seviyeleri: <b>${foes.map((f) => enemyStats(f.element, f.tier).level).join(', ')}</b></p>
      <p class="text-sm">Canın: <b class="${hp < maxHp ? 'text-amber-300' : 'text-emerald-300'}">${hp} / ${maxHp}</b></p>
      <p class="text-xs text-slate-400">Savaşlar başlayınca maden 10 dakika dinlenir.</p>
      <div class="flex gap-3">
        <button data-go type="button" class="flex-1 rounded bg-amber-300 px-4 py-3 font-bold text-slate-900">Gir</button>
        <button data-back type="button" class="flex-1 rounded bg-slate-700 px-4 py-3 font-bold">Vazgeç</button>
      </div>
    </div>`;
  document.body.appendChild(panel);
  return new Promise((resolve) => {
    const done = (go: boolean): void => {
      panel.remove();
      resolve(go);
    };
    panel.querySelector('[data-go]')!.addEventListener('click', () => done(true));
    panel.querySelector('[data-back]')!.addEventListener('click', () => done(false));
  });
}
