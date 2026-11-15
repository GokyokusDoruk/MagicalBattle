import type { Element } from '../battle/damage/elements';

/**
 * Yetenek ağacı kataloğu (Task 42 ile baştan yazıldı): her elementin kendi yetenekleri vardır (ateş 5, diğerleri 4).
 * Bir yeteneği açmak **1 puan**, her seviye artışı **1 puan** ister; her yeteneğin 3 seviyesi vardır (tam yetenek = 3 puan).
 * Eski yetenekler (Güç, Hassasiyet, Kalkan dalları) kalktı; eski kayıtlardaki puanlar otomatik iade olur.
 * Taşıyıcı dalı ayrıdır ve aynen kalır.
 */

export type SpellRole = 'attack' | 'defense';
export type Tier = 1 | 2 | 3;
export const TIERS: readonly Tier[] = [1, 2, 3];

/** Her karakter seviyesi (2'den itibaren) bu kadar yetenek puanı verir */
export const SP_PER_LEVEL = 2;
/** Bir yeteneğin en yüksek seviyesi */
export const MAX_SKILL_LEVEL = 3;
/** Bir yeteneği açmanın ve her seviyesini artırmanın bedeli */
export const SKILL_POINT_COST = 1;

/** Taşıyıcı dalı: bir kademenin yetenek puanı bedeli (1, 2, 3; toplam 6) */
export const TIER_COST: Record<Tier, number> = { 1: 1, 2: 2, 3: 3 };

/** Bir yeteneğin bir seviyede verdiği etkiler (verilmeyen etki 0'dır). */
export interface SkillEffect {
  /** Ateş: saldırının rakibi tutuşturma şansı (0-1) */
  burnChance?: number;
  /** Ateş: yanan rakibin her döngü yediği hasar */
  burnDamage?: number;
  /** Ateş: saldırının rakibin savunmasını kırma şansı (0-1) */
  shieldBreak?: number;
  /** Ateş: art arda atılan her önceki ateş büyüsü için son büyüye eklenen hasar oranı */
  chainBonus?: number;
  /** Ateş: büyünün savunmaya takılmadan geçen kısmı (0-1) */
  scatter?: number;
  /** Ateş (pasif): rakibin saldırı çizerken ekranında beliren yara izi sayısı */
  scars?: number;
  /** Su: saldırının rakibi yavaşlatma (soğutma) şansı (0-1) */
  chillChance?: number;
  /** Su: yavaşlayan rakibin bir sonraki çiziminden kesilen süre (sn) */
  chillSec?: number;
  /** Su: verilen hasarın can olarak geri dönen oranı */
  lifesteal?: number;
  /** Su: savunmanın tuttuğu hasarın saldırana geri yansıyan oranı */
  reflect?: number;
  /** Su: rakibin savunma ekranını kaplayan sis bulutu sayısı (botlarda savunmayı zayıflatır) */
  fog?: number;
  /** Toprak: her toprak savunmasında kalıcı olarak eklenen zırh (0-1); savaş boyunca birikir */
  armorStack?: number;
  /** Toprak: saldırı savunmayı %80 ve üstü aşarsa rakibin sıradaki saldırısını atlatma şansı */
  stunChance?: number;
  /** Toprak: toprak savunmasında alınan hasarın azalma oranı */
  guard?: number;
  /** Toprak: rakibin savunma ekranındaki çamur yaması sayısı (içine çizilemez; botların savunması zayıflar) */
  mud?: number;
  /** Hava: büyünün çizim süresine eklenen saniye (saldırıda ve savunmada) */
  timeBonus?: number;
  /** Hava: kritik vuruş şansına eklenen oran (0-1) */
  critBonus?: number;
  /** Hava: savunmanın tuttuğu hasarın saldırana geri savrulma şansı ve oranı */
  reboundChance?: number;
  reboundShare?: number;
  /** Hava (pasif): rakip saldırı çizerken ekran sarsıntısı şiddeti (1-3) */
  shake?: number;
}

