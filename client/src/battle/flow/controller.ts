import type { SlotRef } from '../arena/layout';
import { calculateDamage, type DamageBreakdown } from '../damage/calculate';
import type { Element } from '../damage/elements';
import type { DrawingResult, Stroke } from '../gesture/types';
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
}

/**
 * Savaş akışının dış dünyayla konuştuğu her şey. Gerçek oyunda arayüz (çizim tuvali, arena),
 * botlar için anında cevap veren, testlerde sahte uygulamalar kullanılır.
 */
export interface BattleIO {
  announceTurn(action: Action, engine: BattleEngine): Promise<void>;
  /** Element seçimi. Saldıran ve savunan AYNI ANDA, birbirini görmeden seçer. */
  chooseElement(ref: SlotRef, role: Role): Promise<Element>;
  /** İki element de seçilince birlikte açılır */
  revealElements(action: Action, attackerElement: Element, defenderElement: Element): Promise<void>;
  /** `ghost` verilirse (savunan, gelen saldırıyı görür) tuvalde soluk gösterilir */
  draw(ref: SlotRef, role: Role, ghost?: readonly Stroke[]): Promise<DrawingResult>;
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
 * Savaşı baştan sona yürütür. Her tur:
 *  1. sıradaki saldıran/savunan belirlenir
 *  2. ikisi de gizlice element seçer, sonra birlikte açılır
 *  3. saldıran çizer (büyü yapamazsa tur biter, sıra rakibe geçer)
 *  4. savunan çizer (yapamazsa saldırının tamamı hasar verir)
 *  5. hasar hesaplanıp uygulanır, tur oynatılır
 * Kazananı döndürür (iptal edildiyse o ana kadarki durum).
 */
export async function runBattle(engine: BattleEngine, io: BattleIO, options: RunOptions = {}): Promise<Winner> {
  const showGhost = options.showAttackToDefender ?? SHOW_ATTACK_TO_DEFENDER;

  for (;;) {
    if (options.signal?.aborted) return engine.winner;
    const action = engine.nextAction();
    if (!action) break;

    const attacker = engine.fighter(action.attacker);
    const defender = engine.fighter(action.defender);

    await io.announceTurn(action, engine);

    const [attackerElement, defenderElement] = await Promise.all([
      io.chooseElement(action.attacker, 'attack'),
      io.chooseElement(action.defender, 'defense'),
    ]);
    await io.revealElements(action, attackerElement, defenderElement);

    const attack = await io.draw(action.attacker, 'attack');

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
        },
        engine,
      );
      continue;
    }

    const defense = await io.draw(action.defender, 'defense', showGhost ? attack.strokes : undefined);
    const defenseFailed = !defense.validity.valid;

    const breakdown = calculateDamage({
      basePower: attacker.basePower,
      attack,
      defense: defenseFailed ? null : defense.density,
      attackerElement,
      defenderElement,
      attackerDealtMultiplier: attacker.dealtMultiplier,
      defenderTakenMultiplier: defender.takenMultiplier,
      defenderArmor: defender.armor,
    });
    const result = engine.applyDamage(action.defender, breakdown.finalDamage);

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
        damage: result.hpBefore - result.hpAfter,
        hpBefore: result.hpBefore,
        hpAfter: result.hpAfter,
        defeated: result.defeated,
      },
      engine,
    );
  }

  const winner = engine.winner;
  await io.announceEnd(winner, engine);
  return winner;
}
