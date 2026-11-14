import type { SlotRef } from '../arena/layout';
import { calculateDamage, type DamageBreakdown } from '../damage/calculate';
import type { Element } from '../damage/elements';
import type { DrawingResult, Stroke } from '../gesture/types';
import { DRAW_TIME_MS } from '../gesture/config';
import { SHOW_ATTACK_TO_DEFENDER } from './config';
import type { Action, BattleEngine, Winner } from './engine';

export type Role = 'attack' | 'defense';

/** Bir turun sonucu: arayüzün (arena, can çubukları, duyurular) oynatması için her şey. */
export interface TurnReport {
  action: Action;
  attackerElement: Element;
  defenderElement: Element;
  attack: DrawingResult;
  /** Savunan çizdiyse; saldırı başarısızsa ya da savunma yapılamadıysa geçersiz/null olabilir */
  defense: DrawingResult | null;
  /** Saldıran büyü yapamadı: tur biter, hasar yok */
  attackFailed: boolean;
  /** Savunan büyü yapamadı: saldırının tamamı hasar verir */
  defenseFailed: boolean;
  breakdown: DamageBreakdown | null;
  damage: number;
  hpBefore: number;
  hpAfter: number;
  defeated: boolean;
  /** Savunanın yeteneğiyle saldırana yansıyan hasar (0 = yok) */
  reflected: number;
  /** Yansıyan hasar saldıranı yendi mi */
  attackerDefeated: boolean;
  /** Saldıranın yeteneğiyle (can çalma) iyileşen can */
  healed: number;
}

/** Bir döngüde bir savaşçının seçtiği element. Hem saldırısı hem savunması bu elementle yapılır. */
export interface RoundChoice {
  ref: SlotRef;
  element: Element;
}

/** Bir turun elementleri: saldıranın ve savunanın o döngüde seçtikleri */
export interface TurnElements {
  attackerElement: Element;
  defenderElement: Element;
}

/**
 * Savaş akışının dış dünyayla konuştuğu her şey. Gerçek oyunda arayüz (çizim tuvali, arena),
 * botlar için anında cevap veren, testlerde sahte uygulamalar kullanılır.
 */
export interface BattleIO {
  /** Her turda: kim kime saldırıyor ve o iki savaşçının (döngü başında seçilmiş) elementleri */
  announceTurn(action: Action, engine: BattleEngine, elements: TurnElements): Promise<void>;
  /**
   * Döngü başında element seçimi: her canlı savaşçı AYNI ANDA, birbirini görmeden TEK element seçer. Seçilen element
   * o döngüde hem saldırının hem savunmanın elementidir (ateşle saldırdıysan o döngü ateşle savunursun).
   */
  chooseElement(ref: SlotRef): Promise<Element>;
  /** Herkes seçince elementler birlikte açılır */
  revealRound(round: readonly RoundChoice[], engine: BattleEngine): Promise<void>;
  /** `ghost` verilirse (savunan, gelen saldırıyı görür) tuvalde soluk gösterilir */
  /** `limitSec`: çizime tanınan süre (asa uzatabilir); verilmezse temel süre */
  draw(ref: SlotRef, role: Role, ghost?: readonly Stroke[], limitSec?: number): Promise<DrawingResult>;
  play(report: TurnReport, engine: BattleEngine): Promise<void>;
  announceEnd(winner: Winner, engine: BattleEngine): Promise<void>;
}

export interface RunOptions {
  /** Savunan, gelen saldırıyı soluk olarak görsün mü (varsayılan: config) */
  showAttackToDefender?: boolean;
  /** İptal edilirse mevcut tur bitince döngü durur */
  signal?: AbortSignal;
}

/**
 * Savaşı baştan sona yürütür. Her DÖNGÜ başında canlı herkes gizlice TEK element seçer ve elementler birlikte açılır.
 * Seçilen element o döngüde hem saldırının hem savunmanın elementidir. Sonra her tur:
 *  1. sıradaki saldıran/savunan belirlenir (elementleri döngü başında seçilmiştir)
 *  2. saldıran çizer (büyü yapamazsa tur biter, sıra rakibe geçer)
 *  3. savunan çizer (yapamazsa saldırının tamamı hasar verir)
 *  4. hasar hesaplanıp uygulanır, tur oynatılır
 * Kazananı döndürür (iptal edildiyse o ana kadarki durum).
 */
