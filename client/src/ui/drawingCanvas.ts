import { BRUSH_RADIUS, DWELL_SAMPLE_MS, LOGICAL_SIZE } from '../battle/gesture/config';
import { normPose, silhouetteShape, type TargetPose } from '../battle/damage/target';
import { DrawingSession, type SessionOptions } from '../battle/gesture/session';
import type { DrawingResult, Stroke } from '../battle/gesture/types';
import type { DrawLoop } from '../audio/sfx/engine';

export interface DrawingCanvasOptions extends SessionOptions {
  /** Fırça rengi (elementin rengi) */
  color: string;
  /** Soluk "hayalet" olarak gösterilecek çizgiler (savunan, gelen saldırıyı görür) */
  ghost?: readonly Stroke[];
  /**
   * Faz 3: tuvalde gösterilecek büyücü silüeti (saldırıda rakip, savunmada kendin). Silüete düşen büyü tam vurur, başa düşen daha çok;
   * dışına giden çok az. Silüette yazı yoktur (başın nerede olduğu yazılmaz, yalnızca görülür).
   */
  target?: TargetPose;
  /** Silüetin tonu: rakip (kırmızımsı) ya da kendi silüetin (mavimsi). Varsayılan rakip. */
  targetTone?: 'enemy' | 'self';
  /** Her çizgi başlarken çağrılır; kalem hızına göre sürekli ses verir (ör. `engine.beginDraw`) */
  drawSound?: () => DrawLoop;
  /** Yanık İzi: ekranda beliren yara izi sayısı (görüşü örter, çizimi engellemez). */
  scars?: number;
  /** Sis Perdesi: savunma ekranını kaplayan sis bulutu sayısı (altındaki çizim ve hayalet görünmez) */
  fog?: number;
  /** Sarsıntılı Rüzgâr: çizim ekranının sarsıntı şiddeti (1-3); tuval titrer, çizmek zorlaşır */
  shake?: number;
  /** Çamur Yaması: savunma ekranındaki çamur yaması sayısı (görüşü örter, çizimi engellemez) */
  mud?: number;
  /** Rastgelelik kaynağı (iz konumları); testler sabit verir */
  random?: () => number;
}

/**
 * Büyücü silüeti (Faz 3): eklemli bir kukla (gövde, kollar, bacaklar, baş; eller ve ayaklar başla aynı büyüklükte yuvarlak).
 * - **Rakip** (`enemy`, yalnızca Kolay'da saldırırken): bulanık, tek renk kırmızımsı gölge. Baş, eller ve ayaklar aynı görünür;
 *   başın hangisi olduğu anlaşılmaz.
 * - **Kendin** (`self`, yer seçerken ve savunurken): mavimsi gölge; **başın** parlak bir halkayla belli olur (neresini koruyacağını bilirsin).
 * `scale`: mantıksal birimden piksele çarpan.
 */
export function paintSilhouette(ctx: CanvasRenderingContext2D, target: TargetPose, scale: number, tone: 'enemy' | 'self' = 'enemy'): void {
  const w = ctx.canvas.width;
  const h = ctx.canvas.height;
  const key = `${target.cx}:${target.cy}:${target.scale}:${normPose(target.pose)}:${scale}:${w}:${h}:${tone}`;
  if (silhouetteCache?.key !== key) silhouetteCache = { key, image: renderSilhouetteLayer(target, scale, w, h, tone) };
  if (!silhouetteCache.image) return;
  ctx.save();
  ctx.globalAlpha = tone === 'self' ? 0.3 : 0.28;
  ctx.shadowColor = tone === 'self' ? 'rgba(96,165,250,0.9)' : 'rgba(239,68,68,0.9)';
  ctx.shadowBlur = (tone === 'self' ? 8 : 18) * scale;
  ctx.drawImage(silhouetteCache.image, 0, 0);
  ctx.restore();
  if (tone === 'self') {
    // Kendi başın: yalnızca sana görünen parlak halka
    const head = silhouetteShape(target).head;
    ctx.save();
    ctx.strokeStyle = 'rgba(186,230,253,0.85)';
    ctx.lineWidth = Math.max(1.5, 2.5 * scale);
    ctx.beginPath();
    ctx.arc(head.x * scale, head.y * scale, head.r * scale, 0, Math.PI * 2);
    ctx.stroke();
    ctx.restore();
  }
}

/** Her karede yeniden çizmemek için son silüet katmanı saklanır */
let silhouetteCache: { key: string; image: HTMLCanvasElement | null } | null = null;

function renderSilhouetteLayer(target: TargetPose, scale: number, w: number, h: number, tone: 'enemy' | 'self'): HTMLCanvasElement | null {
  const off = document.createElement('canvas');
  off.width = w;
  off.height = h;
  const o = off.getContext('2d');
  if (!o) return null;
  const color = tone === 'self' ? 'rgb(96,165,250)' : 'rgb(239,68,68)';
  // Rakibin gölgesi ayrıca bulanıklaşır: kenarlar belirsiz, parçalar birbirine karışır
  if (tone === 'enemy' && 'filter' in o) o.filter = `blur(${Math.max(1, Math.round(3 * scale))}px)`;
  const shape = silhouetteShape(target);
  o.strokeStyle = color;
  o.fillStyle = color;
  o.lineCap = 'round';
  for (const g of shape.segments) {
    o.lineWidth = g.r * 2 * scale;
    o.beginPath();
    o.moveTo(g.ax * scale, g.ay * scale);
    o.lineTo(g.bx * scale, g.by * scale);
    o.stroke();
  }
  for (const c of [shape.head, ...shape.ends]) {
    o.beginPath();
    o.arc(c.x * scale, c.y * scale, c.r * scale, 0, Math.PI * 2);
    o.fill();
  }
  return off;
}

