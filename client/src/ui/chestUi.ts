import { ELEMENT_NAMES } from '../battle/damage/elements';
import { enemyStats } from '../enemies/catalog';
import { CHEST_GUARDS, type ChestSpot } from '../enemies/chests';

/** Sandık paneli: muhafızları göster; true = savaşa gir, false = vazgeç. */
export function confirmChest(chest: ChestSpot, hp: number, maxHp: number, lootHint?: string): Promise<boolean> {
  const s = enemyStats(chest.element, chest.tier);
  const panel = document.createElement('div');
  panel.className = 'fixed inset-0 z-[71] flex items-center justify-center bg-black/85 p-4';
  panel.setAttribute('role', 'dialog');
  panel.innerHTML = `
    <div class="flex w-full max-w-sm flex-col gap-3 rounded-xl border border-amber-400/50 bg-slate-950 p-5 text-amber-50 shadow-2xl">
      <h2 class="text-xl font-bold text-amber-300">🧰 Korumalı Sandık</h2>
      <p class="text-sm text-slate-300">${CHEST_GUARDS} muhafız (${ELEMENT_NAMES[chest.element]}, seviye ${s.level}) sandığı koruyor. İkisini de yenersen sandık açılır: kesin ekipman, çoğu zaman asa ve iksir, bol altın.</p>
      ${lootHint ? `<p class="text-xs text-emerald-300" data-loot>${lootHint.replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]!)}</p>` : ''}
      <p class="text-sm">Canın: <b class="${hp < maxHp ? 'text-amber-300' : 'text-emerald-300'}">${hp} / ${maxHp}</b></p>
      <p class="text-xs text-slate-400">Yarıda bırakırsan muhafızlar yenilenir; sandık bir kez açılır.</p>
      <div class="flex gap-3">
        <button data-go type="button" class="flex-1 rounded bg-amber-300 px-4 py-3 font-bold text-slate-900">Savaş</button>
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
