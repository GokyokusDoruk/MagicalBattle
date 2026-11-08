import { BattleEngine } from '../battle/flow/engine';
import { MAX_CYCLES } from '../battle/flow/config';
import { bossFighters, bossFoes, getBoss, type PlayerStats } from '../boss/bosses';
import type { FinalPath } from '../morality/morality';
import { BattleScreen } from './battleScreen';

export type BossOutcome = 'won' | 'lost' | 'retreat';

const esc = (s: string): string => s.replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]!);

/** Savaş öncesi panel: boss, mekanik uyarısı, "Savaşa gir" / "Geri çekil". true = savaşa gir. */
function confirmFight(parent: HTMLElement, chapter: number, path: FinalPath, level: number): Promise<boolean> {
  const boss = getBoss(chapter)!;
  const foes = bossFoes(boss, path);
  const under = level < boss.targetLevel - 2;
  const panel = document.createElement('div');
  panel.className = 'fixed inset-0 z-[71] flex items-center justify-center bg-black/85 p-4';
  panel.setAttribute('role', 'dialog');
  panel.innerHTML = `
    <div class="flex w-full max-w-md flex-col gap-3 rounded-xl border border-red-400/50 bg-slate-950 p-5 text-amber-50 shadow-2xl">
      <h2 class="text-xl font-bold text-red-300">${esc(boss.title)}</h2>
      <p class="text-sm text-slate-300">Düşman${foes.length > 1 ? 'lar' : ''}: ${foes.map((f) => `<b>${esc(f.name)}</b> (${f.hp} can)`).join(', ')}</p>
      ${boss.gimmick ? `<p class="rounded bg-purple-900/50 p-2 text-sm text-purple-100" data-gimmick>⚠ ${esc(boss.gimmick.note)}</p>` : ''}
      <p class="text-xs ${under ? 'text-amber-300' : 'text-slate-400'}" data-level>Önerilen seviye: ${boss.targetLevel}${under ? ` (şu an ${level}: zor olabilir, yetenek ve asalarını gözden geçir)` : ''}</p>
      <div class="flex gap-3">
        <button data-go type="button" class="flex-1 rounded bg-red-400 px-4 py-3 font-bold text-slate-900">Savaşa gir</button>
        <button data-back type="button" class="flex-1 rounded bg-slate-700 px-4 py-3 font-bold">Geri çekil</button>
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
 * Bölümün boss savaşını oynatır. Önce panel (geri çekilebilirsin), sonra savaş. Yenilince "Tekrar dene" ya da
 * "Geri çekil". Zaferde 'won', yenilgide geri çekilirse 'lost', savaşa hiç girmezse 'retreat' döner.
 */
export async function runBossFight(chapter: number, player: PlayerStats, path: FinalPath = 'order'): Promise<BossOutcome> {
  const boss = getBoss(chapter);
  if (!boss) return 'won'; // bu bölümde boss yok
  const root = document.createElement('div');
  root.className = 'fixed inset-0 z-[70] bg-black';
  document.body.appendChild(root);
  try {
    if (!(await confirmFight(root, chapter, path, player.level))) return 'retreat';
    for (;;) {
      const engine = new BattleEngine(bossFighters(chapter, player, path), { maxCycles: boss.maxCycles ?? MAX_CYCLES });
      let again = false;
      const screen = new BattleScreen(root, engine, {
        botSkill: 0.5,
        // Sis (Morga): gelen saldırı savunurken görünmez; diğer bosslarda görünür
        showAttackToDefender: !boss.gimmick?.hideGhost,
        blurFromCycle: boss.gimmick?.blurFromCycle,
        endLabels: { again: 'Tekrar dene', menu: 'Pes et (altın kaybı)', hideAgainOnWin: true, winMenu: 'Devam' },
        onFinish: (playAgain) => {
          again = playAgain;
        },
      });
      const winner = await screen.run();
      screen.dispose();
      if (winner === 0) return 'won';
      if (!again) return 'lost';
    }
  } finally {
    root.remove();
  }
}
