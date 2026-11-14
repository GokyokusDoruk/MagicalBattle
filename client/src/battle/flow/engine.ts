import type { SlotRef } from '../arena/layout';
import { NO_PASSIVES, neutralEffects, type Passives, type SpellResolver } from '../../skills/resolver';
import type { GearResolver } from '../../economy/gearEffects';
import type { BotProfile } from './bot';
import { neutralWand, type WandResolver } from '../../wands/inventory';
import { BASE_POWER, MAX_CYCLES, MAX_HP } from './config';

export type Control = 'human' | 'bot';

export interface FighterInit {
  name: string;
  team: 0 | 1;
  control: Control;
  maxHp?: number;
  /** Başlangıç canı (verilmezse tam dolu); 1 ile maxHp arasına çekilir. Savaşlar arası kalıcı can için. */
  hp?: number;
  basePower?: number;
  /** Toplam zırhtan gelen hasar azaltma (0-1). `gear` verilirse onun zırhı kullanılır. */
  armor?: number;
  /** Ekipmandan (zırh ve yüzük) gelen etkiler; büyünün elementine göre hesaplanır (element eşleşmesi %50) */
  gear?: GearResolver;
  /** Skill/ekipmandan gelen verilen hasar çarpanı (1 = etkisiz) */
  dealtMultiplier?: number;
  /** Skill/ekipmandan gelen alınan hasar çarpanı (1 = etkisiz) */
  takenMultiplier?: number;
  /** Yetenek ağacından gelen büyü etkileri (verilmezse yeteneksiz) */
  spells?: SpellResolver;
  /** Pasif yetenekler (Yanık İzi: rakibin saldırı çizim ekranına yara izi koyar); verilmezse yok */
  passives?: Passives;
  /** Asalardan gelen etkiler: saldırı asası taban gücü, savunma asası alınan hasarı değiştirir (verilmezse asasız) */
  wands?: WandResolver;
  /** Yapay zekâ kişiliği (yalnızca botlar için): Elysia'nın ruh hali savaşını etkiler */
  persona?: 'elysia';
  /** Düşman yapay zekâ ayarları (element tercihi, beceri, saldırı büyüklüğü) */
  ai?: BotProfile;
}

export interface Fighter extends Required<Omit<FighterInit, 'persona' | 'ai' | 'gear'>> {
  gear: GearResolver;
  persona: 'elysia' | null;
  ai: BotProfile | null;
  index: number;
  hp: number;
  /** Yanma hasarı (her döngü başında yenir); 0 = yanmıyor. Savaşın sonuna kadar sürer, birikmez. */
  burn: number;
  /** Art arda ateş saldırısı sayısı (Alev Zinciri) */
  fireChain: number;
  /** Buz Nefesi: bir sonraki çizimden kesilecek süre (sn); kullanılınca sıfırlanır */
  chill: number;
}

/** Bir döngü başında yanan savaşçının yediği yanma hasarı */
export interface BurnEvent {
  ref: SlotRef;
  damage: number;
  hpBefore: number;
  hpAfter: number;
  defeated: boolean;
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
  private burnLog: BurnEvent[] = [];
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
        gear: init.gear ?? (() => ({ armor: init.armor ?? 0, timeBonusSec: 0, crit: 0, damageBonus: 0 })),
        dealtMultiplier: init.dealtMultiplier ?? 1,
        takenMultiplier: init.takenMultiplier ?? 1,
        spells: init.spells ?? neutralEffects,
        passives: init.passives ?? NO_PASSIVES,
        burn: 0,
        fireChain: 0,
        chill: 0,
        wands: init.wands ?? neutralWand,
        persona: init.persona ?? null,
        ai: init.ai ?? null,
        index,
        hp: Math.min(maxHp, Math.max(1, Math.round(init.hp ?? maxHp))),
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
        this.tickBurns();
        if (this.isOver) return null; // döngü sınırı doldu ya da yanma savaşı bitirdi
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

  /** Yeni döngü başında yanan canlı herkes yanma hasarı yer. */
  private tickBurns(): void {
    for (const f of this.fighters) {
      if (f.hp <= 0 || f.burn <= 0) continue;
      const r = this.applyDamage({ team: f.team, index: f.index }, f.burn);
      this.burnLog.push({ ref: { team: f.team, index: f.index }, damage: r.hpBefore - r.hpAfter, hpBefore: r.hpBefore, hpAfter: r.hpAfter, defeated: r.defeated });
    }
  }

  /** Son döngü başında yenen yanma hasarları (okununca boşalır); arayüz bunları oynatır. */
  takeBurnEvents(): BurnEvent[] {
    const out = this.burnLog;
    this.burnLog = [];
    return out;
  }

  /** Savaşçıyı tutuşturur. Zaten yanıyorsa birikmez (en yüksek yanma hasarı kalır); yeni tutuştuysa true. */
  ignite(target: SlotRef, damage: number): boolean {
    const f = this.fighter(target);
    if (f.hp <= 0 || damage <= 0) return false;
    const was = f.burn > 0;
    f.burn = Math.max(f.burn, damage);
    return !was;
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
