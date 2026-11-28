import type { Element } from '../battle/damage/elements';
import type { BotProfile } from '../battle/flow/bot';
import type { FighterInit } from '../battle/flow/engine';
import type { GearResolver } from '../economy/gearEffects';
import type { WandResolver } from '../wands/inventory';
import type { Passives, SpellResolver } from '../skills/resolver';
import { skillResolvers } from '../enemies/skills';
import type { ChoiceLine } from '../morality/catalog';
import { elysiaFightsAlongside } from '../story/elysia';
import type { FinalPath } from '../morality/morality';

/**
 * Bölüm sonu boss savaşları (docs/hikaye.md bölüm 4). Sayılar denge için ayarlanabilir; her boss için
 * hedeflenen oyuncu seviyesi `targetLevel` ile belirtilir (denge testi bunu doğrular).
 */

export interface BossFoe {
  name: string;
  hp: number;
  /** Büyünün taban gücü (oyuncununki 100) */
  basePower: number;
  /** Toplam zırhtan gelen hasar azaltma (0-1) */
  armor: number;
  /** Savunma becerisi (0-1) */
  skill: number;
  elements?: Partial<Record<Element, number>>;
  attackScale?: number;
  /** Bossun yetenekleri (yetenek kimliği → seviye); oyuncuya karşı kullanılır. Verilmezse yeteneksiz. */
  skills?: Readonly<Record<string, number>>;
}

export interface BossGimmick {
  /** Gelen saldırı savunma tuvalinde soluk gösterilmez (sis, yanılsama) */
  hideGhost?: boolean;
  /** Bu döngüden itibaren oyuncunun çizim tuvali bulanıklaşır (zihin kontrolü) */
  blurFromCycle?: number;
  /** Oyuncuya gösterilen kısa açıklama */
  note: string;
}

export interface BossDef {
  chapter: number;
  id: string;
  /** Savaş başlığı */
  title: string;
  foes: readonly BossFoe[];
  /** Karanlık Büyücü yolunda (yalnız bölüm 8) farklı düşman dizilişi */
  foesDark?: readonly BossFoe[];
  gimmick?: BossGimmick;
  /** Savaş başlamadan önce söylenen satırlar */
  intro: readonly ChoiceLine[];
  /** Ödül parası, bölümün şehrinin/köyünün para biriminde (bkz. economy/currency.ts) */
  reward: { money: number; xp: number };
  /** Hedeflenen oyuncu seviyesi (yetenek ve asalarla birlikte) */
  targetLevel: number;
  /** Döngü sınırı (uzun savaşlar için artırılır) */
  maxCycles?: number;
}

/** Malakor dört elementin sahibidir: her elementten iki yetenek, Sv 2 */
const MALAKOR_SKILLS = { 'fire-burn': 2, 'fire-scars': 2, 'water-chill': 2, 'earth-quake': 2, 'air-tremor': 2, 'air-edge': 2 } as const;

