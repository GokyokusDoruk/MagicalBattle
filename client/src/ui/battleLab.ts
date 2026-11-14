import { BattleEngine, type FighterInit } from '../battle/flow/engine';
import { SkillTree } from '../skills/tree';
import { WandInventory } from '../wands/inventory';
import { RARITY_NAMES, ROLE_NAMES, wandIdOf, type Rarity, type WandRole } from '../wands/catalog';
import { ELEMENT_NAMES, type Element } from '../battle/damage/elements';
import { BattleScreen } from './battleScreen';
import { SkillTreeUi } from './skillTreeUi';
import { lockTouchScroll } from './touchLock';

const DIFFICULTIES = [
  { id: 'easy', name: 'Kolay', skill: 0.25, note: 'Bot saldırının yaklaşık üçte birini savunur' },
  { id: 'normal', name: 'Orta', skill: 0.55, note: 'Bot saldırının yarısından fazlasını savunur' },
  { id: 'hard', name: 'Zor', skill: 0.85, note: 'Bot saldırının dörtte üçünü savunur' },
] as const;

interface Settings {
  teamSize: 1 | 2;
  difficulty: (typeof DIFFICULTIES)[number]['id'];
  showGhost: boolean;
  /** Denemedeki karakter seviyesi (yetenek puanını belirler) */
  level: number;
  /** Denemede her yuvaya kuşanılan asanın nadirliği (0 = asasız) */
  wandRarity: Rarity;
  /** Denemede kuşanılan asanın rolü (null = asasız), elementi; seviyesi karakter seviyesiyle aynıdır */
  wandRole: WandRole | null;
  wandElement: Element;
}

/**
 * Savaş denemesi (`?lab=battle`): botlara karşı sıra tabanlı savaşı baştan sona oyna.
 * 1v1 ya da 2v2 (Elysia seninle). Savaş sonu ekranından tekrar oynayabilir ya da menüye dönebilirsin.
 */
