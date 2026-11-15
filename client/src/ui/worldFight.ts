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

/** Dünya savaşı ayarları (Task 55) */
export interface WorldFightOptions {
  /** Savaşın içinde Kaç düğmesi çıkar; `bribe` de verilirse Rüşvet düğmesi de. Verilmezse (çalılık, maden, sandık) çıkış yoktur. */
  escape?: { bribe?: BribeOption };
  /** Savaş başlarken gösterilen ganimet satırı */
  lootHint?: string;
}

/**
 * Dünya düşmanıyla savaş (Task 55): **savaş öncesi panel yok**, savaş hemen başlar. Savaşın içinde (izin varsa) Kaç ve Rüşvet düğmeleri vardır.
 * Yenilgi ölümdür (para kaybı, şehirde ayılma); "tekrar dene" yoktur. Zaferde 'won' ve kalan can, yenilince 'lost', kaçınca 'retreat',
 * rüşvet verilince 'bribed' döner.
 */
export async function runWorldFight(spot: EnemySpot, player: PlayerStats, maxHp: number, options: WorldFightOptions = {}): Promise<WorldFightResult> {
  const root = document.createElement('div');
  root.className = 'fixed inset-0 z-[70] bg-black';
  document.body.appendChild(root);
  // Savaş ekranı karanlıktan yumuşakça açılır
  root.animate([{ opacity: 0 }, { opacity: 1 }], { duration: 450, easing: 'ease-out' });
  try {
    const entryHp = player.hp ?? maxHp;
    const stats = enemyStats(spot.element, spot.tier);
    const engine = new BattleEngine(enemyFighters(spot.element, spot.tier, { ...player, hp: entryHp }), { maxCycles: MAX_CYCLES });
    const bribe = options.escape?.bribe;
    const skills = [...enemySkills(spot.element, spot.tier).levels].map(([id, lv]) => `${getSkill(id)?.name ?? id} Sv${lv}`).join(', ');
    const screen = new BattleScreen(root, engine, {
      botSkill: stats.skill,
      showAttackToDefender: true,
      intro: `⚔ ${stats.name} (${ELEMENT_NAMES[spot.element]}, sv ${stats.level})${skills ? ` · ${skills}` : ''}${options.lootHint ? `<br><span class="text-xs font-normal text-emerald-300">${esc(options.lootHint)}</span>` : ''}`,
      escape: options.escape ? { bribe: bribe ? { cost: bribe.cost, currencyName: bribe.currencyName, balance: bribe.balance } : undefined } : undefined,
      // Yenilgide "tekrar dene" yok: tek düğme ("Devam") ölüm akışına götürür
      endLabels: { again: 'Tekrar dene', menu: 'Devam', hideAgainOnWin: true, winMenu: 'Devam', noAgain: true },
      onFinish: () => {},
    });
    const winner = await screen.run();
    const escaped = screen.escaped;
    screen.dispose();
    if (escaped === 'bribe') return bribe?.pay() ? { outcome: 'bribed', hp: null } : { outcome: 'retreat', hp: null };
    if (escaped === 'flee') return { outcome: 'retreat', hp: null };
    if (winner === 0) return { outcome: 'won', hp: engine.fighter({ team: 0, index: 0 }).hp };
    return { outcome: 'lost', hp: null };
  } finally {
    root.remove();
  }
}
