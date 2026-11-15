import { mulberry32 } from '../world/rng';
import type { SlotRef } from '../battle/arena/layout';
import { Bot } from '../battle/flow/bot';
import { runBattle, type BattleIO } from '../battle/flow/controller';
import { MAX_CYCLES } from '../battle/flow/config';
import { BattleEngine } from '../battle/flow/engine';
import { ElysiaBot } from '../battle/flow/elysia';
import { WandInventory } from '../wands/inventory';
import type { Element } from '../battle/damage/elements';
import { enemyFighters, type Tier } from '../enemies/catalog';
import { skillsOf } from '../skills/catalog';
import type { Passives, SpellResolver } from '../skills/resolver';
import { SkillTree } from '../skills/tree';
import { wandIdOf, type Rarity } from '../wands/catalog';
import { bossFighters, getBoss, type PlayerStats } from './bosses';
import type { FinalPath } from '../morality/morality';

/**
 * Denge simülasyonu: oyuncuyu, belirli beceride (skill) bir bot "vekil" olarak oynatır ve bossa karşı kazanma
 * oranını ölçer. Gerçek oyuncunun yerine geçmez, bossların birbirine göre zorluğunu ve seviyeyle ilişkisini
 * kontrol etmek içindir. Rastgelelik tohumludur, sonuç tekrarlanabilir.
 */
export function simulateBoss(
  chapter: number,
  player: PlayerStats,
  options: { playerSkill: number; seed: number; path?: FinalPath },
): Promise<{ won: boolean; cycles: number }> {
  const boss = getBoss(chapter)!;
  const rand = mulberry32(options.seed);
  const engine = new BattleEngine(bossFighters(chapter, player, options.path ?? 'order'), { maxCycles: boss.maxCycles ?? MAX_CYCLES });
  const bots = new Map<string, Bot>();
  for (const f of engine.all()) {
    const k = `${f.team}:${f.index}`;
    // Oyuncu vekili, kuşandığı asanın elementini daha sık seçer (element eşleşmesi bonusu)
    if (f.control === 'human') bots.set(k, new Bot(rand, options.playerSkill, { elements: { fire: 2, water: 1, earth: 1, air: 1 } }));
    else if (f.persona === 'elysia') bots.set(k, new ElysiaBot(rand, f.ai?.skill ?? 0.7));
    else bots.set(k, new Bot(rand, f.ai?.skill ?? 0.5, f.ai ?? {}));
  }
  const botFor = (ref: SlotRef): Bot => bots.get(`${ref.team}:${ref.index}`)!;
  const io: BattleIO = {
    announceTurn: async () => {},
    chooseElement: async (ref) => botFor(ref).chooseElement(),
    revealRound: async () => {},
    draw: async (ref, role, ghost) => (role === 'attack' ? botFor(ref).drawAttack() : botFor(ref).drawDefense(boss.gimmick?.hideGhost ? undefined : ghost)),
    play: async (r) => {
      botFor(r.action.defender).onDamaged(r.damage, engine.fighter(r.action.defender).maxHp);
    },
    announceEnd: async () => {},
  };
  return runBattle(engine, io, { showAttackToDefender: !boss.gimmick?.hideGhost, random: rand }).then((winner) => ({ won: winner === 0, cycles: engine.cycle }));
}

/**
 * Seviyeye göre makul bir donanım modeli: ekipman ve yetenekten verilen hasar seviye başına +%1.5 (en çok +%40), zırh seviye
 * başına %1.2 (en çok %40) ve bir **saldırı asası** (ateş; nadirlik seviyeyle artar: her 6 seviyede bir, seviyesi oyuncu seviyesi).
 * Gerçek oyuncu bunu farklı yollardan elde eder; amaç bossların birbirine göre zorluğunu ölçmektir.
 */
