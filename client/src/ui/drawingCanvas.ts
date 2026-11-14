import { BRUSH_RADIUS, DWELL_SAMPLE_MS, LOGICAL_SIZE } from '../battle/gesture/config';
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
  /** Yanık İzi: ekranda beliren yara izi sayısı. Dokunan her iz ekranı kırmızıya boyar ve 0.2 sn süre alır. */
  scars?: number;
  /** Rastgelelik kaynağı (iz konumları); testler sabit verir */
  random?: () => number;
}

/** Çizim ekranındaki bir yara izi (mantıksal koordinat) */
interface Scar {
  x: number;
  y: number;
  angle: number;
  hit: boolean;
}

/** Yara izinin dokunma yarıçapı (mantıksal birim) */
export const SCAR_RADIUS = 16;
/** Dokunulan yara izinin aldığı süre (ms) */
export const SCAR_PENALTY_MS = 200;

/**
 * Yara izi konumları: kenarlardan uzak, birbirinden ayrı ve ortadaki çizim alanına rastgele serpilir.
 * (Saf fonksiyon: testlenebilir.)
 */
export function placeScars(count: number, random: () => number = Math.random): { x: number; y: number; angle: number }[] {
  const out: { x: number; y: number; angle: number }[] = [];
  const margin = 36;
  for (let i = 0; i < count; i++) {
    let best = { x: 0, y: 0, angle: 0 };
    for (let attempt = 0; attempt < 30; attempt++) {
      const c = { x: margin + random() * (LOGICAL_SIZE - 2 * margin), y: margin + random() * (LOGICAL_SIZE - 2 * margin), angle: (random() - 0.5) * Math.PI };
      best = c;
      if (out.every((o) => Math.hypot(o.x - c.x, o.y - c.y) > SCAR_RADIUS * 3)) break;
    }
    out.push(best);
  }
  return out;
}

/** a-b doğru parçası c noktasına `r` mesafeden yakın mı */
export function segmentNearPoint(a: { x: number; y: number }, b: { x: number; y: number }, c: { x: number; y: number }, r: number): boolean {
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const len2 = dx * dx + dy * dy;
  const t = len2 === 0 ? 0 : Math.min(1, Math.max(0, ((c.x - a.x) * dx + (c.y - a.y) * dy) / len2));
  return Math.hypot(a.x + t * dx - c.x, a.y + t * dy - c.y) <= r;
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
  private scars: Scar[] = [];
  private flashUntil = 0;

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
    this.scars = placeScars(Math.max(0, Math.floor(this.options.scars ?? 0)), this.options.random).map((s) => ({ ...s, hit: false }));
    this.flashUntil = 0;
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
    this.touchScars(p, p, now);
    this.loop = this.options.drawSound?.() ?? null;
    this.lastMove = { x: p.x, y: p.y, at: now };
  }

  /** Kalem iki nokta arasında bir yara izine değdiyse: iz yanar, ekran kızarır, 0.2 sn gider (her iz bir kez). */
  private touchScars(from: { x: number; y: number }, to: { x: number; y: number }, now: number): void {
    if (this.session.currentPhase !== 'drawing') return;
    for (const scar of this.scars) {
      if (scar.hit || !segmentNearPoint(from, to, scar, SCAR_RADIUS)) continue;
      scar.hit = true;
      this.session.penalize(SCAR_PENALTY_MS);
      this.flashUntil = now + 280;
    }
  }

  private onMove(e: PointerEvent): void {
    if (e.pointerId !== this.pointerId) return;
    const p = this.toLogical(e);
    const now = performance.now();
    this.session.pointerMove(p.x, p.y, now);
    const last = this.lastMove;
    this.touchScars(last ?? p, p, now);
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

  /** Küçük kırmızı yara izleri: eğik bir kesik ve üstünde iki çapraz çizgi; dokunulan iz solar. */
  private drawScars(scale: number): void {
    const { ctx } = this;
    ctx.save();
    ctx.lineCap = 'round';
    for (const s of this.scars) {
      ctx.globalAlpha = s.hit ? 0.25 : 0.95;
      ctx.strokeStyle = '#ef4444';
      ctx.shadowColor = '#ef4444';
      ctx.shadowBlur = s.hit ? 0 : 6 * scale;
      ctx.lineWidth = 3 * scale;
      const dx = Math.cos(s.angle) * SCAR_RADIUS * 0.8 * scale;
      const dy = Math.sin(s.angle) * SCAR_RADIUS * 0.8 * scale;
      const cx = s.x * scale;
      const cy = s.y * scale;
      ctx.beginPath();
      ctx.moveTo(cx - dx, cy - dy);
      ctx.lineTo(cx + dx, cy + dy);
      ctx.stroke();
      ctx.lineWidth = 2 * scale;
      for (const t of [-0.35, 0.35]) {
        const px = cx + dx * t;
        const py = cy + dy * t;
        ctx.beginPath();
        ctx.moveTo(px - dy * 0.6, py + dx * 0.6);
        ctx.lineTo(px + dy * 0.6, py - dx * 0.6);
        ctx.stroke();
      }
    }
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
    this.drawScars(scale);
    this.drawStrokes(this.session.liveStrokes, this.options.color, scale, true);
    if (now < this.flashUntil) {
      ctx.fillStyle = `rgba(239,68,68,${(0.45 * (this.flashUntil - now)) / 280})`;
      ctx.fillRect(0, 0, canvas.width, canvas.height);
    }

    const total = this.session.limitMs;
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
