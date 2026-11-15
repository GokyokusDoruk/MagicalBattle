import type { SlotRef } from '../arena/layout';
import { calculateDamage, type DamageBreakdown } from '../damage/calculate';
import type { Element } from '../damage/elements';
import type { DrawingResult, Stroke } from '../gesture/types';
import { DRAW_TIME_MS } from '../gesture/config';
import { SHOW_ATTACK_TO_DEFENDER } from './config';
import { FOG_BOT_BYPASS, LIMITS, MUD_BOT_BYPASS, SHIELD_BREAK_STRENGTH, STUN_HIT_RATIO } from '../../skills/resolver';
import type { Action, BattleEngine, BurnEvent, Winner } from './engine';
import { matchShape } from '../gesture/shapeMatch';
import { SHAPE_NAMES, type ShapeName } from './shapes';

/** Özel büyü şekli doğru çizilirse verilen hasar çarpanı */
export const SPECIAL_SHAPE_BONUS = 1.25;

/**
 * Bir turun özel büyü şekli: döngü, saldıranın takımı ve sırasına göre belirlenir (zar atılmaz; tohumlu testler bozulmaz). Her döngüde
 * saldıran farklı bir şekil alır; şekiller dönüşümlü gezer.
 */
export function specialShapeFor(cycle: number, ref: SlotRef): ShapeName {
  return SHAPE_NAMES[(cycle * 5 + ref.team * 3 + ref.index * 7) % SHAPE_NAMES.length];
}

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
  /** Vuruş kritikti (şans ekipmandan ve yeteneklerden gelir): hasar ×1.5 */
  critical: boolean;
  /** Savunanın yeteneğiyle saldırana yansıyan hasar (0 = yok) */
  reflected: number;
  /** Yansıyan hasar saldıranı yendi mi */
  attackerDefeated: boolean;
  /** Saldıranın yeteneğiyle (can çalma) iyileşen can */
  healed: number;
  /** Ateş: savunanın kalkanı kırıldı (Kalkan Kıran) */
  shieldBroken?: boolean;
  /** Bu turun özel büyü şekli ve çizimin uyup uymadığı (başarılıysa hasar ×1.25) */
  specialShape?: ShapeName;
  specialOk?: boolean;
  /** Çizimin şablona uzaklığı (küçük = benzer; eşik `MATCH_THRESHOLD`) */
  specialDistance?: number;
  /** Ateş: savunan bu vuruşla tutuştu (Közleyen Alev) */
  ignited?: boolean;
  /** Ateş: Alev Zinciri'nin bu vuruşa uyguladığı yığın sayısı (0 = yok) */
  chainStacks?: number;
  /** Ateş: büyü saçılarak savunmayı kısmen aştı (Kıvılcım Saçması) */
  scatter?: boolean;
  /** Su: savunan yavaşlatıldı (sonraki çizim süresi kısalır) */
  chilled?: boolean;
  /** Su: savunma ekranına konan sis bulutu sayısı */
  fogged?: number;
  /** Toprak: savunan sersemledi (sıradaki saldırısı atlanır) */
  stunned?: boolean;
  /** Toprak: savunanın bu turda kazandığı kalıcı zırh */
  armorGained?: number;
  /** Toprak: savunma ekranındaki çamur yaması sayısı */
  mudded?: number;
  /** Hava: savunmanın tuttuğu hasardan saldırana geri savrulan (0 = yok) */
  rebounded?: number;
}

/** Saldırı çizerken savunanın pasiflerinden gelen ekran engelleri (Yanık İzi) */
export interface DrawExtras {
  /** Bu turun özel büyü şekli (saldırı çizerken): doğru çizilirse hasar ×1.25. Önizlemede yalnızca şekil gösterilir, nereye çizileceği değil. */
  specialShape?: ShapeName;
  /** Çizim ekranında beliren yara izi sayısı */
  scars?: number;
  /** Çizim ekranının sarsıntı şiddeti (Sarsıntılı Rüzgâr, 1-3) */
  shake?: number;
  /** Savunma ekranını kaplayan sis bulutu sayısı (Sis Perdesi) */
  fog?: number;
  /** Savunma ekranındaki çamur yaması sayısı (Çamur Yaması) */
  mud?: number;
}

