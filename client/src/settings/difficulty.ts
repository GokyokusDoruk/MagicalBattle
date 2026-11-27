import { BASE_POWER } from '../battle/flow/config';
import type { FighterInit } from '../battle/flow/engine';

/** Oyun seviyesi (Faz 2): menüden her an değiştirilir, kayda yazılır. */
export type Difficulty = 'easy' | 'normal' | 'hard';
export const DIFFICULTIES: readonly Difficulty[] = ['easy', 'normal', 'hard'];

export const DIFFICULTY_NAMES: Record<Difficulty, string> = { easy: 'Kolay', normal: 'Normal', hard: 'Zor' };

export interface DifficultyProfile {
  /** Savunurken rakibin saldırı çizgileri soluk olarak görünür mü (yalnız Kolay) */
  showEnemyAttack: boolean;
  /** Eşya ve asa düşme şansı çarpanı */
  dropRate: number;
  /** Savaş ganimetindeki para ve sandık parası çarpanı */
  battleMoney: number;
  /** Görev parası çarpanı */
  questMoney: number;
  /** Rakip büyücülerin (dünya düşmanı, maden, sandık muhafızı, boss) canı */
  enemyHp: number;
  /** Rakip büyücülerin büyü gücü */
  enemyPower: number;
  /** Rakip botların becerisine eklenen (savunma isabeti, özel şekil başarısı); 0-1 arasında kalır */
  enemySkill: number;
  /** Menüde gösterilen kısa açıklama */
  summary: string;
}

export const DIFFICULTY_PROFILES: Record<Difficulty, DifficultyProfile> = {
  easy: {
    showEnemyAttack: true,
    dropRate: 1.5,
    battleMoney: 1.5,
    questMoney: 1.5,
    enemyHp: 0.8,
    enemyPower: 0.8,
    enemySkill: -0.15,
    summary: 'Rakibin saldırı çizgilerini savunurken görürsün. Daha bol ganimet ve para, daha zayıf rakipler.',
  },
  normal: {
    showEnemyAttack: false,
    dropRate: 1,
    battleMoney: 1,
    questMoney: 1,
    enemyHp: 1,
    enemyPower: 1,
    enemySkill: 0,
    summary: 'Rakibin saldırısı görünmez. Ganimet, para ve rakipler olağan.',
  },
  hard: {
    showEnemyAttack: false,
    dropRate: 0.7,
    battleMoney: 0.75,
    questMoney: 0.75,
    enemyHp: 1.25,
    enemyPower: 1.2,
    enemySkill: 0.12,
    summary: 'Rakibin saldırısı görünmez. Daha az ganimet ve para, daha güçlü ve isabetli rakipler.',
  },
};

export const isDifficulty = (v: unknown): v is Difficulty => typeof v === 'string' && (DIFFICULTIES as readonly string[]).includes(v);

/** Oyun boyunca geçerli seviye. Savaş ekranları ve ekonomi buradan okur. */
class DifficultySetting {
  private value: Difficulty = 'normal';
  private readonly listeners = new Set<(d: Difficulty) => void>();

  get current(): Difficulty {
    return this.value;
  }

  get profile(): DifficultyProfile {
    return DIFFICULTY_PROFILES[this.value];
  }

  set(d: Difficulty): void {
    if (d === this.value) return;
    this.value = d;
    this.listeners.forEach((l) => l(d));
  }

  onChange(listener: (d: Difficulty) => void): void {
    this.listeners.add(listener);
  }
}

export const difficulty = new DifficultySetting();

/**
 * Rakip (bot) savaşçıları seviyeye göre ayarlar: can, büyü gücü ve beceri. İnsan ve takım arkadaşı (Elysia gibi
 * `control: 'bot'` ama oyuncunun takımındaki) dokunulmaz: yalnızca `enemyTeam` takımındakiler değişir.
 */
export function scaleEnemies(fighters: FighterInit[], profile: DifficultyProfile, enemyTeam = 1, fallbackSkill = 0.5): FighterInit[] {
  return fighters.map((f) => {
    if (f.team !== enemyTeam || f.control === 'human') return f;
    const out: FighterInit = { ...f };
    if (f.maxHp !== undefined) out.maxHp = Math.max(1, Math.round(f.maxHp * profile.enemyHp));
    if (f.hp !== undefined) out.hp = Math.max(1, Math.round(f.hp * profile.enemyHp));
    out.basePower = (f.basePower ?? BASE_POWER) * profile.enemyPower;
    // Beceri verilmemişse savaş ekranının genel bot becerisi (`fallbackSkill`) esas alınır
    out.ai = { ...f.ai, skill: Math.min(1, Math.max(0, (f.ai?.skill ?? fallbackSkill) + profile.enemySkill)) };
    return out;
  });
}
