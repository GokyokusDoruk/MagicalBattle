import { BattleEngine } from '../battle/flow/engine';
import { ELEMENT_NAMES } from '../battle/damage/elements';
import { MAX_CYCLES } from '../battle/flow/config';
import type { PlayerStats } from '../boss/bosses';
import { enemyFighters, enemyStats } from '../enemies/catalog';
import { enemySkills } from '../enemies/skills';
import { getSkill } from '../skills/catalog';
import type { EnemySpot } from '../enemies/spots';
import { BattleScreen } from './battleScreen';

export type WorldFightOutcome = 'won' | 'lost' | 'retreat' | 'bribed';

/** Rüşvet seçeneği: bedel, para birimi adı, bakiye ve ödeme (başarılıysa true). Verilmezse panelde rüşvet düğmesi yoktur. */
export interface BribeOption {
  cost: number;
  currencyName: string;
  balance: () => number;
  pay: () => boolean;
}

export interface WorldFightResult {
  outcome: WorldFightOutcome;
  /** Zaferde savaştan çıkarkenki can; diğer durumlarda null */
  hp: number | null;
}

const esc = (s: string): string => s.replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]!);

type Choice = 'fight' | 'flee' | 'bribe';

/** Arena savaşı: kaçıp çekilmek ve yenilgi arenayı bitirir; rüşvet ve tekrar dene yoktur. */
export interface ArenaFightInfo {
  stage: number;
  total: number;
}

/** Savaş öncesi panel: düşman ve canların. Savaş, kaç ya da (varsa) rüşvet ver. */
function confirmFight(parent: HTMLElement, spot: EnemySpot, playerHp: number, playerMaxHp: number, bribe?: BribeOption, arena?: ArenaFightInfo): Promise<Choice> {
  const s = enemyStats(spot.element, spot.tier);
  const skillLine = [...enemySkills(spot.element, spot.tier).levels].map(([id, lv]) => `${getSkill(id)?.name ?? id} Sv${lv}`).join(", ");
  const panel = document.createElement('div');
  panel.className = 'fixed inset-0 z-[71] flex items-center justify-center bg-black/85 p-4';
  panel.setAttribute('role', 'dialog');
  panel.innerHTML = `
    <div class="flex w-full max-w-sm flex-col gap-3 rounded-xl border border-amber-400/50 bg-slate-950 p-5 text-amber-50 shadow-2xl">
      ${arena ? `<p class="text-xs font-bold uppercase text-rose-300">Arena: rakip ${arena.stage} / ${arena.total}</p>` : ''}
      <h2 class="text-xl font-bold text-amber-300" data-enemy>${esc(s.name)}</h2>
      <p class="text-sm text-slate-300">Element: <b>${ELEMENT_NAMES[spot.element]}</b> · Seviye ${s.level} · ${s.hp} can</p>
      <p class="text-xs text-sky-300" data-skills>Yetenekler: ${esc(skillLine)}</p>
      <p class="text-sm" data-hp>Canın: <b class="${playerHp < playerMaxHp ? 'text-amber-300' : 'text-emerald-300'}">${playerHp} / ${playerMaxHp}</b></p>
      ${bribe ? `<p class="text-xs text-slate-400">Rüşvet verirsen savaş olmaz ve düşman çekilir. Elindeki: <b>${bribe.balance()} ${esc(bribe.currencyName)}</b></p>` : ''}
      <div class="flex gap-3">
        <button data-go type="button" class="flex-1 rounded bg-amber-300 px-4 py-3 font-bold text-slate-900">Savaş</button>
        <button data-back type="button" class="flex-1 rounded bg-slate-700 px-4 py-3 font-bold">${arena ? 'Çekil (ödülü al)' : 'Kaç'}</button>
      </div>
      ${bribe ? `<button data-bribe type="button" ${bribe.balance() < bribe.cost ? 'disabled' : ''} class="rounded bg-emerald-300 px-4 py-2 text-sm font-bold text-slate-900 disabled:opacity-40">💰 Rüşvet ver (${bribe.cost} ${esc(bribe.currencyName)})</button>` : ''}
    </div>`;
  parent.appendChild(panel);
  return new Promise((resolve) => {
    const done = (c: Choice): void => {
      panel.remove();
      resolve(c);
    };
    panel.querySelector('[data-go]')!.addEventListener('click', () => done('fight'));
    panel.querySelector('[data-back]')!.addEventListener('click', () => done('flee'));
    panel.querySelector('[data-bribe]')?.addEventListener('click', () => done('bribe'));
  });
}

/**
 * Dünya düşmanıyla savaş. Önce panel (kaçabilirsin), sonra savaş. Yenilince "Tekrar dene" ya da pes (ölüm).
 * Zaferde 'won' ve kalan can, pes edince 'lost', kaçınca 'retreat', rüşvet verilince 'bribed' döner.
 */
export async function runWorldFight(spot: EnemySpot, player: PlayerStats, maxHp: number, bribe?: BribeOption, arena?: ArenaFightInfo): Promise<WorldFightResult> {
  const root = document.createElement('div');
  root.className = 'fixed inset-0 z-[70] bg-black';
  document.body.appendChild(root);
  try {
    const entryHp = player.hp ?? maxHp;
    const choice = await confirmFight(root, spot, entryHp, maxHp, bribe, arena);
    if (choice === 'flee') return { outcome: 'retreat', hp: null };
    if (choice === 'bribe') return bribe?.pay() ? { outcome: 'bribed', hp: null } : { outcome: 'retreat', hp: null };
    for (;;) {
      const engine = new BattleEngine(enemyFighters(spot.element, spot.tier, { ...player, hp: entryHp }), { maxCycles: MAX_CYCLES });
      let again = false;
      const screen = new BattleScreen(root, engine, {
        botSkill: enemyStats(spot.element, spot.tier).skill,
        showAttackToDefender: true,
        endLabels: arena
          ? { again: 'Tekrar dene', menu: 'Arenayı bitir', hideAgainOnWin: true, winMenu: 'Devam', noAgain: true }
          : { again: 'Tekrar dene', menu: 'Pes et (altın kaybı)', hideAgainOnWin: true, winMenu: 'Devam' },
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
