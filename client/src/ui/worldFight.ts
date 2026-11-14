import { BattleEngine } from '../battle/flow/engine';
import { ELEMENT_NAMES } from '../battle/damage/elements';
import { MAX_CYCLES } from '../battle/flow/config';
import type { PlayerStats } from '../boss/bosses';
import { enemyFighters, enemyStats } from '../enemies/catalog';
import type { EnemySpot } from '../enemies/spots';
import { BattleScreen } from './battleScreen';

export type WorldFightOutcome = 'won' | 'lost' | 'retreat';

export interface WorldFightResult {
  outcome: WorldFightOutcome;
  /** Zaferde savaştan çıkarkenki can; diğer durumlarda null */
  hp: number | null;
}

const esc = (s: string): string => s.replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]!);

/** Savaş öncesi panel: düşman ve canların. true = savaşa gir, false = kaç. */
function confirmFight(parent: HTMLElement, spot: EnemySpot, playerHp: number, playerMaxHp: number): Promise<boolean> {
  const s = enemyStats(spot.element, spot.tier);
  const panel = document.createElement('div');
  panel.className = 'fixed inset-0 z-[71] flex items-center justify-center bg-black/85 p-4';
  panel.setAttribute('role', 'dialog');
  panel.innerHTML = `
    <div class="flex w-full max-w-sm flex-col gap-3 rounded-xl border border-amber-400/50 bg-slate-950 p-5 text-amber-50 shadow-2xl">
      <h2 class="text-xl font-bold text-amber-300" data-enemy>${esc(s.name)}</h2>
      <p class="text-sm text-slate-300">Element: <b>${ELEMENT_NAMES[spot.element]}</b> · Seviye ${s.level} · ${s.hp} can</p>
      <p class="text-sm" data-hp>Canın: <b class="${playerHp < playerMaxHp ? 'text-amber-300' : 'text-emerald-300'}">${playerHp} / ${playerMaxHp}</b></p>
      <div class="flex gap-3">
        <button data-go type="button" class="flex-1 rounded bg-amber-300 px-4 py-3 font-bold text-slate-900">Savaş</button>
        <button data-back type="button" class="flex-1 rounded bg-slate-700 px-4 py-3 font-bold">Kaç</button>
      </div>
    </div>`;
  parent.appendChild(panel);
  return new Promise((resolve) => {
    const done = (go: boolean): void => {
      panel.remove();
      resolve(go);
    };
    panel.querySelector('[data-go]')!.addEventListener('click', () => done(true));
    panel.querySelector('[data-back]')!.addEventListener('click', () => done(false));
  });
}

/**
 * Dünya düşmanıyla savaş. Önce panel (kaçabilirsin), sonra savaş. Yenilince "Tekrar dene" ya da pes (ölüm).
 * Zaferde 'won' ve kalan can, pes edince 'lost', kaçınca 'retreat' döner.
 */
export async function runWorldFight(spot: EnemySpot, player: PlayerStats, maxHp: number): Promise<WorldFightResult> {
  const root = document.createElement('div');
  root.className = 'fixed inset-0 z-[70] bg-black';
  document.body.appendChild(root);
  try {
    const entryHp = player.hp ?? maxHp;
    if (!(await confirmFight(root, spot, entryHp, maxHp))) return { outcome: 'retreat', hp: null };
    for (;;) {
      const engine = new BattleEngine(enemyFighters(spot.element, spot.tier, { ...player, hp: entryHp }), { maxCycles: MAX_CYCLES });
      let again = false;
      const screen = new BattleScreen(root, engine, {
        botSkill: enemyStats(spot.element, spot.tier).skill,
        showAttackToDefender: true,
        endLabels: { again: 'Tekrar dene', menu: 'Pes et (altın kaybı)', hideAgainOnWin: true, winMenu: 'Devam' },
        onFinish: (playAgain) => {
          again = playAgain;
        },
      });
      const winner = await screen.run();
      screen.dispose();
      if (winner === 0) return { outcome: 'won', hp: engine.fighter({ team: 0, index: 0 }).hp };
      if (!again) return { outcome: 'lost', hp: null };
    }
  } finally {
    root.remove();
  }
}
