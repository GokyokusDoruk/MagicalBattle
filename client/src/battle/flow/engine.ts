import type { SlotRef } from '../arena/layout';
import { neutralEffects, type SpellResolver } from '../../skills/resolver';
import { BASE_POWER, MAX_CYCLES, MAX_HP } from './config';

export type Control = 'human' | 'bot';

export interface FighterInit {
  name: string;
  team: 0 | 1;
  control: Control;
  maxHp?: number;
  basePower?: number;
  /** Toplam zırhtan gelen hasar azaltma (0-1) */
  armor?: number;
  /** Skill/ekipmandan gelen verilen hasar çarpanı (1 = etkisiz) */
  dealtMultiplier?: number;
  /** Skill/ekipmandan gelen alınan hasar çarpanı (1 = etkisiz) */
  takenMultiplier?: number;
  /** Yetenek ağacından gelen büyü etkileri (verilmezse yeteneksiz) */
  spells?: SpellResolver;
}

export interface Fighter extends Required<FighterInit> {
  index: number;
  hp: number;
}

/** Bir tur: kim saldırıyor, kim savunuyor. Savunan, saldırı anındaki durumuna göre belirlenir. */
export interface Action {
  attacker: SlotRef;
  defender: SlotRef;
}

export type Winner = 0 | 1 | 'draw' | null;

export interface DamageResult {
  hpBefore: number;
  hpAfter: number;
  defeated: boolean;
}

const same = (a: SlotRef, b: SlotRef): boolean => a.team === b.team && a.index === b.index;

/**
 * Sıra tabanlı savaşın kuralları (arayüzden bağımsız).
 *
 * Bir döngü, her savaşçının sırayla bir kez saldırdığı turlardır:
 *   takım 0'ın saldırganları sırayla, ardından takım 1'inkiler.
 *   (2v2: T1-K1 saldırır, T2-K1 savunur; T1-K2 saldırır, T2-K2 savunur; sonra T2-K1, T2-K2...)
 * Ölen savaşçının saldırı sırası atlanır, rakip dezavantajlı olmaz. Savunmaya normalde karşısındaki
 * (aynı sıradaki) rakip geçer; o ölmüşse hayatta kalan takım arkadaşı savunur (ek bir bonus yoktur).
 */
export class BattleEngine {
  private readonly fighters: Fighter[];
  private queue: SlotRef[] = [];
  private cycleCount = 0;
  private readonly maxCycles: number;

  constructor(inits: readonly FighterInit[], options: { maxCycles?: number } = {}) {
    const counts = [0, 0];
    this.fighters = inits.map((init) => {
      const index = counts[init.team]++;
      const maxHp = init.maxHp ?? MAX_HP;
      return {
        name: init.name,
        team: init.team,
        control: init.control,
        maxHp,
        basePower: init.basePower ?? BASE_POWER,
        armor: init.armor ?? 0,
        dealtMultiplier: init.dealtMultiplier ?? 1,
        takenMultiplier: init.takenMultiplier ?? 1,
        spells: init.spells ?? neutralEffects,
        index,
        hp: maxHp,
      };
    });
    if (counts[0] < 1 || counts[1] < 1 || counts[0] > 2 || counts[1] > 2) {
      throw new Error('Her takımda 1 ya da 2 savaşçı olmalı');
    }
    this.maxCycles = options.maxCycles ?? MAX_CYCLES;
  }

  /** Takım başına savaşçı sayısı (arena yerleşimi için) */
  get teamSizes(): [number, number] {
    return [this.team(0).length, this.team(1).length];
  }

  all(): readonly Fighter[] {
    return this.fighters;
  }

  team(team: 0 | 1): Fighter[] {
    return this.fighters.filter((f) => f.team === team);
  }

  fighter(ref: SlotRef): Fighter {
    const f = this.fighters.find((x) => same(x, ref));
    if (!f) throw new Error(`Savaşçı yok: ${ref.team}:${ref.index}`);
    return f;
  }

  isAlive(ref: SlotRef): boolean {
    return this.fighter(ref).hp > 0;
  }

  get cycle(): number {
    return this.cycleCount;
  }

  /** Kazanan takım; savaş sürüyorsa null. Döngü sınırı dolarsa can toplamı fazla olan, eşitse 'draw'. */
  get winner(): Winner {
    const alive = [this.team(0).some((f) => f.hp > 0), this.team(1).some((f) => f.hp > 0)];
    if (!alive[0] && !alive[1]) return 'draw';
    if (!alive[0]) return 1;
    if (!alive[1]) return 0;
    if (this.cycleCount > this.maxCycles) {
      const hp = [0, 1].map((t) => this.team(t as 0 | 1).reduce((s, f) => s + f.hp, 0));
      return hp[0] === hp[1] ? 'draw' : hp[0] > hp[1] ? 0 : 1;
    }
    return null;
  }

  get isOver(): boolean {
    return this.winner !== null;
  }

  /** Bir döngünün saldırı sırası: önce takım 0'ın, sonra takım 1'in savaşçıları. */
  private cycleOrder(): SlotRef[] {
    return ([0, 1] as const).flatMap((team) => this.team(team).map((f) => ({ team, index: f.index })));
  }

  /** Savunan: karşıdaki aynı sıradaki rakip; ölmüşse hayatta kalan diğer rakip. */
  private pickDefender(attacker: SlotRef): SlotRef | null {
    const foes = this.team(attacker.team === 0 ? 1 : 0).filter((f) => f.hp > 0);
    if (foes.length === 0) return null;
    const opposite = foes.find((f) => f.index === attacker.index);
    const chosen = opposite ?? foes[0];
    return { team: chosen.team, index: chosen.index };
  }

  /**
   * Sıradaki turu verir; ölü saldırganlar atlanır. Savaş bittiyse null.
   * Döngü bitince yenisi başlar.
   */
  nextAction(): Action | null {
    for (let guard = 0; guard < 1000; guard++) {
      if (this.isOver) return null;
      if (this.queue.length === 0) {
        this.cycleCount++;
        if (this.isOver) return null; // döngü sınırı doldu
        this.queue = this.cycleOrder();
      }
      const attacker = this.queue.shift()!;
      if (!this.isAlive(attacker)) continue;
      const defender = this.pickDefender(attacker);
      if (!defender) return null;
      return { attacker, defender };
    }
    return null;
  }

  /** Savunana hasar uygular (en az 0). Can sıfıra inince savaşçı yenilir. */
  applyDamage(defender: SlotRef, damage: number): DamageResult {
    const f = this.fighter(defender);
    const hpBefore = f.hp;
    f.hp = Math.max(0, f.hp - Math.max(0, Math.round(damage)));
    return { hpBefore, hpAfter: f.hp, defeated: hpBefore > 0 && f.hp === 0 };
  }

  /** Canlı savaşçıyı iyileştirir (azami cana kadar); gerçekte eklenen canı döndürür. */
  heal(target: SlotRef, amount: number): number {
    const f = this.fighter(target);
    if (f.hp <= 0) return 0;
    const gained = Math.min(f.maxHp - f.hp, Math.max(0, Math.round(amount)));
    f.hp += gained;
    return gained;
  }
}