export type EffectKey = keyof SkillEffect;
export const EFFECT_KEYS: readonly EffectKey[] = ['burnChance', 'burnDamage', 'shieldBreak', 'chainBonus', 'scatter', 'scars', 'chillChance', 'chillSec', 'lifesteal', 'reflect', 'fog', 'armorStack', 'stunChance', 'guard', 'mud', 'timeBonus', 'critBonus', 'reboundChance', 'reboundShare', 'shake'];

export interface SkillDef {
  id: string;
  element: Element;
  name: string;
  /** Tek cümlelik ne yaptığı */
  summary: string;
  /** Pasif yetenekler büyü elementinden bağımsız her zaman işler */
  passive?: boolean;
  /** 1., 2. ve 3. seviyedeki etkiler */
  levels: readonly [SkillEffect, SkillEffect, SkillEffect];
}

const pct = (v: number): string => `%${Math.round(v * 100)}`;

/** Bir yeteneğin bir seviyedeki etkilerinin kısa Türkçe açıklaması. */
export function describeEffect(fx: SkillEffect): string[] {
  const out: string[] = [];
  if (fx.burnChance) out.push(`${pct(fx.burnChance)} ihtimalle rakibi tutuşturur`);
  if (fx.burnDamage) out.push(`yanan rakip her döngü ${fx.burnDamage} hasar yer`);
  if (fx.shieldBreak) out.push(`${pct(fx.shieldBreak)} ihtimalle rakibin kalkanını kırar`);
  if (fx.chainBonus) out.push(`art arda her ateş büyüsü için +${pct(fx.chainBonus)} hasar (en çok 3 kez)`);
  if (fx.scatter) out.push(`büyünün ${pct(fx.scatter)} kısmı savunmaya takılmadan geçer`);
  if (fx.scars) out.push(`rakibin saldırı çizim ekranında ${fx.scars} yara izi belirir (görüşü kısmen örter)`);
  if (fx.chillChance) out.push(`${pct(fx.chillChance)} ihtimalle rakibi yavaşlatır`);
  if (fx.chillSec) out.push(`yavaşlayan rakibin sonraki çizim süresi ${fx.chillSec} sn kısalır`);
  if (fx.lifesteal) out.push(`verdiğin hasarın ${pct(fx.lifesteal)} kadarı sana can olarak döner`);
  if (fx.reflect) out.push(`savunmanın tuttuğu hasarın ${pct(fx.reflect)} kadarı saldırana yansır`);
  if (fx.fog) out.push(`rakibin savunma ekranında ${fx.fog} sis bulutu; botların savunması zayıflar`);
  if (fx.armorStack) out.push(`her toprak savunmasında savaş boyunca kalıcı +${pct(fx.armorStack)} zırh (birikir)`);
  if (fx.stunChance) out.push(`saldırın savunmayı %80+ aşarsa ${pct(fx.stunChance)} ihtimalle rakibin sıradaki saldırısı atlanır`);
  if (fx.guard) out.push(`toprak savunmasında alınan hasar -${pct(fx.guard)}`);
  if (fx.mud) out.push(`rakibin savunma ekranında ${fx.mud} çamur yaması; içine çizilemez, botların savunması zayıflar`);
  if (fx.timeBonus) out.push(`büyü çizim süresi +${fx.timeBonus} sn`);
  if (fx.critBonus) out.push(`kritik vuruş şansı +${pct(fx.critBonus)}`);
  if (fx.reboundChance) out.push(`${pct(fx.reboundChance)} ihtimalle savunmanın tuttuğu hasarın ${pct(fx.reboundShare ?? 0)} kadarı saldırana geri savrulur`);
  if (fx.shake) out.push(`rakip saldırı çizerken ekranı sarsılır (şiddet ${fx.shake})`);
  return out;
}

/**
 * Asa seviyesine bağlı pasifler (Yanık İzi, Sarsıntılı Rüzgâr): yetenek puanıyla alınmaz ya da geliştirilmez; ilgili elementin asası kuşanılınca
 * asanın seviyesine göre 3 kademeden biri işler. Asa seviyesi 1-9: kademe 1, 10-19: kademe 2, 20 ve üstü: kademe 3.
 */
export const WAND_PASSIVE_LEVEL_STEPS: readonly [number, number, number] = [1, 10, 20];

