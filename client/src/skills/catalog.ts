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
}

export type EffectKey = keyof SkillEffect;
export const EFFECT_KEYS: readonly EffectKey[] = ['burnChance', 'burnDamage', 'shieldBreak', 'chainBonus', 'scatter', 'scars', 'chillChance', 'chillSec', 'lifesteal', 'reflect', 'fog'];

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
  if (fx.scars) out.push(`rakibin çizim ekranında ${fx.scars} yara izi; dokunursa 0.2 sn kaybeder`);
  if (fx.chillChance) out.push(`${pct(fx.chillChance)} ihtimalle rakibi yavaşlatır`);
  if (fx.chillSec) out.push(`yavaşlayan rakibin sonraki çizim süresi ${fx.chillSec} sn kısalır`);
  if (fx.lifesteal) out.push(`verdiğin hasarın ${pct(fx.lifesteal)} kadarı sana can olarak döner`);
  if (fx.reflect) out.push(`savunmanın tuttuğu hasarın ${pct(fx.reflect)} kadarı saldırana yansır`);
  if (fx.fog) out.push(`rakibin savunma ekranında ${fx.fog} sis bulutu; botların savunması zayıflar`);
  return out;
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
    summary: 'Pasif: rakip saldırı büyüsü çizerken ekranında küçük yara izleri belirir; izlere dokunursa ekran kızarır ve 0.2 sn kaybeder.',
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
