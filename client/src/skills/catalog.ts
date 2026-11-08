import { ELEMENTS, type Element } from '../battle/damage/elements';

/** Yetenek ağacı kataloğu: 4 element × 3 dal × 3 kademe (Seviye 1, Seviye 2, Ustalık) = 36 yetenek. */

export type BranchKind = 'power' | 'precision' | 'ward';
export type SpellRole = 'attack' | 'defense';
export type Tier = 1 | 2 | 3;

export const BRANCH_KINDS: readonly BranchKind[] = ['power', 'precision', 'ward'];
export const TIERS: readonly Tier[] = [1, 2, 3];

/** Bir kademenin yetenek puanı bedeli: Seviye 1 = 1, Seviye 2 = 2, Ustalık = 3 (bir dal toplam 6) */
export const TIER_COST: Record<Tier, number> = { 1: 1, 2: 2, 3: 3 };
/** Her karakter seviyesi (2'den itibaren) bu kadar yetenek puanı verir */
export const SP_PER_LEVEL = 2;

/** Bir büyünün yeteneklerden aldığı etkiler. Hepsi genel çarpan ya da oran; bölgesel değildir (baş bonusu hariç). */
export interface SpellStats {
  /** Verilen hasara eklenen oran (0.1 = +%10) */
  dealt: number;
  /** Alınan hasardan düşen oran (0.1 = -%10) */
  taken: number;
  /** Rakibin zırhının yok sayılan oranı */
  pierce: number;
  /** Savunulmayan kısım başa düşünce çarpana eklenen değer (0.1: x1.5 yerine x1.6) */
  headBonus: number;
  /** Savunucunun yediği hasarın saldırana yansıyan oranı */
  reflect: number;
  /** Verilen hasarın saldıranın canına dönen oranı */
  lifesteal: number;
  /** Aceleyle çizilen büyünün güç tabanına eklenen değer (0.1: %40 yerine %50) */
  effort: number;
}

export type StatBlock = Partial<SpellStats>;

export const STAT_KEYS = ['dealt', 'taken', 'pierce', 'headBonus', 'reflect', 'lifesteal', 'effort'] as const;

export interface BranchDef {
  element: Element;
  kind: BranchKind;
  name: string;
  /** Dal hangi durumda işler: saldırı dalları büyüyü atarken, savunma dalı savunurken */
  role: SpellRole;
}

export interface SkillDef {
  id: string;
  element: Element;
  branch: BranchKind;
  tier: Tier;
  name: string;
  cost: number;
  stats: StatBlock;
}

/** Dal şablonları: her kademenin getirisi (element yeteneğine göre ölçeklenir). */
const TEMPLATE: Record<BranchKind, [StatBlock, StatBlock, StatBlock]> = {
  power: [{ dealt: 0.05 }, { dealt: 0.05, effort: 0.05 }, { dealt: 0.1, effort: 0.1 }],
  precision: [{ headBonus: 0.1 }, { pierce: 0.1 }, { headBonus: 0.15, pierce: 0.15 }],
  ward: [{ taken: 0.05 }, { taken: 0.05, reflect: 0.05 }, { taken: 0.1, reflect: 0.1 }],
};

/** Elementin karakteri: dal başına ölçek (ateş saldırgan, toprak sağlam, hava keskin, su dayanıklı). */
const FLAVOR: Record<Element, Record<BranchKind, number>> = {
  fire: { power: 1.2, precision: 1, ward: 0.8 },
  water: { power: 0.8, precision: 1, ward: 1.2 },
  earth: { power: 0.8, precision: 0.8, ward: 1.4 },
  air: { power: 1, precision: 1.2, ward: 0.8 },
};

/** Elemente özel ek etkiler: [element, dal, kademe] -> eklenen. Su, hasar verdikçe iyileşir. */
const EXTRAS: { element: Element; branch: BranchKind; tier: Tier; stats: StatBlock }[] = [
  { element: 'water', branch: 'power', tier: 3, stats: { lifesteal: 0.08 } },
  { element: 'fire', branch: 'power', tier: 3, stats: { pierce: 0.05 } },
  { element: 'air', branch: 'precision', tier: 3, stats: { effort: 0.1 } },
];

