import type { Element } from '../battle/damage/elements';
import type { BotProfile } from '../battle/flow/bot';
import type { FighterInit } from '../battle/flow/engine';
import type { GearResolver } from '../economy/gearEffects';
import type { WandResolver } from '../wands/inventory';
import type { SpellResolver } from '../skills/resolver';
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
  reward: { gold: number; xp: number };
  /** Hedeflenen oyuncu seviyesi (yetenek ve asalarla birlikte) */
  targetLevel: number;
  /** Döngü sınırı (uzun savaşlar için artırılır) */
  maxCycles?: number;
}

export const BOSSES: readonly BossDef[] = [
  {
    chapter: 1,
    id: 'vael',
    title: 'General Vael',
    foes: [{ name: 'General Vael', hp: 310, basePower: 115, armor: 0, skill: 0.25, elements: { fire: 1 }, attackScale: 1.15 }],
    intro: [{ speaker: 'General Vael', text: 'Bir çırak mı? Küle döneceksin! Alevlerim senden büyük!' }],
    reward: { gold: 120, xp: 110 },
    targetLevel: 1,
  },
  {
    chapter: 2,
    id: 'ambargo-komutani',
    title: 'Ambargo Komutanı',
    foes: [{ name: 'Ambargo Komutanı', hp: 300, basePower: 85, armor: 0.2, skill: 0.7, elements: { earth: 2, water: 1 } }],
    intro: [{ speaker: 'Ambargo Komutanı', text: 'Kervan yolu benim. Geçmek istiyorsan önce beni aşacaksın.' }],
    reward: { gold: 160, xp: 150 },
    targetLevel: 4,
  },
  {
    chapter: 3,
    id: 'tapinak-bekcisi',
    title: 'Tapınak Bekçisi (2v2)',
    foes: [
      { name: 'Tapınak Bekçisi', hp: 420, basePower: 110, armor: 0.15, skill: 0.55, elements: { air: 3, water: 1 } },
      { name: 'Rüzgâr Çırağı', hp: 320, basePower: 100, armor: 0.05, skill: 0.5, elements: { air: 2, fire: 1 } },
    ],
    intro: [
      { speaker: 'Tapınak Bekçisi', text: 'Kutsal toprağa iki yabancı! Rüzgâr sizi geri üfleyecek.' },
      { speaker: 'Elysia', text: 'Hazırım. Sıranı bekle, birlikte vuracağız!' },
    ],
    reward: { gold: 220, xp: 200 },
    targetLevel: 5,
  },
  {
    chapter: 4,
    id: 'soylu-sampiyonu',
    title: 'Soylu Şampiyonu',
    foes: [{ name: 'Soylu Şampiyonu', hp: 540, basePower: 85, armor: 0.35, skill: 0.55, elements: { earth: 2, air: 1 } }],
    intro: [{ speaker: 'Soylu Şampiyonu', text: 'Ailemi tehdit eden sensin. Zırhımı delecek büyü henüz doğmadı.' }],
    reward: { gold: 280, xp: 250 },
    targetLevel: 7,
  },
  {
    chapter: 5,
    id: 'kaelen',
    title: 'General Kaelen',
    foes: [{ name: 'General Kaelen', hp: 580, basePower: 95, armor: 0.25, skill: 0.6, elements: { earth: 4, fire: 1 } }],
    intro: [{ speaker: 'General Kaelen', text: 'Taş çökmez. Sabrım, senin gücünden uzun sürer.' }],
    reward: { gold: 360, xp: 330 },
    targetLevel: 10,
    maxCycles: 60,
  },
  {
    chapter: 6,
    id: 'morga',
    title: 'Cadı Morga',
    foes: [{ name: 'Cadı Morga', hp: 560, basePower: 110, armor: 0.15, skill: 0.6, elements: { water: 2, earth: 2 } }],
    gimmick: { hideGhost: true, note: 'Sis yanılsama yaratıyor: gelen saldırıyı savunurken göremezsin.' },
    intro: [{ speaker: 'Cadı Morga', text: 'Sis her şeyi gizler, çırak. Sınavımı geç, o zaman konuşuruz.' }],
    reward: { gold: 420, xp: 400 },
    targetLevel: 12,
  },
  {
    chapter: 7,
    id: 'morwenna',
    title: 'General Morwenna',
    foes: [{ name: 'General Morwenna', hp: 560, basePower: 108, armor: 0.2, skill: 0.65, elements: { water: 4, air: 1 } }],
    gimmick: { blurFromCycle: 3, note: 'Zihin kontrolü: savaş ilerledikçe çizim tuvali bulanıklaşır.' },
    intro: [{ speaker: 'General Morwenna', text: 'Zihnin benim oyuncağım olacak. Elysia gibi...' }],
    reward: { gold: 500, xp: 480 },
    targetLevel: 17,
  },
  {
    chapter: 8,
    id: 'malakor',
    title: 'Malakor, Gölge Hükümdarı',
    foes: [
      { name: 'Malakor', hp: 760, basePower: 115, armor: 0.2, skill: 0.75, attackScale: 1.1 },
      { name: 'Gölge', hp: 340, basePower: 95, armor: 0.1, skill: 0.55 },
    ],
    foesDark: [{ name: 'Malakor', hp: 560, basePower: 110, armor: 0.2, skill: 0.7, attackScale: 1.1 }],
    intro: [{ speaker: 'Malakor', text: 'Dört elementin sahibi karşında. Gel, gölgeme katıl ya da sön.' }],
    reward: { gold: 900, xp: 900 },
    targetLevel: 20,
    maxCycles: 60,
  },
];

const BY_CHAPTER = new Map(BOSSES.map((b) => [b.chapter, b]));

export const getBoss = (chapter: number): BossDef | undefined => BY_CHAPTER.get(chapter);

import { HP_PER_LEVEL, playerMaxHp } from '../economy/health';
export { HP_PER_LEVEL, playerMaxHp };

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
  wands?: WandResolver;
  /** Ekipman (zırh ve yüzük) çözücüsü; verilirse `armor` yerine kullanılır (büyünün elementine göre) */
  gear?: GearResolver;
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
      wands: player.wands,
    },
  ];
  if (elysiaFightsAlongside(chapter, path)) {
    fighters.push({ name: 'Elysia', team: 0, control: 'bot', persona: 'elysia', maxHp: ELYSIA_ALLY.hp, basePower: ELYSIA_ALLY.basePower, ai: { skill: ELYSIA_ALLY.skill } });
  }
  for (const foe of bossFoes(boss, path)) {
    const ai: BotProfile = { skill: foe.skill, elements: foe.elements, attackScale: foe.attackScale };
    fighters.push({ name: foe.name, team: 1, control: 'bot', maxHp: foe.hp, basePower: foe.basePower, armor: foe.armor, ai });
  }
  return fighters;
}