/** Yara izine dokunmanın çizim süresinden aldığı */
export const SCAR_PENALTY_SEC = 0.2;
/** Botlar yara izine rastgele denk gelir: iz başına dokunma ihtimali */
export const BOT_SCAR_HIT_CHANCE = 0.5;
/** Sarsıntılı Rüzgâr: bot saldırgan şiddet başına bu kadar çizim süresi kaybeder */
export const BOT_SHAKE_PENALTY_SEC = 0.15;
/** Kritik şansının üst sınırı (ekipman + yetenek toplamı) */
export const CRIT_CAP_TOTAL = 0.75;

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
  /** `extras.scars`: bu çizimde (insan için) ekranda gösterilecek yara izi sayısı */
  draw(ref: SlotRef, role: Role, ghost?: readonly Stroke[], limitSec?: number, extras?: DrawExtras): Promise<DrawingResult>;
  /** Döngü başında yanan savaşçıların yediği yanma hasarı (isteğe bağlı: arayüz oynatır) */
  /** Sersemlemiş savaşçının saldırı sırası atlandı (isteğe bağlı) */
  announceStun?(ref: SlotRef, engine: BattleEngine): Promise<void>;
  announceBurn?(events: readonly BurnEvent[], engine: BattleEngine): Promise<void>;
  play(report: TurnReport, engine: BattleEngine): Promise<void>;
  announceEnd(winner: Winner, engine: BattleEngine): Promise<void>;
}

export interface RunOptions {
  /** Savunan, gelen saldırıyı soluk olarak görsün mü (varsayılan: config) */
  showAttackToDefender?: boolean;
  /** İptal edilirse mevcut tur bitince döngü durur */
  signal?: AbortSignal;
  /** Rastgelelik kaynağı (kritik vuruş zarı); testler sabit bir kaynak verir. Varsayılan Math.random. */
  random?: () => number;
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
  const random = options.random ?? Math.random;
  const refKey = (r: SlotRef): string => `${r.team}:${r.index}`;
  let round = new Map<string, Element>();
  let roundCycle = 0;

