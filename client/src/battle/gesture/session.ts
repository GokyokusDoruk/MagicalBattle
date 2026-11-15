import { DRAW_TIME_MS, IDLE_TIMEOUT_MS, LOGICAL_SIZE } from './config';
import { buildDensity } from './density';
import { computeMetrics, validateSpell } from './metrics';
import { computeQuality } from './quality';
import type { DrawingResult, Stroke } from './types';

export type SessionPhase = 'waiting' | 'drawing' | 'finished';

export interface SessionOptions {
  drawTimeMs?: number;
  idleTimeoutMs?: number;
}

const clamp = (v: number): number => Math.min(LOGICAL_SIZE, Math.max(0, v));

/**
 * Tek bir büyü çizme turu (arayüzden ve zamandan bağımsız; `now` dışarıdan verilir).
 *
 * - Süre ilk dokunuşta başlar ve `drawTimeMs` sürer. Süre dolunca tur kendiliğinden biter.
 * - Hiç dokunulmazsa `idleTimeoutMs` sonunda boş çizimle biter ("Büyü yapamadı").
 * - Parmak kalkınca yeni çizgi başlatılabilir (çok çizgili büyü).
 * - Basılı tutarken `tick` aynı noktadan örnek ekler: bir noktada fazla durmak o noktanın ağırlığını artırır.
 */
export class DrawingSession {
  private phase: SessionPhase = 'waiting';
  private turnStart = 0;
  private drawStart = 0;
  private readonly strokes: Stroke[] = [];
  private current: Stroke | null = null;
  private result: DrawingResult | null = null;
  private drawTimeMs: number;
  private readonly idleTimeoutMs: number;

  constructor(options: SessionOptions = {}) {
    this.drawTimeMs = options.drawTimeMs ?? DRAW_TIME_MS;
    this.idleTimeoutMs = options.idleTimeoutMs ?? IDLE_TIMEOUT_MS;
  }

  get currentPhase(): SessionPhase {
    return this.phase;
  }

  /** Şu anki çizim süresi sınırı (ms); `penalize` ile kısalabilir */
  get limitMs(): number {
    return this.drawTimeMs;
  }

  /** Çizim süresini kısaltır (Yanık İzi'ne dokunmak gibi); en az 300 ms kalır. */
  penalize(ms: number): void {
    if (this.phase === 'finished') return;
    this.drawTimeMs = Math.max(300, this.drawTimeMs - Math.max(0, ms));
  }

  /** Şu ana kadar çizilen çizgiler (canlı gösterim için). */
  get liveStrokes(): readonly Stroke[] {
    return this.strokes;
  }

  /** Turu başlatır (tuval ekrana geldiği an). */
  start(now: number): void {
    this.turnStart = now;
  }

  remainingMs(now: number): number {
    if (this.phase === 'waiting') return this.drawTimeMs;
    if (this.phase === 'finished') return 0;
    return Math.max(0, this.drawTimeMs - (now - this.drawStart));
  }

  pointerDown(x: number, y: number, now: number): void {
    if (this.phase === 'finished') return;
    if (this.phase === 'waiting') {
      this.phase = 'drawing';
      this.drawStart = now;
    } else if (this.expired(now)) {
      this.finish(now);
      return;
    }
    this.current = [{ x: clamp(x), y: clamp(y), t: now - this.drawStart }];
    this.strokes.push(this.current);
  }

  pointerMove(x: number, y: number, now: number): void {
    if (this.phase !== 'drawing' || !this.current) return;
    if (this.expired(now)) {
      this.finish(now);
      return;
    }
    this.current.push({ x: clamp(x), y: clamp(y), t: now - this.drawStart });
  }

  pointerUp(now: number): void {
    if (this.phase !== 'drawing') return;
    if (this.expired(now)) this.finish(now);
    this.current = null;
  }

  /** Zamanı ilerletir: basılı tutulan noktaya örnek ekler, süre ya da bekleme dolduysa turu bitirir. */
  tick(now: number): void {
    if (this.phase === 'finished') return;
    if (this.phase === 'waiting') {
      if (now - this.turnStart >= this.idleTimeoutMs) this.finish(now);
      return;
    }
    if (this.expired(now)) {
      this.finish(now);
      return;
    }
    const last = this.current?.[this.current.length - 1];
    if (this.current && last) this.current.push({ x: last.x, y: last.y, t: now - this.drawStart });
  }

  /** Turu bitirir (süre dolunca ya da oyuncu "Bitir" deyince). Tekrar çağrılırsa aynı sonucu verir. */
  finish(now: number): DrawingResult {
    if (this.result) return this.result;

    if (this.phase === 'drawing') {
      const end = this.drawTimeMs;
      const last = this.current?.[this.current.length - 1];
      // Süre dolduysa açık çizgi bitiş anına kadar uzatılır (son noktada bekleme sayılır)
      if (this.current && last && now - this.drawStart >= end && last.t < end) {
        this.current.push({ x: last.x, y: last.y, t: end });
      }
    }

    const elapsed = this.phase === 'waiting' ? 0 : Math.min(now - this.drawStart, this.drawTimeMs);
    const strokes = this.strokes.map((s) => s.slice());
    const density = buildDensity(strokes);
    const metrics = computeMetrics(strokes, density);
    this.phase = 'finished';
    this.current = null;
    this.result = { strokes, density, metrics, quality: computeQuality(metrics, density), validity: validateSpell(metrics), elapsedMs: Math.max(0, elapsed) };
    return this.result;
  }

  private expired(now: number): boolean {
    return now - this.drawStart >= this.drawTimeMs;
  }
}