const NAMES: Record<Element, Record<BranchKind, [string, string, string, string]>> = {
  fire: {
    power: ['Alev Gücü', 'Kıvılcım', 'Alev Dalgası', 'Cehennem Ustalığı'],
    precision: ['Kor Nişanı', 'Sıcak Nokta', 'Eriten Öz', 'Kızıl Delici'],
    ward: ['Kor Kalkanı', 'Isı Perdesi', 'Yanık Aynası', 'Anka Kalkanı'],
  },
  water: {
    power: ['Akıntı', 'Dalga', 'Gelgit', 'Tsunami Ustalığı'],
    precision: ['Buz İğnesi', 'Don Ucu', 'Kırağı Delici', 'Mutlak Sıfır'],
    ward: ['Derin Kalkan', 'Su Perdesi', 'Girdap Aynası', 'Okyanus Kalkanı'],
  },
  earth: {
    power: ['Kaya Gücü', 'Çakıl', 'Heyelan', 'Dağ Ustalığı'],
    precision: ['Taş Mızrak', 'Sivri Taş', 'Yarık Açan', 'Elmas Uç'],
    ward: ['Taş Duvar', 'Toprak Perdesi', 'Kaya Aynası', 'Dağ Kalkanı'],
  },
  air: {
    power: ['Fırtına', 'Esinti', 'Kasırga', 'Fırtına Ustalığı'],
    precision: ['Rüzgâr Oku', 'Keskin Esinti', 'Delici Rüzgâr', 'Fırtına Gözü'],
    ward: ['Bulut Kalkanı', 'Rüzgâr Perdesi', 'Savuran Ayna', 'Gök Kalkanı'],
  },
};

const round3 = (n: number): number => Math.round(n * 1000) / 1000;

function scaled(block: StatBlock, factor: number): StatBlock {
  const out: StatBlock = {};
  for (const key of STAT_KEYS) {
    const v = block[key];
    if (v !== undefined) out[key] = round3(v * factor);
  }
  return out;
}

function merged(a: StatBlock, b: StatBlock): StatBlock {
  const out: StatBlock = { ...a };
  for (const key of STAT_KEYS) {
    const v = b[key];
    if (v !== undefined) out[key] = round3((out[key] ?? 0) + v);
  }
  return out;
}

export const skillId = (element: Element, branch: BranchKind, tier: Tier): string => `${element}-${branch}-${tier}`;

export const BRANCHES: readonly BranchDef[] = ELEMENTS.flatMap((element) =>
  BRANCH_KINDS.map((kind) => ({
    element,
    kind,
    name: NAMES[element][kind][0],
    role: (kind === 'ward' ? 'defense' : 'attack') as SpellRole,
  })),
);

export const SKILLS: readonly SkillDef[] = ELEMENTS.flatMap((element) =>
  BRANCH_KINDS.flatMap((branch) =>
    TIERS.map((tier) => {
      let stats = scaled(TEMPLATE[branch][tier - 1], FLAVOR[element][branch]);
      for (const extra of EXTRAS) {
        if (extra.element === element && extra.branch === branch && extra.tier === tier) stats = merged(stats, extra.stats);
      }
      return {
        id: skillId(element, branch, tier),
        element,
        branch,
        tier,
        name: NAMES[element][branch][tier],
        cost: TIER_COST[tier],
        stats,
      };
    }),
  ),
);

const BY_ID = new Map(SKILLS.map((s) => [s.id, s]));

export const getSkill = (id: string): SkillDef | undefined => BY_ID.get(id);

export const getBranch = (element: Element, kind: BranchKind): BranchDef =>
  BRANCHES.find((b) => b.element === element && b.kind === kind)!;

export const BRANCH_ROLE_NAMES: Record<BranchKind, string> = {
  power: 'Güç (saldırı)',
  precision: 'Hassasiyet (saldırı)',
  ward: 'Kalkan (savunma)',
};

const pct = (v: number): string => `%${Math.round(v * 100)}`;

/** Bir etkinin Türkçe, kısa açıklaması: ["+%6 verilen hasar", ...] */
export function describeStats(stats: StatBlock): string[] {
  const out: string[] = [];
  if (stats.dealt) out.push(`+${pct(stats.dealt)} verilen hasar`);
  if (stats.taken) out.push(`-${pct(stats.taken)} alınan hasar`);
  if (stats.headBonus) out.push(`baş vuruşu +${pct(stats.headBonus)} daha güçlü`);
  if (stats.pierce) out.push(`zırhın ${pct(stats.pierce)} kadarını deler`);
  if (stats.reflect) out.push(`yediği hasarın ${pct(stats.reflect)} kadarını yansıtır`);
  if (stats.lifesteal) out.push(`verdiği hasarın ${pct(stats.lifesteal)} kadarı can olur`);
  if (stats.effort) out.push(`aceleyle çizilen büyü +${pct(stats.effort)} daha güçlü kalır`);
  return out;
}