/** Asanın seviyesinden pasif kademesi (1-3). */
export function passiveTierForWandLevel(wandLevel: number): 1 | 2 | 3 {
  if (wandLevel >= WAND_PASSIVE_LEVEL_STEPS[2]) return 3;
  return wandLevel >= WAND_PASSIVE_LEVEL_STEPS[1] ? 2 : 1;
}

export const SKILLS: readonly SkillDef[] = [
  {
    id: 'fire-burn',
    element: 'fire',
    name: 'Közleyen Alev',
    summary: 'Ateş saldırıları rakibi yakar: yanan rakip savaşın sonuna kadar her döngü hasar yer (birikmez).',
    levels: [
      { burnChance: 0.15, burnDamage: 6 },
      { burnChance: 0.25, burnDamage: 9 },
      { burnChance: 0.4, burnDamage: 12 },
    ],
  },
  {
    id: 'fire-breaker',
    element: 'fire',
    name: 'Kalkan Kıran',
    summary: 'Ateş saldırıları rakibin kalkanını (savunma büyüsünün hasar azaltmasını) kırabilir; kırılan kalkan çok daha az korur.',
    levels: [{ shieldBreak: 0.2 }, { shieldBreak: 0.35 }, { shieldBreak: 0.5 }],
  },
  {
    id: 'fire-chain',
    element: 'fire',
    name: 'Alev Zinciri',
    summary: 'Art arda ateş büyüsü yaparsan son atılan büyü daha çok hasar verir.',
    levels: [{ chainBonus: 0.08 }, { chainBonus: 0.12 }, { chainBonus: 0.16 }],
  },
  {
    id: 'fire-scatter',
    element: 'fire',
    name: 'Kıvılcım Saçması',
    summary: 'Ateş büyüsü saçılarak saldırır: savunma tam kapatsa bile büyünün bir kısmı kalkanı aşar.',
    levels: [{ scatter: 0.15 }, { scatter: 0.25 }, { scatter: 0.35 }],
  },
  {
    id: 'fire-scars',
    element: 'fire',
    name: 'Yanık İzi',
    summary: 'Pasif (puanla alınmaz): ateş asası kuşanınca rakip saldırı çizerken ekranında yara izleri belirir ve bir kısmını örter. Asanın seviyesi arttıkça gelişir.',
    passive: true,
    levels: [{ scars: 1 }, { scars: 2 }, { scars: 3 }],
  },
  {
    id: 'water-chill',
    element: 'water',
    name: 'Buz Nefesi',
    summary: 'Su saldırıları rakibi yavaşlatabilir: yavaşlayan rakibin bir sonraki büyü çizim süresi kısalır (birikmez).',
    levels: [
      { chillChance: 0.25, chillSec: 0.3 },
      { chillChance: 0.4, chillSec: 0.5 },
      { chillChance: 0.55, chillSec: 0.7 },
    ],
  },
  {
    id: 'water-bubble',
    element: 'water',
    name: 'Şifa Kabarcıkları',
    summary: 'Su saldırıların verdiği hasarın bir kısmı su kabarcıkları olarak sana can verir.',
    levels: [{ lifesteal: 0.08 }, { lifesteal: 0.14 }, { lifesteal: 0.2 }],
  },
  {
    id: 'water-mirror',
    element: 'water',
    name: 'Yansıyan Dalga',
    summary: 'Su savunman, kalkanının tuttuğu hasarın bir kısmını saldırana geri yollar.',
    levels: [{ reflect: 0.15 }, { reflect: 0.25 }, { reflect: 0.35 }],
  },
  {
    id: 'water-fog',
    element: 'water',
    name: 'Sis Perdesi',
    summary: 'Su saldırısı rakibin savunma ekranını sisle kaplar; botlar sisin içinde zayıf savunur.',
    levels: [{ fog: 1 }, { fog: 2 }, { fog: 3 }],
  },
  {
    id: 'earth-armor',
    element: 'earth',
    name: 'Taş Kabuk',
    summary: 'Her toprak savunmanda kalıcı zırh kazanırsın; zırh savaş bitene kadar birikir ve her büyüye karşı işler.',
    levels: [{ armorStack: 0.02 }, { armorStack: 0.03 }, { armorStack: 0.04 }],
  },
  {
    id: 'earth-quake',
    element: 'earth',
    name: 'Sarsıntı',
    summary: 'Toprak saldırın savunmayı %80 ve üstü aşarsa rakip sersemleyebilir: sıradaki saldırısını yapamaz.',
    levels: [{ stunChance: 0.35 }, { stunChance: 0.55 }, { stunChance: 0.8 }],
  },
  {
    id: 'earth-bulwark',
    element: 'earth',
    name: 'Dağ Kalkanı',
    summary: 'Toprak savunman çok daha sağlamdır: alınan hasar belirgin azalır.',
    levels: [{ guard: 0.1 }, { guard: 0.18 }, { guard: 0.26 }],
  },
  {
    id: 'earth-mud',
    element: 'earth',
    name: 'Çamur Yaması',
    summary: 'Toprak saldırısı rakibin savunma ekranına çamur yamaları döker; içlerine çizilemez, botlar çamurda zayıf savunur.',
    levels: [{ mud: 1 }, { mud: 2 }, { mud: 3 }],
  },
  {
    id: 'air-gale',
    element: 'air',
    name: 'Fırtına Nefesi',
    summary: 'Hava büyülerini çizmek için daha çok zamanın olur (saldırıda ve savunmada).',
    levels: [{ timeBonus: 0.3 }, { timeBonus: 0.5 }, { timeBonus: 0.8 }],
  },
  {
    id: 'air-edge',
    element: 'air',
    name: 'Keskin Esinti',
    summary: 'Hava saldırıların kritik vuruş (×1.5) şansı artar.',
    levels: [{ critBonus: 0.08 }, { critBonus: 0.14 }, { critBonus: 0.2 }],
  },
  {
    id: 'air-rebound',
    element: 'air',
    name: 'Geri Esen Rüzgâr',
    summary: 'Hava savunman, kalkanın tuttuğu büyünün bir kısmını çoğu zaman saldırana geri savurur.',
    levels: [
      { reboundChance: 0.5, reboundShare: 0.06 },
      { reboundChance: 0.65, reboundShare: 0.08 },
      { reboundChance: 0.8, reboundShare: 0.1 },
    ],
  },
  {
    id: 'air-tremor',
    element: 'air',
    name: 'Sarsıntılı Rüzgâr',
    summary: 'Pasif (puanla alınmaz): hava asası kuşanınca rakip saldırı çizerken ekranı sarsılır. Asanın seviyesi arttıkça gelişir.',
    passive: true,
    levels: [{ shake: 1 }, { shake: 2 }, { shake: 3 }],
  },
];