export function startBattleLab(root: HTMLElement): void {
  lockTouchScroll();
  const settings: Settings = { teamSize: 1, difficulty: 'normal', showGhost: true, level: 1, wandRarity: 3, wandRole: null, wandElement: 'fire' };
  // Denemede puan seviyeden gelir; yetenekler savaşta "Sen"in büyülerine uygulanır
  const tree = new SkillTree(() => settings.level);
  const skillUi = new SkillTreeUi({ tree, level: () => settings.level, onChanged: () => menu() });
  document.body.appendChild(skillUi.element);
  let screen: BattleScreen | null = null;

  /** Seçilen asa (element, rol, nadirlik; seviyesi karakter seviyesi) kuşanılmış envanter */
  const wandSet = () => {
    const inv = new WandInventory();
    inv.setLevelProvider(() => settings.level);
    if (settings.wandRole) inv.add(wandIdOf({ element: settings.wandElement, role: settings.wandRole, rarity: settings.wandRarity, level: settings.level }));
    return inv.resolver;
  };

  const fighters = (): FighterInit[] => {
    const mine: FighterInit[] = [{ name: 'Sen', team: 0, control: 'human', spells: tree.resolver, passives: tree.passives, wands: wandSet() }];
    const theirs: FighterInit[] = [{ name: 'Rakip', team: 1, control: 'bot' }];
    if (settings.teamSize === 2) {
      mine.push({ name: 'Elysia', team: 0, control: 'bot', persona: 'elysia' });
      theirs.push({ name: 'Gölge', team: 1, control: 'bot' });
    }
    return [...mine, ...theirs];
  };

  const start = (): void => {
    root.innerHTML = '';
    const skill = DIFFICULTIES.find((d) => d.id === settings.difficulty)!.skill;
    const s = new BattleScreen(root, new BattleEngine(fighters()), {
      botSkill: skill,
      showAttackToDefender: settings.showGhost,
      onFinish: (playAgain) => {
        s.dispose();
        screen = null;
        playAgain ? start() : menu();
      },
    });
    screen = s;
    void s.run();
  };

  const menu = (): void => {
    screen?.dispose();
    screen = null;
    root.innerHTML = '';
    const page = document.createElement('div');
    page.setAttribute('data-scrollable', '');
    page.style.touchAction = 'pan-y';
    page.className = 'fixed inset-0 overflow-y-auto bg-slate-950 text-amber-50';
    root.appendChild(page);

    const chip = (label: string, active: boolean): string =>
      `<span class="${active ? 'bg-amber-300 font-bold text-slate-900' : 'bg-slate-800 text-slate-200'} rounded px-3 py-2 text-sm">${label}</span>`;

    page.innerHTML = `
      <div class="mx-auto flex max-w-md flex-col gap-5 p-5">
        <h1 class="text-center text-2xl font-bold text-amber-300">Savaş denemesi</h1>
        <p class="text-center text-sm text-slate-300">Botlara karşı sıra tabanlı savaş. Her <b>döngünün başında gizlice tek element seçersin</b> (hem saldırın hem savunman o element olur), sonra büyünü çizersin (saldırıda 3 sn, savunmada 3 sn).</p>
        <section><h2 class="mb-2 text-sm font-bold text-slate-300">Mod</h2>
          <div class="flex gap-2" data-group="mode"></div></section>
        <section><h2 class="mb-2 text-sm font-bold text-slate-300">Zorluk</h2>
          <div class="flex gap-2" data-group="diff"></div>
          <p class="mt-2 text-xs text-slate-400" data-note></p></section>
        <section><h2 class="mb-2 text-sm font-bold text-slate-300">Seviye ve yetenekler</h2>
          <div class="flex gap-2" data-group="level"></div>
          <p class="mt-3 text-xs text-slate-400">Asa (seviyesi karakter seviyesi kadar olur):</p>
          <div class="mt-1 flex flex-wrap gap-2" data-group="wand"></div>
          <div class="mt-2 flex flex-wrap gap-2" data-group="wandEl"></div>
          <div class="mt-2 flex flex-wrap gap-2" data-group="wandR"></div>
          <button data-skills type="button" class="mt-2 w-full rounded bg-slate-800 px-3 py-2 text-sm text-slate-100">✦ Yetenek ağacı (boş puan: ${tree.pointsFree})</button></section>
        <label class="flex items-center gap-2 text-sm text-slate-300">
          <input type="checkbox" data-ghost ${settings.showGhost ? 'checked' : ''}> Savunurken gelen saldırıyı soluk olarak göster</label>
        <button data-start type="button" class="rounded bg-amber-300 px-5 py-3 text-lg font-bold text-slate-900">Savaşa başla</button>
        <p class="text-xs text-slate-500">Sıra: 1v1'de sen saldırır rakip savunur, sonra tersi. 2v2'de her takımın iki kişisi sırayla saldırır; ölenin sırası atlanır.</p>
      </div>`;

    const group = (name: string, items: { label: string; active: boolean; pick: () => void }[]): void => {
      const el = page.querySelector(`[data-group=${name}]`)!;
      for (const it of items) {
        const b = document.createElement('button');
        b.type = 'button';
        b.innerHTML = chip(it.label, it.active);
        b.addEventListener('click', () => {
          it.pick();
          menu();
        });
        el.appendChild(b);
      }
    };
    group('mode', [
      { label: '1v1', active: settings.teamSize === 1, pick: () => (settings.teamSize = 1) },
      { label: '2v2 (Elysia ile)', active: settings.teamSize === 2, pick: () => (settings.teamSize = 2) },
    ]);
    group('diff', DIFFICULTIES.map((d) => ({ label: d.name, active: settings.difficulty === d.id, pick: () => (settings.difficulty = d.id) })));
    group('level', [1, 5, 10, 20, 30].map((n) => ({
      label: `Sv ${n}`,
      active: settings.level === n,
      pick: () => {
        settings.level = n;
        tree.restore(tree.snapshot()); // puan azaldıysa fazlası atılır
      },
    })));
    group('wand', ([null, 'attack', 'defense'] as const).map((r) => ({
      label: r === null ? 'Asasız' : ROLE_NAMES[r],
      active: settings.wandRole === r,
      pick: () => (settings.wandRole = r),
    })));
    group('wandEl', (['fire', 'water', 'earth', 'air'] as const).map((e) => ({
      label: ELEMENT_NAMES[e],
      active: settings.wandElement === e,
      pick: () => (settings.wandElement = e),
    })));
    group('wandR', ([1, 2, 3, 4, 5, 6] as const).map((n) => ({
      label: RARITY_NAMES[n],
      active: settings.wandRarity === n,
      pick: () => (settings.wandRarity = n),
    })));
    page.querySelector('[data-skills]')!.addEventListener('click', () => skillUi.open());
    page.querySelector('[data-note]')!.textContent = DIFFICULTIES.find((d) => d.id === settings.difficulty)!.note;
    page.querySelector<HTMLInputElement>('[data-ghost]')!.addEventListener('change', (e) => {
      settings.showGhost = (e.target as HTMLInputElement).checked;
    });
    page.querySelector('[data-start]')!.addEventListener('click', start);
  };

  menu();
}
