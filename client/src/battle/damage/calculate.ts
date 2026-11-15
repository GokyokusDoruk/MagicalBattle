import { CELL, DRAW_TIME_MS, GRID } from '../gesture/config';
import type { DensityMap, SpellMetrics } from '../gesture/types';
import { matchDefense } from '../match/defense';
import {
  ARMOR_CAP,
  CRIT_MULTIPLIER,
  FULL_POWER_COVERAGE,
  HEAD_ZONE_FRACTION,
  HEADSHOT_MULTIPLIER,
  MIN_EFFORT_FACTOR,
} from './config';
import { elementMultiplier, elementRelation, type Element, type ElementRelation } from './elements';

export interface DamageInput {
  /** Büyünün taban gücü (asa ve seviyeden gelir) */
  basePower: number;
  /** Saldırının çizimi */
  attack: { density: DensityMap; metrics: SpellMetrics };
  /** Savunmanın yoğunluk haritası; büyü yapılamadıysa null */
  defense: DensityMap | null;
  attackerElement: Element;
  defenderElement: Element;
  /** Saldıranın skill ve ekipmanlarından gelen "verilen hasar" çarpanı (1 = etkisiz, 1.2 = +%20) */
  attackerDealtMultiplier?: number;
  /** Savunanın skill ve ekipmanlarından gelen "alınan hasar" çarpanı (1 = etkisiz, 0.9 = -%10) */
  defenderTakenMultiplier?: number;
  /** Savunanın toplam zırhından gelen hasar azaltma (0-1); üst sınırı ARMOR_CAP */
  defenderArmor?: number;
  /** Saldıranın yeteneklerinden: rakip zırhının yok sayılan oranı (0-1) */
  attackerArmorPierce?: number;
  /** Saldıranın yeteneklerinden: baş çarpanına eklenen değer (0.1: x1.5 yerine x1.6) */
  attackerHeadBonus?: number;
  /** Saldıranın yeteneklerinden: aceleyle çizimde güç tabanına eklenen değer */
  attackerEffortBonus?: number;
  /** Saldırı çizimine tanınan süre (sn); asa süreyi uzatır. Verilmezse temel süre (3 sn). Aceleyle çizim, tanınan süreye göre ölçülür. */
  attackerDrawTimeSec?: number;
  /** Bu vuruş kritik mi (zarı çağıran atar): hasar ×1.5 */
  critical?: boolean;
  /** Detay ekranı için: çarpanların kaynağı ve değeri (ekipman, yetenek, zincir...). Hesaba etkisi yoktur, hasar `attackerDealtMultiplier` ile `defenderTakenMultiplier`dan gelir. */
  multiplierParts?: readonly MultiplierPart[];
  /** Ateş yetenekleri (Kıvılcım Saçması, kırılan kalkan): savunmanın tuttuğu kısmın bu oranı yok sayılır (0-1) */
  defenseBypass?: number;
}

/** Hasar çarpanının bir kaynağı ("Kuşanılan eşya (element bonusu)" ×1.12) */
export interface MultiplierPart {
  label: string;
  value: number;
}

export interface DamageBreakdown {
  /** Detay ekranı için çarpan kaynakları (verilmediyse boş) */
  multiplierParts: readonly MultiplierPart[];
  /** 1) Çizim gücü */
  powerFactor: { size: number; effort: number; total: number };
  power: number;
  /** 2) Savunma (`defenseBypass` uygulanmış etkin oran) */
  defendedRatio: number;
  /** Savunmanın yok sayılan oranı (0 = yok) */
  defenseBypass: number;
  /** Savunulmayan kısım (ağırlıkça, bölge çarpanı uygulanmadan), 0-1 */
  unblockedRatio: number;
  /** 3) Bölge: savunulmayan kısmın ne kadarı başa düştü (0-1) ve bölge çarpanıyla birlikte oran */
  headShare: number;
  weightedUnblockedRatio: number;
  afterRegion: number;
  /** 4) Element */
  elementRelation: ElementRelation;
  elementMultiplier: number;
  afterElement: number;
  /** 5) Skill ve ekipman */
  skillMultiplier: number;
  afterSkills: number;
  /** Kritik vuruş (×1.5) ve sonrası */
  critical: boolean;
  critMultiplier: number;
  afterCrit: number;
  /** 6) Zırh */
  armorReduction: number;
  afterArmor: number;
  /** Oyuncudan düşecek kesin hasar (tam sayı, en az 0) */
  finalDamage: number;
}