export async function runBattle(engine: BattleEngine, io: BattleIO, options: RunOptions = {}): Promise<Winner> {
  const showGhost = options.showAttackToDefender ?? SHOW_ATTACK_TO_DEFENDER;
  const refKey = (r: SlotRef): string => `${r.team}:${r.index}`;
  let round = new Map<string, Element>();
  let roundCycle = 0;

  for (;;) {
    if (options.signal?.aborted) return engine.winner;
    const action = engine.nextAction();
    if (!action) break;

    // Yeni döngü: canlı herkes gizlice (aynı anda) tek element seçer, sonra birlikte açılır
    if (engine.cycle !== roundCycle) {
      roundCycle = engine.cycle;
      const alive = engine.all().filter((f) => f.hp > 0);
      const choices: RoundChoice[] = await Promise.all(
        alive.map(async (f) => {
          const ref = { team: f.team, index: f.index };
          return { ref, element: await io.chooseElement(ref) };
        }),
      );
      round = new Map(choices.map((c) => [refKey(c.ref), c.element]));
      await io.revealRound(choices, engine);
      if (options.signal?.aborted) return engine.winner;
    }

    const attacker = engine.fighter(action.attacker);
    const defender = engine.fighter(action.defender);

    // Bu turun elementleri döngü başında seçilmiştir: saldıran kendi elementiyle saldırır, savunan kendi elementiyle savunur
    const attackerElement = round.get(refKey(action.attacker))!;
    const defenderElement = round.get(refKey(action.defender))!;
    await io.announceTurn(action, engine, { attackerElement, defenderElement });

    // Asalar: saldıranın asası taban gücü, savunanın asası alınan hasarı değiştirir; ikisi de çizim süresini uzatır
    const attackWand = attacker.wands(attackerElement, 'attack');
    const defenseWand = defender.wands(defenderElement, 'defense');
    const baseSec = DRAW_TIME_MS / 1000;
    // Ekipman: aynı elementteki zırh ve yüzük %50 daha güçlü (yüzük çizim süresini uzatır, zırh hasarı azaltır)
    const attackGear = attacker.gear(attackerElement);
    const defenseGear = defender.gear(defenderElement);
    const attackSec = baseSec + attackWand.timeBonusSec + attackGear.timeBonusSec;
    const defenseSec = baseSec + defenseWand.timeBonusSec + defenseGear.timeBonusSec;

    const attack = await io.draw(action.attacker, 'attack', undefined, attackSec);

    // Saldıran büyü yapamadı: savunmaya gerek kalmaz, sıra rakibe geçer
    if (!attack.validity.valid) {
      await io.play(
        {
          action,
          attackerElement,
          defenderElement,
          attack,
          defense: null,
          attackFailed: true,
          defenseFailed: false,
          breakdown: null,
          damage: 0,
          hpBefore: defender.hp,
          hpAfter: defender.hp,
          defeated: false,
          reflected: 0,
          attackerDefeated: false,
          healed: 0,
        },
        engine,
      );
      continue;
    }

    const defense = await io.draw(action.defender, 'defense', showGhost ? attack.strokes : undefined, defenseSec);
    const defenseFailed = !defense.validity.valid;

    // Yetenek ağaçlarından büyüye özel etkiler: saldıran büyüsünün elementiyle, savunan savunduğu elementle
    const attackFx = attacker.spells(attackerElement, 'attack');
    const defenseFx = defender.spells(defenderElement, 'defense');

    const breakdown = calculateDamage({
      basePower: attacker.basePower * attackWand.powerMultiplier,
      attack,
      defense: defenseFailed ? null : defense.density,
      attackerElement,
      defenderElement,
      attackerDealtMultiplier: attacker.dealtMultiplier * attackFx.dealtMultiplier,
      defenderTakenMultiplier: defender.takenMultiplier * defenseFx.takenMultiplier * defenseWand.takenMultiplier,
      defenderArmor: defenseGear.armor,
      attackerArmorPierce: attackFx.armorPierce,
      attackerHeadBonus: attackFx.headBonus,
      attackerEffortBonus: attackFx.effortBonus,
      attackerDrawTimeSec: attackSec,
    });
    const result = engine.applyDamage(action.defender, breakdown.finalDamage);
    const dealt = result.hpBefore - result.hpAfter;

    // Can çalma, sonra yansıtma (yansıma saldıranı yenebilir)
    const healed = dealt > 0 ? engine.heal(action.attacker, dealt * attackFx.lifesteal) : 0;
    const reflected = dealt > 0 ? Math.round(dealt * defenseFx.reflect) : 0;
    const reflectResult = reflected > 0 ? engine.applyDamage(action.attacker, reflected) : null;

    await io.play(
      {
        action,
        attackerElement,
        defenderElement,
        attack,
        defense,
        attackFailed: false,
        defenseFailed,
        breakdown,
        damage: dealt,
        hpBefore: result.hpBefore,
        hpAfter: result.hpAfter,
        defeated: result.defeated,
        reflected: reflectResult ? reflectResult.hpBefore - reflectResult.hpAfter : 0,
        attackerDefeated: reflectResult?.defeated ?? false,
        healed,
      },
      engine,
    );
  }

  const winner = engine.winner;
  await io.announceEnd(winner, engine);
  return winner;
}
