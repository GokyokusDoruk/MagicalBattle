import { BRUSH_RADIUS, DRAW_TIME_MS, DWELL_SAMPLE_MS, LOGICAL_SIZE } from '../battle/gesture/config';
import { DrawingSession, type SessionOptions } from '../battle/gesture/session';
import type { DrawingResult, Stroke } from '../battle/gesture/types';

export interface DrawingCanvasOptions extends SessionOptions {
  /** Fırça rengi (elementin rengi) */
  color: string;
  /** Soluk "hayalet" olarak gösterilecek çizgiler (savunan, gelen saldırıyı görür) */
  ghost?: readonly Stroke[];
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
    this.session.pointerDown(p.x, p.y, performance.now());
  }

  private onMove(e: PointerEvent): void {
    if (e.pointerId !== this.pointerId) return;
    const p = this.toLogical(e);
    this.session.pointerMove(p.x, p.y, performance.now());
  }

  private onUp(e: PointerEvent): void {
    if (e.pointerId !== this.pointerId) return;
    this.pointerId = null;
    this.session.pointerUp(performance.now());
  }

  /** Her karede: süreyi ilerlet (basılı tutma örneği), çiz, bittiyse sonucu ver. */
  private frame(): void {
    const now = performance.now();
    this.session.tick(now);
    this.render(now);
    if (this.session.currentPhase === 'finished') this.end();
  }

  private end(): void {
    window.clearInterval(this.timer);
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