export const BOSSES: readonly BossDef[] = [
  {
    chapter: 1,
    id: 'vael',
    title: 'General Vael',
    foes: [{ name: 'General Vael', hp: 470, basePower: 135, armor: 0, skill: 0.25, elements: { fire: 1 }, attackScale: 1.15 }],
    intro: [{ speaker: 'General Vael', text: 'Bir çırak mı? Küle döneceksin! Alevlerim senden büyük!' }],
    reward: { money: 120, xp: 110 },
    targetLevel: 1,
  },
  {
    chapter: 2,
    id: 'ambargo-komutani',
    title: 'Ambargo Komutanı',
    foes: [{ name: 'Ambargo Komutanı', hp: 490, basePower: 85, armor: 0.2, skill: 0.7, elements: { earth: 2, water: 1 }, skills: { 'earth-mud': 1, 'water-fog': 1 } }],
    intro: [{ speaker: 'Ambargo Komutanı', text: 'Kervan yolu benim. Geçmek istiyorsan önce beni aşacaksın.' }],
    reward: { money: 160, xp: 150 },
    targetLevel: 4,
  },
  {
    chapter: 3,
    id: 'tapinak-bekcisi',
    title: 'Tapınak Bekçisi (2v2)',
    foes: [
      { name: 'Tapınak Bekçisi', hp: 534, basePower: 110, armor: 0.15, skill: 0.55, elements: { air: 3, water: 1 }, skills: { 'air-tremor': 1, 'air-gale': 1 } },
      { name: 'Rüzgâr Çırağı', hp: 407, basePower: 100, armor: 0.05, skill: 0.5, elements: { air: 2, fire: 1 }, skills: { 'air-edge': 1 } },
    ],
    intro: [
      { speaker: 'Tapınak Bekçisi', text: 'Kutsal toprağa iki yabancı! Rüzgâr sizi geri üfleyecek.' },
      { speaker: 'Elysia', text: 'Hazırım. Sıranı bekle, birlikte vuracağız!' },
    ],
    reward: { money: 220, xp: 200 },
    targetLevel: 5,
  },
  {
    chapter: 4,
    id: 'soylu-sampiyonu',
    title: 'Soylu Şampiyonu',
    foes: [{ name: 'Soylu Şampiyonu', hp: 700, basePower: 85, armor: 0.3, skill: 0.55, elements: { earth: 2, air: 1 }, skills: { 'earth-quake': 1, 'earth-bulwark': 1, 'earth-mud': 1 } }],
    intro: [{ speaker: 'Soylu Şampiyonu', text: 'Ailemi tehdit eden sensin. Zırhımı delecek büyü henüz doğmadı.' }],
    reward: { money: 280, xp: 250 },
    targetLevel: 7,
  },
  {
    chapter: 5,
    id: 'kaelen',
    title: 'General Kaelen',
    foes: [{ name: 'General Kaelen', hp: 880, basePower: 95, armor: 0.25, skill: 0.6, elements: { earth: 4, fire: 1 }, skills: { 'earth-quake': 2, 'earth-mud': 2, 'earth-bulwark': 2, 'earth-armor': 1 } }],
    intro: [{ speaker: 'General Kaelen', text: 'Taş çökmez. Sabrım, senin gücünden uzun sürer.' }],
    reward: { money: 360, xp: 330 },
    targetLevel: 10,
    maxCycles: 60,
  },
  {
    chapter: 6,
    id: 'morga',
    title: 'Cadı Morga',
    foes: [{ name: 'Cadı Morga', hp: 700, basePower: 110, armor: 0.15, skill: 0.6, elements: { water: 2, earth: 2 }, skills: { 'water-fog': 2, 'water-chill': 2, 'water-mirror': 1, 'earth-mud': 1 } }],
    gimmick: { hideGhost: true, note: 'Sis yanılsama yaratıyor: gelen saldırıyı savunurken göremezsin.' },
    intro: [{ speaker: 'Cadı Morga', text: 'Sis her şeyi gizler, çırak. Sınavımı geç, o zaman konuşuruz.' }],
    reward: { money: 420, xp: 400 },
    targetLevel: 12,
  },
  {
    chapter: 7,
    id: 'morwenna',
    title: 'General Morwenna',
    foes: [{ name: 'General Morwenna', hp: 1166, basePower: 108, armor: 0.2, skill: 0.65, elements: { water: 4, air: 1 }, skills: { 'water-fog': 2, 'water-chill': 2, 'water-mirror': 2, 'water-bubble': 2 } }],
    gimmick: { blurFromCycle: 3, note: 'Zihin kontrolü: savaş ilerledikçe çizim tuvali bulanıklaşır.' },
    intro: [{ speaker: 'General Morwenna', text: 'Zihnin benim oyuncağım olacak. Elysia gibi...' }],
    reward: { money: 500, xp: 480 },
    targetLevel: 17,
  },
  {
    chapter: 8,
    id: 'malakor',
    title: 'Malakor, Gölge Hükümdarı',
    foes: [
      { name: 'Malakor', hp: 1720, basePower: 115, armor: 0.2, skill: 0.75, attackScale: 1.1, skills: MALAKOR_SKILLS },
      { name: 'Gölge', hp: 680, basePower: 95, armor: 0.1, skill: 0.55, skills: { 'fire-burn': 1, 'air-tremor': 1 } },
    ],
    foesDark: [{ name: 'Malakor', hp: 974, basePower: 110, armor: 0.2, skill: 0.7, attackScale: 1.1, skills: MALAKOR_SKILLS }],
    intro: [{ speaker: 'Malakor', text: 'Dört elementin sahibi karşında. Gel, gölgeme katıl ya da sön.' }],
    reward: { money: 900, xp: 900 },
    targetLevel: 20,
    maxCycles: 60,
  },
];