export function typicalKit(level: number, options: { wand?: boolean; skills?: boolean } = {}): PlayerStats {
  const inv = new WandInventory();
  inv.setLevelProvider(() => level);
  if (options.wand !== false) {
    const rarity = Math.min(6, 1 + Math.floor(level / 6)) as Rarity;
    inv.add(wandIdOf({ element: 'fire', role: 'attack', rarity, level: Math.max(1, level) }));
  }
  return {
    name: 'Oyuncu',
    level,
    armor: Math.min(0.4, 0.012 * level),
    dealtMultiplier: Math.min(1.4, 1 + 0.015 * (level - 1)),
    wands: inv.resolver,
    ...(options.skills ? typicalSkills(level) : {}),
  };
}

export async function winRate(chapter: number, player: PlayerStats, playerSkill: number, runs: number, path?: FinalPath): Promise<number> {
  let wins = 0;
  for (let i = 0; i < runs; i++) {
    if ((await simulateBoss(chapter, player, { playerSkill, seed: 1000 + i * 7, path })).won) wins++;
  }
  return wins / runs;
}

/**
 * Seviyeye göre tipik yetenek dağılımı: puanlar (2 × (seviye−1)) önce ateşe (oyuncu vekili en çok ateş seçer), sonra su, toprak ve havaya
 * dağıtılır; her yeteneğin bir seviyesi önce, sonra ikinci, sonra üçüncü alınır. Gerçek oyuncu farklı dağıtır; amaç ortalama gücü ölçmektir.
 */
export function typicalSkills(level: number): { spells: SpellResolver; passives: Passives } {
  const tree = new SkillTree(() => level);
  const order = (['fire', 'water', 'earth', 'air'] as const).flatMap((el) => skillsOf(el).map((s) => s.id));
  for (let round = 0; round < 3; round++) for (const id of order) if (tree.level(id) === round) tree.learn(id);
  return { spells: tree.resolver, passives: tree.passives };
}

/** Dünya düşmanına karşı vekil oyuncu simülasyonu: oyuncunun kalan canı ve savaş süresi de döner. */
export async function simulateEnemy(
  element: Element,
  tier: Tier,
  player: PlayerStats,
  options: { playerSkill: number; seed: number; tune?: { hp?: number; power?: number } },
): Promise<{ won: boolean; cycles: number; hpLeft: number; maxHp: number }> {
  const rand = mulberry32(options.seed);
  const inits = enemyFighters(element, tier, player).map((f) => (f.team === 1 ? { ...f, maxHp: Math.round((f.maxHp ?? 0) * (options.tune?.hp ?? 1)), basePower: (f.basePower ?? 0) * (options.tune?.power ?? 1) } : f));
  const engine = new BattleEngine(inits, { maxCycles: MAX_CYCLES });
  const bots = new Map<string, Bot>();
  for (const f of engine.all()) {
    const k = `${f.team}:${f.index}`;
    if (f.control === 'human') bots.set(k, new Bot(rand, options.playerSkill, { elements: { fire: 2, water: 1, earth: 1, air: 1 } }));
    else bots.set(k, new Bot(rand, f.ai?.skill ?? 0.5, f.ai ?? {}));
  }
  const botFor = (ref: SlotRef): Bot => bots.get(`${ref.team}:${ref.index}`)!;
  const io: BattleIO = {
    announceTurn: async () => {},
    chooseElement: async (ref) => botFor(ref).chooseElement(),
    revealRound: async () => {},
    draw: async (ref, role, ghost) => (role === 'attack' ? botFor(ref).drawAttack() : botFor(ref).drawDefense(ghost)),
    play: async (r) => void botFor(r.action.defender).onDamaged(r.damage, engine.fighter(r.action.defender).maxHp),
    announceEnd: async () => {},
  };
  const winner = await runBattle(engine, io, { random: rand });
  return { won: winner === 0, cycles: engine.cycle, hpLeft: engine.fighter({ team: 0, index: 0 }).hp, maxHp: engine.fighter({ team: 0, index: 0 }).maxHp };
}