  for (;;) {
    if (options.signal?.aborted) return engine.winner;
    const action = engine.nextAction();
    const burns = engine.takeBurnEvents();
    if (burns.length > 0) await io.announceBurn?.(burns, engine);
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

    // Sarsıntı: sersemlemiş savaşçı bu sırada saldıramaz
    if (attacker.stunned) {
      attacker.stunned = false;
      await io.announceStun?.(action.attacker, engine);
      continue;
    }

    // Bu turun elementleri döngü başında seçilmiştir: saldıran kendi elementiyle saldırır, savunan kendi elementiyle savunur
    const attackerElement = round.get(refKey(action.attacker))!;
    const defenderElement = round.get(refKey(action.defender))!;
    await io.announceTurn(action, engine, { attackerElement, defenderElement });

    // Asalar: saldıranın asası taban gücü, savunanın asası alınan hasarı değiştirir; ikisi de çizim süresini uzatır
    const attackWand = attacker.wands(attackerElement, 'attack');
    const defenseWand = defender.wands(defenderElement, 'defense');
    const baseSec = DRAW_TIME_MS / 1000;
    // Ekipman: zırh hasarı azaltır; yüzük, bileklik ve kolye çizim süresini uzatır ve kritik şansı verir; kendi elementindeki parçalar hasarı artırır
    const attackGear = attacker.gear(attackerElement);
    const defenseGear = defender.gear(defenderElement);
    // Yetenek ağaçlarından büyüye özel etkiler: saldıran büyüsünün elementiyle, savunan savunduğu elementle
    const attackFx = attacker.spells(attackerElement, 'attack');
    const defenseFx = defender.spells(defenderElement, 'defense');
    const attackSec = baseSec + attackWand.timeBonusSec + attackGear.timeBonusSec + attackFx.timeBonus;
    const defenseSec = baseSec + defenseWand.timeBonusSec + defenseGear.timeBonusSec + defenseFx.timeBonus;

    // Yanık İzi: savunanın pasifi saldırganın çizim ekranına yara izi koyar (insan dokununca süre kaybeder; botlar rastgele denk gelir)
    // Buz Nefesi: önceki vuruştan kalan yavaşlama bu çizimin süresini kısaltır (bir kez)
    const attackChill = attacker.chill;
    const defenseChill = defender.chill;
    attacker.chill = 0;
    defender.chill = 0;

    const scars = defender.passives.scars;
    const shake = defender.passives.shake;
    const specialShape = specialShapeFor(engine.cycle, action.attacker);
    let attack = await io.draw(action.attacker, 'attack', undefined, Math.max(1, attackSec - attackChill), { specialShape, ...(scars > 0 || shake > 0 ? { scars, shake } : {}) });
    if (shake > 0 && attacker.control === 'bot' && attack.validity.valid) {
      attack = { ...attack, metrics: { ...attack.metrics, drawTimeSec: Math.max(0, attack.metrics.drawTimeSec - shake * BOT_SHAKE_PENALTY_SEC) } };
    }
    if (attackChill > 0 && attacker.control === 'bot' && attack.validity.valid) {
      attack = { ...attack, metrics: { ...attack.metrics, drawTimeSec: Math.max(0, attack.metrics.drawTimeSec - attackChill) } };
    }
    if (scars > 0 && attacker.control === 'bot' && attack.validity.valid) {
      let hits = 0;
      for (let i = 0; i < scars; i++) if (random() < BOT_SCAR_HIT_CHANCE) hits++;
      if (hits > 0) {
        attack = { ...attack, metrics: { ...attack.metrics, drawTimeSec: Math.max(0, attack.metrics.drawTimeSec - hits * SCAR_PENALTY_SEC) } };
      }
    }

    // Alev Zinciri: art arda ateş saldırıları sayılır; başka element ya da başarısız büyü zinciri keser
    const chainBefore = attacker.fireChain;
    attacker.fireChain = attackerElement === 'fire' && attack.validity.valid ? chainBefore + 1 : 0;

    // Saldıran büyü yapamadı: savunmaya gerek kalmaz, sıra rakibe geçer
    if (!attack.validity.valid) {
      await io.play(
        {
          action,
          attackerElement,
          defenderElement,
          attack,
          defense: null,
          specialShape,
          specialOk: false,
          attackFailed: true,
          defenseFailed: false,
          critical: false,
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

    const defense = await io.draw(action.defender, 'defense', showGhost ? attack.strokes : undefined, Math.max(1, defenseSec - defenseChill), attackFx.fog > 0 || attackFx.mud > 0 ? { fog: attackFx.fog, mud: attackFx.mud } : undefined);
    const defenseFailed = !defense.validity.valid;

    // Kritik vuruş: ekipmandan (ve yeteneklerden) gelen şans toplanır
    const critical = random() < Math.min(CRIT_CAP_TOTAL, attackGear.crit + attackFx.critBonus);

    // Ateş yetenekleri: kalkan kırma zarı, saçma ve zincir (zar yalnızca ilgili yetenek varsa atılır)
    const chainStacks = attackFx.chainBonus > 0 ? Math.min(LIMITS.maxChainStacks, chainBefore) : 0;
    const shieldBroken = !defenseFailed && attackFx.shieldBreak > 0 && random() < attackFx.shieldBreak;
    // Sis Perdesi: sisli ekranda bir botun savunması zayıflar (insan sisi kendi gözüyle aşmaya çalışır)
    const fogBypass = defender.control === 'bot' && !defenseFailed ? Math.min(0.5, attackFx.fog * FOG_BOT_BYPASS + attackFx.mud * MUD_BOT_BYPASS) : 0;
    const bypass = 1 - (1 - attackFx.scatter) * (1 - (shieldBroken ? SHIELD_BREAK_STRENGTH : 0)) * (1 - fogBypass);
    const special = matchShape(attack.strokes, specialShape);
    const parts: { label: string; value: number }[] = [
      { label: 'Özel büyü şekli', value: special.ok ? SPECIAL_SHAPE_BONUS : 1 },
      { label: 'Ekipman çarpanı', value: attacker.dealtMultiplier },
      { label: 'Kuşanılan eşyalar (kendi elementinden bonus)', value: 1 + attackGear.damageBonus },
      { label: 'Saldırı yetenekleri', value: attackFx.dealtMultiplier },
      { label: 'Alev Zinciri', value: 1 + chainStacks * attackFx.chainBonus },
      { label: 'Savunanın yetenek ve asası', value: defender.takenMultiplier * defenseFx.takenMultiplier * defenseWand.takenMultiplier },
    ].filter((p) => Math.abs(p.value - 1) > 0.005);
    const input = {
      multiplierParts: parts,
      attackQuality: attack.quality.total,
      defenseQuality: defenseFailed ? 1 : defense.quality.scribble,
      basePower: attacker.basePower * attackWand.powerMultiplier,
      attack,
      defense: defenseFailed ? null : defense.density,
      attackerElement,
      defenderElement,
      critical,
      defenseBypass: bypass,
      attackerDealtMultiplier: attacker.dealtMultiplier * attackFx.dealtMultiplier * (1 + attackGear.damageBonus) * (1 + chainStacks * attackFx.chainBonus),
      defenderTakenMultiplier: defender.takenMultiplier * defenseFx.takenMultiplier * defenseWand.takenMultiplier,
      defenderArmor: defenseGear.armor + defender.armorBonus,
      attackerArmorPierce: attackFx.armorPierce,
      attackerHeadBonus: attackFx.headBonus,
      attackerEffortBonus: attackFx.effortBonus,
      attackerDrawTimeSec: attackSec,
    };
    const breakdown = calculateDamage(input);
    const result = engine.applyDamage(action.defender, breakdown.finalDamage);
    const dealt = result.hpBefore - result.hpAfter;

    // Can çalma, sonra yansıtma (yansıma saldıranı yenebilir)
    const healed = dealt > 0 ? engine.heal(action.attacker, dealt * attackFx.lifesteal) : 0;
    // Yansıyan Dalga: savunmanın tuttuğu hasar (savunma olmasaydı vereceği - verdiği) kadar saldırana döner
    const blockedDamage = defenseFx.reflect > 0 && !defenseFailed ? Math.max(0, calculateDamage({ ...input, defense: null, defenseBypass: 0 }).finalDamage - breakdown.finalDamage) : 0;
    // Geri Esen Rüzgâr: şans tutarsa savunmanın tuttuğu hasarın bir kısmı da saldırana savrulur
    const rebounded =
      defenseFx.reboundChance > 0 && !defenseFailed && random() < defenseFx.reboundChance
        ? Math.round(Math.max(0, calculateDamage({ ...input, defense: null, defenseBypass: 0 }).finalDamage - breakdown.finalDamage) * defenseFx.reboundShare)
        : 0;
    const reflected = Math.round(blockedDamage * defenseFx.reflect) + rebounded;
    const reflectResult = reflected > 0 ? engine.applyDamage(action.attacker, reflected) : null;

    // Közleyen Alev: vuruş yaşayan rakibi tutuşturabilir (yanan rakipte yenilenmez, birikmez)
    const ignited = attackFx.burnChance > 0 && !result.defeated && random() < attackFx.burnChance ? engine.ignite(action.defender, attackFx.burnDamage) : false;

    // Taş Kabuk: toprak savunması kalıcı zırh kazandırır (savaş boyunca birikir)
    const armorGained = defenseFx.armorStack > 0 && !defenseFailed ? Math.min(LIMITS.maxArmorBonus - defender.armorBonus, defenseFx.armorStack) : 0;
    if (armorGained > 0) defender.armorBonus += armorGained;

    // Sarsıntı: savunmayı %80 ve üstü aşan vuruş rakibin sıradaki saldırısını atlatabilir
    const stunned = attackFx.stunChance > 0 && !result.defeated && 1 - breakdown.defendedRatio >= STUN_HIT_RATIO && random() < attackFx.stunChance;
    if (stunned) defender.stunned = true;

    // Buz Nefesi: vuruş yaşayan rakibi yavaşlatabilir (birikmez, en uzun olan kalır)
    const chilled = attackFx.chillChance > 0 && !result.defeated && random() < attackFx.chillChance;
    if (chilled) defender.chill = Math.max(defender.chill, attackFx.chillSec);

    await io.play(
      {
        action,
        attackerElement,
        defenderElement,
        attack,
        defense,
        attackFailed: false,
        defenseFailed,
        critical,
        breakdown,
        damage: dealt,
        hpBefore: result.hpBefore,
        hpAfter: result.hpAfter,
        defeated: result.defeated,
        reflected: reflectResult ? reflectResult.hpBefore - reflectResult.hpAfter : 0,
        attackerDefeated: reflectResult?.defeated ?? false,
        healed,
        shieldBroken,
        ignited,
        chainStacks,
        scatter: !defenseFailed && attackFx.scatter > 0,
        chilled,
        fogged: attackFx.fog,
        stunned,
        armorGained,
        mudded: attackFx.mud,
        specialShape,
        specialOk: special.ok,
        specialDistance: special.distance,
        rebounded,
      },
      engine,
    );
  }

  const winner = engine.winner;
  await io.announceEnd(winner, engine);
  return winner;
}