const BY_CHAPTER = new Map(BOSSES.map((b) => [b.chapter, b]));

export const getBoss = (chapter: number): BossDef | undefined => BY_CHAPTER.get(chapter);

import { HP_PER_LEVEL, playerMaxHp } from '../economy/health';
export { HP_PER_LEVEL, playerMaxHp };

import type { HeroGear } from '../battle/arena/heroModel';

export interface PlayerStats {
  name: string;
  level: number;
  /** Savaşa başlarkenki can (verilmezse dolu). Boss her zaman tam canla başlar. */
  hp?: number;
  /** Toplam zırhtan gelen hasar azaltma */
  armor: number;
  /** Ekipmandan gelen verilen / alınan hasar çarpanı (1 = etkisiz); yetenek ve asalar `spells`/`wands` ile gelir */
  dealtMultiplier?: number;
  takenMultiplier?: number;
  spells?: SpellResolver;
  /** Pasif yetenekler (Yanık İzi) */
  passives?: Passives;
  wands?: WandResolver;
  /** Ekipman (zırh ve yüzük) çözücüsü; verilirse `armor` yerine kullanılır (büyünün elementine göre) */
  gear?: GearResolver;
  /** Faz 7: görünüm: kuşanılan ekipman (savaşta oyuncunun modelinde görünür) */
  look?: HeroGear;
}

/** Yoldaşın (Elysia) ayarları */
export const ELYSIA_ALLY = { hp: 300, basePower: 100, skill: 0.7 } as const;

/** Bu savaştaki düşmanlar (bölüm 8'de yola göre değişir). */
export function bossFoes(boss: BossDef, path: FinalPath = 'order'): readonly BossFoe[] {
  return path === 'dark' && boss.foesDark ? boss.foesDark : boss.foes;
}

/**
 * Boss savaşının dövüşçüleri: takım 0 = oyuncu (+ Elysia, 3. bölümde ve Düzen Bekçisi yolunda 8. bölümde),
 * takım 1 = bosslar. Oyuncunun canı seviyeyle, zırhı ekipmanla, büyü etkileri yetenek ve asalarla gelir.
 */
export function bossFighters(chapter: number, player: PlayerStats, path: FinalPath = 'order'): FighterInit[] {
  const boss = getBoss(chapter);
  if (!boss) throw new Error(`Bu bölümde boss yok: ${chapter}`);
  const fighters: FighterInit[] = [
    {
      name: player.name,
      team: 0,
      control: 'human',
      maxHp: playerMaxHp(player.level),
      hp: player.hp,
      armor: player.armor,
      gear: player.gear,
      dealtMultiplier: player.dealtMultiplier,
      takenMultiplier: player.takenMultiplier,
      spells: player.spells,
      passives: player.passives,
      wands: player.wands,
    },
  ];
  if (elysiaFightsAlongside(chapter, path)) {
    fighters.push({ name: 'Elysia', team: 0, control: 'bot', persona: 'elysia', maxHp: ELYSIA_ALLY.hp, basePower: ELYSIA_ALLY.basePower, ai: { skill: ELYSIA_ALLY.skill } });
  }
  for (const foe of bossFoes(boss, path)) {
    const ai: BotProfile = { skill: foe.skill, elements: foe.elements, attackScale: foe.attackScale };
    const skills = foe.skills ? skillResolvers(new Map(Object.entries(foe.skills))) : null;
    fighters.push({ name: foe.name, team: 1, control: 'bot', maxHp: foe.hp, basePower: foe.basePower, armor: foe.armor, ai, ...(skills ? { spells: skills.spells, passives: skills.passives } : {}) });
  }
  return fighters;
}
