import { BattleEngine } from '../battle/flow/engine';
import { MAX_CYCLES } from '../battle/flow/config';
import { bossFighters, bossFoes, getBoss, type PlayerStats } from '../boss/bosses';
import type { FinalPath } from '../morality/morality';
import { BattleScreen } from './battleScreen';

export type BossOutcome = 'won' | 'lost' | 'retreat';

/** Savaş öncesi panelde can ve iksir kullanımı (Task 27): kalıcı can, boss mevcut canla başlar. */
export interface HealHooks {
  hp: () => number;
  maxHp: () => number;
  /** Çantadaki can iksirleri */
  potions: () => { id: string; name: string; heal: number; count: number }[];
  /** İksiri kullanır; kullanıcıya gösterilecek mesajı döndürür */
  use: (id: string) => string;
}

export interface BossResult {
  outcome: BossOutcome;
  /** Savaştan çıkarkenki can (oyuncunun son savaşı); savaşa girilmediyse null */
  hp: number | null;
}

const esc = (s: string): string => s.replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]!);

/** Savaş öncesi panel: boss, mekanik uyarısı, "Savaşa gir" / "Geri çekil". true = savaşa gir. */
function confirmFight(parent: HTMLElement, chapter: number, path: FinalPath, level: number, heal?: HealHooks): Promise<boolean> {
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
      ${heal ? '<div data-health class="rounded bg-black/40 p-2 text-sm"></div>' : ''}
      <p class="text-xs ${under ? 'text-amber-300' : 'text-slate-400'}" data-level>Önerilen seviye: ${boss.targetLevel}${under ? ` (şu an ${level}: zor olabilir, yetenek ve asalarını gözden geçir)` : ''}</p>
      <div class="flex gap-3">
        <button data-go type="button" class="flex-1 rounded bg-red-400 px-4 py-3 font-bold text-slate-900">Savaşa gir</button>
        <button data-back type="button" class="flex-1 rounded bg-slate-700 px-4 py-3 font-bold">Geri çekil</button>
      </div>
    </div>`;
  parent.appendChild(panel);
  const healthBox = panel.querySelector<HTMLElement>('[data-health]');
  let note = '';
  const renderHealth = (): void => {
    if (!healthBox || !heal) return;
    const hp = heal.hp();
    const max = heal.maxHp();
    const potions = heal.potions();
    healthBox.innerHTML = `<div class="flex justify-between"><span>Canın</span><b class="${hp < max ? 'text-amber-300' : 'text-emerald-300'}" data-hp>${hp} / ${max}</b></div>
      <div class="mt-1 h-1.5 overflow-hidden rounded bg-white/15"><div class="h-full ${hp < max ? 'bg-amber-400' : 'bg-emerald-400'}" style="width:${(hp / max) * 100}%"></div></div>
      ${hp < max ? '<p class="mt-1 text-[11px] text-amber-200">Boss tam canla savaşır, sen şu anki canınla. Han\'da dinlenip dolu canla gelebilirsin.</p>' : ''}
      <div class="mt-2 flex flex-wrap gap-1">${potions.length ? potions.map((p) => `<button type="button" data-potion="${p.id}" ${hp >= max ? 'disabled' : ''} class="rounded bg-emerald-300 px-2 py-1 text-xs font-bold text-slate-900 disabled:opacity-40">${esc(p.name)} +${p.heal} ×${p.count}</button>`).join('') : '<span class="text-[11px] text-slate-400">Can iksirin yok.</span>'}</div>
      <p class="mt-1 text-[11px] text-slate-300" data-note>${esc(note)}</p>`;
  };
  renderHealth();
  healthBox?.addEventListener('click', (e) => {
    const id = (e.target as HTMLElement).closest<HTMLElement>('[data-potion]')?.dataset.potion;
    if (!id || !heal) return;
    note = heal.use(id);
    renderHealth();
  });
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
 * Bölümün boss savaşını oynatır. Önce panel (geri çekilebilirsin), sonra savaş. Yenilgide "tekrar dene" yoktur (Task 55): yenilgi ölümdür.
 * Zaferde 'won', yenilgide 'lost', savaşa hiç girmezse 'retreat' döner.
 */
export async function runBossFight(chapter: number, player: PlayerStats, path: FinalPath = 'order', heal?: HealHooks): Promise<BossResult> {
  const boss = getBoss(chapter);
  if (!boss) return { outcome: 'won', hp: null }; // bu bölümde boss yok
  const root = document.createElement('div');
  root.className = 'fixed inset-0 z-[70] bg-black';
  document.body.appendChild(root);
  try {
    if (!(await confirmFight(root, chapter, path, player.level, heal))) return { outcome: 'retreat', hp: null };
    // Savaşa girerkenki can; "Tekrar dene" hep buradan başlar
    const entryHp = heal ? heal.hp() : player.hp;
    for (;;) {
      const engine = new BattleEngine(bossFighters(chapter, { ...player, hp: entryHp }, path), { maxCycles: boss.maxCycles ?? MAX_CYCLES });
      let again = false;
      const screen = new BattleScreen(root, engine, {
        botSkill: 0.5,
        // Sis (Morga): gelen saldırı savunurken görünmez; diğer bosslarda görünür
        showAttackToDefender: !boss.gimmick?.hideGhost,
        blurFromCycle: boss.gimmick?.blurFromCycle,
        endLabels: { again: 'Tekrar dene', menu: 'Devam', hideAgainOnWin: true, winMenu: 'Devam', noAgain: true },
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