const clamp01 = (v: number): number => Math.min(1, Math.max(0, v));
const positive = (v: number | undefined, fallback: number): number =>
  typeof v === 'number' && Number.isFinite(v) && v >= 0 ? v : fallback;

/** Çizimin gücü: büyüklük ve çizime harcanan süre. Küçük ya da aceleyle çizilen büyü zayıf kalır. */
export function powerFactor(metrics: SpellMetrics, effortBonus = 0, limitSec = DRAW_TIME_MS / 1000): { size: number; effort: number; total: number } {
  const size = clamp01(metrics.coverage / FULL_POWER_COVERAGE);
  const timeUsed = clamp01(metrics.drawTimeSec / (limitSec > 0 ? limitSec : DRAW_TIME_MS / 1000));
  const floor = Math.min(1, MIN_EFFORT_FACTOR + positive(effortBonus, 0));
  const effort = floor + (1 - floor) * timeUsed;
  return { size, effort, total: size * effort };
}

/** Hücre satırının tuvalde rakibin başına denk gelip gelmediği. */
function isHeadRow(row: number): boolean {
  return (row + 0.5) * CELL < HEAD_ZONE_FRACTION * (GRID * CELL);
}

/**
 * Hasar hesabı, adım adım:
 * 1. Çizim gücü: taban güç × (büyüklük ve süre ağırlığı)
 * 2. Savunma: saldırının savunulmayan kısmı
 * 3. Bölge: savunulmayan kısım rakibin başına düştüyse ×1.5
 * 4. Element: üstünlük ×1.5 / dezavantaj ×0.5
 * 5. Skill ve ekipman: verilen ve alınan hasar çarpanları (bölgesel değil, genel); sonra kritik vuruş ×1.5
 * 6. Zırh: oyuncunun toplam zırhı tek bir azaltma yüzdesi (baş/gövde ayrımı yok)
 */
export function calculateDamage(input: DamageInput): DamageBreakdown {
  const factor = powerFactor(input.attack.metrics, input.attackerEffortBonus, input.attackerDrawTimeSec);
  const power = Math.max(0, input.basePower) * factor.total;

  const match = matchDefense(input.attack.density, input.defense);
  const total = match.totalAttackWeight;

  const bypass = clamp01(positive(input.defenseBypass, 0));
  let unblockedHead = 0;
  let unblockedBody = 0;
  for (let k = 0; k < match.unblocked.length; k++) {
    // Saçılan ya da kalkanı kırılan büyünün, savunmanın tuttuğu kısmının bir bölümü yine de geçer
    const open = match.unblocked[k] + bypass * match.blocked[k];
    if (isHeadRow(Math.floor(k / GRID))) unblockedHead += open;
    else unblockedBody += open;
  }
  const unblockedTotal = unblockedHead + unblockedBody;
  const unblockedRatio = total > 0 ? unblockedTotal / total : 0;
  const headShare = unblockedTotal > 0 ? unblockedHead / unblockedTotal : 0;
  const weightedUnblockedRatio = total > 0 ? (unblockedHead * (HEADSHOT_MULTIPLIER + positive(input.attackerHeadBonus, 0)) + unblockedBody) / total : 0;
  const afterRegion = power * weightedUnblockedRatio;

  const relation = elementRelation(input.attackerElement, input.defenderElement);
  const elementMult = elementMultiplier(input.attackerElement, input.defenderElement);
  const afterElement = afterRegion * elementMult;

  const skillMultiplier = positive(input.attackerDealtMultiplier, 1) * positive(input.defenderTakenMultiplier, 1);
  const afterSkills = afterElement * skillMultiplier;

  const armorBeforePierce = Math.min(ARMOR_CAP, clamp01(positive(input.defenderArmor, 0)));
  const armorReduction = armorBeforePierce * (1 - clamp01(positive(input.attackerArmorPierce, 0)));
  const critical = input.critical === true;
  const critMultiplier = critical ? CRIT_MULTIPLIER : 1;
  const afterCrit = afterSkills * critMultiplier;
  const afterArmor = afterCrit * (1 - armorReduction);

  return {
    multiplierParts: input.multiplierParts ?? [],
    powerFactor: factor,
    power,
    defendedRatio: match.defendedRatio * (1 - bypass),
    defenseBypass: bypass,
    unblockedRatio,
    headShare,
    weightedUnblockedRatio,
    afterRegion,
    elementRelation: relation,
    elementMultiplier: elementMult,
    afterElement,
    skillMultiplier,
    afterSkills,
    critical,
    critMultiplier,
    afterCrit,
    armorReduction,
    afterArmor,
    finalDamage: Math.max(0, Math.round(afterArmor)),
  };
}
