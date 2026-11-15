const fs = require('fs');
function patch(f, pairs) {
  let s = fs.readFileSync(f, 'utf8');
  const crlf = s.includes('\r\n');
  s = s.replace(/\r\n/g, '\n');
  for (const [a, b] of pairs) {
    if (!s.includes(a)) throw new Error(f + ' missing: ' + a.slice(0, 70));
    s = s.replace(a, () => b);
  }
  if (crlf) s = s.replace(/\n/g, '\r\n');
  fs.writeFileSync(f, s);
}
patch('src/battle/flow/controller.ts', [
  [`export interface DrawExtras {
  /** Çizim ekranında beliren yara izi sayısı */
  scars?: number;`, `export interface DrawExtras {
  /** Bu turun özel büyü şekli (saldırı çizerken): doğru çizilirse hasar ×1.25. Önizlemede yalnızca şekil gösterilir, nereye çizileceği değil. */
  specialShape?: ShapeName;
  /** Çizim ekranında beliren yara izi sayısı */
  scars?: number;`],
  [`  /** Ateş: savunan bu vuruşla tutuştu`, `  /** Bu turun özel büyü şekli ve çizimin uyup uymadığı (başarılıysa hasar ×1.25) */
  specialShape?: ShapeName;
  specialOk?: boolean;
  /** Çizimin şablona uzaklığı (küçük = benzer; eşik \`MATCH_THRESHOLD\`) */
  specialDistance?: number;
  /** Ateş: savunan bu vuruşla tutuştu`],
  [`import type { Action, BattleEngine, BurnEvent, Winner } from './engine';`, `import type { Action, BattleEngine, BurnEvent, Winner } from './engine';
import { MATCH_THRESHOLD, matchShape } from '../gesture/shapeMatch';
import { SHAPE_NAMES, type ShapeName } from './shapes';

/** Özel büyü şekli doğru çizilirse verilen hasar çarpanı */
export const SPECIAL_SHAPE_BONUS = 1.25;

/**
 * Bir turun özel büyü şekli: döngü, saldıranın takımı ve sırasına göre belirlenir (zar atılmaz; tohumlu testler bozulmaz). Her döngüde
 * saldıran farklı bir şekil alır; şekiller dönüşümlü gezer.
 */
export function specialShapeFor(cycle: number, ref: SlotRef): ShapeName {
  return SHAPE_NAMES[(cycle * 5 + ref.team * 3 + ref.index * 7) % SHAPE_NAMES.length];
}`],
  [`    let attack = await io.draw(action.attacker, 'attack', undefined, Math.max(1, attackSec - attackChill), scars > 0 || shake > 0 ? { scars, shake } : undefined);`, `    const specialShape = specialShapeFor(engine.cycle, action.attacker);
    let attack = await io.draw(action.attacker, 'attack', undefined, Math.max(1, attackSec - attackChill), { specialShape, ...(scars > 0 || shake > 0 ? { scars, shake } : {}) });`],
  [`          attackFailed: true,`, `          specialShape,
          specialOk: false,
          attackFailed: true,`],
  [`    const parts: { label: string; value: number }[] = [`, `    const special = matchShape(attack.strokes, specialShape);
    const parts: { label: string; value: number }[] = [
      { label: 'Özel büyü şekli', value: special.ok ? SPECIAL_SHAPE_BONUS : 1 },`],
  [`        mudded: attackFx.mud,`, `        mudded: attackFx.mud,
        specialShape,
        specialOk: special.ok,
        specialDistance: special.distance,`],
]);
patch('src/battle/flow/bot.ts', [
  [`import { SHAPE_NAMES, buildShape, scribbleShape } from './shapes';`, `import { SHAPE_NAMES, buildShape, scribbleShape, type ShapeName } from './shapes';
import type { Stroke as BotStroke } from '../gesture/types';`],
  [`  drawAttack(): DrawingResult {`, `  drawAttack(special?: ShapeName): DrawingResult {`],
  [`    if (this.rand() < 0.06) return analyzeStrokes(scribbleShape(cx, cy, ms), ms);`, `    if (this.rand() < 0.06) return analyzeStrokes(scribbleShape(cx, cy, ms), ms);
    // Özel büyü şekli: bot beceriyle orantılı olarak denemeye çalışır (el titremesi beceri düştükçe artar)
    if (special && this.rand() < Math.min(0.9, 0.2 + 0.6 * this.skill)) {
      const size = this.between(58, 92) * (this.profile.attackScale ?? 1);
      return analyzeStrokes(this.wobble(buildShape(special, cx, cy, size, ms), (1 - this.skill) * 7 + 1.5), ms);
    }`],
  [`  /** Hasar yedikten sonra çağrılır`, `  /** Çizgilere elle çizim titremesi ekler: yavaş dalga + küçük rastgelelik (\`amp\` mantıksal birim). */
  protected wobble(strokes: BotStroke[], amp: number): BotStroke[] {
    const phase = this.rand() * 6;
    return strokes.map((s) => s.map((p, i) => ({ x: p.x + Math.sin(i * 0.4 + phase) * amp * 0.6 + (this.rand() - 0.5) * amp, y: p.y + Math.cos(i * 0.37 + phase) * amp * 0.6 + (this.rand() - 0.5) * amp, t: p.t })));
  }

  /** Hasar yedikten sonra çağrılır`],
]);
patch('src/ui/battleScreen.ts', [
  [`      return role === 'attack' ? bot.drawAttack() : bot.drawDefense();`, `      return role === 'attack' ? bot.drawAttack(extras?.specialShape) : bot.drawDefense();`],
]);
patch('src/boss/simulate.ts', [
  [`draw: async (ref, role, ghost) => (role === 'attack' ? botFor(ref).drawAttack() : isPlayerProxy(ref)`, `draw: async (ref, role, ghost, _limit, extras) => (role === 'attack' ? botFor(ref).drawAttack(extras?.specialShape) : isPlayerProxy(ref)`],
  [`draw: async (ref, role) => (role === 'attack' ? botFor(ref).drawAttack() : botFor(ref).drawDefense()),`, `draw: async (ref, role, _g, _l, extras) => (role === 'attack' ? botFor(ref).drawAttack(extras?.specialShape) : botFor(ref).drawDefense()),`],
]);
