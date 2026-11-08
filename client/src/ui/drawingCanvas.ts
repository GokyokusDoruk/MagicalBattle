import { BRUSH_RADIUS, DRAW_TIME_MS, DWELL_SAMPLE_MS, LOGICAL_SIZE } from '../battle/gesture/config';
import { HEAD_ZONE_FRACTION } from '../battle/damage/config';
import { DrawingSession, type SessionOptions } from '../battle/gesture/session';
import type { DrawingResult, Stroke } from '../battle/gesture/types';
import type { DrawLoop } from '../audio/sfx/engine';

export interface DrawingCanvasOptions extends SessionOptions {
  /** Fırça rengi (elementin rengi) */
  color: string;
  /** Soluk "hayalet" olarak gösterilecek çizgiler (savunan, gelen saldırıyı görür) */
  ghost?: readonly Stroke[];
  /** Rakibin baş bölgesini (üstte, ×1.5 hasar) kesikli çizgiyle göster */
  showHeadZone?: boolean;
  /** Her çizgi başlarken çağrılır; kalem hızına göre sürekli ses verir (ör. `engine.beginDraw`) */
  drawSound?: () => DrawLoop;
}

/**
 * Büyü çizim tuvali: parmak ya da fare ile çizilir, süre ilk dokunuşta başlar.
 * Geri sayım çubuğu ve "Bitir" düğmesi içerir. `start()` tur bitince sonucu döndürür.
 */
export class DrawingCanvas {
  readonly element: HTMLDivElement;
  private readonly canvas: HTMLCanvasElement;
  private readonly ctx: CanvasRenderingContext2D;
  private readonly fill: HTMLDivElement;
  private readonly label: HTMLSpanElement;
  private readonly finishBtn: HTMLButtonElement;
  private session: DrawingSession;
  private timer: number | undefined;
  private resolve: ((r: DrawingResult) => void) | null = null;
  private pointerId: number | null = null;
  private loop: DrawLoop | null = null;
  private lastMove: { x: number; y: number; at: number } | null = null;

  constructor(private readonly options: DrawingCanvasOptions) {
    this.session = new DrawingSession(options);

    this.element = document.createElement('div');
    this.element.className = 'flex w-full flex-col items-center gap-3';
    this.element.innerHTML = `
      <canvas class="touch-none rounded-lg border-2 border-amber-200/50 bg-slate-950" style="width:min(88vw,60vh);aspect-ratio:1;touch-action:none"></canvas>
      <div class="w-[min(88vw,60vh)]">
        <div class="h-2 overflow-hidden rounded bg-white/10"><div data-fill class="h-full w-full bg-amber-300"></div></div>
        <div class="mt-2 flex items-center justify-between text-sm text-slate-300">
          <span data-label></span>
          <button data-finish type="button" class="rounded bg-white/10 px-3 py-1 hover:bg-white/20">Bitir</button>
        </div>
      </div>`;
    this.canvas = this.element.querySelector('canvas')!;
    this.ctx = this.canvas.getContext('2d')!;
    this.fill = this.element.querySelector('[data-fill]')!;
    this.label = this.element.querySelector('[data-label]')!;
    this.finishBtn = this.element.querySelector('[data-finish]')!;

    this.canvas.addEventListener('pointerdown', (e) => this.onDown(e));
    this.canvas.addEventListener('pointermove', (e) => this.onMove(e));
    this.canvas.addEventListener('pointerup', (e) => this.onUp(e));
    this.canvas.addEventListener('pointercancel', (e) => this.onUp(e));
    this.finishBtn.addEventListener('click', () => this.end());
  }

  /** Turu başlatır; çizim bitince (süre dolunca, "Bitir" ile ya da hiç dokunulmazsa) sonucu verir. */
  start(): Promise<DrawingResult> {
    this.session = new DrawingSession(this.options);
    this.session.start(performance.now());
    this.fitCanvas();
    this.timer = window.setInterval(() => this.frame(), Math.min(DWELL_SAMPLE_MS, 16));
    this.frame();
    return new Promise((resolve) => {
      this.resolve = resolve;
    });
  }

  /** Turu sonuçsuz bırakır (örn. savaş bitti). */
  cancel(): void {
    window.clearInterval(this.timer);
    this.resolve = null;
  }

  private fitCanvas(): void {
    const rect = this.canvas.getBoundingClientRect();
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    this.canvas.width = Math.max(1, Math.round(rect.width * dpr));
    this.canvas.height = Math.max(1, Math.round(rect.height * dpr));
  }

  private toLogical(e: PointerEvent): { x: number; y: number } {
    const rect = this.canvas.getBoundingClientRect();
    return {
      x: ((e.clientX - rect.left) / rect.width) * LOGICAL_SIZE,
      y: ((e.clientY - rect.top) / rect.height) * LOGICAL_SIZE,
    };
  }

  private onDown(e: PointerEvent): void {
    if (!e.isPrimary || this.pointerId !== null || this.session.currentPhase === 'finished') return;
    e.preventDefault();
    this.pointerId = e.pointerId;
    try {
      this.canvas.setPointerCapture(e.pointerId);
    } catch {
      // Bazı tarayıcılar/cihazlar yakalamayı reddedebilir; çizim yine de çalışır
    }
    const p = this.toLogical(e);
    const now = performance.now();
    this.session.pointerDown(p.x, p.y, now);
    this.loop = this.options.drawSound?.() ?? null;
    this.lastMove = { x: p.x, y: p.y, at: now };
  }

