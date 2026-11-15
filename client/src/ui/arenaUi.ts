import { ELEMENT_NAMES } from '../battle/damage/elements';
import { ARENA_COOLDOWN_MS, ARENA_STAGES, arenaMoneyXp, type ArenaSpot } from '../enemies/arena';
import { enemyStats } from '../enemies/catalog';
import type { EnemySpot } from '../enemies/spots';

const esc = (s: string): string => s.replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]!);

/** Arena girişi paneli: beş rakip ve galibiyet sayısına göre ödül. true = gir. */
export function confirmArena(arena: ArenaSpot, foes: readonly EnemySpot[], hp: number, maxHp: number, playerLevel: number, currencyName: string): Promise<boolean> {
  const rows = foes
    .map((f, i) => {
      const s = enemyStats(f.element, f.tier);
      const reward = arenaMoneyXp(foes, i + 1, playerLevel);
      return `<tr class="border-t border-white/10"><td class="py-1">${i + 1}. ${esc(s.name)} <span class="text-slate-400">(${ELEMENT_NAMES[f.element]}, sv ${s.level})</span></td>
        <td class="py-1 text-right text-emerald-300">${i + 1} galibiyet: ${reward.money} ${esc(currencyName)}, ${reward.xp} XP${i >= 1 ? '+' : ''}</td></tr>`;
    })
    .join('');
  const panel = document.createElement('div');
  panel.className = 'fixed inset-0 z-[71] flex items-center justify-center bg-black/85 p-4';
  panel.setAttribute('role', 'dialog');
  panel.innerHTML = `
    <div class="flex w-full max-w-md flex-col gap-3 rounded-xl border border-rose-400/50 bg-slate-950 p-5 text-amber-50 shadow-2xl">
      <h2 class="text-xl font-bold text-rose-300">⚔ ${esc(arena.name)}</h2>
      <p class="text-sm text-slate-300">Beş rakiple peş peşe dövüşürsün; can savaşlar arasında yenilenmez. <b>Ödül, kaç savaş kazandığına göre büyür</b> ve en sonda bir kerede ödenir.
      İlk yenilgi (ya da çekilmek) arenayı bitirir: o ana kadar kazandıklarının ödülünü alırsın. Yenilgi ölüm değildir ama canın çeyreğe iner. 2, 4 ve 5 galibiyette ayrıca ekipman, asa ya da mal düşebilir.</p>
      <table class="w-full text-left text-xs">${rows}</table>
      <p class="text-sm">Canın: <b class="${hp < maxHp ? 'text-amber-300' : 'text-emerald-300'}">${hp} / ${maxHp}</b></p>
      <p class="text-xs text-slate-400">Girince arena ${ARENA_COOLDOWN_MS / 60000} dakika dinlenir.</p>
      <div class="flex gap-3">
        <button data-go type="button" class="flex-1 rounded bg-rose-300 px-4 py-3 font-bold text-slate-900">Arenaya gir</button>
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

export interface ArenaResultView {
  wins: number;
  money: number;
  moneyName: string;
  xp: number;
  items: string[];
  note: string;
}

/** Arena bitince sonuç paneli. */
export function showArenaResult(arena: ArenaSpot, r: ArenaResultView): Promise<void> {
  const panel = document.createElement('div');
  panel.className = 'fixed inset-0 z-[71] flex items-center justify-center bg-black/85 p-4';
  panel.setAttribute('role', 'dialog');
  const title = r.wins === ARENA_STAGES ? '🏆 Arena şampiyonu!' : r.wins === 0 ? 'Arena: galibiyet yok' : `Arena: ${r.wins} / ${ARENA_STAGES} galibiyet`;
  panel.innerHTML = `
    <div class="flex w-full max-w-sm flex-col gap-3 rounded-xl border border-rose-400/50 bg-slate-950 p-5 text-amber-50 shadow-2xl">
      <h2 class="text-xl font-bold text-rose-300" data-title>${esc(title)}</h2>
      <p class="text-xs text-slate-400">${esc(arena.name)} · ${esc(r.note)}</p>
      ${
        r.wins > 0
          ? `<p class="text-sm text-emerald-300">+${r.money} ${esc(r.moneyName)}, +${r.xp} XP</p>${r.items.length ? `<p class="text-sm text-sky-300">${esc(r.items.join(', '))}</p>` : ''}`
          : '<p class="text-sm text-slate-300">Ödül yok. Bir dahaki sefere!</p>'
      }
      <button data-ok type="button" class="rounded bg-rose-300 px-4 py-3 font-bold text-slate-900">Tamam</button>
    </div>`;
  document.body.appendChild(panel);
  return new Promise((resolve) => {
    panel.querySelector('[data-ok]')!.addEventListener('click', () => {
      panel.remove();
      resolve();
    });
  });
}