const BY_ID = new Map(SKILLS.map((s) => [s.id, s]));
export const getSkill = (id: string): SkillDef | undefined => BY_ID.get(id);
export const skillsOf = (element: Element): SkillDef[] => SKILLS.filter((s) => s.element === element);

/** Bir yeteneğin `level` (1-3) seviyesindeki etkisi; geçersizse boş. */
export const effectAt = (skill: SkillDef, level: number): SkillEffect => skill.levels[Math.min(MAX_SKILL_LEVEL, Math.max(1, Math.floor(level))) - 1] ?? {};

/** Taşıyıcı dalı: element dallarından ayrı, taşıma kapasitesini artıran 3 kademe (1, 2, 3 puan). */
export interface CarrySkillDef {
  id: string;
  tier: Tier;
  name: string;
  cost: number;
  /** Bu kademenin kapasiteye kattığı (kademeler toplanır) */
  bonus: { wands: number; goods: number; gear: number };
}

export const CARRY_SKILLS: readonly CarrySkillDef[] = [
  { id: 'carry-1', tier: 1, name: 'Sağlam Omuzlar', cost: TIER_COST[1], bonus: { wands: 1, goods: 10, gear: 1 } },
  { id: 'carry-2', tier: 2, name: 'Düzenli Çanta', cost: TIER_COST[2], bonus: { wands: 1, goods: 15, gear: 1 } },
  { id: 'carry-3', tier: 3, name: 'Yük Ustası', cost: TIER_COST[3], bonus: { wands: 2, goods: 25, gear: 2 } },
];

export const getCarrySkill = (id: string): CarrySkillDef | undefined => CARRY_SKILLS.find((s) => s.id === id);