  private onMove(e: PointerEvent): void {
    if (e.pointerId !== this.pointerId) return;
    const p = this.toLogical(e);
    const now = performance.now();
    this.session.pointerMove(p.x, p.y, now);
    const last = this.lastMove;
    if (this.loop && last) {
      // mantıksal birim/ms; ~0.8 çok hızlı sayılır
      this.loop.update(Math.hypot(p.x - last.x, p.y - last.y) / Math.max(1, now - last.at) / 0.8);
    }
    this.lastMove = { x: p.x, y: p.y, at: now };
  }

  private onUp(e: PointerEvent): void {
    if (e.pointerId !== this.pointerId) return;
    this.pointerId = null;
    this.stopSound();
    this.session.pointerUp(performance.now());
  }

  private stopSound(): void {
    this.loop?.end();
    this.loop = null;
    this.lastMove = null;
  }

  /** Her karede: süreyi ilerlet (basılı tutma örneği), çiz, bittiyse sonucu ver. */
  private frame(): void {
    const now = performance.now();
    this.session.tick(now);
    // Kalem durduysa ses kısılır
    if (this.loop && this.lastMove && now - this.lastMove.at > 70) this.loop.update(0);
    this.render(now);
    if (this.session.currentPhase === 'finished') this.end();
  }

  private end(): void {
    window.clearInterval(this.timer);
    this.stopSound();
    const result = this.session.finish(performance.now());
    this.render(performance.now());
    this.finishBtn.disabled = true;
    const done = this.resolve;
    this.resolve = null;
    done?.(result);
  }

  /** Çizgileri verilen renkte çizer; `glow` açıksa parlama ekler. */
  private drawStrokes(strokes: readonly Stroke[], color: string, scale: number, glow: boolean): void {
    const { ctx } = this;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.strokeStyle = color;
    ctx.fillStyle = color;
    ctx.shadowColor = color;
    ctx.shadowBlur = glow ? 7 * scale : 0;
    ctx.lineWidth = BRUSH_RADIUS * 1.2 * scale;
    for (const stroke of strokes) {
      if (stroke.length === 0) continue;
      if (stroke.length === 1) {
        ctx.beginPath();
        ctx.arc(stroke[0].x * scale, stroke[0].y * scale, BRUSH_RADIUS * 0.6 * scale, 0, Math.PI * 2);
        ctx.fill();
        continue;
      }
      ctx.beginPath();
      ctx.moveTo(stroke[0].x * scale, stroke[0].y * scale);
      for (let k = 1; k < stroke.length; k++) ctx.lineTo(stroke[k].x * scale, stroke[k].y * scale);
      ctx.stroke();
    }
    ctx.shadowBlur = 0;
  }

  /** Üstteki baş bölgesinin sınırı: savunulmayan büyü buraya düşerse daha çok hasar verir. */
  private drawHeadZone(scale: number): void {
    const { ctx, canvas } = this;
    const y = HEAD_ZONE_FRACTION * LOGICAL_SIZE * scale;
    ctx.save();
    ctx.fillStyle = 'rgba(248,113,113,0.07)';
    ctx.fillRect(0, 0, canvas.width, y);
    ctx.setLineDash([8 * scale, 6 * scale]);
    ctx.strokeStyle = 'rgba(248,113,113,0.55)';
    ctx.lineWidth = Math.max(1, scale);
    ctx.beginPath();
    ctx.moveTo(0, y);
    ctx.lineTo(canvas.width, y);
    ctx.stroke();
    ctx.setLineDash([]);
    ctx.fillStyle = 'rgba(248,113,113,0.8)';
    ctx.font = `${Math.round(11 * scale)}px system-ui, sans-serif`;
    ctx.fillText('BAŞ  ×1.5', 6 * scale, y - 5 * scale);
    ctx.restore();
  }

  private render(now: number): void {
    const { ctx, canvas } = this;
    const scale = canvas.width / LOGICAL_SIZE;
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    // Kılavuz: ortada soluk artı
    ctx.strokeStyle = 'rgba(255,255,255,0.06)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(canvas.width / 2, 0);
    ctx.lineTo(canvas.width / 2, canvas.height);
    ctx.moveTo(0, canvas.height / 2);
    ctx.lineTo(canvas.width, canvas.height / 2);
    ctx.stroke();

    if (this.options.showHeadZone) this.drawHeadZone(scale);
    if (this.options.ghost) this.drawStrokes(this.options.ghost, 'rgba(255,255,255,0.22)', scale, false);
    this.drawStrokes(this.session.liveStrokes, this.options.color, scale, true);

    const total = this.options.drawTimeMs ?? DRAW_TIME_MS;
    const remaining = this.session.remainingMs(now);
    this.fill.style.width = `${(remaining / total) * 100}%`;
    this.fill.style.background = remaining < total * 0.25 ? '#f87171' : '#fcd34d';
    this.label.textContent =
      this.session.currentPhase === 'waiting'
        ? `Çizmeye başla! Süre ilk dokunuşta başlar (${(total / 1000).toFixed(0)} sn).`
        : this.session.currentPhase === 'finished'
          ? 'Çizim bitti.'
          : `${(remaining / 1000).toFixed(1)} sn`;
  }
}