/** Çizim ekranındaki bir yara izi (mantıksal koordinat) */
interface Scar {
  x: number;
  y: number;
  angle: number;
}

/** Yara izinin boyu (mantıksal birim); yalnızca görüntüdür, çizimi engellemez */
export const SCAR_RADIUS = 16;

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

/** Sis bulutu konumları: tuvale yayılır (saf fonksiyon). */
export function placeFog(count: number, random: () => number = Math.random): { x: number; y: number; r: number }[] {
  const out: { x: number; y: number; r: number }[] = [];
  for (let i = 0; i < count; i++) out.push({ x: 40 + random() * (LOGICAL_SIZE - 80), y: 70 + random() * (LOGICAL_SIZE - 120), r: 48 + random() * 22 });
  return out;
}

/** Çamur yaması konumları (saf fonksiyon). */
export function placeMud(count: number, random: () => number = Math.random): { x: number; y: number; r: number }[] {
  const out: { x: number; y: number; r: number }[] = [];
  for (let i = 0; i < count; i++) out.push({ x: 50 + random() * (LOGICAL_SIZE - 100), y: 80 + random() * (LOGICAL_SIZE - 130), r: 26 + random() * 12 });
  return out;
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
  private fogs: { x: number; y: number; r: number }[] = [];
  private muds: { x: number; y: number; r: number }[] = [];

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
    this.scars = placeScars(Math.max(0, Math.floor(this.options.scars ?? 0)), this.options.random);
    this.fogs = placeFog(Math.max(0, Math.floor(this.options.fog ?? 0)), this.options.random);
    this.muds = placeMud(Math.max(0, Math.floor(this.options.mud ?? 0)), this.options.random);
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
    // Çamur, sis ve yara izi yalnızca görüşü engeller: çizgiler her zaman kaydedilir
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
    this.applyShake();
    // Kalem durduysa ses kısılır
    if (this.loop && this.lastMove && now - this.lastMove.at > 70) this.loop.update(0);
    this.render(now);
    if (this.session.currentPhase === 'finished') this.end();
  }

  /** Sarsıntı: tuvali her karede rastgele birkaç piksel oynatır (şiddet başına ~2.5 px). */
  private applyShake(): void {
    const amp = (this.options.shake ?? 0) * 2.5;
    if (amp <= 0 || this.session.currentPhase === 'finished') {
      this.canvas.style.transform = '';
      return;
    }
    const r = this.options.random ?? Math.random;
    this.canvas.style.transform = `translate(${((r() - 0.5) * 2 * amp).toFixed(1)}px, ${((r() - 0.5) * 2 * amp).toFixed(1)}px)`;
  }

  private end(): void {
    this.canvas.style.transform = '';
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

  /** Çamur yamaları: koyu kahverengi, kenarı pütürlü; içine çizilemez. */
  private drawMud(scale: number): void {
    const { ctx } = this;
    for (const m of this.muds) {
      ctx.fillStyle = 'rgba(92,64,38,0.95)';
      ctx.beginPath();
      ctx.arc(m.x * scale, m.y * scale, m.r * scale, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = 'rgba(133,96,58,0.9)';
      for (let i = 0; i < 5; i++) {
        const a = i * 1.26 + m.x;
        ctx.beginPath();
        ctx.arc((m.x + Math.cos(a) * m.r * 0.5) * scale, (m.y + Math.sin(a) * m.r * 0.5) * scale, m.r * 0.22 * scale, 0, Math.PI * 2);
        ctx.fill();
      }
    }
  }

  /** Sis bulutları: altındaki çizimi ve hayaleti örter. */
  private drawFog(scale: number): void {
    const { ctx } = this;
    for (const f of this.fogs) {
      const g = ctx.createRadialGradient(f.x * scale, f.y * scale, f.r * 0.15 * scale, f.x * scale, f.y * scale, f.r * scale);
      g.addColorStop(0, 'rgba(186,230,253,0.92)');
      g.addColorStop(0.7, 'rgba(147,197,253,0.7)');
      g.addColorStop(1, 'rgba(147,197,253,0)');
      ctx.fillStyle = g;
      ctx.beginPath();
      ctx.arc(f.x * scale, f.y * scale, f.r * scale, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  /** Küçük kırmızı yara izleri: eğik bir kesik ve üstünde iki çapraz çizgi; dokunulan iz solar. */
  private drawScars(scale: number): void {
    const { ctx } = this;
    ctx.save();
    ctx.lineCap = 'round';
    for (const s of this.scars) {
      ctx.globalAlpha = 0.95;
      ctx.strokeStyle = '#ef4444';
      ctx.shadowColor = '#ef4444';
      ctx.shadowBlur = 6 * scale;
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

    // Faz 1: ortadaki kılavuz artı kaldırıldı (tuvalin ortasında nokta gibi görünüyordu)

    if (this.options.target) paintSilhouette(this.ctx, this.options.target, scale, this.options.targetTone ?? 'enemy');
    if (this.options.ghost) this.drawStrokes(this.options.ghost, 'rgba(255,255,255,0.22)', scale, false);
    this.drawStrokes(this.session.liveStrokes, this.options.color, scale, true);
    // Görüşü engelleyenler çizginin ÜSTÜNE çizilir: yara izi, çamur ve sis çizilenin bir kısmını örter ama çizimi bozmaz
    this.drawScars(scale);
    this.drawMud(scale);
    this.drawFog(scale);

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
